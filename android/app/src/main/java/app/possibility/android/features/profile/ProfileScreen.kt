package app.possibility.android.features.profile

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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.possibility.android.core.model.AdviceKind
import app.possibility.android.core.model.Traveler
import app.possibility.android.core.model.TrajectoryNode
import app.possibility.android.core.model.TravelerDetail
import app.possibility.android.core.model.TravelerServiceItem
import app.possibility.android.core.theme.Theme

// 旅人主页（原型 profilePage）—— 对应 ios/Possibility/Features/Profile/ProfileView.swift + ProfilePanels.swift。
// 全屏 Dialog：顶栏 + hero + 4 Tab（她的故事/时间线/经验与建议/可提供服务）+ 底部 PayBar。
// intro 免费；full_text/advice 需已解锁（model.unlocked）才显示，否则锁定卡引导解锁。

private val stageBg = Color(0xFF090B12)

/** 无水波点击（对齐 iOS plain button 风格）。 */
internal fun Modifier.clickableNoRipple(onClick: () -> Unit): Modifier = composed {
    val interaction = remember { MutableInteractionSource() }
    clickable(interactionSource = interaction, indication = null, onClick = onClick)
}

/**
 * 旅人主页全屏弹层。由触发方就地呈现（对应 iOS TravelerProfileLink 的「谁触发谁呈现」）。
 */
@Composable
fun TravelerProfileSheet(traveler: Traveler, onDismiss: () -> Unit) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        val model = remember(traveler.id) { ProfileModel(traveler) }
        var showPaywall by remember { mutableStateOf(false) }

        LaunchedEffect(traveler.id) { model.load() }

        Box(Modifier.fillMaxSize().background(stageBg)) {
            Column(Modifier.fillMaxSize()) {
                TopBar(traveler.name, onDismiss)
                if (model.loading) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Theme.blue, strokeWidth = 3.dp)
                    }
                } else {
                    Column(
                        Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState()),
                    ) {
                        Hero(model)
                        TabsBar(model)
                        Box(Modifier.padding(horizontal = 20.dp).padding(top = 20.dp, bottom = 8.dp)) {
                            Panel(model) { showPaywall = true }
                        }
                    }
                    PayBar(model) { showPaywall = true }
                }
            }
        }

        if (showPaywall) {
            PaywallSheet(
                traveler = traveler,
                onDismiss = { showPaywall = false },
                onUnlocked = { model.markUnlocked() },
            )
        }
    }
}

// MARK: 顶栏

