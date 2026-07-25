import AVFoundation
import Foundation
import Observation
import Speech

// MARK: - 首页「认识你自己」视图模型
//
// 客户端 UI 状态（录音计时、输入框、动画阶段）留在此；服务端状态（画像/日记分析）经
// SupabaseService 拉取（技术设计文档 §8.2）。语音转文字非主线，demo 用预置 transcript + 兜底。

@Observable
@MainActor
final class HomeModel {

    // MARK: 探索发问
    //
    // 对齐原型无话题模式：默认不选话题（no-topic），选中话题且输入为空时才填样例；
    // 再点选中的话题可取消。
    var question: String = ""
    var topic: ExploreTopic? = nil {
        didSet {
            if let topic, trimmedQuestion.isEmpty {
                question = topic.sampleQuestion
            }
        }
    }

    var trimmedQuestion: String { question.trimmingCharacters(in: .whitespacesAndNewlines) }
    var canSend: Bool { !trimmedQuestion.isEmpty }

    // MARK: 语音日记
    var isRecording = false
    var elapsed = 0
    var analyzing = false
    var analysis: DiaryAnalysis?
    var analysisError: String?
    private var timerTask: Task<Void, Never>?
    /// 分析任务由模型持有：便于用户中途取消，也避免网关偶发挂起时 UI 卡死
    private var analyzeTask: Task<Void, Never>?
    private var lastTranscript: String?

    /// demo：录音得到的预置 transcript（真实 STT 非主线）
    private let sampleTranscript = "今天又在纠结要不要转产品。会议上帮团队理清了一个乱成一团的需求，那一刻很有成就感，但一想到要放弃做了六年的设计，还是会慌。"

    var elapsedText: String {
        String(format: "%d:%02d", elapsed / 60, elapsed % 60)
    }

    func toggleRecording() {
        if isRecording { finishRecording() } else { startRecording() }
    }

