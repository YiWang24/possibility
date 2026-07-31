package app.possibility.android.features.community

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.model.Traveler
import app.possibility.android.core.theme.Theme
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.roundToInt
import kotlinx.coroutines.launch

// MARK: - 社区放映模式（原型 watch-mode：无限平铺 · 拖拽 · 就近吸附）
//
// 对应 ios/Possibility/Features/Community/WatchModeView.swift 的简化实现：
// 大 Box + 手势拖拽 offset，卡片按错位网格坐标（DX=160, DY=184，奇数列下移 DY/2）定位；
// 用与 iOS 一致的确定性哈希把网格坐标映射到旅人数据；松手后吸附到最近的（命中搜索的）气泡。

private const val DX = 160f
private const val DY = 184f
private const val COLS = 7
private const val ROWS = 5
private const val BUBBLE = 154f
private const val WATCH_HEIGHT = 548f

/** 一个网格坐标上的确定性用户。 */
private data class WatchUser(
    val key: String,
    val base: Traveler,
    val wx: Float,
    val wy: Float,
)

/**
 * 放映模式网格。
 * @param travelers 数据源（外部保证非空）。
 * @param searchQuery 搜索词，命中后重定位到最近匹配。
 * @param onOpenTraveler 点击气泡 → 打开旅人主页。
 */
@Composable
fun WatchModeView(
    travelers: List<Traveler>,
    searchQuery: String = "",
    onOpenTraveler: (Traveler) -> Unit,
) {
    if (travelers.isEmpty()) return

    val density = LocalDensity.current
    val dxPx = with(density) { DX.dp.toPx() }
    val dyPx = with(density) { DY.dp.toPx() }
    val bubblePx = with(density) { BUBBLE.dp.toPx() }

    val offset = remember { Animatable(Offset.Zero, Offset.VectorConverter) }
    val scope = rememberCoroutineScope()
    val query = searchQuery.trim()

    fun userAt(q: Int, r: Int): WatchUser {
        val seed = watchHash(q, r)
        val idx = ((seed.toLong() and 0xFFFFFFFFL) % travelers.size).toInt()
        val qOffset = (abs(q) % 2) * dyPx / 2f
        return WatchUser(
            key = "$q:$r",
            base = travelers[idx],
            wx = q * dxPx,
            wy = r * dyPx + qOffset,
        )
    }

    fun matches(u: WatchUser): Boolean {
        if (query.isEmpty()) return true
        val hay = (listOf(u.base.name, u.base.bio, u.base.quote) + u.base.tags)
            .joinToString(" ").lowercase()
        return hay.contains(query.lowercase())
    }

    fun visibleUsers(off: Offset): List<WatchUser> {
        val centerQ = (-off.x / dxPx).roundToInt()
        val users = ArrayList<WatchUser>()
        for (dq in -(COLS / 2)..(COLS / 2)) {
            val q = centerQ + dq
            val qOffset = (abs(q) % 2) * dyPx / 2f
            val centerR = ((-off.y - qOffset) / dyPx).roundToInt()
            for (dr in -(ROWS / 2)..(ROWS / 2)) {
                users.add(userAt(q, centerR + dr))
            }
        }
        return users
    }

    fun distance(u: WatchUser, off: Offset): Float = hypot(u.wx + off.x, u.wy + off.y)

    // 松手吸附到最近的（命中搜索的）气泡
    suspend fun snapToNearest() {
        val target = visibleUsers(offset.value)
            .filter { matches(it) }
            .minByOrNull { distance(it, offset.value) } ?: return
        offset.animateTo(
            Offset(-target.wx, -target.wy),
            animationSpec = spring(dampingRatio = 0.85f, stiffness = 220f),
        )
    }

    // 搜索命中后重定位（近邻扫描）
    LaunchedEffect(query) {
        if (query.isEmpty()) return@LaunchedEffect
        val centerQ = (-offset.value.x / dxPx).roundToInt()
        val centerR = (-offset.value.y / dyPx).roundToInt()
        for (radius in 0..10) {
            for (q in (centerQ - radius)..(centerQ + radius)) {
                for (r in (centerR - radius)..(centerR + radius)) {
                    if (radius > 0 && abs(q - centerQ) != radius && abs(r - centerR) != radius) continue
                    val candidate = userAt(q, r)
                    if (matches(candidate)) {
                        offset.animateTo(
                            Offset(-candidate.wx, -candidate.wy),
                            animationSpec = spring(dampingRatio = 0.85f, stiffness = 220f),
                        )
                        return@LaunchedEffect
                    }
                }
            }
        }
    }

    BoxWithConstraints(
        Modifier
            .fillMaxWidth()
            .height(WATCH_HEIGHT.dp)
            // 椭圆渐隐 vignette：离屏合成后用 DstIn 做径向遮罩
            .graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen)
            .drawWithContent {
                drawContent()
                drawRect(
                    brush = Brush.radialGradient(
                        0.00f to Color.Black,
                        0.64f to Color.Black,
                        0.78f to Color.Black.copy(alpha = 0.76f),
                        1.00f to Color.Transparent,
                        center = Offset(size.width * 0.5f, size.height * 0.48f),
                        radius = size.maxDimension * 0.62f,
                    ),
                    blendMode = BlendMode.DstIn,
                )
            }
            .pointerInput(travelers.size) {
                detectDragGestures(
                    onDrag = { change, delta ->
                        change.consume()
                        scope.launch { offset.snapTo(offset.value + delta) }
                    },
                    onDragEnd = { scope.launch { snapToNearest() } },
                )
            },
    ) {
        val wPx = with(density) { maxWidth.toPx() }
        val hPx = with(density) { maxHeight.toPx() }
        val cx = wPx / 2f
        val cy = hPx / 2f

        WatchBackground()
        RotatingKaleido()
        CenterRing()

        val off = offset.value
        val users = visibleUsers(off)
        val focusKey = users.filter { matches(it) }.minByOrNull { distance(it, off) }?.key

        users.forEach { u ->
            val x = u.wx + off.x
            val y = u.wy + off.y
            val dist = hypot(x, y)
            val focus = (1f - dist / 460f).coerceIn(0f, 1f)
            val hidden = !matches(u)
            val scale = 0.62f + focus * 0.58f
            val alpha = if (hidden) 0.06f else 0.28f + focus * 0.72f
            val leftPx = cx + x - bubblePx / 2f
            val topPx = cy + y - bubblePx / 2f
            Box(
                Modifier
                    .graphicsLayer {
                        translationX = leftPx
                        translationY = topPx
                        scaleX = scale
                        scaleY = scale
                        this.alpha = alpha
                    }
                    .size(BUBBLE.dp)
                    .then(
                        if (hidden) Modifier
                        else Modifier.pointerInput(u.key) {
                            detectTapGestures(onTap = { onOpenTraveler(u.base) })
                        },
                    ),
            ) {
                BubbleCard(u.base, isFocus = u.key == focusKey)
            }
        }

        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Bottom) {
            Text(
                "无限滑动浏览 · 点击卡片查看主页",
                color = Color(0xFF9AA4BC).copy(alpha = 0.62f),
                fontSize = 9.5.sp,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 9.dp),
                textAlign = TextAlign.Center,
            )
        }
    }
}