@Composable
private fun TopBar(name: String, onDismiss: () -> Unit) {
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
                .padding(top = 12.dp, bottom = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(Theme.raised)
                    .border(1.dp, Theme.line, CircleShape)
                    .clickableNoRipple(onDismiss),
                contentAlignment = Alignment.Center,
            ) {
                Text("‹", color = Theme.ink, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.width(13.dp))
            Column(Modifier.weight(1f)) {
                Text(name, color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp)
                Text("真实经历 · 已验证", color = Theme.faint, fontSize = 11.sp)
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
    }
}

// MARK: Hero

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Hero(model: ProfileModel) {
    val t = model.traveler
    val d = model.detail
    Column(
        Modifier
            .fillMaxWidth()
            .background(
                Brush.linearGradient(listOf(Color(0xFF111625), Color(0xFF0B0E17))),
            )
            .padding(horizontal = 22.dp)
            .padding(top = 22.dp, bottom = 20.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TravelerAvatar(t.initial, t.hue, 74.dp, 26.dp)
            Spacer(Modifier.width(16.dp))
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(t.name, color = Theme.ink, fontSize = 21.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp)
                    Spacer(Modifier.width(8.dp))
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(Theme.blue.copy(alpha = 0.13f))
                            .border(1.dp, Theme.blue.copy(alpha = 0.26f), RoundedCornerShape(999.dp))
                            .padding(horizontal = 7.dp, vertical = 3.dp),
                    ) {
                        Text("经历已验证", color = Color(0xFFAFC8FF), fontSize = 10.sp)
                    }
                }
                if (d != null) {
                    val loc = buildString {
                        d.age?.let { append("$it 岁 · ") }
                        append(d.city.orEmpty())
                    }
                    if (loc.isNotBlank()) Text(loc, color = Theme.sub, fontSize = 12.sp)
                }
            }
        }

        if (d != null) {
            Row(Modifier.padding(top = 18.dp)) {
                Text(d.fromRole.orEmpty(), color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Text("  →  ", color = Theme.blue, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Text(d.toRole.orEmpty(), color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            }
            Text(
                "${d.years.orEmpty()} · ${d.result.orEmpty()}",
                color = Theme.sub,
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 7.dp),
            )
        }

        FlowRow(
            Modifier.padding(top = 16.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(7.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            t.tags.forEach { tag ->
                Box(
                    Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(Theme.blue.copy(alpha = 0.11f))
                        .border(1.dp, Theme.blue.copy(alpha = 0.2f), RoundedCornerShape(999.dp))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                ) {
                    Text(tag, color = Color(0xFFC6D7FF), fontSize = 11.sp)
                }
            }
        }
    }
    Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
}

@Composable
private fun TravelerAvatar(initial: String, hue: Int, size: androidx.compose.ui.unit.Dp, radius: androidx.compose.ui.unit.Dp) {
    Box(contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .size(size)
                .clip(RoundedCornerShape(radius))
                .background(Theme.hue(hue).gradient),
            contentAlignment = Alignment.Center,
        ) {
            Text(initial, color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold)
        }
        // 在线标记
        Box(
            Modifier
                .align(Alignment.BottomEnd)
                .size(17.dp)
                .clip(CircleShape)
                .background(Theme.teal)
                .border(3.dp, Color(0xFF10131D), CircleShape),
        )
    }
}

// MARK: Tabs

@Composable
private fun TabsBar(model: ProfileModel) {
    Column {
        Row(
            Modifier
                .fillMaxWidth()
                .background(Color(0xFF0A0C12)),
        ) {
            ProfileTab.entries.forEach { tab ->
                val active = model.tab == tab
                Column(
                    Modifier
                        .weight(1f)
                        .clickableNoRipple { model.tab = tab }
                        .padding(top = 15.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        tab.label,
                        color = if (active) Theme.ink else Theme.faint,
                        fontSize = 11.5.sp,
                        fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                    )
                    Box(
                        Modifier
                            .padding(horizontal = 20.dp)
                            .fillMaxWidth()
                            .height(2.dp)
                            .background(if (active) Theme.blue else Color.Transparent),
                    )
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
    }
}

// MARK: Panel 分发

@Composable
private fun Panel(model: ProfileModel, onUnlock: () -> Unit) {
    when (model.tab) {
        ProfileTab.STORY -> StoryPanel(model, onUnlock)
        ProfileTab.TIMELINE -> TimelinePanel(model)
        ProfileTab.ADVICE -> AdvicePanel(model, onUnlock)
        ProfileTab.SERVICE -> ServicePanel(model, onUnlock)
    }
}

// MARK: 她的故事

@Composable
private fun StoryPanel(model: ProfileModel, onUnlock: () -> Unit) {
    val t = model.traveler
    val d = model.detail
    Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
        // quote 卡
        Box(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(
                    Brush.linearGradient(
                        listOf(Theme.blue.copy(alpha = 0.15f), Theme.violetSoft.copy(alpha = 0.08f)),
                    ),
                )
                .border(1.dp, Color(0xFF6FA5FF).copy(alpha = 0.25f), RoundedCornerShape(22.dp))
                .padding(22.dp),
        ) {
            Text(t.quote, color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.Medium, lineHeight = 24.sp)
        }

        if (d != null) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("我的转型故事", color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Text(d.intro, color = Color(0xFFC8CDDA), fontSize = 13.5.sp, lineHeight = 21.sp)
            }
            StoryFacts(model, d)
            // 完整故事：付费解锁
            if (model.unlocked) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .kaleidoCardBox(20.dp)
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(9.dp),
                ) {
                    Text("完整故事 · 最难的一关", color = Color(0xFFB9CCFF), fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
                    Text(d.fullText, color = Theme.sub, fontSize = 13.sp, lineHeight = 20.sp)
                }
            } else {
                LockedBlock(
                    title = "解锁完整故事",
                    hint = "最难的一关、关键取舍与复盘，解锁后可见",
                    onClick = onUnlock,
                )
            }
        }
    }
}

@Composable
private fun StoryFacts(model: ProfileModel, d: TravelerDetail) {
    val years = d.years?.filter { it.isDigit() }?.ifBlank { null } ?: model.traveler.trajectory.size.toString()
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Fact("$years 年", "真实实践", Modifier.weight(1f))
        Fact("${model.traveler.trajectory.size}", "关键节点", Modifier.weight(1f))
        Fact("${d.consulted ?: 0}", "已帮助人数", Modifier.weight(1f))
    }
}

