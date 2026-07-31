package app.possibility.android.features.lab

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.possibility.android.core.AppConfig
import app.possibility.android.core.model.Simulation
import app.possibility.android.core.model.SimulationHorizon
import app.possibility.android.core.model.SimulationResult
import app.possibility.android.core.model.Traveler
import app.possibility.android.core.network.SupabaseService
import app.possibility.android.core.theme.Theme
import app.possibility.android.core.theme.kaleidoCard
import app.possibility.android.features.profile.TravelerProfileSheet

// 推演结果全屏弹层（原型 resultPage）—— 对应 ios/Possibility/Features/Lab/ResultView.swift。
// 三 Tab（最好的结果 / 一般情况 / 最坏的结果）+ 底线压力测试 + 底线分析 + 相似旅人 + 免责声明。

/**
 * 推演结果弹层。
 *
 * @param result     /simulate 返回的三种结局 + 底线分析 + 相似旅人。
 * @param onDismiss  关闭（「重新选择」/返回）。
 * @param question   原始问题（用于标题回显；默认空以兼容强制签名）。
 * @param choice     所选路径名（顶栏副标题）。
 * @param horizon    时间档位（顶栏副标题）。
 * @param carry      携带的底线卡 id（最坏结果页触发 FLOOR TEST）。
 */
@Composable
fun ResultSheet(
    result: SimulationResult,
    onDismiss: () -> Unit,
    question: String = "",
    choice: String = "",
    horizon: SimulationHorizon = SimulationHorizon.YEAR5,
    carry: List<String> = emptyList(),
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        var tab by remember { mutableStateOf(1) } // 默认「一般情况」
        val specs = remember(result) { tabSpecs(result.scenarios) }

        val allTravelers by SupabaseService.shared.travelers.collectAsState()
        val people: List<Traveler> = remember(result, allTravelers) {
            result.recommendedTravelers?.takeIf { it.isNotEmpty() }
                ?: result.recommendedTravelerIds
                    ?.mapNotNull { id -> allTravelers.firstOrNull { it.id == id } }
                    .orEmpty()
        }

        var profileTraveler by remember { mutableStateOf<Traveler?>(null) }

        Box(Modifier.fillMaxSize().background(Theme.paper)) {
            Column(Modifier.fillMaxSize()) {
                ResultTopBar(choice = choice, horizon = horizon, onDismiss = onDismiss)
                Column(
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp)
                        .padding(top = 8.dp),
                ) {
                    ResultHead(question = question, specs = specs, tab = tab, onTab = { tab = it })

                    Spacer(Modifier.height(16.dp))
                    ScenarioPanel(specs[tab])

                    if (tab == 2 && carry.isNotEmpty()) {
                        Spacer(Modifier.height(14.dp))
                        FloorTestPanel(carry)
                    }
                    result.bottomLineAnalysis?.let { analysis ->
                        Spacer(Modifier.height(14.dp))
                        BottomLinePanel(analysis)
                    }

                    Spacer(Modifier.height(20.dp))
                    PeopleSection(people = people, onOpen = { profileTraveler = it })

                    Spacer(Modifier.height(24.dp))
                    LabPrimaryButton(title = "重新选择", enabled = true, onClick = onDismiss)

                    Spacer(Modifier.height(18.dp))
                    ResultDisclaimer()
                    Spacer(Modifier.height(30.dp))
                }
            }
        }

        profileTraveler?.let { t ->
            TravelerProfileSheet(traveler = t, onDismiss = { profileTraveler = null })
        }
    }
}

// MARK: - Tab 规格

private class ResultTab(
    val title: String,
    val eyebrow: String,
    val accent: Color,
    val bg: List<Color>,
    val scenario: Simulation.Scenario,
)

private fun tabSpecs(s: Simulation.Scenarios): List<ResultTab> = listOf(
    ResultTab("最好的结果", "BEST · 顺光面", labColor(0xF06ACD),
        listOf(labColor(0x2C1533), labColor(0x1A1226)), s.optimistic),
    ResultTab("一般情况", "LIKELY · 大概率", labColor(0x6FA5FF),
        listOf(labColor(0x152048), labColor(0x11142B)), s.general),
    ResultTab("最坏的结果", "WORST · 背光面", labColor(0xFF8A5E),
        listOf(labColor(0x33160E), labColor(0x1C0F0C)), s.cautionary),
)

// MARK: - 顶栏

