import Foundation

// MARK: - 三张牌象征分析

struct TarotCard: Identifiable, Hashable {
    let id: String
    let name: String
    let numeral: String
    let symbol: String
    let light: String
    let shadow: String
    let action: String
}

struct DrawnTarotCard: Identifiable, Hashable {
    let card: TarotCard
    let reversed: Bool

    var id: String { card.id }
    var orientation: String { reversed ? "逆位" : "正位" }
    var meaning: String { reversed ? card.shadow : card.light }
}

struct TarotReading {
    let question: String
    let cards: [DrawnTarotCard]
    let answer: String
}

enum TarotPhase {
    case none, offer, drawing, confirm, result, locked
}

enum TarotShareChannel: String, CaseIterable, Identifiable {
    case wechat, moments, xiaohongshu, weibo, other

    var id: String { rawValue }
    var label: String {
        switch self {
        case .wechat: "微信"
        case .moments: "朋友圈"
        case .xiaohongshu: "小红书"
        case .weibo: "微博"
        case .other: "更多渠道"
        }
    }
    var note: String {
        switch self {
        case .wechat: "发给好友"
        case .moments: "发布海报"
        case .xiaohongshu: "发布笔记"
        case .weibo: "分享动态"
        case .other: "打开系统分享"
        }
    }
}

enum TarotPurchaseProduct {
    case subscription, credits15, credits100
}

struct TarotQuota: Codable {
    static let dailyLimit = 3

    var date: String
    var used: Int
    var shareRewardCount: Int
    var purchasedCredits: Int
    var subscriptionActive: Bool

    var remaining: Int {
        if subscriptionActive { return .max }
        return max(0, Self.dailyLimit + shareRewardCount - used) + purchasedCredits
    }

    var remainingLabel: String {
        subscriptionActive ? "包月不限次" : "\(remaining) 次"
    }

    static func load() -> TarotQuota {
        let key = "possibility.tarot.quota.v1"
        if let data = UserDefaults.standard.data(forKey: key),
           var saved = try? JSONDecoder().decode(TarotQuota.self, from: data),
           saved.date == todayKey() {
            saved.used = max(0, saved.used)
            saved.shareRewardCount = max(0, saved.shareRewardCount)
            saved.purchasedCredits = max(0, saved.purchasedCredits)
            return saved
        }
        return TarotQuota(date: todayKey(), used: 0, shareRewardCount: 0,
                          purchasedCredits: 0, subscriptionActive: false)
    }

    mutating func consume() -> Bool {
        guard remaining > 0 else { return false }
        if subscriptionActive { return true }
        if used < Self.dailyLimit + shareRewardCount {
            used += 1
        } else {
            purchasedCredits = max(0, purchasedCredits - 1)
        }
        persist()
        return true
    }

    mutating func rewardShare() {
        // 分享奖励没有每日上限，每次完成系统分享都增加 1 次。
        shareRewardCount += 1
        persist()
    }

    mutating func purchase(_ product: TarotPurchaseProduct) {
        switch product {
        case .subscription: subscriptionActive = true
        case .credits15: purchasedCredits += 15
        case .credits100: purchasedCredits += 100
        }
        persist()
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(self) {
            UserDefaults.standard.set(data, forKey: "possibility.tarot.quota.v1")
        }
    }

    private static func todayKey() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}

enum TarotEngine {
    static let positions = ["现状", "核心阻力", "行动走向"]

    static func isUnclearQuestion(_ question: String) -> Bool {
        let punctuation = CharacterSet(charactersIn: "？?。！!，,")
        let clean = question.trimmingCharacters(in: .whitespacesAndNewlines)
            .components(separatedBy: punctuation).joined()
        if clean.count < 4 { return true }
        return ["怎么办", "怎么选", "帮我看看", "我该怎么办", "给个建议", "你觉得呢", "看看未来"].contains(clean)
    }

    static func candidates(count: Int = 12) -> [DrawnTarotCard] {
        Array(deck.shuffled().prefix(count)).map {
            DrawnTarotCard(card: $0, reversed: Bool.random())
        }
    }

    static func reading(question: String, cards: [DrawnTarotCard]) -> TarotReading {
        guard cards.count == 3 else {
            return TarotReading(question: question, cards: cards, answer: "需要抽取三张牌后才能开始分析。")
        }
        let present = cards[0], friction = cards[1], direction = cards[2]
        let lens = questionLens(question)
        let tone = direction.reversed ? "尚未稳定，需要先处理阻力" : "存在向前展开的空间"
        let answer = """
        先说结论：\(tone)，但这不是对未来的保证。\(lens.focus)。

        三张牌把问题放在三个位置上：「\(present.card.name)\(present.reversed ? "·逆位" : "")」显示当下更接近\(present.meaning)；「\(friction.card.name)\(friction.reversed ? "·逆位" : "")」提醒核心卡点可能是\(friction.meaning)；「\(direction.card.name)\(direction.reversed ? "·逆位" : "")」把行动走向指向\(direction.meaning)。

        把牌意落回现实：\(direction.card.action)，并\(lens.experiment)。等到这条证据出现，再判断“会不会”会更可靠。
        """
        return TarotReading(question: question, cards: cards, answer: answer)
    }

