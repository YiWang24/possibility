package app.possibility.android.features.cardgame

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.network.SupabaseService
import app.possibility.android.core.theme.Theme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// MARK: - 卡牌游戏单局界面（迁移自 ios/Possibility/Features/CardGame/CardGameView.swift）
//
// intro → 选择初始牌 → 抽情境（扇形背面牌，翻牌）→ 决策 → 交换 → 结果。
// 动画在 Android 上做了简化，但完整保留 iOS 的流程、文案与数据映射。

private class DrawException(message: String) : RuntimeException(message)

@Composable
internal fun CardGameScreen(kind: CardGameKind, onExit: () -> Unit) {
    val context = LocalContext.current
    val prefs = remember { CardGamePrefs.get(context) }
    val supabase = SupabaseService.shared
    val scope = rememberCoroutineScope()

    var engine by remember(kind) {
        mutableStateOf(CardGameEngine(kind, null, prefs, supabase.userId.value))
    }
    var sessionSync by remember(kind) { mutableStateOf<CardGameSessionCoordinator?>(null) }
    var isCatalogLoading by remember(kind) { mutableStateOf(true) }
    var catalogLoadError by remember(kind) { mutableStateOf<String?>(null) }
    var selectedFateIndex by remember(kind) { mutableStateOf<Int?>(null) }
    var resultAppeared by remember(kind) { mutableStateOf(false) }
    var isSaving by remember(kind) { mutableStateOf(false) }
    var saveError by remember(kind) { mutableStateOf<String?>(null) }
    var didSyncResult by remember(kind) { mutableStateOf(false) }

    val cfg = engine.config
    val accent = cfg.accentColor

    // onDisappear：未同步则保留进度
    val engineRef by rememberUpdatedState(engine)
    val syncedRef by rememberUpdatedState(didSyncResult)
    androidx.compose.runtime.DisposableEffect(Unit) {
        onDispose { if (!syncedRef) engineRef.saveProgress() }
    }

    LaunchedEffect(engine.phase, engine.round) {
        if (engine.phase == CardGamePhase.DRAW) selectedFateIndex = null
    }

    LaunchedEffect(kind) {
        isCatalogLoading = true
        try {
            val pinned = CardGameSessionCoordinator.pinnedCatalogVersion(kind, supabase, prefs)
            val envelope = supabase.loadCardGameCatalog(kind.rawValue, pinned)
            val config = CardGameConfig.fromEnvelope(envelope)
                ?: throw DrawException("目录不符合 v1 契约")
            val candidate = runCatching {
                CardGameSessionCoordinator.create(kind, envelope.version, supabase, prefs)
            }.getOrNull()
            val userScope = candidate?.userId ?: supabase.userId.value
            val nextEngine = CardGameEngine(kind, config, prefs, userScope)
            if (candidate != null &&
                (candidate.resumed || nextEngine.phase == CardGamePhase.INTRO || nextEngine.phase == CardGamePhase.SELECT)
            ) {
                sessionSync = candidate
                nextEngine.scenarioSeed = candidate.seed
            } else {
                candidate?.clearLocalState()
                sessionSync = null
            }
            engine = nextEngine
            catalogLoadError = null
        } catch (e: Exception) {
            // 内建 v1 作为断网兜底
            sessionSync = null
            engine = CardGameEngine(kind, null, prefs, supabase.userId.value)
            if (engine.config.cards.isEmpty()) {
                catalogLoadError = "这套牌库尚未缓存，请联网后重试。"
            }
        } finally {
            isCatalogLoading = false
        }
    }

    fun back() {
        when (engine.phase) {
            CardGamePhase.TRADE -> engine.cancelTrade()
            CardGamePhase.DECISION -> engine.returnToDraw()
            CardGamePhase.DRAW -> {
                engine.saveProgress()
                ToastCenter.show("${cfg.title}进度已为你保留")
                onExit()
            }
            else -> onExit()
        }
    }

    fun pickFate(index: Int, scenario: GameScenario) {
        if (selectedFateIndex != null) return
        selectedFateIndex = index
        scope.launch {
            delay(300)
            engine.draw(scenario)
            sessionSync?.record(type = "draw_scenario", scenarioKey = scenario.key)
        }
    }

    fun saveAndClose() {
        if (isSaving) return
        val tags = engine.saveResultLocally()
        saveError = null
        isSaving = true
        scope.launch {
            try {
                val ss = sessionSync
                if (ss != null) {
                    ss.complete()
                    engine.clearProgressAfterSync()
                } else {
                    engine.uploadResult(supabase)
                }
                didSyncResult = true
                if (kind == CardGameKind.LIFE) {
                    ToastCenter.show("${engine.finalCardCount} 张底牌已融入动态画像并同步")
                } else {
                    ToastCenter.show(
                        "${cfg.title.take(2)}中最关心的 ${engine.finalCardCount} 点已写入画像：" +
                            tags.joinToString(" · "),
                    )
                }
                onExit()
            } catch (e: Exception) {
                isSaving = false
                saveError = "请检查网络后重试。你的 ${engine.finalCardCount} 张底牌、取舍记录和画像关键词都已安全留在本机。"
            }
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Theme.paper)
            .windowInsetsPadding(WindowInsets.systemBars),
    ) {
        Column(Modifier.fillMaxSize()) {
            TopBar(engine, accent) { back() }
            when (engine.phase) {
                CardGamePhase.INTRO -> IntroPhase(engine, accent) {
                    engine.start()
                }
                CardGamePhase.SELECT -> SelectPhase(
                    engine, accent,
                    onToggle = { id -> engine.toggleSelect(id)?.let { ToastCenter.show(it) } },
                    onConfirm = {
                        val cards = engine.selected
                        engine.confirmSelection()
                        sessionSync?.record(type = "confirm_selection", cardKeys = cards)
                    },
                )
                CardGamePhase.DRAW -> DrawPhase(engine, accent, selectedFateIndex) { i, s ->
                    pickFate(i, s)
                }
                CardGamePhase.DECISION -> DecisionPhase(
                    engine, accent,
                    onAccept = {
                        val key = engine.current?.key
                        engine.accept()
                        sessionSync?.record(type = "accept_scenario", scenarioKey = key)
                    },
                    onTrade = { engine.beginTrade() },
                )
                CardGamePhase.TRADE -> TradePhase(
                    engine, accent,
                    onToggle = { id -> engine.toggleTrade(id)?.let { ToastCenter.show(it) } },
                    onConfirm = {
                        val key = engine.current?.key
                        val cards = engine.tradePick
                        val cannot = engine.reasonCannotAccept.trim()
                        val abandon = engine.reasonAbandon.trim()
                        engine.confirmTrade()
                        sessionSync?.record(
                            type = "trade_cards",
                            scenarioKey = key,
                            cardKeys = cards,
                            reasonCannotAccept = cannot.ifEmpty { null },
                            reasonAbandon = abandon.ifEmpty { null },
                        )
                    },
                )
                CardGamePhase.RESULT -> {
                    LaunchedEffect(Unit) {
                        delay(150)
                        resultAppeared = true
                    }
                    ResultPhase(
                        engine, accent, resultAppeared, isSaving, saveError,
                        onClose = { onExit() },
                        onSave = { saveAndClose() },
                    )
                }
            }
        }

        if (isCatalogLoading) {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Theme.paper.copy(alpha = 0.92f)),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = accent, strokeWidth = 2.dp)
                    Spacer(Modifier.height(12.dp))
                    Text("加载最新牌库…", color = Theme.sub, fontSize = 12.sp)
                }
            }
        } else if (catalogLoadError != null) {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Theme.paper.copy(alpha = 0.96f))
                    .padding(22.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("牌库加载失败", color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        catalogLoadError ?: "",
                        color = Theme.sub, fontSize = 12.sp, textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "返回卡牌大厅",
                        color = Theme.ink, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(Theme.raised)
                            .clickable { onExit() }
                            .padding(horizontal = 18.dp, vertical = 10.dp),
                    )
                }
            }
        }
    }
}

