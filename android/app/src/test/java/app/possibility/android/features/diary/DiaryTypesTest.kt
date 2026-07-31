package app.possibility.android.features.diary

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class DiaryTypesTest {
    @Test
    fun multipleEntriesOnTheSameDayKeepDistinctIdentity() {
        val first = note(id = "entry-a")
        val second = note(id = "entry-b")

        assertEquals(first.date, second.date)
        assertNotEquals(first.id, second.id)
        assertEquals(7, first.monthNumber)
        assertEquals(31, first.dayNumber)
    }

    private fun note(id: String) = DiaryNote(
        id = id,
        date = "2026-07-31",
        label = "7月31日 · 周五",
        emoji = "🙂",
        emotion = "平静",
        duration = "0:30",
        title = "真实记录",
        keywords = listOf("验证"),
        transcript = listOf("同一天可以保存多条日记。"),
    )
}
