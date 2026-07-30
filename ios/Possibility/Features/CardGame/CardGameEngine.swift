import Foundation
import Observation

// MARK: - 卡牌游戏通用引擎（原型 lifeState / relationshipState / valueGameState 状态机）
//
// intro → 选 9 张 → 每轮：抽情境（按压力就近取 5 张）→ 决策（接受 加压 / 交换弃 2 张 减压）
// → 手中自然剩 3 张 → 结果分析。人生卡牌额外生成深层画像（lifeAnalysis）。

@Observable
@MainActor
final class CardGameEngine {
    enum Phase: String, Codable { case intro, select, draw, decision, trade, result }

    let config: CardGameConfig
    private let store: UserDefaults
    var phase: Phase = .intro
    /// 选牌顺序即持有顺序
    var selected: [String] = []
    var held: [String] = []
    var accepted: [(round: Int, scenario: GameScenario, severity: Int)] = []
    var traded: [(round: Int, scenario: GameScenario, ids: [String], cannotAccept: String, abandon: String)] = []
    var round = 0
    var pressure = 1
    var acceptStreak = 0
    var seenTitles: Set<String> = []
    var current: GameScenario?
    var tradePick: [String] = []
    var reasonCannotAccept = ""
    var reasonAbandon = ""

    init(kind: CardGameKind, store: UserDefaults = .standard) {
        config = CardGameData.config(kind)
        self.store = store
        restoreProgress()
    }

    func card(_ id: String) -> GameCard { config.cards.first { $0.id == id }! }
    var heldCards: [GameCard] { held.map(card) }
    var severityMeta: (name: String, copy: String) { config.severityMeta[pressure - 1] }

    /// 顶部进度（原型 lifeGameProgress）
    func progress(extra: Double = 0) -> Double {
        switch phase {
        case .intro: return 0
        case .select: return max(0.04, Double(selected.count) * 0.02)
        case .result: return 1
        default:
            let released = Double(9 - held.count) / 6
            return min(0.96, 0.16 + released * 0.72 + Double(min(round, 8)) * 0.015 + extra)
        }
    }

    // MARK: 流程

    func start() {
        selected = []
        held = []
        accepted = []
        traded = []
        round = 0
        pressure = 1
        acceptStreak = 0
        seenTitles = []
        current = nil
        tradePick = []
        reasonCannotAccept = ""
        reasonAbandon = ""
        phase = .select
        saveProgress()
        // 打在真正开一局处：进介绍页不算，恢复存档进 result 也不会走到这里
        Analytics.shared.track(.cardGameStarted)
    }

    /// 选牌开关；满 9 张时返回提示
    func toggleSelect(_ id: String) -> String? {
        if let i = selected.firstIndex(of: id) {
            selected.remove(at: i)
        } else if selected.count < 9 {
            selected.append(id)
        } else {
            return "这一局只能带走 9 张底牌"
        }
        saveProgress()
        return nil
    }

    func confirmSelection() {
        guard selected.count == 9 else { return }
        held = selected
        round = 0
        pressure = 1
        acceptStreak = 0
        seenTitles = []
        phase = .draw
        saveProgress()
    }

    /// 抽牌候选（原型 stageOptions：优先压力邻近、未出现过的情境）
    var scenarioOptions: [GameScenario] {
        struct Candidate {
            let scenario: GameScenario
            let distance: Int
            let seen: Int
            let order: Int
        }
        let pool = config.scenarios(forTradeCount: traded.count)
        var candidates: [Candidate] = []
        for (index, scenario) in pool.enumerated() {
            candidates.append(Candidate(
                scenario: scenario,
                distance: abs(scenario.severity - pressure),
                seen: seenTitles.contains(scenario.title) ? 1 : 0,
                order: (index * 7 + round * 11) % 23))
        }
        candidates.sort {
            if $0.distance != $1.distance { return $0.distance < $1.distance }
            if $0.seen != $1.seen { return $0.seen < $1.seen }
            return $0.order < $1.order
        }
        return candidates.prefix(5).map(\.scenario)
    }

