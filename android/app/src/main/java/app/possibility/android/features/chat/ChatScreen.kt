package app.possibility.android.features.chat

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.possibility.android.core.AppConfig
import app.possibility.android.core.AppRouter
import app.possibility.android.core.AppTab
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.model.Traveler
import app.possibility.android.core.model.RemoteConversation
import app.possibility.android.core.network.ChatRecommendedNextStep
import app.possibility.android.core.network.SupabaseService
import app.possibility.android.core.theme.Theme
import app.possibility.android.features.profile.TravelerProfileSheet
import app.possibility.android.features.profile.clickableNoRipple

// 探索对话（原型 chatPage · 付费漏斗主线）—— 对应 ios/Possibility/Features/Chat/ChatView.swift。
// 全屏覆盖：顶栏 + 消息流（用户/AI 气泡，AI 流式打字）+ 验证 chips + 匹配旅人卡 + 下一步面板 + 输入栏。

/**
 * 探索对话全屏界面。首页发问 / 卡片带问题进入。
 * @param topic 话题中文标签（职业 / 家庭 / 升学 / 情感），自由提问传空串
 * @param initialQuestion 首条用户问题
 * @param onDismiss 关闭对话（返回上一层）
 */
@Composable
fun ChatScreen(topic: String, initialQuestion: String, onDismiss: () -> Unit) {
    val service = SupabaseService.shared
    val scope = rememberCoroutineScope()
    val model = remember(topic, initialQuestion) {
        ChatModel(topic = topic.ifBlank { null }, question = initialQuestion, service = service, scope = scope)
    }
    var profileTraveler by remember { mutableStateOf<Traveler?>(null) }

    LaunchedEffect(model) { model.start() }
    LaunchedEffect(model) { model.loadHistory() }

    fun goLab() {
        AppRouter.openLab(model.displayQuestion)
        model.showSummary = false
        onDismiss()
        ToastCenter.show("问题已带入人生实验室")
    }

    fun goSimilar() {
        AppRouter.selectedTab.value = AppTab.COMMUNITY
        model.showSummary = false
        onDismiss()
        ToastCenter.show("正在寻找走过这段路的人")
    }

    Box(Modifier.fillMaxSize().background(Theme.paper)) {
        Column(Modifier.fillMaxSize()) {
            ChatTopBar(
                title = model.displayTopic?.let { "探索 · $it" } ?: "探索问题",
                showHistory = model.historyEntries.isNotEmpty(),
                onBack = onDismiss,
                onHistory = { model.showHistory = true },
            )
            MessagesScroll(
                model = model,
                modifier = Modifier.weight(1f),
                onGoLab = ::goLab,
                onGoSimilar = ::goSimilar,
                onOpenTraveler = { profileTraveler = it },
            )
            ChatInputBar(
                input = model.input,
                enabled = !model.isStreaming,
                onInputChange = { model.input = it },
                onSend = { model.send(model.input) },
            )
        }
    }

    if (model.showHistory) {
        ChatHistorySheet(model = model, onDismiss = { model.showHistory = false })
    }

    if (model.showSummary) {
        ChatSummarySheet(
            model = model,
            onGoLab = ::goLab,
            onGoSimilar = ::goSimilar,
            onOpenTraveler = { profileTraveler = it },
            onFinish = {
                model.showSummary = false
                onDismiss()
                ToastCenter.show("本次探索已保存")
            },
            onDismiss = { model.showSummary = false },
        )
    }

    profileTraveler?.let { traveler ->
        TravelerProfileSheet(traveler = traveler, onDismiss = { profileTraveler = null })
    }
}

// MARK: 顶栏

