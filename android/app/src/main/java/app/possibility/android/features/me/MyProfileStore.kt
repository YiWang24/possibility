package app.possibility.android.features.me

import android.content.Context
import android.content.SharedPreferences
import app.possibility.android.core.model.MyProfile
import app.possibility.android.core.model.ProfileFact
import app.possibility.android.core.model.RemotePublicProfile
import app.possibility.android.core.network.SupabaseService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString

// MARK: - 我的主页 Store（对应 ios/Possibility/Features/Me/MeModel.swift）
//
// 本地 SharedPreferences 缓存作为离线兜底先渲染；1.5s 防抖后把公开字段同步到 public_profiles。
// 远端 public_profile 用 MyProfile.merging 合并覆盖本地。进程级单例，供 Me 主页 / 编辑 / 隐私中心共享同一份状态。

/**
 * 动态画像单条展示项（对应 iOS MeModel.PersonaItem）。
 * 我的公开主页只展示逐条标记为 public 的事实。
 */
data class PersonaItem(
    val key: String,
    val label: String,
    val value: String,
    val glyph: String,
    /** 0xRRGGBB 色相提示 */
    val tint: Long,
    val cards: List<LifeCard> = emptyList(),
) {
    val hasResult: Boolean
        get() = value.isNotEmpty() && !value.contains("尚未")
}

/** 人生底牌卡（公开事实映射） */
data class LifeCard(val glyph: String, val name: String)

object MyProfileStore {

    // v2 有意忽略原型预填的 v1 缓存
    private const val STORE_KEY = "kaleido_my_profile_v2"
    private const val PENDING_SYNC_KEY = "kaleido_my_profile_pending_sync_v2"

    private val json = SupabaseService.json
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private lateinit var prefs: SharedPreferences
    private var bound = false

    private val _profile = MutableStateFlow(MyProfile.defaultProfile)
    val profile: StateFlow<MyProfile> = _profile.asStateFlow()

    private val _facts = MutableStateFlow<List<ProfileFact>>(emptyList())
    val facts: StateFlow<List<ProfileFact>> = _facts.asStateFlow()

    private var remoteSaveJob: Job? = null

    /** 首次进入主页时绑定应用上下文并加载本地缓存（幂等）。 */
    fun bind(context: Context) {
        if (bound) return
        prefs = context.applicationContext.getSharedPreferences("kaleido_prefs", Context.MODE_PRIVATE)
        _profile.value = loadLocal()
        bound = true
    }

    private fun loadLocal(): MyProfile {
        val raw = prefs.getString(STORE_KEY, null) ?: return MyProfile.defaultProfile
        return runCatching { json.decodeFromString<MyProfile>(raw) }.getOrDefault(MyProfile.defaultProfile)
    }

    private fun persistLocally(updated: MyProfile) {
        runCatching { prefs.edit().putString(STORE_KEY, json.encodeToString(updated)).apply() }
    }

    // MARK: 编辑保存（草稿整体写回）

    /** 编辑页保存：更新内存 + 本地持久化 + 标记待同步 + 1.5s 防抖上云。 */
    fun update(draft: MyProfile) {
        _profile.value = draft
        persistLocally(draft)
        prefs.edit().putBoolean(PENDING_SYNC_KEY, true).apply()
        scheduleRemoteSave(draft)
    }

    private fun scheduleRemoteSave(updated: MyProfile) {
        remoteSaveJob?.cancel()
        remoteSaveJob = scope.launch {
            delay(1_500)
            runCatching { SupabaseService.shared.savePublicProfileRemote(updated) }
                .onSuccess { prefs.edit().putBoolean(PENDING_SYNC_KEY, false).apply() }
            // 失败保留 pending 标记，下次进入主页自动补传。
        }
    }

    /** 立即把当前公开主页推上云（取消未触发的防抖任务）。 */
    suspend fun flush() {
        remoteSaveJob?.cancel()
        runCatching { SupabaseService.shared.savePublicProfileRemote(_profile.value) }
            .onSuccess { prefs.edit().putBoolean(PENDING_SYNC_KEY, false).apply() }
    }

    // MARK: 云端同步（真实数据优先，静默兜底）

    /** 补传待同步草稿 → 拉云端 public_profile 合并刷新 → 应用画像事实。 */
    suspend fun syncFromRemote() {
        if (prefs.getBoolean(PENDING_SYNC_KEY, false)) {
            val sent = runCatching { SupabaseService.shared.savePublicProfileRemote(_profile.value) }.isSuccess
            if (sent) prefs.edit().putBoolean(PENDING_SYNC_KEY, false).apply() else return
        }
        val remote = runCatching { SupabaseService.shared.fetchRemoteProfile() }.getOrNull() ?: return
        remote.publicProfile?.let { applyRemote(it) }
        _facts.value = remote.facts.orEmpty()
    }

    /** 隐私中心改动可见性后刷新事实（强制拉取，跳过 TTL 缓存）。 */
    suspend fun refreshFacts() {
        val remote = runCatching { SupabaseService.shared.fetchRemoteProfile(force = true) }.getOrNull() ?: return
        _facts.value = remote.facts.orEmpty()
    }

    private fun applyRemote(publicProfile: RemotePublicProfile) {
        val merged = _profile.value.merging(publicProfile)
        if (merged != _profile.value) {
            _profile.value = merged
            persistLocally(merged)
        }
    }

    /** 隐私中心清空全部画像后同步清理内存镜像；主页基础资料不受影响。 */
    fun clearProfileCache() {
        _facts.value = emptyList()
    }

    fun clearDimensionCache(dimension: String) {
        _facts.value = _facts.value.filter { it.dimension != dimension }
    }

    // MARK: 动态画像展示项

    /** 我的公开主页只展示逐条标记为 public 的事实。 */
    fun personaItems(facts: List<ProfileFact>): List<PersonaItem> {
        val publicFacts = facts.filter { it.visibility == "public" }
        val grouped = publicFacts.groupBy { it.dimension }
        fun value(dimension: String): String =
            grouped[dimension]?.joinToString(" · ") { it.value } ?: "尚未公开"
        val lifeCards = (grouped["life"] ?: emptyList()).take(3).map { LifeCard(glyph = "◆", name = it.value) }
        return listOf(
            PersonaItem("personality", "人格底色", value("personality"), "◎", 0x5968D9),
            PersonaItem("skill", "我擅长", value("skill"), "✦", 0x5E96FF),
            PersonaItem("like", "我喜欢", value("like"), "♡", 0xE35CC1),
            PersonaItem("love", "我在恋爱关系中在意", value("love"), "✿", 0xFF7A4D),
            PersonaItem("family", "我在家庭关系中在意", value("family"), "⌂", 0x3ED9A4),
            PersonaItem("social", "我在人际交往中在意", value("social"), "◎", 0x5E96FF),
            PersonaItem("life", "我的人生底牌", value("life"), "◇", 0x8F7BFF, lifeCards),
        )
    }
}
