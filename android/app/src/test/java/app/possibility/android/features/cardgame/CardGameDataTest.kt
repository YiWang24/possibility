package app.possibility.android.features.cardgame

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CardGameDataTest {
    @Test
    fun everyWireKeyResolvesToItsGameKind() {
        CardGameKind.entries.forEach { kind ->
            assertEquals(kind, CardGameKind.fromKey(kind.rawValue))
        }
        assertNull(CardGameKind.fromKey("unknown"))
    }

    @Test
    fun resultDimensionsMatchProfileContract() {
        assertNull(CardGameKind.LIFE.targetDimension)
        assertEquals("love", CardGameKind.MARRIAGE.targetDimension)
        assertEquals("family", CardGameKind.FAMILY.targetDimension)
        assertEquals("social", CardGameKind.SOCIAL.targetDimension)
    }
}
