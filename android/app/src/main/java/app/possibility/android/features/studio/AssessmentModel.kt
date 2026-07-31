package app.possibility.android.features.studio

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.possibility.android.core.network.SupabaseService
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.math.roundToInt

// MARK: - 统一测评引擎（迁移自 iOS AssessmentModel.swift）
//
// intro → questions（逐题 5 点量表，选择即自动保存，可中途退出续答）→ result。
// 进度本地持久化到 SharedPreferences（JSON），key 与 iOS UserDefaults 语义一致。
// 完成并写入画像时经 SupabaseService.saveDimensionRemote 上报（原始答案默认私密）。

/** 测评结果（维度→分数、facet→百分比、排序、并列组、编码）。 */
@Serializable
data class AssessmentResult(
    /** 维度 → 分数（holland 为总分 0–20，demo 为百分比 0–100） */
    val scores: Map<String, Int>,
    /** facet → 百分比（仅大五） */
    val facets: Map<String, Int>? = null,
    /** 分数降序的维度键 */
    val ordered: List<String>,
    /** 并列组展开选中的维度（holland tie 处理） */
    val selected: List<String>? = null,
    val code: String? = null,
    val displayCode: String? = null,
    /** epoch 毫秒 */
    val completedAt: Long,
)

/** SharedPreferences 持久化载荷。 */
@Serializable
private data class Persisted(
    val phase: String? = null,
    val index: Int? = null,
    val answers: List<Int?>,
    val result: AssessmentResult? = null,
)

class AssessmentModel(kind: AssessmentKind, private val context: Context) {

    enum class Phase { INTRO, QUESTIONS, RESULT }

    val config: AssessmentConfig = AssessmentData.config(kind)

    var phase by mutableStateOf(Phase.INTRO)
    var index by mutableStateOf(0)
        private set

    /** 每题 0–4，null 未答 */
    var answers by mutableStateOf(List<Int?>(config.items.size) { null })
        private set

    var result by mutableStateOf<AssessmentResult?>(null)
        private set

    private val prefs = studioPrefs(context)

    init {
        load()
    }

    val storeKey: String
        get() = when (config.kind) {
            AssessmentKind.HOLLAND -> "kaleido_assessment_holland_v1"
            AssessmentKind.BIGFIVE -> "kaleido_demo_assessment_bigfive_v2"
            else -> "kaleido_demo_assessment_${config.kind.id}_v1"
        }

    val answeredCount: Int get() = answers.count { it != null }
    val progress: Float get() = answeredCount.toFloat() / config.items.size
    val isLast: Boolean get() = index == config.items.size - 1
    val currentAnswer: Int? get() = answers[index]

    // MARK: 持久化

    private fun load() {
        val raw = prefs.getString(storeKey, null) ?: return
        val saved = runCatching { prefsJson.decodeFromString<Persisted>(raw) }.getOrNull() ?: return
        if (saved.answers.size != config.items.size) return
        answers = saved.answers
        result = saved.result
        saved.index?.let { index = it.coerceIn(0, config.items.size - 1) }
    }

    fun persist() {
        val payload = Persisted(
            phase = if (phase == Phase.QUESTIONS) "questions" else "intro",
            index = index,
            answers = answers,
            result = result,
        )
        runCatching { prefs.edit().putString(storeKey, prefsJson.encodeToString<Persisted>(payload)).apply() }
    }

    // MARK: 流程

    fun begin() {
        index = answers.indexOfFirst { it == null }.let { if (it < 0) 0 else it }
        phase = Phase.QUESTIONS
    }

    fun select(value: Int) {
        answers = answers.toMutableList().also { it[index] = value }
        persist()
    }

    fun previous() {
        if (index <= 0) return
        index -= 1
        persist()
    }

    /** 下一题；已是末题则校验空题或结算。返回 toast 提示（如有）。 */
    fun next(): String? {
        if (answers[index] == null) return null
        if (!isLast) {
            index += 1
            persist()
            return null
        }
        val missing = answers.indexOfFirst { it == null }
        if (missing >= 0) {
            index = missing
            return "还有一道题没有回答"
        }
        complete()
        return null
    }

