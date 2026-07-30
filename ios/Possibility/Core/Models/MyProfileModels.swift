import Foundation

// MARK: - 我的公开主页数据模型（原型 DEFAULT_MY_PROFILE / MY_PROFILE_KEY）
//
// UserDefaults 作为离线缓存；公开字段同步到 public_profiles。

struct MyProfile: Codable, Equatable, Sendable {
    var name: String
    /// 头像色相（Theme.hue 0–4）
    var hue: Int
    var quote: String
    var tags: [String]
    var bio: String
    var traj: [TimelineNode]
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

    static let defaultProfile = MyProfile(
        name: "", hue: 4, quote: "", tags: [], bio: "", traj: [],
        adviceModules: [], services: [],
        meta: Meta(age: 0, city: "", from: "", to: "", years: "", result: "",
                   consulted: 0, response: "", intro: "", full: ""))
}

// MARK: - 远端映射（public_profiles 表 ↔ MyProfile）
//
// 上行：POST /save-profile action=save_public_profile（save-profile/index.ts 逐字段透传）。
// 下行：GET /get-profile 的 public_profile 字段（select("*")，未建档时为 null）。
// v2 起补齐 hero 与故事 meta 字段；consulted/response 仍属于服务端统计或运行态展示，
// 不由公开主页编辑器上行。

/// public_profiles 行的 wire 模型（snake_case 仅 avatar_url；
/// trajectory/services/advice jsonb 直接复用 MyProfile 嵌套结构的编码形状：
/// trajectory=[{age,t,d}]，services=[{id,enabled,type,title,price,desc}]，
/// advice=[{id,title,content,links:[{label,url}]}]）
struct RemotePublicProfile: Codable, Sendable {
    var profileVersion: Int? = nil
    var name: String? = nil
    var quote: String? = nil
    var bio: String? = nil
    var avatarUrl: String? = nil
    var tags: [String]? = nil
    var trajectory: [MyProfile.TimelineNode]? = nil
    var services: [MyProfile.ServiceOffer]? = nil
    var advice: [MyProfile.AdviceModule]? = nil
    var hue: Int? = nil
    var age: Int? = nil
    var city: String? = nil
    var fromRole: String? = nil
    var toRole: String? = nil
    var stage: String? = nil
    var result: String? = nil
    var storyIntro: String? = nil
    var storyFull: String? = nil

    enum CodingKeys: String, CodingKey {
        case name, quote, bio, tags, trajectory, services, advice
        case avatarUrl = "avatar_url"
        case profileVersion = "profile_version"
        case hue, age, city, stage, result
        case fromRole = "from_role"
        case toRole = "to_role"
        case storyIntro = "story_intro"
        case storyFull = "story_full"
    }

    init(profileVersion: Int? = nil, name: String? = nil, quote: String? = nil,
         bio: String? = nil, avatarUrl: String? = nil,
         tags: [String]? = nil, trajectory: [MyProfile.TimelineNode]? = nil,
         services: [MyProfile.ServiceOffer]? = nil, advice: [MyProfile.AdviceModule]? = nil,
         hue: Int? = nil, age: Int? = nil,
         city: String? = nil, fromRole: String? = nil, toRole: String? = nil,
         stage: String? = nil, result: String? = nil,
         storyIntro: String? = nil, storyFull: String? = nil) {
        self.profileVersion = profileVersion
        self.name = name
        self.quote = quote
        self.bio = bio
        self.avatarUrl = avatarUrl
        self.tags = tags
        self.trajectory = trajectory
        self.services = services
        self.advice = advice
        self.hue = hue
        self.age = age
        self.city = city
        self.fromRole = fromRole
        self.toRole = toRole
        self.stage = stage
        self.result = result
        self.storyIntro = storyIntro
        self.storyFull = storyFull
    }

    /// select("*") 返回全列；jsonb 子结构解码失败时逐字段降级为 nil，不让整体失败
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        profileVersion = try? c.decodeIfPresent(Int.self, forKey: .profileVersion)
        name = try? c.decodeIfPresent(String.self, forKey: .name)
        quote = try? c.decodeIfPresent(String.self, forKey: .quote)
        bio = try? c.decodeIfPresent(String.self, forKey: .bio)
        avatarUrl = try? c.decodeIfPresent(String.self, forKey: .avatarUrl)
        tags = try? c.decodeIfPresent([String].self, forKey: .tags)
        trajectory = try? c.decodeIfPresent([MyProfile.TimelineNode].self, forKey: .trajectory)
        services = try? c.decodeIfPresent([MyProfile.ServiceOffer].self, forKey: .services)
        advice = try? c.decodeIfPresent([MyProfile.AdviceModule].self, forKey: .advice)
        hue = try? c.decodeIfPresent(Int.self, forKey: .hue)
        age = try? c.decodeIfPresent(Int.self, forKey: .age)
        city = try? c.decodeIfPresent(String.self, forKey: .city)
        fromRole = try? c.decodeIfPresent(String.self, forKey: .fromRole)
        toRole = try? c.decodeIfPresent(String.self, forKey: .toRole)
        stage = try? c.decodeIfPresent(String.self, forKey: .stage)
        result = try? c.decodeIfPresent(String.self, forKey: .result)
        storyIntro = try? c.decodeIfPresent(String.self, forKey: .storyIntro)
        storyFull = try? c.decodeIfPresent(String.self, forKey: .storyFull)
    }
}

extension MyProfile {

    /// 上行 payload（SupabaseService.savePublicProfileRemote 用）
    var remotePayload: RemotePublicProfile {
        RemotePublicProfile(
            profileVersion: 2,
            name: name, quote: quote, bio: bio, avatarUrl: nil,
            tags: tags, trajectory: traj, services: services,
            advice: adviceModules,
            hue: hue, age: meta.age, city: meta.city,
            fromRole: meta.from, toRole: meta.to,
            stage: meta.years, result: meta.result,
            storyIntro: meta.intro, storyFull: meta.full
        )
    }

    /// 用远端字段覆盖本地模型（远端缺失/空字段保留本地值，不破坏本地持久化语义）
    func merging(remote: RemotePublicProfile) -> MyProfile {
        var merged = self
        if let v = remote.name { merged.name = v }
        if let v = remote.quote { merged.quote = v }
        if let v = remote.bio { merged.bio = v }
        if let v = remote.tags { merged.tags = v }
        if let v = remote.trajectory { merged.traj = v }
        if let v = remote.services { merged.services = v }
        if let v = remote.advice { merged.adviceModules = v }
        if let v = remote.hue, (0...4).contains(v) { merged.hue = v }
        if let v = remote.age, (0...150).contains(v) { merged.meta.age = v }
        if let v = remote.city { merged.meta.city = v }
        if let v = remote.fromRole { merged.meta.from = v }
        if let v = remote.toRole { merged.meta.to = v }
        if let v = remote.stage { merged.meta.years = v }
        if let v = remote.result { merged.meta.result = v }
        if let v = remote.storyIntro { merged.meta.intro = v }
        if let v = remote.storyFull { merged.meta.full = v }
        return merged
    }
}