    func draw(_ scenario: GameScenario) {
        current = scenario
        seenTitles.insert(scenario.title)
        phase = .decision
        saveProgress()
    }

    var canTrade: Bool { held.count - 2 >= 3 }

    func accept() {
        guard let current else { return }
        accepted.append((round, current, pressure))
        acceptStreak += 1
        pressure = min(4, pressure + 1)
        finishRound()
    }

    func beginTrade() {
        tradePick = []
        reasonCannotAccept = ""
        reasonAbandon = ""
        phase = .trade
        saveProgress()
    }

    func toggleTrade(_ id: String) -> String? {
        if let i = tradePick.firstIndex(of: id) {
            tradePick.remove(at: i)
        } else if tradePick.count < 2 {
            tradePick.append(id)
        } else {
            return "这一轮需要交换 2 张底牌"
        }
        saveProgress()
        return nil
    }

    func confirmTrade() {
        guard tradePick.count == 2, let current else { return }
        traded.append((round, current, tradePick,
                       reasonCannotAccept.trimmingCharacters(in: .whitespacesAndNewlines),
                       reasonAbandon.trimmingCharacters(in: .whitespacesAndNewlines)))
        held.removeAll { tradePick.contains($0) }
        tradePick = []
        acceptStreak = 0
        pressure = max(1, pressure - 1)
        finishRound()
    }

    private func finishRound() {
        round += 1
        current = nil
        phase = held.count == 3 ? .result : .draw
        saveProgress()
        // 状态机唯一进入 result 的边，天然只走一次：
        // 结果页 onAppear / 存档恢复 / 云同步重试都会重复，不能在那些地方打
        if phase == .result {
            Analytics.shared.track(.cardGameCompleted(roundCount: round))
        }
    }

    func returnToDraw() {
        current = nil
        tradePick = []
        reasonCannotAccept = ""
        reasonAbandon = ""
        phase = .draw
        saveProgress()
    }

    func cancelTrade() {
        tradePick = []
        phase = .decision
        saveProgress()
    }

    /// life 三段轮次信息（其余游戏返回轮次文案）
    var stageMeta: (age: String, name: String) {
        guard config.kind == .life else {
            return ("第 \(round + 1) 轮", config.title)
        }
        return CardGameData.lifeRoundMeta[min(traded.count, CardGameData.lifeRoundMeta.count - 1)]
    }

    // MARK: 结果保存

    /// 先把结果写入本地画像。云端只走 save_card_game，避免与 save_dimension
    /// 竞争覆盖同一维度；结果快照会保留到云端成功，失败时可重试。
    func saveResultLocally(home: HomeModel) -> [String] {
        let cards = heldCards
        let tags = cards.map(\.name)
        if config.kind == .life {
            let signature = cards.map { HomeModel.LifeSignatureCard(glyph: $0.glyph, name: $0.name) }
            if let data = try? JSONEncoder().encode(signature) {
                UserDefaults.standard.set(data, forKey: HomeModel.lifeSignatureKey)
            }
            home.loadLifeSignature()
        } else if let key = config.kind.targetDimension {
            home.saveDimension(key, keywords: tags, using: nil)
        }
        CardGameLocalRecord.markDone(config.kind, store: store)
        saveProgress()
        return tags
    }

    /// 整局结果上云：kind + 最终 3 张底牌 + 轮次 + 接受/交换记录。
    /// 错误抛给界面展示；成功后才清除可重试快照。
    func uploadResult(using supabase: SupabaseService) async throws {
        let cards = heldCards
        let kind = config.kind.rawValue
        let rounds = round
        let finalCards = cards.map {
            CardGameCardPayload(id: $0.id, name: $0.name, glyph: $0.glyph, group: $0.group)
        }
        let acceptedEvents = accepted.map {
            CardGameAcceptedEvent(round: $0.round, scenario: $0.scenario.title, severity: $0.severity)
        }
        let tradedEvents = traded.map { entry in
            CardGameTradedEvent(
                round: entry.round,
                scenario: entry.scenario.title,
                ids: entry.ids,
                reasons: [entry.cannotAccept, entry.abandon].filter { !$0.isEmpty })
        }
        _ = try await supabase.saveCardGameRemote(
            kind: kind,
            finalCards: finalCards,
            rounds: rounds,
            accepted: acceptedEvents,
            traded: tradedEvents)
        CardGameLocalRecord.clearProgress(config.kind, store: store)
    }

