package app.possibility.android.features.cardgame

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.possibility.android.core.model.CardGameAcceptedEvent
import app.possibility.android.core.model.CardGameCardPayload
import app.possibility.android.core.model.CardGameSyncAction
import app.possibility.android.core.model.CardGameTradedEvent
import app.possibility.android.core.network.SupabaseService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.util.UUID
import kotlin.random.Random

// MARK: - 卡牌游戏通用引擎（对应 ios/Possibility/Features/CardGame/CardGameEngine.swift）
//
// intro → 选择初始牌 → 每轮抽情境 → 决策（接受加压 / 交换减压）
// → 手中自然剩到目录规定数量 → 结果分析。人生卡牌额外生成深层画像（lifeAnalysis）。

/** 局内使用的 SharedPreferences（全局单文件，key 与 iOS UserDefaults 对齐）。 */
object CardGamePrefs {
    const val FILE = "possibility"

    /** 人生底牌签名持久化 key（对应 iOS HomeModel.lifeSignatureKey）。 */
    const val LIFE_SIGNATURE_KEY = "kaleido_life_signature_v1"

    fun get(context: Context): SharedPreferences =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    val json: Json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
}

enum class CardGamePhase { INTRO, SELECT, DRAW, DECISION, TRADE, RESULT }

class CardGameEngine(
    kind: CardGameKind,
    config: CardGameConfig? = null,
    private val prefs: SharedPreferences,
    private val userScope: String? = null,
) {
    val config: CardGameConfig = config ?: CardGameData.config(kind)

    data class AcceptedEvent(val round: Int, val scenario: GameScenario, val severity: Int)
    data class TradedEvent(
        val round: Int,
        val scenario: GameScenario,
        val ids: List<String>,
        val cannotAccept: String,
        val abandon: String,
    )

    var phase by mutableStateOf(CardGamePhase.INTRO)
    /** 选牌顺序即持有顺序 */
    var selected by mutableStateOf<List<String>>(emptyList())
    var held by mutableStateOf<List<String>>(emptyList())
    var accepted by mutableStateOf<List<AcceptedEvent>>(emptyList())
    var traded by mutableStateOf<List<TradedEvent>>(emptyList())
    var round by mutableStateOf(0)
    var pressure by mutableStateOf(1)
    var acceptStreak by mutableStateOf(0)
    var seenTitles by mutableStateOf<Set<String>>(emptySet())
    var current by mutableStateOf<GameScenario?>(null)
    var tradePick by mutableStateOf<List<String>>(emptyList())
    var reasonCannotAccept by mutableStateOf("")
    var reasonAbandon by mutableStateOf("")
    var scenarioSeed: Long = 0

    init {
        restoreProgress()
    }

    val initialSelectCount: Int get() = config.dynamicRules?.initialSelectCount ?: 9
    val finalCardCount: Int get() = config.dynamicRules?.finalCardCount ?: 3
    val discardPerTrade: Int get() = config.dynamicRules?.discardPerTrade ?: 2
    val scenarioChoiceCount: Int get() = config.dynamicRules?.scenarioChoiceCount ?: 5
    val pressureMin: Int get() = config.dynamicRules?.pressure?.min ?: 1
    val pressureMax: Int get() = config.dynamicRules?.pressure?.max ?: config.severityMeta.size
    val pressureInitial: Int get() = config.dynamicRules?.pressure?.initial ?: 1

    fun card(id: String): GameCard = config.cards.first { it.id == id }
    val heldCards: List<GameCard> get() = held.map { card(it) }

    /** 当前压力等级的 (名称, 文案)。 */
    val severityMeta: Pair<String, String>
        get() {
            val index = maxOf(0, minOf(config.severityMeta.size - 1, pressure - pressureMin))
            return config.severityMeta[index]
        }

    /** 顶部进度。 */
    fun progress(extra: Double = 0.0): Double = when (phase) {
        CardGamePhase.INTRO -> 0.0
        CardGamePhase.SELECT -> maxOf(0.04, selected.size * 0.02)
        CardGamePhase.RESULT -> 1.0
        else -> {
            val releasable = initialSelectCount - finalCardCount
            val released = if (releasable == 0) 1.0
            else (initialSelectCount - held.size).toDouble() / releasable.toDouble()
            minOf(0.96, 0.16 + released * 0.72 + minOf(round, 8) * 0.015 + extra)
        }
    }

    // MARK: 流程

    fun start() {
        selected = emptyList()
        held = emptyList()
        accepted = emptyList()
        traded = emptyList()
        round = 0
        pressure = pressureInitial
        acceptStreak = 0
        seenTitles = emptySet()
        current = null
        tradePick = emptyList()
        reasonCannotAccept = ""
        reasonAbandon = ""
        phase = CardGamePhase.SELECT
        saveProgress()
    }

    /** 选牌开关；达到上限时返回提示。 */
    fun toggleSelect(id: String): String? {
        if (selected.contains(id)) {
            selected = selected.filterNot { it == id }
        } else if (selected.size < initialSelectCount) {
            selected = selected + id
        } else {
            return "这一局只能带走 $initialSelectCount 张底牌"
        }
        saveProgress()
        return null
    }

    fun confirmSelection() {
        if (selected.size != initialSelectCount) return
        held = selected
        round = 0
        pressure = pressureInitial
        acceptStreak = 0
        seenTitles = emptySet()
        phase = CardGamePhase.DRAW
        saveProgress()
    }

    /** 抽牌候选（优先压力邻近、未出现过的情境）。 */
    val scenarioOptions: List<GameScenario>
        get() {
            data class Candidate(
                val scenario: GameScenario,
                val distance: Int,
                val seen: Int,
                val order: Long,
            )
            val pool = config.scenarios(traded.size)
            val candidates = pool.mapIndexed { index, scenario ->
                Candidate(
                    scenario = scenario,
                    distance = kotlin.math.abs(scenario.severity - pressure),
                    seen = if (seenTitles.contains(scenario.title)) 1 else 0,
                    order = if (config.dynamicRules == null) {
                        ((index * 7 + round * 11) % 23).toLong()
                    } else {
                        stableScenarioOrder(scenario)
                    },
                )
            }.sortedWith(
                compareBy({ it.distance }, { it.seen }, { it.order }),
            )
            return candidates.take(scenarioChoiceCount).map { it.scenario }
        }

    private fun stableScenarioOrder(scenario: GameScenario): Long {
        var hash = (scenarioSeed xor (((round + 1).toLong() * 0x9e3779b1L) and MASK32)) and MASK32
        val keyStr = scenario.key ?: scenario.title
        for (b in keyStr.encodeToByteArray()) {
            hash = hash xor (b.toLong() and 0xFF)
            hash = (hash * 16_777_619L) and MASK32
        }
        return hash
    }

    fun draw(scenario: GameScenario) {
        current = scenario
        seenTitles = seenTitles + scenario.title
        phase = CardGamePhase.DECISION
        saveProgress()
    }

    val canTrade: Boolean get() = held.size - discardPerTrade >= finalCardCount

    fun accept() {
        val c = current ?: return
        accepted = accepted + AcceptedEvent(round, c, pressure)
        acceptStreak += 1
        pressure = minOf(pressureMax, pressure + (config.dynamicRules?.pressure?.acceptDelta ?: 1))
        finishRound()
    }

    fun beginTrade() {
        tradePick = emptyList()
        reasonCannotAccept = ""
        reasonAbandon = ""
        phase = CardGamePhase.TRADE
        saveProgress()
    }

    fun toggleTrade(id: String): String? {
        if (tradePick.contains(id)) {
            tradePick = tradePick.filterNot { it == id }
        } else if (tradePick.size < discardPerTrade) {
            tradePick = tradePick + id
        } else {
            return "这一轮需要交换 $discardPerTrade 张底牌"
        }
        saveProgress()
        return null
    }

    fun confirmTrade() {
        val c = current ?: return
        if (tradePick.size != discardPerTrade) return
        traded = traded + TradedEvent(
            round, c, tradePick,
            reasonCannotAccept.trim(), reasonAbandon.trim(),
        )
        val picked = tradePick.toSet()
        held = held.filterNot { picked.contains(it) }
        tradePick = emptyList()
        acceptStreak = 0
        pressure = maxOf(
            pressureMin,
            minOf(pressureMax, pressure + (config.dynamicRules?.pressure?.tradeDelta ?: -1)),
        )
        finishRound()
    }

    private fun finishRound() {
        round += 1
        current = null
        phase = if (held.size == finalCardCount) CardGamePhase.RESULT else CardGamePhase.DRAW
        saveProgress()
    }

    fun returnToDraw() {
        current = null
        tradePick = emptyList()
        reasonCannotAccept = ""
        reasonAbandon = ""
        phase = CardGamePhase.DRAW
        saveProgress()
    }

    fun cancelTrade() {
        tradePick = emptyList()
        phase = CardGamePhase.DECISION
        saveProgress()
    }

    /** life 三段轮次信息；其余游戏返回轮次文案。 */
    val stageMeta: Pair<String, String>
        get() {
            if (config.stageMeta.isNotEmpty()) {
                val stage = config.stageMeta
                    .filter { it.activateAfterTrades <= traded.size }
                    .maxByOrNull { it.activateAfterTrades }
                if (stage != null) return stage.age to stage.name
            }
            if (config.kind == CardGameKind.LIFE) {
                return CardGameData.lifeRoundMeta[minOf(traded.size, CardGameData.lifeRoundMeta.size - 1)]
            }
            return "第 ${round + 1} 轮" to config.title
        }

    // MARK: 结果保存

    /**
     * 先把结果写入本地。life 写人生底牌签名，其余映射维度由服务端 save_card_game 落库。
     * @return 最终底牌名称列表。
     */
    fun saveResultLocally(): List<String> {
        val cards = heldCards
        val tags = cards.map { it.name }
        if (config.kind == CardGameKind.LIFE) {
            val signature = cards.map { LifeSignatureCard(glyph = it.glyph, name = it.name) }
            runCatching {
                val encoded = CardGamePrefs.json.encodeToString(
                    kotlinx.serialization.builtins.ListSerializer(LifeSignatureCard.serializer()),
                    signature,
                )
                prefs.edit().putString(CardGamePrefs.LIFE_SIGNATURE_KEY, encoded).apply()
            }
        }
        CardGameLocalRecord.markDone(config.kind, userScope, prefs)
        saveProgress()
        return tags
    }

    /** 旧版整局结果上云：kind + 最终底牌 + 轮次 + 接受/交换记录。 */
    suspend fun uploadResult(supabase: SupabaseService) {
        val cards = heldCards
        val finalCards = cards.map {
            CardGameCardPayload(id = it.id, name = it.name, glyph = it.glyph, group = it.group)
        }
        val acceptedEvents = accepted.map {
            CardGameAcceptedEvent(round = it.round, scenario = it.scenario.title, severity = it.severity)
        }
        val tradedEvents = traded.map { entry ->
            CardGameTradedEvent(
                round = entry.round,
                scenario = entry.scenario.title,
                ids = entry.ids,
                reasons = listOf(entry.cannotAccept, entry.abandon).filter { it.isNotEmpty() },
            )
        }
        supabase.saveCardGameRemote(
            kind = config.kind.rawValue,
            finalCards = finalCards,
            rounds = round,
            accepted = acceptedEvents,
            traded = tradedEvents,
        )
        CardGameLocalRecord.clearProgress(config.kind, userScope, prefs)
    }

    /** v2 session 完成后只清理本地可重试快照。 */
    fun clearProgressAfterSync() {
        CardGameLocalRecord.clearProgress(config.kind, userScope, prefs)
    }

    // MARK: 局内快照

    @Serializable
    private data class AcceptedSnapshot(val round: Int, val title: String, val severity: Int)

    @Serializable
    private data class TradedSnapshot(
        val round: Int,
        val title: String,
        val ids: List<String>,
        val cannotAccept: String,
        val abandon: String,
    )

    @Serializable
    private data class ProgressSnapshot(
        val version: Int,
        val kind: String,
        val phase: String,
        val selected: List<String>,
        val held: List<String>,
        val accepted: List<AcceptedSnapshot>,
        val traded: List<TradedSnapshot>,
        val round: Int,
        val pressure: Int,
        val acceptStreak: Int,
        val seenTitles: List<String>,
        val currentTitle: String?,
        val tradePick: List<String>,
        val reasonCannotAccept: String,
        val reasonAbandon: String,
    )

    fun saveProgress() {
        if (phase == CardGamePhase.INTRO) {
            CardGameLocalRecord.clearProgress(config.kind, userScope, prefs)
            return
        }
        val snapshot = ProgressSnapshot(
            version = 1,
            kind = config.kind.rawValue,
            phase = phase.name,
            selected = selected,
            held = held,
            accepted = accepted.map { AcceptedSnapshot(it.round, it.scenario.title, it.severity) },
            traded = traded.map { TradedSnapshot(it.round, it.scenario.title, it.ids, it.cannotAccept, it.abandon) },
            round = round,
            pressure = pressure,
            acceptStreak = acceptStreak,
            seenTitles = seenTitles.toList(),
            currentTitle = current?.title,
            tradePick = tradePick,
            reasonCannotAccept = reasonCannotAccept,
            reasonAbandon = reasonAbandon,
        )
        runCatching {
            val encoded = CardGamePrefs.json.encodeToString(ProgressSnapshot.serializer(), snapshot)
            CardGameLocalRecord.saveProgress(encoded, config.kind, userScope, prefs)
        }
    }

    private fun restoreProgress() {
        val raw = CardGameLocalRecord.progressData(config.kind, userScope, prefs) ?: return
        val snapshot = runCatching {
            CardGamePrefs.json.decodeFromString(ProgressSnapshot.serializer(), raw)
        }.getOrNull()
        val parsedPhase = snapshot?.let { runCatching { CardGamePhase.valueOf(it.phase) }.getOrNull() }
        if (snapshot == null || parsedPhase == null ||
            snapshot.version != 1 || snapshot.kind != config.kind.rawValue
        ) {
            CardGameLocalRecord.clearProgress(config.kind, userScope, prefs)
            return
        }

        val validCardIDs = config.cards.map { it.id }.toSet()
        val allScenarios = config.scenarioRounds.flatten()
        val scenarioByTitle = allScenarios.associateBy { it.title }
        val tradedIDs = snapshot.traded.flatMap { it.ids }
        val requiresCurrent = parsedPhase == CardGamePhase.DECISION || parsedPhase == CardGamePhase.TRADE

        val restoredAccepted = restoreAccepted(snapshot.accepted, scenarioByTitle)
        val restoredTraded = restoreTraded(snapshot.traded, scenarioByTitle)

        val valid = snapshot.selected.toSet().size == snapshot.selected.size &&
            snapshot.held.toSet().size == snapshot.held.size &&
            snapshot.tradePick.toSet().size == snapshot.tradePick.size &&
            snapshot.selected.toSet().all { validCardIDs.contains(it) } &&
            snapshot.held.toSet().all { validCardIDs.contains(it) } &&
            snapshot.tradePick.toSet().all { snapshot.held.toSet().contains(it) } &&
            snapshot.selected.size <= initialSelectCount &&
            snapshot.held.size <= initialSelectCount &&
            snapshot.pressure in pressureMin..pressureMax &&
            snapshot.round >= 0 &&
            snapshot.acceptStreak >= 0 &&
            (parsedPhase != CardGamePhase.RESULT || snapshot.held.size == finalCardCount) &&
            (parsedPhase == CardGamePhase.SELECT || snapshot.selected.size == initialSelectCount) &&
            (parsedPhase == CardGamePhase.SELECT || snapshot.held.size >= finalCardCount) &&
            (parsedPhase == CardGamePhase.SELECT || snapshot.held.toSet().all { snapshot.selected.toSet().contains(it) }) &&
            (parsedPhase == CardGamePhase.SELECT ||
                snapshot.held.size == initialSelectCount - snapshot.traded.size * discardPerTrade) &&
            tradedIDs.toSet().size == tradedIDs.size &&
            tradedIDs.toSet().none { snapshot.held.toSet().contains(it) } &&
            snapshot.round == snapshot.accepted.size + snapshot.traded.size &&
            (!requiresCurrent || snapshot.currentTitle != null) &&
            (parsedPhase != CardGamePhase.TRADE || snapshot.tradePick.size <= discardPerTrade) &&
            restoredAccepted != null &&
            restoredTraded != null &&
            (snapshot.currentTitle == null || scenarioByTitle[snapshot.currentTitle] != null)

        if (!valid) {
            CardGameLocalRecord.clearProgress(config.kind, userScope, prefs)
            return
        }

        phase = parsedPhase
        selected = snapshot.selected
        held = snapshot.held
        accepted = restoredAccepted.orEmpty()
        traded = restoredTraded.orEmpty()
        round = snapshot.round
        pressure = snapshot.pressure
        acceptStreak = snapshot.acceptStreak
        seenTitles = snapshot.seenTitles.filter { scenarioByTitle[it] != null }.toSet()
        current = snapshot.currentTitle?.let { scenarioByTitle[it] }
        tradePick = snapshot.tradePick
        reasonCannotAccept = snapshot.reasonCannotAccept
        reasonAbandon = snapshot.reasonAbandon
    }

    private fun restoreAccepted(
        snapshots: List<AcceptedSnapshot>,
        scenarios: Map<String, GameScenario>,
    ): List<AcceptedEvent>? {
        val result = mutableListOf<AcceptedEvent>()
        for (entry in snapshots) {
            val scenario = scenarios[entry.title] ?: return null
            if (entry.round < 0 || entry.severity !in pressureMin..pressureMax) return null
            result.add(AcceptedEvent(entry.round, scenario, entry.severity))
        }
        return result
    }

    private fun restoreTraded(
        snapshots: List<TradedSnapshot>,
        scenarios: Map<String, GameScenario>,
    ): List<TradedEvent>? {
        val result = mutableListOf<TradedEvent>()
        val validCardIDs = config.cards.map { it.id }.toSet()
        for (entry in snapshots) {
            val scenario = scenarios[entry.title] ?: return null
            if (entry.round < 0) return null
            if (entry.ids.size != discardPerTrade) return null
            if (entry.ids.toSet().size != discardPerTrade) return null
            if (!entry.ids.toSet().all { validCardIDs.contains(it) }) return null
            result.add(TradedEvent(entry.round, scenario, entry.ids, entry.cannotAccept, entry.abandon))
        }
        return result
    }

    // MARK: 结果分析（通用）

    /** 留牌最多的分组。 */
    val topGroup: String
        get() {
            val counts = mutableMapOf<String, Int>()
            for (c in heldCards) counts[c.group] = (counts[c.group] ?: 0) + 1
            return counts.entries
                .maxWithOrNull(compareBy({ it.value }, { it.key.reversed() /* 保序占位 */ }))
                ?.let {
                    // 与 iOS 相同：值相同则取字典序更大的 key
                    counts.entries.filter { e -> e.value == it.value }.maxByOrNull { e -> e.key }?.key
                } ?: ""
        }

    val groupNarrative: String get() = config.groupCopy[topGroup] ?: ""

    // MARK: 人生卡牌深层分析（原型 lifeAnalysis 全量移植）

    data class LifeAnalysis(
        val held: List<GameCard>,
        val title: String,
        val groupCopy: String,
        val truth: String,
        val tension: String,
        val blindspot: String,
        val reflection: String,
        val spectrum: List<Triple<String, String, Int>>,
        val voiceQuotes: List<Pair<String, String>>,
        val reasonInsight: String,
        val hiddenTraits: List<Pair<String, String>>,
        val acceptedCount: Int,
        val tradedCount: Int,
    )

    fun lifeAnalysis(): LifeAnalysis {
        val initial = selected.map { card(it) }
        val heldCards = this.heldCards
        val initialCounts = mutableMapOf<String, Int>()
        val heldCounts = mutableMapOf<String, Int>()
        for (c in initial) initialCounts[c.group] = (initialCounts[c.group] ?: 0) + 1
        for (c in heldCards) heldCounts[c.group] = (heldCounts[c.group] ?: 0) + 1

        val allGroups = listOf("关系", "内在力量", "能力行动", "价值原则", "现实支点", "外部认可")
        val topGroup = allGroups
            .map { it to ((initialCounts[it] ?: 0) + (heldCounts[it] ?: 0) * 2) }
            .maxByOrNull { it.second }?.first ?: "内在力量"

        val groupCopy = config.groupCopy[topGroup] ?: ""
        val noun = mapOf(
            "关系" to "关系守护者", "内在力量" to "内驱守望者", "能力行动" to "行动建构者",
            "价值原则" to "原则坚持者", "现实支点" to "现实锚定者", "外部认可" to "光芒追寻者",
        )
        val mode = when {
            traded.size > accepted.size -> "掌舵型"
            traded.size < accepted.size -> "接纳型"
            else -> "平衡型"
        }

        val rejected = traded.map { it.scenario.theme }
        val sacrificed = traded.flatMap { it.ids }.map { card(it) }
        val firstTrade = sacrificed.map { it.name }
        val acceptedNames = accepted.map { it.scenario.title }

        // 亲口理由分析
        val reasonEntries = traded.filter { it.cannotAccept.isNotEmpty() || it.abandon.isNotEmpty() }
        val reasonText = reasonEntries
            .flatMap { listOf(it.cannotAccept, it.abandon) }
            .filter { it.isNotEmpty() }
            .joinToString(" ")
        val voiceQuotes = mutableListOf<Pair<String, String>>()
        for (entry in reasonEntries) {
            if (entry.cannotAccept.isNotEmpty()) voiceQuotes.add("不能接受“${entry.scenario.title}”" to entry.cannotAccept)
            if (entry.abandon.isNotEmpty()) voiceQuotes.add("愿意放弃底牌" to entry.abandon)
        }
        val trimmedVoiceQuotes = voiceQuotes.take(4)

        fun containsAny(words: List<String>): Boolean = words.any { reasonText.contains(it) }
        var reasonInsight = ""
        if (reasonText.isNotEmpty()) {
            reasonInsight = when {
                containsAny(listOf("家人", "父母", "孩子", "伴侣", "爱人", "关系", "信任", "孤独", "离开")) ->
                    "你亲口提到的重要他人和关系责任，说明真正触发你的不只是事件本身，而是“我是否保护好了这段关系”。"
                containsAny(listOf("健康", "生病", "钱", "收入", "稳定", "安全", "生活", "房子")) ->
                    "你给出的理由不断回到健康、稳定或生活基础，说明你最难承受的是人生底线被击穿，而不只是暂时的不顺。"
                containsAny(listOf("失败", "认可", "证明", "价值", "丢脸", "否定", "不够好")) ->
                    "你的理由触及了失败、认可或自我价值，说明这件事之所以不能接受，是因为它可能动摇“我是否足够好”的判断。"
                containsAny(listOf("控制", "失控", "确定", "害怕", "担心", "无法", "不能")) ->
                    "你的表达里带着对失控和不确定的警觉。你想消除的可能不只是坏结果，更是等待结果时无法掌舵的感觉。"
                containsAny(listOf("责任", "应该", "照顾", "拖累", "承担", "保护")) ->
                    "你习惯从责任出发解释选择。对你而言，真正难受的可能不是损失，而是觉得自己没有承担好本应承担的部分。"
                else ->
                    "你的理由显示，你不是在机械地交换卡牌，而是在区分“以后还能重新获得的”和“一旦失去就无法补回的”。"
            }
        }

        fun clamp(n: Double): Int = maxOf(4, minOf(96, Math.round(n).toInt()))
        val acceptanceScore = clamp(accepted.size.toDouble() / maxOf(round, 1).toDouble() * 100)
        val relationScore = clamp(
            ((initialCounts["关系"] ?: 0) / 6.0 * 0.45 +
                (heldCounts["关系"] ?: 0) / maxOf(heldCards.size, 1).toDouble() * 0.55) * 100,
        )
        val initialPrinciple = initialCounts["价值原则"] ?: 0
        val principleScore = if (initialPrinciple > 0) {
            clamp(
                (initialPrinciple / 3.0 * 0.4 +
                    (heldCounts["价值原则"] ?: 0) / initialPrinciple.toDouble() * 0.6) * 100,
            )
        } else 8
        val spectrum = listOf(
            Triple("主动掌控", "接纳现实", acceptanceScore),
            Triple("自我驱动", "关系锚定", relationScore),
            Triple("现实调整", "原则坚持", principleScore),
        )

        val truthByGroup = mapOf(
            "关系" to if (mode == "掌舵型")
                "你真正害怕的可能不是困难本身，而是重要关系在困难里失去确定性。为了把关系拉回安全的位置，你愿意先消耗自己的其他资源。"
            else
                "你比自己想象中更能承受生活的不完美，前提是重要的人和彼此的信任仍然留在身边。",
            "内在力量" to if (mode == "掌舵型")
                "你对失控很敏感，但你并不等待别人来救场。你的第一反应，是动用自己已有的力量，把人生重新拉回手里。"
            else
                "你相信真正带不走的东西在自己身上。环境可以变坏，但只要内在力量还在，你就不认为自己彻底失去了选择。",
            "能力行动" to "你想保护的不只是“优秀”，而是解决问题的资格。对你而言，能力意味着即使生活失序，自己仍有重新开始的路径。",
            "价值原则" to "你可以失去一些外在条件，却很难接受自己变成一个不认同的人。守住原则，对你来说是在守住“我还是我”。",
            "现实支点" to "你追求的未必是保守，而是不能跌出生活的底线。只有身体和现实秩序稳住，你才允许自己继续谈理想。",
            "外部认可" to "你在意的可能不只是光环。被看见对你意味着机会仍在、价值仍被确认，也意味着自己没有从世界中消失。",
        )
        val truth = (truthByGroup[topGroup] ?: "") + (if (reasonInsight.isEmpty()) "" else " $reasonInsight")

        val sacrificeText = firstTrade.take(3).joinToString("、")
        val firstEvent = traded.firstOrNull()
        var tension: String
        if (firstEvent != null) {
            tension = "你曾主动把“$sacrificeText”带进人生，说明它们并非不重要；但当“${firstEvent.scenario.title}”出现时，你又愿意先放下它们。你的价值排序不是固定清单，而会在威胁出现时迅速重排。"
            if (firstEvent.abandon.isNotEmpty()) {
                tension += " 你给出的理由是：“${firstEvent.abandon}”——这让交换不再只是轻重排序，也暴露了你判断“什么还能重来”的标准。"
            }
        } else {
            tension = "你没有用任何底牌换取确定性。这里既有接纳现实的力量，也可能藏着另一面：你习惯先承受，而不是确认自己是否还有改变局面的权利。"
        }

        val blindspot = when {
            accepted.size >= 4 ->
                "你可能会把“我能承受”误认成“我应该承受”。真正的接纳并不等于独自消化，求助和设立边界也可以是成熟。"
            traded.size >= 4 ->
                "你可能高估了消除风险的必要性。为了让坏事不发生而持续支付代价，有时会让长期资源先被耗尽。"
            topGroup == "关系" ->
                "关系受到威胁时，你可能太快拿自己的能力、需要或边界去交换稳定。关系被保住，不一定等于你也被照顾。"
            topGroup == "价值原则" ->
                "原则让你保持完整，也可能让灰度情境显得非黑即白。有些调整不是背叛自己，而是为价值寻找新的实现方式。"
            topGroup == "现实支点" ->
                "对底线的敏感让你擅长识别风险，但也可能过早收缩探索空间，把“还没发生”提前活成“不能发生”。"
            else ->
                "你容易把能够解决问题，当成必须负责解决问题。能力很强的人，也可能因此忽略自己的疲惫和被支持的需要。"
        }

        val reflection = if (firstEvent != null) {
            "如果现实中真的遭遇“${firstEvent.scenario.title}”，你愿意失去“${firstTrade.take(2).joinToString("、")}”来换回确定吗？还是当时只是太害怕失控？"
        } else {
            "你接受的“${acceptedNames.firstOrNull() ?: "不确定"}”里，有没有一件并非真正接纳，而是你当时不相信自己拥有别的选择？"
        }

        val modeCopy = when (mode) {
            "掌舵型" -> "愿意付出已有资源，换回对人生的控制感"
            "接纳型" -> "更愿接受无法控制的现实，保护已经拥有的部分"
            else -> "在接受现实与主动改变之间寻找平衡"
        }

        val seenRejected = mutableSetOf<String>()
        val uniqueRejected = rejected.filter { seenRejected.add(it) }
        val hiddenTraits = listOf(
            "我最看重" to heldCards.take(4).joinToString("、") { it.name },
            "我的安全感来自" to groupCopy,
            "我的取舍方式" to modeCopy,
            "我最不愿承受" to (if (uniqueRejected.isEmpty()) "没有明确拒绝的情境" else uniqueRejected.take(3).joinToString("、")),
            "我能够放下" to (if (firstTrade.isEmpty()) "这一局没有典当任何底牌" else firstTrade.take(4).joinToString("、")),
            "我面对不可控事件时" to "接受了 ${accepted.size} 次，主动交换了 ${traded.size} 次",
            "我的内在真相" to truth,
            "我的内在张力" to tension,
            "我可能忽略" to blindspot,
            "我做出选择时真正担心" to (if (reasonInsight.isEmpty()) "这次没有写下原因，暂时只依据取舍行为推断" else reasonInsight),
        )

        return LifeAnalysis(
            held = heldCards,
            title = "$mode${noun[topGroup] ?: ""}",
            groupCopy = groupCopy,
            truth = truth, tension = tension, blindspot = blindspot, reflection = reflection,
            spectrum = spectrum, voiceQuotes = trimmedVoiceQuotes, reasonInsight = reasonInsight,
            hiddenTraits = hiddenTraits,
            acceptedCount = accepted.size, tradedCount = traded.size,
        )
    }

    companion object {
        private const val MASK32 = 0xFFFFFFFFL
    }
}

