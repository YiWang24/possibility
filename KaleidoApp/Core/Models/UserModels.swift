import Foundation

// MARK: - 用户侧模型（RLS 锁 auth.uid()，对应 profiles / conversations / messages / diary_entries / simulations / unlocks）

/// 当前用户动态画像 —— 对应表 `profiles`
struct UserProfile: Codable, Identifiable, Sendable {
    let id: UUID
    var portraitPct: Int
    /// 我擅长 / 我喜欢 / …（维度名 → 内容）
    var dims: [String: String]

    enum CodingKeys: String, CodingKey {
        case id, dims
        case portraitPct = "portrait_pct"
    }
}

/// 对话（一次迷茫 → 一个岔路口）—— 对应表 `conversations`
struct Conversation: Codable, Identifiable, Sendable {
    let id: UUID
    let userId: UUID
    /// 职业 / 家庭 / 升学 / 情感
    var topic: String
    /// open | crossroads | paid | closed
    var status: String
    var crossroads: Crossroads?

    enum CodingKeys: String, CodingKey {
        case id, topic, status, crossroads
        case userId = "user_id"
    }
}

/// 岔路口信号（conversations.crossroads jsonb：{ready,summary,match_query}）
struct Crossroads: Codable, Sendable {
    /// true 时前端解锁「看看走过这条路的人」
    var ready: Bool
    /// 如 "留学 vs 保研"
    var summary: String?
    var matchQuery: MatchQuery?

    enum CodingKeys: String, CodingKey {
        case ready, summary
        case matchQuery = "match_query"
    }
}

/// 匹配条件（岔路口成形后，用于 POST /match 的 user_state）
struct MatchQuery: Codable, Sendable {
    var lifeStage: String?
    var constraints: [String]?
    var tension: String?
    var decisionStage: String?
    var supportNeed: String?

    enum CodingKeys: String, CodingKey {
        case tension, constraints
        case lifeStage = "life_stage"
        case decisionStage = "decision_stage"
        case supportNeed = "support_need"
    }
}

/// 消息 —— 对应表 `messages`
struct ChatMessage: Codable, Identifiable, Sendable {
    let id: Int
    let conversationId: UUID
    /// user | assistant
    let role: Role
    var content: String

    enum Role: String, Codable, Sendable {
        case user, assistant
    }

    enum CodingKeys: String, CodingKey {
        case id, role, content
        case conversationId = "conversation_id"
    }
}

/// 语音日记 —— 对应表 `diary_entries`
struct DiaryEntry: Codable, Identifiable, Sendable {
    let id: Int
    let userId: UUID
    var audioPath: String?
    var transcript: String?
    var emotions: [String]?
    var keywords: [String]?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, transcript, emotions, keywords
        case userId = "user_id"
        case audioPath = "audio_path"
        case createdAt = "created_at"
    }
}

/// 人生实验室推演 —— 对应表 `simulations` 与 POST /simulate 出参
struct Simulation: Codable, Sendable {
    var question: String
    var choice: String
    var years: Int
    var scenarios: Scenarios

    /// {general, optimistic, cautionary}
    struct Scenarios: Codable, Sendable {
        let general: Scenario
        let optimistic: Scenario
        let cautionary: Scenario
    }

    /// 单个结局面板（对应原型 rs-panel 的结构）
    struct Scenario: Codable, Sendable {
        let headline: String
        /// 职业状态 / 收入趋势 / 生活节奏 / 内心感受
        let dimensions: [Dimension]
        let gains: [String]
        let costs: [String]
        let keyCondition: String?

        struct Dimension: Codable, Sendable {
            let label: String
            let text: String
        }

        enum CodingKeys: String, CodingKey {
            case headline, dimensions, gains, costs
            case keyCondition = "key_condition"
        }
    }
}

/// 解锁记录 —— 对应表 `unlocks`（demo mock 支付）
struct Unlock: Codable, Sendable {
    let userId: UUID
    /// profile | service
    let kind: Kind
    /// traveler_id / service id
    let targetId: String
    let amount: Decimal

    enum Kind: String, Codable, Sendable {
        case profile, service
    }

    enum CodingKeys: String, CodingKey {
        case kind, amount
        case userId = "user_id"
        case targetId = "target_id"
    }
}

// MARK: - Edge Function 契约

/// POST /match 出参：3 位结局不同的旅人 + 可解释理由
struct MatchResponse: Codable, Sendable {
    let matches: [Match]

    struct Match: Codable, Identifiable, Sendable {
        var id: Int { travelerId }
        let travelerId: Int
        /// 为什么推荐给你（可解释）
        let reason: String
        /// 不适用条件（避免确认偏误）
        let notApplicable: String

        enum CodingKeys: String, CodingKey {
            case reason
            case travelerId = "traveler_id"
            case notApplicable = "not_applicable"
        }
    }
}

/// POST /analyze-diary 出参
struct DiaryAnalysis: Codable, Sendable {
    let emotions: [String]
    let keywords: [String]
    let dimUpdates: [String: String]?

    enum CodingKeys: String, CodingKey {
        case emotions, keywords
        case dimUpdates = "dim_updates"
    }
}

/// 探索话题（对应原型 topicChips）
enum ExploreTopic: String, CaseIterable, Identifiable, Sendable {
    case career = "职业"
    case family = "家庭"
    case study = "升学"
    case love = "情感"

    var id: String { rawValue }

    /// 原型 TOPIC_SAMPLES 的占位问题
    var sampleQuestion: String {
        switch self {
        case .career: "我是否要从交互设计师转为产品经理？"
        case .family: "要不要搬回父母所在的城市生活？"
        case .study: "26 岁了，还要不要辞职去读研？"
        case .love: "异地三年，要不要为 TA 换一座城市？"
        }
    }
}
