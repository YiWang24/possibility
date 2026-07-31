package app.possibility.android.features.home

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.rememberInfiniteTransition
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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.model.DiaryAnalysis
import app.possibility.android.core.model.ExploreTopic
import app.possibility.android.core.theme.Theme
import app.possibility.android.core.theme.kaleidoCard

// MARK: - 首页卡片群 —— 对应 ios/Possibility/Features/Home/HomeCards.swift + HomeView.swift 内联卡片
//
// DiaryCard 语音日记卡 / HomeAskCard AI 发问卡 / PortraitCard 动态画像卡 / LifeEntryButton 人生卡牌入口。
// 文案与配色逐字复刻 iOS，深色使用 Theme 令牌，iOS Color(hex:) 用 hx() 迁移。

/** iOS `Color(hex: 0xRRGGBB, alpha:)` 迁移。 */
internal fun hx(rgb: Long, alpha: Float = 1f): Color = Color(0xFF000000L or rgb).copy(alpha = alpha)

/** 无涟漪点击（近似 iOS PressScaleStyle 的可点击语义）。 */
@Composable
internal fun Modifier.tapCard(onClick: () -> Unit): Modifier =
    this.clickable(
        interactionSource = remember { MutableInteractionSource() },
        indication = null,
        onClick = onClick,
    )

// MARK: - 语音日记卡（原型 scr-home 语音日记区）

@Composable
fun DiaryCard(model: HomeModel, onOpenDiary: (String?) -> Unit) {
    // 转写全文是否展开（默认折叠）/ 是否处于「自己输入」编辑态
    var transcriptExpanded by remember { mutableStateOf(false) }
    var editingTranscript by remember { mutableStateOf(false) }

    // 重新录音时复位转写块的展开 / 编辑态
    val recording = model.isRecording
    remember(recording) {
        if (recording) {
            transcriptExpanded = false
            editingTranscript = false
        }
        recording
    }

    Column(
        Modifier
            .fillMaxWidth()
            .kaleidoCard()
            .padding(horizontal = 20.dp, vertical = 17.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Row(
                Modifier.tapCard { onOpenDiary(null) },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                Text("我的语音日记", color = Theme.ink, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold)
                Box(
                    Modifier
                        .size(18.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.06f))
                        .border(1.dp, Color.White.copy(alpha = 0.18f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("›", color = Color.White.copy(alpha = 0.8f), fontSize = 14.sp)
                }
            }
            Spacer(Modifier.weight(1f))
            Box(
                Modifier
                    .clip(CircleShape)
                    .background(hx(0x5E96FF, 0.12f))
                    .then(
                        if (model.analyzing) Modifier
                        else Modifier.tapCard {
                            if (model.isRecording) model.startAnalyzeDiary() else model.toggleRecording()
                        },
                    )
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            ) {
                Text(
                    if (model.isRecording) "■ 停止记录" else "◉ 记录今日",
                    color = Theme.blue,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        }

        WeekRow(model, onOpenDiary)

        if (model.isRecording) Recorder(model)
        if ((model.transcript.isNotEmpty() || editingTranscript) && !model.isRecording) {
            TranscriptBlock(
                model = model,
                expanded = transcriptExpanded,
                editing = editingTranscript,
                onToggleExpanded = { transcriptExpanded = !transcriptExpanded },
                onEdit = { transcriptExpanded = true; editingTranscript = true },
                onCancelEdit = { editingTranscript = false },
                onSubmitEdit = { editingTranscript = false; model.submitEditedTranscript() },
            )
        }
        if (model.analyzing) AnalyzingView(model)
        model.analysis?.let { AnalysisResult(it) { onOpenDiary(model.diaryTodayDate) } }
        model.analysisError?.let {
            AnalysisFailure(
                message = it,
                canRetry = model.canRetryAnalysis,
                onRetry = { model.startRetryAnalysis() },
                onManualEntry = {
                    transcriptExpanded = true
                    editingTranscript = true
                },
            )
        }
    }
}

@Composable
private fun WeekRow(model: HomeModel, onOpenDiary: (String?) -> Unit) {
    val today = remember { java.time.LocalDate.now() }
    val week = remember(today) { (-6..-1).map { today.plusDays(it.toLong()) } }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        week.forEach { date ->
            DayCell(
                emoji = model.diaryEmoji(date),
                label = weekdayLabel(date),
                filled = model.hasDiary(date),
                today = false,
                modifier = Modifier.tapCard { onOpenDiary(date.format(DAY_FORMATTER)) },
            )
            Spacer(Modifier.weight(1f))
        }
        DayCell(
            emoji = model.todayDisplayEmoji,
            label = "今天",
            filled = model.hasRecordedToday,
            today = true,
            modifier = Modifier.tapCard { onOpenDiary(model.diaryTodayDate) },
        )
    }
}

private val DAY_FORMATTER = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd")
private val WEEKDAY_LABELS = listOf("一", "二", "三", "四", "五", "六", "日")
private fun weekdayLabel(date: java.time.LocalDate): String = WEEKDAY_LABELS[date.dayOfWeek.value - 1]

@Composable
private fun DayCell(emoji: String, label: String, filled: Boolean, today: Boolean, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(
            Modifier
                .size(30.dp)
                .clip(CircleShape)
                .background(
                    if (filled) Brush.linearGradient(listOf(hx(0x3E77F2), hx(0xB03390)))
                    else SolidColor(Theme.raised),
                )
                .then(
                    if (today) Modifier.border(2.dp, hx(0x5E96FF, 0.55f), CircleShape)
                    else Modifier,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text(emoji, fontSize = 15.sp)
        }
        Text(label, color = if (today) Theme.blue else Theme.faint, fontSize = 10.sp)
    }
}

@Composable
private fun Recorder(model: HomeModel) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Brush.horizontalGradient(listOf(hx(0x5E96FF, 0.14f), hx(0xE35CC1, 0.10f))))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Waveform(Modifier.weight(1f))
        Text(model.elapsedText, color = Theme.lime, fontSize = 12.sp, modifier = Modifier.width(38.dp))
        Box(
            Modifier
                .clip(CircleShape)
                .background(Theme.buttonGradient)
                .tapCard { model.startAnalyzeDiary() }
                .padding(horizontal = 14.dp, vertical = 7.dp),
        ) {
            Text("完成", color = Color.White, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
        }
    }
}

