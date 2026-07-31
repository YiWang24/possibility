package app.possibility.android.features.community

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.possibility.android.core.model.DemoData
import app.possibility.android.core.model.Traveler
import app.possibility.android.core.network.SupabaseService
import app.possibility.android.core.theme.Theme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// MARK: - 万花筒抽取浮层（原型 .kal）
// 选「类似 / 相反」→ 万花筒旋转 → 转出一位真实旅人 → 查看主页。
// 对应 ios/Possibility/Features/Community/KaleidoscopeDrawView.swift。

private enum class DrawPhase { CHOOSE, SPINNING, RESULT }
private enum class DrawMode(val api: String) { SIMILAR("similar"), OPPOSITE("different") }

/**
 * 万花筒抽取全屏浮层。
 * @param onPick 抽到旅人后点「看 TA」的回调（由外层就地打开旅人主页）。
 * @param onDismiss 关闭浮层。
 */
@Composable
fun KaleidoscopeDrawSheet(onPick: (Traveler) -> Unit, onDismiss: () -> Unit) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        val service = SupabaseService.shared
        val scope = rememberCoroutineScope()

        var phase by remember { mutableStateOf(DrawPhase.CHOOSE) }
        var mode by remember { mutableStateOf(DrawMode.SIMILAR) }
        var drawn by remember { mutableStateOf<Traveler?>(null) }
        var reason by remember { mutableStateOf<String?>(null) }

        fun pool(): List<Traveler> =
            service.travelers.value.ifEmpty { DemoData.travelers }

        fun spin() {
            phase = DrawPhase.SPINNING
            scope.launch {
                val picked = runCatching { service.kaleidoscopeDraw(mode.api) }.getOrNull()
                delay(1450)
                val chosen: Traveler?
                val hit = picked?.let { p -> pool().firstOrNull { it.id == p.travelerId } }
                if (hit != null) {
                    chosen = hit
                    reason = picked.reason
                } else {
                    val candidates = pool().filter { if (mode == DrawMode.SIMILAR) it.isSimilar else !it.isSimilar }
                    chosen = (candidates.ifEmpty { pool() }).randomOrNull()
                    reason = null
                }
                drawn = chosen
                phase = DrawPhase.RESULT
            }
        }

        val title = when (phase) {
            DrawPhase.CHOOSE -> "你想看见哪一面的人生？"
            DrawPhase.SPINNING -> if (mode == DrawMode.SIMILAR) "寻找和你同路的人" else "寻找你没走过的路"
            DrawPhase.RESULT -> if (mode == DrawMode.SIMILAR) "与你的画像最相似的人" else "与你的轨迹完全相反的人"
        }
        val sub = when (phase) {
            DrawPhase.CHOOSE -> "万花筒会为你转出一位真实的旅人"
            DrawPhase.SPINNING -> null
            DrawPhase.RESULT -> reason ?: "看看 TA 的人生轨迹"
        }

        Box(
            Modifier
                .fillMaxSize()
                .background(Color(0xFF06080E).copy(alpha = 0.98f)),
        ) {
            // 背景弱光
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Brush.radialGradient(listOf(Theme.blue.copy(alpha = 0.075f), Color.Transparent))),
            )

            // 关闭
            Row(
                Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(top = 20.dp, end = 20.dp),
                horizontalArrangement = Arrangement.End,
            ) {
                Text(
                    "关闭 ✕",
                    color = Theme.faint,
                    fontSize = 12.5.sp,
                    modifier = Modifier.communityClickable(onDismiss),
                )
            }

            Column(
                Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .padding(horizontal = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Spacer(Modifier.height(90.dp))
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        title,
                        color = Theme.ink,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.8.sp,
                        textAlign = TextAlign.Center,
                    )
                    if (sub != null) {
                        Text(sub, color = Theme.sub, fontSize = 12.sp, lineHeight = 18.sp, textAlign = TextAlign.Center)
                    }
                }

                Spacer(Modifier.weight(1f))

                when (phase) {
                    DrawPhase.CHOOSE -> ModeOptions(mode) { mode = it }
                    DrawPhase.SPINNING -> SpinningOrb()
                    DrawPhase.RESULT -> drawn?.let { ResultCard(it) }
                }

                Spacer(Modifier.weight(1f))

                Box(Modifier.navigationBarsPadding().padding(bottom = 40.dp)) {
                    when (phase) {
                        DrawPhase.CHOOSE -> PrimaryPill("开始转动 · 抽一位旅人") { spin() }
                        DrawPhase.SPINNING -> Spacer(Modifier.height(1.dp))
                        DrawPhase.RESULT -> Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            drawn?.let { t -> PrimaryPill("查看 TA 的主页") { onPick(t) } }
                            Text(
                                "再转一次",
                                color = Theme.faint,
                                fontSize = 12.5.sp,
                                modifier = Modifier.communityClickable {
                                    phase = DrawPhase.CHOOSE
                                    drawn = null
                                    reason = null
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ModeOptions(mode: DrawMode, onSelect: (DrawMode) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        ModeCard(
            selected = mode == DrawMode.SIMILAR,
            emoji = "🪞",
            title = "和我有类似经历",
            desc = "在同路人身上\n看见自己的下一步",
            modifier = Modifier.weight(1f),
        ) { onSelect(DrawMode.SIMILAR) }
        ModeCard(
            selected = mode == DrawMode.OPPOSITE,
            emoji = "🔭",
            title = "和我经历完全相反",
            desc = "在另一种人生里\n看见没走过的路",
            modifier = Modifier.weight(1f),
        ) { onSelect(DrawMode.OPPOSITE) }
    }
}

@Composable
private fun ModeCard(
    selected: Boolean,
    emoji: String,
    title: String,
    desc: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Column(
        modifier
            .clip(RoundedCornerShape(20.dp))
            .background(
                if (selected) {
                    Brush.linearGradient(listOf(Theme.blue.copy(alpha = 0.16f), Theme.magenta.copy(alpha = 0.1f)))
                } else {
                    Brush.linearGradient(listOf(Theme.card, Theme.card))
                },
            )
            .border(
                1.5.dp,
                if (selected) Color(0xFF6FA5FF).copy(alpha = 0.7f) else Theme.line,
                RoundedCornerShape(20.dp),
            )
            .communityClickable(onClick)
            .padding(horizontal = 14.dp, vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(emoji, fontSize = 22.sp)
        Text(
            title,
            color = Theme.ink,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(top = 10.dp),
            textAlign = TextAlign.Center,
        )
        Text(
            desc,
            color = Theme.sub,
            fontSize = 11.sp,
            lineHeight = 16.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 5.dp),
        )
    }
}

/** 旋转的万花筒球（原型 KaleidoscopeView 的简化版）。 */
@Composable
private fun SpinningOrb() {
    val transition = rememberInfiniteTransition(label = "spin")
    val angle by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = androidx.compose.animation.core.tween(1400, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "spin-angle",
    )
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Box(
            Modifier
                .size(150.dp)
                .graphicsLayer { rotationZ = angle }
                .clip(CircleShape)
                .background(Brush.sweepGradient(Theme.orbConicColors))
                .border(2.dp, Color.White.copy(alpha = 0.2f), CircleShape),
        )
        Text("光在旋转，人生在折叠……", color = Theme.faint, fontSize = 12.sp, letterSpacing = 1.5.sp)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ResultCard(t: Traveler) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Theme.card)
            .border(1.dp, Theme.line, RoundedCornerShape(24.dp)),
    ) {
        // 色带头
        Box(
            Modifier
                .fillMaxWidth()
                .height(74.dp)
                .background(Theme.hue(t.hue).gradient),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                Modifier
                    .size(52.dp)
                    .clip(CircleShape)
                    .background(Theme.hue(t.hue).gradient)
                    .border(2.dp, Color.White.copy(alpha = 0.55f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(t.initial, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            }
        }
        Column(
            Modifier.padding(horizontal = 20.dp, vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(t.name, color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Text("「${t.quote}」", color = Theme.sub, fontSize = 13.sp, lineHeight = 20.sp)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                t.tags.forEach { CommunityTagPill(it) }
            }
        }
    }
}

@Composable
private fun PrimaryPill(label: String, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(999.dp))
            .background(Theme.buttonGradient)
            .communityClickable(onClick)
            .padding(vertical = 15.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}