    // MARK: 结算

    private fun complete() {
        if (config.kind == AssessmentKind.HOLLAND) completeHolland() else completeDemo()
        phase = Phase.RESULT
        persist()
    }

    private fun completeHolland() {
        val scores = LinkedHashMap<String, Int>()
        config.items.forEachIndexed { i, item ->
            scores[item.dim] = (scores[item.dim] ?: 0) + (answers[i] ?: 0)
        }
        val dimOrder = config.dims.map { it.key }
        val ordered = dimOrder.sortedWith(
            compareByDescending<String> { scores[it] ?: 0 }.thenBy { dimOrder.indexOf(it) },
        )
        // 按分数层级展开并列组，直到 ≥3 个
        val selected = mutableListOf<String>()
        val displayGroups = mutableListOf<String>()
        val levels = ordered.map { scores[it] ?: 0 }.distinct()
        for (level in levels) {
            val group = ordered.filter { (scores[it] ?: 0) == level }
            selected.addAll(group)
            displayGroups.add(group.joinToString("/"))
            if (selected.size >= 3) break
        }
        result = AssessmentResult(
            scores = scores,
            facets = null,
            ordered = ordered,
            selected = selected,
            code = ordered.take(3).joinToString(""),
            displayCode = displayGroups.joinToString("-"),
            completedAt = System.currentTimeMillis(),
        )
    }

    private fun completeDemo() {
        val totals = HashMap<String, Int>()
        val counts = HashMap<String, Int>()
        val facetTotals = HashMap<String, Int>()
        val facetCounts = HashMap<String, Int>()
        config.items.forEachIndexed { i, item ->
            val value = if (item.reversed) 4 - (answers[i] ?: 0) else (answers[i] ?: 0)
            totals[item.dim] = (totals[item.dim] ?: 0) + value
            counts[item.dim] = (counts[item.dim] ?: 0) + 1
            item.facet?.let { f ->
                facetTotals[f] = (facetTotals[f] ?: 0) + value
                facetCounts[f] = (facetCounts[f] ?: 0) + 1
            }
        }
        val scores = LinkedHashMap<String, Int>()
        for (dim in config.dims) {
            val key = dim.key
            val pct = (totals[key] ?: 0).toDouble() / ((counts[key] ?: 1) * 4) * 100
            scores[key] = pct.roundToInt()
        }
        val facets = LinkedHashMap<String, Int>()
        for ((f, total) in facetTotals) {
            val pct = total.toDouble() / ((facetCounts[f] ?: 1) * 4) * 100
            facets[f] = pct.roundToInt()
        }
        val dimOrder = config.dims.map { it.key }
        val ordered = dimOrder.sortedWith(
            compareByDescending<String> { scores[it] ?: 0 }.thenBy { dimOrder.indexOf(it) },
        )
        result = AssessmentResult(
            scores = scores,
            facets = facets.ifEmpty { null },
            ordered = ordered,
            selected = null,
            code = null,
            displayCode = null,
            completedAt = System.currentTimeMillis(),
        )
    }

    // MARK: 结果展示文案

    val resultTags: List<String>
        get() {
            val res = result ?: return emptyList()
            return when (config.kind) {
                AssessmentKind.HOLLAND -> {
                    val top = res.selected ?: res.ordered.take(3)
                    top.map { config.dim(it).label }
                }
                AssessmentKind.BIGFIVE -> config.dims.map { d ->
                    if ((res.scores[d.key] ?: 0) >= 58) d.label
                    else AssessmentData.bigfiveLowLabels[d.key] ?: d.label
                }
                AssessmentKind.LOVE -> listOf(
                    if ((res.scores["anxiety"] ?: 0) >= 58) "及时回应" else "稳定信任",
                    if ((res.scores["avoidance"] ?: 0) >= 58) "尊重边界" else "亲密联结",
                    "冲突后愿意修复",
                )
                else -> res.ordered.take(3).map { config.dim(it).label }
            }
        }

