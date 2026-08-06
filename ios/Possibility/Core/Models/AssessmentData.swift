import Foundation

// MARK: - 测评数据（迁移自原型 HOLLAND_ITEMS / HOLLAND_META / DEMO_ASSESSMENTS / BIG_FIVE_FACETS）

enum AssessmentKind: String, CaseIterable, Identifiable, Sendable {
    case holland, bigfive, strength, love, family, social
    var id: String { rawValue }

    /// 结果写入的画像维度（bigfive → 人格底色单独处理）
    var targetDimension: DimensionKey? {
        switch self {
        case .holland: return .like
        case .strength: return .skill
        case .love: return .love
        case .family: return .family
        case .social: return .social
        case .bigfive: return nil
        }
    }
}

struct AssessmentDim: Sendable {
    let key: String
    let name: String
    let label: String
    let color: UInt32
    let desc: String
}

struct AssessmentItem: Sendable {
    let dim: String
    var facet: String? = nil
    let text: String
    var reversed: Bool = false
}

struct AssessmentConfig: Sendable {
    let kind: AssessmentKind
    let title: String
    let sub: String
    let kicker: String
    let introTitle: String
    let intro: String
    let notices: [String]
    let resultTitle: String
    let resultSub: String
    let saveLabel: String
    /// 有序维度表
    let dims: [AssessmentDim]
    let items: [AssessmentItem]
    /// 5 点量表标签
    let likert: [String]

    func dim(_ key: String) -> AssessmentDim { dims.first { $0.key == key }! }
}

enum AssessmentData {

    static func config(_ kind: AssessmentKind) -> AssessmentConfig {
        switch kind {
        case .holland: return holland
        case .bigfive: return bigfive
        case .strength: return strength
        case .love: return love
        case .family: return family
        case .social: return social
        }
    }

    // MARK: 霍兰德（O*NET Mini-IP，30 题，RIASEC）

    static let hollandMax = 20  // 每维 5 题 × 最高 4 分

    static let holland = AssessmentConfig(
        kind: .holland,
        title: "霍兰德兴趣测评", sub: "兴趣不是能力，也不是职业判决", kicker: "O*NET MINI INTEREST PROFILER",
        introTitle: "哪些活动，\n会让你自然地靠近？",
        intro: "接下来会出现30种活动。请只回答“喜欢不喜欢”，不要考虑自己现在会不会、薪资高不高或别人怎么看。",
        notices: ["这是霍兰德RIASEC模型的官方移动短版", "结果描述兴趣，不代表能力、资格或命定职业", "中文内容为产品验证中的翻译版本", "答案会保存在当前设备，可随时退出继续"],
        resultTitle: "兴趣画像", resultSub: "正式量表来源 · O*NET Mini-IP", saveLabel: "将这组兴趣信号保存到我的画像",
        dims: [
            AssessmentDim(key: "R", name: "实际型", label: "动手实践", color: 0x7DB5A0, desc: "你容易被可以操作、制作和解决现场问题的活动吸引。"),
            AssessmentDim(key: "I", name: "研究型", label: "深度探索", color: 0x789EFF, desc: "你容易投入分析证据、追根究底和理解复杂问题的活动。"),
            AssessmentDim(key: "A", name: "艺术型", label: "创意表达", color: 0xD785C8, desc: "你更愿意在审美、想象和开放表达中形成自己的作品。"),
            AssessmentDim(key: "S", name: "社会型", label: "理解与帮助", color: 0xE99B78, desc: "你容易从支持、教学、沟通和帮助他人成长中获得意义。"),
            AssessmentDim(key: "E", name: "企业型", label: "影响推动", color: 0xD9B563, desc: "你对发起、谈判、组织资源和推动目标更容易产生兴趣。"),
            AssessmentDim(key: "C", name: "常规型", label: "秩序组织", color: 0x8F91B8, desc: "你更喜欢规则清楚、细节可靠和可以持续优化的工作方式。"),
        ],
        items: hollandRaw.map { AssessmentItem(dim: $0.0, text: $0.1) },
        likert: ["非常不喜欢", "不喜欢", "不确定", "喜欢", "非常喜欢"])

    private static let hollandRaw: [(String, String)] = [
        ("R", "制作厨房橱柜"), ("I", "研发一种新药"), ("A", "创作一本书或一部戏剧"), ("S", "帮助他人处理个人或情绪问题"), ("E", "管理大型公司中的一个部门"), ("C", "为大型计算机网络安装软件"),
        ("R", "修理家用电器"), ("I", "研究减少水污染的方法"), ("A", "作曲或编曲"), ("S", "为他人提供职业发展指导"), ("E", "创办自己的企业"), ("C", "使用计算器进行计算"),
        ("R", "组装电子零件"), ("I", "进行化学实验"), ("A", "为电影制作特效"), ("S", "提供康复治疗"), ("E", "谈判商业合同"), ("C", "整理货物收发记录"),
        ("R", "驾驶车辆向办公室和住户配送包裹"), ("I", "使用显微镜检查血液样本"), ("A", "绘制舞台布景"), ("S", "在非营利组织从事志愿工作"), ("E", "推广一个新的服装系列"), ("C", "使用手持设备盘点物资"),
        ("R", "在零件发货前检查其质量"), ("I", "研发更准确预测天气的方法"), ("A", "为电影或电视节目编写剧本"), ("S", "教授高中课程"), ("E", "在百货商店销售商品"), ("C", "为一个组织分拣和分发邮件"),
    ]

