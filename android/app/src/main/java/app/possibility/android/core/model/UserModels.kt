package app.possibility.android.core.model

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.nullable
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import java.time.Instant
import java.time.temporal.ChronoUnit

// 用户侧模型（RLS 锁 auth.uid()，对应 profiles / conversations / messages / diary_entries / simulations / unlocks）
// 对应 ios/Possibility/Core/Models/UserModels.swift，wire 字段全部 snake_case 对齐。

// MARK: - 容错解码工具

/**
 * 对齐 iOS 的 `try? decodeIfPresent`：字段结构解码失败时降级为 null，不让整体失败。
 */
@OptIn(ExperimentalSerializationApi::class)
open class LenientFieldSerializer<T : Any>(private val delegate: KSerializer<T>) : KSerializer<T?> {
    override val descriptor: SerialDescriptor = delegate.descriptor.nullable

    override fun deserialize(decoder: Decoder): T? {
        val jsonDecoder = decoder as? JsonDecoder ?: return null
        val element = jsonDecoder.decodeJsonElement()
        return runCatching { jsonDecoder.json.decodeFromJsonElement(delegate, element) }.getOrNull()
    }

    override fun serialize(encoder: Encoder, value: T?) {
        if (value == null) encoder.encodeNull() else delegate.serialize(encoder, value)
    }
}

/** 当前用户动态画像 —— 对应表 `profiles` */
@Serializable
data class UserProfile(
    val id: String,
    @SerialName("portrait_pct") val portraitPct: Int,
)

/** 对话（一次迷茫 → 一个岔路口）—— 对应表 `conversations` */
@Serializable
data class Conversation(
    val id: String,
    @SerialName("user_id") val userId: String,
    /** 职业 / 家庭 / 升学 / 情感 */
    val topic: String,
    /** open | crossroads | paid | closed */
    val status: String,
    val crossroads: Crossroads? = null,
)

/** 岔路口信号（conversations.crossroads jsonb：{ready,summary,match_query}） */
@Serializable
data class Crossroads(
    /** true 时前端解锁「看看走过这条路的人」 */
    val ready: Boolean = false,
    val summary: String? = null,
    @SerialName("match_query") val matchQuery: MatchQuery? = null,
)

object LenientCrossroadsSerializer : LenientFieldSerializer<Crossroads>(Crossroads.serializer())

/** 匹配条件（岔路口成形后，用于 POST /match 的 user_state） */
@Serializable
data class MatchQuery(
    @SerialName("life_stage") val lifeStage: String? = null,
    val constraints: List<String>? = null,
    val tension: String? = null,
    @SerialName("decision_stage") val decisionStage: String? = null,
    @SerialName("support_need") val supportNeed: String? = null,
)

/** 消息 —— 对应表 `messages` */
@Serializable
data class ChatMessage(
    val id: Long,
    @SerialName("conversation_id") val conversationId: String,
    /** user | assistant */
    val role: Role,
    val content: String,
) {
    @Serializable
    enum class Role {
        @SerialName("user") USER,
        @SerialName("assistant") ASSISTANT,
    }
}

/** 语音日记 —— 对应表 `diary_entries`（created_at 保持 ISO 字符串，避免日期解码分歧） */
@Serializable
data class DiaryEntry(
    val id: Long,
    @SerialName("user_id") val userId: String,
    @SerialName("audio_path") val audioPath: String? = null,
    val transcript: String? = null,
    val emotions: List<String>? = null,
    val keywords: List<String>? = null,
    @SerialName("created_at") val createdAt: String,
)

/**
 * 人生实验室的离散时间跨度。短期档位使用 `apiYears = 1` 兼容旧接口，
 * `label` 会作为 time_horizon 传给新版接口，确保实际按天/月推演。
 */
