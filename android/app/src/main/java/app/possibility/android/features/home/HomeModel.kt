package app.possibility.android.features.home

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import app.possibility.android.core.model.DiaryAnalysis
import app.possibility.android.core.model.PersonaJob
import app.possibility.android.core.network.SupabaseService
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// MARK: - 首页「认识你自己」状态容器 —— 对应 ios/Possibility/Features/Home/HomeModel.swift
//
// 客户端 UI 状态（录音计时、输入框）留在此；服务端状态（画像/日记分析）经 SupabaseService 拉取。
// 语音转文字用 Android SpeechRecognizer（zh-CN 流式）；识别失败时明确提示用户重录或手动输入。
// 情绪/关键词绝不由客户端伪造：必须来自 analyze-diary。

class HomeModel(
    private val appContext: Context,
    private val service: SupabaseService = SupabaseService.shared,
) {

    // 状态更新必须在主线程；分析/计时/防抖任务都挂在此 scope 上
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    // MARK: 探索发问
    //
    // 默认不选话题（no-topic），选中话题且输入为空时填样例；再点选中的话题可取消。
    var question by mutableStateOf("")
    var topic by mutableStateOf<app.possibility.android.core.model.ExploreTopic?>(null)
        private set

    /** 点选话题：切换选中；选中且输入为空时填入样例问题。 */
    fun selectTopic(t: app.possibility.android.core.model.ExploreTopic) {
        topic = if (topic == t) null else t
        if (topic != null && trimmedQuestion.isEmpty()) {
            question = topic!!.sampleQuestion
        }
    }

    val trimmedQuestion: String get() = question.trim()
    val canSend: Boolean get() = trimmedQuestion.isNotEmpty()

    // MARK: 语音日记
    var isRecording by mutableStateOf(false)
        private set
    var elapsed by mutableStateOf(0)
        private set
    var analyzing by mutableStateOf(false)
        private set
    var analysis by mutableStateOf<DiaryAnalysis?>(null)
        private set
    var analysisError by mutableStateOf<String?>(null)
        private set

    /** 录完后展示、可编辑的转写全文（自己输入 = 手动修正后重新分析）。 */
    var transcript by mutableStateOf("")

    private var timerJob: Job? = null
    private var analyzeJob: Job? = null
    private var lastTranscript: String? = null

    /** 日记输入方式（voice / text）。重试沿用本次链路的原始方式。 */
    private var diaryInputMethod: String = "voice"

    val canRetryAnalysis: Boolean get() = lastTranscript != null

    val elapsedText: String
        get() = String.format(java.util.Locale.ROOT, "%d:%02d", elapsed / 60, elapsed % 60)

    fun toggleRecording() {
        if (isRecording) finishRecording() else startRecording()
    }

    private fun startRecording() {
        isRecording = true
        elapsed = 0
        analysis = null
        analysisError = null
        transcript = ""
        if (!startTranscriptionIfAvailable()) {
            isRecording = false
            analysisError = if (!hasAudioPermission()) {
                "需要麦克风权限才能记录语音；你也可以直接输入文字。"
            } else {
                "当前设备暂不支持语音识别，请直接输入文字。"
            }
            return
        }
        timerJob?.cancel()
        timerJob = scope.launch {
            while (isActive) {
                delay(1000)
                if (!isRecording) break
                elapsed += 1
            }
        }
    }

    fun finishRecording() {
        isRecording = false
        timerJob?.cancel()
        timerJob = null
        stopTranscription()
    }

    /**
     * 完成录音 → 将本次转写提交 analyze-diary（服务端按既有日记规则分析并落库）。
     * 未识别到真实文本时停止提交，绝不把演示内容写进用户日记。
     */
    fun startAnalyzeDiary() {
        if (analyzing) return
        diaryInputMethod = "voice"
        finishRecording()
        analyzing = true
        analysisError = null
        analyzeJob?.cancel()
        analyzeJob = scope.launch {
            // 端上转写有内容 → 稍等 SpeechRecognizer 交付最终识别结果
            if (sttStarted) delay(600)
            val text = (transcript.ifBlank { transcribedText }).trim()
            if (text.length < 4) {
                lastTranscript = null
                analysis = null
                analysisError = "没有识别到足够的内容，请重录或直接输入文字。"
                analyzing = false
                return@launch
            }
            lastTranscript = text
            transcript = text
            runAnalysis(text)
        }
    }

    /** 自己输入：用户手改转写全文后，用编辑文本重新提交 analyze-diary。文本为空则忽略。 */
    fun submitEditedTranscript() {
        if (analyzing) return
        val text = transcript.trim()
        if (text.isEmpty()) return
        diaryInputMethod = "text"
        transcript = text
        lastTranscript = text
        analyzing = true
        analysisError = null
        analyzeJob?.cancel()
        analyzeJob = scope.launch { runAnalysis(text) }
    }

    /** 复用同一份转写重试，避免失败后要求用户重新录音。 */
    fun startRetryAnalysis() {
        val text = lastTranscript ?: return
        if (analyzing) return
        analyzing = true
        analysisError = null
        analyzeJob?.cancel()
        analyzeJob = scope.launch { runAnalysis(text) }
    }

    /** 用户主动取消本次分析：网关偶发挂起可达上百秒，取消后可立即重试或重录。 */
    fun cancelAnalysis() {
        analyzeJob?.cancel()
        analyzeJob = null
        analyzing = false
        analysisError = null
    }

    /**
     * 单次提交 analyze-diary。最多等 50s —— 超时即当失败让用户快速重试。
     * 情绪/关键词绝不由客户端伪造，必须来自 analyze-diary。
     */
    private suspend fun runAnalysis(text: String) {
        analyzing = true
        try {
            val result = withTimeoutOrNull(50_000) {
                runCatching { service.analyzeDiary(text, diaryInputMethod) }.getOrNull()
            }
            if (!scope.isActive) return
            if (result != null) {
                analysis = result
                // analyze-diary 已同步写入 diary_entries；刷新今天的真实状态
                loadDiaryOverview()
            } else {
                analysis = null
                analysisError = "这次没能顺利分析，点「重试」再试一次。"
            }
        } finally {
            analyzing = false
        }
    }

    // MARK: 端上语音转写（Android SpeechRecognizer · zh-CN）
    //
    // 只接受设备实际识别结果；失败时由 UI 明确提示，不生成虚构转写。

    private var recognizer: SpeechRecognizer? = null
    private var sttStarted = false
    private var transcribedText = ""

    /** RECORD_AUDIO 是否已授权（由 UI 层 rememberLauncherForActivityResult 申请）。 */
    fun hasAudioPermission(): Boolean =
        ContextCompat.checkSelfPermission(appContext, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    private fun startTranscriptionIfAvailable(): Boolean {
        transcribedText = ""
        sttStarted = false
        if (!hasAudioPermission()) return false
        if (!SpeechRecognizer.isRecognitionAvailable(appContext)) return false
        // SpeechRecognizer 必须在主线程创建与调用
        val rec = runCatching { SpeechRecognizer.createSpeechRecognizer(appContext) }.getOrNull() ?: return false
        recognizer = rec
        rec.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    // The UI already shows the recording state; no second state transition is needed here.
                }
                override fun onBeginningOfSpeech() {
                    // Speech start does not change the diary recording lifecycle.
                }
                override fun onRmsChanged(rmsdB: Float) {
                    // Audio levels are intentionally not retained or rendered.
                }
                override fun onBufferReceived(buffer: ByteArray?) {
                    // Raw recognizer buffers are intentionally ignored; only transcript results are used.
                }
                override fun onEndOfSpeech() {
                    // Final transcript delivery is handled exclusively by onResults.
                }
                override fun onError(error: Int) {
                    sttStarted = false
                    releaseRecognizer()
                }
                override fun onEvent(eventType: Int, params: Bundle?) {
                    // Vendor-specific events are not part of the supported transcript contract.
                }

                override fun onPartialResults(partialResults: Bundle?) {
                    partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?.firstOrNull()?.let {
                            if (it.isNotEmpty()) {
                                transcribedText = it
                                transcript = it
                            }
                        }
                }

                override fun onResults(results: Bundle?) {
                    results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?.firstOrNull()?.let {
                            if (it.isNotEmpty()) {
                                transcribedText = it
                                transcript = it
                            }
                        }
                    sttStarted = false
                    releaseRecognizer()
                }
        })
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }
        return runCatching { rec.startListening(intent) }
            .onSuccess { sttStarted = true }
            .onFailure { releaseRecognizer() }
            .isSuccess
    }

    private fun stopTranscription() {
        val rec = recognizer ?: return
        runCatching { rec.stopListening() }
    }

    private fun releaseRecognizer() {
        val rec = recognizer ?: return
        runCatching { rec.destroy() }
        recognizer = null
    }

    // MARK: 动态画像（空白态 · 随探索生长）
    //
    // 6 维默认「尚未填写」（personality + 5 软维度），完成度 0% 起，每填一维 +≈17%。
    // 已填内容持久化到 SharedPreferences（本地私密），随后与云端 facts 合并。

    private val prefs = appContext.getSharedPreferences("kaleido_prefs", Context.MODE_PRIVATE)

    /** 已填维度：dimKey → 关键词拼接文本（含 personality）。 */
    var filledDims by mutableStateOf<Map<String, String>>(emptyMap())
        private set

    /** 人格底色（由大五测评结果写入）。 */
    val personalityText: String? get() = filledDims["personality"]

    private val allDimKeys: List<String> get() = listOf("personality") + DimensionKey.entries.map { it.id }

    /** 冷启动读取本地已填维度，随后云端 facts 合并（换机 / 重装漫游）。 */
    fun loadPortrait() {
        val loaded = mutableMapOf<String, String>()
        for (key in allDimKeys) {
            prefs.getString(STORE_PREFIX + key, null)?.takeIf { it.isNotEmpty() }?.let { loaded[key] = it }
        }
        filledDims = loaded

        refreshPersona()
        scope.launch {
            val remote = runCatching { service.fetchRemoteProfile() }.getOrNull() ?: return@launch
            val facts = remote.facts ?: return@launch
            // 从权威原子事实聚合；本地已有的以本地为准（刚编辑过更新）
            val grouped = facts.groupBy { it.dimension }
            val next = filledDims.toMutableMap()
            for ((key, group) in grouped) {
                val value = group.map { it.value }.filter { it.isNotEmpty() }.joinToString(" · ")
                if (value.isEmpty() || next[key] != null) continue
                next[key] = value
                prefs.edit().putString(STORE_PREFIX + key, value).apply()
            }
            filledDims = next
        }
    }

    /** 已保存关键词拆回数组（重开浮层时回显已选）。 */
    fun selectedKeywords(key: DimensionKey): List<String> {
        val text = filledDims[key.id] ?: return emptyList()
        return text.split(" · ").filter { it.isNotEmpty() }
    }

    /** 保存某维度的关键词 → 回填 + 本地持久化 + 云端落库（失败静默，本地已存）。 */
    fun saveDimension(key: DimensionKey, keywords: List<String>) {
        val picked = keywords.take(5)
        val text = picked.joinToString(" · ")
        if (text.isEmpty()) return
        filledDims = filledDims.toMutableMap().apply { put(key.id, text) }
        prefs.edit().putString(STORE_PREFIX + key.id, text).apply()
        scope.launch {
            // 先落库再重新生成云端形象（/persona 读服务端画像，需等新维度可见）
            runCatching { service.saveDimensionRemote(dimension = key.id, tags = picked, source = "manual") }
            scheduleRefreshPersona()
        }
    }

    /** 人格底色（大五测评 / MBTI 徽标写入）。 */
    fun savePersonality(text: String) {
        if (text.isEmpty()) return
        filledDims = filledDims.toMutableMap().apply { put("personality", text) }
        prefs.edit().putString(STORE_PREFIX + "personality", text).apply()
        scope.launch {
            runCatching { service.saveDimensionRemote(dimension = "personality", tags = listOf(text), source = "manual") }
            scheduleRefreshPersona()
        }
    }

    /** 一行画像。value 为 null 表示尚未填写（todo 虚线态）。 */
    data class PortraitDim(
        val id: String,
        val icon: String,
        val iconTint: Long,
        val label: String,
        val value: String?,
        /** null 表示人格底色，直接进入大五测评。 */
        val dimensionKey: DimensionKey?,
    ) {
        val isTodo: Boolean get() = value == null
    }

    /** 六维画像卡（人格底色 + 五软维度）。 */
    val portraitDims: List<PortraitDim>
        get() {
            val rows = mutableListOf(
                PortraitDim("personality", "◎", 0x5968D9, "人格底色", personalityText, null),
            )
            for (key in DimensionKey.entries) {
                val cfg = DimensionData.config(key)
                rows.add(PortraitDim(key.id, cfg.icon, cfg.tint, cfg.title, filledDims[key.id], key))
            }
            return rows
        }

    private fun completion(): Triple<Int, Int, Int> {
        val keys = allDimKeys
        val completed = keys.count { key -> filledDims[key]?.trim()?.isNotEmpty() == true }
        val percent = Math.round(completed.toFloat() / keys.size * 100)
        return Triple(completed, keys.size, percent)
    }

    val completedPortraitDimensionCount: Int get() = completion().first
    val portraitDimensionCount: Int get() = completion().second
    val completionPct: Int get() = completion().third

    // MARK: 云端数字形象（/persona 真实生成 · 本地兜底）

    /** 最近一次云端生成的形象参数；null = 未生成 / 失败（走本地兜底）。 */
    var remotePersona by mutableStateOf<PersonaJob.Persona?>(null)
        private set

    private var personaJob: Job? = null
    private var personaDebounce: Job? = null
    /** 上次成功触发生成时的画像快照（去重：画像没变不重复调 LLM）。 */
    private var lastPersonaSnapshot: String? = null

    /** 云端形象的一句话说明。 */
    val personaSummary: String? get() = remotePersona?.summary

    /** 画像维度变化后重新生成云端形象；失败或超时 15s 静默保持本地兜底。快照未变且已有形象时跳过。 */
    fun refreshPersona() {
        val snapshot = allDimKeys.mapNotNull { filledDims[it] }.joinToString("|")
        if (snapshot == lastPersonaSnapshot && remotePersona != null) return
        lastPersonaSnapshot = snapshot
        personaJob?.cancel()
        personaJob = scope.launch {
            val job = withTimeoutOrNull(15_000) {
                runCatching { service.personaGenerate() }.getOrNull()
            }
            if (job != null && job.status != "failed") {
                job.persona?.let { remotePersona = it }
            }
        }
    }

    /** refreshPersona 的 2s 防抖入口：连续保存多个维度时合并为一次生成。 */
    private fun scheduleRefreshPersona() {
        personaDebounce?.cancel()
        personaDebounce = scope.launch {
            delay(2000)
            refreshPersona()
        }
    }

    // MARK: 今日语音日记 / 探索天数

    /** 今天已有云端日记时的主情绪 emoji。 */
    private var todayEmoji: String? = null
    private var hasRemoteDiaryToday = false
    private var diaryEmojisByDay by mutableStateOf<Map<String, String>>(emptyMap())
    val hasRecordedToday: Boolean get() = analysis != null || hasRemoteDiaryToday

    /** 刚录完优先使用分析结果；云端已有记录则使用拉取到的真实情绪。 */
    val todayDisplayEmoji: String
        get() = analysis?.emotions?.firstOrNull()?.let { HomeEmotionEmoji.emoji(it) } ?: (todayEmoji ?: "")

    /** 已探索天数：最早一条真实日记距今 +1；无日记或尚未加载 = 第 1 天。 */
    var exploredDays by mutableStateOf(1)
        private set

    fun diaryEmoji(date: LocalDate): String = diaryEmojisByDay[date.format(DAY_FMT)].orEmpty()

    fun hasDiary(date: LocalDate): Boolean = diaryEmojisByDay.containsKey(date.format(DAY_FMT))

    /** 「今天」"yyyy-MM-dd"（本地时区）。 */
    val diaryTodayDate: String get() = LocalDate.now().format(DAY_FMT)

    @Serializable
    private data class DiaryPage(
        val entries: List<app.possibility.android.core.network.RemoteDiaryEntry> = emptyList(),
        val total: Int = 0,
    )

    /** POST /list-diary 分页（带 total，探索天数用）；复用 SupabaseService 的裸 HTTP + 宽容 JSON。 */
    private suspend fun listDiaryPage(limit: Int, offset: Int): DiaryPage? = withContext(Dispatchers.Default) {
        runCatching {
            val body = buildJsonObject {
                put("limit", limit)
                put("offset", offset)
            }.toString()
            val text = service.callFunctionRaw("list-diary", body, timeoutMillis = 20_000)
            SupabaseService.json.decodeFromString<DiaryPage>(text)
        }.getOrNull()
    }

    /** 拉取云端日记 → 今天真实状态 + 推算探索天数（冷启动调用，失败静默）。 */
    suspend fun loadDiaryOverview() {
        val page = listDiaryPage(limit = 50, offset = 0) ?: return
        val rows = page.entries

        // 天 → 当天最新一条情绪（list-diary 按时间倒序，首见即最新）
        val emotionsByDay = mutableMapOf<String, List<String>>()
        var earliest: LocalDate? = null
        for (row in rows) {
            val created = parseDay(row.createdAt) ?: continue
            if (earliest == null || created.isBefore(earliest)) earliest = created
            val key = created.format(DAY_FMT)
            if (emotionsByDay[key] == null) emotionsByDay[key] = row.emotions ?: emptyList()
        }

        // 日记总数超本窗：取最早一条修正探索天数，不被 50 条窗口截断低估
        if (page.total > rows.size) {
            listDiaryPage(limit = 1, offset = page.total - 1)?.entries?.firstOrNull()
                ?.let { parseDay(it.createdAt) }?.let { earliest = it }
        }

        val today = LocalDate.now()
        exploredDays = earliest?.let {
            val days = java.time.temporal.ChronoUnit.DAYS.between(it, today).toInt()
            maxOf(1, days + 1)
        } ?: 1

        val todayKey = today.format(DAY_FMT)
        hasRemoteDiaryToday = emotionsByDay[todayKey] != null
        todayEmoji = emotionsByDay[todayKey]?.let { HomeEmotionEmoji.emoji(it.firstOrNull()) }
        diaryEmojisByDay = emotionsByDay.mapValues { HomeEmotionEmoji.emoji(it.value.firstOrNull()) }
    }

    private fun parseDay(raw: String?): LocalDate? {
        if (raw.isNullOrEmpty()) return null
        val normalized = raw.replace(" ", "T")
        val instant = runCatching { java.time.OffsetDateTime.parse(normalized).toInstant() }.getOrNull()
            ?: runCatching { java.time.Instant.parse(normalized) }.getOrNull()
            ?: runCatching { java.time.LocalDateTime.parse(normalized.take(19)).toInstant(java.time.ZoneOffset.UTC) }.getOrNull()
            ?: return null
        return instant.atZone(ZoneId.systemDefault()).toLocalDate()
    }

    /** 释放资源（Composable onDispose 调用）。 */
    fun dispose() {
        timerJob?.cancel()
        analyzeJob?.cancel()
        personaJob?.cancel()
        personaDebounce?.cancel()
        releaseRecognizer()
    }

    val userName: String
        get() = service.emailDisplay?.substringBefore('@')?.take(16)?.takeIf { it.isNotBlank() } ?: "朋友"

    /** 问候语：按时段前缀 + 用户名。 */
    val greeting: String get() = "${greetingPrefix()}，$userName"

    /** "M月d日 · 周x"（问候区小字）。 */
    val todayText: String
        get() {
            val d = LocalDate.now()
            return "${d.monthValue}月${d.dayOfMonth}日 · ${weekdayZh(d.dayOfWeek)}"
        }

    private fun greetingPrefix(): String {
        val h = LocalTime.now().hour
        return when {
            h < 5 -> "夜深了"
            h < 11 -> "早上好"
            h < 13 -> "中午好"
            h < 18 -> "下午好"
            else -> "晚上好"
        }
    }

    private fun weekdayZh(day: java.time.DayOfWeek): String = when (day) {
        java.time.DayOfWeek.MONDAY -> "星期一"
        java.time.DayOfWeek.TUESDAY -> "星期二"
        java.time.DayOfWeek.WEDNESDAY -> "星期三"
        java.time.DayOfWeek.THURSDAY -> "星期四"
        java.time.DayOfWeek.FRIDAY -> "星期五"
        java.time.DayOfWeek.SATURDAY -> "星期六"
        java.time.DayOfWeek.SUNDAY -> "星期日"
    }

    companion object {
        private const val STORE_PREFIX = "kaleido_dim_"
        private val DAY_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd")
    }
}