    /// 双字母兴趣组合叙事（原型 hollandNarrative）
    static let hollandPairNarrative: [String: String] = [
        "RI": "你喜欢先弄清原理，再把想法变成可以工作的东西。",
        "RA": "你在材料、技术和表达之间寻找创造的实感。",
        "IA": "你容易在分析与想象之间建立新的解释。",
        "IS": "你希望理解复杂问题，也希望这些理解能真正帮助到人。",
        "AS": "表达和连接对你同样重要，你更愿意让创作抵达别人。",
        "AE": "你不只喜欢产生想法，也容易被传播和推动它们吸引。",
        "SE": "你更享受与人协作，并把共同目标向前推动。",
        "SC": "你愿意用稳定、可靠的方式支持人的需要。",
        "EC": "目标、资源和流程的组织容易激发你的投入感。",
        "IC": "你擅长被复杂信息吸引，并愿意把它整理成可靠结构。",
    ]

    // MARK: 大五人格（120 题 = 30 facet × 4 轮）

    struct Facet: Sendable {
        let d: String
        let f: String
        let name: String
        /// 4 条 (题面, 是否反向)
        let items: [(String, Bool)]
    }

    static let bigfive: AssessmentConfig = {
        let items: [AssessmentItem] = (0..<4).flatMap { round in
            bigFiveFacets.map { facet in
                AssessmentItem(dim: facet.d, facet: facet.f, text: facet.items[round].0, reversed: facet.items[round].1)
            }
        }
        return AssessmentConfig(
            kind: .bigfive,
            title: "大五人格", sub: "五个维度都是光谱", kicker: "PERSONALITY PROFILE",
            introTitle: "你通常如何\n感受、思考与行动？",
            intro: "请按照过去一年里大多数时候的真实状态回答，而不是理想中的自己。完成后会看到五个主要维度和三十个细分面向。",
            notices: ["完整版共120题，通常需要15–20分钟", "结果展示五维连续分数，不把你分成固定类型", "答案保存在当前设备，原始答案默认私密"],
            resultTitle: "人格底色", resultSub: "大五人格", saveLabel: "保存为我的人格底色",
            dims: [
                AssessmentDim(key: "O", name: "开放", label: "好奇开放", color: 0x8FA4FF, desc: "愿意接触新观点、想象与复杂体验"),
                AssessmentDim(key: "C", name: "尽责", label: "可靠有序", color: 0x6FD0B0, desc: "倾向规划、自律并把事情完成"),
                AssessmentDim(key: "E", name: "外向", label: "主动联结", color: 0xE7B86D, desc: "容易从互动、表达和行动中获得能量"),
                AssessmentDim(key: "A", name: "宜人", label: "体谅合作", color: 0xE58BBF, desc: "重视理解、信任与合作"),
                AssessmentDim(key: "N", name: "情绪敏感", label: "情绪敏锐", color: 0xA997DB, desc: "更容易觉察压力、担忧与情绪波动"),
            ],
            items: items,
            likert: ["非常不符合", "比较不符合", "不确定", "比较符合", "非常符合"])
    }()

    /// 大五低分端标签（原型 demoResultTags low 表）
    static let bigfiveLowLabels: [String: String] = [
        "O": "务实聚焦", "C": "灵活随性", "E": "安静蓄能", "A": "独立判断", "N": "情绪稳定",
    ]

    static func facetMeta(_ f: String) -> Facet? { bigFiveFacets.first { $0.f == f } }