    // MARK: 局内快照

    private struct AcceptedSnapshot: Codable {
        let round: Int
        let title: String
        let severity: Int
    }

    private struct TradedSnapshot: Codable {
        let round: Int
        let title: String
        let ids: [String]
        let cannotAccept: String
        let abandon: String
    }

    private struct ProgressSnapshot: Codable {
        let version: Int
        let kind: String
        let phase: Phase
        let selected: [String]
        let held: [String]
        let accepted: [AcceptedSnapshot]
        let traded: [TradedSnapshot]
        let round: Int
        let pressure: Int
        let acceptStreak: Int
        let seenTitles: [String]
        let currentTitle: String?
        let tradePick: [String]
        let reasonCannotAccept: String
        let reasonAbandon: String
    }

    func saveProgress() {
        guard phase != .intro else {
            CardGameLocalRecord.clearProgress(config.kind, store: store)
            return
        }
        let snapshot = ProgressSnapshot(
            version: 1,
            kind: config.kind.rawValue,
            phase: phase,
            selected: selected,
            held: held,
            accepted: accepted.map {
                AcceptedSnapshot(round: $0.round, title: $0.scenario.title, severity: $0.severity)
            },
            traded: traded.map {
                TradedSnapshot(
                    round: $0.round,
                    title: $0.scenario.title,
                    ids: $0.ids,
                    cannotAccept: $0.cannotAccept,
                    abandon: $0.abandon)
            },
            round: round,
            pressure: pressure,
            acceptStreak: acceptStreak,
            seenTitles: Array(seenTitles),
            currentTitle: current?.title,
            tradePick: tradePick,
            reasonCannotAccept: reasonCannotAccept,
            reasonAbandon: reasonAbandon)
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        CardGameLocalRecord.saveProgress(data, for: config.kind, store: store)
    }