@Composable
private fun ResultTopBar(choice: String, horizon: SimulationHorizon, onDismiss: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(Color(0xFF0A0C12))
            .padding(top = 12.dp, bottom = 12.dp),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 22.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(30.dp)
                    .clip(CircleShape)
                    .background(Theme.raised)
                    .clickableNoRipple(onDismiss),
                contentAlignment = Alignment.Center,
            ) {
                Text("‹", color = Theme.ink, fontSize = 20.sp, fontWeight = FontWeight.Medium)
            }
            Spacer(Modifier.width(13.dp))
            Column(Modifier.weight(1f)) {
                Text("推演结果", color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
                val sub = if (choice.isBlank()) horizon.label + "后" else "$choice · ${horizon.label}后"
                Text(sub, color = Theme.faint, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
            }
        }
    }
}

// MARK: - 头部 + 分段控件

@Composable
private fun ResultHead(question: String, specs: List<ResultTab>, tab: Int, onTab: (Int) -> Unit) {
    Column(Modifier.padding(top = 4.dp)) {
        val text = buildAnnotatedString {
            append("「")
            withStyle(SpanStyle(color = Theme.ink, fontWeight = FontWeight.Bold)) {
                append(if (question.isBlank()) "这个选择" else question)
            }
            append("」的三种可能 —— 先看一般情况，再看两端。")
        }
        Text(text, color = Theme.sub, fontSize = 12.sp, lineHeight = 18.sp)
        Spacer(Modifier.height(16.dp))
        SegmentedControl(specs = specs, tab = tab, onTab = onTab)
    }
}

@Composable
private fun SegmentedControl(specs: List<ResultTab>, tab: Int, onTab: (Int) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(50))
            .background(Theme.raised)
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        specs.forEachIndexed { i, spec ->
            val selected = tab == i
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(50))
                    .then(if (selected) Modifier.background(Theme.buttonGradient) else Modifier)
                    .clickableNoRipple { onTab(i) }
                    .padding(vertical = 9.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    spec.title,
                    color = if (selected) Color.White else Theme.sub,
                    fontSize = 13.sp,
                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                )
            }
        }
    }
}

// MARK: - 单结局面板

@Composable
private fun ScenarioPanel(spec: ResultTab) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ScenarioSummary(spec)
        DimsCard(spec.scenario.dimensions)
        Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            ListCard("可能获得", Theme.teal, spec.scenario.gains, Modifier.weight(1f))
            ListCard("需要留意", Theme.pink, spec.scenario.costs, Modifier.weight(1f))
        }
        spec.scenario.keyCondition?.let { KeyBox(it) }
    }
}

@Composable
private fun ScenarioSummary(spec: ResultTab) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(Brush.linearGradient(spec.bg))
            .drawBehind {
                drawRoundRect(
                    brush = Brush.radialGradient(
                        colors = listOf(spec.accent.copy(alpha = 0.4f), Color.Transparent),
                        center = Offset(size.width, 0f),
                        radius = 180f,
                    ),
                    cornerRadius = CornerRadius(22.dp.toPx(), 22.dp.toPx()),
                )
            }
            .border(1.dp, spec.accent.copy(alpha = 0.35f), RoundedCornerShape(22.dp))
            .padding(20.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(spec.eyebrow, color = spec.accent, fontSize = 11.sp, letterSpacing = 2.5.sp)
            Text(spec.scenario.headline, color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold, lineHeight = 24.sp)
        }
    }
}

@Composable
private fun DimsCard(dimensions: List<Simulation.Scenario.Dimension>) {
    Column(
        Modifier
            .fillMaxWidth()
            .kaleidoCard()
            .padding(horizontal = 20.dp, vertical = 6.dp),
    ) {
        dimensions.forEachIndexed { idx, dim ->
            Row(
                Modifier.fillMaxWidth().padding(vertical = 13.dp),
                horizontalArrangement = Arrangement.spacedBy(13.dp),
            ) {
                Text(dim.label, color = Theme.faint, fontSize = 12.sp, modifier = Modifier.width(60.dp))
                Text(dim.text, color = Theme.ink, fontSize = 13.sp, lineHeight = 19.sp, modifier = Modifier.weight(1f))
            }
            if (idx < dimensions.size - 1) {
                Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
            }
        }
    }
}