    static let bigFiveFacets: [Facet] = [
        Facet(d: "N", f: "N1", name: "焦虑", items: [("我常为事情担心", false), ("我容易设想最坏的结果", false), ("许多事情会让我感到害怕", false), ("我很容易感到压力", false)]),
        Facet(d: "E", f: "E1", name: "友善", items: [("我很容易结交新朋友", false), ("和别人在一起时我通常很自在", false), ("我会避免与别人接触", true), ("我习惯和别人保持距离", true)]),
        Facet(d: "O", f: "O1", name: "想象力", items: [("我的想象力很丰富", false), ("我喜欢不受拘束地幻想", false), ("我喜欢做白日梦", false), ("我喜欢沉浸在自己的思绪中", false)]),
        Facet(d: "A", f: "A1", name: "信任", items: [("我通常愿意信任别人", false), ("我相信大多数人抱有善意", false), ("我愿意相信别人说的话", false), ("我很难信任别人", true)]),
        Facet(d: "C", f: "C1", name: "效能感", items: [("我能成功完成交给自己的任务", false), ("我通常能把自己做的事情做好", false), ("我能顺利处理大多数任务", false), ("我知道怎样把事情办成", false)]),
        Facet(d: "N", f: "N2", name: "易怒", items: [("我很容易生气", false), ("我很容易被惹恼", false), ("我有时会控制不住脾气", false), ("我通常不会轻易恼火", true)]),
        Facet(d: "E", f: "E2", name: "合群", items: [("我喜欢热闹的大型聚会", false), ("在聚会上我会和许多不同的人交谈", false), ("我更喜欢独处", true), ("我会避开拥挤的人群", true)]),
        Facet(d: "O", f: "O2", name: "艺术兴趣", items: [("我相信艺术很重要", false), ("我能看到别人可能忽略的美", false), ("我不喜欢诗歌", true), ("我不享受参观美术馆或展览", true)]),
        Facet(d: "A", f: "A2", name: "真诚", items: [("我会利用别人达到自己的目的", true), ("为了占优势，我可能会作弊", true), ("我会占别人的便宜", true), ("我会故意阻碍别人的计划", true)]),
        Facet(d: "C", f: "C2", name: "条理", items: [("我喜欢整理和收拾东西", false), ("我常忘记把东西放回原位", true), ("我的房间或工作区经常很乱", true), ("我经常把物品随手乱放", true)]),
        Facet(d: "N", f: "N3", name: "低落", items: [("我常感到情绪低落", false), ("我有时不喜欢自己", false), ("我经常提不起精神", false), ("我通常能自在地接纳自己", true)]),
        Facet(d: "E", f: "E3", name: "主导性", items: [("需要时我会主动负责", false), ("我会尝试带领别人", false), ("我倾向主动掌控事情的进展", false), ("我通常等别人先带头", true)]),
        Facet(d: "O", f: "O3", name: "情感丰富", items: [("我的情绪体验很强烈", false), ("我能感受到别人的情绪", false), ("我很少留意自己的情绪反应", true), ("我难以理解情绪反应强烈的人", true)]),
        Facet(d: "A", f: "A3", name: "利他", items: [("我关心别人的处境", false), ("我喜欢帮助别人", false), ("我对别人的感受漠不关心", true), ("我不愿意为别人花时间", true)]),
        Facet(d: "C", f: "C3", name: "责任感", items: [("我会遵守自己的承诺", false), ("我重视诚实地说出事实", false), ("我会随意破坏规则", true), ("我经常违背自己答应的事情", true)]),
        Facet(d: "N", f: "N4", name: "社交敏感", items: [("我觉得主动接近别人很困难", false), ("我害怕成为别人注意的焦点", false), ("只有和熟人在一起时我才真正放松", false), ("困难的社交场合通常不会困扰我", true)]),
        Facet(d: "E", f: "E4", name: "活跃度", items: [("我总让自己保持忙碌", false), ("我经常处于行动状态", false), ("空闲时间里我也会做很多事情", false), ("我喜欢放慢节奏、轻松度日", true)]),
        Facet(d: "O", f: "O4", name: "冒险性", items: [("比起固定惯例，我更喜欢变化", false), ("我更愿意坚持自己熟悉的事物", true), ("我不喜欢变化", true), ("我很依恋传统的做法", true)]),
        Facet(d: "A", f: "A4", name: "合作", items: [("我喜欢和别人激烈争斗", true), ("我会对别人大喊大叫", true), ("我会用言语羞辱别人", true), ("别人伤害我后，我会想办法报复", true)]),
        Facet(d: "C", f: "C4", name: "成就追求", items: [("我常愿意做得比要求更多", false), ("我工作时很努力", false), ("我很少为工作投入时间和精力", true), ("我往往只做到刚好过关", true)]),
        Facet(d: "N", f: "N5", name: "冲动", items: [("我有时会毫无节制地放纵自己", false), ("我很少过度放纵", true), ("我通常能抵抗诱惑", true), ("我能够控制自己的强烈欲望", true)]),
        Facet(d: "E", f: "E5", name: "寻求刺激", items: [("我喜欢刺激的体验", false), ("我会主动寻找冒险", false), ("我有时享受不计后果的感觉", false), ("我偶尔喜欢表现得疯狂而不受拘束", false)]),
        Facet(d: "O", f: "O5", name: "思辨", items: [("我喜欢阅读有挑战性的内容", false), ("我会避开哲学性的讨论", true), ("我较难理解抽象观念", true), ("我对理论讨论不感兴趣", true)]),
        Facet(d: "A", f: "A5", name: "谦逊", items: [("我认为自己比别人更优秀", true), ("我对自己的评价非常高", true), ("我常觉得自己高人一等", true), ("我会向别人夸耀自己的优点", true)]),
        Facet(d: "C", f: "C5", name: "自律", items: [("我通常会提前做好准备", false), ("我会执行自己制定的计划", false), ("我经常把时间浪费掉", true), ("我很难开始应该完成的任务", true)]),
        Facet(d: "N", f: "N6", name: "脆弱性", items: [("我很容易陷入慌乱", false), ("事情一多我就容易不知所措", false), ("我有时觉得自己应付不了问题", false), ("压力之下我通常能保持冷静", true)]),
        Facet(d: "E", f: "E6", name: "积极情绪", items: [("我经常流露出愉快的情绪", false), ("我生活中有许多快乐时刻", false), ("我热爱生活", false), ("我习惯看到事情积极的一面", false)]),
        Facet(d: "O", f: "O6", name: "观念开放", items: [("我倾向支持更开放的社会观念", false), ("我认为是非并不总有绝对答案", false), ("我更倾向维护传统保守的社会观念", true), ("我认为对违规行为通常应采取强硬惩罚", true)]),
        Facet(d: "A", f: "A6", name: "同理心", items: [("我会同情无家可归的人", false), ("我会为处境比自己艰难的人感到难过", false), ("我对别人的困难不感兴趣", true), ("我会刻意不去想处境困难的人", true)]),
        Facet(d: "C", f: "C6", name: "审慎", items: [("我常没想清楚就直接行动", true), ("我有时会做出草率决定", true), ("我容易仓促行事", true), ("我会不经思考就采取行动", true)]),
    ]

    // MARK: 优势证据探索（15 题）

