import Foundation

// MARK: - 我的公开主页数据模型（原型 DEFAULT_MY_PROFILE / MY_PROFILE_KEY）
//
// 纯本地：UserDefaults JSON 持久化，加载时与默认档案合并（原型 loadMyProfile 语义）。

struct MyProfile: Codable, Equatable, Sendable {
    static let legacyDefaultName = "屿岸"

    var name: String
    /// 头像色相（Theme.hue 0–4）
    var hue: Int
    var quote: String
    var tags: [String]
    var bio: String
    var traj: [TimelineNode]
    /// 画像展示开关：personality / skill / like / love / family / social / life
    var visibility: [String: Bool]
    var adviceModules: [AdviceModule]
    var services: [ServiceOffer]
    var meta: Meta

    struct TimelineNode: Codable, Equatable, Identifiable, Sendable {
        var id = UUID()
        var age: String
        var t: String
        var d: String

        private enum CodingKeys: String, CodingKey { case age, t, d }
    }

    struct AdviceModule: Codable, Equatable, Identifiable, Sendable {
        var id: String
        var title: String
        var content: String
        var links: [Link]

        struct Link: Codable, Equatable, Identifiable, Sendable {
            var id = UUID()
            var label: String
            var url: String
            private enum CodingKeys: String, CodingKey { case label, url }
        }
    }

    struct ServiceOffer: Codable, Equatable, Identifiable, Sendable {
        var id: String
        var enabled: Bool
        var type: String
        var title: String
        var price: String
        var desc: String
    }

    struct Meta: Codable, Equatable, Sendable {
        var age: Int
        var city: String
        var from: String
        var to: String
        var years: String
        var result: String
        var consulted: Int
        var response: String
        var intro: String
        var full: String
    }

    static let visibilityKeys: [(key: String, label: String)] = [
        ("personality", "人格底色"), ("skill", "我擅长"), ("like", "我喜欢"),
        ("love", "我在恋爱关系中在意"), ("family", "我在家庭关系中在意"),
        ("social", "我在人际交往中在意"), ("life", "我的人生底牌"),
    ]

    static let defaultProfile = MyProfile(
        name: "老己", hue: 4,
        quote: "我还没有抵达答案，但已经开始认真记录自己如何选择。",
        tags: ["交互设计", "AI 产品探索", "上海"],
        bio: "交互设计师 → AI 产品探索者",
        traj: [
            TimelineNode(age: "22 岁", t: "进入交互设计行业", d: "从界面和体验开始，逐渐对产品为什么成立产生兴趣。"),
            TimelineNode(age: "27 岁", t: "开始探索 AI 产品", d: "用小项目验证转型意愿，也记录每次选择背后的现实约束。"),
        ],
        visibility: ["personality": true, "skill": true, "like": true,
                     "love": false, "family": false, "social": false, "life": false],
        adviceModules: [
            AdviceModule(id: "default-decision", title: "转型前，先做一次低成本验证",
                         content: "先做一个可以撤回的小实验，再决定是否改变。\n把真实意愿和现实承受力分开记录。\n重要决定前，至少听三种不同经历。", links: []),
            AdviceModule(id: "default-ability", title: "把旧能力翻译成新岗位的优势",
                         content: "把设计经验转译成产品判断证据。\n优先补真实项目，而不是继续囤课。\n记录每次取舍背后的依据。", links: []),
            AdviceModule(id: "default-interview", title: "让面试官看见真实的行动证据",
                         content: "不把转型故事讲成一条完美直线。\n用真实行动解释为什么改变。\n坦白仍在补齐的能力。", links: []),
        ],
        services: [
            ServiceOffer(id: "consult", enabled: true, type: "1 对 1 交流", title: "转型路径交流", price: "29",
                         desc: "围绕当前选择、能力迁移与行动计划进行一次真实经验交流。"),
            ServiceOffer(id: "materials", enabled: false, type: "资料工具包", title: "探索复盘模板", price: "9.9",
                         desc: "整理我在探索过程中使用的问题清单、复盘表和小实验模板。"),
            ServiceOffer(id: "companion", enabled: false, type: "阶段陪跑", title: "四周行动陪跑", price: "599",
                         desc: "每周复盘一次进展，在关键选择点提供经验反馈。"),
        ],
        meta: Meta(age: 28, city: "上海", from: "交互设计师", to: "AI 产品探索者",
                   years: "探索第 1 年", result: "持续用真实项目验证方向",
                   consulted: 0, response: "暂未开放咨询",
                   intro: "我正在从熟悉的交互设计向 AI 产品方向探索。比起把转型包装成一条直线，我更想诚实记录犹豫、试错和逐渐清楚的过程。",
                   full: "最难的不是学会一个新工具，而是接受自己暂时没有确定答案。我开始用小项目、访谈和每周复盘代替空想，让每一步都留下可以判断的证据。"))
}

