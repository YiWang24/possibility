package app.possibility.android.features.studio

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material3.Icon
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.theme.Theme
import kotlinx.coroutines.launch

// MARK: - 统一测评答题器（迁移自 iOS AssessmentView.swift / AssessmentResultView.swift）
//
// intro → 逐题（5 点 Likert，自动保存）→ 结果。全屏覆盖，深色主题严格用 Theme token。

/** 首页 / 画像工坊入口使用的对外 API：全屏测评浮层。 */
@Composable
fun AssessmentFlowSheet(kind: AssessmentKind, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val model = remember(kind) { AssessmentModel(kind, context.applicationContext) }

    // 已有结果直接进结果页（原型 openAssessmentIntro 分流）
    LaunchedEffect(model) {
        if (model.result != null) model.phase = AssessmentModel.Phase.RESULT
    }

    fun exitSaving() {
        model.persist()
        if (model.phase == AssessmentModel.Phase.QUESTIONS) {
            ToastCenter.show("进度已保留，下次可以继续")
        }
        onDismiss()
    }

    BackHandler { if (model.phase == AssessmentModel.Phase.RESULT) onDismiss() else exitSaving() }

    Box(
        Modifier
            .fillMaxSize()
            .background(Theme.paper)
            .systemBarsPadding(),
    ) {
        if (model.phase == AssessmentModel.Phase.RESULT) {
            ResultView(model = model, onBack = onDismiss)
        } else {
            Column(Modifier.fillMaxSize()) {
                TopBar(model = model, onExit = ::exitSaving)
                when (model.phase) {
                    AssessmentModel.Phase.INTRO -> IntroView(model, onDismiss)
                    AssessmentModel.Phase.QUESTIONS -> QuestionsView(model, onDismiss)
                    AssessmentModel.Phase.RESULT -> Unit
                }
            }
        }
    }
}

// MARK: 顶栏 + 进度

