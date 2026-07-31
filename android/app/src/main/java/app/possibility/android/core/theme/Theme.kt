package app.possibility.android.core.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/** 设计系统 · 色板与渐变 —— 与 ios/Possibility/Core/DesignSystem/Theme.swift 一一对应。 */
object Theme {

    // 基础色
    val stage = Color(0xFF05070D)
    val paper = Color(0xFF0A0C12)
    val card = Color(0xFF13161F)
    val raised = Color(0xFF1B1F2B)
    val ink = Color(0xFFF2F4F9)
    val sub = Color(0xFF98A0B3)
    val faint = Color(0xFF5A6172)
    val line = Color.White.copy(alpha = 0.08f)

    // 品牌色
    val blue = Color(0xFF5E96FF)
    val blueDeep = Color(0xFF2F63E8)
    val violetSoft = Color(0xFF8F7BFF)
    val pink = Color(0xFFF06ACD)
    val magenta = Color(0xFFE35CC1)
    val orange = Color(0xFFFF7A4D)
    val apricot = Color(0xFFFFB067)
    val teal = Color(0xFF3ED9A4)
    val lime = Color(0xFFD7F464)

    // 渐变
    val aurora = Brush.linearGradient(
        0.00f to Color(0xFF5E96FF),
        0.40f to Color(0xFF8F7BFF),
        0.75f to Color(0xFFE35CC1),
        1.00f to Color(0xFFFF7A4D),
    )

    val auroraDeep = Brush.linearGradient(
        0.00f to Color(0xFF2F63E8),
        0.60f to Color(0xFFB03390),
        1.00f to Color(0xFFE8542F),
    )

    val buttonGradient = Brush.linearGradient(
        colors = listOf(Color(0xFF6FA5FF), Color(0xFF2F63E8)),
    )

    val orbConicColors = listOf(
        Color(0xFF5E96FF), Color(0xFF8F7BFF),
        Color(0xFFE35CC1), Color(0xFFFF7A4D), Color(0xFF5E96FF),
    )

    // 旅人头像配色（HUES 0..4）
    data class Hue(val id: Int, val gradient: Brush, val accent: Color)

    val hues = listOf(
        Hue(0, Brush.linearGradient(
            0f to Color(0xFF0F1F52), 0.55f to Color(0xFF2E5EDB), 1f to Color(0xFF6FA5FF),
        ), Color(0xFF3D6EF0)),
        Hue(1, Brush.linearGradient(
            0f to Color(0xFF3A1035), 0.55f to Color(0xFFB03390), 1f to Color(0xFFF06ACD),
        ), Color(0xFFC445A4)),
        Hue(2, Brush.linearGradient(
            0f to Color(0xFF0E2A22), 0.60f to Color(0xFF1F8A66), 1f to Color(0xFF8FD84B),
        ), Color(0xFF2FA98C)),
        Hue(3, Brush.linearGradient(
            0f to Color(0xFF3A140C), 0.60f to Color(0xFFD14A24), 1f to Color(0xFFFF8A54),
        ), Color(0xFFE85A34)),
        Hue(4, Brush.linearGradient(
            0f to Color(0xFF171243), 0.60f to Color(0xFF4A3BD1), 1f to Color(0xFF8F7BFF),
        ), Color(0xFF6E58E8)),
    )

    fun hue(index: Int): Hue = hues[((index % hues.size) + hues.size) % hues.size]

    // 卡面点缀色：LLM 返回的颜色只当色相提示，一律吸附到品牌档位
    val cardAccents = listOf(blue, violetSoft, magenta, apricot, teal)

    private val cardAccentHues: List<Float> = cardAccents.map { it.hueOrZero() }

    fun cardAccent(near: Color?, index: Int): Color {
        val rotated = cardAccents[((index % cardAccents.size) + cardAccents.size) % cardAccents.size]
        val hsb = near?.hsb() ?: return rotated
        if (hsb.saturation <= 0.15f || hsb.brightness <= 0.12f) return rotated
        val nearest = cardAccentHues.withIndex().minByOrNull { hueDistance(it.value, hsb.hue) }
        return nearest?.let { cardAccents[it.index] } ?: rotated
    }

    private fun hueDistance(lhs: Float, rhs: Float): Float {
        val delta = kotlin.math.abs(lhs - rhs)
        return minOf(delta, 1f - delta)
    }

    object Radius {
        val card = 22.dp
        val sheet = 30.dp
        val chip = 999.dp
    }
}

data class Hsb(val hue: Float, val saturation: Float, val brightness: Float)

fun Color.hsb(): Hsb {
    val out = FloatArray(3)
    android.graphics.Color.RGBToHSV(
        (red * 255).toInt(), (green * 255).toInt(), (blue * 255).toInt(), out,
    )
    return Hsb(out[0] / 360f, out[1], out[2])
}

private fun Color.hueOrZero(): Float = hsb().hue

/** 解析 LLM 返回的 CSS 颜色（#RRGGBB / #RGB / rgb()），失败返回 null。 */
fun parseCssColor(raw: String?): Color? {
    val s = raw?.trim() ?: return null
    return runCatching {
        when {
            s.startsWith("#") && s.length == 7 -> Color(("FF" + s.drop(1)).toLong(16))
            s.startsWith("#") && s.length == 4 -> {
                val r = s[1]; val g = s[2]; val b = s[3]
                Color("FF$r$r$g$g$b$b".toLong(16))
            }
            s.startsWith("rgb") -> {
                val parts = s.substringAfter('(').substringBefore(')').split(',')
                    .map { it.trim().toFloat() }
                Color(parts[0] / 255f, parts[1] / 255f, parts[2] / 255f)
            }
            else -> null
        }
    }.getOrNull()
}

/** 通用卡片样式，对应 iOS `kaleidoCard` 修饰器。 */
fun Modifier.kaleidoCard(radius: androidx.compose.ui.unit.Dp = Theme.Radius.card): Modifier =
    this
        .clip(RoundedCornerShape(radius))
        .background(Theme.card)
        .border(1.dp, Theme.line, RoundedCornerShape(radius))