@Composable
private fun ChatTopBar(title: String, showHistory: Boolean, onBack: () -> Unit, onHistory: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(Color(0xFF0A0C12))
            .statusBarsPadding(),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 22.dp)
                .padding(top = 12.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CircleIconButton("‹", onBack)
            Spacer(Modifier.width(13.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
                Text("和你的动态画像一起想清楚", color = Theme.faint, fontSize = 11.sp)
            }
            if (showHistory) {
                CircleIconButton("↺", onHistory)
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
    }
}

@Composable
private fun CircleIconButton(glyph: String, onClick: () -> Unit) {
    Box(
        Modifier
            .size(36.dp)
            .background(Theme.raised, CircleShape)
            .border(1.dp, Theme.line, CircleShape)
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(glyph, color = Theme.ink, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
    }
}

// MARK: 消息流

@Composable
private fun MessagesScroll(
    model: ChatModel,
    modifier: Modifier = Modifier,
    onGoLab: () -> Unit,
    onGoSimilar: () -> Unit,
    onOpenTraveler: (Traveler) -> Unit,
) {
    val listState = rememberLazyListState()
    // 新 token / chips / 面板出现时滚动到底部
    val lastText = model.messages.lastOrNull()?.text
    LaunchedEffect(lastText, model.showActionChips, model.showNextPanel, model.messages.size) {
        val target = listState.layoutInfo.totalItemsCount - 1
        if (target >= 0) listState.animateScrollToItem(target)
    }

    LazyColumn(
        state = listState,
        modifier = modifier.fillMaxWidth(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 12.dp),
    ) {
        model.messages.forEach { msg ->
            // 流开始时会先插入一条空 AI 消息作为 token 容器；首个 token 到达前不渲染空气泡。
            if (msg.text.isNotEmpty()) {
                item(key = msg.id) { Bubble(msg) }
            }
        }
        if (model.isStreaming && model.messages.lastOrNull()?.text?.isEmpty() == true) {
            item(key = "thinking") { Thinking() }
        }
        if (model.canRetry) {
            item(key = "retry") { RetryButton { model.retry() } }
        }
        if (model.showActionChips) {
            item(key = "chips") {
                ActionChips(
                    confirmLabel = model.confirmLabel,
                    correctLabel = model.correctLabel,
                    onConfirm = { model.confirmInsight() },
                    onCorrect = { model.requestCorrection() },
                )
            }
        }
        if (model.showNextPanel) {
            item(key = "nextpanel") {
                Box(Modifier.padding(top = 14.dp)) {
                    ChatNextPanel(
                        showSummaryLink = true,
                        preferredPath = model.recommendedNextStep,
                        matchedTravelers = model.matchedTravelers,
                        matchReasons = model.matchReasons,
                        onGoLab = onGoLab,
                        onGoSimilar = onGoSimilar,
                        shareText = model.shareText,
                        onOpenSummary = { model.showSummary = true },
                        onOpenTraveler = onOpenTraveler,
                    )
                }
            }
        }
        item(key = "bottom") { Spacer(Modifier.height(8.dp)) }
    }
}

@Composable
private fun Bubble(msg: ChatModel.Message) {
    val isUser = msg.role == ChatModel.Message.Role.USER
    val shape = RoundedCornerShape(
        topStart = 20.dp,
        topEnd = 20.dp,
        bottomStart = if (isUser) 20.dp else 6.dp,
        bottomEnd = if (isUser) 6.dp else 20.dp,
    )
    Row(
        Modifier.fillMaxWidth().padding(top = 14.dp),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        Box(
            Modifier
                .widthIn(max = 300.dp)
                .background(
                    if (isUser) {
                        Brush.linearGradient(listOf(Color(0xFF3E77F2), Color(0xFF2A50D6)))
                    } else {
                        Brush.linearGradient(listOf(Theme.card, Theme.card))
                    },
                    shape,
                )
                .then(if (isUser) Modifier else Modifier.border(1.dp, Theme.line, shape))
                .padding(horizontal = 16.dp, vertical = 13.dp),
        ) {
            Text(
                text = markdownBold(msg.text),
                color = if (isUser) Color.White else Theme.ink,
                fontSize = if (isUser) 14.5.sp else 14.sp,
                lineHeight = if (isUser) 21.sp else 20.sp,
            )
        }
    }
}

@Composable
private fun Thinking() {
    Row(
        Modifier.fillMaxWidth().padding(top = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier.size(18.dp).background(Theme.aurora, CircleShape),
        )
        Text("正在想…", color = Theme.faint, fontSize = 12.sp)
    }
}

@Composable
private fun RetryButton(onRetry: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(top = 10.dp),
        horizontalArrangement = Arrangement.Start,
    ) {
        Box(
            Modifier
                .background(Theme.blue.copy(alpha = 0.1f), RoundedCornerShape(999.dp))
                .border(1.dp, Color(0xFF6FA5FF).copy(alpha = 0.3f), RoundedCornerShape(999.dp))
                .clickableNoRipple(onRetry)
                .padding(horizontal = 15.dp, vertical = 9.dp),
        ) {
            Text("↻ 重新发送", color = Color(0xFFAFC7FF), fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

// MARK: 验证反馈 chips（原型 .chat-actions）

@Composable
private fun ActionChips(
    confirmLabel: String,
    correctLabel: String,
    onConfirm: () -> Unit,
    onCorrect: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(top = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Box(
            Modifier
                .background(Theme.buttonGradient, RoundedCornerShape(999.dp))
                .clickableNoRipple(onConfirm)
                .padding(horizontal = 16.dp, vertical = 9.dp),
        ) {
            Text(confirmLabel, color = Color.White, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
        }
        Box(
            Modifier
                .background(Theme.raised, RoundedCornerShape(999.dp))
                .border(1.dp, Theme.line, RoundedCornerShape(999.dp))
                .clickableNoRipple(onCorrect)
                .padding(horizontal = 16.dp, vertical = 9.dp),
        ) {
            Text(correctLabel, color = Theme.sub, fontSize = 12.5.sp)
        }
    }
}

// MARK: 输入栏

@Composable
private fun ChatInputBar(
    input: String,
    enabled: Boolean,
    onInputChange: (String) -> Unit,
    onSend: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(Color(0xFF0A0C12))
            .imePadding()
            .navigationBarsPadding(),
    ) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp)
                .padding(top = 12.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                Modifier
                    .weight(1f)
                    .background(Theme.raised, RoundedCornerShape(999.dp))
                    .border(1.dp, Theme.line, RoundedCornerShape(999.dp))
                    .padding(horizontal = 18.dp, vertical = 12.dp),
            ) {
                BasicTextField(
                    value = input,
                    onValueChange = { if (it.length <= AppConfig.Threshold.MAX_MESSAGE_LENGTH) onInputChange(it) },
                    singleLine = false,
                    maxLines = 4,
                    textStyle = androidx.compose.ui.text.TextStyle(color = Theme.ink, fontSize = 13.5.sp),
                    cursorBrush = androidx.compose.ui.graphics.SolidColor(Theme.blue),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { onSend() }),
                    modifier = Modifier.fillMaxWidth(),
                    decorationBox = { inner ->
                        if (input.isEmpty()) {
                            Text("想到什么，直接问…", color = Theme.faint, fontSize = 13.5.sp)
                        }
                        inner()
                    },
                )
            }
            Box(
                Modifier
                    .background(
                        if (enabled) Theme.buttonGradient else Brush.linearGradient(listOf(Theme.faint, Theme.faint)),
                        RoundedCornerShape(999.dp),
                    )
                    .clickableNoRipple { if (enabled) onSend() }
                    .padding(horizontal = 22.dp, vertical = 12.dp),
            ) {
                Text("发送", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

// MARK: - 历史探索列表（listConversations → loadMessages 恢复续聊）

@Composable
private fun ChatHistorySheet(model: ChatModel, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Theme.paper)) {
            Column(Modifier.fillMaxSize()) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 22.dp)
                        .padding(top = 20.dp, bottom = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircleIconButton("‹", onDismiss)
                    Spacer(Modifier.width(13.dp))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("历史探索", color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
                        Text("选一段继续想下去", color = Theme.faint, fontSize = 11.sp)
                    }
                }
                LazyColumn(
                    Modifier.fillMaxWidth().weight(1f),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 6.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(model.historyEntries.size) { idx ->
                        val convo = model.historyEntries[idx]
                        HistoryRow(convo) {
                            model.restore(convo)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HistoryRow(convo: RemoteConversation, onClick: () -> Unit) {
    val shape = RoundedCornerShape(18.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .background(Theme.card, shape)
            .border(1.dp, Theme.line, shape)
            .clickableNoRipple(onClick)
            .padding(15.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(
                Modifier
                    .background(Theme.raised, RoundedCornerShape(999.dp))
                    .border(1.dp, Theme.line, RoundedCornerShape(999.dp))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            ) {
                Text(convo.topic, color = Theme.sub, fontSize = 10.sp)
            }
            if (convo.crossroads?.ready == true) {
                Text("岔路口已成形", color = Theme.teal, fontSize = 9.sp, letterSpacing = 1.sp)
            }
            Spacer(Modifier.weight(1f))
            historyTimeLabel(convo.createdAt)?.let {
                Text(it, color = Theme.faint, fontSize = 10.sp)
            }
        }
        Text(
            convo.crossroads?.summary ?: "还在澄清中的对话",
            color = Theme.ink,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.SemiBold,
            lineHeight = 19.sp,
            maxLines = 2,
            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 9.dp),
        )
    }
}

/** 历史会话时间标签（ISO → MM-dd HH:mm，解析失败返回 null）。 */
private fun historyTimeLabel(raw: String?): String? {
    val s = raw ?: return null
    return runCatching {
        val instant = java.time.Instant.parse(s)
        val local = java.time.LocalDateTime.ofInstant(instant, java.time.ZoneId.systemDefault())
        java.time.format.DateTimeFormatter.ofPattern("MM-dd HH:mm").format(local)
    }.getOrNull()
}

// MARK: - 下一步面板（原型 .chat-next-panel）

/**
 * 「信息已经足够 · 选择下一步」：去人生实验室（primary）/ 看走过这条路的人
 * （/match 命中时固定展示 2 张方形旅人卡，点击进主页）/ 分享这次探索 + 可选完整总结链接。
 */
@Composable
fun ChatNextPanel(
    showSummaryLink: Boolean,
    preferredPath: ChatRecommendedNextStep?,
    matchedTravelers: List<Traveler>,
    matchReasons: Map<Int, String>,
    onGoLab: () -> Unit,
    onGoSimilar: () -> Unit,
    shareText: String,
    onOpenSummary: () -> Unit = {},
    onOpenTraveler: (Traveler) -> Unit = {},
) {
    val context = LocalContext.current
    val panelShape = RoundedCornerShape(20.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .background(
                Brush.linearGradient(listOf(Theme.blue.copy(alpha = 0.11f), Theme.violetSoft.copy(alpha = 0.055f))),
                panelShape,
            )
            .border(1.dp, Color(0xFF6FA5FF).copy(alpha = 0.2f), panelShape)
            .padding(14.dp),
    ) {
        Text(
            if (preferredPath == null) "信息已经足够 · 选择下一步" else "这轮探索先到这里 · 为你推荐",
            color = Color(0xFF91B1FF),
            fontSize = 9.sp,
            letterSpacing = 1.6.sp,
        )
        Text(
            when (preferredPath) {
                ChatRecommendedNextStep.MATCH -> "看看走过相似处境的人"
                ChatRecommendedNextStep.LAB -> "把现在的判断放进现实里推演"
                null -> "把刚才的理解带去哪里？"
            },
            color = Theme.ink,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(top = 5.dp),
        )

        if (preferredPath != ChatRecommendedNextStep.MATCH) {
            val labShape = RoundedCornerShape(14.dp)
            Box(
                Modifier
                    .padding(top = 11.dp)
                    .fillMaxWidth()
                    .background(
                        Brush.linearGradient(
                            listOf(Color(0xFF3E70E8).copy(alpha = 0.28f), Color(0xFF6B55D3).copy(alpha = 0.18f)),
                        ),
                        labShape,
                    )
                    .border(1.dp, Color(0xFF6FA5FF).copy(alpha = 0.34f), labShape)
                    .clickableNoRipple(onGoLab),
            ) {
                PathLabel(icon = "◉", title = "去人生实验室", note = "带着当前问题，推演几种可能")
            }
        }

        val shareCell: @Composable () -> Unit = {
            val cellShape = RoundedCornerShape(14.dp)
            Box(
                Modifier
                    .background(Color.White.copy(alpha = 0.045f), cellShape)
                    .border(1.dp, Theme.line, cellShape)
                    .clickableNoRipple { shareExploration(context, shareText) },
            ) {
                PathLabel(icon = "↗", title = "分享这次探索", note = "发给一个你信任的人")
            }
        }

        when {
            preferredPath == ChatRecommendedNextStep.LAB -> {
                Box(Modifier.padding(top = 8.dp)) { shareCell() }
            }
            matchedTravelers.isEmpty() && preferredPath == ChatRecommendedNextStep.MATCH -> {
                val loadingShape = RoundedCornerShape(14.dp)
                Row(
                    Modifier
                        .padding(top = 11.dp)
                        .fillMaxWidth()
                        .background(Color.White.copy(alpha = 0.045f), loadingShape)
                        .border(1.dp, Theme.line, loadingShape)
                        .padding(13.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(9.dp),
                ) {
                    CircularProgressIndicator(color = Color(0xFF91B1FF), strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
                    Text("正在为你找走过相似处境的人…", color = Theme.sub, fontSize = 11.sp)
                }
            }
            matchedTravelers.isEmpty() -> {
                Row(
                    Modifier.padding(top = 8.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    val similarShape = RoundedCornerShape(14.dp)
                    Box(
                        Modifier
                            .weight(1f)
                            .background(Color.White.copy(alpha = 0.045f), similarShape)
                            .border(1.dp, Theme.line, similarShape)
                            .clickableNoRipple(onGoSimilar),
                    ) {
                        PathLabel(icon = "⌁", title = "看相似经历", note = "去社区找走过这段路的人")
                    }
                    Box(Modifier.weight(1f)) { shareCell() }
                }
            }
            else -> {
                Text(
                    "看看走过这条路的人",
                    color = Color(0xFF91B1FF),
                    fontSize = 9.sp,
                    letterSpacing = 1.6.sp,
                    modifier = Modifier.padding(top = 13.dp),
                )
                Row(
                    Modifier.padding(top = 9.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    matchedTravelers.take(2).forEach { t ->
                        ChatTravelerCard(
                            traveler = t,
                            reason = matchReasons[t.id],
                            onClick = { if (t.id > 0) onOpenTraveler(t) else onGoSimilar() },
                        )
                    }
                }
                Box(Modifier.padding(top = 8.dp)) { shareCell() }
            }
        }

        if (showSummaryLink) {
            Text(
                "先查看完整总结 →",
                color = Color(0xFF9DBCFF),
                fontSize = 10.sp,
                modifier = Modifier
                    .padding(top = 11.dp)
                    .fillMaxWidth()
                    .clickableNoRipple(onOpenSummary),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }
}

@Composable
private fun PathLabel(icon: String, title: String, note: String) {
    Column(
        Modifier.fillMaxWidth().padding(11.dp),
        verticalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        Text(icon, color = Theme.ink, fontSize = 15.sp)
        Text(title, color = Theme.ink, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 7.dp))
        Text(note, color = Theme.faint, fontSize = 9.sp, lineHeight = 12.sp, modifier = Modifier.padding(top = 3.dp))
    }
}

/** 对话中的经验入口：固定方形卡，一行两张。 */
@Composable
private fun RowScope.ChatTravelerCard(traveler: Traveler, reason: String?, onClick: () -> Unit) {
    val cardShape = RoundedCornerShape(17.dp)
    val accent = Theme.hue(traveler.hue).accent
    Column(
        Modifier
            .weight(1f)
            .height(136.dp)
            .background(Theme.card, cardShape)
            .border(1.dp, accent.copy(alpha = 0.32f), cardShape)
            .clickableNoRipple(onClick)
            .padding(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ChatAvatar(traveler.initial, traveler.hue, 32.dp)
            Text(
                traveler.name,
                color = Theme.ink,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )
        }
        Text(
            reason ?: traveler.quote,
            color = Theme.sub,
            fontSize = 10.sp,
            lineHeight = 13.sp,
            maxLines = 3,
            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 10.dp).weight(1f),
        )
        traveler.tags.firstOrNull()?.let { tag ->
            Text(
                tag,
                color = Color(0xFFB8CDFF),
                fontSize = 9.5.sp,
                maxLines = 1,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
internal fun ChatAvatar(initial: String, hue: Int, size: androidx.compose.ui.unit.Dp) {
    Box(
        Modifier
            .size(size)
            .background(Theme.hue(hue).gradient, RoundedCornerShape(size / 3)),
        contentAlignment = Alignment.Center,
    ) {
        Text(initial, color = Color.White, fontSize = (size.value * 0.42f).sp, fontWeight = FontWeight.Bold)
    }
}

// MARK: - 工具

/** 解析 `**加粗**` 并保留换行，还原 iOS markdownText。 */
internal fun markdownBold(raw: String): AnnotatedString = buildAnnotatedString {
    var i = 0
    var bold = false
    while (i < raw.length) {
        if (i + 1 < raw.length && raw[i] == '*' && raw[i + 1] == '*') {
            bold = !bold
            i += 2
            continue
        }
        val ch = raw[i]
        if (bold) {
            withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(ch) }
        } else {
            append(ch)
        }
        i++
    }
}

/** 系统分享（对应 iOS ShareLink）。 */
internal fun shareExploration(context: android.content.Context, text: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, text)
    }
    context.startActivity(Intent.createChooser(intent, "分享这次探索"))
}
