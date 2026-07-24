import Foundation
import Observation

// MARK: - 首页「认识自己」视图模型
//
// 客户端 UI 状态（录音计时、输入框、动画阶段）留在此；服务端状态（画像/日记分析）经
// SupabaseService 拉取（技术设计文档 §8.2）。语音转文字非主线，demo 用预置 transcript + 兜底。

@Observable
@MainActor
final class HomeModel {

    // MARK: 探索发问
    var question: String = ExploreTopic.career.sampleQuestion
    var topic: ExploreTopic = .career {
        didSet {
            // 切换话题时，若输入框仍是上个话题的样例问题，则替换为新话题样例
            if question == oldValue.sampleQuestion || question.isEmpty {
                question = topic.sampleQuestion
            }
        }
    }

    var trimmedQuestion: String { question.trimmingCharacters(in: .whitespacesAndNewlines) }
    var canSend: Bool { !trimmedQuestion.isEmpty }
    var questionCount: Int { question.count }

    // MARK: 语音日记
    var isRecording = false
    var elapsed = 0
    var analyzing = false
    var analysis: DiaryAnalysis?
    private var timerTask: Task<Void, Never>?

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
    }

    /// 完成录音 → 分析情绪与关键词（analyze-diary，失败走兜底）
    func analyzeDiary(using supabase: SupabaseService) async {
        finishRecording()
        analyzing = true
        defer { analyzing = false }
        if let result = try? await supabase.analyzeDiary(transcript: sampleTranscript) {
            analysis = result
        } else {
            analysis = Self.fallbackAnalysis
        }
    }

    /// 断网兜底的日记分析（对应 §13 现场抖动缓解）
    static let fallbackAnalysis = DiaryAnalysis(
        emotions: ["纠结", "成就感", "焦虑"],
        keywords: ["转型", "设计", "产品", "身份认同"],
        dimUpdates: nil
    )

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
        /// 点击打开的维度浮层；nil 表示走画像工作室（如人格底色）
        let dimensionKey: DimensionKey?
        var isTodo: Bool { value == nil }
    }

    /// 已填维度：dimKey → 关键词拼接文本（含 personality）。UserDefaults 持久化。
    private(set) var filledDims: [String: String] = [:]
    private let store = UserDefaults.standard
    private static let storePrefix = "kaleido_dim_"

    /// 人格底色（走工作室测评，暂未接入 → 常为 nil）
    var personalityText: String? { filledDims["personality"] }

    /// 从本地读取已填维度（冷启动调用）
    func loadPortrait() {
        var loaded: [String: String] = [:]
        for key in ["personality"] + DimensionKey.allCases.map(\.rawValue) {
            if let v = store.string(forKey: Self.storePrefix + key), !v.isEmpty {
                loaded[key] = v
            }
        }
        filledDims = loaded
    }

    /// 已保存关键词拆回数组（重开浮层时回显已选）
    func selectedKeywords(for key: DimensionKey) -> [String] {
        guard let text = filledDims[key.rawValue] else { return [] }
        return text.components(separatedBy: " · ").filter { !$0.isEmpty }
    }

    /// 保存某维度的关键词选择 → 回填 + 持久化
    func saveDimension(_ key: DimensionKey, keywords: [String]) {
        let text = keywords.prefix(5).joined(separator: " · ")
        guard !text.isEmpty else { return }
        filledDims[key.rawValue] = text
        store.set(text, forKey: Self.storePrefix + key.rawValue)
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

    /// 完成度：已填维度数 × 20%（5 维满 100%）
    var completionPct: Int { min(100, filledDims.count * 20) }

    /// 人生底牌签名（人生卡牌完成后 3 张公开底牌；暂未接入 → 空）
    var lifeSignature: [String] { [] }

    // MARK: demo 人物
    let userName = "屿岸"
    let exploredDays = 47
}