/** 圆形毛玻璃气泡（原型 .watch-user 的简化版）。 */
@Composable
private fun BubbleCard(traveler: Traveler, isFocus: Boolean) {
    Column(
        Modifier
            .size(BUBBLE.dp)
            .clip(CircleShape)
            .background(
                Brush.linearGradient(
                    listOf(Color(0xFF1D2640).copy(alpha = 0.92f), Color(0xFF080B18).copy(alpha = 0.78f)),
                ),
            )
            .border(
                if (isFocus) 1.4.dp else 1.dp,
                if (isFocus) Color(0xFFDEE9FF).copy(alpha = 0.78f) else Color(0xFFCFE0FF).copy(alpha = 0.23f),
                CircleShape,
            )
            .padding(horizontal = 18.dp, vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            Modifier
                .size(43.dp)
                .clip(CircleShape)
                .background(Theme.hue(traveler.hue).gradient)
                .border(1.5.dp, Color.White.copy(alpha = 0.82f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(traveler.initial, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
        Text(
            traveler.name,
            color = Color.White,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 4.dp),
        )
        Text(
            traveler.bio,
            color = Color(0xFFEEF3FF).copy(alpha = 0.82f),
            fontSize = 9.sp,
            lineHeight = 12.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 3.dp),
        )
        Row(
            Modifier.padding(top = 5.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            traveler.tags.take(2).forEach { tag ->
                Box(
                    Modifier
                        .clip(CircleShape)
                        .background(Color(0xFFD6E2FF).copy(alpha = 0.12f))
                        .border(1.dp, Color(0xFFDFE9FF).copy(alpha = 0.1f), CircleShape)
                        .padding(horizontal = 5.dp, vertical = 2.5.dp),
                ) {
                    Text(
                        tag,
                        color = Color(0xFFE1E9FF),
                        fontSize = 7.5.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

/** 舞台弱径向光斑（原型 stageBackground）。 */
@Composable
private fun WatchBackground() {
    Box(
        Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    listOf(Theme.blue.copy(alpha = 0.11f), Color.Transparent),
                ),
            ),
    )
}

/** 旋转的双细环彩弧（原型 .watch-kaleido，32s 一圈，opacity .16）。 */
@Composable
private fun RotatingKaleido() {
    val transition = rememberInfiniteTransition(label = "kaleido")
    val angle by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(32_000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "kaleido-angle",
    )
    val arcColors = listOf(
        Theme.blue.copy(alpha = 0.4f),
        Theme.magenta.copy(alpha = 0.32f),
        Theme.orange.copy(alpha = 0.28f),
        Theme.violetSoft.copy(alpha = 0.35f),
    )
    Box(
        Modifier
            .fillMaxSize()
            .graphicsLayer { alpha = 0.16f; rotationZ = angle },
        contentAlignment = Alignment.Center,
    ) {
        listOf(218.dp, 316.dp).forEach { diameter ->
            Box(
                Modifier
                    .size(diameter)
                    .clip(CircleShape)
                    .border(2.dp, Brush.sweepGradient(arcColors), CircleShape),
            )
        }
    }
}

/** 中心微光环（原型 .watch-center-ring）。 */
@Composable
private fun CenterRing() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .size(190.dp)
                .clip(CircleShape)
                .border(2.dp, Theme.blue.copy(alpha = 0.12f), CircleShape)
                .background(
                    Brush.radialGradient(
                        listOf(Color.Transparent, Theme.blue.copy(alpha = 0.08f)),
                    ),
                    CircleShape,
                ),
        )
    }
}

/**
 * 确定性哈希（原型 watchHash）：把 (q,r) 映射到稳定的旅人下标。
 * 使用 32 位截断乘法与无符号右移，与 iOS 版本逐位一致。
 */
private fun watchHash(q: Int, r: Int): Int {
    var h = (q * 73856093) xor (r * 19349663) xor (1 * 83492791)
    h = (h xor (h ushr 16)) * 0x85ebca6b.toInt()
    h = (h xor (h ushr 13)) * 0xc2b2ae35.toInt()
    return h xor (h ushr 16)
}