@Composable
private fun ListCard(title: String, dot: Color, items: List<String>, modifier: Modifier = Modifier) {
    Column(
        modifier
            .kaleidoCard(radius = 18.dp)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(Modifier.size(7.dp).clip(CircleShape).background(dot))
            Text(title, color = Theme.ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        items.forEach { item ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.padding(top = 6.dp).size(4.dp).clip(CircleShape).background(Theme.faint))
                Text(item, color = Theme.sub, fontSize = 11.5.sp, lineHeight = 15.sp, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun KeyBox(text: String) {
    val body = buildAnnotatedString {
        withStyle(SpanStyle(color = Theme.ink, fontWeight = FontWeight.Bold)) { append("最关键的条件：") }
        withStyle(SpanStyle(color = Theme.sub)) { append(text) }
    }
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(
                Brush.horizontalGradient(
                    listOf(labColor(0x5E96FF).copy(alpha = 0.12f), labColor(0xD7F464).copy(alpha = 0.08f)),
                ),
            )
            .dashedBorder(labColor(0x6FA5FF).copy(alpha = 0.45f), 16.dp)
            .padding(horizontal = 18.dp, vertical = 15.dp),
    ) {
        Text(body, fontSize = 12.5.sp, lineHeight = 18.sp)
    }
}

// MARK: - 底线压力测试（FLOOR TEST）

@Composable
private fun FloorTestPanel(carryIds: List<String>) {
    val cards = remember(carryIds) { carryIds.mapNotNull { LabModel.carryCard(it) } }
    val answers = remember { mutableStateMapOf<String, Boolean>() }
    val orange = labColor(0xFF9B77)

    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(21.dp))
            .background(labColor(0x11151D))
            .border(1.dp, labColor(0xFF7A4D).copy(alpha = 0.24f), RoundedCornerShape(21.dp))
            .padding(17.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        Text("FLOOR TEST · 底线压力测试", color = orange, fontSize = 8.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.2.sp)
        Text("最坏的结果，会击穿你带进来的底线吗？", color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, lineHeight = 21.sp)
        Text("逐张确认：如果这个结局真的发生，这张底线卡还守得住吗？", color = Theme.sub, fontSize = 10.5.sp, lineHeight = 16.sp)

        cards.forEach { card ->
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Theme.raised)
                    .padding(13.dp),
                verticalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CardIconMark(card.icon, tint = orange, size = 13.dp)
                    Text(card.name, color = Theme.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
                Text(card.risk, color = Theme.sub, fontSize = 11.5.sp, lineHeight = 17.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    FloorButton("最差如此，仍可承受", accept = true, on = answers[card.id] == true, modifier = Modifier.weight(1f)) { answers[card.id] = true }
                    FloorButton("这已经越过底线", accept = false, on = answers[card.id] == false, modifier = Modifier.weight(1f)) { answers[card.id] = false }
                }
            }
        }

        val allAnswered = cards.isNotEmpty() && answers.size == cards.size
        if (allAnswered) {
            val rejected = cards.filter { answers[it.id] == false }.map { it.name }
            FloorVerdict(pass = rejected.isEmpty(), rejected = rejected, total = cards.size)
        }
    }
}

@Composable
private fun FloorButton(title: String, accept: Boolean, on: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val tint = if (accept) Theme.teal else labColor(0xFF8A5E)
    Box(
        modifier
            .clip(RoundedCornerShape(50))
            .background(if (on) tint.copy(alpha = 0.12f) else Color.White.copy(alpha = 0.05f))
            .border(1.dp, if (on) tint.copy(alpha = 0.55f) else Theme.line, RoundedCornerShape(50))
            .clickableNoRipple(onClick)
            .padding(vertical = 9.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            title,
            color = if (on) tint else Theme.sub,
            fontSize = 10.5.sp,
            fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal,
        )
    }
}

@Composable
private fun FloorVerdict(pass: Boolean, rejected: List<String>, total: Int) {
    val accent = if (pass) Theme.teal else labColor(0xFF9B77)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background((if (pass) Theme.teal else labColor(0xFF7A4D)).copy(alpha = 0.08f))
            .border(1.dp, (if (pass) Theme.teal else labColor(0xFF7A4D)).copy(alpha = 0.3f), RoundedCornerShape(14.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Text(
            if (pass) "可以继续转变 · 但不是盲目乐观" else "暂时不要直接跨过去",
            color = accent, fontSize = 9.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.6.sp,
        )
        Text(
            if (pass) "你看见了最差结果，也确认它没有击穿带入的 $total 张底线卡。"
            else "最坏结果会击穿：${rejected.joinToString("、")}",
            color = Theme.ink, fontSize = 13.sp, fontWeight = FontWeight.Bold, lineHeight = 19.sp,
        )
        Text(
            if (pass) "这说明这条路值得继续验证。下一步不是立刻跳下去，而是为这些底线分别保留现实缓冲。"
            else "这不等于你不适合改变。先为这些底线建立保护条件，再回来重新测试。",
            color = Theme.sub, fontSize = 11.5.sp, lineHeight = 17.sp,
        )
    }
}

// MARK: - 底线分析（BOTTOM LINE）

@Composable
private fun BottomLinePanel(analysis: SimulationResult.BottomLineAnalysis) {
    val accept = analysis.isAcceptable
    val accent = if (accept) Theme.teal else labColor(0xFF9B77)
    val border = if (accept) Theme.teal.copy(alpha = 0.24f) else labColor(0xFF7A4D).copy(alpha = 0.24f)

    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(21.dp))
            .background(labColor(0x11151D))
            .border(1.dp, border, RoundedCornerShape(21.dp))
            .padding(17.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        Text("BOTTOM LINE · 底线分析", color = accent, fontSize = 8.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.2.sp)
        Text(
            if (accept) "最坏的结果，仍在你的底线之内" else "最坏的结果，可能击穿你的底线",
            color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, lineHeight = 21.sp,
        )
        Text(
            if (accept) "结合你带走的底线卡与三种结局推演，这条路的最差情况大概率守得住。"
            else "结合你带走的底线卡与三种结局推演，先为下面的风险建立保护条件，再考虑迈出这一步。",
            color = Theme.sub, fontSize = 10.5.sp, lineHeight = 16.sp,
        )
        if (analysis.risks.isNotEmpty()) {
            BottomLineList("需要警惕的风险", labColor(0xFF8A5E), analysis.risks)
        }
        if (analysis.protectiveConditions.isNotEmpty()) {
            BottomLineList("保护条件", Theme.teal, analysis.protectiveConditions)
        }
    }
}

@Composable
private fun BottomLineList(title: String, dot: Color, items: List<String>) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Theme.raised)
            .padding(13.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(Modifier.size(7.dp).clip(CircleShape).background(dot))
            Text(title, color = Theme.ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        items.forEach { item ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.padding(top = 6.dp).size(4.dp).clip(CircleShape).background(Theme.faint))
                Text(item, color = Theme.sub, fontSize = 11.5.sp, lineHeight = 16.sp, modifier = Modifier.weight(1f))
            }
        }
    }
}