// MARK: 顶栏

@Composable
private fun TopBar(engine: CardGameEngine, accent: Color, onBack: () -> Unit) {
    val cfg = engine.config
    val (title, sub, progressText) = topInfo(engine)
    Column {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(top = 14.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(Theme.raised)
                    .clickable { onBack() },
                contentAlignment = Alignment.Center,
            ) {
                Text("‹", color = Theme.ink, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, color = Theme.ink, fontSize = 15.5.sp, fontWeight = FontWeight.Bold)
                Text(sub, color = Theme.faint, fontSize = 10.5.sp)
            }
            Column(horizontalAlignment = Alignment.End) {
                Box(
                    Modifier
                        .width(70.dp)
                        .height(4.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(Theme.raised),
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth(engine.progress().toFloat().coerceIn(0f, 1f))
                            .height(4.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(
                                Brush.horizontalGradient(listOf(accent, accent.copy(alpha = 0.6f))),
                            ),
                    )
                }
                Spacer(Modifier.height(5.dp))
                Text(progressText, color = Theme.faint, fontSize = 10.sp)
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
    }
}

private fun topInfo(engine: CardGameEngine): Triple<String, String, String> {
    val cfg = engine.config
    return when (engine.phase) {
        CardGamePhase.INTRO -> Triple(cfg.title, "一次关于取舍的模拟", "准备开始")
        CardGamePhase.SELECT -> Triple(
            "选择${cfg.title.take(2)}底牌",
            "向下滑动浏览全部 ${cfg.cards.size} 张",
            "已选 ${engine.selected.size}/${engine.initialSelectCount}",
        )
        CardGamePhase.TRADE -> Triple(
            "交换底牌",
            "选择 ${engine.discardPerTrade} 张牌作为代价",
            "已选 ${engine.tradePick.size}/${engine.discardPerTrade}",
        )
        CardGamePhase.RESULT -> Triple("这一局的回望", "结果默认仅自己可见", "完成")
        else -> {
            val stage = engine.stageMeta
            Triple(stage.first, "${stage.second} · 持有 ${engine.held.size} 张底牌", "第 ${engine.round + 1} 轮")
        }
    }
}

// MARK: intro

@Composable
private fun IntroPhase(engine: CardGameEngine, accent: Color, onStart: () -> Unit) {
    val cfg = engine.config
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(top = 14.dp, bottom = 26.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            FanSpread(accent, Modifier.fillMaxWidth().padding(top = 12.dp))
            Text(
                cfg.eyebrow, color = accent.copy(alpha = 0.9f),
                fontSize = 9.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.6.sp,
            )
            Text(cfg.introTitle, color = Theme.ink, fontSize = 23.sp, fontWeight = FontWeight.Bold, lineHeight = 30.sp)
            Text(cfg.introCopy, color = Theme.sub, fontSize = 12.5.sp, lineHeight = 18.5.sp)
            cfg.rules.forEachIndexed { idx, rule ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .kaleidoCardBox(14.dp)
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Box(
                        Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(9.dp))
                            .background(accent.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            String.format("%02d", idx + 1),
                            color = accent, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                        )
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(rule.first, color = Theme.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        Text(rule.second, color = Theme.sub, fontSize = 11.sp, lineHeight = 14.sp)
                    }
                }
            }
            cfg.contentWarning?.let { warning ->
                Text(
                    warning, color = Theme.faint, fontSize = 10.5.sp, lineHeight = 14.5.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(rgba(0xFF7A4DL, 0.07f))
                        .border(1.dp, rgba(0xFF7A4DL, 0.22f), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                )
            }
        }
        FootBar("开始这一局", enabled = true, onClick = onStart)
    }
}

@Composable
private fun FanSpread(accent: Color, modifier: Modifier = Modifier) {
    Box(modifier.height(96.dp), contentAlignment = Alignment.Center) {
        (0 until 5).forEach { i ->
            val d = (i - 2).toFloat()
            Box(
                Modifier
                    .offset(x = (d * 26f).dp, y = (kotlin.math.abs(d) * 6f).dp)
                    .rotate(d * 11f)
                    .width(52.dp)
                    .height(74.dp)
                    .clip(RoundedCornerShape(9.dp))
                    .background(
                        Brush.linearGradient(listOf(accent.copy(alpha = 0.55f), accent.copy(alpha = 0.2f))),
                    )
                    .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(9.dp)),
            )
        }
    }
}

