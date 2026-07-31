package app.possibility.android.features.home

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import app.possibility.android.core.model.PersonaJob
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

// MARK: - 画像驱动的抽象数字形象（对应 ios/Possibility/Features/Home/PersonaCanvasView.swift · 原型 dynamicPersona）
//
// 由画像文本 FNV-1a 哈希 + 关键词计分选出 4 种形态：折光晶灵 crystal / 共生花灵 bloom /
// 流光翼影 wing / 星轨旅者 orbit。mulberry32 种子保证同一画像稳定复现；帧驱动呼吸 / 公转 / 粒子。

enum class PersonaForm { CRYSTAL, BLOOM, WING, ORBIT }

/** 抽象数字形象参数（seed / form / hue / lobes 驱动绘制）。 */
data class PersonaShape(
    val seed: UInt,
    val filled: Int,
    val signature: List<String>,
    val form: PersonaForm,
    val hue: Double,
    val lobes: Double,
    val shapeName: String,
) {
    companion object {
        /** 由画像内容构建（对照原型 currentPersonaSnapshot + refreshDynamicPersona）。 */
        fun build(values: List<String>, signature: List<String>): PersonaShape {
            val text = (values + signature).joinToString("|")
            val seed = fnv1a(text.ifEmpty { "老己·持续探索" })
            val content = (values + signature).joinToString(" ")

            fun score(words: List<String>): Int =
                words.sumOf { content.split(it).size - 1 }

            data class Signal(val form: PersonaForm, val score: Int, val hue: Double, val lobes: Double, val name: String)
            val signals = listOf(
                Signal(PersonaForm.CRYSTAL, score(listOf("结构", "有序", "计划", "理性", "思考", "分析", "原则", "边界", "才华", "智商")), 216.0, 6.0, "折光晶灵"),
                Signal(PersonaForm.BLOOM, score(listOf("共情", "陪伴", "关系", "家庭", "亲情", "朋友", "人际", "真诚", "尊重", "回应", "交流", "支持", "爱", "善良", "信任")), 286.0, 7.0, "共生花灵"),
                Signal(PersonaForm.WING, score(listOf("视觉", "手绘", "创造", "审美", "表达", "自由", "好奇", "喜欢")), 190.0, 4.0, "流光翼影"),
                Signal(PersonaForm.ORBIT, score(listOf("独处", "探索", "学习", "尝试", "成长", "行动", "勇气", "坚强")), 248.0, 5.0, "星轨旅者"),
            )
            val top = signals.maxOf { it.score }
            val candidates = signals.filter { it.score == top }
            val pick = candidates[(seed % candidates.size.toUInt()).toInt()]
            return PersonaShape(
                seed = seed,
                filled = values.size,
                signature = signature,
                form = pick.form,
                hue = pick.hue + ((seed % 23u).toInt() - 11),
                lobes = pick.lobes,
                shapeName = pick.name,
            )
        }

        /** 后端 shape（中英）→ 本地形态；未知返回 null。 */
        fun formNamed(shape: String): PersonaForm? {
            val lower = shape.lowercase()
            return when {
                lower.contains("crystal") || shape.contains("晶") -> PersonaForm.CRYSTAL
                lower.contains("bloom") || shape.contains("花") -> PersonaForm.BLOOM
                lower.contains("wing") || shape.contains("翼") -> PersonaForm.WING
                lower.contains("orbit") || shape.contains("星") || shape.contains("轨") -> PersonaForm.ORBIT
                else -> null
            }
        }

        /** FNV-1a 32 位哈希（UTF-16 码元，对照原型 dynamicPersonaHash）。 */
        private fun fnv1a(text: String): UInt {
            var hash = 2166136261u
            for (ch in text) {
                hash = hash xor ch.code.toUInt()
                hash *= 16777619u
            }
            return hash
        }
    }
}

/** mulberry32 种子随机（对照原型 dynamicPersonaRandom）。 */
private class Mulberry32(seed: UInt) {
    private var state: UInt = seed
    fun next(): Double {
        state += 0x6D2B79F5u
        var t = (state xor (state shr 15)) * (state or 1u)
        t = (t + ((t xor (t shr 7)) * (t or 61u))) xor t
        return ((t xor (t shr 14)).toDouble()) / 4294967296.0
    }
}

/** hsla（CSS HSL 色域）→ Compose Color。 */
private fun hsla(h: Double, s: Double, l: Double, a: Double): Color {
    val hue = (((h % 360) + 360) % 360)
    val c = (1 - abs(2 * l - 1)) * s
    val x = c * (1 - abs((hue / 60.0) % 2 - 1))
    val m = l - c / 2
    val (r, g, b) = when {
        hue < 60 -> Triple(c, x, 0.0)
        hue < 120 -> Triple(x, c, 0.0)
        hue < 180 -> Triple(0.0, c, x)
        hue < 240 -> Triple(0.0, x, c)
        hue < 300 -> Triple(x, 0.0, c)
        else -> Triple(c, 0.0, x)
    }
    return Color(
        (r + m).toFloat().coerceIn(0f, 1f),
        (g + m).toFloat().coerceIn(0f, 1f),
        (b + m).toFloat().coerceIn(0f, 1f),
        a.toFloat().coerceIn(0f, 1f),
    )
}