    private func startRecording() {
        isRecording = true
        elapsed = 0
        analysis = nil
        analysisError = nil
        startTranscriptionIfAvailable()
        timerTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard let self, self.isRecording else { break }
                self.elapsed += 1
            }
        }
    }

    func finishRecording() {
        isRecording = false
        timerTask?.cancel()
        timerTask = nil
        stopTranscription()
    }

    /// 完成录音 → 将本次转写提交 analyze-diary（服务端按既有日记规则分析并落库）。
    /// 模型持有分析任务：便于中途取消，也避免网关偶发挂起时 UI 卡死。
    ///
    /// ASR 不可用时仍保留 demo transcript，但情绪/关键词绝不由客户端伪造：必须来自 analyze-diary。
    func startAnalyzeDiary(using supabase: SupabaseService) {
        guard !analyzing else { return }
        finishRecording()
        analyzing = true
        analysisError = nil
        analyzeTask?.cancel()
        analyzeTask = Task { [weak self] in
            guard let self else { return }
            // 端上转写有内容 → 优先真实转写；稍等 Speech 交付最终识别结果。
            if self.sttStarted { try? await Task.sleep(for: .milliseconds(600)) }
            guard !Task.isCancelled else { return }
            let localText = self.transcribedText.trimmingCharacters(in: .whitespacesAndNewlines)
            let transcript = localText.count >= 4 ? localText : self.sampleTranscript
            self.lastTranscript = transcript
            await self.runAnalysis(transcript: transcript, using: supabase)
        }
    }

    /// 复用同一份转写重试，避免失败后要求用户重新录音。
    func startRetryAnalysis(using supabase: SupabaseService) {
        guard !analyzing, let transcript = lastTranscript else { return }
        analyzing = true
        analysisError = nil
        analyzeTask?.cancel()
        analyzeTask = Task { [weak self] in
            await self?.runAnalysis(transcript: transcript, using: supabase)
        }
    }

    /// 用户主动取消本次分析：网关偶发会挂起上百秒，取消后可立即重试或重录，不被卡住。
    func cancelAnalysis() {
        analyzeTask?.cancel()
        analyzeTask = nil
        analyzing = false
        analysisError = nil
    }

    /// 单次提交 analyze-diary。最多等 50s —— 网关偶发挂起可达上百秒，超时即当失败
    /// 让用户快速重试，而不是把语音记录卡在转圈里（原「识别不了 / 点击没反应」的根因）。
    /// 情绪/关键词绝不由客户端伪造，必须来自 analyze-diary。
    private func runAnalysis(transcript: String, using supabase: SupabaseService) async {
        analyzing = true
        defer { analyzing = false }
        let result = await withTimeout(seconds: 50) {
            try await supabase.analyzeDiary(transcript: transcript)
        }
        guard !Task.isCancelled else { return }
        if let result {
            analysis = result
            // analyze-diary 已同步写入 diary_entries；刷新今天的真实状态。
            await loadDiaryOverview(using: supabase)
        } else {
            analysis = nil
            analysisError = "这次没能顺利分析，点「重试」再试一次。"
        }
    }

    // MARK: 端上语音转写（iOS Speech · zh-CN）
    //
    // 真实优先：录音时若权限与识别器可用则实时转写，analyzeDiary 用真实文本；
    // 任一环节不可用（Info.plist 未配置权限文案 / 用户拒绝 / 识别失败 / 文本过短）
    // 均静默回退 sampleTranscript，不打断主流程。

    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    /// 本次录音是否成功启动过转写（决定 analyzeDiary 是否等待最终识别结果）
    private var sttStarted = false
    private var transcribedText = ""

    /// Info.plist 缺少权限文案时触发系统权限弹窗会直接崩溃 —— 先探测再请求。
    /// 权限键位于 App/ 目录（越界不改），由波次 3 统一补 NSSpeechRecognitionUsageDescription
    /// 与 NSMicrophoneUsageDescription；补齐前此处恒为 false，安全走兜底。
    private var speechPermissionKeysPresent: Bool {
        Bundle.main.object(forInfoDictionaryKey: "NSSpeechRecognitionUsageDescription") != nil
            && Bundle.main.object(forInfoDictionaryKey: "NSMicrophoneUsageDescription") != nil
    }

    private func startTranscriptionIfAvailable() {
        transcribedText = ""
        sttStarted = false
        guard speechPermissionKeysPresent,
              let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN")) else { return }
        Task { [weak self] in
            let speechOK = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
                switch SFSpeechRecognizer.authorizationStatus() {
                case .authorized:
                    cont.resume(returning: true)
                case .notDetermined:
                    SFSpeechRecognizer.requestAuthorization { cont.resume(returning: $0 == .authorized) }
                default:
                    cont.resume(returning: false)
                }
            }
            guard speechOK else { return }
            let micOK = await AVAudioApplication.requestRecordPermission()
            guard let self, micOK, self.isRecording, recognizer.isAvailable else { return }
            self.beginAudioTranscription(with: recognizer)
        }
    }

    private func beginAudioTranscription(with recognizer: SFSpeechRecognizer) {
        let session = AVAudioSession.sharedInstance()
        guard (try? session.setCategory(.playAndRecord, mode: .measurement, options: .duckOthers)) != nil,
              (try? session.setActive(true, options: .notifyOthersOnDeactivation)) != nil else { return }
        let engine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0 else { return }
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }
        engine.prepare()
        guard (try? engine.start()) != nil else {
            input.removeTap(onBus: 0)
            return
        }
        audioEngine = engine
        recognitionRequest = request
        sttStarted = true
        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, _ in
            guard let result else { return }
            let text = result.bestTranscription.formattedString
            Task { @MainActor [weak self] in self?.transcribedText = text }
        }
    }

    private func stopTranscription() {
        guard audioEngine != nil else { return }
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        recognitionRequest?.endAudio()
        recognitionTask?.finish()
        audioEngine = nil
        recognitionRequest = nil
        recognitionTask = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    // MARK: 动态画像（空白态 · 随探索生长）
    //
    // 对齐原型「动态画像默认使用空白状态」：5 维默认「尚未填写」，完成度 0% 起，
    // 每填一维 +20%。已填内容持久化到 UserDefaults（本地私密，对应原型 localStorage）。

    struct PortraitDim: Identifiable {
        let id: String
        let icon: String
        let iconTint: UInt32
        let label: String
        /// nil 表示尚未填写（todo 虚线态）
        let value: String?
        /// 点击打开的维度浮层；nil 表示人格底色，直接进入大五人格测评
        let dimensionKey: DimensionKey?
        var isTodo: Bool { value == nil }
    }

    /// 已填维度：dimKey → 关键词拼接文本（含 personality）。UserDefaults 持久化。
    private(set) var filledDims: [String: String] = [:]
    private let store = UserDefaults.standard
    private static let storePrefix = "kaleido_dim_"

    /// 人格底色（由大五人格测评结果写入）
    var personalityText: String? { filledDims["personality"] }

    /// 从本地读取已填维度（冷启动调用），随后云端画像合并（换机 / 重装漫游）
    func loadPortrait(using supabase: SupabaseService? = nil) {
        var loaded: [String: String] = [:]
        for key in ["personality"] + DimensionKey.allCases.map(\.rawValue) {
            if let v = store.string(forKey: Self.storePrefix + key), !v.isEmpty {
                loaded[key] = v
            }
        }
        filledDims = loaded
        loadLifeSignature()

        guard let supabase else { return }
        refreshPersona(using: supabase)
        Task { [weak self] in
            guard let remote = try? await supabase.fetchRemoteProfile() else { return }
            guard let self else { return }
            // 远端非空、本地为空的键补进来；本地已有的以本地为准（刚编辑过更新）
            for (key, value) in remote.dims where !value.isEmpty && self.filledDims[key] == nil {
                self.filledDims[key] = value
                self.store.set(value, forKey: Self.storePrefix + key)
            }
        }
    }

    /// 已保存关键词拆回数组（重开浮层时回显已选）
    func selectedKeywords(for key: DimensionKey) -> [String] {
        guard let text = filledDims[key.rawValue] else { return [] }
        return text.components(separatedBy: " · ").filter { !$0.isEmpty }
    }

    /// 保存某维度的关键词选择 → 回填 + 本地持久化 + 云端落库（失败静默，本地已存）
    func saveDimension(_ key: DimensionKey, keywords: [String], using supabase: SupabaseService? = nil) {
        let picked = Array(keywords.prefix(5))
        let text = picked.joined(separator: " · ")
        guard !text.isEmpty else { return }
        filledDims[key.rawValue] = text
        store.set(text, forKey: Self.storePrefix + key.rawValue)
        if let supabase {
            Task { [weak self] in
                // 先落库再重新生成云端形象（/persona 读服务端画像，需等新维度可见）；
                // 连续填多个维度时经防抖合并，停止操作 ~2s 后才真正触发一次生成
                try? await supabase.saveDimensionRemote(key: key, tags: picked)
                self?.scheduleRefreshPersona(using: supabase)
            }
        }
    }

    /// 人格底色（大五测评 / MBTI 徽标写入）
    func savePersonality(_ text: String) {
        guard !text.isEmpty else { return }
        filledDims["personality"] = text
        store.set(text, forKey: Self.storePrefix + "personality")
    }

    /// 五维画像卡（人格底色 + 四软维度）
    var portraitDims: [PortraitDim] {
        var rows: [PortraitDim] = [
            PortraitDim(id: "personality", icon: "◎", iconTint: 0x5968D9,
                        label: "人格底色", value: personalityText, dimensionKey: nil),
        ]
        for key in DimensionKey.allCases {
            let cfg = DimensionData.config(key)
            rows.append(PortraitDim(id: key.rawValue, icon: cfg.icon, iconTint: cfg.tint,
                                    label: cfg.title, value: filledDims[key.rawValue], dimensionKey: key))
        }
        return rows
    }

    /// 完成度：已填维度数 / 6（人格底色 + 5 软维度）
    var completionPct: Int { min(100, Int((Double(filledDims.count) / 6 * 100).rounded())) }

    /// 人生底牌签名（人生卡牌完成后 3 张公开底牌；UserDefaults 持久化，卡牌游戏结算写入）
    private(set) var lifeSignatureCards: [LifeSignatureCard] = []
    var lifeSignature: [String] { lifeSignatureCards.map(\.name) }
    static let lifeSignatureKey = "kaleido_life_signature_v1"

    struct LifeSignatureCard: Codable, Hashable {
        let glyph: String
        let name: String
    }

    /// 冷启动 / 卡牌游戏结算后重新读取人生底牌
    func loadLifeSignature() {
        guard let data = store.data(forKey: Self.lifeSignatureKey),
              let cards = try? JSONDecoder().decode([LifeSignatureCard].self, from: data) else {
            lifeSignatureCards = []
            return
        }
        lifeSignatureCards = Array(cards.prefix(3))
    }

    // MARK: 云端数字形象（/persona 真实生成 · 本地 PersonaModel.build 兜底）

    /// 最近一次云端生成的形象参数；nil = 未生成 / 失败（走本地兜底）
    private(set) var remotePersona: PersonaJob.Persona?
    private var personaTask: Task<Void, Never>?
    /// refreshPersona 防抖任务（saveDimension 连续触发时合并为一次）
    private var personaRefreshDebounce: Task<Void, Never>?
    /// 上次成功触发生成时的画像快照（去重：画像没变不重复调 LLM）
    private var lastPersonaSnapshot: String?

    /// 云端形象的一句话说明（展示在形象 caption 位）
    var personaSummary: String? { remotePersona?.summary }

    /// 画像维度变化后重新生成云端形象；失败或超时 15s 静默保持本地兜底。
    /// 画像快照未变化且已有云端形象时跳过（避免每次 onAppear 重复打 LLM）。
    func refreshPersona(using supabase: SupabaseService) {
        let snapshot = (["personality"] + DimensionKey.allCases.map(\.rawValue))
            .compactMap { filledDims[$0] }
            .joined(separator: "|") + "#" + lifeSignature.joined(separator: "|")
        guard snapshot != lastPersonaSnapshot || remotePersona == nil else { return }
        lastPersonaSnapshot = snapshot
        personaTask?.cancel()
        personaTask = Task { [weak self] in
            let job = await withTimeout(seconds: 15) { try await supabase.personaGenerate() }
            guard let self, !Task.isCancelled,
                  let job, job.status != "failed",
                  let persona = job.persona else { return }
            self.remotePersona = persona
        }
    }

    /// refreshPersona 的防抖入口：连续保存多个维度时取消上一个待执行任务，
    /// 用户停止操作 ~2s 后才真正触发一次 persona 生成（参照 MeModel.scheduleRemoteSave）
    private func scheduleRefreshPersona(using supabase: SupabaseService) {
        personaRefreshDebounce?.cancel()
        personaRefreshDebounce = Task { [weak self] in
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled, let self else { return }
            self.refreshPersona(using: supabase)
        }
    }

    /// 后端 shape（中文形态名或英文 key）→ 本地绘制形态；未知形态回退本地计算
    private static func personaForm(named shape: String) -> PersonaModel.Form? {
        let lower = shape.lowercased()
        if lower.contains("crystal") || shape.contains("晶") { return .crystal }
        if lower.contains("bloom") || shape.contains("花") { return .bloom }
        if lower.contains("wing") || shape.contains("翼") { return .wing }
        if lower.contains("orbit") || shape.contains("星") || shape.contains("轨") { return .orbit }
        return nil
    }

    /// 抽象数字形象模型：优先用云端 persona（shape/hue/lobes/seed）驱动绘制，
    /// 未生成 / 失败时随已填维度、底牌本地重建（@Observable 联动）
    var personaModel: PersonaModel {
        let values = (["personality"] + DimensionKey.allCases.map(\.rawValue))
            .compactMap { filledDims[$0] }
        let local = PersonaModel.build(values: values, signature: lifeSignature)
        guard let remote = remotePersona else { return local }
        return PersonaModel(
            seed: UInt32(clamping: max(0, remote.seed)),
            filled: values.count,
            signature: lifeSignature,
            form: Self.personaForm(named: remote.shape) ?? local.form,
            hue: Double(remote.hue),
            lobes: Double(min(max(remote.lobes, 3), 9)),
            shapeName: remote.shape
        )
    }

    // MARK: 今日语音日记 / 探索天数

    /// 今天已有云端日记时的主情绪 emoji
    private(set) var todayEmoji: String?
    /// 区分「今天没有日记」与「今天有日记但没有提取到情绪」。
    private(set) var hasRemoteDiaryToday = false
    var hasRecordedToday: Bool { analysis != nil || hasRemoteDiaryToday }
    /// 刚录完优先使用分析结果；云端已有记录则使用拉取到的真实情绪。
    var todayDisplayEmoji: String {
        if let emotion = analysis?.emotions.first {
            return EmotionEmoji.emoji(for: emotion)
        }
        return todayEmoji ?? ""
    }
    /// 已探索天数：最早一条日记距今 +1；无日记 = 第 1 天；未加载/失败保持 demo 值
    private(set) var exploredDays = 47

    /// 「今天」始终对应真实日期；只有今天的数据来自云端。
    var diaryTodayDate: String {
        SupabaseTimestamp.dayString(from: Date())
    }

    /// 拉取云端日记 → 读取今天的真实状态 + 推算探索天数（冷启动调用，失败静默）
    /// 服务端把 limit 钳制到 50，故只取 50 条；总数超窗时另取最早一条修正探索天数。
    func loadDiaryOverview(using supabase: SupabaseService) async {
        guard let page = try? await supabase.listDiaryPage(limit: 50, offset: 0) else { return }
        let rows = page.entries

        // 天 → 当天最新一条的情绪列表（list-diary 按时间倒序，首见即最新）
        var emotionsByDay: [String: [String]] = [:]
        var earliest: Date?
        for row in rows {
            guard let created = SupabaseTimestamp.parse(row.createdAt) else { continue }
            if earliest.map({ created < $0 }) ?? true { earliest = created }
            let key = SupabaseTimestamp.dayString(from: created)
            if emotionsByDay[key] == nil { emotionsByDay[key] = row.emotions ?? [] }
        }

        // 日记总数超出本窗：按倒序末位（offset = total-1）取最早一条，
        // 探索天数不被 50 条窗口截断低估；失败静默沿用窗口内最早值
        if page.total > rows.count,
           let oldest = try? await supabase.listDiaryPage(limit: 1, offset: page.total - 1).entries.first,
           let created = SupabaseTimestamp.parse(oldest.createdAt) {
            earliest = created
        }

        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        if let earliest {
            let days = cal.dateComponents([.day], from: cal.startOfDay(for: earliest), to: today).day ?? 0
            exploredDays = max(1, days + 1)
        } else {
            exploredDays = 1
        }

        let todayKey = SupabaseTimestamp.dayString(from: today)
        hasRemoteDiaryToday = emotionsByDay[todayKey] != nil
        todayEmoji = emotionsByDay[todayKey].map { EmotionEmoji.emoji(for: $0.first) }
    }

    // MARK: demo 人物
    let userName = "老己"
}

// MARK: - list-diary 分页扩展（探索天数用）
//
// SupabaseService.listDiary 只回 entries；探索天数需要服务端 total + offset
// 取最早一条（服务端把 limit 钳制到 50）。请求方式与 SupabaseService 内部一致。
extension SupabaseService {

    struct DiaryPage: Decodable {
        let entries: [RemoteDiaryEntry]
        let total: Int
    }

    /// POST /list-diary 带 offset 的分页版；返回 entries + total
    func listDiaryPage(limit: Int, offset: Int) async throws -> DiaryPage {
        struct Body: Encodable {
            let limit: Int
            let offset: Int
        }
        var req = URLRequest(url: AppConfig.functionURL("list-diary"))
        req.httpMethod = "POST"
        req.timeoutInterval = 20
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(try await jwt())", forHTTPHeaderField: "Authorization")
        req.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.httpBody = try JSONEncoder().encode(Body(limit: limit, offset: offset))
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(DiaryPage.self, from: data)
    }
}
