package app.possibility.android.features.diary

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.model.DiarySummaryResponse
import app.possibility.android.core.theme.Theme
import kotlinx.coroutines.launch

// 语音日记详情页（原型 diaryPage）—— 对应 ios/Possibility/Features/Diary。
//
// 全屏覆盖：顶栏 + 固定三 tab（每日记录 / 月度总结 / 年度总结）+ 滚动内容。

/** 十六进制颜色（带 alpha），对齐 iOS Color(hex:alpha:)。 */
private fun c(rgb: Long, alpha: Float = 1f): Color = Color(0xFF000000L or rgb).copy(alpha = alpha)

/**
 * 语音日记详情，全屏覆盖首页。
 * @param onDismiss 关闭本页（空态「记录今天」亦复用此回调，交由首页触发录音）。
 */
@Composable
fun DiaryDetailSheet(onDismiss: () -> Unit) {
    val model = remember { DiaryModel() }

    LaunchedEffect(Unit) {
        model.loadRemote()
        model.loadSummaries()
    }

    val scrollState = rememberScrollState()
    // 切视图 / 切日期回到顶部（对齐 iOS scrollTop）
    LaunchedEffect(model.view, model.selectedDate) {
        scrollState.animateScrollTo(0)
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Theme.paper),
    ) {
        Column(Modifier.fillMaxSize()) {
            TopBar(onBack = onDismiss)
            SegmentedTabs(
                selected = model.view,
                onSelect = { model.switchView(it) },
                modifier = Modifier
                    .padding(horizontal = 20.dp)
                    .padding(top = 10.dp, bottom = 4.dp),
            )
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(scrollState)
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 40.dp),
            ) {
                when (model.view) {
                    DiaryModel.ViewKind.DAY -> DiaryDayView(model = model, onStartRecording = onDismiss)
                    DiaryModel.ViewKind.MONTH -> DiarySummaryView(model = model, isMonth = true)
                    DiaryModel.ViewKind.YEAR -> DiarySummaryView(model = model, isMonth = false)
                }
            }
        }
    }
}

// MARK: - 顶栏

@Composable
private fun TopBar(onBack: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(Theme.paper.copy(alpha = 0.92f))
            .statusBarsPadding()
            .padding(horizontal = 22.dp)
            .padding(top = 12.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        Box(
            Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(Theme.card)
                .border(1.dp, Theme.line, CircleShape)
                .clickable { onBack() },
            contentAlignment = Alignment.Center,
        ) {
            Text("‹", color = Theme.ink, fontSize = 20.sp)
        }
        Column {
            Text("语音日记", color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
            Text("听见每天的自己，也看见长期变化", color = Theme.faint, fontSize = 11.sp)
        }
    }
}

// MARK: - 分段控件（三视图切换）

@Composable
private fun SegmentedTabs(
    selected: DiaryModel.ViewKind,
    onSelect: (DiaryModel.ViewKind) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White.copy(alpha = 0.045f))
            .border(1.dp, Theme.line, RoundedCornerShape(14.dp))
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        DiaryModel.ViewKind.entries.forEach { kind ->
            val on = selected == kind
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .then(
                        if (on) {
                            Modifier.background(
                                Brush.linearGradient(listOf(c(0x3E77F2, 0.82f), c(0x664CCE, 0.82f))),
                            )
                        } else Modifier,
                    )
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) { onSelect(kind) }
                    .padding(vertical = 9.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    kind.label,
                    color = if (on) Color.White else Theme.faint,
                    fontSize = 11.5.sp,
                )
            }
        }
    }
}

// MARK: - 共用小件

/** 视图头（原型 .diary-view-head）。 */
@Composable
private fun DiaryViewHead(
    eyebrow: String,
    title: String,
    subtitle: String,
    trailing: (@Composable () -> Unit)? = null,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(top = 16.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(eyebrow, color = c(0x99B8FF), fontSize = 9.sp, letterSpacing = 2.6.sp)
            Text(title, color = Theme.ink, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 5.dp))
            Text(subtitle, color = Theme.faint, fontSize = 10.5.sp, modifier = Modifier.padding(top = 4.dp))
        }
        trailing?.invoke()
    }
}

