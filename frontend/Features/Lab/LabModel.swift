import Foundation
import Observation

// MARK: - 人生实验室视图模型（技术设计文档 §9.2）
//
// POST /lab-choices 按问题生成动态选择卡。
// 转盘设年限 + 选择卡 (+ 底线卡 carry_cards) → POST /simulate →
// {general, optimistic, cautionary} 三结局 + bottom_line_analysis + recommended_traveler_ids。

@Observable
@MainActor
final class LabModel {

    struct Choice: Identifiable, Hashable, Codable {
        var id: String { name }
        let emoji: String
        let name: String
        let desc: String
        var isCustom: Bool = false
        /// LLM 卡的 CSS 颜色（#RRGGBB / rgba(...)）；nil 走默认卡面视觉
        var color: String? = nil
    }

    var question = ExploreTopic.career.sampleQuestion
    var editing = false
    var draft = ""

    var pick: String?
    var horizon: SimulationHorizon = .year5

    var loading = false
    var loadStep = 0
    var result: SimResultData?

    /// 自定义选择卡（原型 customChoices · UserDefaults 持久化）
    private(set) var customChoices: [Choice] = []
    private static let customStoreKey = "kaleido_custom_choices_v1"

    /// LLM 动态选择卡（POST /lab-choices）
    private(set) var remoteChoices: [Choice] = []
    /// 动态卡请求中（扇形卡区展示加载指示）
    private(set) var choicesLoading = false
    /// 请求代际：问题更换后丢弃过期响应
    private var choicesRequestID = 0
    /// API 失败时交给视图展示；绝不以 mock 数据掩盖失败
    private(set) var errorMessage: String?