    private func restoreProgress() {
        guard let data = CardGameLocalRecord.progressData(config.kind, store: store) else {
            return
        }
        guard let snapshot = try? JSONDecoder().decode(ProgressSnapshot.self, from: data),
              snapshot.version == 1,
              snapshot.kind == config.kind.rawValue else {
            CardGameLocalRecord.clearProgress(config.kind, store: store)
            return
        }
        let validCardIDs = Set(config.cards.map(\.id))
        let allScenarios = config.scenarioRounds.flatMap { $0 }
        let scenarioByTitle = Dictionary(uniqueKeysWithValues: allScenarios.map { ($0.title, $0) })
        let tradedIDs = snapshot.traded.flatMap(\.ids)
        let requiresCurrent = snapshot.phase == .decision || snapshot.phase == .trade
        guard Set(snapshot.selected).count == snapshot.selected.count,
              Set(snapshot.held).count == snapshot.held.count,
              Set(snapshot.tradePick).count == snapshot.tradePick.count,
              Set(snapshot.selected).isSubset(of: validCardIDs),
              Set(snapshot.held).isSubset(of: validCardIDs),
              Set(snapshot.tradePick).isSubset(of: Set(snapshot.held)),
              snapshot.selected.count <= 9,
              snapshot.held.count <= 9,
              (1...4).contains(snapshot.pressure),
              snapshot.round >= 0,
              snapshot.acceptStreak >= 0,
              snapshot.phase != .result || snapshot.held.count == 3,
              snapshot.phase == .select || snapshot.selected.count == 9,
              snapshot.phase == .select || snapshot.held.count >= 3,
              snapshot.phase == .select || Set(snapshot.held).isSubset(of: Set(snapshot.selected)),
              snapshot.phase == .select || snapshot.held.count == 9 - snapshot.traded.count * 2,
              Set(tradedIDs).count == tradedIDs.count,
              Set(tradedIDs).isDisjoint(with: Set(snapshot.held)),
              snapshot.round == snapshot.accepted.count + snapshot.traded.count,
              !requiresCurrent || snapshot.currentTitle != nil,
              snapshot.phase != .trade || snapshot.tradePick.count <= 2,
              let restoredAccepted = restoreAccepted(snapshot.accepted, scenarios: scenarioByTitle),
              let restoredTraded = restoreTraded(snapshot.traded, scenarios: scenarioByTitle),
              snapshot.currentTitle == nil || scenarioByTitle[snapshot.currentTitle!] != nil else {
            CardGameLocalRecord.clearProgress(config.kind, store: store)
            return
        }
        phase = snapshot.phase
        selected = snapshot.selected
        held = snapshot.held
        accepted = restoredAccepted
        traded = restoredTraded
        round = snapshot.round
        pressure = snapshot.pressure
        acceptStreak = snapshot.acceptStreak
        seenTitles = Set(snapshot.seenTitles.filter { scenarioByTitle[$0] != nil })
        current = snapshot.currentTitle.flatMap { scenarioByTitle[$0] }
        tradePick = snapshot.tradePick
        reasonCannotAccept = snapshot.reasonCannotAccept
        reasonAbandon = snapshot.reasonAbandon
    }

    private func restoreAccepted(
        _ snapshots: [AcceptedSnapshot],
        scenarios: [String: GameScenario]
    ) -> [(round: Int, scenario: GameScenario, severity: Int)]? {
        var result: [(Int, GameScenario, Int)] = []
        for entry in snapshots {
            guard entry.round >= 0,
                  let scenario = scenarios[entry.title],
                  (1...4).contains(entry.severity) else { return nil }
            result.append((entry.round, scenario, entry.severity))
        }
        return result
    }

    private func restoreTraded(
        _ snapshots: [TradedSnapshot],
        scenarios: [String: GameScenario]
    ) -> [(round: Int, scenario: GameScenario, ids: [String], cannotAccept: String, abandon: String)]? {
        var result: [(Int, GameScenario, [String], String, String)] = []
        let validCardIDs = Set(config.cards.map(\.id))
        for entry in snapshots {
            guard entry.round >= 0,
                  let scenario = scenarios[entry.title],
                  entry.ids.count == 2,
                  Set(entry.ids).count == 2,
                  Set(entry.ids).isSubset(of: validCardIDs) else { return nil }
            result.append((entry.round, scenario, entry.ids, entry.cannotAccept, entry.abandon))
        }
        return result
    }

    // MARK: 结果分析

    /// 通用：留牌最多的分组
    var topGroup: String {
        var counts: [String: Int] = [:]
        for c in heldCards { counts[c.group, default: 0] += 1 }
        return counts.max { $0.value != $1.value ? $0.value < $1.value : $0.key > $1.key }?.key ?? ""
    }

    var groupNarrative: String {
        config.groupCopy[topGroup] ?? ""
    }

    // MARK: 人生卡牌深层分析（原型 lifeAnalysis 全量移植）

    struct LifeAnalysis {
        var held: [GameCard]
        var title: String
        var groupCopy: String
        var truth: String
        var tension: String
        var blindspot: String
        var reflection: String
        var spectrum: [(left: String, right: String, value: Int)]
        var voiceQuotes: [(label: String, text: String)]
        var reasonInsight: String
        var hiddenTraits: [(label: String, value: String)]
        var acceptedCount: Int
        var tradedCount: Int
    }