/** 卡片块头（原型 .diary-block-head）。 */
@Composable
private fun DiaryBlockHead(title: String, note: String) {
    Row(
        Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(title, color = Theme.ink, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
        Text(note, color = Theme.faint, fontSize = 9.5.sp)
    }
}

/** 关键词胶囊行（原型 .diary-keywords）。 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DiaryKeywordFlow(items: List<String>) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(7.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        items.forEach { kw ->
            Text(
                kw,
                color = c(0xBFD2FF),
                fontSize = 11.sp,
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(c(0x5E96FF, 0.1f))
                    .border(1.dp, c(0x5E96FF, 0.2f), RoundedCornerShape(999.dp))
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            )
        }
    }
}

// MARK: - 每日记录视图（原型 renderDiaryDay）

@Composable
private fun DiaryDayView(model: DiaryModel, onStartRecording: () -> Unit) {
    Column(Modifier.fillMaxWidth()) {
        DiaryViewHead(
            eyebrow = "ALL VOICE NOTES",
            title = "全部日记",
            subtitle = "${summaryTitle(true, null)} · 已记录 ${model.entries.size} 篇",
        )

        DateRail(model, Modifier.padding(top = 16.dp))

        when {
            model.diaryLoading -> SummaryUnavailable("日记", requestFailed = false)
            model.diaryLoadError -> SummaryUnavailable("日记", requestFailed = true)
            model.selectedEntry != null -> {
                val entry = model.selectedEntry!!
                DayHero(model, entry, Modifier.padding(top = 10.dp))
                KeywordBlock(entry, Modifier.padding(top = 14.dp))
                TranscriptBlock(entry, Modifier.padding(top = 14.dp))
            }
            else -> EmptyState(onStartRecording, Modifier.padding(top = 20.dp))
        }

        Archive(model, Modifier.padding(top = 18.dp))
    }
}

/** 日期滑动轨（.diary-date-rail）。 */
@Composable
private fun DateRail(model: DiaryModel, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        model.railDates.forEach { item ->
            DateChip(item, on = item.date == model.selectedDate, onClick = { model.select(item.date) })
        }
    }
}

@Composable
private fun DateChip(item: DiaryRailItem, on: Boolean, onClick: () -> Unit) {
    Column(
        Modifier
            .width(62.dp)
            .clip(RoundedCornerShape(17.dp))
            .then(
                if (on) {
                    Modifier.background(
                        Brush.linearGradient(listOf(c(0x3052A4, 0.75f), c(0x523787, 0.78f))),
                    )
                } else {
                    Modifier.background(Theme.card)
                },
            )
            .border(1.dp, if (on) c(0x9DBCFF, 0.55f) else Theme.line, RoundedCornerShape(17.dp))
            .clickable { onClick() }
            .padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(item.week, color = if (on) c(0xEEF3FF) else Theme.faint, fontSize = 9.5.sp)
        Text(item.emoji ?: "·", fontSize = 19.sp, modifier = Modifier.padding(vertical = 5.dp))
        Text("7/${item.day}", color = if (on) c(0xEEF3FF) else Theme.sub, fontSize = 10.sp)
    }
}

/** day hero（.diary-day-hero）。 */
@Composable
private fun DayHero(model: DiaryModel, entry: DiaryNote, modifier: Modifier = Modifier) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(23.dp))
            .background(Brush.linearGradient(listOf(c(0x171D31), c(0x11141F))))
            .border(1.dp, c(0x7D9EE8, 0.24f), RoundedCornerShape(23.dp))
            .padding(19.dp),
    ) {
        Text("${entry.label} · VOICE NOTE", color = c(0x9DBCFF), fontSize = 10.sp, letterSpacing = 1.4.sp)
        Text(
            entry.title,
            color = Theme.ink,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            lineHeight = 26.sp,
            modifier = Modifier.padding(top = 7.dp),
        )
        Row(
            Modifier.padding(top = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(entry.emoji, fontSize = 20.sp)
            Text(entry.emotion, color = Theme.sub, fontSize = 11.5.sp)
        }
        AudioBar(
            model = model,
            entry = entry,
            onToggle = {
                model.togglePlaying()
                ToastCenter.show(if (model.isPlaying) "正在播放这篇语音日记" else "语音已暂停")
            },
            modifier = Modifier.padding(top = 17.dp),
        )
    }
}