    private static func questionLens(_ question: String) -> (focus: String, experiment: String) {
        if question.range(of: "创业|事业|工作|转行|升职|项目|生意", options: .regularExpression) != nil {
            return ("这件事更取决于资源、节奏和验证，而不是一张“必成或必败”的判决",
                    "先用真实客户、现金流或作品反馈验证最关键的商业假设")
        }
        if question.range(of: "感情|恋爱|复合|结婚|对方|关系", options: .regularExpression) != nil {
            return ("关系的走向取决于双方真实行动，牌面只能帮你看见自己的期待与盲区",
                    "观察一次具体沟通后的回应、边界和持续行动")
        }
        if question.range(of: "考试|考研|录取|上岸|申请|面试", options: .regularExpression) != nil {
            return ("结果仍由准备质量和外部标准共同决定，牌面提示的是当前策略",
                    "用一次模拟成绩或真实反馈检查最薄弱的一环")
        }
        return ("未来没有被牌面写死，这组象征更适合用来照见你的期待、风险和下一步",
                "选择一个七天内可完成、结果可观察的小行动")
    }

    private static let deck: [TarotCard] = [
        .init(id: "fool", name: "愚者", numeral: "0", symbol: "✦", light: "新的尝试与开放性", shadow: "准备不足、只凭冲动", action: "先做一个可撤回的小实验"),
        .init(id: "magician", name: "魔术师", numeral: "I", symbol: "∞", light: "资源正在聚拢", shadow: "高估掌控力或包装", action: "列出手上真正可调用的三项资源"),
        .init(id: "priestess", name: "女祭司", numeral: "II", symbol: "☾", light: "安静观察与直觉", shadow: "关键信息仍藏在水面下", action: "先补一条最影响判断的事实"),
        .init(id: "empress", name: "皇后", numeral: "III", symbol: "❋", light: "滋养、增长与创造", shadow: "投入过多而缺少边界", action: "给成长设一个明确的资源上限"),
        .init(id: "emperor", name: "皇帝", numeral: "IV", symbol: "◇", light: "结构、秩序与执行", shadow: "过度控制或路径僵化", action: "把目标拆成可检查的里程碑"),
        .init(id: "hierophant", name: "教皇", numeral: "V", symbol: "✥", light: "经验、规则与可信指引", shadow: "被惯例和他人答案束缚", action: "找一位走过此路的人核对现实"),
        .init(id: "lovers", name: "恋人", numeral: "VI", symbol: "♡", light: "价值一致后的选择", shadow: "想同时保住所有可能", action: "先写下你最不愿交换掉的价值"),
        .init(id: "chariot", name: "战车", numeral: "VII", symbol: "➹", light: "方向明确、主动推进", shadow: "速度盖过了风险检查", action: "推进前设一个停止条件"),
        .init(id: "strength", name: "力量", numeral: "VIII", symbol: "♢", light: "稳定的韧性与耐心", shadow: "用硬撑代替真实调整", action: "把最消耗你的环节先减半"),
        .init(id: "hermit", name: "隐者", numeral: "IX", symbol: "⌁", light: "独立思考与内在校准", shadow: "信息闭环、越想越窄", action: "独处判断后再找外部证据复核"),
        .init(id: "wheel", name: "命运之轮", numeral: "X", symbol: "◌", light: "窗口变化、出现转机", shadow: "把偶然当成必然", action: "准备好机会出现时的触发动作"),
        .init(id: "justice", name: "正义", numeral: "XI", symbol: "⚖", light: "权衡、因果与边界", shadow: "只看对错，忽略真实代价", action: "用同一组标准比较收益与代价"),
        .init(id: "hanged", name: "倒吊人", numeral: "XII", symbol: "⌛", light: "换视角、暂缓有价值", shadow: "停滞被包装成等待", action: "为等待设置截止日与观察指标"),
        .init(id: "death", name: "死神", numeral: "XIII", symbol: "✧", light: "旧阶段结束后的更新", shadow: "抗拒必要的告别", action: "明确停止什么，才有空间开始什么"),
        .init(id: "temperance", name: "节制", numeral: "XIV", symbol: "≈", light: "整合、调配与渐进", shadow: "妥协过多导致方向模糊", action: "设计一个两边都能验证的过渡方案"),
        .init(id: "devil", name: "恶魔", numeral: "XV", symbol: "△", light: "看见欲望与现实牵引", shadow: "被恐惧、利益或执念绑住", action: "指出你最难承认的那项代价"),
        .init(id: "tower", name: "高塔", numeral: "XVI", symbol: "ϟ", light: "打破失真的旧假设", shadow: "突发变化与脆弱基础", action: "先检查最可能让计划失效的前提"),
        .init(id: "star", name: "星星", numeral: "XVII", symbol: "☆", light: "希望、方向感与恢复", shadow: "愿景尚未落到现实", action: "把愿景变成未来七天的一次行动"),
        .init(id: "moon", name: "月亮", numeral: "XVIII", symbol: "☽", light: "感受敏锐、梦境与想象", shadow: "焦虑让信号变得失真", action: "把事实、猜测和担心分成三列"),
        .init(id: "sun", name: "太阳", numeral: "XIX", symbol: "☼", light: "清晰、活力与可见成果", shadow: "过度乐观、忽略维护成本", action: "趁动力充足完成一个可展示成果"),
        .init(id: "judgement", name: "审判", numeral: "XX", symbol: "⌃", light: "复盘后的召唤与决定", shadow: "反复等待外界替你确认", action: "用过去的证据为自己做一次判断"),
        .init(id: "world", name: "世界", numeral: "XXI", symbol: "◎", light: "整合、完成与进入新周期", shadow: "执着完美收尾才肯开始", action: "定义何时算完成，然后进入下一步"),
    ]
}