    var choices: [Choice] { remoteChoices + customChoices }

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.customStoreKey),
           let saved = try? JSONDecoder().decode([Choice].self, from: data) {
            customChoices = saved
        }
    }

    func addCustomChoice(name: String, desc: String) -> Bool {
        let n = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(18))
        let d = String(desc.trimmingCharacters(in: .whitespacesAndNewlines).prefix(42))
        guard !n.isEmpty, !d.isEmpty, !choices.contains(where: { $0.name == n }) else { return false }
        customChoices.append(Choice(emoji: "✍️", name: n, desc: d, isCustom: true))
        persistCustom()
        return true
    }

    func removeCustomChoice(_ name: String) {
        customChoices.removeAll { $0.name == name }
        if pick == name { pick = nil }
        persistCustom()
    }

    private func persistCustom() {
        if let data = try? JSONEncoder().encode(customChoices) {
            UserDefaults.standard.set(data, forKey: Self.customStoreKey)
        }
    }

    // MARK: 动态选择卡（POST /lab-choices，仅真实 API）

    /// 按当前问题生成动态选择卡；每次调用都重新请求真实 API。
    func loadChoices(supabase: SupabaseService) async {
        let q = question

        choicesRequestID += 1
        let requestID = choicesRequestID
        choicesLoading = true
        errorMessage = nil
        remoteChoices = []
        pick = nil

        // 经网关的 lab-choices 单次成功约 8~12s（真机叠加 TLS/蜂窝网络更高），
        // 后端对网关偶发挂起还会重试。15s 上限过紧，常把「慢但成功」的生成误判为失败；
        // 放宽到 30s 覆盖正常波动，真正挂起才落到下方错误态 + 重新生成入口。
        let response = await withTimeout(seconds: 30) { try await supabase.labChoices(question: q) }

        // 已有更新的请求在跑：本次结果整体作废（loading 由新请求收尾）
        guard requestID == choicesRequestID else { return }
        choicesLoading = false
        // 问题已更换或请求失败/超时：保持空状态，明确提示，不展示 mock
        guard q == question, let cards = response?.cards, !cards.isEmpty else {
            errorMessage = "选择卡生成失败，请检查网络后重试"
            return
        }

        var seen = Set(customChoices.map(\.name))
        var mapped: [Choice] = []
        for card in cards {
            let name = String(card.title.trimmingCharacters(in: .whitespacesAndNewlines).prefix(18))
            let desc = String(card.description.trimmingCharacters(in: .whitespacesAndNewlines).prefix(42))
            guard !name.isEmpty, !desc.isEmpty, seen.insert(name).inserted else { continue }
            mapped.append(Choice(emoji: card.glyph.isEmpty ? "✦" : card.glyph,
                                 name: name, desc: desc, color: card.color))
        }
        // 卡片全部被去重/清洗过滤：等同 API 返回无效
        guard !mapped.isEmpty else {
            errorMessage = "选择卡生成结果无效，请重试"
            return
        }

        remoteChoices = mapped
    }

    static let loadSteps = ["读取你的动态画像……", "匹配 1,842 位相似旅人的经历……", "折出三种可能的未来……"]

    var canSim: Bool { pick != nil && !loading }

    // MARK: 底线卡（原型 carry-section / CARRY_META）

    struct CarryCard: Identifiable, Hashable {
        let id: String
        let glyph: String
        let name: String
        let source: String
        /// 最坏结果里的底线风险描述（floor test）
        let risk: String
    }

    /// 一起带走的底线卡 id（最多 3 张）
    var carry: [String] = []

    static let carryCards: [CarryCard] = [
        CarryCard(id: "income", glyph: "▣", name: "稳定收入", source: "对话线索",
                  risk: "转型不顺时，收入可能在一段时间内下降，生活安全感受到直接冲击。"),
        CarryCard(id: "health", glyph: "＋", name: "身体不透支", source: "日记线索",
                  risk: "反复尝试与加倍学习可能挤压睡眠和恢复时间，身体先替选择支付代价。"),
        CarryCard(id: "relation", glyph: "♡", name: "重要关系", source: "关系画像",
                  risk: "压力与时间投入可能让你减少陪伴，也可能加剧家人对这次改变的不理解。"),
        CarryCard(id: "craft", glyph: "✦", name: "专业积累", source: "职业画像",
                  risk: "最差情况下，新岗位没有站稳，原有专业身份也因中断而需要重新证明。"),
        CarryCard(id: "creation", glyph: "◇", name: "创造实感", source: "动态画像",
                  risk: "你可能进入一个更偏协调和推进的岗位，却发现真正动手创造的时刻反而更少。"),
        CarryCard(id: "exit", glyph: "↩", name: "保留退路", source: "风险预案",
                  risk: "如果投入过深、现金流下降或履历断裂，回到原路径的成本会明显升高。"),
    ]

    static func carryCard(_ id: String) -> CarryCard? {
        carryCards.first { $0.id == id }
    }

    /// 底线卡开关；满 3 张时返回提示
    func toggleCarry(_ id: String) -> String? {
        if let i = carry.firstIndex(of: id) {
            carry.remove(at: i)
        } else if carry.count < 3 {
            carry.append(id)
        } else {
            return "最多带走 3 张底线卡"
        }
        return nil
    }

    // MARK: 交互

    func pickChoice(_ name: String) {
        pick = name
    }

    func beginEdit() {
        draft = question
        editing = true
    }

    func saveEdit() {
        let clean = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        if !clean.isEmpty { question = clean }
        editing = false
    }

    // MARK: 推演

    /// 最近一次推演返回的底线分析（nil = 服务端未返回，Result 页不展示该区块）
    private(set) var bottomLine: SimulationResult.BottomLineAnalysis?

    func runSim(supabase: SupabaseService) async {
        guard let pick, !loading else { return }
        loading = true
        loadStep = 0
        errorMessage = nil

        // 加载步骤动画与网络请求并行；保证最短展示时长，节奏稳
        async let simulation = fetchSimulation(pick: pick, supabase: supabase)
        async let _: Void = runLoadingSteps()
        do {
            let remote = try await simulation

            bottomLine = remote.bottomLineAnalysis

            // 只使用 API 返回的推荐 id；不再本地筛选或补 mock 旅人
            let people = (remote.recommendedTravelerIds ?? []).compactMap { id in
                supabase.travelers.first { $0.id == id }
            }

            result = SimResultData(question: question, choice: pick, horizon: horizon,
                                   scenarios: remote.scenarios, people: people,
                                   carry: carry)
        } catch {
            bottomLine = nil
            errorMessage = "推演 API 调用失败，请检查网络后重试"
        }
        loading = false
    }

    private func fetchSimulation(pick: String, supabase: SupabaseService) async throws -> SimulationResult {
        // 底线卡以卡名传给 LLM（服务端直接拼进 prompt）
        let carryNames = carry.compactMap { Self.carryCard($0)?.name }
        return try await supabase.simulateFull(question: question, choice: pick,
                                               horizon: horizon,
                                               carryCards: carryNames.isEmpty ? nil : carryNames)
    }

    private func runLoadingSteps() async {
        for step in 0..<Self.loadSteps.count {
            loadStep = step
            try? await Task.sleep(for: .milliseconds(750))
        }
    }

}