@Composable
private fun AudioBar(model: DiaryModel, entry: DiaryNote, onToggle: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(15.dp))
            .background(c(0x050812, 0.48f))
            .border(1.dp, Color.White.copy(alpha = 0.07f), RoundedCornerShape(15.dp))
            .padding(horizontal = 12.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(Theme.buttonGradient)
                .clickable { onToggle() },
            contentAlignment = Alignment.Center,
        ) {
            Text(if (model.isPlaying) "Ⅱ" else "▶", color = Color.White, fontSize = 11.sp)
        }
        StaticWave(seed = model.selectedIndex + 1, modifier = Modifier.weight(1f).height(28.dp))
        Text(entry.duration, color = Theme.faint, fontSize = 9.5.sp)
    }
}

/** 静态波形：高度公式对照原型 diaryWaveHTML。 */
@Composable
private fun StaticWave(seed: Int, modifier: Modifier = Modifier) {
    val brush = Brush.verticalGradient(listOf(c(0x7CABFF), c(0x8F7BFF)))
    Canvas(modifier) {
        val count = 24
        val gap = 2f
        val bw = ((size.width - gap * (count - 1)) / count).coerceAtLeast(1f)
        for (i in 0 until count) {
            val frac = (18 + ((i * 17 + seed * 11) % 72)) / 100f
            val h = size.height * frac
            drawRoundRect(
                brush = brush,
                topLeft = Offset(i * (bw + gap), (size.height - h) / 2f),
                size = Size(bw, h),
                cornerRadius = CornerRadius(2f, 2f),
                alpha = 0.66f,
            )
        }
    }
}

@Composable
private fun KeywordBlock(entry: DiaryNote, modifier: Modifier = Modifier) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Theme.card)
            .border(1.dp, Theme.line, RoundedCornerShape(20.dp))
            .padding(17.dp),
    ) {
        DiaryBlockHead("每日关键词", "由语音内容自动提取")
        Spacer(Modifier.height(12.dp))
        DiaryKeywordFlow(entry.keywords.map { "# $it" })
    }
}

@Composable
private fun TranscriptBlock(entry: DiaryNote, modifier: Modifier = Modifier) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Theme.card)
            .border(1.dp, Theme.line, RoundedCornerShape(20.dp))
            .padding(17.dp),
    ) {
        DiaryBlockHead("详细语音内容", "${entry.duration} · 已转写")
        entry.transcript.forEach { paragraph ->
            Text(
                paragraph,
                color = c(0xC8CEDA),
                fontSize = 12.5.sp,
                lineHeight = 21.5.sp,
                modifier = Modifier.padding(top = 11.dp),
            )
        }
    }
}