    static let strength = AssessmentConfig(
        kind: .strength,
        title: "优势证据探索", sub: "不需要先知道答案，也不依赖关键词选择", kicker: "STRENGTH EVIDENCE · SITUATIONAL DEMO",
        introTitle: "先看你会怎么做，\n再反推你可能擅长什么。",
        intro: "这里不要求你先声明“我擅长什么”。请判断下面这些真实工作与生活情境有多像你，系统会从重复出现的行为证据中提炼优势信号。",
        notices: ["15题情境判断，可直接开始", "结果是待验证的优势假设，不是能力证明", "建议之后补充一段真实经历来增强可信度"],
        resultTitle: "优势画像", resultSub: "行为证据 · Demo 探索版", saveLabel: "把优势信号写入“我擅长”",
        dims: [
            AssessmentDim(key: "structure", name: "结构", label: "结构化思考", color: 0x7F9EFF, desc: "把复杂信息拆开、整理并建立清楚路径"),
            AssessmentDim(key: "empathy", name: "共情", label: "理解他人", color: 0xE88FB9, desc: "觉察感受与立场，帮助对话继续"),
            AssessmentDim(key: "expression", name: "表达", label: "清晰表达", color: 0xC394E8, desc: "把模糊想法转化为别人能理解的语言或画面"),
            AssessmentDim(key: "execution", name: "推进", label: "推动落地", color: 0xE7B36C, desc: "协调资源、处理阻力并把事情向前推进"),
            AssessmentDim(key: "learning", name: "学习", label: "快速学习", color: 0x67CBAE, desc: "从反馈中抓住规律并迁移到新问题"),
        ],
        items: [
            AssessmentItem(dim: "structure", text: "信息混乱时，我会自然地给它们分类并找出主线"),
            AssessmentItem(dim: "empathy", text: "两个人争执时，我常能听出双方真正担心什么"),
            AssessmentItem(dim: "expression", text: "别人听不懂时，我能换一种说法或画法继续解释"),
            AssessmentItem(dim: "execution", text: "计划卡住时，我会找到下一步可执行的小动作"),
            AssessmentItem(dim: "learning", text: "接触新工具后，我能较快摸清它的基本规律"),
            AssessmentItem(dim: "structure", text: "面对复杂任务，我会先明确目标、限制和优先级"),
            AssessmentItem(dim: "empathy", text: "团队气氛微妙变化时，我通常能较早觉察"),
            AssessmentItem(dim: "expression", text: "我能把长篇内容压缩成重点，又不丢掉关键含义"),
            AssessmentItem(dim: "execution", text: "需要多人配合时，我会主动确认责任和时间点"),
            AssessmentItem(dim: "learning", text: "一次失败后，我通常能总结出下次可调整的办法"),
            AssessmentItem(dim: "structure", text: "我喜欢发现看似无关信息之间的关系"),
            AssessmentItem(dim: "empathy", text: "别人表达不完整时，我能用提问帮他把想法说清楚"),
            AssessmentItem(dim: "expression", text: "我对措辞、叙事或视觉呈现是否准确比较敏感"),
            AssessmentItem(dim: "execution", text: "即使条件不完美，我也能先做出可验证的版本"),
            AssessmentItem(dim: "learning", text: "我能把一个领域学到的方法迁移到另一个问题上"),
        ],
        likert: ["非常不符合", "比较不符合", "不确定", "比较符合", "非常符合"])

    // MARK: 关系安全感（18 题）

    static let love = AssessmentConfig(
        kind: .love,
        title: "关系安全感与靠近方式", sub: "理解需要，不评判依恋类型", kicker: "RELATIONSHIP SECURITY · DEMO CONSTRUCT VERSION",
        introTitle: "当关系变重要时，\n你会怎样靠近或保护自己？",
        intro: "请想象一段对你重要的亲密关系，按照你真实的反应回答。题目参考依恋焦虑与回避构念重新编写，仅用于 Demo 自我探索。",
        notices: ["18题，观察安全感需求与距离调节", "高低都不是好坏，而是不同的保护方式", "结果不用于诊断，也不替代真实关系中的沟通"],
        resultTitle: "恋爱关系画像", resultSub: "亲密关系构念 · Demo 改写版", saveLabel: "写入“我在恋爱关系中在意”",
        dims: [
            AssessmentDim(key: "anxiety", name: "确认需要", label: "及时回应", color: 0xEC8C86, desc: "关系不确定时，更需要清晰回应与稳定确认"),
            AssessmentDim(key: "avoidance", name: "距离需要", label: "尊重边界", color: 0x8EA1D8, desc: "关系靠近时，更重视自主空间与不被侵入"),
        ],
        items: [
            AssessmentItem(dim: "anxiety", text: "对方回复变慢时，我会担心自己不再重要"),
            AssessmentItem(dim: "avoidance", text: "关系太亲密时，我会担心失去自己的空间"),
            AssessmentItem(dim: "anxiety", text: "发生矛盾后，如果问题悬着，我很难安心做别的事"),
            AssessmentItem(dim: "avoidance", text: "我不太习惯把最脆弱的感受交给伴侣"),
            AssessmentItem(dim: "anxiety", text: "我需要对方明确表达在乎，而不只是让我自己猜"),
            AssessmentItem(dim: "avoidance", text: "遇到压力时，我通常更想自己消化而不是寻求伴侣支持"),
            AssessmentItem(dim: "anxiety", text: "关系出现距离时，我容易反复回想是不是自己做错了什么"),
            AssessmentItem(dim: "avoidance", text: "即使关系很好，我也需要保留不被追问的私人部分"),
            AssessmentItem(dim: "anxiety", text: "我能相信对方即使暂时忙碌也不会离开", reversed: true),
            AssessmentItem(dim: "avoidance", text: "我可以坦然依靠伴侣，也允许伴侣依靠我", reversed: true),
            AssessmentItem(dim: "anxiety", text: "对方语气细微变化会明显影响我的安全感"),
            AssessmentItem(dim: "avoidance", text: "谈到长期承诺时，我有时会本能地想后退"),
            AssessmentItem(dim: "anxiety", text: "我担心自己投入得比对方更多"),
            AssessmentItem(dim: "avoidance", text: "我不喜欢伴侣知道我所有的需要"),
            AssessmentItem(dim: "anxiety", text: "冲突后得到一个明确的修复动作对我很重要"),
            AssessmentItem(dim: "avoidance", text: "即使意见不同，我也能在关系中保持亲近", reversed: true),
            AssessmentItem(dim: "anxiety", text: "我通常确信自己值得被稳定地爱", reversed: true),
            AssessmentItem(dim: "avoidance", text: "表达依赖会让我觉得自己失去了主动权"),
        ],
        likert: ["非常不符合", "比较不符合", "不确定", "比较符合", "非常符合"])