// MARK: 选牌

@Composable
private fun SelectPhase(
    engine: CardGameEngine,
    accent: Color,
    onToggle: (String) -> Unit,
    onConfirm: () -> Unit,
) {
    val cfg = engine.config
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp)
                .padding(top = 14.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(
                        "YOUR FOUNDATION", color = accent.copy(alpha = 0.9f),
                        fontSize = 9.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.2.sp,
                    )
                    Text(cfg.selectTitle, color = Theme.ink, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("已选", color = Theme.faint, fontSize = 9.5.sp)
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text("${engine.selected.size}", color = accent, fontSize = 20.sp, fontWeight = FontWeight.Black)
                        Text("/${engine.initialSelectCount}", color = Theme.faint, fontSize = 11.sp)
                    }
                }
            }
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(Theme.raised),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth(
                            (engine.selected.size.toFloat() / maxOf(1, engine.initialSelectCount)).coerceIn(0f, 1f),
                        )
                        .height(4.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(accent),
                )
            }
            Text("没有标准答案，此刻的选择只代表这一局", color = Theme.faint, fontSize = 10.5.sp)

            cfg.cards.chunked(2).forEachIndexed { rowIdx, row ->
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    row.forEachIndexed { colIdx, card ->
                        Box(Modifier.weight(1f)) {
                            SelectCard(engine, accent, card, rowIdx * 2 + colIdx, onToggle)
                        }
                    }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
            }
            Text(
                "已展示全部 ${cfg.cards.size} 张底牌",
                color = Theme.faint, fontSize = 10.5.sp,
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                textAlign = TextAlign.Center,
            )
        }
        val complete = engine.selected.size == engine.initialSelectCount
        FootBar(
            if (complete) "带着这 ${engine.initialSelectCount} 张牌出发"
            else "还需选择 ${engine.initialSelectCount - engine.selected.size} 张",
            enabled = complete,
            onClick = onConfirm,
        )
    }
}