/** 空态（.diary-empty）。 */
@Composable
private fun EmptyState(onStartRecording: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(23.dp))
            .background(Theme.card)
            .border(1.dp, c(0x6FA5FF, 0.28f), RoundedCornerShape(23.dp))
            .padding(horizontal = 22.dp, vertical = 38.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("◌", color = Theme.sub, fontSize = 32.sp)
        Text("今天还没有留下声音", color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
        Text(
            "不需要组织好语言，从此刻最真实的感受开始就好。",
            color = Theme.sub,
            fontSize = 11.5.sp,
            lineHeight = 16.5.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 7.dp),
        )
        Box(
            Modifier
                .padding(top = 18.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(Theme.buttonGradient)
                .clickable { onStartRecording() }
                .padding(horizontal = 20.dp, vertical = 11.dp),
        ) {
            Text("记录今天", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

/** 归档（.diary-archive）。 */
@Composable
private fun Archive(model: DiaryModel, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("全部日期记录", color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Text("${model.entries.size} 篇 · 按时间倒序", color = Theme.faint, fontSize = 9.5.sp)
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            model.entries.sortedByDescending { it.date }.forEach { entry ->
                ArchiveItem(entry, on = model.isSelected(entry), onClick = { model.selectEntry(entry) })
            }
        }
    }
}

@Composable
private fun ArchiveItem(entry: DiaryNote, on: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(17.dp))
            .background(if (on) c(0x5E96FF, 0.08f) else Theme.card)
            .border(1.dp, if (on) c(0x6FA5FF, 0.32f) else Theme.line, RoundedCornerShape(17.dp))
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Column(Modifier.width(42.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("${entry.dayNumber}", color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Text("${entry.monthNumber}月", color = Theme.faint, fontSize = 8.5.sp, modifier = Modifier.padding(top = 2.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(entry.title, color = Theme.ink, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            Text(
                "${entry.emoji} ${entry.keywords.joinToString(" · ") { "#$it" }}",
                color = Theme.faint,
                fontSize = 9.5.sp,
                maxLines = 1,
            )
        }
        Text("›", color = c(0x70809E), fontSize = 16.sp)
    }
}

// MARK: - 月度 / 年度总结视图（原型 renderDiarySummary）

@Composable
private fun DiarySummaryView(model: DiaryModel, isMonth: Boolean) {
    val scope = rememberCoroutineScope()
    val remote: DiarySummaryResponse? = if (isMonth) model.monthSummary else model.yearSummary

    val titleText = summaryTitle(isMonth, remote)
    val subtitleText = when {
        remote != null -> "${remote.entryCount}篇日记已纳入总结"
        model.refreshing -> "正在读取你的真实日记"
        else -> "尚无可展示的总结"
    }

    Column(Modifier.fillMaxWidth()) {
        DiaryViewHead(
            eyebrow = if (isMonth) "MONTHLY REVIEW" else "YEARLY REVIEW",
            title = titleText,
            subtitle = subtitleText,
            trailing = {
                RefreshButton(
                    refreshing = model.refreshing,
                    onClick = {
                        scope.launch {
                            val ok = model.refreshSummary(isMonth)
                            ToastCenter.show(
                                if (ok) {
                                    if (isMonth) "月度总结已根据最新日记更新" else "年度总结已根据最新日记更新"
                                } else "暂时无法更新总结，展示最近内容",
                            )
                        }
                    },
                )
            },
        )

        if (isMonth) {
            model.monthSummary?.let { RemoteMonthContent(it, titleText) }
                ?: SummaryUnavailable(period = "本月", requestFailed = model.monthSummaryError)
        } else {
            model.yearSummary?.let { RemoteYearContent(it) }
                ?: SummaryUnavailable(period = "本年度", requestFailed = model.yearSummaryError)
        }
    }
}

/** "2026-07" → "2026年7月"；年 → "2026年度"。 */
private fun summaryTitle(isMonth: Boolean, remote: DiarySummaryResponse?): String {
    if (isMonth) {
        val ref = remote?.ref ?: DiaryModel.currentMonthRef
        val parts = ref.split("-")
        if (parts.size == 2) {
            val month = parts[1].toIntOrNull()
            if (month != null) return "${parts[0]}年${month}月"
        }
        return DiaryModel.currentMonthRef.replace(Regex("^(\\d{4})-(\\d{2})$")) {
            "${it.groupValues[1]}年${it.groupValues[2].toInt()}月"
        }
    }
    return "${remote?.ref ?: DiaryModel.currentYearRef}年度"
}

@Composable
private fun RefreshButton(refreshing: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(c(0x5E96FF, 0.1f))
            .border(1.dp, c(0x5E96FF, 0.2f), RoundedCornerShape(999.dp))
            .clickable(enabled = !refreshing) { onClick() }
            .padding(horizontal = 11.dp, vertical = 8.dp),
    ) {
        Text(
            if (refreshing) "总结中…" else "更新总结",
            color = c(0xBBD0FF, if (refreshing) 0.55f else 1f),
            fontSize = 10.5.sp,
        )
    }
}

// MARK: 月度内容

@Composable
private fun RemoteMonthContent(s: DiarySummaryResponse, titleText: String) {
    Column(
        Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        SummaryHero(
            cap = "MONTH IN VOICE · $titleText",
            headline = "这个月的声音\n汇成了一段属于你的洞察",
            body = s.insight,
            stats = listOf(
                DiaryStat("${s.entryCount}", "纳入日记"),
                DiaryStat("${s.topEmotions.size}", "情绪主题"),
                DiaryStat("${s.topKeywords.size}", "高频关键词"),
            ),
            modifier = Modifier.padding(top = 15.dp),
        )
        if (s.topEmotions.isNotEmpty()) {
            SummaryCard {
                DiaryBlockHead("本月情绪光谱", "按出现频次排序")
                Spacer(Modifier.height(12.dp))
                DiaryKeywordFlow(s.topEmotions.map { "# $it" })
            }
        }
        if (s.topKeywords.isNotEmpty()) {
            SummaryCard {
                DiaryBlockHead("反复出现的主题", "跨 ${s.entryCount} 篇日记")
                Spacer(Modifier.height(12.dp))
                DiaryKeywordFlow(s.topKeywords.map { "# $it" })
            }
        }
        if (s.highlights.isNotEmpty()) {
            SummaryCard {
                DiaryBlockHead("本月高光片段", "AI 从日记中提取")
                Spacer(Modifier.height(13.dp))
                HighlightList(s.highlights)
            }
        }
    }
}

@Composable
private fun SummaryUnavailable(period: String, requestFailed: Boolean) {
    SummaryCard(modifier = Modifier.padding(top = 15.dp)) {
        DiaryBlockHead(
            if (requestFailed) "暂时无法读取总结" else "${period}还没有总结",
            if (requestFailed) "你的日记内容没有被替换" else "记录更多内容后再来看看",
        )
        Spacer(Modifier.height(12.dp))
        Text(
            if (requestFailed) "请稍后点击“更新总结”重试。" else "AI 总结只会基于你真实保存的日记生成。",
            color = Theme.sub,
            fontSize = 12.sp,
            lineHeight = 18.sp,
        )
    }
}

// MARK: 年度内容

@Composable
private fun RemoteYearContent(s: DiarySummaryResponse) {
    Column(
        Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        SummaryHero(
            cap = "YOUR ${s.ref} · 年度声音",
            headline = "这一年的声音\n汇成了一段属于你的回望",
            body = s.insight,
            stats = listOf(
                DiaryStat("${s.entryCount}", "纳入日记"),
                DiaryStat("${s.topEmotions.size}", "情绪主题"),
                DiaryStat("${s.topKeywords.size}", "高频关键词"),
            ),
            modifier = Modifier.padding(top = 15.dp),
        )
        if (s.topKeywords.isNotEmpty()) {
            SummaryCard {
                DiaryBlockHead("年度关键词", "按出现与情绪权重排序")
                Spacer(Modifier.height(12.dp))
                DiaryKeywordFlow(s.topKeywords.map { "# $it" })
            }
        }
        if (s.topEmotions.isNotEmpty()) {
            SummaryCard {
                DiaryBlockHead("年度情绪底色", "按出现频次排序")
                Spacer(Modifier.height(12.dp))
                DiaryKeywordFlow(s.topEmotions.map { "# $it" })
            }
        }
        if (s.highlights.isNotEmpty()) {
            SummaryCard {
                DiaryBlockHead("这一年的高光时刻", "AI 年度回望")
                Spacer(Modifier.height(13.dp))
                HighlightList(s.highlights)
            }
        }
    }
}

/** 高光片段列表（发光圆点 + 文本）。 */
@Composable
private fun HighlightList(items: List<String>) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White.copy(alpha = 0.035f))
            .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(16.dp))
            .padding(13.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items.forEach { text ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    Modifier
                        .padding(top = 5.dp)
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(c(0x8F7BFF)),
                )
                Text(text, color = Theme.sub, fontSize = 11.5.sp, lineHeight = 17.5.sp)
            }
        }
    }
}