/** 情绪词 → emoji（首页周历用；对应 iOS EmotionEmoji 精简表）。 */
internal object HomeEmotionEmoji {
    fun emoji(emotion: String?): String {
        if (emotion.isNullOrEmpty()) return ""
        for ((word, e) in table) if (emotion.contains(word)) return e
        return "😐"
    }

    private val table: List<Pair<String, String>> = listOf(
        "焦虑" to "😮‍💨", "担" to "😮‍💨", "疲" to "😮‍💨", "紧张" to "😮‍💨", "压力" to "😮‍💨",
        "平静" to "😌", "踏实" to "😌", "安心" to "😌", "放松" to "😌", "专注" to "😌", "释然" to "😌",
        "开心" to "😊", "喜悦" to "😊", "快乐" to "😊", "成就" to "😊", "兴奋" to "😊",
        "被支持" to "😊", "被看见" to "😊", "感激" to "😊", "温暖" to "😊",
        "纠结" to "😕", "犹豫" to "😕", "迷茫" to "😕", "受挫" to "😕", "委屈" to "😕", "怀疑" to "😕",
        "难过" to "😢", "低落" to "😢", "失落" to "😢", "孤独" to "😢", "伤心" to "😢",
        "生气" to "😠", "愤怒" to "😠", "烦" to "😠",
        "好奇" to "🙂", "期待" to "🙂", "轻松" to "🙂", "希望" to "🙂", "动力" to "🙂",
    )
}