// MARK: - 相似旅人

@Composable
private fun PeopleSection(people: List<Traveler>, onOpen: (Traveler) -> Unit) {
    if (people.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        LabSectionHeader(title = "类似经验的人", trailing = "左右滑动查看")
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.Top,
        ) {
            people.forEach { t -> SimCard(t) { onOpen(t) } }
        }
    }
}

@Composable
private fun SimCard(traveler: Traveler, onClick: () -> Unit) {
    Column(
        Modifier
            .width(168.dp)
            .height(172.dp)
            .kaleidoCard(radius = 18.dp)
            .clickableNoRipple(onClick),
    ) {
        val hue = Theme.hue(traveler.hue)
        Box(
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .background(hue.gradient),
            contentAlignment = Alignment.CenterStart,
        ) {
            Box(
                Modifier
                    .padding(start = 14.dp)
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.18f))
                    .border(1.dp, Color.White.copy(alpha = 0.4f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(traveler.initial, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
        }
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp)
                .padding(top = 20.dp, bottom = 14.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Text(traveler.name, color = Theme.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text(traveler.quote, color = Theme.sub, fontSize = 11.sp, lineHeight = 15.sp, maxLines = 2)
            if (traveler.tags.isNotEmpty()) {
                Row(
                    Modifier.padding(top = 3.dp),
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    traveler.tags.take(2).forEach { TagPill(it) }
                }
            }
        }
    }
}

@Composable
private fun TagPill(text: String) {
    Box(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(Color.White.copy(alpha = 0.06f))
            .border(1.dp, Theme.line, RoundedCornerShape(50))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(text, color = Theme.faint, fontSize = 9.5.sp)
    }
}

// MARK: - 免责声明

@Composable
private fun ResultDisclaimer() {
    Text(
        AppConfig.Copy.SIM_DISCLAIMER,
        color = Theme.faint,
        fontSize = 11.sp,
        lineHeight = 17.sp,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
    )
}
