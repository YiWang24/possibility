import Foundation
import Observation

// MARK: - 统一测评引擎（原型 hollandState / demoAssessmentState 状态机）
//
// intro → questions（逐题 5 点量表，选择即自动保存，可中途退出续答）→ result。
// 全部本地持久化（UserDefaults JSON），对齐原型 localStorage 键名。

@Observable
@MainActor
final class AssessmentModel {
    enum Phase { case intro, questions, result }

    let config: AssessmentConfig
    var phase: Phase = .intro
    var index = 0
    /// 每题 0–4，nil 未答
    var answers: [Int?]
    var result: AssessmentResult?

    private let store = UserDefaults.standard

    struct AssessmentResult: Codable {
        /// 维度 → 分数（holland 为总分 0–20，demo 为百分比 0–100）
        var scores: [String: Int]
        /// facet → 百分比（仅大五）
        var facets: [String: Int]?
        /// 分数降序的维度键
        var ordered: [String]
        /// 并列组展开选中的维度（holland tie 处理）
        var selected: [String]?
        var code: String?
        var displayCode: String?
        var completedAt: Date
    }

    private struct Persisted: Codable {
        var phase: String?
        var index: Int?
        var answers: [Int?]
        var result: AssessmentResult?
    }

    init(kind: AssessmentKind) {
        let cfg = AssessmentData.config(kind)
        config = cfg
        answers = Array(repeating: nil, count: cfg.items.count)
        load()
    }

    var storeKey: String {
        switch config.kind {
        case .holland: return "kaleido_assessment_holland_v1"
        case .bigfive: return "kaleido_demo_assessment_bigfive_v2"
        default: return "kaleido_demo_assessment_\(config.kind.rawValue)_v1"
        }
    }

    var answeredCount: Int { answers.compactMap { $0 }.count }
    var progress: Double { Double(answeredCount) / Double(config.items.count) }
    var isLast: Bool { index == config.items.count - 1 }
    var currentAnswer: Int? { answers[index] }

    // MARK: 持久化

    private func load() {
        guard let data = store.data(forKey: storeKey),
              let saved = try? JSONDecoder().decode(Persisted.self, from: data),
              saved.answers.count == config.items.count else { return }
        answers = saved.answers
        result = saved.result
        if let i = saved.index { index = max(0, min(config.items.count - 1, i)) }
    }

    func persist() {
        let payload = Persisted(phase: phase == .questions ? "questions" : "intro",
                                index: index, answers: answers, result: result)
        if let data = try? JSONEncoder().encode(payload) {
            store.set(data, forKey: storeKey)
        }
    }

    // MARK: 流程

    func begin() {
        index = answers.firstIndex(where: { $0 == nil }) ?? 0
        phase = .questions
    }

    func select(_ value: Int) {
        answers[index] = value
        persist()
    }

    func previous() {
        guard index > 0 else { return }
        index -= 1
        persist()
    }

    /// 下一题；已是末题则校验空题或结算。返回 toast 提示（如有）。
    func next() -> String? {
        guard answers[index] != nil else { return nil }
        if !isLast {
            index += 1
            persist()
            return nil
        }
        if let missing = answers.firstIndex(where: { $0 == nil }) {
            index = missing
            return "还有一道题没有回答"
        }
        complete()
        return nil
    }

    // MARK: 结算（原型 completeHollandAssessment / completeDemoAssessment）

    private func complete() {
        if config.kind == .holland { completeHolland() } else { completeDemo() }
        phase = .result
        persist()
    }

    private func completeHolland() {
        var scores: [String: Int] = [:]
        for (item, answer) in zip(config.items, answers) {
            scores[item.dim, default: 0] += answer ?? 0
        }
        let dimOrder = config.dims.map(\.key)
        let ordered = dimOrder.sorted {
            scores[$0]! != scores[$1]! ? scores[$0]! > scores[$1]!
                : dimOrder.firstIndex(of: $0)! < dimOrder.firstIndex(of: $1)!
        }
        // 按分数层级展开并列组，直到 ≥3 个
        var selected: [String] = []
        var displayGroups: [String] = []
        for level in ordered.map({ scores[$0]! }).reduce(into: [Int]()) { if !$0.contains($1) { $0.append($1) } } {
            let group = ordered.filter { scores[$0]! == level }
            selected.append(contentsOf: group)
            displayGroups.append(group.joined(separator: "/"))
            if selected.count >= 3 { break }
        }
        result = AssessmentResult(
            scores: scores, facets: nil, ordered: ordered, selected: selected,
            code: ordered.prefix(3).joined(), displayCode: displayGroups.joined(separator: "-"),
            completedAt: Date())
    }