/** 录音波形（对照 iOS WaveformView：一排随机相位跳动的竖条）。 */
@Composable
private fun Waveform(modifier: Modifier = Modifier) {
    val bars = 22
    val transition = rememberInfiniteTransition(label = "wave")
    val phases = (0 until bars).map { i ->
        transition.animateFloat(
            initialValue = 0.25f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 620 + (i % 5) * 90),
                repeatMode = RepeatMode.Reverse,
            ),
            label = "bar$i",
        )
    }
    Row(
        modifier.height(24.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        phases.forEach { p ->
            Box(
                Modifier
                    .weight(1f)
                    .height((6 + 18 * p.value).dp)
                    .clip(CircleShape)
                    .background(Theme.lime.copy(alpha = 0.85f)),
            )
        }
    }
}

@Composable
private fun TranscriptBlock(
    model: HomeModel,
    expanded: Boolean,
    editing: Boolean,
    onToggleExpanded: () -> Unit,
    onEdit: () -> Unit,
    onCancelEdit: () -> Unit,
    onSubmitEdit: () -> Unit,
) {
    val isLong = model.transcript.length > 48
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White.copy(alpha = 0.035f))
            .border(1.dp, Theme.line, RoundedCornerShape(14.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("语音转写", color = Theme.faint, fontSize = 11.sp)
            Spacer(Modifier.weight(1f))
            if (editing) {
                Text("取消", color = Theme.faint, fontSize = 11.sp, modifier = Modifier.tapCard(onCancelEdit))
                Spacer(Modifier.width(12.dp))
                val canReanalyze = !model.analyzing && model.transcript.trim().isNotEmpty()
                Text(
                    "重新分析",
                    color = if (canReanalyze) Theme.blue else Theme.faint,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = if (canReanalyze) Modifier.tapCard(onSubmitEdit) else Modifier,
                )
            } else {
                if (!model.analyzing) {
                    Text("编辑", color = Theme.blue, fontSize = 11.sp, modifier = Modifier.tapCard(onEdit))
                }
                if (isLong) {
                    Spacer(Modifier.width(12.dp))
                    Text(
                        if (expanded) "收起" else "展开全文",
                        color = Theme.blue,
                        fontSize = 11.sp,
                        modifier = Modifier.tapCard(onToggleExpanded),
                    )
                }
            }
        }

        if (editing) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 96.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.White.copy(alpha = 0.05f))
                    .border(1.dp, Theme.line, RoundedCornerShape(10.dp))
                    .padding(8.dp),
            ) {
                BasicTextField(
                    value = model.transcript,
                    onValueChange = { model.transcript = it },
                    textStyle = TextStyle(color = Theme.ink, fontSize = 12.5.sp, lineHeight = 18.sp),
                    cursorBrush = SolidColor(Theme.blue),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        } else {
            Text(
                model.transcript,
                color = hx(0xC8CEDA),
                fontSize = 12.5.sp,
                lineHeight = 20.sp,
                maxLines = if (expanded || !isLong) Int.MAX_VALUE else 3,
            )
        }
    }
}

