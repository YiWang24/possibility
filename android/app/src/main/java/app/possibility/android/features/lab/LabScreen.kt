package app.possibility.android.features.lab

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import app.possibility.android.core.AppRouter
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.model.SimulationHorizon
import app.possibility.android.core.theme.Theme
import app.possibility.android.core.theme.kaleidoCard
import app.possibility.android.core.theme.parseCssColor
import kotlinx.coroutines.launch

// 人生实验室 Tab 根页面（原型 scr-lab）—— 对应 ios/Possibility/Features/Lab/LabView.swift。
// 问题卡 + 时间旋钮（14 档 SimulationHorizon）+ 选择卡 + 携带卡多选 + 「开始推演」→ ResultSheet。

@Composable
fun LabScreen() {
    val context = LocalContext.current
    val model = remember { LabModel(context.applicationContext) }
    val scope = rememberCoroutineScope()
    var showCustomEditor by remember { mutableStateOf(false) }

    // 消费对话「去人生实验室」带来的问题；问题变化即请求真实 API 生成选择卡。
    val pending by AppRouter.pendingLabQuestion.collectAsState()
    LaunchedEffect(pending) {
        AppRouter.consumeLabQuestion()?.let { model.question = it }
    }
    LaunchedEffect(model.question) { model.loadChoices() }
    LaunchedEffect(model.errorMessage) {
        model.errorMessage?.let { ToastCenter.show(it) }
    }

    Box(Modifier.fillMaxSize().background(Theme.stage)) {
        Column(
            Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp)
                .padding(top = 20.dp, bottom = 44.dp),
        ) {
            PageHeader("LIFE LAB", "人生实验室")

            QuestionCard(model, Modifier.padding(top = 18.dp))

            DialView(model.horizon, Modifier.padding(top = 30.dp)) { model.horizon = it }

            Presets(model, Modifier.padding(top = 18.dp))

            Text(
                "拖动旋钮，从 7 天到 10 年任意停留",
                color = Theme.faint,
                fontSize = 11.sp,
                letterSpacing = 1.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            )

            ChoicesSection(
                model = model,
                showCustomEditor = showCustomEditor,
                onToggleEditor = { showCustomEditor = it },
                onRegenerate = { scope.launch { model.loadChoices() } },
                modifier = Modifier.padding(top = 24.dp),
            )

            CarrySection(model, Modifier.padding(top = 24.dp))

            LabPrimaryButton(
                title = "开始推演",
                enabled = model.canSim,
                modifier = Modifier.padding(top = 26.dp),
            ) { scope.launch { model.runSim() } }

            Disclaimer(Modifier.padding(top = 14.dp))
        }

        if (model.loading) {
            SimLoadingOverlay(name = model.pick.orEmpty(), step = model.loadStep)
        }
    }

    model.result?.let { res ->
        val ctx = model.resultContext
        ResultSheet(
            result = res,
            onDismiss = { model.result = null },
            question = ctx.question,
            choice = ctx.choice,
            horizon = ctx.horizon,
            carry = ctx.carry,
        )
    }
}

// MARK: 问题卡