// MARK: - Offline-first server session synchronization（对应 iOS CardGameSessionCoordinator）

class CardGameSessionCoordinator private constructor(
    private var state: LocalState,
    val resumed: Boolean,
    private val supabase: SupabaseService,
    private val prefs: SharedPreferences,
) {
    @Serializable
    data class LocalState(
        val schemaVersion: Int,
        val userId: String,
        val gameKey: String,
        val catalogVersion: Int,
        val sessionId: String,
        val clientSessionId: String,
        val seed: Long,
        var serverStateVersion: Int,
        var lastSyncedSequence: Int,
        var pendingActions: List<CardGameSyncAction>,
    )

    val seed: Long get() = state.seed
    val userId: String get() = state.userId

    private var started = false
    private val flushMutex = Mutex()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun record(
        type: String,
        scenarioKey: String? = null,
        cardKeys: List<String> = emptyList(),
        reasonCannotAccept: String? = null,
        reasonAbandon: String? = null,
    ) {
        val previous = state.pendingActions.lastOrNull()?.sequence ?: state.lastSyncedSequence
        state.pendingActions = state.pendingActions + CardGameSyncAction(
            sequence = previous + 1,
            actionType = type,
            scenarioKey = scenarioKey,
            cardKeys = cardKeys,
            reasonCannotAccept = reasonCannotAccept,
            reasonAbandon = reasonAbandon,
        )
        persist()
        scope.launch { runCatching { flush() } }
    }

    suspend fun flush() = flushMutex.withLock {
        ensureStarted()
        while (state.pendingActions.isNotEmpty()) {
            val batch = state.pendingActions.take(50)
            val remote = supabase.syncCardGameSession(
                sessionId = state.sessionId,
                expectedStateVersion = state.serverStateVersion,
                actions = batch,
            )
            state.serverStateVersion = remote.stateVersion
            state.lastSyncedSequence = remote.lastActionSeq
            state.pendingActions = state.pendingActions.filter { it.sequence > remote.lastActionSeq }
            persist()
        }
    }

    suspend fun complete() {
        flush()
        check(state.pendingActions.isEmpty()) { "仍有未同步的操作" }
        supabase.completeCardGameSession(
            sessionId = state.sessionId,
            expectedStateVersion = state.serverStateVersion,
        )
        clearLocalState()
    }

    fun clearLocalState() {
        prefs.edit().remove(storageKey(state.userId, state.gameKey)).apply()
    }

    private suspend fun ensureStarted() {
        if (started) return
        val remote = supabase.startCardGameSession(
            sessionId = state.sessionId,
            clientSessionId = state.clientSessionId,
            gameKey = state.gameKey,
            catalogVersion = state.catalogVersion,
            seed = state.seed,
        )
        state.serverStateVersion = remote.stateVersion
        state.lastSyncedSequence = remote.lastActionSeq
        state.pendingActions = state.pendingActions.filter { it.sequence > remote.lastActionSeq }
        started = true
        persist()
    }

    private fun persist() {
        runCatching {
            val encoded = CardGamePrefs.json.encodeToString(LocalState.serializer(), state)
            prefs.edit().putString(storageKey(state.userId, state.gameKey), encoded).apply()
        }
    }

    companion object {
        private fun storageKey(userId: String, gameKey: String): String =
            "card_game_sync_v2_${userId}_$gameKey"

        /**
         * 创建/恢复本地会话协调器。无有效登录或 jwt 失败时返回 null（调用方回退无同步模式）。
         */
        suspend fun create(
            kind: CardGameKind,
            catalogVersion: Int,
            supabase: SupabaseService,
            prefs: SharedPreferences,
        ): CardGameSessionCoordinator? {
            runCatching { supabase.jwt() }.getOrNull() ?: return null
            val userId = supabase.userId.value ?: return null
            val key = storageKey(userId, kind.rawValue)
            val existing = prefs.getString(key, null)?.let {
                runCatching { CardGamePrefs.json.decodeFromString(LocalState.serializer(), it) }.getOrNull()
            }
            val canResume = existing?.schemaVersion == 1 && existing.catalogVersion == catalogVersion
            val state = if (canResume) existing!! else LocalState(
                schemaVersion = 1,
                userId = userId,
                gameKey = kind.rawValue,
                catalogVersion = catalogVersion,
                sessionId = UUID.randomUUID().toString(),
                clientSessionId = UUID.randomUUID().toString(),
                seed = Random.nextLong(0, Int.MAX_VALUE.toLong() + 1),
                serverStateVersion = 0,
                lastSyncedSequence = 0,
                pendingActions = emptyList(),
            )
            val coordinator = CardGameSessionCoordinator(state, canResume, supabase, prefs)
            coordinator.persist()
            return coordinator
        }

        /** 已存在的本地会话锁定的目录版本（供加载目录时对齐版本）。 */
        suspend fun pinnedCatalogVersion(
            kind: CardGameKind,
            supabase: SupabaseService,
            prefs: SharedPreferences,
        ): Int? {
            runCatching { supabase.jwt() }.getOrNull()
            val userId = supabase.userId.value ?: return null
            val raw = prefs.getString(storageKey(userId, kind.rawValue), null) ?: return null
            val state = runCatching {
                CardGamePrefs.json.decodeFromString(LocalState.serializer(), raw)
            }.getOrNull() ?: return null
            return if (state.schemaVersion == 1) state.catalogVersion else null
        }
    }
}

