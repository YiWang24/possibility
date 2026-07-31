package app.possibility.android.features.diary

/** A single diary entry rendered from the authenticated user's list-diary response. */
data class DiaryNote(
    val id: String,
    val date: String,
    val label: String,
    val emoji: String,
    val emotion: String,
    val duration: String,
    val title: String,
    val keywords: List<String>,
    val transcript: List<String>,
) {
    val dayNumber: Int get() = date.takeLast(2).toIntOrNull() ?: 0
    val monthNumber: Int get() = date.substringAfter('-').substringBefore('-').toIntOrNull() ?: 0
    val weekday: String get() = label.substringAfterLast('·').trim().ifEmpty { "记录" }
}

data class DiaryStat(val value: String, val label: String)

data class DiaryInsight(val cap: String?, val title: String, val body: String)