@Composable
private fun SelectCard(
    engine: CardGameEngine,
    accent: Color,
    card: GameCard,
    index: Int,
    onToggle: (String) -> Unit,
) {
    val on = engine.selected.contains(card.id)
    val cfg = engine.config
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (on) accent.copy(alpha = 0.1f) else Theme.card)
            .border(
                if (on) 1.4.dp else 1.dp,
                if (on) accent.copy(alpha = 0.65f) else Theme.line,
                RoundedCornerShape(14.dp),
            )
            .clickable { onToggle(card.id) }
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "${cfg.cardPrefix} · ${String.format("%02d", index + 1)}",
                color = Theme.faint, fontSize = 7.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp,
                modifier = Modifier.weight(1f),
            )
            Box(
                Modifier
                    .size(19.dp)
                    .clip(CircleShape)
                    .background(if (on) accent else Theme.raised),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    if (on) "✓" else "+",
                    color = if (on) Color.White else Theme.faint,
                    fontSize = 11.sp, fontWeight = FontWeight.Bold,
                )
            }
        }
        Text(card.glyph, color = if (on) accent else Theme.sub, fontSize = 21.sp)
        Text(
            card.name, color = Theme.ink, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1,
        )
        Text(card.group, color = Theme.faint, fontSize = 9.5.sp)
    }
}

// MARK: 抽牌（扇形背面牌）