// MARK: - 本地完成标记 + 局内快照（对应 iOS CardGameLocalRecord）

object CardGameLocalRecord {
    private fun legacyDoneKey(kind: CardGameKind) = "kaleido_cardgame_done_${kind.rawValue}"
    private fun legacyProgressKey(kind: CardGameKind) = "kaleido_cardgame_progress_${kind.rawValue}_v1"

    private fun doneKey(kind: CardGameKind, scope: String?): String =
        if (scope.isNullOrEmpty()) legacyDoneKey(kind)
        else "kaleido_cardgame_done_${scope}_${kind.rawValue}"

    private fun progressKey(kind: CardGameKind, scope: String?): String =
        if (scope.isNullOrEmpty()) legacyProgressKey(kind)
        else "kaleido_cardgame_progress_${scope}_${kind.rawValue}_v1"

    /** 首次登录后把旧版未分用户缓存搬入当前账号，搬完即删旧 key。 */
    private fun migrateLegacyIfNeeded(kind: CardGameKind, scope: String?, prefs: SharedPreferences) {
        if (scope.isNullOrEmpty()) return
        val scopedDone = doneKey(kind, scope)
        val legacyDone = legacyDoneKey(kind)
        if (!prefs.contains(scopedDone) && prefs.contains(legacyDone)) {
            prefs.edit().putBoolean(scopedDone, prefs.getBoolean(legacyDone, false)).remove(legacyDone).apply()
        }
        val scopedProgress = progressKey(kind, scope)
        val legacyProgress = legacyProgressKey(kind)
        if (!prefs.contains(scopedProgress) && prefs.contains(legacyProgress)) {
            val data = prefs.getString(legacyProgress, null)
            if (data != null) {
                prefs.edit().putString(scopedProgress, data).remove(legacyProgress).apply()
            }
        }
    }