    // MARK: 家庭关系与期待（20 题）

    static let family = AssessmentConfig(
        kind: .family,
        title: "家庭关系与期待", sub: "看见你想守住的家庭价值", kicker: "FAMILY VALUES · DEMO CONSTRUCT VERSION",
        introTitle: "在家人之间，\n什么让你感觉这是“家”？",
        intro: "请按照你真正期待的家庭关系回答，而不是判断原生家庭好坏。题目参考家庭凝聚、沟通、边界、责任与自主构念重新编写。",
        notices: ["20题，覆盖五个家庭关系维度", "测的是你的期待与偏好，不给家庭贴标签", "结果可继续用自定义关键词修正"],
        resultTitle: "家庭价值画像", resultSub: "家庭关系构念 · Demo 改写版", saveLabel: "写入“我在家庭关系中在意”",
        dims: [
            AssessmentDim(key: "cohesion", name: "支持", label: "彼此支持", color: 0x6FD1B1, desc: "重要时刻能够互相靠近并提供实际支持"),
            AssessmentDim(key: "communication", name: "沟通", label: "坦诚沟通", color: 0x7FA7E8, desc: "问题能被说出来，也能被认真听见"),
            AssessmentDim(key: "boundary", name: "边界", label: "尊重边界", color: 0xA796D8, desc: "亲近不等于控制，允许保留个人空间"),
            AssessmentDim(key: "responsibility", name: "责任", label: "共同承担", color: 0xE3B26E, desc: "家庭责任清楚、公平且说到做到"),
            AssessmentDim(key: "autonomy", name: "自主", label: "允许不同选择", color: 0xE68FAD, desc: "家人可以拥有不同道路而不被否定"),
        ],
        items: [
            AssessmentItem(dim: "cohesion", text: "遇到真正困难时，家人愿意放下分歧一起面对"),
            AssessmentItem(dim: "communication", text: "不舒服的事情可以直接说，而不用靠猜或冷战"),
            AssessmentItem(dim: "boundary", text: "家人会先征求意见，再介入彼此的个人决定"),
            AssessmentItem(dim: "responsibility", text: "照顾、家务和经济责任应当被清楚讨论"),
            AssessmentItem(dim: "autonomy", text: "即使选择不同，家人也应尊重彼此的人生方向"),
            AssessmentItem(dim: "cohesion", text: "重要时刻有人在场，比表面的热闹更重要"),
            AssessmentItem(dim: "communication", text: "家里应该允许表达脆弱，而不被嘲笑或指责"),
            AssessmentItem(dim: "boundary", text: "亲密关系里也应该保留隐私和独处空间"),
            AssessmentItem(dim: "responsibility", text: "答应家人的事情应该尽量做到"),
            AssessmentItem(dim: "autonomy", text: "爱不应该以服从为前提"),
            AssessmentItem(dim: "cohesion", text: "家人之间的支持应当包括实际行动，而不只是口头关心"),
            AssessmentItem(dim: "communication", text: "发生冲突后，愿意回来修复比假装没事更重要"),
            AssessmentItem(dim: "boundary", text: "家人不应通过愧疚感来迫使彼此答应要求"),
            AssessmentItem(dim: "responsibility", text: "承担更多的人也应该有权表达疲惫和需要"),
            AssessmentItem(dim: "autonomy", text: "成年人有权决定自己的伴侣、工作和生活方式"),
            AssessmentItem(dim: "cohesion", text: "即使不常联系，也应让彼此知道需要时可以求助"),
            AssessmentItem(dim: "communication", text: "家人之间应该说清期待，而不是把“你应该懂”当作规则"),
            AssessmentItem(dim: "boundary", text: "关心一个人不代表可以替他做所有决定"),
            AssessmentItem(dim: "responsibility", text: "家庭里的付出需要被看见，而不是被当作理所当然"),
            AssessmentItem(dim: "autonomy", text: "家庭和睦不意味着所有人必须想法一致"),
        ],
        likert: ["非常不符合", "比较不符合", "不确定", "比较符合", "非常符合"])

    // MARK: 人际需要与边界（20 题，中文原创探索）

