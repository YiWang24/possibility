package app.possibility.android.features.chat

import android.content.Context
import java.time.LocalDate

data class TarotCard(
    val id: String,
    val name: String,
    val numeral: String,
    val symbol: String,
    val light: String,
    val shadow: String,
    val action: String,
)

data class DrawnTarotCard(val card: TarotCard, val reversed: Boolean) {
    val id: String get() = card.id
    val orientation: String get() = if (reversed) "逆位" else "正位"
    val meaning: String get() = if (reversed) card.shadow else card.light
}

data class TarotReading(val question: String, val cards: List<DrawnTarotCard>, val answer: String)

enum class TarotPhase { NONE, OFFER, DRAWING, CONFIRM, RESULT, LOCKED }
enum class TarotPurchaseProduct { SUBSCRIPTION, CREDITS_15, CREDITS_100 }

enum class TarotShareChannel(val label: String, val note: String) {
    WECHAT("微信", "发给好友"),
    MOMENTS("朋友圈", "发布海报"),
    XIAOHONGSHU("小红书", "发布笔记"),
    WEIBO("微博", "分享动态"),
    OTHER("更多渠道", "打开系统分享"),
}

data class TarotQuota(
    val date: String,
    val used: Int,
    val shareRewardCount: Int,
    val purchasedCredits: Int,
    val subscriptionActive: Boolean,
) {
    val remaining: Int
        get() = if (subscriptionActive) Int.MAX_VALUE
        else (DAILY_LIMIT + shareRewardCount - used).coerceAtLeast(0) + purchasedCredits
    val remainingLabel: String get() = if (subscriptionActive) "包月不限次" else "$remaining 次"

    companion object { const val DAILY_LIMIT = 3 }
}

class TarotQuotaStore(context: Context) {
    private val preferences = context.getSharedPreferences("possibility_tarot_quota_v1", Context.MODE_PRIVATE)

    fun load(): TarotQuota {
        val today = LocalDate.now().toString()
        if (preferences.getString("date", null) != today) {
            return TarotQuota(today, 0, 0, 0, false).also(::save)
        }
        return TarotQuota(
            date = today,
            used = preferences.getInt("used", 0).coerceAtLeast(0),
            shareRewardCount = preferences.getInt("share_rewards", 0).coerceAtLeast(0),
            purchasedCredits = preferences.getInt("credits", 0).coerceAtLeast(0),
            subscriptionActive = preferences.getBoolean("subscription", false),
        )
    }

    fun consume(current: TarotQuota): Pair<Boolean, TarotQuota> {
        if (current.remaining <= 0) return false to current
        if (current.subscriptionActive) return true to current
        val updated = if (current.used < TarotQuota.DAILY_LIMIT + current.shareRewardCount) {
            current.copy(used = current.used + 1)
        } else {
            current.copy(purchasedCredits = (current.purchasedCredits - 1).coerceAtLeast(0))
        }
        save(updated)
        return true to updated
    }

    fun rewardShare(current: TarotQuota): TarotQuota =
        current.copy(shareRewardCount = current.shareRewardCount + 1).also(::save)

    fun purchase(current: TarotQuota, product: TarotPurchaseProduct): TarotQuota {
        val updated = when (product) {
            TarotPurchaseProduct.SUBSCRIPTION -> current.copy(subscriptionActive = true)
            TarotPurchaseProduct.CREDITS_15 -> current.copy(purchasedCredits = current.purchasedCredits + 15)
            TarotPurchaseProduct.CREDITS_100 -> current.copy(purchasedCredits = current.purchasedCredits + 100)
        }
        save(updated)
        return updated
    }

    private fun save(value: TarotQuota) {
        preferences.edit()
            .putString("date", value.date)
            .putInt("used", value.used)
            .putInt("share_rewards", value.shareRewardCount)
            .putInt("credits", value.purchasedCredits)
            .putBoolean("subscription", value.subscriptionActive)
            .apply()
    }
}

object TarotEngine {
    val positions = listOf("现状", "核心阻力", "行动走向")

    fun isUnclearQuestion(question: String): Boolean {
        val clean = question.trim().replace(Regex("[？?。！!，,]"), "")
        if (clean.length < 4) return true
        return clean in setOf("怎么办", "怎么选", "帮我看看", "我该怎么办", "给个建议", "你觉得呢", "看看未来")
    }

    fun candidates(count: Int = 12): List<DrawnTarotCard> =
        deck.shuffled().take(count).map { DrawnTarotCard(it, listOf(true, false).random()) }

    fun reading(question: String, cards: List<DrawnTarotCard>): TarotReading {
        if (cards.size != 3) return TarotReading(question, cards, "需要抽取三张牌后才能开始分析。")
        val (present, friction, direction) = cards
        val lens = questionLens(question)
        val tone = if (direction.reversed) "尚未稳定，需要先处理阻力" else "存在向前展开的空间"
        val answer = """
            先说结论：$tone，但这不是对未来的保证。${lens.first}。

            三张牌把问题放在三个位置上：「${present.card.name}${if (present.reversed) "·逆位" else ""}」显示当下更接近${present.meaning}；「${friction.card.name}${if (friction.reversed) "·逆位" else ""}」提醒核心卡点可能是${friction.meaning}；「${direction.card.name}${if (direction.reversed) "·逆位" else ""}」把行动走向指向${direction.meaning}。

            把牌意落回现实：${direction.card.action}，并${lens.second}。等到这条证据出现，再判断“会不会”会更可靠。
        """.trimIndent()
        return TarotReading(question, cards, answer)
    }