    val resultNarrative: String
        get() {
            val res = result ?: return ""
            return when (config.kind) {
                AssessmentKind.HOLLAND -> {
                    if ((res.selected ?: emptyList()).size > 3) {
                        "你的六类兴趣比较接近。这不表示没有特点，可能意味着你能从多种活动中获得动力，也需要更多真实体验来拉开偏好。"
                    } else {
                        val a = res.ordered[0]
                        val b = res.ordered[1]
                        AssessmentData.hollandPairNarrative[a + b]
                            ?: "你的兴趣主要落在${config.dim(a).name}与${config.dim(b).name}之间。它们可以出现在很多行业、角色和生活项目里。"
                    }
                }
                AssessmentKind.LOVE -> {
                    val a = res.scores["anxiety"] ?: 0
                    val v = res.scores["avoidance"] ?: 0
                    when {
                        a >= 58 && v >= 58 -> "你既需要明确的回应，也会在过度靠近时保护自己的空间。关系里的确定感与边界感需要同时被看见。"
                        a >= 58 -> "你更容易通过及时回应、稳定承诺与冲突后的修复获得安全感。沉默和悬而未决可能比争执本身更消耗你。"
                        v >= 58 -> "你重视自主与边界，更愿意在不被催促和侵入的前提下逐渐靠近。被尊重空间会帮助你表达需要。"
                        else -> "你通常能在亲密与自主之间保持相对稳定，更看重坦诚、信任和双方都愿意修复关系。"
                    }
                }
                else -> {
                    val top = res.ordered.take(2)
                    val d0 = config.dim(top[0])
                    val d1 = config.dim(top[1])
                    "目前最突出的两个信号是“${d0.label}”和“${d1.label}”。${d0.desc}；同时也表现出${d1.desc}的倾向。"
                }
            }
        }

    /** 大五：得分最高的 6 个细分面向（facet, 分数）。 */
    val topFacets: List<Pair<Facet, Int>>
        get() {
            val facets = result?.facets ?: return emptyList()
            return facets.entries
                .sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key })
                .take(6)
                .mapNotNull { entry -> AssessmentData.facetMeta(entry.key)?.let { it to entry.value } }
        }

    // MARK: 写入画像（原型 saveHollandToProfile / saveDemoAssessmentToProfile）

    /** 完成后把结果写入云端画像并上报原始答案（大五写人格底色，其余写对应维度）。 */
    suspend fun saveToProfile() {
        val res = result ?: return
        val service = SupabaseService.shared
        val tags = resultTags
        val answersInt = answers.filterNotNull()
        val scores = res.scores
        if (config.kind == AssessmentKind.BIGFIVE) {
            var text = "大五：" + tags.take(3).joinToString(" · ")
            MBTIStore.current(context)?.let { text += " · MBTI：$it" }
            service.saveDimensionRemote(
                dimension = "personality",
                tags = listOf(text),
                source = "assessment",
                assessmentKind = config.kind.id,
                assessmentAnswers = answersInt,
                assessmentScores = scores,
            )
        } else {
            val dim = config.kind.targetDimension ?: return
            service.saveDimensionRemote(
                dimension = dim,
                tags = tags,
                source = "assessment",
                assessmentKind = config.kind.id,
                assessmentAnswers = answersInt,
                assessmentScores = scores,
            )
        }
    }

    // MARK: 静态状态查询（画像工坊卡片展示，不建整个引擎）

    data class Snapshot(val answered: Int, val total: Int, val result: AssessmentResult?)

    companion object {
        private val prefsJson = Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
        }

        fun snapshot(context: Context, kind: AssessmentKind): Snapshot {
            val model = AssessmentModel(kind, context)
            return Snapshot(model.answeredCount, model.config.items.size, model.result)
        }
    }
}

// MARK: - MBTI 徽标（原型 MBTI_STORE_KEY）

object MBTIStore {
    const val KEY = "kaleido_mbti_badge_v1"

    fun current(context: Context): String? = studioPrefs(context).getString(KEY, null)

    fun save(context: Context, type: String) {
        studioPrefs(context).edit().putString(KEY, type).apply()
    }
}