// MARK: - 远端映射（public_profiles 表 ↔ MyProfile）
//
// 上行：POST /save-profile action=save_public_profile（save-profile/index.ts 逐字段透传）。
// 下行：GET /get-profile 的 public_profile 字段（select("*")，未建档时为 null）。
// 仅覆盖远端有列的字段；hue / adviceModules 之外的 meta 等纯本地字段不上云、恢复时保留本地值。

/// public_profiles 行的 wire 模型（snake_case 仅 avatar_url；
/// trajectory/services/advice jsonb 直接复用 MyProfile 嵌套结构的编码形状：
/// trajectory=[{age,t,d}]，services=[{id,enabled,type,title,price,desc}]，
/// advice=[{id,title,content,links:[{label,url}]}]，visibility={dimension:Bool}）
struct RemotePublicProfile: Codable, Sendable {
    var name: String? = nil
    var quote: String? = nil
    var bio: String? = nil
    var avatarUrl: String? = nil
    var tags: [String]? = nil
    var trajectory: [MyProfile.TimelineNode]? = nil
    var services: [MyProfile.ServiceOffer]? = nil
    var advice: [MyProfile.AdviceModule]? = nil
    var visibility: [String: Bool]? = nil

    enum CodingKeys: String, CodingKey {
        case name, quote, bio, tags, trajectory, services, advice, visibility
        case avatarUrl = "avatar_url"
    }

    init(name: String? = nil, quote: String? = nil, bio: String? = nil, avatarUrl: String? = nil,
         tags: [String]? = nil, trajectory: [MyProfile.TimelineNode]? = nil,
         services: [MyProfile.ServiceOffer]? = nil, advice: [MyProfile.AdviceModule]? = nil,
         visibility: [String: Bool]? = nil) {
        self.name = name
        self.quote = quote
        self.bio = bio
        self.avatarUrl = avatarUrl
        self.tags = tags
        self.trajectory = trajectory
        self.services = services
        self.advice = advice
        self.visibility = visibility
    }

    /// select("*") 返回全列；jsonb 子结构解码失败时逐字段降级为 nil，不让整体失败
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try? c.decodeIfPresent(String.self, forKey: .name)
        quote = try? c.decodeIfPresent(String.self, forKey: .quote)
        bio = try? c.decodeIfPresent(String.self, forKey: .bio)
        avatarUrl = try? c.decodeIfPresent(String.self, forKey: .avatarUrl)
        tags = try? c.decodeIfPresent([String].self, forKey: .tags)
        trajectory = try? c.decodeIfPresent([MyProfile.TimelineNode].self, forKey: .trajectory)
        services = try? c.decodeIfPresent([MyProfile.ServiceOffer].self, forKey: .services)
        advice = try? c.decodeIfPresent([MyProfile.AdviceModule].self, forKey: .advice)
        visibility = try? c.decodeIfPresent([String: Bool].self, forKey: .visibility)
    }
}

extension MyProfile {

    /// 上行 payload（SupabaseService.savePublicProfileRemote 用）
    var remotePayload: RemotePublicProfile {
        RemotePublicProfile(
            name: name, quote: quote, bio: bio, avatarUrl: nil,
            tags: tags, trajectory: traj, services: services,
            advice: adviceModules, visibility: visibility
        )
    }

    /// 用远端字段覆盖本地模型（远端缺失/空字段保留本地值，不破坏本地持久化语义）
    func merging(remote: RemotePublicProfile) -> MyProfile {
        var merged = self
        if let v = remote.name, !v.isEmpty {
            merged.name = v == Self.legacyDefaultName ? Self.defaultProfile.name : v
        }
        if let v = remote.quote, !v.isEmpty { merged.quote = v }
        if let v = remote.bio, !v.isEmpty { merged.bio = v }
        if let v = remote.tags, !v.isEmpty { merged.tags = v }
        if let v = remote.trajectory, !v.isEmpty { merged.traj = v }
        if let v = remote.services, !v.isEmpty { merged.services = v }
        if let v = remote.advice, !v.isEmpty { merged.adviceModules = v }
        if let v = remote.visibility, !v.isEmpty {
            merged.visibility = merged.visibility.merging(v) { _, remote in remote }
        }
        return merged
    }
}
