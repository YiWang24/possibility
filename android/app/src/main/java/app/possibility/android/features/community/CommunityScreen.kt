package app.possibility.android.features.community

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ViewInAr
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.model.Bounty
import app.possibility.android.core.model.DemoData
import app.possibility.android.core.model.Traveler
import app.possibility.android.core.network.SupabaseService
import app.possibility.android.core.theme.Theme
import app.possibility.android.core.theme.fullBleedHorizontal
import app.possibility.android.features.auth.AuthGateCenter
import app.possibility.android.features.auth.AuthGateHost
import app.possibility.android.features.profile.TravelerProfileSheet
import kotlinx.coroutines.launch

// MARK: - 03 万花筒社区（原型 scr-comm）
// 对应 ios/Possibility/Features/Community/CommunityView.swift。
// 两 Tab：为你推荐（搜索栏 + 放映/卡片切换）· 悬赏贴（远端→缓存→DemoData 三级回退）。

private const val PREFS_FILE = "possibility"
private const val WATCH_KEY = "possibility-watch"

@Composable
fun CommunityScreen() {
    val context = LocalContext.current
    val service = SupabaseService.shared
    val scope = rememberCoroutineScope()

    var tab by remember { mutableStateOf(0) } // 0 为你推荐 · 1 悬赏贴
    var watchMode by remember { mutableStateOf(readWatchMode(context)) }
    var searchText by remember { mutableStateOf("") }

    var remoteBounties by remember { mutableStateOf<List<Bounty>?>(null) }
    var showDraw by remember { mutableStateOf(false) }
    var showCompose by remember { mutableStateOf(false) }
    var activeBountyId by remember { mutableStateOf<Int?>(null) }
    var activeTraveler by remember { mutableStateOf<Traveler?>(null) }

    val cacheTravelers by service.travelers.collectAsState()
    val cacheBounties by service.bounties.collectAsState()

    val travelers = cacheTravelers.ifEmpty { DemoData.travelers }
    val bounties: List<Bounty> = when {
        !remoteBounties.isNullOrEmpty() -> remoteBounties!!
        cacheBounties.isNotEmpty() -> cacheBounties
        else -> DemoData.bounties
    }

    // 真实优先：Edge Function 列表拉取成功才覆盖，失败静默走兜底链
    suspend fun refreshBounties() {
        val res = runCatching { service.listBountiesRemote(limit = 50) }.getOrNull()
        if (res != null && res.bounties.isNotEmpty()) remoteBounties = res.bounties
    }
    LaunchedEffect(Unit) { refreshBounties() }

    val scrollable = !(watchMode && tab == 0)
    val scrollState = rememberScrollState()

    Box(Modifier.fillMaxSize().background(Theme.stage)) {
        Column(
            Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .then(if (scrollable) Modifier.verticalScroll(scrollState) else Modifier)
                .padding(horizontal = 22.dp)
                .padding(top = 20.dp, bottom = 120.dp),
        ) {
            CommunityHeader(tab)
            Spacer(Modifier.height(16.dp))
            Tabs(tab, watchMode, onTab = { tab = it }, onToggleWatch = {
                watchMode = !watchMode
                writeWatchMode(context, watchMode)
            })
            Spacer(Modifier.height(16.dp))

            if (tab == 0) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SearchBar(searchText, onChange = { searchText = it }, onClear = { searchText = "" })
                    if (watchMode) {
                        // 全出血：抵消外层 22dp 水平内边距
                        Box(Modifier.fillMaxWidth().fullBleedHorizontal(22.dp)) {
                            WatchModeView(
                                travelers = travelers,
                                searchQuery = searchText,
                                onOpenTraveler = { activeTraveler = it },
                            )
                        }
                    } else {
                        RecommendFeed(filterTravelers(travelers, searchText)) { activeTraveler = it }
                    }
                }
            } else {
                BountyFeed(bounties) { activeBountyId = it.id }
            }
        }

        // 右下角 FAB
        Box(Modifier.align(Alignment.BottomEnd).padding(end = 22.dp, bottom = 28.dp)) {
            if (tab == 0) {
                Fab(icon = null, label = "万花筒抽一位旅人") { showDraw = true }
            } else {
                Fab(icon = Icons.Filled.Add, label = "发布悬赏") {
                    AuthGateCenter.require("bounty_post") { showCompose = true }
                }
            }
        }

        AuthGateHost()
    }

    // 浮层
    if (showDraw) {
        KaleidoscopeDrawSheet(
            onPick = { t ->
                showDraw = false
                activeTraveler = t
            },
            onDismiss = { showDraw = false },
        )
    }
    activeBountyId?.let { id ->
        BountyDetailSheet(bountyId = id, onDismiss = { activeBountyId = null })
    }
    activeTraveler?.let { t ->
        TravelerProfileSheet(traveler = t, onDismiss = { activeTraveler = null })
    }
    if (showCompose) {
        BountyComposeSheet(
            onDismiss = { showCompose = false },
            onPublished = { scope.launch { refreshBounties() } },
        )
    }
}