    static let social = AssessmentConfig(
        kind: .social,
        title: "人际需要与边界探索", sub: "看见你希望怎样与人靠近", kicker: "人际需要 · 中文原创探索",
        introTitle: "在人际交往中，\n你最希望被怎样对待？",
        intro: "请想象朋友、同事或熟人关系中的真实相处，按照你的需要回答。题目参考人际需要、关系结构与沟通研究中的常见构念重新设计，不复刻商业题库。",
        notices: ["20题，覆盖连接、互惠、深度、边界与修复", "结果描述你重视的相处条件，不给社交能力贴标签", "如果不同关系里的答案差异很大，以大多数真实关系为准"],
        resultTitle: "人际关系画像", resultSub: "人际需要 · 原创探索版", saveLabel: "写入“我在人际交往中在意”",
        dims: [
            AssessmentDim(key: "inclusion", name: "连接", label: "被接纳参与", color: 0x6E9DE8, desc: "希望被主动想起、邀请，并在群体里拥有位置"),
            AssessmentDim(key: "reciprocity", name: "互惠", label: "有来有往", color: 0x6BC9B0, desc: "重视投入、回应与支持不是长期单向的"),
            AssessmentDim(key: "depth", name: "深度", label: "真诚深度", color: 0xC18DDF, desc: "希望关系能承载真实表达、理解与信任"),
            AssessmentDim(key: "boundary", name: "边界", label: "尊重边界", color: 0xE2AC6B, desc: "亲近同时保留拒绝、隐私和独处空间"),
            AssessmentDim(key: "repair", name: "修复", label: "冲突可修复", color: 0xE681A1, desc: "出现分歧后愿意说明、道歉并重新连接"),
        ],
        items: [
            AssessmentItem(dim: "inclusion", text: "朋友或同事会主动想起并邀请我，这对我很重要"),
            AssessmentItem(dim: "reciprocity", text: "关系里的联系和关心不应该长期只由一方发起"),
            AssessmentItem(dim: "depth", text: "我希望重要关系里可以聊真实感受，而不只停留在寒暄"),
            AssessmentItem(dim: "boundary", text: "即使关系很好，也应该允许彼此拒绝请求"),
            AssessmentItem(dim: "repair", text: "发生误会后，对方愿意回来说明和修复很重要"),
            AssessmentItem(dim: "inclusion", text: "进入一个新群体时，我希望有人自然地把我带进对话"),
            AssessmentItem(dim: "reciprocity", text: "我愿意支持别人，也希望需要时能得到回应"),
            AssessmentItem(dim: "depth", text: "我更珍惜少数能彼此理解的关系，而不是大量泛泛之交"),
            AssessmentItem(dim: "boundary", text: "朋友之间也不应该追问我不想公开的私人信息"),
            AssessmentItem(dim: "repair", text: "意见不同没有关系，但不应靠冷落或消失处理冲突"),
            AssessmentItem(dim: "inclusion", text: "重要的信息或决定把我排除在外，会明显影响我的感受"),
            AssessmentItem(dim: "reciprocity", text: "别人记得我说过的小事，会让我感到这段关系有来有往"),
            AssessmentItem(dim: "depth", text: "我希望关系里能够直接表达欣赏、失望与需要"),
            AssessmentItem(dim: "boundary", text: "临时改变计划或频繁打扰前，最好先询问我的意愿"),
            AssessmentItem(dim: "repair", text: "伤害发生后，具体的改正行动比一句“算了吧”更重要"),
            AssessmentItem(dim: "inclusion", text: "即使不常见面，我也希望知道自己在对方生活中仍有位置"),
            AssessmentItem(dim: "reciprocity", text: "如果我总在倾听，我也希望有机会被认真听见"),
            AssessmentItem(dim: "depth", text: "我重视能保守秘密、不随意消费彼此脆弱的关系"),
            AssessmentItem(dim: "boundary", text: "亲密不意味着必须随时回复消息或解释行踪"),
            AssessmentItem(dim: "repair", text: "冲突后能重新建立安全感，是关系能否继续的重要条件"),
        ],
        likert: ["完全不重要", "不太重要", "一般", "比较重要", "非常重要"])

    // MARK: MBTI

    static let mbtiTypes = ["ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP",
                            "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ"]
}

// MARK: - 喜欢 × 擅长完整探索（中文原创题目）

enum DiscoveryAxis: String, Codable, Sendable { case like, skill, value }

struct DiscoveryOption: Identifiable, Sendable {
    var id: String { label }
    let label: String
    let tag: String
    let glyph: String
}

struct DiscoveryQuestion: Identifiable, Sendable {
    let id: String
    let axis: DiscoveryAxis
    let eyebrow: String
    let title: String
    let hint: String
    let options: [DiscoveryOption]
}

struct DiscoveryAnswer: Codable, Sendable {
    var selected: [String] = []
    var custom: [String] = []
}

struct RankedDiscoveryTag: Codable, Sendable {
    let tag: String
    let count: Int
}

struct DiscoveryInsight: Codable, Identifiable, Sendable {
    var id: String { label }
    let label: String
    let evidence: String
    let reason: String
}

struct DiscoveryDirection: Codable, Identifiable, Sendable {
    var id: String { title }
    let title: String
    let why: String
    let firstStep: String

    enum CodingKeys: String, CodingKey {
        case title, why
        case firstStep = "first_step"
    }
}

struct SelfDiscoveryAnalysis: Codable, Sendable {
    let summary: String
    let likes: [DiscoveryInsight]
    let strengths: [DiscoveryInsight]
    let directions: [DiscoveryDirection]
    let confidenceNote: String

    enum CodingKeys: String, CodingKey {
        case summary, likes, strengths, directions
        case confidenceNote = "confidence_note"
    }
}

struct SelfDiscoveryRequest: Codable, Sendable {
    struct Response: Codable, Sendable {
        let id: String
        let axis: DiscoveryAxis
        let question: String
        let selected: [String]
        let custom: [String]
    }
    struct Evidence: Codable, Sendable {
        let likes: [RankedDiscoveryTag]
        let strengths: [RankedDiscoveryTag]
        let values: [RankedDiscoveryTag]
    }
    let responses: [Response]
    let evidence: Evidence
}

enum SelfDiscoveryData {
    private static func q(
        _ id: String, _ axis: DiscoveryAxis, _ eyebrow: String, _ title: String, _ hint: String,
        _ rows: [(String, String, String)]
    ) -> DiscoveryQuestion {
        DiscoveryQuestion(id: id, axis: axis, eyebrow: eyebrow, title: title, hint: hint,
                          options: rows.map { DiscoveryOption(label: $0.0, tag: $0.1, glyph: $0.2) })
    }