@Composable
private fun AnalyzingView(model: HomeModel) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        CircularProgressIndicator(color = Theme.blue, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
        Text("正在转写并分析这次记录…", color = Theme.sub, fontSize = 11.5.sp)
        Spacer(Modifier.weight(1f))
        Text("取消", color = Theme.faint, fontSize = 11.5.sp, fontWeight = FontWeight.Medium, modifier = Modifier.tapCard { model.cancelAnalysis() })
    }
}

@Composable
private fun AnalysisFailure(
    message: String,
    canRetry: Boolean,
    onRetry: () -> Unit,
    onManualEntry: () -> Unit,
) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(message, color = Theme.sub, fontSize = 11.5.sp, modifier = Modifier.weight(1f))
        Text(
            if (canRetry) "重试" else "输入文字",
            color = Theme.blue,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.tapCard(if (canRetry) onRetry else onManualEntry),
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AnalysisResult(analysis: DiaryAnalysis, onOpenDetail: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(top = 3.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
        Text("这次记录里，我听见了", color = Theme.faint, fontSize = 11.sp)
        FlowChips(analysis.emotions, analysis.keywords)
        Text(
            "查看详情 ›",
            color = Theme.blue,
            fontSize = 11.sp,
            modifier = Modifier.fillMaxWidth().tapCard(onOpenDetail),
            textAlign = TextAlign.End,
        )
    }
}

/** 情绪（柠檬底黑字）/ 关键词（蓝底蓝字）流式标签。 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun FlowChips(emotions: List<String>, keywords: List<String>) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        emotions.forEach { t ->
            Box(
                Modifier.clip(CircleShape).background(Theme.lime).padding(horizontal = 11.dp, vertical = 4.dp),
            ) {
                Text(t, color = hx(0x0B0F18), fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        keywords.forEach { t ->
            Box(
                Modifier
                    .clip(CircleShape)
                    .background(hx(0x5E96FF, 0.13f))
                    .border(1.dp, hx(0x5E96FF, 0.3f), CircleShape)
                    .padding(horizontal = 11.dp, vertical = 4.dp),
            ) {
                Text(t, color = hx(0x9DBCFF), fontSize = 11.5.sp)
            }
        }
    }
}

// MARK: - AI 发问卡（原型 .ask）

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HomeAskCard(model: HomeModel, onSend: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(28.dp))
            .background(
                Brush.linearGradient(listOf(hx(0x141A34), hx(0x1A2350), hx(0x10132A))),
            )
            .border(1.dp, hx(0x7A9EFF, 0.3f), RoundedCornerShape(28.dp))
            .padding(horizontal = 22.dp)
            .padding(top = 24.dp, bottom = 22.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.width(18.dp).height(1.5.dp).background(hx(0x9DBCFF, 0.6f)))
            Text("今天想探索什么", color = hx(0x9DBCFF), fontSize = 11.sp, letterSpacing = 3.5.sp)
        }

        Text(
            buildAnnotatedString {
                append("说出那个\n")
                withStyle(SpanStyle(color = Theme.blue)) { append("在心里盘旋") }
                append("的问题")
            },
            color = Theme.ink,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            lineHeight = 30.sp,
            modifier = Modifier.padding(top = 12.dp),
        )

        AskBox(model, onSend, Modifier.padding(top = 16.dp))

        FlowRow(
            Modifier.padding(top = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            ExploreTopic.entries.forEach { t -> SoftChip(model, t) }
        }
    }
}

@Composable
private fun AskBox(model: HomeModel, onSend: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(hx(0x060810, 0.45f))
            .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(18.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            model.topic?.let { topic ->
                Box(
                    Modifier
                        .clip(CircleShape)
                        .background(hx(0x5E96FF, 0.16f))
                        .border(1.dp, hx(0x5E96FF, 0.4f), CircleShape)
                        .padding(horizontal = 11.dp, vertical = 4.dp),
                ) {
                    Text("✦ ${topic.label}", color = hx(0x9DBCFF), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            Box(Modifier.fillMaxWidth().padding(end = 26.dp)) {
                if (model.question.isEmpty()) {
                    Text("写下任何正在心里盘旋的问题…", color = Theme.faint, fontSize = 15.sp, lineHeight = 19.sp)
                }
                BasicTextField(
                    value = model.question,
                    onValueChange = { model.question = it },
                    textStyle = TextStyle(color = Theme.ink, fontSize = 15.sp, lineHeight = 19.sp),
                    cursorBrush = SolidColor(Theme.blue),
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Row(Modifier.fillMaxWidth().padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                Spacer(Modifier.weight(1f))
                Box(
                    Modifier
                        .clip(CircleShape)
                        .background(Theme.buttonGradient)
                        .then(if (model.canSend) Modifier.tapCard(onSend) else Modifier)
                        .padding(horizontal = 24.dp, vertical = 10.dp),
                ) {
                    Text(
                        "发送",
                        color = Color.White.copy(alpha = if (model.canSend) 1f else 0.4f),
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }

        // 清空按钮（原型 .ask-clear）：仅在有内容时显隐
        if (model.trimmedQuestion.isNotEmpty()) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.08f))
                    .tapCard { model.question = "" },
                contentAlignment = Alignment.Center,
            ) {
                Text("×", color = hx(0xAEB7CC), fontSize = 18.sp)
            }
        }
    }
}

@Composable
private fun SoftChip(model: HomeModel, t: ExploreTopic) {
    val on = model.topic == t
    Box(
        Modifier
            .clip(CircleShape)
            .background(if (on) hx(0x5E96FF, 0.14f) else Color.White.copy(alpha = 0.07f))
            .border(1.dp, if (on) hx(0x5E96FF, 0.5f) else Color.White.copy(alpha = 0.1f), CircleShape)
            .tapCard { model.selectTopic(t) }
            .padding(horizontal = 15.dp, vertical = 8.dp),
    ) {
        Text(t.label, color = if (on) hx(0x9DBCFF) else Theme.sub, fontSize = 12.5.sp)
    }
}

// MARK: - 人生卡牌入口（原型 .life-entry）

@Composable
fun LifeEntryButton(onTap: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Brush.linearGradient(listOf(hx(0x1A2350, 0.6f), hx(0x2B1B2D, 0.4f))))
            .border(1.dp, hx(0x8F7BFF, 0.3f), RoundedCornerShape(16.dp))
            .tapCard(onTap)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        MiniDeck()
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text("四套卡牌探索 · 3–8 分钟", color = hx(0x9DBCFF), fontSize = 10.sp, letterSpacing = 1.sp)
            Text("人生卡牌：你最后会留下什么？", color = Theme.ink, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
            Text("人生、婚姻、家庭、人际交往 · 选择一套开始", color = Theme.sub, fontSize = 11.sp)
        }
        Text("›", color = Theme.faint, fontSize = 15.sp)
    }
}

@Composable
private fun MiniDeck() {
    Box(Modifier.width(34.dp).height(30.dp), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .offset(x = (-3).dp)
                .size(width = 22.dp, height = 30.dp)
                .clip(RoundedCornerShape(5.dp))
                .background(Theme.hue(4).gradient),
        )
        Box(
            Modifier
                .offset(x = 3.dp)
                .size(width = 22.dp, height = 30.dp)
                .clip(RoundedCornerShape(5.dp))
                .background(Theme.hue(1).gradient),
        )
    }
}

// MARK: - 动态画像卡（原型 .portrait）

@Composable
fun PortraitCard(
    model: HomeModel,
    onTapDim: (HomeModel.PortraitDim) -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .kaleidoCard()
            .padding(horizontal = 20.dp)
            .padding(top = 22.dp, bottom = 18.dp),
    ) {
        // 数字形象舞台（画像驱动的抽象形态）
        PersonaCanvas(
            persona = model.remotePersona,
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp),
        )

        ProgressBar(model, Modifier.padding(top = 18.dp))

        Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            model.portraitDims.forEach { dim -> DimRow(dim) { onTapDim(dim) } }
        }
    }
}

@Composable
private fun ProgressBar(model: HomeModel, modifier: Modifier = Modifier) {
    Row(
        modifier.width(250.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier
                .weight(1f)
                .height(5.dp)
                .clip(CircleShape)
                .background(Theme.raised),
        ) {
            Box(
                Modifier
                    .fillMaxWidth(model.completionPct / 100f)
                    .height(5.dp)
                    .clip(CircleShape)
                    .background(Theme.aurora),
            )
        }
        Text(
            "${model.completedPortraitDimensionCount}/${model.portraitDimensionCount} · ${model.completionPct}%",
            color = Theme.sub,
            fontSize = 11.sp,
        )
    }
}

@Composable
private fun DimRow(dim: HomeModel.PortraitDim, onTap: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(if (dim.isTodo) hx(0x5E96FF, 0.06f) else Theme.raised)
            .border(1.dp, if (dim.isTodo) hx(0x5E96FF, 0.4f) else Theme.line, shape)
            .tapCard(onTap)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(hx(dim.iconTint, 0.15f)),
            contentAlignment = Alignment.Center,
        ) {
            Text(dim.icon, fontSize = 15.sp)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(dim.label, color = Theme.ink, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
            Text(
                dim.value ?: "尚未填写",
                color = if (dim.isTodo) Theme.blue else Theme.sub,
                fontSize = 11.5.sp,
            )
        }
        Text("›", color = Theme.faint, fontSize = 14.sp)
    }
}

// MARK: - 区块标题（原型 SectionHeader）

@Composable
internal fun HomeSectionHeader(title: String, trailing: String, onTrailing: () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.weight(1f))
        Text(trailing, color = Theme.blue, fontSize = 12.sp, modifier = Modifier.tapCard(onTrailing))
    }
}

/** 尼采引文块（原型 portrait 引文 · 左侧竖线）。 */
@Composable
internal fun NietzscheQuote() {
    Row(Modifier.fillMaxWidth()) {
        Box(Modifier.width(1.dp).height(96.dp).background(Theme.sub.copy(alpha = 0.34f)))
        Column(Modifier.padding(start = 14.dp, top = 4.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                "我们无可避免跟自己保持陌生，我们不明白自己，我们搞不清楚自己，我们的永恒判词是：“离每个人最远的，就是他自己。”——对于我们自己，我们不是“知者”……",
                color = Theme.sub,
                fontSize = 12.sp,
                fontFamily = FontFamily.Serif,
                lineHeight = 18.sp,
            )
            Text(
                "——尼采《道德的系谱》",
                color = Theme.faint,
                fontSize = 11.sp,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.End,
            )
        }
    }
}