// MARK: 头部

@Composable
private fun CommunityHeader(tab: Int) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("KALEIDOSCOPE", color = Theme.faint, fontSize = 11.sp, letterSpacing = 3.5.sp)
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            Text("万花筒社区", color = Theme.ink, fontSize = 27.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp)
            Spacer(Modifier.weight(1f))
            Text(
                if (tab == 0) "人生如逆旅，我亦是行人。" else "未来不是被我们预见的，\n而是被我们亲手促成的。",
                color = Theme.sub,
                fontSize = 10.5.sp,
                fontFamily = FontFamily.Serif,
                letterSpacing = 0.35.sp,
                lineHeight = 15.sp,
                textAlign = TextAlign.End,
                maxLines = 2,
            )
        }
    }
}

// MARK: Tabs + 放映切换

@Composable
private fun Tabs(tab: Int, watchMode: Boolean, onTab: (Int) -> Unit, onToggleWatch: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(20.dp)) {
        TabButton("为你推荐", tab == 0) { onTab(0) }
        TabButton("悬赏贴", tab == 1) { onTab(1) }
        Spacer(Modifier.weight(1f))
        if (tab == 0) WatchToggle(watchMode, onToggleWatch)
    }
}

@Composable
private fun TabButton(title: String, on: Boolean, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.communityClickable(onClick),
    ) {
        Text(
            title,
            color = if (on) Theme.ink else Theme.faint,
            fontSize = if (on) 17.sp else 15.sp,
            fontWeight = if (on) FontWeight.Bold else FontWeight.Normal,
        )
        Box(
            Modifier
                .width(18.dp)
                .height(3.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(if (on) Theme.aurora else androidx.compose.ui.graphics.SolidColor(Color.Transparent)),
        )
    }
}

@Composable
private fun WatchToggle(watchMode: Boolean, onToggle: () -> Unit) {
    Row(
        Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (watchMode) Theme.blue.copy(alpha = 0.14f) else Theme.raised)
            .border(
                1.dp,
                if (watchMode) Theme.blue.copy(alpha = 0.45f) else Theme.line,
                RoundedCornerShape(999.dp),
            )
            .communityClickable(onToggle)
            .padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Icon(
            if (watchMode) Icons.Filled.GridView else Icons.Filled.ViewInAr,
            contentDescription = null,
            tint = if (watchMode) Color(0xFF9DBCFF) else Theme.sub,
            modifier = Modifier.size(12.dp),
        )
        Text(
            if (watchMode) "卡片" else "放映",
            color = if (watchMode) Color(0xFF9DBCFF) else Theme.sub,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

// MARK: 玻璃搜索条

@Composable
private fun SearchBar(text: String, onChange: (String) -> Unit, onClear: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(999.dp))
            .background(Color.White.copy(alpha = 0.05f))
            .border(1.dp, Theme.line, RoundedCornerShape(999.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Filled.Search, contentDescription = null, tint = Theme.faint, modifier = Modifier.size(14.dp))
        Box(Modifier.weight(1f)) {
            BasicTextField(
                value = text,
                onValueChange = onChange,
                singleLine = true,
                textStyle = TextStyle(color = Theme.ink, fontSize = 13.sp),
                cursorBrush = SolidColor(Theme.blue),
                modifier = Modifier.fillMaxWidth(),
            )
            if (text.isEmpty()) {
                Text("搜索旅人、介绍或标签", color = Theme.faint, fontSize = 13.sp)
            }
        }
        if (text.isNotEmpty()) {
            Text("✕", color = Theme.faint, fontSize = 13.sp, modifier = Modifier.communityClickable(onClear))
        }
    }
}

// MARK: 为你推荐 · 双列瀑布流

@Composable
private fun RecommendFeed(items: List<Traveler>, onOpen: (Traveler) -> Unit) {
    val (left, right) = distribute(items)
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(11.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(11.dp)) {
            left.forEach { UserCard(it) { onOpen(it) } }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(11.dp)) {
            right.forEach { UserCard(it) { onOpen(it) } }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun UserCard(traveler: Traveler, onClick: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Theme.card)
            .border(1.dp, Theme.line, RoundedCornerShape(20.dp))
            .communityClickable(onClick),
    ) {
        // 色带头
        Box(
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .background(Theme.hue(traveler.hue).gradient),
        )
        Column(
            Modifier.padding(horizontal = 14.dp).padding(top = 22.dp, bottom = 14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(traveler.name, color = Theme.ink, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
            Text(traveler.quote, color = Theme.sub, fontSize = 11.5.sp, lineHeight = 17.sp)
            if (traveler.tags.isNotEmpty()) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    traveler.tags.take(3).forEach { CommunityTagPill(it) }
                }
            }
            Text("查看详情 ›", color = Theme.blue, fontSize = 11.5.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 5.dp))
        }
    }
}