@Composable
private fun Fact(value: String, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier
            .kaleidoCardBox(16.dp)
            .padding(vertical = 13.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(value, color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        Text(label, color = Theme.faint, fontSize = 10.sp)
    }
}

// MARK: 时间线

@Composable
private fun TimelinePanel(model: ProfileModel) {
    val nodes = model.traveler.trajectory
    var openIndex by remember { mutableIntStateOf(0) }
    Column {
        SectionHeader("人生关键轨迹", "点击节点展开详情")
        Column(Modifier.padding(top = 12.dp)) {
            nodes.forEachIndexed { idx, node ->
                TimelineNodeRow(
                    node = node,
                    isLast = idx == nodes.size - 1,
                    open = openIndex == idx,
                    onToggle = { openIndex = if (openIndex == idx) -1 else idx },
                )
            }
        }
        Box(
            Modifier
                .padding(top = 8.dp)
                .fillMaxWidth()
                .kaleidoCardBox(20.dp)
                .padding(18.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Text("轨迹说明", color = Color(0xFFB9CCFF), fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
                Text(
                    "以上节点由本人补充，并结合公开履历完成基础验证。经历只代表个人路径，不构成标准答案。",
                    color = Theme.sub,
                    fontSize = 13.sp,
                    lineHeight = 19.sp,
                )
            }
        }
    }
}

@Composable
private fun TimelineNodeRow(node: TrajectoryNode, isLast: Boolean, open: Boolean, onToggle: () -> Unit) {
    Row {
        Column(
            Modifier.width(15.dp).padding(top = 15.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                Modifier
                    .size(15.dp)
                    .clip(CircleShape)
                    .background(Theme.auroraDeep)
                    .border(3.dp, Color(0xFF0B0E17), CircleShape),
            )
            if (!isLast) {
                Box(
                    Modifier
                        .padding(top = 2.dp)
                        .width(1.dp)
                        .height(if (open) 120.dp else 60.dp)
                        .background(
                            Brush.verticalGradient(
                                listOf(Theme.violetSoft, Theme.violetSoft.copy(alpha = 0.08f)),
                            ),
                        ),
                )
            }
        }
        Column(
            Modifier
                .padding(start = 15.dp, bottom = 12.dp)
                .weight(1f)
                .kaleidoCardBox(18.dp)
                .clickableNoRipple(onToggle)
                .padding(15.dp),
        ) {
            Row {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(node.age, color = Theme.blue, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    Text(node.title, color = Theme.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
                Text(if (open) "⌄" else "›", color = Theme.faint, fontSize = 15.sp)
            }
            if (open) {
                Text(
                    node.detail,
                    color = Theme.sub,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    modifier = Modifier.padding(top = 9.dp),
                )
            }
        }
    }
}

// MARK: 经验与建议（付费解锁）

@Composable
private fun AdvicePanel(model: ProfileModel, onUnlock: () -> Unit) {
    if (!model.unlocked) {
        LockedBlock(
            title = "解锁全部经验与建议",
            hint = "转型决策 · 能力迁移 · 求职面试，全部踩坑建议解锁后可见",
            onClick = onUnlock,
        )
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(15.dp)) {
        SectionHeader("把踩过的坑留给后来人", "全部可见")
        Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            AdviceKind.entries.forEach { kind ->
                ChipToggle(kind.label, model.adviceKind == kind) { model.adviceKind = kind }
            }
        }
        Column(
            Modifier
                .fillMaxWidth()
                .kaleidoCardBox(20.dp)
                .padding(19.dp),
        ) {
            Text(model.adviceKind.label.uppercase(), color = Theme.blue, fontSize = 10.sp, letterSpacing = 2.sp)
            Text(
                model.adviceTitle,
                color = Theme.ink,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                lineHeight = 20.sp,
                modifier = Modifier.padding(top = 7.dp),
            )
            Column(Modifier.padding(top = 14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                model.adviceTips.forEachIndexed { i, tip ->
                    Row {
                        Box(
                            Modifier
                                .size(20.dp)
                                .clip(RoundedCornerShape(7.dp))
                                .background(Theme.teal.copy(alpha = 0.12f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("${i + 1}", color = Theme.teal, fontSize = 10.sp)
                        }
                        Spacer(Modifier.width(10.dp))
                        Text(tip, color = Color(0xFFC9CFDC), fontSize = 12.sp, lineHeight = 16.sp, modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

// MARK: 可提供服务

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ServicePanel(model: ProfileModel, onCheckout: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        model.services.forEach { service ->
            ServiceCard(service, onCheckout)
        }
        // how it works
        val steps = listOf(
            "确认目标与边界" to "先说明你的处境，双方确认服务适合再开始",
            "正式沟通 / 交付" to "按约定形式进行咨询、交付资料或开始陪跑",
            "追问与复盘" to "结束后保留一次追问，沉淀可执行的下一步",
        )
        Column(
            Modifier
                .padding(top = 6.dp)
                .fillMaxWidth()
                .kaleidoCardBox(20.dp)
                .padding(18.dp),
        ) {
            steps.forEachIndexed { i, step ->
                Row(Modifier.padding(vertical = 10.dp)) {
                    Box(
                        Modifier
                            .size(22.dp)
                            .clip(CircleShape)
                            .background(Theme.blue.copy(alpha = 0.13f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("${i + 1}", color = Theme.blue, fontSize = 10.sp)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(step.first, color = Theme.ink, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                        Text(step.second, color = Theme.faint, fontSize = 11.sp)
                    }
                }
                if (i < steps.size - 1) Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ServiceCard(service: TravelerServiceItem, onCheckout: () -> Unit) {
    val (bg, border) = when (service.kind) {
        "materials" -> listOf(Color(0xFF172820), Color(0xFF101A17)) to Color(0xFF3ED9A4)
        "companion" -> listOf(Color(0xFF2B1B2D), Color(0xFF17121F)) to Color(0xFFE35CC1)
        else -> listOf(Color(0xFF151C34), Color(0xFF111327)) to Color(0xFF6FA5FF)
    }
    val kindLabel = when (service.kind) {
        "materials" -> "资料工具包"
        "companion" -> "阶段陪跑"
        else -> "1 对 1 咨询"
    }
    val ctaLabel = when (service.kind) {
        "materials" -> "购买资料包"
        "companion" -> "申请陪跑"
        else -> "向 TA 咨询"
    }
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(bg))
            .border(1.dp, border.copy(alpha = 0.28f), RoundedCornerShape(24.dp))
            .padding(21.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.Bottom) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Text(kindLabel.uppercase(), color = Color(0xFF9DBCFF), fontSize = 10.sp, letterSpacing = 2.5.sp)
                Text(service.title, color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.width(10.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Text("¥${formatPrice(service.price)}", color = Color.White, fontSize = 25.sp, fontWeight = FontWeight.Bold)
                Text(" / ${service.unit}", color = Theme.sub, fontSize = 11.sp, modifier = Modifier.padding(bottom = 3.dp))
            }
        }
        Text(service.description, color = Theme.sub, fontSize = 12.sp, lineHeight = 17.sp)
        if (service.tags.isNotEmpty()) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                service.tags.forEach { tag ->
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(Color.White.copy(alpha = 0.055f))
                            .padding(horizontal = 10.dp, vertical = 7.dp),
                    ) {
                        Text(tag, color = Color(0xFFC8CEDD), fontSize = 11.sp)
                    }
                }
            }
        }
        Box(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(999.dp))
                .background(Theme.buttonGradient)
                .clickableNoRipple(onCheckout)
                .padding(vertical = 14.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(ctaLabel, color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

// MARK: 锁定块（原型 prof-lock / story-locked）

@Composable
private fun LockedBlock(title: String, hint: String, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(
                Brush.linearGradient(
                    listOf(Color(0xFF1B1F2B).copy(alpha = 0.96f), Color(0xFF12151F).copy(alpha = 0.96f)),
                ),
            )
            .border(1.dp, Color(0xFF6FA5FF).copy(alpha = 0.2f), RoundedCornerShape(20.dp))
            .clickableNoRipple(onClick)
            .padding(19.dp),
        contentAlignment = Alignment.Center,
    ) {
        // 模糊的假文本条
        Column(
            Modifier
                .fillMaxWidth()
                .blur(4.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            listOf(1.0f, 0.76f, 0.88f).forEach { frac ->
                Box(
                    Modifier
                        .fillMaxWidth(frac)
                        .height(8.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(Theme.sub.copy(alpha = 0.24f)),
                )
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("🔒", fontSize = 15.sp)
            Text(title, color = Theme.ink, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
            Text(hint, color = Theme.sub, fontSize = 11.sp, lineHeight = 15.sp)
        }
    }
}

// MARK: 底部付费栏（原型 prof-paybar）

@Composable
private fun PayBar(model: ProfileModel, onConsult: () -> Unit) {
    Column {
        Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
        Row(
            Modifier
                .fillMaxWidth()
                .background(Color(0xFF0A0C12))
                .navigationBarsPadding()
                .padding(horizontal = 14.dp)
                .padding(top = 12.dp, bottom = 8.dp),
        ) {
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Theme.buttonGradient)
                    .clickableNoRipple(onConsult)
                    .padding(vertical = 15.dp),
                contentAlignment = Alignment.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("向 TA 咨询", color = Color.White, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                    Text("¥${formatPrice(model.consultPrice)}", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// MARK: 小组件

@Composable
private fun SectionHeader(title: String, trailing: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
        Text(trailing, color = Theme.faint, fontSize = 11.sp)
    }
}

@Composable
private fun ChipToggle(label: String, isOn: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (isOn) Theme.blue.copy(alpha = 0.16f) else Theme.raised)
            .border(1.dp, if (isOn) Theme.blue.copy(alpha = 0.4f) else Theme.line, RoundedCornerShape(999.dp))
            .clickableNoRipple(onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    ) {
        Text(
            label,
            color = if (isOn) Theme.ink else Theme.sub,
            fontSize = 12.sp,
            fontWeight = if (isOn) FontWeight.SemiBold else FontWeight.Normal,
        )
    }
}

/** 通用卡面（对齐 Theme.kaleidoCard，但可指定圆角）。 */
private fun Modifier.kaleidoCardBox(radius: androidx.compose.ui.unit.Dp): Modifier =
    this
        .clip(RoundedCornerShape(radius))
        .background(Theme.card)
        .border(1.dp, Theme.line, RoundedCornerShape(radius))