/**
 * 抽象数字形象画布。用云端 persona（shape/hue/lobes/seed）驱动；未生成时本地兜底。
 * @param persona 云端 /persona 出参（可空）。
 */
@Composable
fun PersonaCanvas(persona: PersonaJob.Persona?, modifier: Modifier = Modifier) {
    val shape = remember(persona) { buildShape(persona) }

    // 帧时间（ms，与原型 time 单位一致）；~30fps 节流
    var time by remember { mutableDoubleStateOf(0.0) }
    LaunchedEffect(Unit) {
        var last = 0L
        while (true) {
            androidx.compose.runtime.withFrameMillis { frame ->
                if (frame - last >= 33L) {
                    last = frame
                    time = frame.toDouble()
                }
            }
        }
    }

    Canvas(modifier) {
        drawPersona(shape, time)
    }
}

private fun buildShape(persona: PersonaJob.Persona?): PersonaShape {
    val local = PersonaShape.build(emptyList(), emptyList())
    if (persona == null) return local
    val seed = maxOf(0, persona.seed).toUInt()
    return PersonaShape(
        seed = seed,
        filled = 4,
        signature = emptyList(),
        form = PersonaShape.formNamed(persona.shape) ?: local.form,
        hue = persona.hue.toDouble(),
        lobes = persona.lobes.coerceIn(3, 9).toDouble(),
        shapeName = persona.shape,
    )
}

// MARK: 绘制（对照原型 drawDynamicPersona，坐标 / 色值照抄）

