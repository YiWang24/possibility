package app.possibility.android.features.diary

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.possibility.android.core.model.DiarySummaryResponse
import app.possibility.android.core.network.RemoteDiaryEntry
import app.possibility.android.core.network.SupabaseService
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

// 语音日记详情页视图模型 —— 对应 ios/Possibility/Features/Diary/DiaryModel.swift。
//
// 三视图切换（day/month/year）+ 选中日期；所有日记与总结都来自用户的云端数据。
// 轻量 Compose 状态容器：由 DiaryDetailSheet remember 持有。

/** 情绪词 → emoji 映射（对应 ios EmotionEmoji，首页周历与日记详情共用一张表）。 */
private object EmotionEmoji {
    fun emoji(emotion: String?, whenMissing: String = "😐"): String {
        if (emotion.isNullOrEmpty()) return whenMissing
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

/** created_at 统一解析 / 展示（对应 ios SupabaseTimestamp）。解析成瞬时后按本地时区格式化。 */
private object DiaryTimestamp {
    private val dayFmt = DateTimeFormatter.ofPattern("yyyy-MM-dd")

    /** created_at 字符串 → 本地时区 LocalDate；不认识的格式返回 null。 */
    fun localDate(raw: String?): LocalDate? {
        if (raw.isNullOrEmpty()) return null
        val normalized = raw.replace(" ", "T")
        val instant = runCatching { OffsetDateTime.parse(normalized).toInstant() }.getOrNull()
            ?: runCatching { Instant.parse(normalized) }.getOrNull()
            ?: runCatching {
                LocalDateTime.parse(normalized.take(19)).toInstant(ZoneOffset.UTC)
            }.getOrNull()
            ?: return null
        return instant.atZone(ZoneId.systemDefault()).toLocalDate()
    }

    /** "yyyy-MM-dd"（本地时区）。 */
    fun dayString(date: LocalDate): String = date.format(dayFmt)

    /** "M月d日 · 周x"（日记详情 label）。 */
    fun diaryLabel(date: LocalDate): String =
        "${date.monthValue}月${date.dayOfMonth}日 · ${weekday(date.dayOfWeek)}"

    private fun weekday(day: DayOfWeek): String = when (day) {
        DayOfWeek.MONDAY -> "周一"
        DayOfWeek.TUESDAY -> "周二"
        DayOfWeek.WEDNESDAY -> "周三"
        DayOfWeek.THURSDAY -> "周四"
        DayOfWeek.FRIDAY -> "周五"
        DayOfWeek.SATURDAY -> "周六"
        DayOfWeek.SUNDAY -> "周日"
    }
}

/** 日期轨条目。 */
data class DiaryRailItem(val date: String, val day: Int, val week: String, val emoji: String?)

class DiaryModel(
    private val service: SupabaseService = SupabaseService.shared,
    /** 今天是否已录音（由首页推导传入）。 */
    private val hasRecordedToday: Boolean = false,
    /** 指定初始选中日期（"yyyy-MM-dd"）；null 走默认策略。 */
    launchDate: String? = null,
) {

    enum class ViewKind(val label: String) {
        DAY("每日记录"),
        MONTH("月度总结"),
        YEAR("年度总结"),
    }

    var view by mutableStateOf(ViewKind.DAY)
    var selectedDate by mutableStateOf(
        launchDate ?: todayDate,
    )
        private set
    private var selectedEntryId by mutableStateOf<String?>(null)
    var isPlaying by mutableStateOf(false)

    /** 「更新总结」加载中（真实重新拉取 diary-summary）。 */
    var refreshing by mutableStateOf(false)
        private set

    /** 云端真实日记（list-diary，分页取完）。 */
    private var remoteNotes by mutableStateOf<List<DiaryNote>>(emptyList())

    var diaryLoading by mutableStateOf(false)
        private set
    var diaryLoadError by mutableStateOf(false)
        private set

    /** 云端月/年总结（diary-summary）；null 表示尚未生成或请求失败。 */
    var monthSummary by mutableStateOf<DiarySummaryResponse?>(null)
        private set
    var yearSummary by mutableStateOf<DiarySummaryResponse?>(null)
        private set

    var monthSummaryError by mutableStateOf(false)
        private set
    var yearSummaryError by mutableStateOf(false)
        private set

    // MARK: 真实日记

    suspend fun loadRemote() {
        diaryLoading = true
        diaryLoadError = false
        try {
            val rows = mutableListOf<RemoteDiaryEntry>()
            var offset = 0
            val pageSize = 100
            while (true) {
                val page = service.listDiary(limit = pageSize, offset = offset)
                rows += page
                if (page.size < pageSize) break
                offset += page.size
            }
            remoteNotes = rows.mapNotNull(::note)
            if (selectedDate == todayDate && remoteNotes.none { it.date == todayDate }) {
                remoteNotes.maxByOrNull { it.date }?.let { selectedDate = it.date }
            }
            selectedEntryId = remoteNotes.lastOrNull { it.date == selectedDate }?.id
        } catch (_: Exception) {
            diaryLoadError = true
        } finally {
            diaryLoading = false
        }
    }

    // MARK: 月/年总结（diary-summary 真实聚合）

    /** 并发拉取月 + 年总结；失败只显示明确空态，不展示虚构总结。 */
    suspend fun loadSummaries() = coroutineScope {
        val month = async { runCatching { service.diarySummary("month", currentMonthRef) } }
        val year = async { runCatching { service.diarySummary("year", currentYearRef) } }
        month.await().fold(
            onSuccess = { monthSummary = it; monthSummaryError = false },
            onFailure = { monthSummaryError = true },
        )
        year.await().fold(
            onSuccess = { yearSummary = it; yearSummaryError = false },
            onFailure = { yearSummaryError = true },
        )
    }

    /** 「更新总结」：重新拉取对应周期；返回是否成功（供 toast 提示）。 */
    suspend fun refreshSummary(isMonth: Boolean): Boolean {
        if (refreshing) return false
        refreshing = true
        return try {
            if (isMonth) {
                val m = runCatching { service.diarySummary("month", currentMonthRef) }.getOrNull()
                    ?: run { monthSummaryError = true; return false }
                monthSummary = m
                monthSummaryError = false
            } else {
                val y = runCatching { service.diarySummary("year", currentYearRef) }.getOrNull()
                    ?: run { yearSummaryError = true; return false }
                yearSummary = y
                yearSummaryError = false
            }
            true
        } finally {
            refreshing = false
        }
    }

    /** 远端行 → DiaryNote（真实表无标题 / emoji / 时长等富字段，做合理降级）。 */
    private fun note(row: RemoteDiaryEntry): DiaryNote? {
        val transcript = row.transcript
        if (transcript.isNullOrEmpty()) return null
        val date = row.localDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
            ?: DiaryTimestamp.localDate(row.recordedAt ?: row.createdAt)
            ?: return null
        // 标题 = 转写首句截断
        val firstSentence = transcript
            .split('。', '！', '？', '!', '?', '\n')
            .firstOrNull { it.isNotEmpty() } ?: transcript
        val emotions = row.emotions ?: emptyList()
        return DiaryNote(
            id = row.entryId ?: row.id.toString(),
            date = DiaryTimestamp.dayString(date),
            label = DiaryTimestamp.diaryLabel(date),
            // 情绪缺失时保留「🎙 仅有录音」语义
            emoji = EmotionEmoji.emoji(emotions.firstOrNull(), whenMissing = "🎙"),
            emotion = if (emotions.isEmpty()) "已记录" else emotions.joinToString("，"),
            duration = row.durationMs?.let(::formatDuration) ?: if (row.hasAudio) "录音" else "文字",
            title = row.title?.takeIf { it.isNotBlank() } ?: firstSentence.take(24),
            keywords = row.keywords ?: emptyList(),
            transcript = transcript.split('\n').filter { it.trim().isNotEmpty() },
        )
    }

    // MARK: 派生数据

    private fun formatDuration(durationMs: Long): String {
        val totalSeconds = (durationMs / 1000).coerceAtLeast(0)
        return String.format(java.util.Locale.ROOT, "%d:%02d", totalSeconds / 60, totalSeconds % 60)
    }

    /** 全部条目均来自当前用户的云端日记。 */
    val entries: List<DiaryNote>
        get() = remoteNotes.sortedBy { it.date }

    val selectedEntry: DiaryNote?
        get() = selectedEntryId?.let { id -> entries.firstOrNull { it.id == id } }
            ?: entries.lastOrNull { it.date == selectedDate }

    /** 选中条目在列表中的序号（波形 seed）。 */
    val selectedIndex: Int
        get() = entries.indexOfFirst { it.id == selectedEntry?.id }.coerceAtLeast(0)

    /** 日期轨：真实日记日期 + 今天（没有记录时补空位）。 */
    val railDates: List<DiaryRailItem>
        get() {
            val rail = entries.groupBy { it.date }.map { (date, notes) ->
                val latest = notes.last()
                DiaryRailItem(
                    date = date,
                    day = latest.dayNumber,
                    week = if (date == todayDate) "今天" else latest.weekday,
                    emoji = latest.emoji,
                )
            }.toMutableList()
            if (rail.none { it.date == todayDate }) {
                rail.add(DiaryRailItem(todayDate, LocalDate.now().dayOfMonth, "今天", null))
            }
            return rail.sortedBy { it.date }
        }

    fun select(date: String) {
        selectedDate = date
        selectedEntryId = entries.lastOrNull { it.date == date }?.id
        isPlaying = false
    }

    fun selectEntry(entry: DiaryNote) {
        selectedDate = entry.date
        selectedEntryId = entry.id
        isPlaying = false
    }

    fun isSelected(entry: DiaryNote): Boolean = selectedEntry?.id == entry.id

    fun togglePlaying() {
        isPlaying = !isPlaying
    }

    fun switchView(kind: ViewKind) {
        view = kind
    }

    companion object {
        /** 今天（本地时区）"yyyy-MM-dd"。 */
        val todayDate: String
            get() = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"))

        /** 当前月 ref："yyyy-MM"（服务端按 UTC 边界聚合）。 */
        val currentMonthRef: String
            get() = LocalDate.now(ZoneOffset.UTC).format(DateTimeFormatter.ofPattern("yyyy-MM"))

        /** 当前年 ref："yyyy"（同上，按服务端 UTC 边界取年份）。 */
        val currentYearRef: String
            get() = LocalDate.now(ZoneOffset.UTC).format(DateTimeFormatter.ofPattern("yyyy"))
    }
}