@Composable
private fun DrawPhase(
    engine: CardGameEngine,
    accent: Color,
    selectedFateIndex: Int?,
    onPick: (Int, GameScenario) -> Unit,
) {
    val cfg = engine.config
    val options = engine.scenarioOptions
    val severity = engine.severityMeta
    val pressureColor = pressureColor(engine)
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp)
            .padding(top = 16.dp, bottom = 26.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                "STAGE ${String.format("%02d", engine.round + 1)} · ${engine.stageMeta.first}",
                color = accent.copy(alpha = 0.9f),
                fontSize = 9.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.sp,
            )
            Text(engine.stageMeta.second, color = Theme.ink, fontSize = 21.sp, fontWeight = FontWeight.Bold)
            Text(
                if (engine.acceptStreak > 0)
                    "你已连续接受 ${engine.acceptStreak} 次，压力正在加码。"
                else
                    "命运放下了 ${engine.scenarioChoiceCount} 张牌。凭直觉，抽一张。",
                color = Theme.sub, fontSize = 12.sp,
            )
        }

        // 压力表
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(Theme.card)
                .border(1.dp, pressureColor.copy(alpha = 0.3f), RoundedCornerShape(14.dp))
                .padding(13.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(cfg.pressureLabel, color = Theme.faint, fontSize = 10.5.sp, modifier = Modifier.weight(1f))
                Text(severity.first, color = pressureColor, fontSize = 12.5.sp, fontWeight = FontWeight.Bold)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                (engine.pressureMin..engine.pressureMax).forEach { level ->
                    Box(
                        Modifier
                            .weight(1f)
                            .height(4.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(if (level <= engine.pressure) pressureColor else Theme.raised),
                    )
                }
            }
            Text(severity.second, color = Theme.sub, fontSize = 11.sp, lineHeight = 14.sp)
        }

        // 扇形牌弧（横向可滑动，简化动画）
        Box(
            Modifier
                .fillMaxWidth()
                .height(214.dp)
                .horizontalScroll(rememberScrollState()),
            contentAlignment = Alignment.Center,
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(horizontal = 24.dp),
            ) {
                val mid = (options.size - 1) / 2f
                options.forEachIndexed { i, scenario ->
                    val d = i - mid
                    val isSelected = selectedFateIndex == i
                    FaceDownCard(
                        accent = accent,
                        isSelected = isSelected,
                        rotationDeg = d * 12.5f,
                        yOffset = -(2 * d * d + 15 * kotlin.math.abs(d) - 10),
                        onClick = { onPick(i, scenario) },
                    )
                }
            }
        }

        Text(
            "左右滑动牌弧 · 点击其中一张",
            color = Theme.faint, fontSize = 10.5.sp,
            modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun FaceDownCard(
    accent: Color,
    isSelected: Boolean,
    rotationDeg: Float,
    yOffset: Float,
    onClick: () -> Unit,
) {
    Box(
        Modifier
            .offset(y = (if (isSelected) -16f else yOffset).dp)
            .rotate(rotationDeg)
            .scale(if (isSelected) 1.08f else 1f)
            .width(120.dp)
            .height(165.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(
                Brush.linearGradient(listOf(rgb(0x232948L), rgb(0x161A30L))),
            )
            .border(
                if (isSelected) 2.dp else 1.dp,
                if (isSelected) accent else accent.copy(alpha = 0.35f),
                RoundedCornerShape(16.dp),
            )
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Text("✦", color = accent.copy(alpha = if (isSelected) 1f else 0.5f), fontSize = 21.sp)
    }
}

// MARK: 决策

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DecisionPhase(
    engine: CardGameEngine,
    accent: Color,
    onAccept: () -> Unit,
    onTrade: () -> Unit,
) {
    val cfg = engine.config
    val scenario = engine.current ?: return
    val severity = engine.severityMeta
    val pressureColor = pressureColor(engine)
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(top = 16.dp, bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(15.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "第 ${engine.round + 1} 轮 · ${if (cfg.kind == CardGameKind.LIFE) engine.stageMeta.second else scenario.theme}",
                color = Theme.sub, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(Theme.raised)
                    .padding(horizontal = 12.dp, vertical = 5.dp),
            )
            // 情境卡
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(accent.copy(alpha = 0.75f), accent.copy(alpha = 0.35f), rgb(0x161A30L)),
                        ),
                    )
                    .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(20.dp))
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(11.dp),
            ) {
                Text(
                    "${cfg.cardPrefix} · SETBACK ${String.format("%02d", engine.round + 1)}",
                    color = Color.White.copy(alpha = 0.55f),
                    fontSize = 8.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.sp,
                )
                Text(
                    cfg.glyph, color = Color.White.copy(alpha = 0.4f), fontSize = 22.sp,
                    modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.End,
                )
                Text(scenario.title, color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                Text(scenario.copy, color = Color.White.copy(alpha = 0.78f), fontSize = 12.5.sp, lineHeight = 17.5.sp)
            }

            Text(
                "${severity.first} · 拒绝需交换 ${engine.discardPerTrade} 张",
                color = pressureColor, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(pressureColor.copy(alpha = 0.1f))
                    .border(1.dp, pressureColor.copy(alpha = 0.4f), RoundedCornerShape(999.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            )
            Text(
                "接受它，会保留所有底牌，但下一轮会继续加码；\n拒绝它，则放下 ${engine.discardPerTrade} 张底牌。直到手中自然只剩 ${engine.finalCardCount} 张。",
                color = Theme.sub, fontSize = 11.5.sp, lineHeight = 16.5.sp, textAlign = TextAlign.Center,
            )
            // 持有条
            FlowRow(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                engine.heldCards.forEach { card ->
                    Text(
                        card.name, color = Theme.sub, fontSize = 10.5.sp,
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(Theme.raised)
                            .padding(horizontal = 9.dp, vertical = 4.dp),
                    )
                }
            }
        }
        Column {
            Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(top = 12.dp, bottom = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    "接受它", color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(999.dp))
                        .background(Theme.buttonGradient)
                        .clickable { onAccept() }
                        .padding(vertical = 14.dp),
                )
                val canTrade = engine.canTrade
                Text(
                    if (canTrade) "我不接受" else "只剩最终底牌",
                    color = if (canTrade) rgb(0xFF9A8AL) else Theme.faint,
                    fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center,
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(999.dp))
                        .background(rgba(0xFF6A5CL, if (canTrade) 0.12f else 0.05f))
                        .border(1.dp, rgba(0xFF6A5CL, if (canTrade) 0.45f else 0.15f), RoundedCornerShape(999.dp))
                        .then(if (canTrade) Modifier.clickable { onTrade() } else Modifier)
                        .padding(vertical = 14.dp),
                )
            }
        }
    }
}

// MARK: 交换