// MARK: 共用件

@Composable
private fun SummaryHero(
    cap: String,
    headline: String,
    body: String,
    stats: List<DiaryStat>,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(listOf(c(0x1A1830), c(0x111522))))
            .border(1.dp, c(0x9A8BEA, 0.3f), RoundedCornerShape(24.dp))
            .padding(21.dp),
    ) {
        Text(cap, color = c(0xC4B9FF), fontSize = 9.5.sp, letterSpacing = 2.4.sp)
        Text(
            headline,
            color = Theme.ink,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            lineHeight = 28.sp,
            modifier = Modifier.padding(top = 8.dp),
        )
        Text(
            body,
            color = c(0xBCC4D4),
            fontSize = 11.5.sp,
            lineHeight = 18.5.sp,
            modifier = Modifier.padding(top = 9.dp),
        )
        Row(
            Modifier
                .fillMaxWidth()
                .padding(top = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            stats.forEach { stat ->
                Column(
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(15.dp))
                        .background(Color.White.copy(alpha = 0.045f))
                        .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(15.dp))
                        .padding(vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(stat.value, color = Theme.ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                    Text(stat.label, color = Theme.faint, fontSize = 9.sp)
                }
            }
        }
    }
}

@Composable
private fun SummaryCard(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Theme.card)
            .border(1.dp, Theme.line, RoundedCornerShape(20.dp))
            .padding(17.dp),
    ) {
        content()
    }
}

@Composable
private fun InsightCard(insight: DiaryInsight) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White.copy(alpha = 0.035f))
            .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        insight.cap?.let {
            Text(it, color = c(0x9DBCFF), fontSize = 9.sp, letterSpacing = 1.2.sp)
        }
        Text(insight.title, color = Theme.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, lineHeight = 18.sp)
        Text(insight.body, color = Theme.sub, fontSize = 11.sp, lineHeight = 17.sp)
    }
}