    static let questions: [DiscoveryQuestion] = [
        q("like-pull", .like, "喜欢的事 · 自然靠近", "没有任务和评价时，你会主动靠近什么？", "选 1–3 项，也可以写下选项之外的真实答案。", [
            ("内容、画面、音乐或故事", "创造与表达", "✦"), ("一个值得追到底的问题", "知识与探索", "◎"),
            ("人的经历、感受与关系", "人类与连接", "♡"), ("工具、流程与系统如何运作", "系统与优化", "▦"),
            ("社会变化与真实影响", "影响与推动", "↗"), ("自然、身体与动手体验", "实践与体验", "◇"),
        ]),
        q("like-flow", .like, "喜欢的事 · 心流证据", "哪些活动曾让你忘记时间？", "回想真实发生过的时刻，不选“理想中应该喜欢”的事。", [
            ("把想法做成作品", "创造与表达", "✦"), ("阅读、研究或拆解原理", "知识与探索", "◎"),
            ("深聊、陪伴或理解别人", "人类与连接", "♡"), ("整理、规划或持续改进", "系统与优化", "▦"),
            ("组织大家完成一件事", "影响与推动", "↗"), ("制作、运动或走进自然", "实践与体验", "◇"),
        ]),
        q("like-invest", .like, "喜欢的事 · 投入意愿", "你愿意持续把时间或金钱花在哪里？", "真正的兴趣通常会留下持续投入的痕迹。", [
            ("创作工具、审美与表达训练", "创造与表达", "✦"), ("课程、书籍与新知识", "知识与探索", "◎"),
            ("社群、关系与助人体验", "人类与连接", "♡"), ("效率工具、方法与系统", "系统与优化", "▦"),
            ("项目、公共议题与行动", "影响与推动", "↗"), ("手作、旅行、运动与体验", "实践与体验", "◇"),
        ]),
        q("like-admire", .like, "喜欢的事 · 羡慕线索", "你最容易羡慕哪种人的日常？", "羡慕不等于要成为对方，它可能提示你想靠近的内容世界。", [
            ("持续输出独特作品的人", "创造与表达", "✦"), ("不断发现和解释新知的人", "知识与探索", "◎"),
            ("真正理解并改善他人处境的人", "人类与连接", "♡"), ("把复杂事物变得清晰高效的人", "系统与优化", "▦"),
            ("召集别人创造真实变化的人", "影响与推动", "↗"), ("以身体和双手探索世界的人", "实践与体验", "◇"),
        ]),
        q("like-learn", .like, "喜欢的事 · 好奇方向", "即使短期没有回报，你仍想学什么？", "先把职业名称放在一边，只看你想持续理解的对象。", [
            ("叙事、视觉、音乐或设计", "创造与表达", "✦"), ("科学、技术、历史或思想", "知识与探索", "◎"),
            ("心理、教育、沟通或关系", "人类与连接", "♡"), ("商业、产品、流程或组织", "系统与优化", "▦"),
            ("领导力、社会创新或公共议题", "影响与推动", "↗"), ("自然、工艺、运动或生活实践", "实践与体验", "◇"),
        ]),
        q("skill-asked", .skill, "擅长的事 · 他人证据", "别人通常会来找你帮什么忙？", "擅长常是你觉得普通、别人却认为可靠的行为方式。", [
            ("想点子或打开新角度", "创意生成", "✦"), ("快速摸清陌生领域", "快速学习", "◎"),
            ("听懂没被说出口的需要", "共情连接", "♡"), ("把混乱信息理出主线", "结构化思考", "▦"),
            ("找到下一步并推动完成", "推动落地", "↗"), ("直接动手排查和解决", "实践解决", "◇"),
        ]),
        q("skill-natural", .skill, "擅长的事 · 自然反应", "面对一个混乱问题，你会自然先做什么？", "不是问应该怎么做，而是你往往不假思索就会怎么做。", [
            ("提出几种不同可能", "创意生成", "✦"), ("边做边学并找到规律", "快速学习", "◎"),
            ("理解每个人真正担心什么", "共情连接", "♡"), ("拆目标、约束与优先级", "结构化思考", "▦"),
            ("拉齐分工、时间和下一步", "推动落地", "↗"), ("先做一个能验证的版本", "实践解决", "◇"),
        ]),
        q("skill-success", .skill, "擅长的事 · 成功模式", "过去做成一件事时，你最常贡献什么？", "寻找多次成功背后重复出现的行为，而不只是职位和技能名。", [
            ("给出别人没想到的方案", "创意生成", "✦"), ("从反馈中迅速学会", "快速学习", "◎"),
            ("让不同的人愿意继续对话", "共情连接", "♡"), ("把复杂问题讲清楚", "结构化思考", "▦"),
            ("让卡住的事情重新前进", "推动落地", "↗"), ("把问题真正修好或做出来", "实践解决", "◇"),
        ]),
        q("skill-effortless", .skill, "擅长的事 · 低耗能优势", "哪些事你做起来不太费力，却常得到好反馈？", "优势不是“永远轻松”，而是相较别人更自然、更容易复现。", [
            ("迅速联想到新表达或新方案", "创意生成", "✦"), ("短时间抓住新事物重点", "快速学习", "◎"),
            ("察觉气氛并让人安心", "共情连接", "♡"), ("归纳信息并清楚表达", "结构化思考", "▦"),
            ("协调资源并按时交付", "推动落地", "↗"), ("试出来、修出来、做出来", "实践解决", "◇"),
        ]),
        q("skill-friction", .skill, "擅长的事 · 过度使用", "你最常因为哪种“做得太多”被提醒？", "优势用过头也会制造摩擦，这类反馈常藏着可用的能力。", [
            ("想法太多、容易跳出原方案", "创意生成", "✦"), ("总想再查清楚、再学一点", "快速学习", "◎"),
            ("太在意别人感受", "共情连接", "♡"), ("过度分析、追求逻辑完整", "结构化思考", "▦"),
            ("推进太快、总想立即行动", "推动落地", "↗"), ("不爱空谈、习惯先动手", "实践解决", "◇"),
        ]),
        q("value-discomfort", .value, "价值观 · 不适线索", "看到什么状态时，你最容易感到不舒服？", "这部分帮助 AI 判断你为何喜欢某件事，不会代替“喜欢”和“擅长”的结果。", [
            ("表达被限制、没有选择", "自由与创造", "✦"), ("停止成长、拒绝求真", "成长与求真", "◎"),
            ("人被忽略、关系缺少理解", "关怀与连接", "♡"), ("混乱低效、规则不透明", "秩序与清晰", "▦"),
            ("明知能改变却无人行动", "影响与担当", "↗"), ("脱离现实、只有概念没有体验", "真实与实践", "◇"),
        ]),
        q("value-contribution", .value, "价值观 · 贡献方向", "你希望自己的投入最终带来什么？", "这会作为组合“喜欢 × 擅长”时的判断标准。", [
            ("让人拥有更多表达与选择", "自由与创造", "✦"), ("让知识和成长更容易发生", "成长与求真", "◎"),
            ("让人被看见、理解和支持", "关怀与连接", "♡"), ("让复杂世界更清晰有序", "秩序与清晰", "▦"),
            ("推动值得发生的真实变化", "影响与担当", "↗"), ("创造可触摸、可使用的成果", "真实与实践", "◇"),
        ]),
    ]

