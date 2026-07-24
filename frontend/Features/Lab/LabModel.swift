import Foundation
import Observation

// MARK: - 人生实验室视图模型（技术设计文档 §9.2）
//
// 转盘设年限 + 选择卡 → POST /simulate → {general, optimistic, cautionary} 三种结局。
// 现场抖动回退 canned scenarios（§13）。

@Observable
@MainActor
final class LabModel {

    struct Choice: Identifiable, Hashable {
        var id: String { name }
        let emoji: String
        let name: String
        let desc: String
    }

    var question = ExploreTopic.career.sampleQuestion
    var editing = false
    var draft = ""

    var pick: String?
    var year = AppConfig.Threshold.simDefaultYears

    var loading = false
    var loadStep = 0
    var result: SimResultData?

    let choices: [Choice] = [
        .init(emoji: "🎨", name: "继续做设计", desc: "深耕交互，走专家路线"),
        .init(emoji: "🧭", name: "转 AI 产品", desc: "换赛道，做 AI 产品经理"),
        .init(emoji: "🌱", name: "边做边尝试", desc: "不辞职，用业余时间试水"),
        .init(emoji: "🍃", name: "放弃探索", desc: "先安顿好现在的生活"),
    ]

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
        CarryCard(id: "exit", glyph: "↩", name: "保留退路", source: "处境扫描",
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

    func runSim(supabase: SupabaseService) async {
        guard let pick, !loading else { return }
        loading = true
        loadStep = 0

        // 加载步骤动画与网络请求并行；保证最短展示时长，节奏稳
        async let scenarios: Simulation.Scenarios = fetchScenarios(pick: pick, supabase: supabase)
        async let _: Void = runLoadingSteps()
        let resolved = await scenarios

        let pool = supabase.travelers.isEmpty ? DemoData.travelers : supabase.travelers
        let people = Array(pool.filter { $0.isSimilar }.prefix(3))

        result = SimResultData(question: question, choice: pick, years: year,
                               scenarios: resolved, people: people.isEmpty ? Array(pool.prefix(3)) : people,
                               carry: carry)
        loading = false
    }

    private func fetchScenarios(pick: String, supabase: SupabaseService) async -> Simulation.Scenarios {
        if let remote = try? await supabase.simulate(question: question, choice: pick, years: year) {
            return remote
        }
        return Self.cannedScenarios(choice: pick, years: year)
    }

    private func runLoadingSteps() async {
        for step in 0..<Self.loadSteps.count {
            loadStep = step
            try? await Task.sleep(for: .milliseconds(750))
        }
    }

    // MARK: - 兜底三结局（文案对齐原型 resultPage）

    static func cannedScenarios(choice: String, years: Int) -> Simulation.Scenarios {
        Simulation.Scenarios(
            general: Simulation.Scenario(
                headline: "你可能成为有设计背景的 AI 产品经理，开始独立负责项目。",
                dimensions: [
                    .init(label: "职业状态", text: "完成转型，独立负责项目"),
                    .init(label: "收入趋势", text: "前期持平，后期有增长"),
                    .init(label: "生活节奏", text: "学习和工作时间明显增加"),
                    .init(label: "内心感受", text: "成长感增强，压力也更大"),
                ],
                gains: ["更大的产品决策权", "AI 行业的一手经验", "设计与产品的复合优势"],
                costs: ["短期收入和稳定性波动", "私人时间减少", "需要重建专业话语权"],
                keyCondition: "能在第一年获得至少一个真实的 AI 项目经历。"),
            optimistic: Simulation.Scenario(
                headline: "你顺利转型为优秀的 AI 产品经理，在行业中建立起个人的影响力。",
                dimensions: [
                    .init(label: "职业状态", text: "负责核心产品方向，影响重要决策"),
                    .init(label: "收入趋势", text: "显著提升，进入行业中上水平"),
                    .init(label: "生活节奏", text: "更忙，但成就感和掌控感强"),
                    .init(label: "内心感受", text: "笃定、自信，对未来更有掌控感"),
                ],
                gains: ["快速的职业成长", "更高的收入和回报", "更广的行业资源和人脉"],
                costs: ["持续学习和深度投入", "获得关键项目和机会", "敢于承担错误和责任"],
                keyCondition: nil),
            cautionary: Simulation.Scenario(
                headline: "转型过程困难，方向反复，最终回到原岗位，信心受挫。",
                dimensions: [
                    .init(label: "职业状态", text: "转型未达预期，回到设计岗位"),
                    .init(label: "收入趋势", text: "短期收入下降，恢复缓慢"),
                    .init(label: "生活节奏", text: "焦虑、反复尝试，精力消耗大"),
                    .init(label: "内心感受", text: "失落、自我怀疑，动力下降"),
                ],
                gains: ["拓宽了认知边界", "积累了跨领域经验", "更清楚自己真正想要的"],
                costs: ["缺乏真实项目经验", "学习碎片化，难以落地", "对产品工作兴趣不足"],
                keyCondition: nil)
        )
    }
}