@Composable
private fun TradePhase(
    engine: CardGameEngine,
    accent: Color,
    onToggle: (String) -> Unit,
    onConfirm: () -> Unit,
) {
    val cfg = engine.config
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp)
                .padding(top = 16.dp, bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(
                    "THE PRICE", color = accent.copy(alpha = 0.9f),
                    fontSize = 9.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.2.sp,
                )
                Text("你愿意用什么交换？", color = Theme.ink, fontSize = 19.sp, fontWeight = FontWeight.Bold)
            }
            Text(
                "为了让“${engine.current?.title ?: ""}”不发生，请从仍持有的 ${engine.held.size} 张底牌中放下 ${engine.discardPerTrade} 张。最后 ${engine.finalCardCount} 张会被保留。",
                color = Theme.sub, fontSize = 11.5.sp, lineHeight = 16.5.sp,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(accent.copy(alpha = 0.07f))
                    .border(1.dp, accent.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
                    .padding(12.dp),
            )
            engine.heldCards.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    row.forEach { card ->
                        Box(Modifier.weight(1f)) { TradeCard(engine, card, onToggle) }
                    }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
            }
            ReasonField(
                label = "为什么你不能接受这件事？", hint = "写下第一反应",
                placeholder = "例如：我无法接受重要的人因为我受到伤害……",
                value = engine.reasonCannotAccept,
                onValueChange = { engine.reasonCannotAccept = it },
            )
            ReasonField(
                label = "为什么愿意放弃这 ${engine.discardPerTrade} 张牌？", hint = "没有标准答案",
                placeholder = "例如：这些东西可以以后再争取……",
                value = engine.reasonAbandon,
                onValueChange = { engine.reasonAbandon = it },
            )
            Text("你的原话会成为结果分析的重要依据，默认只进入私密画像。", color = Theme.faint, fontSize = 10.sp)
        }
        FootBar(
            "确认交换 ${engine.discardPerTrade} 张牌",
            enabled = engine.tradePick.size == engine.discardPerTrade,
            onClick = onConfirm,
        )
    }
}

