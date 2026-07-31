package app.possibility.android.core.network

import app.possibility.android.core.AppConfig
import app.possibility.android.core.model.AIContextDisclosure
import app.possibility.android.core.model.Bounty
import app.possibility.android.core.model.BountyDetailResponse
import app.possibility.android.core.model.CardGameAcceptedEvent
import app.possibility.android.core.model.CardGameCardPayload
import app.possibility.android.core.model.CardGameCatalogEnvelope
import app.possibility.android.core.model.CardGameManifestResponse
import app.possibility.android.core.model.CardGameSyncAction
import app.possibility.android.core.model.CardGameTradedEvent
import app.possibility.android.core.model.ChatMessage
import app.possibility.android.core.model.Conversation
import app.possibility.android.core.model.DiaryAnalysis
import app.possibility.android.core.model.DiarySummaryResponse
import app.possibility.android.core.model.LabChoiceResponse
import app.possibility.android.core.model.LenientFieldSerializer
import app.possibility.android.core.model.MatchQuery
import app.possibility.android.core.model.MatchResponse
import app.possibility.android.core.model.MyProfile
import app.possibility.android.core.model.PersonaJob
import app.possibility.android.core.model.ProfileFact
import app.possibility.android.core.model.ProfilePrivacySnapshot
import app.possibility.android.core.model.RemoteCardGame
import app.possibility.android.core.model.RemoteCardGameSession
import app.possibility.android.core.model.RemoteConversation
import app.possibility.android.core.model.RemotePublicProfile
import app.possibility.android.core.model.SimulationHorizon
import app.possibility.android.core.model.SimulationResult
import app.possibility.android.core.model.Traveler
import app.possibility.android.core.model.TravelerDetail
import app.possibility.android.core.model.TravelerServiceItem
import app.possibility.android.core.model.Unlock
import app.possibility.android.core.model.UserProfile
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.providers.builtin.OTP
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.timeout
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put

// Supabase 封装：邮箱密码 Auth、Postgres 读写（受 RLS 约束）、mock 解锁、Edge Function 调用。
// 对应 ios/Possibility/Core/Network/SupabaseService.swift。

/** 会话缺失（未登录或已过期） */
class NotSignedInError : Exception("登录已过期，请重新登录")

/** 注册成功但未直接拿到会话（线上开启了邮箱确认） */
class EmailConfirmationRequired : Exception("注册成功，请查收确认邮件并完成验证后登录")

/**
 * Edge Function 返回的业务错误：{"error":{"code","message"},"request_id"}。
 * 携带后端 message，让 UI/日志能区分「限流 / 上游 AI 不可用 / 参数错误」而非笼统的网络失败。
 */
class EdgeFunctionError(
    val code: String?,
    override val message: String,
    val requestId: String?,
    val statusCode: Int,
) : Exception(message)

/** GET /get-profile：云端画像全量出参，事实表是唯一画像内容来源。 */
@Serializable
data class RemoteProfile(
    @SerialName("portrait_pct") val portraitPct: Int,
    @SerialName("profile_revision") val profileRevision: Int = 0,
    val verification: Verification = Verification(),
    @Serializable(with = LenientProfileFactListSerializer::class)
    val facts: List<ProfileFact>? = null,
    /** card_game_results 行：[{kind, final_cards, rounds, accepted, traded}] */
    @SerialName("card_games")
    @Serializable(with = LenientRemoteCardGameListSerializer::class)
    val cardGames: List<RemoteCardGame>? = null,
    /** public_profiles 行（未建档为 null） */
    @SerialName("public_profile")
    @Serializable(with = LenientRemotePublicProfileSerializer::class)
    val publicProfile: RemotePublicProfile? = null,
) {
    @Serializable
    data class Verification(
        val status: String = "unverified",
        val provider: String? = null,
        @SerialName("verified_at") val verifiedAt: String? = null,
    )
}

object LenientProfileFactListSerializer : LenientFieldSerializer<List<ProfileFact>>(
    kotlinx.serialization.builtins.ListSerializer(ProfileFact.serializer())
)

object LenientRemoteCardGameListSerializer : LenientFieldSerializer<List<RemoteCardGame>>(
    kotlinx.serialization.builtins.ListSerializer(RemoteCardGame.serializer())
)

object LenientRemotePublicProfileSerializer :
    LenientFieldSerializer<RemotePublicProfile>(RemotePublicProfile.serializer())

