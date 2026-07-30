import Foundation

// MARK: - 内容侧模型（公开只读，对应 travelers / traveler_details / traveler_services / bounties）

/// 旅人（经验贡献者）—— 对应表 `travelers`
struct Traveler: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    let name: String
    /// 头像单字
    let initial: String
    /// 配色索引 0..4（Theme.hues）
    let hue: Int
    let isSimilar: Bool
    let quote: String
    let bio: String
    let tags: [String]
    /// 画像维度 [["我擅长","..."], ...]
    let dims: [[String]]
    let trajectory: [TrajectoryNode]

    enum CodingKeys: String, CodingKey {
        case id, name, initial, hue, quote, bio, tags, dims, trajectory
        case isSimilar = "is_similar"
    }
}

/// 人生轨迹节点（travelers.trajectory jsonb 元素：{age,t,d}）
struct TrajectoryNode: Codable, Hashable, Sendable {
    /// 如 "28 岁"
    let age: String
    /// 节点标题
    let title: String
    /// 节点详情
    let detail: String

    enum CodingKeys: String, CodingKey {
        case age
        case title = "t"
        case detail = "d"
    }
}

/// 旅人详情 —— 对应表 `traveler_details`（full/advice 付费解锁）
struct TravelerDetail: Codable, Identifiable, Hashable, Sendable {
    var id: Int { travelerId }
    let travelerId: Int
    let age: Int?
    let city: String?
    let fromRole: String?
    let toRole: String?
    let years: String?
    /// 免费可见
    let intro: String
    /// 付费解锁
    let fullText: String
    let advice: Advice
    let result: String?
    let consulted: Int?
    let responseTime: String?

    enum CodingKeys: String, CodingKey {
        case age, city, years, intro, advice, result, consulted
        case travelerId = "traveler_id"
        case fromRole = "from_role"
        case toRole = "to_role"
        case fullText = "full_text"
        case responseTime = "response_time"
    }

    /// 经验与建议（advice jsonb：{decision:[],ability:[],interview:[]}）
    struct Advice: Codable, Hashable, Sendable {
        let decision: [String]
        let ability: [String]
        let interview: [String]

        func tips(for kind: AdviceKind) -> [String] {
            switch kind {
            case .decision: decision
            case .ability: ability
            case .interview: interview
            }
        }
    }
}

/// 建议分类（对应原型 advice-chips：转型决策 / 能力迁移 / 求职面试）
enum AdviceKind: String, CaseIterable, Identifiable, Sendable {
    case decision, ability, interview
    var id: String { rawValue }

    var label: String {
        switch self {
        case .decision: "转型决策"
        case .ability: "能力迁移"
        case .interview: "求职面试"
        }
    }
}

/// 增值服务 —— 对应表 `traveler_services`
struct TravelerServiceItem: Codable, Identifiable, Hashable, Sendable {
    /// consult / materials / companion
    let id: String
    let travelerId: Int?
    let kind: String
    let title: String
    let price: Decimal
    let unit: String
    let description: String
    let tags: [String]

    enum CodingKeys: String, CodingKey {
        case id, kind, title, price, unit, description, tags
        case travelerId = "traveler_id"
    }
}

/// 悬赏 —— 对应表 `bounties`（0007 迁移补充 tags/detail/status/created_at，
/// POST /community action=list_bounties / get_bounty 返回全字段；旧列表调用只用前四个字段）
struct Bounty: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    let question: String
    let reward: String
    let responses: String
    var tags: [String]? = nil
    var detail: String? = nil
    var status: String? = nil
    var createdAt: String? = nil

    enum CodingKeys: String, CodingKey {
        case id, question, reward, responses, tags, detail, status
        case createdAt = "created_at"
    }

    /// 列表金额展示。兼容线上旧数据：
    /// - 新数据/已修复数据直接从「¥29 悬赏」「29 元」提取；
    /// - 三条内置种子按详情 mock 的既有金额兜底；
    /// - 测试帖或未填写金额显示 ¥0。
    var displayAmount: String {
        let normalized = reward.replacingOccurrences(of: "￥", with: "¥")
        let currencyPatterns = [
            #"¥\s*\d+(?:\.\d{1,2})?"#,
            #"\d+(?:\.\d{1,2})?\s*元"#,
        ]
        for pattern in currencyPatterns {
            if let range = normalized.range(of: pattern, options: .regularExpression) {
                let digits = normalized[range].filter { $0.isNumber || $0 == "." }
                if !digits.isEmpty { return "¥\(digits)" }
            }
        }
        switch id {
        case 1: return "¥29"
        case 2: return "¥19.9"
        case 3: return "¥39"
        default: return "¥0"
        }
    }

    /// 金额已在卡片底栏单独呈现；这里仅保留旧数据中的征集目标。
    var rewardGoal: String? {
        let trimmed = reward.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != "无" else { return nil }
        guard !trimmed.contains("¥"), !trimmed.contains("￥"), !trimmed.contains("元") else { return nil }
        return trimmed
    }
}

/// POST /community action=get_bounty 出参：悬赏详情 + 回应列表
struct BountyDetailResponse: Decodable, Sendable {
    let bounty: Bounty
    let responses: [Reply]

    /// bounty_responses 行：{id, user_id, message, created_at}
    struct Reply: Decodable, Identifiable, Sendable {
        let id: Int
        let userId: UUID
        let message: String
        let createdAt: String?

        enum CodingKeys: String, CodingKey {
            case id, message
            case userId = "user_id"
            case createdAt = "created_at"
        }
    }
}