// MARK: 悬赏贴 · 双列瀑布流

@Composable
private fun BountyFeed(items: List<Bounty>, onOpen: (Bounty) -> Unit) {
    val (left, right) = distributeBounties(items)
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(11.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(11.dp)) {
            left.forEach { BountyCard(it) { onOpen(it) } }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(11.dp)) {
            right.forEach { BountyCard(it) { onOpen(it) } }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun BountyCard(bounty: Bounty, onClick: () -> Unit) {
    val tags = bounty.tags.orEmpty()
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Theme.card)
            .border(1.dp, Theme.line, RoundedCornerShape(18.dp))
            .communityClickable(onClick)
            .padding(horizontal = 13.dp, vertical = 14.dp),
    ) {
        if (tags.isNotEmpty()) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                tags.take(3).forEach { BountyTagPill(it) }
            }
        }
        Text(
            bounty.question,
            color = Theme.ink,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            lineHeight = 19.sp,
            modifier = Modifier.padding(top = if (tags.isNotEmpty()) 11.dp else 0.dp),
        )
        bounty.rewardGoal?.let { goal ->
            Text(
                goal,
                color = Theme.sub,
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 9.dp),
            )
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("悬赏金", color = Theme.faint, fontSize = 8.5.sp, fontWeight = FontWeight.Medium)
                Text(bounty.displayAmount, color = Theme.apricot, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
            Text(
                bounty.responses,
                color = Theme.faint,
                fontSize = 9.5.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.End,
            )
        }
    }
}

// MARK: 抽取 / 发布 FAB

@Composable
private fun Fab(icon: androidx.compose.ui.graphics.vector.ImageVector?, label: String, onClick: () -> Unit) {
    Row(
        Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(Theme.buttonGradient)
            .communityClickable(onClick)
            .padding(horizontal = 20.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(15.dp))
        } else {
            Box(
                Modifier
                    .size(20.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(androidx.compose.ui.graphics.Brush.sweepGradient(Theme.orbConicColors)),
            )
        }
        Text(label, color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.5.sp)
    }
}