@Composable
private fun TopBar(model: AssessmentModel, onExit: () -> Unit) {
    Column {
        Row(
            Modifier
                .fillMaxWidth()
                .background(Theme.paper.copy(alpha = 0.92f))
                .padding(horizontal = 20.dp)
                .padding(top = 14.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CircleBack(onClick = onExit)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(model.config.title, color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Text(model.config.sub, color = Theme.faint, fontSize = 10.5.sp)
            }
            Spacer(Modifier.width(12.dp))
            Column(horizontalAlignment = Alignment.End) {
                ProgressTrack(progress = model.progress, width = 74.dp)
                Spacer(Modifier.height(5.dp))
                Text(
                    if (model.phase == AssessmentModel.Phase.INTRO) "准备开始"
                    else "${model.index + 1} / ${model.config.items.size}",
                    color = Theme.faint, fontSize = 10.sp,
                )
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
    }
}

@Composable
private fun ProgressTrack(progress: Float, width: androidx.compose.ui.unit.Dp) {
    val animated by animateFloatAsState(targetValue = progress.coerceIn(0f, 1f), animationSpec = tween(300), label = "progress")
    Box(Modifier.width(width).height(4.dp).clip(CircleShape).background(Theme.raised)) {
        Box(
            Modifier
                .fillMaxHeight()
                .fillMaxWidth(animated)
                .clip(CircleShape)
                .background(Theme.aurora),
        )
    }
}

@Composable
private fun CircleBack(onClick: () -> Unit) {
    Box(
        Modifier
            .size(34.dp)
            .clip(CircleShape)
            .background(Theme.raised)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(Icons.Filled.KeyboardArrowLeft, contentDescription = "返回", tint = Theme.ink, modifier = Modifier.size(22.dp))
    }
}

// MARK: 简介

@Composable
private fun IntroView(model: AssessmentModel, onDismiss: () -> Unit) {
    val cfg = model.config
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(top = 30.dp, bottom = 30.dp),
        ) {
            Text(cfg.kicker, color = hexColor(0x9DBCFF), fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.4.sp)
            Text(
                cfg.introTitle, color = Theme.ink, fontSize = 24.sp, fontWeight = FontWeight.Bold,
                lineHeight = 33.sp, modifier = Modifier.padding(top = 14.dp),
            )
            Text(cfg.intro, color = Theme.sub, fontSize = 13.5.sp, lineHeight = 21.sp, modifier = Modifier.padding(top = 14.dp))
            Column(
                Modifier
                    .padding(top = 22.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Theme.card)
                    .border(1.dp, Theme.line, RoundedCornerShape(16.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                cfg.notices.forEach { n ->
                    Row(verticalAlignment = Alignment.Top) {
                        Box(Modifier.padding(top = 6.dp).size(4.dp).clip(CircleShape).background(Theme.blue))
                        Spacer(Modifier.width(9.dp))
                        Text(n, color = Theme.sub, fontSize = 12.sp, lineHeight = 17.sp)
                    }
                }
            }
        }
        FootBar(
            secondaryLabel = "以后再说",
            onSecondary = onDismiss,
            primaryLabel = if (model.answeredCount > 0) "继续 ${model.answeredCount}/${cfg.items.size}" else "开始测评",
            onPrimary = { model.begin() },
            primaryEnabled = true,
        )
    }
}

// MARK: 逐题

@Composable
private fun QuestionsView(model: AssessmentModel, onDismiss: () -> Unit) {
    val cfg = model.config
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(top = 28.dp, bottom = 30.dp),
        ) {
            Text(
                if (cfg.kind == AssessmentKind.HOLLAND) "凭第一感觉回答 · 不考能力" else "按照真实状态回答 · 没有正确答案",
                color = hexColor(0x9DBCFF), fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.sp,
            )
            Text(
                cfg.items[model.index].text, color = Theme.ink, fontSize = 21.sp, fontWeight = FontWeight.Bold,
                lineHeight = 30.sp, modifier = Modifier.padding(top = 14.dp),
            )
            Column(Modifier.padding(top = 24.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                cfg.likert.forEachIndexed { value, label ->
                    val on = model.currentAnswer == value
                    LikertOption(label = label, on = on) { model.select(value) }
                }
            }
            Text(
                if (model.currentAnswer == null) "选择后自动保存" else "✓ 已保存在当前设备",
                color = Theme.faint, fontSize = 11.sp, modifier = Modifier.padding(top = 16.dp),
            )
        }
        FootBar(
            secondaryLabel = "上一题",
            onSecondary = { model.previous() },
            secondaryEnabled = model.index != 0,
            primaryLabel = if (model.isLast) "生成结果" else "下一题",
            onPrimary = { model.next()?.let { ToastCenter.show(it) } },
            primaryEnabled = model.currentAnswer != null,
        )
    }
}

@Composable
private fun LikertOption(label: String, on: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(13.dp)
    val base = Modifier
        .fillMaxWidth()
        .clip(shape)
    val filled = if (on) base.background(Theme.buttonGradient) else base.background(Theme.raised)
    Box(
        filled
            .border(1.dp, if (on) hexColor(0x6FA5FF, 0.7f) else Theme.line, shape)
            .clickable(onClick = onClick)
            .padding(vertical = 13.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (on) androidx.compose.ui.graphics.Color.White else Theme.sub,
            fontSize = 13.5.sp,
            fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal,
        )
    }
}

// MARK: 底部按钮

@Composable
private fun FootBar(
    secondaryLabel: String,
    onSecondary: () -> Unit,
    primaryLabel: String,
    onPrimary: () -> Unit,
    primaryEnabled: Boolean,
    secondaryEnabled: Boolean = true,
) {
    Column {
        Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
        Row(
            Modifier
                .fillMaxWidth()
                .background(Theme.paper)
                .padding(horizontal = 20.dp)
                .padding(top = 12.dp, bottom = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                Modifier
                    .weight(1f)
                    .clip(CircleShape)
                    .background(Theme.raised)
                    .then(if (secondaryEnabled) Modifier.clickable(onClick = onSecondary) else Modifier)
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(secondaryLabel, color = Theme.sub.copy(alpha = if (secondaryEnabled) 1f else 0.4f), fontSize = 13.5.sp, fontWeight = FontWeight.Medium)
            }
            Box(
                Modifier
                    .weight(1f)
                    .clip(CircleShape)
                    .background(Theme.buttonGradient)
                    .then(if (primaryEnabled) Modifier.clickable(onClick = onPrimary) else Modifier)
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    primaryLabel,
                    color = androidx.compose.ui.graphics.Color.White.copy(alpha = if (primaryEnabled) 1f else 0.45f),
                    fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

// MARK: 结果页（原型 renderHollandResult / renderDemoAssessmentResult）

@OptIn(ExperimentalLayoutApi::class, ExperimentalFoundationApi::class)
@Composable
private fun ResultView(model: AssessmentModel, onBack: () -> Unit) {
    val cfg = model.config
    val isHolland = cfg.kind == AssessmentKind.HOLLAND
    val scope = rememberCoroutineScope()
    var barsAppeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { barsAppeared = true }

    Column(Modifier.fillMaxSize()) {
        // 顶栏
        Column {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 14.dp, bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircleBack(onClick = onBack)
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(cfg.resultTitle, color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Text(cfg.resultSub, color = Theme.faint, fontSize = 10.5.sp)
                }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
        }

        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp)
                .padding(top = 18.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            ResultHero(model, isHolland)
            ResultBars(model, isHolland, barsAppeared)
            if (cfg.kind == AssessmentKind.BIGFIVE) FacetSummary(model, barsAppeared)
            InsightCard(model, isHolland)
            Text(methodNote(cfg.kind), color = Theme.faint, fontSize = 10.5.sp, lineHeight = 14.5.sp)
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(bottom = 26.dp)
                    .clip(CircleShape)
                    .background(Theme.buttonGradient)
                    .clickable {
                        scope.launch {
                            runCatching { model.saveToProfile() }
                            ToastCenter.show("结果已写入画像 · 原始答案默认私密")
                            onBack()
                        }
                    }
                    .padding(vertical = 15.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(cfg.saveLabel, color = androidx.compose.ui.graphics.Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun ResultHero(model: AssessmentModel, isHolland: Boolean) {
    val cfg = model.config
    val res = model.result
    val heroCode = if (isHolland) {
        res?.displayCode ?: res?.code ?: ""
    } else {
        model.resultTags.take(2).joinToString(" · ")
    }
    val heroTitle = if (isHolland) {
        val top = res?.selected ?: (res?.ordered?.take(3) ?: emptyList())
        val names = top.joinToString("、") { cfg.dim(it).name.replace("型", "") }
        "你的兴趣更靠近\n$names"
    } else {
        "这不是给你定型，\n而是留下当前可修正的证据。"
    }
    val shape = RoundedCornerShape(22.dp)
    Box(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(
                Brush.linearGradient(listOf(hexColor(0x141A34), hexColor(0x1B2148), hexColor(0x10132A))),
            )
            .border(1.dp, hexColor(0x7A9EFF, 0.26f), shape)
            .padding(20.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                if (isHolland) "YOUR INTEREST CONSTELLATION" else "YOUR CURRENT PROFILE SIGNAL",
                color = hexColor(0xC9D8FF, 0.85f), fontSize = 9.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.4.sp,
            )
            Text(
                heroCode,
                fontSize = if (heroCode.length > 5) 24.sp else 30.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.5.sp,
                style = androidx.compose.ui.text.TextStyle(brush = Theme.aurora),
            )
            Text(heroTitle, color = Theme.ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, lineHeight = 25.sp)
            Text(model.resultNarrative, color = Theme.sub, fontSize = 12.5.sp, lineHeight = 17.5.sp)
        }
    }
}

@Composable
private fun ResultBars(model: AssessmentModel, isHolland: Boolean, barsAppeared: Boolean) {
    val cfg = model.config
    val shape = RoundedCornerShape(18.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Theme.card)
            .border(1.dp, Theme.line, shape)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        cfg.dims.forEach { dim ->
            val score = model.result?.scores?.get(dim.key) ?: 0
            val ratio = if (isHolland) score.toFloat() / AssessmentData.hollandMax else score / 100f
            val animated by animateFloatAsState(if (barsAppeared) ratio.coerceIn(0f, 1f) else 0f, tween(800), label = "bar")
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                Text(
                    if (isHolland) dim.key else dim.name.take(2),
                    color = Theme.sub, fontSize = 11.5.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.width(if (isHolland) 16.dp else 30.dp),
                )
                Box(Modifier.weight(1f).height(7.dp).clip(CircleShape).background(Theme.raised)) {
                    Box(Modifier.fillMaxHeight().fillMaxWidth(animated).clip(CircleShape).background(hexColor(dim.color)))
                }
                Text(
                    if (isHolland) "$score/${AssessmentData.hollandMax}" else "$score",
                    color = Theme.faint, fontSize = 10.5.sp, textAlign = TextAlign.End, modifier = Modifier.width(38.dp),
                )
            }
        }
    }
}

@Composable
private fun FacetSummary(model: AssessmentModel, barsAppeared: Boolean) {
    val cfg = model.config
    val shape = RoundedCornerShape(18.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Theme.card)
            .border(1.dp, Theme.line, shape)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("更突出的细分面向", color = Theme.ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        Text("完整版同时计算30个细分面向。这里先展示当前得分较高的6项。", color = Theme.faint, fontSize = 11.sp, lineHeight = 14.sp)
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            model.topFacets.forEach { (facet, score) ->
                val animated by animateFloatAsState(if (barsAppeared) (score / 100f).coerceIn(0f, 1f) else 0f, tween(800), label = "facet")
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(facet.name, color = Theme.ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(66.dp))
                    Text("${cfg.dim(facet.d).name} · $score", color = Theme.faint, fontSize = 10.5.sp, modifier = Modifier.width(70.dp))
                    Box(Modifier.weight(1f).height(5.dp).clip(CircleShape).background(Theme.raised)) {
                        Box(Modifier.fillMaxHeight().fillMaxWidth(animated).clip(CircleShape).background(Theme.aurora))
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun InsightCard(model: AssessmentModel, isHolland: Boolean) {
    val cfg = model.config
    val res = model.result
    val insightDesc = when {
        res == null -> ""
        isHolland -> {
            val top = res.selected ?: res.ordered.take(3)
            if (top.size >= 2) cfg.dim(top[0]).desc + cfg.dim(top[1]).desc else ""
        }
        else -> res.ordered.take(2).joinToString("；") { cfg.dim(it).desc } + "。这些信号可以被后续经历、日记和你的主动修改继续校正。"
    }
    val shape = RoundedCornerShape(18.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Theme.card)
            .border(1.dp, Theme.line, shape)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("PROFILE SIGNAL · 可写入画像", color = hexColor(0x9DBCFF), fontSize = 9.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.sp)
        Text(model.resultTags.joinToString(" · "), color = Theme.ink, fontSize = 15.5.sp, fontWeight = FontWeight.Bold)
        Text(insightDesc, color = Theme.sub, fontSize = 12.sp, lineHeight = 17.sp)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            model.resultTags.forEach { tag ->
                Box(
                    Modifier
                        .clip(CircleShape)
                        .background(hexColor(0x5E96FF, 0.13f))
                        .border(1.dp, hexColor(0x5E96FF, 0.3f), CircleShape)
                        .padding(horizontal = 11.dp, vertical = 5.dp),
                ) {
                    Text(tag, color = hexColor(0x9DBCFF), fontSize = 11.5.sp)
                }
            }
        }
    }
}

private fun methodNote(kind: AssessmentKind): String = when (kind) {
    AssessmentKind.HOLLAND -> "兴趣不等于能力、人格或资格。本结果来自O*NET Mini Interest Profiler的中文验证中版本，用于扩展探索，不替你决定职业。"
    AssessmentKind.BIGFIVE -> "人格分数描述的是连续倾向，不是固定类型，也不用于临床诊断、招聘筛选或替你做重要决定。"
    else -> "本测试为产品 Demo 构念改写版，不等同于对应量表的官方中文版，也不用于临床诊断、招聘筛选或替你做重要决定。"
}