@Composable
private fun TradeCard(engine: CardGameEngine, card: GameCard, onToggle: (String) -> Unit) {
    val picked = engine.tradePick.contains(card.id)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(13.dp))
            .background(if (picked) rgba(0xFF6A5CL, 0.1f) else Theme.card)
            .border(
                if (picked) 1.4.dp else 1.dp,
                if (picked) rgba(0xFF6A5CL, 0.55f) else Theme.line,
                RoundedCornerShape(13.dp),
            )
            .clickable { onToggle(card.id) }
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(card.glyph, color = if (picked) rgb(0xFF9A8AL) else Theme.sub, fontSize = 16.sp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(card.name, color = Theme.ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            Text(card.group, color = Theme.faint, fontSize = 9.5.sp)
        }
        if (picked) Text("×", color = rgb(0xFF9A8AL), fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun ReasonField(
    label: String,
    hint: String,
    placeholder: String,
    value: String,
    onValueChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(label, color = Theme.ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            Text(hint, color = Theme.faint, fontSize = 10.sp)
        }
        Box(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Theme.raised)
                .border(1.dp, Theme.line, RoundedCornerShape(12.dp))
                .padding(11.dp),
        ) {
            if (value.isEmpty()) {
                Text(placeholder, color = Theme.faint, fontSize = 12.5.sp)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = TextStyle(color = Theme.ink, fontSize = 12.5.sp, lineHeight = 17.sp),
                cursorBrush = SolidColor(Theme.blue),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

// MARK: 结果

@Composable
private fun ResultPhase(
    engine: CardGameEngine,
    accent: Color,
    resultAppeared: Boolean,
    isSaving: Boolean,
    saveError: String?,
    onClose: () -> Unit,
    onSave: () -> Unit,
) {
    val cfg = engine.config
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
        ) {
            if (cfg.kind == CardGameKind.LIFE) {
                LifeResult(engine, resultAppeared)
            } else {
                RelationResult(engine, accent, resultAppeared)
            }
        }
        if (saveError != null) {
            Column {
                Box(Modifier.fillMaxWidth().height(1.dp).background(rgba(0xFF7A4DL, 0.3f)))
                Column(
                    Modifier
                        .fillMaxWidth()
                        .background(rgba(0xFF7A4DL, 0.09f))
                        .padding(13.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        "已保存在本机，云端同步失败",
                        color = rgb(0xFFB096L), fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold,
                    )
                    Text(saveError, color = Theme.sub, fontSize = 10.5.sp, lineHeight = 13.5.sp)
                    Text(
                        "暂时关闭，稍后从“待同步”继续",
                        color = Theme.ink, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clickable { onClose() },
                    )
                }
            }
        }
        val label = when {
            isSaving -> "正在保存…"
            saveError == null ->
                if (cfg.kind == CardGameKind.LIFE) "保存到我的私密画像"
                else "保存最关心的 ${engine.finalCardCount} 点"
            else -> "重试云端同步"
        }
        FootBar(label, enabled = !isSaving, onClick = onSave)
    }
}

@Composable
private fun RelationResult(engine: CardGameEngine, accent: Color, resultAppeared: Boolean) {
    val cfg = engine.config
    val cards = engine.heldCards
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp)
            .padding(top = 22.dp, bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier
                .size(66.dp)
                .clip(CircleShape)
                .background(accent.copy(alpha = 0.12f))
                .border(1.dp, accent.copy(alpha = 0.4f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(cfg.glyph, color = accent, fontSize = 30.sp)
        }
        Text(
            "${cfg.title.take(2)}中，你最关心这 ${engine.finalCardCount} 点",
            color = Theme.ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
        )
        Text(
            "${engine.groupNarrative}\n它们来自多轮情境与交换，不是固定答案，而是你此刻真实的优先级。",
            color = Theme.sub, fontSize = 12.sp, lineHeight = 17.sp, textAlign = TextAlign.Center,
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            cards.forEach { card ->
                Column(
                    Modifier
                        .weight(1f)
                        .alpha(if (resultAppeared) 1f else 0f)
                        .scale(if (resultAppeared) 1f else 0.85f)
                        .clip(RoundedCornerShape(14.dp))
                        .background(accent.copy(alpha = 0.09f))
                        .border(1.dp, accent.copy(alpha = 0.4f), RoundedCornerShape(14.dp))
                        .padding(vertical = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(7.dp),
                ) {
                    Text(card.glyph, color = accent, fontSize = 19.sp)
                    Text(card.name, color = Theme.ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                }
            }
        }
        Column(
            Modifier
                .fillMaxWidth()
                .kaleidoCardBox(16.dp)
                .padding(15.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                "SIGNAL · 可写入画像", color = accent.copy(alpha = 0.9f),
                fontSize = 9.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.sp,
            )
            Text(
                cards.joinToString(" · ") { it.name },
                color = Theme.ink, fontSize = 14.5.sp, fontWeight = FontWeight.Bold,
            )
            Text(
                "本次经历了 ${engine.round} 轮情境，接受 ${engine.accepted.size} 次、主动交换 ${engine.traded.size} 次。这 ${engine.finalCardCount} 点会成为画像的优先信号。",
                color = Theme.sub, fontSize = 11.5.sp, lineHeight = 16.5.sp,
            )
        }
    }
}

@Composable
private fun LifeResult(engine: CardGameEngine, resultAppeared: Boolean) {
    val a = engine.lifeAnalysis()
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp)
            .padding(top = 22.dp, bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier
                .size(62.dp)
                .clip(CircleShape)
                .background(Brush.sweepGradient(Theme.orbConicColors))
                .border(1.dp, Color.White.copy(alpha = 0.25f), CircleShape),
        )
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                "你的动态数字人 · 新切面", color = Theme.faint,
                fontSize = 9.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.sp,
            )
            Text(
                a.title, fontSize = 22.sp, fontWeight = FontWeight.Black,
                style = TextStyle(brush = Theme.aurora),
            )
            Text(
                "这不是在判断你好或不好，\n而是在看代价出现时，你最先保护了什么。",
                color = Theme.sub, fontSize = 11.5.sp, lineHeight = 15.5.sp, textAlign = TextAlign.Center,
            )
        }

        ResultBlock("THE TRUTH BENEATH · 内心真相", 0x8F7BFFL) {
            Text(a.truth, color = Theme.ink.copy(alpha = 0.92f), fontSize = 12.sp, lineHeight = 17.sp)
            Text(
                "判断来自你留下、典当和为之接受挫折的牌，而不只是最终结果。",
                color = Theme.faint, fontSize = 9.5.sp,
            )
        }

        if (a.voiceQuotes.isNotEmpty()) {
            ResultBlock("YOUR OWN WORDS · 你亲口说出的线索", 0x3ED9A4L) {
                a.voiceQuotes.forEach { quote ->
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color.White.copy(alpha = 0.04f))
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(3.dp),
                    ) {
                        Text(quote.first, color = rgb(0x8EE7C8L), fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold)
                        Text("“${quote.second}”", color = Theme.sub, fontSize = 11.5.sp, lineHeight = 15.5.sp)
                    }
                }
                if (a.reasonInsight.isNotEmpty()) {
                    Text(a.reasonInsight, color = Theme.sub, fontSize = 11.sp, lineHeight = 15.sp)
                }
            }
        }

        ResultBlock("将融入动态画像的 ${engine.finalCardCount} 张底牌", 0x5E96FFL) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                a.held.forEach { card ->
                    Row(
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(11.dp))
                            .background(Theme.hue(0).gradient)
                            .padding(vertical = 11.dp),
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(card.glyph, color = Color.White, fontSize = 12.sp)
                        Text(card.name, color = Color.White, fontSize = 11.5.sp, fontWeight = FontWeight.Medium, maxLines = 1)
                    }
                }
            }
        }

        // 心理倾向光谱
        ResultBlock("你的心理倾向光谱", 0x8F7BFFL) {
            a.spectrum.forEach { row ->
                Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(row.first, color = Theme.faint, fontSize = 10.sp, modifier = Modifier.weight(1f))
                        Text(row.second, color = Theme.faint, fontSize = 10.sp)
                    }
                    Box(Modifier.fillMaxWidth().height(14.dp), contentAlignment = Alignment.CenterStart) {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(4.dp)
                                .clip(RoundedCornerShape(999.dp))
                                .background(Theme.raised),
                        )
                        val fraction = if (resultAppeared) (row.third / 100f).coerceIn(0f, 1f) else 0.5f
                        Box(Modifier.fillMaxWidth(fraction), contentAlignment = Alignment.CenterEnd) {
                            Box(
                                Modifier
                                    .size(12.dp)
                                    .clip(CircleShape)
                                    .background(rgb(0x9F8DF5L))
                                    .border(2.dp, rgb(0x7666D9L), CircleShape),
                            )
                        }
                    }
                }
            }
        }

        ResultBlock("INNER TENSION · 内在张力", 0xE35CC1L) {
            Text("你想拥有的，和你会拿去交换的", color = Theme.ink, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            Text(a.tension, color = Theme.sub, fontSize = 11.5.sp, lineHeight = 16.5.sp)
        }
        ResultBlock("POSSIBLE BLIND SPOT · 可能的盲点", 0xFF7A4DL) {
            Text(a.blindspot, color = Theme.sub, fontSize = 11.5.sp, lineHeight = 16.5.sp)
        }
        ResultBlock("留给真实生活的一个问题", 0x9DBCFFL) {
            Text(a.reflection, color = Theme.ink.copy(alpha = 0.9f), fontSize = 12.sp, lineHeight = 17.sp)
        }

        Text(
            "本次推断基于：接受 ${a.acceptedCount} 次挫折、主动交换 ${a.tradedCount} 次、最终保留 ${a.held.size} 张底牌。它是一面自我探索的镜子，不是心理诊断。",
            color = Theme.faint, fontSize = 9.5.sp, lineHeight = 13.5.sp,
        )
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(rgba(0x3ED9A4L, 0.06f))
                .padding(11.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("◉", color = rgb(0x8EE7C8L), fontSize = 11.sp)
            Text(
                "${engine.finalCardCount} 张人生底牌会作为画像信号融入动态数字形象；其余 ${a.hiddenTraits.size} 条深层推断仍默认私密，只用于帮助数字人理解你。",
                color = Theme.faint, fontSize = 10.sp, lineHeight = 14.sp,
            )
        }
    }
}

