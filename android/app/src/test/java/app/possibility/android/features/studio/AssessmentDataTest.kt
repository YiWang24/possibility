package app.possibility.android.features.studio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AssessmentDataTest {
    @Test
    fun assessmentQuestionBanksAreComplete() {
        assertEquals(30, AssessmentData.config(AssessmentKind.HOLLAND).items.size)
        assertEquals(120, AssessmentData.config(AssessmentKind.BIGFIVE).items.size)
        assertEquals(15, AssessmentData.config(AssessmentKind.STRENGTH).items.size)
        assertEquals(18, AssessmentData.config(AssessmentKind.LOVE).items.size)
        assertEquals(20, AssessmentData.config(AssessmentKind.FAMILY).items.size)
    }

    @Test
    fun everyQuestionReferencesAKnownDimension() {
        AssessmentKind.entries.forEach { kind ->
            val config = AssessmentData.config(kind)
            val dimensions = config.dims.map { it.key }.toSet()
            assertTrue(config.items.all { it.dim in dimensions })
        }
    }
}