    private func completeDemo() {
        var totals: [String: Int] = [:], counts: [String: Int] = [:]
        var facetTotals: [String: Int] = [:], facetCounts: [String: Int] = [:]
        for (item, answer) in zip(config.items, answers) {
            let value = item.reversed ? 4 - (answer ?? 0) : (answer ?? 0)
            totals[item.dim, default: 0] += value
            counts[item.dim, default: 0] += 1
            if let f = item.facet {
                facetTotals[f, default: 0] += value
                facetCounts[f, default: 0] += 1
            }
        }
        var scores: [String: Int] = [:]
        for key in config.dims.map(\.key) {
            scores[key] = Int((Double(totals[key] ?? 0) / Double((counts[key] ?? 1) * 4) * 100).rounded())
        }
        var facets: [String: Int] = [:]
        for (f, total) in facetTotals {
            facets[f] = Int((Double(total) / Double(facetCounts[f]! * 4) * 100).rounded())
        }
        let dimOrder = config.dims.map(\.key)
        let ordered = dimOrder.sorted {
            scores[$0]! != scores[$1]! ? scores[$0]! > scores[$1]!
                : dimOrder.firstIndex(of: $0)! < dimOrder.firstIndex(of: $1)!
        }
        result = AssessmentResult(scores: scores, facets: facets.isEmpty ? nil : facets,
                                  ordered: ordered, selected: nil, code: nil, displayCode: nil,
                                  completedAt: Date())
    }

    // MARK: 结果展示文案（原型 demoResultTags / demoResultNarrative / hollandNarrative）

    var resultTags: [String] {
        guard let result else { return [] }
        switch config.kind {
        case .holland:
            let top = result.selected ?? Array(result.ordered.prefix(3))
            return top.map { config.dim($0).label }
        case .bigfive:
            return config.dims.map { d in
                result.scores[d.key, default: 0] >= 58 ? d.label : (AssessmentData.bigfiveLowLabels[d.key] ?? d.label)
            }
        case .love:
            return [
                result.scores["anxiety", default: 0] >= 58 ? "及时回应" : "稳定信任",
                result.scores["avoidance", default: 0] >= 58 ? "尊重边界" : "亲密联结",
                "冲突后愿意修复",
            ]
        default:
            return result.ordered.prefix(3).map { config.dim($0).label }
        }
    }

    var resultNarrative: String {
        guard let result else { return "" }
        switch config.kind {
        case .holland:
            if (result.selected ?? []).count > 3 {
                return "你的六类兴趣比较接近。这不表示没有特点，可能意味着你能从多种活动中获得动力，也需要更多真实体验来拉开偏好。"
            }
            let a = result.ordered[0], b = result.ordered[1]
            return AssessmentData.hollandPairNarrative[a + b]
                ?? "你的兴趣主要落在\(config.dim(a).name)与\(config.dim(b).name)之间。它们可以出现在很多行业、角色和生活项目里。"
        case .love:
            let a = result.scores["anxiety", default: 0], v = result.scores["avoidance", default: 0]
            if a >= 58 && v >= 58 { return "你既需要明确的回应，也会在过度靠近时保护自己的空间。关系里的确定感与边界感需要同时被看见。" }
            if a >= 58 { return "你更容易通过及时回应、稳定承诺与冲突后的修复获得安全感。沉默和悬而未决可能比争执本身更消耗你。" }
            if v >= 58 { return "你重视自主与边界，更愿意在不被催促和侵入的前提下逐渐靠近。被尊重空间会帮助你表达需要。" }
            return "你通常能在亲密与自主之间保持相对稳定，更看重坦诚、信任和双方都愿意修复关系。"
        default:
            let top = Array(result.ordered.prefix(2))
            let d0 = config.dim(top[0]), d1 = config.dim(top[1])
            return "目前最突出的两个信号是“\(d0.label)”和“\(d1.label)”。\(d0.desc)；同时也表现出\(d1.desc)的倾向。"
        }
    }

    /// 大五：得分最高的 6 个细分面向
    var topFacets: [(facet: AssessmentData.Facet, score: Int)] {
        guard let facets = result?.facets else { return [] }
        return facets.sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }
            .prefix(6)
            .compactMap { key, score in
                AssessmentData.facetMeta(key).map { ($0, score) }
            }
    }

    // MARK: 静态状态查询（画像工作室卡片展示，不建整个引擎）

    struct Snapshot {
        var answered: Int
        var total: Int
        var result: AssessmentResult?
    }

    static func snapshot(_ kind: AssessmentKind) -> Snapshot {
        let model = AssessmentModel(kind: kind)
        return Snapshot(answered: model.answeredCount, total: model.config.items.count, result: model.result)
    }
}

// MARK: - MBTI 徽标（原型 MBTI_STORE_KEY）

enum MBTIStore {
    static let key = "kaleido_mbti_badge_v1"
    static var current: String? {
        UserDefaults.standard.string(forKey: key)
    }
    static func save(_ type: String) {
        UserDefaults.standard.set(type, forKey: key)
    }
}