@Composable
private fun ResultBlock(kicker: String, tint: Long, content: @Composable () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Theme.card)
            .border(1.dp, rgba(tint, 0.22f), RoundedCornerShape(16.dp))
            .padding(15.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Text(
            kicker, color = rgba(tint, 0.95f),
            fontSize = 9.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.8.sp,
        )
        content()
    }
}

// MARK: 底部按钮

@Composable
private fun FootBar(label: String, enabled: Boolean, onClick: () -> Unit) {
    Column {
        Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
        Box(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(top = 12.dp, bottom = 14.dp),
        ) {
            Text(
                label, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .alpha(if (enabled) 1f else 0.45f)
                    .clip(RoundedCornerShape(999.dp))
                    .background(Theme.buttonGradient)
                    .then(if (enabled) Modifier.clickable { onClick() } else Modifier)
                    .padding(vertical = 15.dp),
            )
        }
    }
}

private fun pressureColor(engine: CardGameEngine): Color {
    val colors = listOf(rgb(0x7CABFFL), rgb(0xD9B563L), rgb(0xFF9A6BL), rgb(0xF06A6AL))
    val index = (engine.pressure - engine.pressureMin).coerceIn(0, colors.size - 1)
    return colors[index]
}

/** 卡片样式（避免与 Theme.kaleidoCard 命名冲突的局部实现）。 */
private fun Modifier.kaleidoCardBox(radius: androidx.compose.ui.unit.Dp): Modifier =
    this
        .clip(RoundedCornerShape(radius))
        .background(Theme.card)
        .border(1.dp, Theme.line, RoundedCornerShape(radius))
