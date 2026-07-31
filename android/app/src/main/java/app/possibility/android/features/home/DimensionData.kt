package app.possibility.android.features.home

import app.possibility.android.features.studio.AssessmentKind

// MARK: - 动态画像 · 软性维度配置（迁移自 iOS Core/Models/DimensionData.swift · 原型 DIMENSION_CONFIG）
//
// 五个可用关键词 + 小工具填充的软维度：我擅长 / 我喜欢 / 恋爱关系 / 家庭关系 / 人际交往。
// 「人格底色」走画像工作室（大五测评），不在此列；首页画像共 6 维（personality + 5 软维度）。

/** 软维度键（对应 iOS DimensionKey）。rawValue 与云端 facts.dimension、SharedPreferences 后缀一致。 */
enum class DimensionKey(val id: String) {
    SKILL("skill"),
    LIKE("like"),
    LOVE("love"),
    FAMILY("family"),
    SOCIAL("social");

    companion object {
        fun fromId(id: String): DimensionKey? = entries.firstOrNull { it.id == id }
    }
}

/** 维度小工具（测评 / 卡牌）。 */
data class DimensionTool(
    val name: String,
    val desc: String,
    val duration: String,
    /** 0xRRGGBB */
    val tint: Long,
    /** 点击启动的测评（null → 卡牌游戏等其他工具）。 */
    val assessment: AssessmentKind? = null,
    /** 点击启动的卡牌游戏 kind（life / marriage / family / social）。 */
    val cardGame: String? = null,
)

/** 单个软维度配置。 */
data class DimensionConfig(
    val key: DimensionKey,
    val title: String,
    val icon: String,
    /** 0xRRGGBB */
    val tint: Long,
    val question: String,
    /** 三批关键词（每批 5 个，「换一批」轮换）。 */
    val batches: List<List<String>>,
    val tools: List<DimensionTool>,
)

/** 维度目录（逐字复刻 iOS DimensionData.all）。 */
object DimensionData {

    fun config(key: DimensionKey): DimensionConfig = all.getValue(key)

    val all: Map<DimensionKey, DimensionConfig> = mapOf(
        DimensionKey.SKILL to DimensionConfig(
            key = DimensionKey.SKILL, title = "我擅长", icon = "✦", tint = 0x5E96FF,
            question = "你是否清楚自己擅长什么？",
            batches = listOf(
                listOf("结构化表达", "共情别人的想法", "把复杂问题讲清楚", "视觉表达", "快速学习"),
                listOf("沟通协调", "发现问题", "文字表达", "制定计划", "临场应变"),
                listOf("倾听", "审美判断", "组织信息", "推动事情落地", "照顾他人感受"),
            ),
            tools = listOf(
                DimensionTool("优势证据探索", "无需先选关键词，用 15 个情境反推优势信号", "约 3 分钟", 0x273A67, assessment = AssessmentKind.STRENGTH),
            ),
        ),
        DimensionKey.LIKE to DimensionConfig(
            key = DimensionKey.LIKE, title = "我喜欢", icon = "♡", tint = 0xE35CC1,
            question = "什么事情会让你自然地靠近？",
            batches = listOf(
                listOf("把混乱变有序", "独处的清晨", "手绘", "探索陌生地方", "深度聊天"),
                listOf("做有创造感的事", "安静阅读", "和朋友一起吃饭", "自然与户外", "学习新工具"),
                listOf("照顾小动物", "记录生活", "逛展看电影", "解决一道难题", "慢慢做一顿饭"),
            ),
            tools = listOf(
                DimensionTool("霍兰德兴趣测评", "完整 30 题 · 生成 RIASEC 六维兴趣画像", "约 5 分钟", 0x2E3D66, assessment = AssessmentKind.HOLLAND),
            ),
        ),
        DimensionKey.LOVE to DimensionConfig(
            key = DimensionKey.LOVE, title = "我在恋爱关系中在意", icon = "✿", tint = 0xFF7A4D,
            question = "一段恋爱关系里，什么让你感觉被爱？",
            batches = listOf(
                listOf("坦诚沟通", "稳定陪伴", "彼此信任", "尊重边界", "共同成长"),
                listOf("情绪被理解", "说到做到", "保留个人空间", "遇事站在一起", "有回应"),
                listOf("忠诚", "分享日常", "身体亲密", "价值观接近", "愿意解决冲突"),
            ),
            tools = listOf(
                DimensionTool("关系安全感与靠近方式", "18 题 Demo 构念版 · 理解安全感与边界需要", "约 4 分钟", 0x552A3D, assessment = AssessmentKind.LOVE),
                DimensionTool("婚姻卡牌：最后会留下什么？", "从 9 张婚姻底牌出发，在多轮取舍中留下最关心的 3 点", "约 3 分钟", 0x6A294D, cardGame = "marriage"),
            ),
        ),
        DimensionKey.FAMILY to DimensionConfig(
            key = DimensionKey.FAMILY, title = "我在家庭关系中在意", icon = "⌂", tint = 0x3ED9A4,
            question = "在家人之间，你最希望守住什么？",
            batches = listOf(
                listOf("互相尊重", "健康平安", "有事一起承担", "不控制彼此", "经常联系"),
                listOf("被理解", "说话算数", "经济上有安全感", "允许不同选择", "照顾长辈"),
                listOf("家庭和睦", "清晰边界", "公平对待", "能够表达脆弱", "重要时刻在场"),
            ),
            tools = listOf(
                DimensionTool("家庭关系与期待", "20 题 Demo 构念版 · 看见你想守住的家庭价值", "约 5 分钟", 0x28443F, assessment = AssessmentKind.FAMILY),
                DimensionTool("家庭卡牌：最后会守住什么？", "从 9 张家庭底牌出发，在多轮取舍中留下最关心的 3 点", "约 3 分钟", 0x235A4B, cardGame = "family"),
            ),
        ),
        DimensionKey.SOCIAL to DimensionConfig(
            key = DimensionKey.SOCIAL, title = "我在人际交往中在意", icon = "◎", tint = 0x5E96FF,
            question = "和朋友、同事或熟人相处时，你最希望守住什么？",
            batches = listOf(
                listOf("真诚", "互相尊重", "有来有往", "清晰边界", "轻松自在"),
                listOf("深度交流", "稳定联系", "保守秘密", "允许拒绝", "彼此支持"),
                listOf("价值观相近", "不被比较", "冲突后愿意修复", "共同兴趣", "保留独处空间"),
            ),
            tools = listOf(
                DimensionTool("人际卡牌：最后会守住什么？", "从 9 张人际底牌出发，在多轮取舍中留下最关心的 3 点", "约 3 分钟", 0x29466A, cardGame = "social"),
            ),
        ),
    )
}
