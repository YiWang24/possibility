package app.possibility.android.features.profile

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.possibility.android.core.AppConfig
import app.possibility.android.core.model.AdviceKind
import app.possibility.android.core.model.DemoData
import app.possibility.android.core.model.Traveler
import app.possibility.android.core.model.TravelerDetail
import app.possibility.android.core.model.TravelerServiceItem
import app.possibility.android.core.network.SupabaseService

// 旅人主页视图模型 —— 对应 ios/Possibility/Features/Profile/ProfileModel.swift。
// 轻量 Compose 状态容器：由 TravelerProfileSheet remember 持有，load() 里先兜底秒开、再静默刷新。

/** 顶部 4 个 Tab（对应 ProfileModel.Tab）。 */
enum class ProfileTab(val label: String) {
    STORY("她的故事"),
    TIMELINE("时间线"),
    ADVICE("经验与建议"),
    SERVICE("可提供服务"),
}

/** 把 ¥9.9 / ¥29 / ¥599 这类金额去掉多余的 .0 展示（对齐 iOS NSDecimalNumber.stringValue）。 */
internal fun formatPrice(value: Double): String =
    if (value % 1.0 == 0.0) value.toLong().toString() else value.toString()

class ProfileModel(val traveler: Traveler) {

    private val service: SupabaseService = SupabaseService.shared

    // 先用兜底/缓存立即渲染（页面秒开），网络返回后静默覆盖。
    var detail by mutableStateOf<TravelerDetail?>(DemoData.details[traveler.id])
        private set
    var services by mutableStateOf(DemoData.services(traveler.id))
        private set
    var unlocked by mutableStateOf(service.isUnlocked(traveler.id))
        private set
    var loading by mutableStateOf(true)
        private set

    // 交互状态
    var tab by mutableStateOf(ProfileTab.STORY)
    var adviceKind by mutableStateOf(AdviceKind.DECISION)

    /** 建议标题（对应原型 ADVICE_TITLES 首选）。 */
    val adviceTitle: String
        get() = when (adviceKind) {
            AdviceKind.DECISION -> "转型前，先做一次低成本验证"
            AdviceKind.ABILITY -> "把旧能力翻译成新岗位的优势"
            AdviceKind.INTERVIEW -> "让面试官看见真实的行动证据"
        }

    val adviceTips: List<String>
        get() = detail?.advice?.tips(adviceKind).orEmpty()

    /** 咨询价格入口（paybar 主按钮），无服务数据时兜底 AppConfig。 */
    val consultPrice: Double
        get() = services.firstOrNull { it.kind == "consult" }?.price ?: AppConfig.Price.CONSULT

    /** 拉取详情 + 服务：先兜底，再用远端结果静默刷新。 */
    suspend fun load() {
        unlocked = service.isUnlocked(traveler.id)
        detail = DemoData.details[traveler.id]
        services = DemoData.services(traveler.id)
        loading = false

        service.loadTravelerDetail(traveler.id)?.let { detail = it }
        val fresh = service.loadServices(traveler.id)
        if (fresh.isNotEmpty()) services = fresh
    }

    /** mock 解锁完整经验（¥9.9）→ 写 unlocks（§10 demo 支付）。 */
    suspend fun confirmUnlock(): Boolean {
        val ok = service.unlockProfile(traveler.id)
        if (ok) unlocked = true
        return ok
    }

    /** 付费墙成功解锁后回调：立刻置位，让锁定卡换成正文。 */
    fun markUnlocked() {
        unlocked = true
    }
}
