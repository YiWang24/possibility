package app.possibility.android.features.chat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TarotEngineTest {
    @Test
    fun candidateDeckHasTwelveUniqueCards() {
        val candidates = TarotEngine.candidates()
        assertEquals(12, candidates.size)
        assertEquals(12, candidates.map { it.id }.distinct().size)
    }

    @Test
    fun threeCardsProduceConversationAnswer() {
        val reading = TarotEngine.reading("我是否应该创业？", TarotEngine.candidates().take(3))
        assertEquals(3, reading.cards.size)
        assertTrue(reading.answer.contains("先说结论"))
        assertTrue(reading.answer.contains("不是对未来的保证"))
    }

    @Test
    fun shortQuestionNeedsClarification() {
        assertTrue(TarotEngine.isUnclearQuestion("怎么办？"))
        assertFalse(TarotEngine.isUnclearQuestion("我是否应该从设计转做产品经理？"))
    }
}
