import Foundation

// MARK: - 动态画像 · 软性维度配置（迁移自原型 DIMENSION_CONFIG）
//
// 四个可用关键词 + 小工具填充的软维度：我擅长 / 我喜欢 / 情感关系 / 家庭关系。
// 「人格底色」走画像工作室（测评引擎），不在此列。

enum DimensionKey: String, CaseIterable, Identifiable, Sendable {
    case skill, like, love, family
    var id: String { rawValue }
}

struct DimensionConfig: Identifiable, Sendable {
    var id: String { key.rawValue }
    let key: DimensionKey
    let title: String
    let icon: String
    let tint: UInt32
    let question: String
    /// 三批关键词（每批 5 个，「换一批」轮换）
    let batches: [[String]]
    let tools: [Tool]

    struct Tool: Identifiable, Sendable {
        var id: String { name }
        let name: String
        let desc: String
        let duration: String
        let tint: UInt32
    }
}

enum DimensionData {

    static func config(_ key: DimensionKey) -> DimensionConfig { all[key]! }

    static let all: [DimensionKey: DimensionConfig] = [
        .skill: DimensionConfig(
            key: .skill, title: "我擅长", icon: "✦", tint: 0x5E96FF,
            question: "你是否清楚自己擅长什么？",
            batches: [
                ["结构化表达", "共情别人的想法", "把复杂问题讲清楚", "视觉表达", "快速学习"],
                ["沟通协调", "发现问题", "文字表达", "制定计划", "临场应变"],
                ["倾听", "审美判断", "组织信息", "推动事情落地", "照顾他人感受"],
            ],
            tools: [
                .init(name: "优势证据探索", desc: "无需先选关键词，用 15 个情境反推优势信号", duration: "约 3 分钟", tint: 0x273A67),
            ]),
        .like: DimensionConfig(
            key: .like, title: "我喜欢", icon: "♡", tint: 0xE35CC1,
            question: "什么事情会让你自然地靠近？",
            batches: [
                ["把混乱变有序", "独处的清晨", "手绘", "探索陌生地方", "深度聊天"],
                ["做有创造感的事", "安静阅读", "和朋友一起吃饭", "自然与户外", "学习新工具"],
                ["照顾小动物", "记录生活", "逛展看电影", "解决一道难题", "慢慢做一顿饭"],
            ],
            tools: [
                .init(name: "霍兰德兴趣测评", desc: "完整 30 题 · 生成 RIASEC 六维兴趣画像", duration: "约 5 分钟", tint: 0x2E3D66),
            ]),
        .love: DimensionConfig(
            key: .love, title: "我在情感关系中在意", icon: "✿", tint: 0xFF7A4D,
            question: "一段关系里，什么让你感觉被爱？",
            batches: [
                ["坦诚沟通", "稳定陪伴", "彼此信任", "尊重边界", "共同成长"],
                ["情绪被理解", "说到做到", "保留个人空间", "遇事站在一起", "有回应"],
                ["忠诚", "分享日常", "身体亲密", "价值观接近", "愿意解决冲突"],
            ],
            tools: [
                .init(name: "关系安全感与靠近方式", desc: "18 题 Demo 构念版 · 理解安全感与边界需要", duration: "约 4 分钟", tint: 0x552A3D),
                .init(name: "关系卡牌：靠近还是退后？", desc: "从 6 张关系需要出发，经历 3 次轻量取舍", duration: "约 2 分钟", tint: 0x6A294D),
            ]),
        .family: DimensionConfig(
            key: .family, title: "我在家庭关系中在意", icon: "⌂", tint: 0x3ED9A4,
            question: "在家人之间，你最希望守住什么？",
            batches: [
                ["互相尊重", "健康平安", "有事一起承担", "不控制彼此", "经常联系"],
                ["被理解", "说话算数", "经济上有安全感", "允许不同选择", "照顾长辈"],
                ["家庭和睦", "清晰边界", "公平对待", "能够表达脆弱", "重要时刻在场"],
            ],
            tools: [
                .init(name: "家庭关系与期待", desc: "20 题 Demo 构念版 · 看见你想守住的家庭价值", duration: "约 5 分钟", tint: 0x28443F),
            ]),
    ]
}