/** POST /list-diary 出参条目（analyze-diary 落库的云端真实日记） */
@Serializable
data class RemoteDiaryEntry(
    val id: Long,
    @SerialName("entry_id") val entryId: String? = null,
    val status: String? = null,
    @SerialName("recorded_at") val recordedAt: String? = null,
    @SerialName("local_date") val localDate: String? = null,
    @SerialName("has_audio") val hasAudio: Boolean = false,
    @SerialName("duration_ms") val durationMs: Long? = null,
    val transcript: String? = null,
    val title: String? = null,
    @SerialName("entry_summary") val entrySummary: String? = null,
    val emotions: List<String>? = null,
    val keywords: List<String>? = null,
    @SerialName("created_at") val createdAt: String = "",
)

/** POST /list-conversations 出参 */
@Serializable
data class ConversationPage(
    val conversations: List<RemoteConversation>,
    val total: Int,
)

/** POST /community action=list_bounties 出参 */
@Serializable
data class BountyPage(
    val bounties: List<Bounty>,
    val total: Int,
)

/** POST /community action=kaleidoscope_draw 出参（拍平后） */
data class KaleidoscopeDraw(val travelerId: Int, val reason: String)

class SupabaseService(val supabase: SupabaseClient) {

    companion object {
        /**
         * 由 PossibilityApp 在 onCreate 创建并持有；其余模块经此访问。
         */
        lateinit var shared: SupabaseService
            private set

        fun init(client: SupabaseClient): SupabaseService {
            shared = SupabaseService(client)
            return shared
        }

        /** 宽容 JSON：忽略未知键、省略 null、null 强转默认值；encodeDefaults 保证 action 常量字段上行 */
        val json: Json = Json {
            ignoreUnknownKeys = true
            explicitNulls = false
            coerceInputValues = true
            encodeDefaults = true
        }

        private val prettyJson: Json = Json(json) { prettyPrint = true }

        /** 裸 HTTP 客户端（Edge Function 直连 + SSE 共用） */
        val httpClient: HttpClient by lazy {
            HttpClient(OkHttp) {
                install(HttpTimeout) {
                    // simulate/match 的结构化生成可达 2 分钟以上，默认 60s 会提前断开
                    requestTimeoutMillis = 180_000
                    connectTimeoutMillis = 30_000
                    socketTimeoutMillis = 180_000
                }
                expectSuccess = false
            }
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    // MARK: - 会话状态

    private val _isReady = MutableStateFlow(false)
    val isReady: StateFlow<Boolean> = _isReady.asStateFlow()

    private val _isAuthenticated = MutableStateFlow(false)
    /** 是否已登录 —— 匿名模式已停用，根视图据此在登录墙与主界面之间分流 */
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    private val _userId = MutableStateFlow<String?>(null)
    val userId: StateFlow<String?> = _userId.asStateFlow()

    private val _lastError = MutableStateFlow<String?>(null)
    val lastError: StateFlow<String?> = _lastError.asStateFlow()

    val currentUserId: String?
        get() = supabase.auth.currentUserOrNull()?.id ?: _userId.value

    /** 当前账号邮箱（Me 页展示） */
    val emailDisplay: String?
        get() = supabase.auth.currentUserOrNull()?.email?.takeIf { it.isNotEmpty() }

    // MARK: - 服务端状态缓存

    private val _travelers = MutableStateFlow<List<Traveler>>(emptyList())
    val travelers: StateFlow<List<Traveler>> = _travelers.asStateFlow()

    private val travelerDetails = mutableMapOf<Int, TravelerDetail>()

    private val _services = MutableStateFlow<List<TravelerServiceItem>>(emptyList())
    val services: StateFlow<List<TravelerServiceItem>> = _services.asStateFlow()

    private val _bounties = MutableStateFlow<List<Bounty>>(emptyList())
    val bounties: StateFlow<List<Bounty>> = _bounties.asStateFlow()

    private val _profile = MutableStateFlow<UserProfile?>(null)
    val profile: StateFlow<UserProfile?> = _profile.asStateFlow()

    private val _unlockedProfileIds = MutableStateFlow<Set<Int>>(emptySet())
    val unlockedProfileIds: StateFlow<Set<Int>> = _unlockedProfileIds.asStateFlow()

    init {
        // 监听会话变化（换账号 / 登出 / 刷新 token），保持 userId 与 UI 同步
        scope.launch {
            supabase.auth.sessionStatus.collect { status ->
                when (status) {
                    is SessionStatus.Authenticated -> {
                        _userId.value = status.session.user?.id
                        _isAuthenticated.value = true
                    }
                    is SessionStatus.NotAuthenticated -> {
                        // 登出时 userId 必须跟着置空：留着旧 id 会让 RLS 查询必然失败
                        _userId.value = null
                        _isAuthenticated.value = false
                    }
                    else -> Unit
                }
            }
        }
    }

    // MARK: - 启动：恢复会话 + 预取

    /** 冷启动。没有会话就停在 isReady 上，由根视图切登录墙。 */
    suspend fun bootstrap() {
        supabase.auth.awaitInitialization()
        val session = supabase.auth.currentSessionOrNull()
        if (session != null) {
            _userId.value = session.user?.id
            _isAuthenticated.value = true
            prefetchAll()
        }
        _isReady.value = true
    }

    /** 预取公开内容 + 用户侧数据（需要有效会话） */
    private suspend fun prefetchAll() = coroutineScope {
        listOf(
            async { loadTravelers() },
            async { loadBounties() },
            async { loadProfile() },
            async { loadUnlocks() },
        ).awaitAll()
    }

    /** 当前 JWT（ChatStreamClient / callFunction 用）。没有会话直接抛，让登录墙接管。 */
    suspend fun jwt(): String {
        val session = supabase.auth.currentSessionOrNull() ?: throw NotSignedInError()
        return session.accessToken
    }

    // MARK: - 登录（邮箱密码）

    /**
     * 邮箱注册。邮箱确认关闭时注册即登录；开启时 session 为空，抛 [EmailConfirmationRequired]。
     * @return 随后那封验证信是否发出（发信失败只改提示措辞，不影响注册结果）。
     */
    suspend fun signUp(email: String, password: String): Boolean {
        supabase.auth.signUpWith(Email) {
            this.email = email
            this.password = password
        }
        if (supabase.auth.currentSessionOrNull() == null) throw EmailConfirmationRequired()
        completeSignIn()
        return sendVerificationEmail(email)
    }

    /**
     * 补发一封邮箱验证链接（OTP magic_link 模板；shouldCreateUser=false 杜绝凭空建号）。
     * 不抛错：限流等失败不值得打断一个已经登录成功的用户。
     */
    suspend fun sendVerificationEmail(email: String): Boolean = runCatching {
        supabase.auth.signInWith(OTP) {
            this.email = email
            createUser = false
        }
    }.isSuccess

    /** 邮箱密码登录 */
    suspend fun signIn(email: String, password: String) {
        supabase.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
        completeSignIn()
    }

    /** 登录成功后的统一收尾：会话状态 → 全量预取 */
    private suspend fun completeSignIn() {
        val user = supabase.auth.currentUserOrNull()
        _userId.value = user?.id
        _isAuthenticated.value = user != null
        invalidateRemoteProfileCache()
        prefetchAll()
    }

    /** 退出登录：清空会话与本地缓存（根视图自动切回登录墙） */
    suspend fun signOut() {
        runCatching { supabase.auth.signOut() }
        resetUserCaches()
    }

    /** 注销账号：服务端删除 auth 用户（业务表级联清理）后本地登出 */
    suspend fun deleteAccount() {
        callFunction<OkResponse>("delete-account", buildJsonObject {})
        signOut()
    }

    private fun resetUserCaches() {
        _userId.value = null
        _isAuthenticated.value = false
        _profile.value = null
        _unlockedProfileIds.value = emptySet()
        invalidateRemoteProfileCache()
    }

    // MARK: - 公开内容（PostgREST 直读；是否展示离线样例由具体页面显式决定）

    suspend fun loadTravelers() {
        try {
            val rows = supabase.from("travelers")
                .select { order("id", Order.ASCENDING) }
                .decodeList<Traveler>()
            _travelers.value = rows
        } catch (e: Exception) {
            _lastError.value = e.message
            _travelers.value = emptyList()
        }
    }

    /** 把实时生成/新拉取的旅人按 id 去重合并进缓存，并按 id 排序。 */
    fun mergeTravelers(incoming: List<Traveler>) {
        if (incoming.isEmpty()) return
        val byId = _travelers.value.associateBy { it.id }.toMutableMap()
        incoming.forEach { byId[it.id] = it }
        _travelers.value = byId.values.sortedBy { it.id }
    }

    suspend fun loadTravelerDetail(id: Int): TravelerDetail? {
        travelerDetails[id]?.let { return it }
        return try {
            val detail = supabase.from("traveler_details")
                .select { filter { eq("traveler_id", id) } }
                .decodeSingle<TravelerDetail>()
            travelerDetails[id] = detail
            detail
        } catch (e: Exception) {
            _lastError.value = e.message
            null
        }
    }

    suspend fun loadServices(travelerId: Int): List<TravelerServiceItem> {
        return try {
            val items = supabase.from("traveler_services")
                .select { filter { eq("traveler_id", travelerId) } }
                .decodeList<TravelerServiceItem>()
            _services.value = items
            items
        } catch (e: Exception) {
            _lastError.value = e.message
            emptyList<TravelerServiceItem>().also { _services.value = it }
        }
    }

    suspend fun loadBounties() {
        try {
            val rows = supabase.from("bounties")
                .select { order("created_at", Order.DESCENDING) }
                .decodeList<Bounty>()
            _bounties.value = rows
        } catch (e: Exception) {
            _lastError.value = e.message
            _bounties.value = emptyList()
        }
    }

    // MARK: - 用户数据（RLS：仅本人）

    suspend fun loadProfile() {
        val uid = currentUserId ?: return
        _profile.value = try {
            supabase.from("profiles")
                .select { filter { eq("id", uid) } }
                .decodeSingle<UserProfile>()
        } catch (e: Exception) {
            // 首次进入没有 profile 行：本地兜底，后续 upsert
            UserProfile(id = uid, portraitPct = AppConfig.Threshold.PORTRAIT_INITIAL_PCT)
        }
    }

    suspend fun saveProfile(p: UserProfile) {
        try {
            supabase.from("profiles").upsert(p)
            _profile.value = p
        } catch (e: Exception) {
            _lastError.value = e.message
        }
    }

    suspend fun createConversation(topic: String): Conversation? {
        val uid = currentUserId ?: return null
        return try {
            supabase.from("conversations")
                .insert(buildJsonObject {
                    put("user_id", uid)
                    put("topic", topic)
                }) { select() }
                .decodeSingle<Conversation>()
        } catch (e: Exception) {
            _lastError.value = e.message
            null
        }
    }

    suspend fun loadMessages(conversationId: String): List<ChatMessage> {
        return try {
            supabase.from("messages")
                .select {
                    filter { eq("conversation_id", conversationId) }
                    order("id", Order.ASCENDING)
                }
                .decodeList<ChatMessage>()
        } catch (e: Exception) {
            _lastError.value = e.message
            emptyList()
        }
    }

    // MARK: - 解锁（demo mock 支付：直接写 unlocks）

    @Serializable
    private data class UnlockRow(
        val kind: String,
        @SerialName("target_id") val targetId: String,
    )

    suspend fun loadUnlocks() {
        val uid = currentUserId ?: return
        try {
            val rows = supabase.from("unlocks")
                .select(columns = Columns.list("kind", "target_id")) {
                    filter { eq("user_id", uid) }
                }
                .decodeList<UnlockRow>()
            _unlockedProfileIds.value = rows
                .filter { it.kind == "profile" }
                .mapNotNull { it.targetId.toIntOrNull() }
                .toSet()
        } catch (e: Exception) {
            _lastError.value = e.message
        }
    }

    fun isUnlocked(travelerId: Int): Boolean = travelerId in _unlockedProfileIds.value

    /** mock 解锁完整经验（¥9.9）：INSERT unlocks → 本地标记 */
    suspend fun unlockProfile(travelerId: Int): Boolean {
        val uid = currentUserId ?: return false
        val record = Unlock(
            userId = uid,
            kind = Unlock.Kind.PROFILE,
            targetId = travelerId.toString(),
            amount = AppConfig.Price.UNLOCK_PROFILE,
        )
        return try {
            supabase.from("unlocks").insert(record)
            _unlockedProfileIds.value = _unlockedProfileIds.value + travelerId
            true
        } catch (e: Exception) {
            _lastError.value = e.message
            false
        }
    }

    // MARK: - Edge Functions 通用调用（裸 HTTP，头与 iOS 完全一致）

    /**
     * 通用 JSON POST 到 Edge Function（带 JWT + apikey + X-Request-ID）。
     * 非 2xx 解析统一错误体 {error:{code,message},request_id} 抛 [EdgeFunctionError]。
     */
    suspend fun callFunctionRaw(name: String, payload: String, timeoutMillis: Long = 180_000): String {
        val requestId = UUID.randomUUID().toString()
        val response = httpClient.post(AppConfig.functionUrl(name)) {
            timeout {
                requestTimeoutMillis = timeoutMillis
                socketTimeoutMillis = timeoutMillis
            }
            contentType(ContentType.Application.Json)
            header(HttpHeaders.Authorization, "Bearer ${jwt()}")
            header("apikey", AppConfig.supabaseAnonKey)
            header("X-Request-ID", requestId)
            setBody(payload)
        }
        val text = response.bodyAsText()
        if (!response.status.isSuccess()) {
            throw parseEdgeError(text, response.status.value)
        }
        return text
    }

    suspend inline fun <reified Out> callFunction(name: String, body: JsonObject): Out =
        json.decodeFromString(callFunctionRaw(name, body.toString()))

    @Serializable
    private data class EdgeErrorBody(
        val error: Inner? = null,
        @SerialName("request_id") val requestId: String? = null,
    ) {
        @Serializable
        data class Inner(val code: String? = null, val message: String? = null)
    }

    private fun parseEdgeError(body: String, statusCode: Int): EdgeFunctionError {
        val parsed = runCatching { json.decodeFromString<EdgeErrorBody>(body) }.getOrNull()
        return EdgeFunctionError(
            code = parsed?.error?.code,
            message = parsed?.error?.message ?: "服务暂时不可用（HTTP $statusCode）",
            requestId = parsed?.requestId,
            statusCode = statusCode,
        )
    }

    @Serializable
    data class OkResponse(val ok: Boolean = false)

    // MARK: - Edge Functions（非流式：match / simulate / analyze-diary）

    /** POST /match：3 位结局不同旅人 + 匹配理由 */
    suspend fun match(userState: MatchQuery): MatchResponse =
        callFunction("match", buildJsonObject {
            put("user_state", json.encodeToJsonElement(userState))
        })

    /**
     * POST /simulate 完整出参：{scenarios, bottom_line_analysis, recommended_traveler_ids}
     * @param carryCards 底线卡（最多 6 张，validate.ts validateSimulateInputV2）
     */
    suspend fun simulateFull(
        question: String,
        choice: String,
        horizon: SimulationHorizon,
        carryCards: List<String>? = null,
    ): SimulationResult =
        callFunction("simulate", buildJsonObject {
            put("question", question)
            put("choice", choice)
            // 短期档位 years 固定 1 兼容旧接口，实际跨度由 time_horizon 传中文标签
            put("years", horizon.apiYears)
            put("time_horizon", horizon.label)
            carryCards?.let { put("carry_cards", json.encodeToJsonElement(it)) }
        })

    /** POST /analyze-diary：情绪 + 关键词 */
    suspend fun analyzeDiary(transcript: String, inputMethod: String): DiaryAnalysis =
        callFunction("analyze-diary", buildJsonObject {
            put("transcript", transcript)
            put("input_method", inputMethod)
        })

    // MARK: - Edge Functions（日记 / 会话列表）

    @Serializable
    private data class DiaryListResponse(val entries: List<RemoteDiaryEntry>)

    /** POST /list-diary：云端真实日记条目（analyze-diary 落库） */
    suspend fun listDiary(limit: Int = 50, offset: Int = 0): List<RemoteDiaryEntry> =
        callFunction<DiaryListResponse>("list-diary", buildJsonObject {
            put("limit", limit)
            put("offset", offset)
        }).entries

    /**
     * POST /diary-summary：按月/年聚合日记 + LLM 洞察
     * @param period "month" | "year"
     * @param ref 月为 "2026-07"，年为 "2026"
     */
    suspend fun diarySummary(period: String, ref: String): DiarySummaryResponse =
        callFunction("diary-summary", buildJsonObject {
            put("period", period)
            put("ref", ref)
        })

    /** POST /list-conversations：历史会话分页（created_at 倒序） */
    suspend fun listConversations(limit: Int = 20, offset: Int = 0): ConversationPage =
        callFunction("list-conversations", buildJsonObject {
            put("limit", limit)
            put("offset", offset)
        })

    // MARK: - Edge Functions（persona / lab-choices）

    /** POST /persona action=generate：按已授权画像生成数字形象（status 通常直接 completed） */
    suspend fun personaGenerate(promptOverride: String? = null): PersonaJob =
        callFunction("persona", buildJsonObject {
            put("action", "generate")
            promptOverride?.let { put("prompt_override", it) }
        })

    /** POST /persona action=status：查询生成任务状态（与 generate 同构出参） */
    suspend fun personaStatus(jobId: String): PersonaJob =
        callFunction("persona", buildJsonObject {
            put("action", "status")
            put("job_id", jobId)
        })

    /** POST /lab-choices：人生实验室动态选择卡（{cards, rationale}） */
    suspend fun labChoices(
        question: String,
        topic: String? = null,
        constraints: List<String>? = null,
        previousChoices: List<String>? = null,
    ): LabChoiceResponse =
        callFunction("lab-choices", buildJsonObject {
            put("question", question)
            topic?.let { put("topic", it) }
            constraints?.let { put("constraints", json.encodeToJsonElement(it)) }
            previousChoices?.let { put("previous_choices", json.encodeToJsonElement(it)) }
        })

    // MARK: - get-profile（60s TTL 会话缓存；写路径成功后失效）

    private var remoteProfileCache: Pair<RemoteProfile, Long>? = null
    private val remoteProfileCacheTtlMillis = 60_000L

    fun invalidateRemoteProfileCache() {
        remoteProfileCache = null
    }

    /** GET /get-profile：云端画像全量出参（60s TTL 内存缓存，对调用方透明） */
    suspend fun fetchRemoteProfile(force: Boolean = false): RemoteProfile {
        if (!force) {
            remoteProfileCache?.let { (cached, fetchedAt) ->
                if (System.currentTimeMillis() - fetchedAt < remoteProfileCacheTtlMillis) return cached
            }
        }
        val response = httpClient.get(AppConfig.functionUrl("get-profile")) {
            timeout {
                requestTimeoutMillis = 20_000
                socketTimeoutMillis = 20_000
            }
            header(HttpHeaders.Authorization, "Bearer ${jwt()}")
            header("apikey", AppConfig.supabaseAnonKey)
        }
        val text = response.bodyAsText()
        if (!response.status.isSuccess()) throw parseEdgeError(text, response.status.value)
        val profile = json.decodeFromString<RemoteProfile>(text)
        remoteProfileCache = profile to System.currentTimeMillis()
        return profile
    }

    /** GET /get-profile 的 public_profile 字段（未建档为 null）；Me 主页云端恢复用（复用缓存） */
    suspend fun fetchPublicProfileRemote(): RemotePublicProfile? =
        fetchRemoteProfile().publicProfile

    // MARK: - save-profile（save_dimension / save_card_game / save_public_profile）

    /** POST /save-profile action=save_dimension：画像事实落库；测评来源同时原子保存原始结果。 */
    suspend fun saveDimensionRemote(
        dimension: String,
        tags: List<String>,
        source: String = "manual",
        assessmentKind: String? = null,
        assessmentAnswers: List<Int>? = null,
        assessmentScores: Map<String, Int>? = null,
    ) {
        callFunction<OkResponse>("save-profile", buildJsonObject {
            put("action", "save_dimension")
            put("dimension", dimension)
            put("tags", json.encodeToJsonElement(tags))
            put("source", source)
            assessmentKind?.let { put("assessment_kind", it) }
            assessmentAnswers?.let { put("assessment_answers", json.encodeToJsonElement(it)) }
            assessmentScores?.let { put("assessment_scores", json.encodeToJsonElement(it)) }
        })
        invalidateRemoteProfileCache()
    }

    @Serializable
    private data class SaveCardGameResponse(val ok: Boolean = false, val tags: List<String>? = null)

    /**
     * POST /save-profile action=save_card_game：卡牌结果与对应画像事实原子落库。
     * @param kind "life" | "marriage" | "family" | "social"
     * @param finalCards 1–9 张（id/name 必填）
     * @return 服务端写入画像事实的标签（final_cards 名称）
     */
    suspend fun saveCardGameRemote(
        kind: String,
        finalCards: List<CardGameCardPayload>,
        rounds: Int,
        accepted: List<CardGameAcceptedEvent> = emptyList(),
        traded: List<CardGameTradedEvent> = emptyList(),
    ): List<String> {
        val res = callFunction<SaveCardGameResponse>("save-profile", buildJsonObject {
            put("action", "save_card_game")
            put("kind", kind)
            put("final_cards", json.encodeToJsonElement(finalCards))
            put("rounds", rounds)
            put("accepted", json.encodeToJsonElement(accepted))
            put("traded", json.encodeToJsonElement(traded))
        })
        invalidateRemoteProfileCache()
        return res.tags.orEmpty()
    }

    /** POST /save-profile action=save_public_profile：Me 公开主页上云（public_profiles upsert） */
    suspend fun savePublicProfileRemote(profile: MyProfile) {
        // 扁平化：action 与 payload 字段同级（后端从顶层读 name/quote/...）
        val payload = json.encodeToJsonElement(profile.remotePayload).jsonObject
        callFunction<OkResponse>("save-profile", buildJsonObject {
            put("action", "save_public_profile")
            payload.forEach { (k, v) -> put(k, v) }
        })
        invalidateRemoteProfileCache()
    }

    // MARK: - 个人档案与 AI 隐私（profile-privacy，写操作带 profile_revision 乐观锁）

    suspend fun fetchProfilePrivacy(): ProfilePrivacySnapshot =
        callFunction("profile-privacy", buildJsonObject {
            put("action", "get")
        })

    /** 返回格式化后的可移植 JSON；服务端导出中包含事实来源和最小化使用回执。 */
    suspend fun exportProfileData(): String {
        val text = callFunctionRaw("profile-privacy", buildJsonObject {
            put("action", "export")
        }.toString())
        val element = json.parseToJsonElement(text)
        return prettyJson.encodeToString(kotlinx.serialization.json.JsonElement.serializer(), element)
    }

    suspend fun confirmProfileFact(id: String, expectedRevision: Int) {
        callFunction<OkResponse>("profile-privacy", buildJsonObject {
            put("action", "confirm_fact")
            put("fact_id", id)
            put("profile_revision", expectedRevision)
        })
        invalidateRemoteProfileCache()
    }

    suspend fun reviewProfileProposal(id: String, accept: Boolean, expectedRevision: Int) {
        callFunction<OkResponse>("profile-privacy", buildJsonObject {
            put("action", "review_proposal")
            put("proposal_id", id)
            put("accept", accept)
            put("profile_revision", expectedRevision)
        })
        invalidateRemoteProfileCache()
    }

    suspend fun deleteProfileDimension(dimension: String, expectedRevision: Int) {
        callFunction<OkResponse>("profile-privacy", buildJsonObject {
            put("action", "delete_dimension")
            put("dimension", dimension)
            put("profile_revision", expectedRevision)
        })
        invalidateRemoteProfileCache()
    }

    suspend fun setProfileFactVisibility(id: String, visibility: String, expectedRevision: Int) {
        callFunction<OkResponse>("profile-privacy", buildJsonObject {
            put("action", "set_visibility")
            put("fact_id", id)
            put("visibility", visibility)
            put("profile_revision", expectedRevision)
        })
        invalidateRemoteProfileCache()
    }

    suspend fun clearProfile(expectedRevision: Int) {
        callFunction<OkResponse>("profile-privacy", buildJsonObject {
            put("action", "clear_profile")
            put("profile_revision", expectedRevision)
        })
        invalidateRemoteProfileCache()
    }

    // MARK: - Edge Functions（community 悬赏系列，按 action 分发）

    @Serializable
    private data class KaleidoscopeResponse(val traveler: DrawTraveler, val reason: String) {
        @Serializable
        data class DrawTraveler(val id: Int)
    }

    /** POST /community action=kaleidoscope_draw：AI 抽取一位旅人 + 理由 */
    suspend fun kaleidoscopeDraw(mode: String): KaleidoscopeDraw {
        val res = callFunction<KaleidoscopeResponse>("community", buildJsonObject {
            put("action", "kaleidoscope_draw")
            put("mode", mode)
        })
        return KaleidoscopeDraw(travelerId = res.traveler.id, reason = res.reason)
    }

    /** POST /community action=list_bounties：悬赏分页（created_at 倒序，limit 上限 50） */
    suspend fun listBountiesRemote(limit: Int = 20, offset: Int = 0): BountyPage =
        callFunction("community", buildJsonObject {
            put("action", "list_bounties")
            put("limit", limit)
            put("offset", offset)
        })

    @Serializable
    private data class CreateBountyResponse(val ok: Boolean = false, val id: Int)

    /**
     * POST /community action=create_bounty：发布悬赏，返回新悬赏 id
     * question ≤200 字；tags ≤5 项（每项 ≤30 字）；detail ≤2000 字；reward ≤50 字
     */
    suspend fun createBounty(question: String, tags: List<String>, detail: String, reward: String): Int =
        callFunction<CreateBountyResponse>("community", buildJsonObject {
            put("action", "create_bounty")
            put("question", question)
            put("tags", json.encodeToJsonElement(tags))
            put("detail", detail)
            put("reward", reward)
        }).id

    /** POST /community action=respond_bounty：对悬赏发送名片（同一悬赏同一用户 upsert 覆盖） */
    suspend fun respondBounty(bountyId: Int, message: String) {
        callFunction<OkResponse>("community", buildJsonObject {
            put("action", "respond_bounty")
            put("bounty_id", bountyId)
            put("message", message)
        })
    }

    /** POST /community action=get_bounty：悬赏详情 + 回应列表 */
    suspend fun getBounty(bountyId: Int): BountyDetailResponse =
        callFunction("community", buildJsonObject {
            put("action", "get_bounty")
            put("bounty_id", bountyId)
        })

    // MARK: - 卡牌目录（card-game-catalog，GET + apikey，公开只读）

    private var manifestCache: List<CardGameManifestResponse.Item>? = null
    private val catalogCache = mutableMapOf<String, CardGameCatalogEnvelope>()

    suspend fun fetchCardGameManifest(): List<CardGameManifestResponse.Item> {
        try {
            val response = httpClient.get(AppConfig.functionUrl("card-game-catalog")) {
                timeout {
                    requestTimeoutMillis = 30_000
                    socketTimeoutMillis = 30_000
                }
                header("apikey", AppConfig.supabaseAnonKey)
            }
            val text = response.bodyAsText()
            if (!response.status.isSuccess()) throw parseEdgeError(text, response.status.value)
            val manifest = json.decodeFromString<CardGameManifestResponse>(text)
            require(manifest.schemaVersion == 1) { "unsupported card game manifest schema" }
            val games = manifest.games.sortedBy { it.sortOrder }
            manifestCache = games
            return games
        } catch (e: Exception) {
            manifestCache?.let { return it }
            throw e
        }
    }

    suspend fun loadCardGameCatalog(gameKey: String, version: Int? = null): CardGameCatalogEnvelope {
        val resolvedVersion = version
            ?: fetchCardGameManifest().firstOrNull { it.gameKey == gameKey }?.version
            ?: throw EdgeFunctionError(null, "未找到卡牌目录：$gameKey", null, 404)
        val cacheKey = "${gameKey}_$resolvedVersion"
        catalogCache[cacheKey]?.let { return it }
        try {
            val response = httpClient.get(AppConfig.functionUrl("card-game-catalog")) {
                timeout {
                    requestTimeoutMillis = 30_000
                    socketTimeoutMillis = 30_000
                }
                header("apikey", AppConfig.supabaseAnonKey)
                parameter("game", gameKey)
                parameter("version", resolvedVersion.toString())
            }
            val text = response.bodyAsText()
            if (!response.status.isSuccess()) throw parseEdgeError(text, response.status.value)
            val envelope = json.decodeFromString<CardGameCatalogEnvelope>(text)
            catalogCache[cacheKey] = envelope
            return envelope
        } catch (e: Exception) {
            catalogCache[cacheKey]?.let { return it }
            throw e
        }
    }

    // MARK: - 卡牌会话（card-game-session：start / sync / complete）

    @Serializable
    private data class CardGameSessionResponse(
        val ok: Boolean = false,
        val session: RemoteCardGameSession,
    )

    suspend fun startCardGameSession(
        sessionId: String,
        clientSessionId: String,
        gameKey: String,
        catalogVersion: Int,
        seed: Long,
    ): RemoteCardGameSession =
        callFunction<CardGameSessionResponse>("card-game-session", buildJsonObject {
            put("operation", "start")
            put("session_id", sessionId)
            put("client_session_id", clientSessionId)
            put("game_key", gameKey)
            put("catalog_version", catalogVersion)
            put("seed", seed)
        }).session

    suspend fun syncCardGameSession(
        sessionId: String,
        expectedStateVersion: Int,
        actions: List<CardGameSyncAction>,
    ): RemoteCardGameSession =
        callFunction<CardGameSessionResponse>("card-game-session", buildJsonObject {
            put("operation", "sync")
            put("session_id", sessionId)
            put("expected_state_version", expectedStateVersion)
            put("actions", json.encodeToJsonElement(actions))
        }).session

    suspend fun completeCardGameSession(sessionId: String, expectedStateVersion: Int) {
        callFunction<OkResponse>("card-game-session", buildJsonObject {
            put("operation", "complete")
            put("session_id", sessionId)
            put("expected_state_version", expectedStateVersion)
        })
        invalidateRemoteProfileCache()
    }
}