@Serializable
enum class SimulationHorizon(val label: String, val dialLabel: String, val apiYears: Int) {
    @SerialName("day7") DAY7("7天", "7天", 1),
    @SerialName("day30") DAY30("30天", "30天", 1),
    @SerialName("month3") MONTH3("3个月", "3月", 1),
    @SerialName("month6") MONTH6("6个月", "6月", 1),
    @SerialName("year1") YEAR1("1年", "1", 1),
    @SerialName("year2") YEAR2("2年", "2", 2),
    @SerialName("year3") YEAR3("3年", "3", 3),
    @SerialName("year4") YEAR4("4年", "4", 4),
    @SerialName("year5") YEAR5("5年", "5", 5),
    @SerialName("year6") YEAR6("6年", "6", 6),
    @SerialName("year7") YEAR7("7年", "7", 7),
    @SerialName("year8") YEAR8("8年", "8", 8),
    @SerialName("year9") YEAR9("9年", "9", 9),
    @SerialName("year10") YEAR10("10年", "10年", 10),
}

/** 人生实验室推演 —— 对应表 `simulations` 与 POST /simulate 出参 */
@Serializable
data class Simulation(
    val question: String,
    val choice: String,
    val years: Int,
    val scenarios: Scenarios,
) {
    /** {general, optimistic, cautionary} */
    @Serializable
    data class Scenarios(
        val general: Scenario,
        val optimistic: Scenario,
        val cautionary: Scenario,
    )

    /** 单个结局面板（对应原型 rs-panel 的结构） */
    @Serializable
    data class Scenario(
        val headline: String,
        /** 职业状态 / 收入趋势 / 生活节奏 / 内心感受 */
        val dimensions: List<Dimension>,
        val gains: List<String>,
        val costs: List<String>,
        @SerialName("key_condition") val keyCondition: String? = null,
    ) {
        @Serializable
        data class Dimension(
            val label: String,
            val text: String,
        )
    }
}

/** 解锁记录 —— 对应表 `unlocks`（demo mock 支付） */
@Serializable
data class Unlock(
    @SerialName("user_id") val userId: String,
    /** profile | service */
    val kind: Kind,
    /** traveler_id / service id */
    @SerialName("target_id") val targetId: String,
    val amount: Double,
) {
    @Serializable
    enum class Kind {
        @SerialName("profile") PROFILE,
        @SerialName("service") SERVICE,
    }
}

// MARK: - Edge Function 契约

/** AI 响应随附的最小化授权披露：只包含用途与实际使用的维度键。 */
@Serializable
data class AIContextDisclosure(
    val purpose: String,
    val dimensions: List<String>,
    @SerialName("profile_revision") val profileRevision: Int? = null,
)

object LenientAIContextSerializer : LenientFieldSerializer<AIContextDisclosure>(AIContextDisclosure.serializer())

/** POST /match 出参：3 位结局不同的旅人 + 可解释理由 */
@Serializable
data class MatchResponse(
    val matches: List<Match>,
    @SerialName("ai_context")
    @Serializable(with = LenientAIContextSerializer::class)
    val aiContext: AIContextDisclosure? = null,
) {
    @Serializable
    data class Match(
        @SerialName("traveler_id") val travelerId: Int,
        /** 为什么推荐给你（可解释） */
        val reason: String,
        /** 不适用条件（避免确认偏误） */
        @SerialName("not_applicable") val notApplicable: String,
    ) {
        val id: Int get() = travelerId
    }
}

/** POST /analyze-diary 出参 */
@Serializable
data class DiaryAnalysis(
    val emotions: List<String>,
    val keywords: List<String>,
    @SerialName("dim_updates") val dimUpdates: Map<String, String>? = null,
)

/** POST /persona 出参（generate / status 同构，扁平：{job_id, status, persona, model_version}） */
@Serializable
data class PersonaJob(
    @SerialName("job_id") val jobId: String,
    /** queued | processing | completed | failed */
    val status: String,
    /** failed 任务 persona 为 `{}`，解码失败时置 null */
    @Serializable(with = LenientPersonaSerializer::class)
    val persona: Persona? = null,
    /** 结构化模型版本；离线兜底为 "fallback" */
    @SerialName("model_version") val modelVersion: String? = null,
    @SerialName("ai_context")
    @Serializable(with = LenientAIContextSerializer::class)
    val aiContext: AIContextDisclosure? = null,
) {
    /** 数字形象参数（_shared/schemas.ts personaSchema） */
    @Serializable
    data class Persona(
        val shape: String,
        /** 0...360 */
        val hue: Int,
        /** 3...9 */
        val lobes: Int,
        /** 0...99999 */
        val seed: Int,
        val summary: String,
    )
}

