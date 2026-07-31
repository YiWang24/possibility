package app.possibility.android.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// 内容侧模型（公开只读，对应 travelers / traveler_details / traveler_services / bounties）
// 对应 ios/Possibility/Core/Models/ContentModels.swift，wire 字段全部对齐。

/** 旅人（经验贡献者）—— 对应表 `travelers` */
@Serializable
data class Traveler(
    val id: Int,
    val name: String,
    /** 头像单字 */
    val initial: String,
    /** 配色索引 0..4（Theme.hues） */
    val hue: Int,
    @SerialName("is_similar") val isSimilar: Boolean,
    val quote: String,
    val bio: String,
    val tags: List<String>,
    /** 画像维度 [["我擅长","..."], ...] */
    val dims: List<List<String>>,
    val trajectory: List<TrajectoryNode>,
)

/** 人生轨迹节点（travelers.trajectory jsonb 元素：wire 键为 {age,t,d}） */
@Serializable
data class TrajectoryNode(
    /** 如 "28 岁" */
    val age: String,
    @SerialName("t") val title: String,
    @SerialName("d") val detail: String,
)

/** 旅人详情 —— 对应表 `traveler_details`（full/advice 付费解锁） */
@Serializable
data class TravelerDetail(
    @SerialName("traveler_id") val travelerId: Int,
    val age: Int? = null,
    val city: String? = null,
    @SerialName("from_role") val fromRole: String? = null,
    @SerialName("to_role") val toRole: String? = null,
    val years: String? = null,
    /** 免费可见 */
    val intro: String,
    /** 付费解锁 */
    @SerialName("full_text") val fullText: String,
    val advice: Advice,
    val result: String? = null,
    val consulted: Int? = null,
    @SerialName("response_time") val responseTime: String? = null,
) {
    val id: Int get() = travelerId

    /** 经验与建议（advice jsonb：{decision:[],ability:[],interview:[]}） */
    @Serializable
    data class Advice(
        val decision: List<String>,
        val ability: List<String>,
        val interview: List<String>,
    ) {
        fun tips(kind: AdviceKind): List<String> = when (kind) {
            AdviceKind.DECISION -> decision
            AdviceKind.ABILITY -> ability
            AdviceKind.INTERVIEW -> interview
        }
    }
}

/** 建议分类（对应原型 advice-chips：转型决策 / 能力迁移 / 求职面试） */
enum class AdviceKind(val id: String, val label: String) {
    DECISION("decision", "转型决策"),
    ABILITY("ability", "能力迁移"),
    INTERVIEW("interview", "求职面试"),
}

/** 增值服务 —— 对应表 `traveler_services` */
@Serializable
data class TravelerServiceItem(
    /** consult / materials / companion */
    val id: String,
    @SerialName("traveler_id") val travelerId: Int? = null,
    val kind: String,
    val title: String,
    val price: Double,
    val unit: String,
    val description: String,
    val tags: List<String>,
)

/**
 * 悬赏 —— 对应表 `bounties`（0007 迁移补充 tags/detail/status/created_at，
 * POST /community action=list_bounties / get_bounty 返回全字段；旧列表调用只用前四个字段）
 */
@Serializable
data class Bounty(
    val id: Int,
    val question: String,
    val reward: String,
    val responses: String,
    val tags: List<String>? = null,
    val detail: String? = null,
    val status: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
) {
    /**
     * 列表金额展示。兼容线上旧数据：
     * - 新数据/已修复数据直接从「¥29 悬赏」「29 元」提取；
     * - 三条内置种子按详情 mock 的既有金额兜底；
     * - 测试帖或未填写金额显示 ¥0。
     */
    val displayAmount: String
        get() {
            val normalized = reward.replace("￥", "¥")
            val currencyPatterns = listOf(
                Regex("""¥\s*\d+(?:\.\d{1,2})?"""),
                Regex("""\d+(?:\.\d{1,2})?\s*元"""),
            )
            for (pattern in currencyPatterns) {
                val match = pattern.find(normalized) ?: continue
                val digits = match.value.filter { it.isDigit() || it == '.' }
                if (digits.isNotEmpty()) return "¥$digits"
            }
            return when (id) {
                1 -> "¥29"
                2 -> "¥19.9"
                3 -> "¥39"
                else -> "¥0"
            }
        }

    /** 金额已在卡片底栏单独呈现；这里仅保留旧数据中的征集目标。 */
    val rewardGoal: String?
        get() {
            val trimmed = reward.trim()
            if (trimmed.isEmpty() || trimmed == "无") return null
            if (trimmed.contains("¥") || trimmed.contains("￥") || trimmed.contains("元")) return null
            return trimmed
        }
}

/** POST /community action=get_bounty 出参：悬赏详情 + 回应列表 */
@Serializable
data class BountyDetailResponse(
    val bounty: Bounty,
    val responses: List<Reply>,
) {
    /** bounty_responses 行：{id, user_id, message, created_at} */
    @Serializable
    data class Reply(
        val id: Int,
        @SerialName("user_id") val userId: String,
        val message: String,
        @SerialName("created_at") val createdAt: String? = null,
    )
}