    fun isDone(kind: CardGameKind, scope: String?, prefs: SharedPreferences): Boolean {
        migrateLegacyIfNeeded(kind, scope, prefs)
        return prefs.getBoolean(doneKey(kind, scope), false)
    }

    fun markDone(kind: CardGameKind, scope: String?, prefs: SharedPreferences) {
        migrateLegacyIfNeeded(kind, scope, prefs)
        prefs.edit().putBoolean(doneKey(kind, scope), true).apply()
    }

    fun saveProgress(data: String, kind: CardGameKind, scope: String?, prefs: SharedPreferences) {
        migrateLegacyIfNeeded(kind, scope, prefs)
        prefs.edit().putString(progressKey(kind, scope), data).apply()
    }

    fun progressData(kind: CardGameKind, scope: String?, prefs: SharedPreferences): String? {
        migrateLegacyIfNeeded(kind, scope, prefs)
        return prefs.getString(progressKey(kind, scope), null)
    }

    fun clearProgress(kind: CardGameKind, scope: String?, prefs: SharedPreferences) {
        migrateLegacyIfNeeded(kind, scope, prefs)
        prefs.edit().remove(progressKey(kind, scope)).apply()
    }

    fun hasProgress(kind: CardGameKind, scope: String?, prefs: SharedPreferences): Boolean =
        progressData(kind, scope, prefs) != null

    fun doneKinds(kinds: List<CardGameKind>, scope: String?, prefs: SharedPreferences): Set<CardGameKind> =
        kinds.filter { isDone(it, scope, prefs) }.toSet()

    fun progressKinds(kinds: List<CardGameKind>, scope: String?, prefs: SharedPreferences): Set<CardGameKind> =
        kinds.filter { hasProgress(it, scope, prefs) }.toSet()
}