    func lifeAnalysis() -> LifeAnalysis {
        let initial = selected.map(card)
        let heldCards = self.heldCards
        var initialCounts: [String: Int] = [:], heldCounts: [String: Int] = [:]
        for c in initial { initialCounts[c.group, default: 0] += 1 }
        for c in heldCards { heldCounts[c.group, default: 0] += 1 }

        let allGroups = ["关系", "内在力量", "能力行动", "价值原则", "现实支点", "外部认可"]
        let topGroup = allGroups
            .map { ($0, (initialCounts[$0] ?? 0) + (heldCounts[$0] ?? 0) * 2) }
            .max { $0.1 < $1.1 }?.0 ?? "内在力量"

        let groupCopy = config.groupCopy[topGroup] ?? ""
        let noun = ["关系": "关系守护者", "内在力量": "内驱守望者", "能力行动": "行动建构者",
                    "价值原则": "原则坚持者", "现实支点": "现实锚定者", "外部认可": "光芒追寻者"]
        let mode = traded.count > accepted.count ? "掌舵型" : traded.count < accepted.count ? "接纳型" : "平衡型"

        let rejected = traded.map(\.scenario.theme)
        let sacrificed = traded.flatMap(\.ids).map(card)
        let firstTrade = sacrificed.map(\.name)
        let acceptedNames = accepted.map(\.scenario.title)

        // 亲口理由分析
        let reasonEntries = traded.filter { !$0.cannotAccept.isEmpty || !$0.abandon.isEmpty }
        let reasonText = reasonEntries.flatMap { [$0.cannotAccept, $0.abandon] }.filter { !$0.isEmpty }.joined(separator: " ")
        var voiceQuotes: [(String, String)] = []
        for entry in reasonEntries {
            if !entry.cannotAccept.isEmpty { voiceQuotes.append(("不能接受“\(entry.scenario.title)”", entry.cannotAccept)) }
            if !entry.abandon.isEmpty { voiceQuotes.append(("愿意放弃底牌", entry.abandon)) }
        }
        voiceQuotes = Array(voiceQuotes.prefix(4))

        func containsAny(_ words: [String]) -> Bool { words.contains(where: reasonText.contains) }
        var reasonInsight = ""
        if !reasonText.isEmpty {
            if containsAny(["家人", "父母", "孩子", "伴侣", "爱人", "关系", "信任", "孤独", "离开"]) {
                reasonInsight = "你亲口提到的重要他人和关系责任，说明真正触发你的不只是事件本身，而是“我是否保护好了这段关系”。"
            } else if containsAny(["健康", "生病", "钱", "收入", "稳定", "安全", "生活", "房子"]) {
                reasonInsight = "你给出的理由不断回到健康、稳定或生活基础，说明你最难承受的是人生底线被击穿，而不只是暂时的不顺。"
            } else if containsAny(["失败", "认可", "证明", "价值", "丢脸", "否定", "不够好"]) {
                reasonInsight = "你的理由触及了失败、认可或自我价值，说明这件事之所以不能接受，是因为它可能动摇“我是否足够好”的判断。"
            } else if containsAny(["控制", "失控", "确定", "害怕", "担心", "无法", "不能"]) {
                reasonInsight = "你的表达里带着对失控和不确定的警觉。你想消除的可能不只是坏结果，更是等待结果时无法掌舵的感觉。"
            } else if containsAny(["责任", "应该", "照顾", "拖累", "承担", "保护"]) {
                reasonInsight = "你习惯从责任出发解释选择。对你而言，真正难受的可能不是损失，而是觉得自己没有承担好本应承担的部分。"
            } else {
                reasonInsight = "你的理由显示，你不是在机械地交换卡牌，而是在区分“以后还能重新获得的”和“一旦失去就无法补回的”。"
            }
        }

        func clamp(_ n: Double) -> Int { max(4, min(96, Int(n.rounded()))) }
        let acceptanceScore = clamp(Double(accepted.count) / Double(max(round, 1)) * 100)
        let relationScore = clamp((Double(initialCounts["关系"] ?? 0) / 6 * 0.45
            + Double(heldCounts["关系"] ?? 0) / Double(max(heldCards.count, 1)) * 0.55) * 100)
        let initialPrinciple = initialCounts["价值原则"] ?? 0
        let principleScore = initialPrinciple > 0
            ? clamp((Double(initialPrinciple) / 3 * 0.4 + Double(heldCounts["价值原则"] ?? 0) / Double(initialPrinciple) * 0.6) * 100)
            : 8
        let spectrum: [(String, String, Int)] = [
            ("主动掌控", "接纳现实", acceptanceScore),
            ("自我驱动", "关系锚定", relationScore),
            ("现实调整", "原则坚持", principleScore),
        ]

        let truthByGroup: [String: String] = [
            "关系": mode == "掌舵型"
                ? "你真正害怕的可能不是困难本身，而是重要关系在困难里失去确定性。为了把关系拉回安全的位置，你愿意先消耗自己的其他资源。"
                : "你比自己想象中更能承受生活的不完美，前提是重要的人和彼此的信任仍然留在身边。",
            "内在力量": mode == "掌舵型"
                ? "你对失控很敏感，但你并不等待别人来救场。你的第一反应，是动用自己已有的力量，把人生重新拉回手里。"
                : "你相信真正带不走的东西在自己身上。环境可以变坏，但只要内在力量还在，你就不认为自己彻底失去了选择。",
            "能力行动": "你想保护的不只是“优秀”，而是解决问题的资格。对你而言，能力意味着即使生活失序，自己仍有重新开始的路径。",
            "价值原则": "你可以失去一些外在条件，却很难接受自己变成一个不认同的人。守住原则，对你来说是在守住“我还是我”。",
            "现实支点": "你追求的未必是保守，而是不能跌出生活的底线。只有身体和现实秩序稳住，你才允许自己继续谈理想。",
            "外部认可": "你在意的可能不只是光环。被看见对你意味着机会仍在、价值仍被确认，也意味着自己没有从世界中消失。",
        ]
        let truth = (truthByGroup[topGroup] ?? "") + (reasonInsight.isEmpty ? "" : " \(reasonInsight)")

        let sacrificeText = firstTrade.prefix(3).joined(separator: "、")
        var tension: String
        if let firstEvent = traded.first {
            tension = "你曾主动把“\(sacrificeText)”带进人生，说明它们并非不重要；但当“\(firstEvent.scenario.title)”出现时，你又愿意先放下它们。你的价值排序不是固定清单，而会在威胁出现时迅速重排。"
            if !firstEvent.abandon.isEmpty {
                tension += " 你给出的理由是：“\(firstEvent.abandon)”——这让交换不再只是轻重排序，也暴露了你判断“什么还能重来”的标准。"
            }
        } else {
            tension = "你没有用任何底牌换取确定性。这里既有接纳现实的力量，也可能藏着另一面：你习惯先承受，而不是确认自己是否还有改变局面的权利。"
        }

        let blindspot: String
        if accepted.count >= 4 {
            blindspot = "你可能会把“我能承受”误认成“我应该承受”。真正的接纳并不等于独自消化，求助和设立边界也可以是成熟。"
        } else if traded.count >= 4 {
            blindspot = "你可能高估了消除风险的必要性。为了让坏事不发生而持续支付代价，有时会让长期资源先被耗尽。"
        } else if topGroup == "关系" {
            blindspot = "关系受到威胁时，你可能太快拿自己的能力、需要或边界去交换稳定。关系被保住，不一定等于你也被照顾。"
        } else if topGroup == "价值原则" {
            blindspot = "原则让你保持完整，也可能让灰度情境显得非黑即白。有些调整不是背叛自己，而是为价值寻找新的实现方式。"
        } else if topGroup == "现实支点" {
            blindspot = "对底线的敏感让你擅长识别风险，但也可能过早收缩探索空间，把“还没发生”提前活成“不能发生”。"
        } else {
            blindspot = "你容易把能够解决问题，当成必须负责解决问题。能力很强的人，也可能因此忽略自己的疲惫和被支持的需要。"
        }

        let reflection: String
        if let firstEvent = traded.first {
            reflection = "如果现实中真的遭遇“\(firstEvent.scenario.title)”，你愿意失去“\(firstTrade.prefix(2).joined(separator: "、"))”来换回确定吗？还是当时只是太害怕失控？"
        } else {
            reflection = "你接受的“\(acceptedNames.first ?? "不确定")”里，有没有一件并非真正接纳，而是你当时不相信自己拥有别的选择？"
        }

        let modeCopy = mode == "掌舵型" ? "愿意付出已有资源，换回对人生的控制感"
            : mode == "接纳型" ? "更愿接受无法控制的现实，保护已经拥有的部分"
            : "在接受现实与主动改变之间寻找平衡"

        var seenRejected = Set<String>()
        let uniqueRejected = rejected.filter { seenRejected.insert($0).inserted }
        let hiddenTraits: [(String, String)] = [
            ("我最看重", heldCards.prefix(4).map(\.name).joined(separator: "、")),
            ("我的安全感来自", groupCopy),
            ("我的取舍方式", modeCopy),
            ("我最不愿承受", uniqueRejected.isEmpty ? "没有明确拒绝的情境" : uniqueRejected.prefix(3).joined(separator: "、")),
            ("我能够放下", firstTrade.isEmpty ? "这一局没有典当任何底牌" : firstTrade.prefix(4).joined(separator: "、")),
            ("我面对不可控事件时", "接受了 \(accepted.count) 次，主动交换了 \(traded.count) 次"),
            ("我的内在真相", truth),
            ("我的内在张力", tension),
            ("我可能忽略", blindspot),
            ("我做出选择时真正担心", reasonInsight.isEmpty ? "这次没有写下原因，暂时只依据取舍行为推断" : reasonInsight),
        ]

        return LifeAnalysis(
            held: heldCards,
            title: "\(mode)\(noun[topGroup] ?? "")",
            groupCopy: groupCopy,
            truth: truth, tension: tension, blindspot: blindspot, reflection: reflection,
            spectrum: spectrum, voiceQuotes: voiceQuotes, reasonInsight: reasonInsight,
            hiddenTraits: hiddenTraits,
            acceptedCount: accepted.count, tradedCount: traded.count)
    }
}