@Composable
private fun QuestionCard(model: LabModel, modifier: Modifier = Modifier) {
    Column(
        modifier
            .fillMaxWidth()
            .kaleidoCard()
            .padding(horizontal = 20.dp, vertical = 18.dp),
    ) {
        Text("当前探索问题", color = Theme.faint, fontSize = 11.sp, letterSpacing = 2.5.sp)
        if (model.editing) {
            Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(labColor(0x060810).copy(alpha = 0.5f))
                        .border(1.dp, Theme.blue.copy(alpha = 0.4f), RoundedCornerShape(14.dp))
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                ) {
                    BasicTextField(
                        value = model.draft,
                        onValueChange = { model.draft = it },
                        textStyle = TextStyle(color = Theme.ink, fontSize = 14.sp, lineHeight = 20.sp),
                        cursorBrush = SolidColor(Theme.blue),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "取消",
                        color = Theme.faint,
                        fontSize = 12.5.sp,
                        modifier = Modifier.clickableNoRipple { model.editing = false },
                    )
                    Spacer(Modifier.width(16.dp))
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(Theme.buttonGradient)
                            .clickableNoRipple { model.saveEdit() }
                            .padding(horizontal = 20.dp, vertical = 8.dp),
                    ) {
                        Text("确定", color = Color.White, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        } else {
            Text(
                model.question,
                color = Theme.ink,
                fontSize = 16.5.sp,
                fontWeight = FontWeight.Bold,
                lineHeight = 24.sp,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
            Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.End) {
                Text(
                    "更换问题 ›",
                    color = Theme.blue,
                    fontSize = 12.sp,
                    modifier = Modifier.clickableNoRipple { model.beginEdit() },
                )
            }
        }
    }
}

// MARK: 时间旋钮（14 档 SimulationHorizon）

@Composable
private fun DialView(horizon: SimulationHorizon, modifier: Modifier = Modifier, onChange: (SimulationHorizon) -> Unit) {
    val entries = SimulationHorizon.entries
    val index = entries.indexOf(horizon)
    val current by rememberUpdatedState(horizon)

    Box(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .size(212.dp)
                .clip(CircleShape)
                .background(Brush.radialGradient(listOf(labColor(0x141A2A), Theme.stage)))
                .border(1.dp, Theme.line, CircleShape)
                // 水平拖拽旋钮，逐档切换 7天→10年
                .pointerInput(Unit) {
                    var acc = 0f
                    detectHorizontalDragGestures(onDragEnd = { acc = 0f }) { _, dx ->
                        acc += dx
                        val step = 22f
                        if (acc >= step) {
                            acc -= step
                            val i = entries.indexOf(current)
                            if (i < entries.size - 1) onChange(entries[i + 1])
                        } else if (acc <= -step) {
                            acc += step
                            val i = entries.indexOf(current)
                            if (i > 0) onChange(entries[i - 1])
                        }
                    }
                },
            contentAlignment = Alignment.Center,
        ) {
            // 进度弧：当前档位在 14 档中的位置
            val fraction = if (entries.size > 1) index.toFloat() / (entries.size - 1) else 0f
            Box(
                Modifier.fillMaxSize().drawBehind {
                    val stroke = 6.dp.toPx()
                    val inset = stroke / 2 + 10.dp.toPx()
                    val topLeft = Offset(inset, inset)
                    val arcSize = Size(size.width - inset * 2, size.height - inset * 2)
                    drawArc(
                        color = Theme.line,
                        startAngle = 135f,
                        sweepAngle = 270f,
                        useCenter = false,
                        topLeft = topLeft,
                        size = arcSize,
                        style = Stroke(width = stroke),
                    )
                    drawArc(
                        brush = Theme.aurora,
                        startAngle = 135f,
                        sweepAngle = 270f * fraction,
                        useCenter = false,
                        topLeft = topLeft,
                        size = arcSize,
                        style = Stroke(width = stroke),
                    )
                },
            )
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("时间旋钮", color = Theme.faint, fontSize = 10.sp, letterSpacing = 2.sp)
                Text(
                    horizon.dialLabel,
                    color = Theme.ink,
                    fontSize = 46.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(vertical = 2.dp),
                )
                Text("推演 ${horizon.label}后", color = Theme.sub, fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun Presets(model: LabModel, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        SimulationHorizon.entries.forEach { horizon ->
            val on = model.horizon == horizon
            Box(
                Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .then(if (on) Modifier.background(Theme.buttonGradient) else Modifier.background(Theme.raised))
                    .border(1.dp, if (on) Theme.blue.copy(alpha = 0.6f) else Theme.line, RoundedCornerShape(999.dp))
                    .clickableNoRipple { model.horizon = horizon }
                    .padding(horizontal = 14.dp, vertical = 8.dp),
            ) {
                Text(
                    horizon.label,
                    color = if (on) Color.White else Theme.sub,
                    fontSize = 12.sp,
                    fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal,
                )
            }
        }
    }
}

// MARK: 选择卡

@Composable
private fun ChoicesSection(
    model: LabModel,
    showCustomEditor: Boolean,
    onToggleEditor: (Boolean) -> Unit,
    onRegenerate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        LabSectionHeader("我的选择卡", "点选一张作为推演的选择")

        // 手势提示（原型 .choice-gesture-hint）
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(
                Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(Theme.violetSoft.copy(alpha = 0.1f))
                    .border(1.dp, Theme.violetSoft.copy(alpha = 0.17f), RoundedCornerShape(999.dp))
                    .padding(horizontal = 7.dp, vertical = 3.dp),
            ) {
                Text("手势", color = labColor(0xD9D0F5), fontSize = 9.sp)
            }
            Text("单击选中", color = labColor(0xB6BED0), fontSize = 9.5.sp)
            Text("·", color = labColor(0x5D6578), fontSize = 9.5.sp)
            Text("长按自定义卡可删除", color = labColor(0x5D6578), fontSize = 9.5.sp)
        }

        if (model.choicesLoading) {
            Row(
                Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(Theme.blue.copy(alpha = 0.08f))
                    .border(1.dp, Theme.blue.copy(alpha = 0.22f), RoundedCornerShape(999.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                CircularProgressIndicator(color = Theme.blue, strokeWidth = 2.dp, modifier = Modifier.size(14.dp))
                Text("正在根据当前问题生成专属选择卡……", color = Theme.sub, fontSize = 10.sp)
            }
        } else if (model.remoteChoices.isEmpty()) {
            Text(
                "重新生成选择卡",
                color = Theme.blue,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickableNoRipple(onRegenerate),
            )
        }

        if (showCustomEditor) {
            CustomEditor(
                onCancel = { onToggleEditor(false) },
                onAdd = { name, desc ->
                    val choice = model.addCustomChoice(name, desc)
                    if (choice != null) {
                        onToggleEditor(false)
                        ToastCenter.show("已选中「${choice.name}」")
                    } else {
                        ToastCenter.show("名称和描述都要填，且不能重名")
                    }
                },
            )
        }

        // 卡堆：真实/自定义选择卡 + 末尾「自定义选择」创建卡
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(top = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            model.choices.forEachIndexed { index, choice ->
                ChoiceCard(
                    choice = choice,
                    isOn = model.pick == choice.name,
                    index = index,
                    onClick = {
                        onToggleEditor(false)
                        model.pickChoice(choice.name)
                    },
                    onLongClick = {
                        if (choice.isCustom) {
                            model.removeCustomChoice(choice.name)
                            ToastCenter.show("已删除「${choice.name}」")
                        }
                    },
                )
            }
            CreateCard(isOn = showCustomEditor) {
                model.clearChoice()
                onToggleEditor(true)
            }
        }
    }
}

@Composable
private fun ChoiceCard(
    choice: LabModel.Choice,
    isOn: Boolean,
    index: Int,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
) {
    // LLM 卡自带 CSS 颜色只作色相提示，吸附到品牌色板后再上卡面；自定义卡用洋红。
    val accent = if (choice.isCustom) Theme.magenta else Theme.cardAccent(parseCssColor(choice.color), index)
    Box(
        Modifier
            .size(width = 116.dp, height = 148.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(labColor(0x151922))
            .then(
                if (isOn) {
                    Modifier.background(
                        Brush.linearGradient(listOf(Theme.blue.copy(alpha = 0.26f), Theme.violetSoft.copy(alpha = 0.13f))),
                    )
                } else {
                    Modifier
                },
            )
            .then(
                if (isOn) {
                    Modifier.border(1.5.dp, Theme.blue.copy(alpha = 0.72f), RoundedCornerShape(18.dp))
                } else {
                    Modifier.dashedBorder(Color.White.copy(alpha = 0.2f), 18.dp)
                },
            )
            .longPressClickable(onClick = onClick, onLongClick = onLongClick)
            .padding(horizontal = 13.dp, vertical = 17.dp),
    ) {
        Column {
            CardIconChip(choice.icon, accent, emphasized = isOn)
            Text(
                choice.name,
                color = Theme.ink,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                lineHeight = 17.sp,
                modifier = Modifier.padding(top = 10.dp),
            )
            Text(
                choice.desc,
                color = Theme.sub,
                fontSize = 10.5.sp,
                lineHeight = 14.sp,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
        if (isOn) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(Theme.buttonGradient),
                contentAlignment = Alignment.Center,
            ) {
                Text("✓", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun CreateCard(isOn: Boolean, onClick: () -> Unit) {
    val accent = Theme.magenta
    Box(
        Modifier
            .size(width = 116.dp, height = 148.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(labColor(0x131720))
            .then(
                if (isOn) {
                    Modifier
                        .background(Brush.linearGradient(listOf(accent.copy(alpha = 0.24f), Theme.violetSoft.copy(alpha = 0.14f))))
                        .border(1.5.dp, labColor(0xE784D3), RoundedCornerShape(18.dp))
                } else {
                    Modifier.dashedBorder(Color.White.copy(alpha = 0.13f), 18.dp)
                },
            )
            .clickableNoRipple(onClick)
            .padding(horizontal = 13.dp, vertical = 17.dp),
    ) {
        Column {
            CardIconChip(CardIcon.CUSTOM, accent, emphasized = isOn)
            Text(
                "自定义选择",
                color = labColor(0xE3D9F4),
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 10.dp),
            )
            Text(
                "写下真正在考虑的那条路",
                color = labColor(0x777F93),
                fontSize = 10.5.sp,
                lineHeight = 14.sp,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
        if (isOn) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(Theme.magenta, Theme.violetSoft))),
                contentAlignment = Alignment.Center,
            ) {
                Text("✓", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun CustomEditor(onCancel: () -> Unit, onAdd: (String, String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(17.dp))
            .background(
                Brush.linearGradient(listOf(Theme.blue.copy(alpha = 0.08f), Theme.magenta.copy(alpha = 0.055f))),
            )
            .border(1.dp, labColor(0x8FA1FF).copy(alpha = 0.19f), RoundedCornerShape(17.dp))
            .padding(13.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("写一张自己的选择卡", color = Theme.ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            Text("名称 ≤18 字 · 描述 ≤42 字", color = Theme.faint, fontSize = 9.sp)
        }
        EditorField(value = name, placeholder = "选择名称，例如：去大厂做 AI") { name = it }
        EditorField(value = desc, placeholder = "一句话描述这条路") { desc = it }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
            Text("取消", color = Theme.faint, fontSize = 11.5.sp, modifier = Modifier.clickableNoRipple(onCancel))
            Spacer(Modifier.width(14.dp))
            Box(
                Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(Theme.buttonGradient)
                    .clickableNoRipple { onAdd(name, desc) }
                    .padding(horizontal = 16.dp, vertical = 7.dp),
            ) {
                Text("加入牌堆", color = Color.White, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun EditorField(value: String, placeholder: String, onValueChange: (String) -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(11.dp))
            .background(labColor(0x060810).copy(alpha = 0.54f))
            .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(11.dp))
            .padding(horizontal = 11.dp, vertical = 9.dp),
    ) {
        if (value.isEmpty()) {
            Text(placeholder, color = Theme.faint, fontSize = 11.5.sp)
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(color = Theme.ink, fontSize = 11.5.sp),
            cursorBrush = SolidColor(Theme.blue),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

// MARK: 携带卡（原型 carry-section）

@Composable
private fun CarrySection(model: LabModel, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("什么要一起带走？", color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Row {
                Text("${model.carry.size}", color = Theme.blue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text("/3", color = Theme.faint, fontSize = 12.sp)
            }
        }
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            LabModel.carryCards.forEach { card ->
                CarryCard(card, on = model.carry.contains(card.id)) {
                    model.toggleCarry(card.id)?.let { ToastCenter.show(it) }
                }
            }
        }
    }
}

@Composable
private fun CarryCard(card: LabModel.CarryCard, on: Boolean, onClick: () -> Unit) {
    Column(
        Modifier
            .width(132.dp)
            .clip(RoundedCornerShape(14.dp))
            .then(if (on) Modifier.background(Theme.blue.copy(alpha = 0.1f)) else Modifier.background(Theme.card))
            .border(
                width = if (on) 1.4.dp else 1.dp,
                color = if (on) Theme.blue.copy(alpha = 0.65f) else Theme.line,
                shape = RoundedCornerShape(14.dp),
            )
            .clickableNoRipple(onClick)
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        CardIconMark(card.icon, tint = if (on) Theme.blue else Theme.sub)
        Text(card.name, color = Theme.ink, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
        Text(card.source, color = Theme.faint, fontSize = 9.5.sp)
    }
}

@Composable
private fun Disclaimer(modifier: Modifier = Modifier) {
    Text(
        "推演基于你的动态画像与 1,842 位相似旅人的真实经历\n它不是预言，是一面镜子",
        color = Theme.faint,
        fontSize = 11.sp,
        lineHeight = 18.sp,
        textAlign = TextAlign.Center,
        modifier = modifier.fillMaxWidth(),
    )
}

// MARK: 推演加载浮层（原型 .simload）

@Composable
private fun SimLoadingOverlay(name: String, step: Int) {
    Box(
        Modifier
            .fillMaxSize()
            .background(labColor(0x08090F).copy(alpha = 0.94f)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(22.dp)) {
            Orb(size = 110.dp)
            Text("正在推演 $name", color = Theme.ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text(
                LabModel.loadSteps[step.coerceIn(0, LabModel.loadSteps.size - 1)],
                color = Theme.sub,
                fontSize = 12.5.sp,
            )
        }
    }
}

@Composable
private fun Orb(size: Dp) {
    val transition = rememberInfiniteTransition(label = "orb")
    val angle by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(6000, easing = LinearEasing)),
        label = "orbAngle",
    )
    Box(Modifier.size(size), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .fillMaxSize()
                .rotate(angle)
                .clip(CircleShape)
                .background(Brush.sweepGradient(Theme.orbConicColors)),
        )
        // 中心暗核，让极光收束成环状光晕
        Box(
            Modifier
                .size(size * 0.62f)
                .clip(CircleShape)
                .background(Brush.radialGradient(listOf(Theme.stage, Theme.stage.copy(alpha = 0f)))),
        )
    }
}

// MARK: - 复用组件（同包 ResultView 共享）

/** 页头（原型 PageHeader）：eyebrow + 大标题。 */
@Composable
internal fun PageHeader(eyebrow: String, title: String, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth()) {
        Text(eyebrow, color = Theme.blue, fontSize = 11.sp, letterSpacing = 3.sp, fontWeight = FontWeight.SemiBold)
        Text(title, color = Theme.ink, fontSize = 26.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
    }
}

/** 区块标题 + 右侧说明（原型 SectionHeader）。 */
@Composable
internal fun LabSectionHeader(title: String, trailing: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
        Text(trailing, color = Theme.faint, fontSize = 11.sp)
    }
}

/** 主按钮（原型 PrimaryButton）：整宽渐变胶囊，禁用态降透明度。 */
@Composable
internal fun LabPrimaryButton(title: String, enabled: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Theme.buttonGradient)
            .then(if (enabled) Modifier.clickableNoRipple(onClick) else Modifier)
            .padding(vertical = 16.dp)
            .then(if (enabled) Modifier else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            title,
            color = if (enabled) Color.White else Color.White.copy(alpha = 0.5f),
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

/** 卡面图标徽章（原型 CardIconChip）：圆角方 + 12%/24% 点缀色，选中态加重。 */
@Composable
internal fun CardIconChip(icon: CardIcon, accent: Color, emphasized: Boolean = false, size: Dp = 27.dp) {
    Box(
        Modifier
            .size(size)
            .clip(RoundedCornerShape(size / 3))
            .background(accent.copy(alpha = if (emphasized) 0.2f else 0.12f))
            .border(1.dp, accent.copy(alpha = if (emphasized) 0.5f else 0.24f), RoundedCornerShape(size / 3)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon.vector, contentDescription = null, tint = accent, modifier = Modifier.size(size * 0.56f))
    }
}

/** 无底衬的行内图标（原型 CardIconMark）：用在底线卡 / 正文行内。 */
@Composable
internal fun CardIconMark(icon: CardIcon, tint: Color, size: Dp = 14.dp) {
    Icon(icon.vector, contentDescription = null, tint = tint, modifier = Modifier.size(size))
}

// MARK: - 修饰器工具

/** 无水波点击（对齐 iOS plain button 风格）。 */
internal fun Modifier.clickableNoRipple(onClick: () -> Unit): Modifier = this.then(
    Modifier.clickable(interactionSource = MutableInteractionSource(), indication = null, onClick = onClick),
)

/** 点击 + 长按（选中卡片 / 长按删除自定义卡）。 */
private fun Modifier.longPressClickable(onClick: () -> Unit, onLongClick: () -> Unit): Modifier =
    this.pointerInput(Unit) {
        detectTapGestures(onTap = { onClick() }, onLongPress = { onLongClick() })
    }

/** 虚线边框（原型 dashed stroke）。 */
internal fun Modifier.dashedBorder(color: Color, radius: Dp, width: Dp = 1.5.dp): Modifier = this.drawBehind {
    drawRoundRect(
        color = color,
        cornerRadius = CornerRadius(radius.toPx(), radius.toPx()),
        style = Stroke(
            width = width.toPx(),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(14f, 10f)),
        ),
    )
}

/** 品牌纯色（0xRRGGBB → 不透明 Color）。 */
internal fun labColor(rgb: Long): Color = Color(0xFF000000L or rgb)