object LenientPersonaSerializer : LenientFieldSerializer<PersonaJob.Persona>(PersonaJob.Persona.serializer())

/** POST /lab-choices 出参：动态选择卡 + 生成理由 */
@Serializable
data class LabChoiceResponse(
    val cards: List<Card>,
    val rationale: String,
    @SerialName("ai_context")
    @Serializable(with = LenientAIContextSerializer::class)
    val aiContext: AIContextDisclosure? = null,
) {
    @Serializable
    data class Card(
        val id: String,
        val glyph: String,
        val title: String,
        val description: String,
        val color: String,
    )
}

/** POST /list-conversations 出参条目（id/topic/status/crossroads/created_at） */
@Serializable
data class RemoteConversation(
    val id: String,
    val topic: String,
    /** open | crossroads | paid | closed */
    val status: String,
    @Serializable(with = LenientCrossroadsSerializer::class)
    val crossroads: Crossroads? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

/** POST /simulate 完整出参（_shared/schemas.ts simulationSchema）。 */
@Serializable
data class SimulationResult(
    val scenarios: Simulation.Scenarios,
    /** 底线卡守护分析（未传 carry_cards 时也会返回；解码失败置 null 不影响主结果） */
    @SerialName("bottom_line_analysis")
    @Serializable(with = LenientBottomLineSerializer::class)
    val bottomLineAnalysis: BottomLineAnalysis? = null,
    /** 相似旅人推荐（服务端已过滤为真实 traveler id，最多 3 个） */
    @SerialName("recommended_traveler_ids")
    @Serializable(with = LenientIntListSerializer::class)
    val recommendedTravelerIds: List<Int>? = null,
    /** 本次推演实时生成并入库的完整旅人对象（社区人不够多时补充；前端优先展示）。 */
    @SerialName("recommended_travelers")
    @Serializable(with = LenientTravelerListSerializer::class)
    val recommendedTravelers: List<Traveler>? = null,
) {
    @Serializable
    data class BottomLineAnalysis(
        @SerialName("is_acceptable") val isAcceptable: Boolean,
        val risks: List<String>,
        @SerialName("protective_conditions") val protectiveConditions: List<String>,
    )
}

object LenientBottomLineSerializer :
    LenientFieldSerializer<SimulationResult.BottomLineAnalysis>(SimulationResult.BottomLineAnalysis.serializer())

object LenientIntListSerializer : LenientFieldSerializer<List<Int>>(ListSerializer(Int.serializer()))

object LenientTravelerListSerializer : LenientFieldSerializer<List<Traveler>>(ListSerializer(Traveler.serializer()))

/** POST /diary-summary 出参：按月/年聚合日记 + LLM 洞察 */
@Serializable
data class DiarySummaryResponse(
    /** month | year */
    val period: String,
    /** "2026-07"（月）或 "2026"（年） */
    val ref: String,
    @SerialName("entry_count") val entryCount: Int,
    @SerialName("top_emotions") val topEmotions: List<String>,
    @SerialName("top_keywords") val topKeywords: List<String>,
    val insight: String,
    val highlights: List<String>,
)

// MARK: - 卡牌局远端载荷（save-profile action=save_card_game / get-profile.card_games）

/** final_cards 元素（validate.ts validateSaveCardGameInput：id/name 必填，glyph/group 可选） */
@Serializable
data class CardGameCardPayload(
    val id: String,
    val name: String,
    val glyph: String? = null,
    val group: String? = null,
)

/** accepted 元素：{round, scenario, severity}（服务端不校验，前端自定契约） */
@Serializable
data class CardGameAcceptedEvent(
    val round: Int? = null,
    val scenario: String? = null,
    val severity: Int? = null,
)

/** traded 元素：{round, scenario, ids, reasons} */
@Serializable
data class CardGameTradedEvent(
    val round: Int? = null,
    val scenario: String? = null,
    val ids: List<String>? = null,
    val reasons: List<String>? = null,
)

/** GET /get-profile card_games 条目 */
@Serializable
data class RemoteCardGame(
    /** life | marriage | family | social */
    val kind: String,
    @SerialName("final_cards") val finalCards: List<CardGameCardPayload> = emptyList(),
    val rounds: Int = 0,
    val accepted: List<CardGameAcceptedEvent>? = null,
    val traded: List<CardGameTradedEvent>? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

/** 私密画像的原子事实；来源和确认状态用于区分“本人确认”与“AI 推断”。 */
@Serializable
data class ProfileFact(
    val id: String,
    val dimension: String,
    @SerialName("fact_kind") val factKind: String? = null,
    val value: String,
    val source: String,
    @SerialName("source_ref") val sourceRef: String? = null,
    val confidence: Double,
    @SerialName("user_confirmed") val userConfirmed: Boolean,
    val visibility: String,
    val status: String? = null,
    val sensitivity: String? = null,
    @SerialName("support_count") val supportCount: Int? = null,
    @SerialName("observed_at") val observedAt: String? = null,
    @SerialName("last_supported_at") val lastSupportedAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
)

/** 隐私中心显示的最小 AI 使用回执；不包含发送给模型的画像原文。 */
@Serializable
data class ProfileAccessReceipt(
    val id: Long,
    val purpose: String,
    val dimensions: List<String>,
    @SerialName("dimension_count") val dimensionCount: Int,
    @SerialName("fact_count") val factCount: Int,
    @SerialName("profile_revision") val profileRevision: Int,
    @SerialName("public_fact_count") val publicFactCount: Int,
    @SerialName("private_fact_count") val privateFactCount: Int,
    @SerialName("created_at") val createdAt: String,
)

/** AI 记忆提案（隐私中心待审条目，对应 iOS ProfileProposal） */
@Serializable
data class ProfileProposal(
    val id: String,
    val dimension: String,
    val value: String,
    @SerialName("source_type") val sourceType: String,
    val confidence: Double,
    val sensitivity: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("expires_at") val expiresAt: String,
)

@Serializable
data class ProfilePrivacySnapshot(
    @SerialName("profile_revision") val profileRevision: Int,
    @SerialName("portrait_pct") val portraitPct: Int,
    val facts: List<ProfileFact>,
    val proposals: List<ProfileProposal>,
    @SerialName("access_receipts") val accessReceipts: List<ProfileAccessReceipt>,
)

/** 探索话题（对应原型 topicChips；rawValue 即中文标签） */
enum class ExploreTopic(val label: String, val sampleQuestion: String) {
    CAREER("职业", "我是否要从交互设计师转为产品经理？"),
    FAMILY("家庭", "要不要搬回父母所在的城市生活？"),
    STUDY("升学", "26 岁了，还要不要辞职去读研？"),
    LOVE("情感", "异地三年，要不要为 TA 换一座城市？");

    val id: String get() = label

    companion object {
        /** 首页仅这四条预置问题使用本地 mock 对话；用户自行输入的任何其他内容都走 API。 */
        fun isSampleQuestion(question: String): Boolean {
            val clean = question.trim()
            return entries.any { it.sampleQuestion == clean }
        }
    }
}

// MARK: - 卡牌目录 / 会话 wire 模型（card-game-catalog / card-game-session 契约）

@Serializable
data class CardGameManifestResponse(
    @SerialName("schema_version") val schemaVersion: Int,
    val games: List<Item>,
) {
    @Serializable
    data class Item(
        @SerialName("game_key") val gameKey: String,
        val title: String,
        @SerialName("intro_copy") val introCopy: String,
        val accent: String,
        val glyph: String,
        val version: Int,
        @SerialName("content_hash") val contentHash: String,
        @SerialName("sort_order") val sortOrder: Int,
    ) {
        val id: String get() = gameKey
    }
}

@Serializable
data class CardGameCatalogEnvelope(
    @SerialName("game_id") val gameId: String,
    @SerialName("game_key") val gameKey: String,
    @SerialName("version_id") val versionId: String,
    val version: Int,
    @SerialName("content_hash") val contentHash: String,
    @SerialName("engine_key") val engineKey: String,
    @SerialName("analysis_key") val analysisKey: String,
    val catalog: CardGameCatalog,
)

@Serializable
data class CardGameCatalog(
    @SerialName("schema_version") val schemaVersion: Int,
    val game: Game,
    val rules: Rules,
    val display: Display,
    val groups: List<Group>,
    val cards: List<Card>,
    val stages: List<Stage>,
    val scenarios: List<Scenario>,
) {
    @Serializable
    data class Game(
        val key: String,
        val title: String,
        val eyebrow: String,
        @SerialName("intro_title") val introTitle: String,
        @SerialName("intro_copy") val introCopy: String,
        @SerialName("profile_dimension") val profileDimension: String? = null,
        @SerialName("content_warning") val contentWarning: String? = null,
    )

    @Serializable
    data class Rules(
        @SerialName("initial_select_count") val initialSelectCount: Int,
        @SerialName("final_card_count") val finalCardCount: Int,
        @SerialName("discard_per_trade") val discardPerTrade: Int,
        @SerialName("scenario_choice_count") val scenarioChoiceCount: Int,
        val pressure: Pressure,
        @SerialName("scenario_selection") val scenarioSelection: String,
        @SerialName("stage_basis") val stageBasis: String,
        @SerialName("allow_redraw") val allowRedraw: Boolean,
    ) {
        @Serializable
        data class Pressure(
            val initial: Int,
            val min: Int,
            val max: Int,
            @SerialName("accept_delta") val acceptDelta: Int,
            @SerialName("trade_delta") val tradeDelta: Int,
        )
    }

    @Serializable
    data class Display(
        val accent: String,
        val glyph: String,
        @SerialName("card_back_asset") val cardBackAsset: String,
        @SerialName("pressure_labels") val pressureLabels: List<PressureLabel>,
        @SerialName("rule_copy") val ruleCopy: List<RuleCopy>,
    ) {
        @Serializable
        data class PressureLabel(
            val level: Int,
            val title: String,
            val description: String,
        )

        @Serializable
        data class RuleCopy(
            val title: String,
            val description: String,
        )
    }

    @Serializable
    data class Group(
        val key: String,
        val title: String,
        @SerialName("ai_description") val aiDescription: String,
    )

    @Serializable
    data class Card(
        val key: String,
        val title: String,
        val description: String,
        val glyph: String,
        @SerialName("group_key") val groupKey: String,
        @SerialName("sort_order") val sortOrder: Int,
        val enabled: Boolean,
    )

    @Serializable
    data class Stage(
        val key: String,
        val title: String,
        val subtitle: String,
        @SerialName("activate_after_trades") val activateAfterTrades: Int,
        @SerialName("sort_order") val sortOrder: Int,
    )

    @Serializable
    data class Scenario(
        val key: String,
        @SerialName("stage_key") val stageKey: String,
        val title: String,
        val description: String,
        @SerialName("theme_key") val themeKey: String,
        val severity: Int,
        @SerialName("sort_order") val sortOrder: Int,
        val enabled: Boolean,
    )
}

@Serializable
data class RemoteCardGameSession(
    val id: String,
    @SerialName("client_session_id") val clientSessionId: String,
    @SerialName("game_key") val gameKey: String,
    @SerialName("catalog_version") val catalogVersion: Int,
    val status: String,
    val seed: Long,
    @SerialName("state_version") val stateVersion: Int,
    @SerialName("last_action_seq") val lastActionSeq: Int,
    val state: State,
    @SerialName("completed_at") val completedAt: String? = null,
) {
    @Serializable
    data class State(
        val phase: String,
        @SerialName("selected_card_keys") val selectedCardKeys: List<String>,
        @SerialName("held_card_keys") val heldCardKeys: List<String>,
        @SerialName("seen_scenario_keys") val seenScenarioKeys: List<String>,
        @SerialName("current_scenario_key") val currentScenarioKey: String? = null,
        @SerialName("round_count") val roundCount: Int,
        @SerialName("accept_count") val acceptCount: Int,
        @SerialName("trade_count") val tradeCount: Int,
        val pressure: Int,
    )
}

@Serializable
data class CardGameSyncAction(
    val sequence: Int,
    @SerialName("action_type") val actionType: String,
    @SerialName("scenario_key") val scenarioKey: String? = null,
    @SerialName("card_keys") val cardKeys: List<String> = emptyList(),
    @SerialName("reason_cannot_accept") val reasonCannotAccept: String? = null,
    @SerialName("reason_abandon") val reasonAbandon: String? = null,
    @SerialName("created_at") val createdAt: String = isoNow(),
)

internal fun isoNow(): String =
    Instant.now().truncatedTo(ChronoUnit.SECONDS).toString()