// MARK: - 本地完成标记（各 kind 是否已完成一局；云端回读/结算共用）

enum CardGameLocalRecord {
    private static func doneKey(_ kind: CardGameKind) -> String {
        "kaleido_cardgame_done_\(kind.rawValue)"
    }

    private static func progressKey(_ kind: CardGameKind) -> String {
        "kaleido_cardgame_progress_\(kind.rawValue)_v1"
    }

    static func isDone(_ kind: CardGameKind, store: UserDefaults = .standard) -> Bool {
        store.bool(forKey: doneKey(kind))
    }

    static func markDone(_ kind: CardGameKind, store: UserDefaults = .standard) {
        store.set(true, forKey: doneKey(kind))
    }

    static func saveProgress(_ data: Data, for kind: CardGameKind, store: UserDefaults = .standard) {
        store.set(data, forKey: progressKey(kind))
    }

    static func progressData(_ kind: CardGameKind, store: UserDefaults = .standard) -> Data? {
        store.data(forKey: progressKey(kind))
    }

    static func clearProgress(_ kind: CardGameKind, store: UserDefaults = .standard) {
        store.removeObject(forKey: progressKey(kind))
    }

    static func hasProgress(_ kind: CardGameKind, store: UserDefaults = .standard) -> Bool {
        progressData(kind, store: store) != nil
    }

    static var doneKinds: Set<CardGameKind> {
        Set(CardGameKind.allCases.filter { isDone($0) })
    }

    static var progressKinds: Set<CardGameKind> {
        Set(CardGameKind.allCases.filter { hasProgress($0) })
    }
}