    private fun questionLens(question: String): Pair<String, String> = when {
        Regex("创业|事业|工作|转行|升职|项目|生意").containsMatchIn(question) ->
            "这件事更取决于资源、节奏和验证，而不是一张“必成或必败”的判决" to
                "先用真实客户、现金流或作品反馈验证最关键的商业假设"
        Regex("感情|恋爱|复合|结婚|对方|关系").containsMatchIn(question) ->
            "关系的走向取决于双方真实行动，牌面只能帮你看见自己的期待与盲区" to
                "观察一次具体沟通后的回应、边界和持续行动"
        Regex("考试|考研|录取|上岸|申请|面试").containsMatchIn(question) ->
            "结果仍由准备质量和外部标准共同决定，牌面提示的是当前策略" to
                "用一次模拟成绩或真实反馈检查最薄弱的一环"
        else -> "未来没有被牌面写死，这组象征更适合用来照见你的期待、风险和下一步" to
            "选择一个七天内可完成、结果可观察的小行动"
    }

    private val deck = listOf(
        TarotCard("fool", "愚者", "0", "✦", "新的尝试与开放性", "准备不足、只凭冲动", "先做一个可撤回的小实验"),
        TarotCard("magician", "魔术师", "I", "∞", "资源正在聚拢", "高估掌控力或包装", "列出手上真正可调用的三项资源"),
        TarotCard("priestess", "女祭司", "II", "☾", "安静观察与直觉", "关键信息仍藏在水面下", "先补一条最影响判断的事实"),
        TarotCard("empress", "皇后", "III", "❋", "滋养、增长与创造", "投入过多而缺少边界", "给成长设一个明确的资源上限"),
        TarotCard("emperor", "皇帝", "IV", "◇", "结构、秩序与执行", "过度控制或路径僵化", "把目标拆成可检查的里程碑"),
        TarotCard("hierophant", "教皇", "V", "✥", "经验、规则与可信指引", "被惯例和他人答案束缚", "找一位走过此路的人核对现实"),
        TarotCard("lovers", "恋人", "VI", "♡", "价值一致后的选择", "想同时保住所有可能", "先写下你最不愿交换掉的价值"),
        TarotCard("chariot", "战车", "VII", "➹", "方向明确、主动推进", "速度盖过了风险检查", "推进前设一个停止条件"),
        TarotCard("strength", "力量", "VIII", "♢", "稳定的韧性与耐心", "用硬撑代替真实调整", "把最消耗你的环节先减半"),
        TarotCard("hermit", "隐者", "IX", "⌁", "独立思考与内在校准", "信息闭环、越想越窄", "独处判断后再找外部证据复核"),
        TarotCard("wheel", "命运之轮", "X", "◌", "窗口变化、出现转机", "把偶然当成必然", "准备好机会出现时的触发动作"),
        TarotCard("justice", "正义", "XI", "⚖", "权衡、因果与边界", "只看对错，忽略真实代价", "用同一组标准比较收益与代价"),
        TarotCard("hanged", "倒吊人", "XII", "⌛", "换视角、暂缓有价值", "停滞被包装成等待", "为等待设置截止日与观察指标"),
        TarotCard("death", "死神", "XIII", "✧", "旧阶段结束后的更新", "抗拒必要的告别", "明确停止什么，才有空间开始什么"),
        TarotCard("temperance", "节制", "XIV", "≈", "整合、调配与渐进", "妥协过多导致方向模糊", "设计一个两边都能验证的过渡方案"),
        TarotCard("devil", "恶魔", "XV", "△", "看见欲望与现实牵引", "被恐惧、利益或执念绑住", "指出你最难承认的那项代价"),
        TarotCard("tower", "高塔", "XVI", "ϟ", "打破失真的旧假设", "突发变化与脆弱基础", "先检查最可能让计划失效的前提"),
        TarotCard("star", "星星", "XVII", "☆", "希望、方向感与恢复", "愿景尚未落到现实", "把愿景变成未来七天的一次行动"),
        TarotCard("moon", "月亮", "XVIII", "☽", "感受敏锐、梦境与想象", "焦虑让信号变得失真", "把事实、猜测和担心分成三列"),
        TarotCard("sun", "太阳", "XIX", "☼", "清晰、活力与可见成果", "过度乐观、忽略维护成本", "趁动力充足完成一个可展示成果"),
        TarotCard("judgement", "审判", "XX", "⌃", "复盘后的召唤与决定", "反复等待外界替你确认", "用过去的证据为自己做一次判断"),
        TarotCard("world", "世界", "XXI", "◎", "整合、完成与进入新周期", "执着完美收尾才肯开始", "定义何时算完成，然后进入下一步"),
    )
}