// MARK: 发布悬赏浮层表单

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun BountyComposeSheet(onDismiss: () -> Unit, onPublished: () -> Unit) {
    val service = SupabaseService.shared
    val scope = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    var question by remember { mutableStateOf("") }
    var detail by remember { mutableStateOf("") }
    var tagText by remember { mutableStateOf("") }
    var reward by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    var errorText by remember { mutableStateOf<String?>(null) }

    val trimmedQuestion = question.trim()
    val tags = tagText.split(' ', ',', '，', '、', '#', '\n').map { it.trim() }.filter { it.isNotEmpty() }
    val questionValid = trimmedQuestion.isNotEmpty() && trimmedQuestion.length <= 200
    val tagsValid = tags.size <= 5
    val canSubmit = questionValid && tagsValid && !submitting

    fun submit() {
        if (!canSubmit) return
        submitting = true
        errorText = null
        val rewardText = normalizedReward(reward)
        scope.launch {
            val ok = runCatching {
                service.createBounty(
                    question = trimmedQuestion,
                    tags = tags.map { it.take(30) },
                    detail = detail.trim().take(2000),
                    reward = rewardText.take(50),
                )
            }.isSuccess
            submitting = false
            if (ok) {
                onPublished()
                onDismiss()
                ToastCenter.show("悬赏已发布")
            } else {
                errorText = "发布失败，请检查网络后重试"
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF10131C),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp)
                .padding(top = 4.dp, bottom = 26.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("发布悬赏", color = Theme.ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Text("向亲历者征集真实经历，而不是抽象建议。", color = Theme.sub, fontSize = 11.5.sp)

            Field("你想问什么？（必填，≤200 字）") {
                ComposeInputField(question, { question = it }, "例如：有没有人从设计转数据分析？想听第一年最难的是什么", 64.dp)
            }
            if (trimmedQuestion.isNotEmpty() && trimmedQuestion.length > 200) {
                Hint("问题最多 200 字，当前 ${trimmedQuestion.length} 字")
            }

            Field("想了解的具体情况（选填）") {
                ComposeInputField(detail, { detail = it }, "补充背景、真正的顾虑，让亲历者知道从哪里讲起。", 96.dp)
            }

            Field("标签（选填，空格或逗号分隔，≤5 个）") {
                ComposeInputField(tagText, { tagText = it }, "例如：职业转型 数据分析 设计背景", 44.dp)
            }
            if (tags.isNotEmpty()) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    tags.forEach { CommunityTagPill(it) }
                }
            }
            if (!tagsValid) Hint("标签最多 5 个，当前 ${tags.size} 个")

            Field("悬赏金额（选填）") {
                ComposeInputField(reward, { reward = it }, "例如：29 或 ¥29", 44.dp)
            }

            errorText?.let { Hint(it) }

            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(999.dp))
                    .background(if (canSubmit) Theme.buttonGradient else SolidColor(Theme.raised))
                    .communityClickable { submit() }
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(if (submitting) "发布中…" else "发布悬赏", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun Field(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(title, color = Theme.sub, fontSize = 11.5.sp)
        content()
    }
}

@Composable
private fun Hint(text: String) {
    Text(text, color = Theme.apricot, fontSize = 11.sp)
}

// MARK: 共享小组件与工具（社区包内复用）

/** 无水波点击（对齐 iOS plain button 风格）。 */
internal fun Modifier.communityClickable(onClick: () -> Unit): Modifier = composed {
    val interaction = remember { MutableInteractionSource() }
    clickable(interactionSource = interaction, indication = null, onClick = onClick)
}

/** 通用标签 pill（原型 TagPill）。 */
@Composable
internal fun CommunityTagPill(text: String) {
    Box(
        Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(Theme.blue.copy(alpha = 0.11f))
            .border(1.dp, Theme.blue.copy(alpha = 0.2f), RoundedCornerShape(999.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        Text(text, color = Color(0xFFC6D7FF), fontSize = 10.5.sp)
    }
}

/** 悬赏标签 pill（原型 .bounty-tags span，更小更密）。 */
@Composable
private fun BountyTagPill(text: String) {
    Box(
        Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(Theme.blue.copy(alpha = 0.1f))
            .padding(horizontal = 7.dp, vertical = 4.dp),
    ) {
        Text(text, color = Color(0xFFAFC8FF), fontSize = 9.5.sp, fontWeight = FontWeight.Medium)
    }
}

private fun distribute(items: List<Traveler>): Pair<List<Traveler>, List<Traveler>> {
    val left = ArrayList<Traveler>()
    val right = ArrayList<Traveler>()
    items.forEachIndexed { i, t -> if (i % 2 == 0) left.add(t) else right.add(t) }
    return left to right
}

private fun distributeBounties(items: List<Bounty>): Pair<List<Bounty>, List<Bounty>> {
    val left = ArrayList<Bounty>()
    val right = ArrayList<Bounty>()
    items.forEachIndexed { i, b -> if (i % 2 == 0) left.add(b) else right.add(b) }
    return left to right
}

private fun filterTravelers(travelers: List<Traveler>, query: String): List<Traveler> {
    val q = query.trim().lowercase()
    if (q.isEmpty()) return travelers
    return travelers.filter { t ->
        (listOf(t.name, t.quote, t.bio) + t.tags).joinToString(" ").lowercase().contains(q)
    }
}

/** 空/纯数字 → 「¥xx 悬赏」，否则原样（对齐 iOS normalizedReward）。 */
private fun normalizedReward(raw: String): String {
    val value = raw.trim()
    if (value.isEmpty()) return "¥0 悬赏"
    return if (Regex("""^\d+(?:\.\d{1,2})?$""").matches(value)) "¥$value 悬赏" else value
}

private fun readWatchMode(context: Context): Boolean =
    context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE).getBoolean(WATCH_KEY, true)

private fun writeWatchMode(context: Context, value: Boolean) {
    context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE).edit().putBoolean(WATCH_KEY, value).apply()
}