    static func rankedTags(_ axis: DiscoveryAxis, answers: [String: DiscoveryAnswer]) -> [RankedDiscoveryTag] {
        var counts: [String: Int] = [:]
        var order: [String] = []
        for question in questions where question.axis == axis {
            for label in answers[question.id]?.selected ?? [] {
                guard let tag = question.options.first(where: { $0.label == label })?.tag else { continue }
                if counts[tag] == nil { order.append(tag) }
                counts[tag, default: 0] += 1
            }
        }
        return order.sorted { (counts[$0] ?? 0) > (counts[$1] ?? 0) }
            .prefix(3).map { RankedDiscoveryTag(tag: $0, count: counts[$0] ?? 0) }
    }

    private static func rankedWithCustom(_ axis: DiscoveryAxis, answers: [String: DiscoveryAnswer]) -> [RankedDiscoveryTag] {
        var ranked = rankedTags(axis, answers: answers)
        var seen = Set(ranked.map(\.tag))
        for question in questions where question.axis == axis {
            for custom in answers[question.id]?.custom ?? [] {
                let tag = String(custom.trimmingCharacters(in: .whitespacesAndNewlines).prefix(18))
                guard !tag.isEmpty, !seen.contains(tag) else { continue }
                ranked.append(RankedDiscoveryTag(tag: tag, count: 1)); seen.insert(tag)
                if ranked.count == 3 { return ranked }
            }
        }
        let defaults = axis == .like
            ? ["继续观察投入感", "寻找主动靠近的主题", "记录持续好奇的内容"]
            : axis == .skill
                ? ["继续收集他人反馈", "复盘自然行动模式", "记录低耗能的成功"]
                : ["继续澄清价值排序", "记录重要选择", "观察不愿妥协之处"]
        for tag in defaults where !seen.contains(tag) {
            ranked.append(RankedDiscoveryTag(tag: tag, count: 1)); seen.insert(tag)
            if ranked.count == 3 { break }
        }
        return Array(ranked.prefix(3))
    }

    static func localAnalysis(_ answers: [String: DiscoveryAnswer]) -> SelfDiscoveryAnalysis {
        let likes = rankedWithCustom(.like, answers: answers)
        let strengths = rankedWithCustom(.skill, answers: answers)
        let values = rankedWithCustom(.value, answers: answers)
        let likeInsights = likes.map { item in
            DiscoveryInsight(label: item.tag, evidence: "在 \(item.count) 个不同情境中重复出现", reason: "它多次出现在你的注意力、投入感与主动选择中，值得优先用真实行动验证。")
        }
        let strengthInsights = strengths.map { item in
            DiscoveryInsight(label: item.tag, evidence: "在 \(item.count) 个不同情境中重复出现", reason: "它多次出现在你的自然反应、他人反馈与成功模式中，可能是可复用的优势。")
        }
        let value = values.first?.tag ?? "你重视的价值"
        let directions = likes.enumerated().map { index, like in
            let strength = strengths[index % max(strengths.count, 1)].tag
            return DiscoveryDirection(title: "用\(strength)，去探索\(like.tag)", why: "这组组合同时回应了你的兴趣证据，并靠近“\(value)”。", firstStep: "在一周内完成一个与“\(like.tag)”有关、能使用“\(strength)”的小行动。")
        }
        return SelfDiscoveryAnalysis(
            summary: "你更容易被\(likes.map(\.tag).joined(separator: "、"))吸引，并倾向用\(strengths.map(\.tag).joined(separator: "、"))来解决问题。",
            likes: likeInsights, strengths: strengthInsights, directions: directions,
            confidenceNote: "这是基于选择频次生成的初步假设；继续记录真实行动中的投入感和反馈，结论会更准确。")
    }

    static func request(_ answers: [String: DiscoveryAnswer]) -> SelfDiscoveryRequest {
        SelfDiscoveryRequest(
            responses: questions.map { question in
                let answer = answers[question.id] ?? DiscoveryAnswer()
                return .init(id: question.id, axis: question.axis, question: question.title, selected: answer.selected, custom: answer.custom)
            },
            evidence: .init(
                likes: rankedTags(.like, answers: answers),
                strengths: rankedTags(.skill, answers: answers),
                values: rankedTags(.value, answers: answers)))
    }
}