private fun DrawScope.drawPersona(model: PersonaShape, t: Double) {
    val w = size.width
    val h = size.height
    val rand = Mulberry32(model.seed)
    val cx = w * 0.5
    val cy = h * 0.48
    val breathe = 1 + sin(t * 0.00105) * 0.035
    val hue = model.hue
    val add = BlendMode.Plus

    // 1. 背景微尘
    for (i in 0 until 72) {
        val x = rand.next() * w
        val y = rand.next() * h
        val s = 0.35 + rand.next() * 1.25
        val drift = sin(t * 0.00035 + i) * 2.5
        val color = hsla(hue + (rand.next() - 0.5) * 75, 0.9, 0.72, 0.1 + rand.next() * 0.34)
        drawRect(color, Offset((x + drift).toFloat(), y.toFloat()), Size(s.toFloat(), s.toFloat()), blendMode = add)
    }

    // 2. aura 呼吸光晕
    drawOvalGradient(
        cx = cx, cy = cy,
        rx = 92 * breathe, ry = 70 * breathe,
        stops = arrayOf(
            0f to hsla(hue + 28, 1.0, 0.76, 0.42),
            0.42f to hsla(hue, 0.95, 0.57, 0.16),
            1f to hsla(hue - 22, 0.9, 0.42, 0.0),
        ),
        gradCenter = Offset(cx.toFloat(), cy.toFloat()),
        gradRadius = 92f,
        blendMode = add,
    )

    // 形体填充渐变（中心偏移）与描边色
    val formStops = arrayOf(
        0f to Color(247f / 255f, 250f / 255f, 1f, 0.9f),
        0.16f to hsla(hue + 34, 1.0, 0.8, 0.72),
        0.55f to hsla(hue, 0.95, 0.6, 0.28),
        1f to hsla(hue - 24, 0.9, 0.42, 0.04),
    )
    val formCenter = Offset((cx - 18).toFloat(), (cy - 24).toFloat())
    val formShading = androidx.compose.ui.graphics.Brush.radialGradient(
        colorStops = formStops, center = formCenter, radius = 76f,
    )
    val strokeColor = hsla(hue + 24, 1.0, 0.84, 0.66)

    // 3. 形体
    when (model.form) {
        PersonaForm.CRYSTAL -> {
            val path = Path()
            for (i in 0 until 16) {
                val angle = -PI / 2 + i * PI / 8
                val radius = (if (i % 2 == 1) 46.0 else 68.0) * (1 + (if (i % 4 == 0) 0.15 else 0.0)) * breathe
                val px = cx + cos(angle) * radius
                val py = cy + sin(angle) * radius * 0.86
                if (i == 0) path.moveTo(px.toFloat(), py.toFloat()) else path.lineTo(px.toFloat(), py.toFloat())
            }
            path.close()
            drawPath(path, formShading, blendMode = add)
            drawPath(path, strokeColor, style = Stroke(1.15f), blendMode = add)
            val inner = Path().apply {
                moveTo(cx.toFloat(), (cy - 43).toFloat())
                lineTo((cx + 34).toFloat(), cy.toFloat())
                lineTo(cx.toFloat(), (cy + 48).toFloat())
                lineTo((cx - 34).toFloat(), cy.toFloat())
                close()
            }
            drawPath(inner, hsla(hue + 54, 1.0, 0.9, 0.48), style = Stroke(1.15f), blendMode = add)
        }

        PersonaForm.BLOOM -> {
            for (i in 0 until 7) {
                withTransform({
                    translate(cx.toFloat(), cy.toFloat())
                    rotate((i * 360.0 / 7 + t * 0.000035 * 180 / PI).toFloat(), Offset.Zero)
                }) {
                    val path = Path().apply {
                        moveTo(0f, -7f)
                        cubicTo(20f, -21f, 27f, -53f, 0f, (-67 * breathe).toFloat())
                        cubicTo(-27f, -53f, -20f, -21f, 0f, -7f)
                        close()
                    }
                    drawPath(path, hsla(hue + i * 9.0, 1.0, (70 + i % 2 * 8) / 100.0, 0.25), blendMode = add)
                    drawPath(path, strokeColor, style = Stroke(1.15f), blendMode = add)
                }
            }
        }

        PersonaForm.WING -> {
            for (side in listOf(-1f, 1f)) {
                withTransform({
                    translate(cx.toFloat(), cy.toFloat())
                    scale(side, 1f, Offset.Zero)
                }) {
                    val path = Path().apply {
                        moveTo(5f, -28f)
                        cubicTo(24f, -66f, 72f, -66f, 68f, -20f)
                        cubicTo(62f, 8f, 35f, 10f, 12f, 22f)
                        cubicTo(37f, 18f, 54f, 38f, 42f, 58f)
                        cubicTo(20f, 48f, 9f, 23f, 5f, -28f)
                        close()
                    }
                    val wingBrush = androidx.compose.ui.graphics.Brush.radialGradient(
                        colorStops = arrayOf(
                            0f to Color(247f / 255f, 250f / 255f, 1f, 0.9f),
                            0.16f to hsla(hue + 34, 1.0, 0.8, 0.72),
                            0.55f to hsla(hue, 0.95, 0.6, 0.28),
                            1f to hsla(hue - 24, 0.9, 0.42, 0.04),
                        ),
                        center = Offset(-18f, -24f), radius = 76f,
                    )
                    drawPath(path, wingBrush, blendMode = add)
                    drawPath(path, strokeColor, style = Stroke(1.15f), blendMode = add)
                }
            }
            val body = Path().apply {
                addOval(Rect(Offset((cx - 10).toFloat(), (cy - 48 * breathe).toFloat()), Size(20f, (96 * breathe).toFloat())))
            }
            drawPath(body, formShading, blendMode = add)
            drawPath(body, strokeColor, style = Stroke(1.15f), blendMode = add)
        }

        PersonaForm.ORBIT -> {
            val coreR = 38 * breathe
            val core = Path().apply {
                addOval(Rect(Offset((cx - coreR).toFloat(), (cy - coreR).toFloat()), Size((coreR * 2).toFloat(), (coreR * 2).toFloat())))
            }
            drawPath(core, formShading, blendMode = add)
            drawPath(core, strokeColor, style = Stroke(1.15f), blendMode = add)
            for (i in 0 until 3) {
                withTransform({
                    translate(cx.toFloat(), cy.toFloat())
                    rotate(((i * 0.72 + t * 0.00006) * 180 / PI).toFloat(), Offset.Zero)
                }) {
                    val rx = 58.0 + i * 10
                    val ry = 23.0 + i * 7
                    val ring = Path().apply {
                        addOval(Rect(Offset((-rx).toFloat(), (-ry).toFloat()), Size((rx * 2).toFloat(), (ry * 2).toFloat())))
                    }
                    drawPath(ring, hsla(hue + 18 + i * 18.0, 1.0, 0.82, 0.38 - i * 0.07), style = Stroke(1.15f), blendMode = add)
                }
            }
        }
    }

    // 4. 淡椭圆轨道环
    val orbitCount = 2 + minOf(4, model.filled)
    for (orbit in 0 until orbitCount) {
        withTransform({
            translate(cx.toFloat(), cy.toFloat())
            rotate((((model.seed % 9u).toInt() * 0.07 + orbit * 0.38) * 180 / PI).toFloat(), Offset.Zero)
        }) {
            val rx = 56.0 + orbit * 13
            val ry = 31.0 + orbit * 8
            val ring = Path().apply {
                addOval(Rect(Offset((-rx).toFloat(), (-ry).toFloat()), Size((rx * 2).toFloat(), (ry * 2).toFloat())))
            }
            drawPath(ring, hsla(hue + orbit * 18.0, 0.9, 0.7, 0.08 + orbit * 0.018), style = Stroke(0.7f), blendMode = add)
        }
    }

    // 5. 粒子云（沿波瓣边缘）
    val particleCount = 190 + model.filled * 28 + model.signature.size * 18
    for (i in 0 until particleCount) {
        val angle = i.toDouble() / particleCount * PI * 2
        val layer = 0.32 + rand.next() * 0.78
        val edge = 48 * (1 + 0.25 * sin(model.lobes * angle + (model.seed % 17u).toInt() * 0.11 + t * 0.00022)) * breathe
        val radius = edge * layer + (rand.next() - 0.5) * 9
        val x = cx + cos(angle) * radius * (1.02 + 0.12 * sin(t * 0.0003))
        val y = cy + sin(angle) * radius * 0.78 + (rand.next() - 0.5) * 5
        val s = 0.65 + rand.next() * 2.15 * (0.55 + layer * 0.65)
        val pHue = hue + sin(angle * 2) * 35 + (rand.next() - 0.5) * 18
        val color = hsla(pHue, 0.95, 0.64 + rand.next() * 0.22, 0.24 + layer * 0.62)
        if (i % 4 == 0) {
            drawRect(color, Offset((x - s / 2).toFloat(), (y - s / 2).toFloat()), Size(s.toFloat(), s.toFloat()), blendMode = add)
        } else {
            val r = s * 0.42
            drawCircle(color, r.toFloat(), Offset(x.toFloat(), y.toFloat()), blendMode = add)
        }
    }

    // 6. 核心发光
    val coreR = 42 * breathe
    drawOvalGradient(
        cx = cx, cy = cy, rx = coreR, ry = coreR,
        stops = arrayOf(
            0f to hsla(hue + 32, 1.0, 0.88, 0.82),
            0.26f to hsla(hue, 0.95, 0.66, 0.3),
            1f to hsla(hue - 18, 0.9, 0.42, 0.0),
        ),
        gradCenter = Offset(cx.toFloat(), cy.toFloat()),
        gradRadius = 42f,
        blendMode = add,
    )

    // 7. 维度节点小方块
    val nodes = maxOf(3, model.filled + model.signature.size)
    for (i in 0 until nodes) {
        val angle = i.toDouble() / nodes * PI * 2 + t * 0.00016 * (if (i % 2 == 1) 1 else -1) + (model.seed % 13u).toInt()
        val radius = 70.0 + (i % 3) * 14
        val x = cx + cos(angle) * radius
        val y = cy + sin(angle) * radius * 0.55
        drawRect(hsla(hue + i * 17.0, 1.0, 0.78, 0.88), Offset((x - 1.8).toFloat(), (y - 1.8).toFloat()), Size(3.6f, 3.6f), blendMode = add)
    }

    // 8. 底牌高光 + 连心线
    for (i in 0 until minOf(3, model.signature.size)) {
        val angle = -PI * 0.9 + i * PI * 0.9 + sin(t * 0.00045 + i) * 0.08
        val radius = 64.0 + (i % 2) * 18
        val x = cx + cos(angle) * radius
        val y = cy + sin(angle) * radius * 0.58
        drawOvalGradient(
            cx = x, cy = y, rx = 12.0, ry = 12.0,
            stops = arrayOf(
                0f to hsla(hue + 42 + i * 24.0, 1.0, 0.88, 0.95),
                0.28f to hsla(hue + i * 24.0, 0.95, 0.67, 0.48),
                1f to hsla(hue + i * 24.0, 0.95, 0.55, 0.0),
            ),
            gradCenter = Offset(x.toFloat(), y.toFloat()),
            gradRadius = 12f,
            blendMode = add,
        )
        val line = Path().apply {
            moveTo(cx.toFloat(), cy.toFloat())
            lineTo(x.toFloat(), y.toFloat())
        }
        drawPath(line, hsla(hue + 20 + i * 24.0, 1.0, 0.82, 0.34), style = Stroke(0.7f), blendMode = add)
    }
}

/** 用径向渐变填充一个椭圆。 */
private fun DrawScope.drawOvalGradient(
    cx: Double,
    cy: Double,
    rx: Double,
    ry: Double,
    stops: Array<Pair<Float, Color>>,
    gradCenter: Offset,
    gradRadius: Float,
    blendMode: BlendMode,
) {
    val path = Path().apply {
        addOval(Rect(Offset((cx - rx).toFloat(), (cy - ry).toFloat()), Size((rx * 2).toFloat(), (ry * 2).toFloat())))
    }
    val brush = androidx.compose.ui.graphics.Brush.radialGradient(
        colorStops = stops, center = gradCenter, radius = gradRadius,
    )
    drawPath(path, brush, blendMode = blendMode)
}
