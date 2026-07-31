package app.possibility.android.features.me

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.model.MyProfile
import app.possibility.android.core.network.SupabaseService
import app.possibility.android.core.theme.Theme
import kotlinx.coroutines.launch

// MARK: - 我的主页 Tab（对应 ios/Possibility/Features/Me/MeView.swift · 原型 #scr-me）
//
// hero（头像 / 徽章 / 转型条 / 标签 / 编辑）→ 4 tab：动态画像 / 我的故事 / 经验与建议 / 提供服务 → 账号区。

/** 无水波点击（对齐 iOS plain button 风格），供 me 包内共享。 */
internal fun Modifier.clickableNoRipple(onClick: () -> Unit): Modifier = composed {
    val interaction = remember { MutableInteractionSource() }
    clickable(interactionSource = interaction, indication = null, onClick = onClick)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MeScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    remember { MyProfileStore.bind(context.applicationContext); 0 }

    val profile by MyProfileStore.profile.collectAsState()
    val facts by MyProfileStore.facts.collectAsState()

    var tab by remember { mutableStateOf("persona") }
    var editMode by remember { mutableStateOf<MeEditMode?>(null) }
    var showPrivacy by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var accountBusy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { MyProfileStore.syncFromRemote() }

    Box(Modifier.fillMaxSize().background(Theme.stage)) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).statusBarsPadding()
                .padding(horizontal = 22.dp).padding(top = 20.dp, bottom = 40.dp),
        ) {
            PageHeader("MY PUBLIC PAGE", "我的主页")
            Box(Modifier.padding(top = 16.dp)) { Hero(profile) { editMode = MeEditMode.BASIC } }
            Box(Modifier.padding(top = 16.dp)) { Tabs(tab) { tab = it } }
            Box(Modifier.padding(top = 16.dp)) {
                when (tab) {
                    "story" -> StoryPanel(profile) { editMode = MeEditMode.STORY }
                    "advice" -> AdvicePanel(profile) { editMode = MeEditMode.ADVICE }
                    "service" -> ServicePanel(profile) { editMode = MeEditMode.SERVICE }
                    else -> PersonaPanel(facts) { showPrivacy = true }
                }
            }
            Box(Modifier.padding(top = 24.dp)) {
                AccountSection(
                    accountBusy = accountBusy,
                    onPrivacy = { showPrivacy = true },
                    onResendEmail = {
                        val address = SupabaseService.shared.emailDisplay ?: return@AccountSection
                        if (accountBusy) return@AccountSection
                        accountBusy = true
                        scope.launch {
                            val sent = SupabaseService.shared.sendVerificationEmail(address)
                            accountBusy = false
                            ToastCenter.show(if (sent) "验证链接已重新发送至 $address" else "发送失败，请稍后再试")
                        }
                    },
                    onSignOut = {
                        if (accountBusy) return@AccountSection
                        accountBusy = true
                        scope.launch {
                            SupabaseService.shared.signOut()
                            accountBusy = false
                            ToastCenter.show("已退出登录")
                        }
                    },
                    onDelete = { showDeleteConfirm = true },
                )
            }
        }
    }

    editMode?.let { mode ->
        MeEditSheet(mode) {
            editMode = null
            scope.launch { MyProfileStore.syncFromRemote() }
        }
    }

    if (showPrivacy) {
        ProfilePrivacySheet {
            showPrivacy = false
            scope.launch { MyProfileStore.syncFromRemote() }
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            containerColor = Theme.card,
            title = { Text("注销账号", color = Theme.ink, fontWeight = FontWeight.Bold) },
            text = {
                Text("注销后账号与全部数据将被永久删除，且无法恢复。", color = Theme.sub, fontSize = 13.sp)
            },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    if (accountBusy) return@TextButton
                    accountBusy = true
                    scope.launch {
                        val ok = runCatching { SupabaseService.shared.deleteAccount() }.isSuccess
                        accountBusy = false
                        ToastCenter.show(if (ok) "账号已注销" else "注销失败，请稍后重试")
                    }
                }) {
                    Text("永久删除我的账号", color = Theme.orange, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("取消", color = Theme.sub)
                }
            },
        )
    }
}

// MARK: 页头

@Composable
private fun PageHeader(eyebrow: String, title: String) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(eyebrow, color = Theme.faint, fontSize = 11.sp, letterSpacing = 2.sp, fontWeight = FontWeight.SemiBold)
        Text(title, color = Theme.ink, fontSize = 26.sp, fontWeight = FontWeight.Bold)
    }
}

// MARK: Hero（原型 .prof-hero）

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Hero(profile: MyProfile, onEdit: () -> Unit) {
    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(Theme.Radius.card))
            .background(Theme.card)
            .border(1.dp, Theme.line, RoundedCornerShape(Theme.Radius.card))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            HeroAvatar(profile.name.take(1), profile.hue)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(profile.name, color = Theme.ink, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.width(8.dp))
                    Box(
                        Modifier.clip(RoundedCornerShape(999.dp))
                            .background(Theme.teal.copy(alpha = 0.13f))
                            .border(1.dp, Theme.teal.copy(alpha = 0.4f), RoundedCornerShape(999.dp))
                            .padding(horizontal = 8.dp, vertical = 3.dp),
                    ) {
                        Text("我的公开主页", color = Color(0xFF8EE7C8), fontSize = 9.5.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
                Text("${profile.meta.age} 岁 · ${profile.meta.city}", color = Theme.sub, fontSize = 12.sp)
            }
            Box(
                Modifier.size(34.dp).clip(CircleShape).background(Theme.raised)
                    .border(1.dp, Theme.line, CircleShape)
                    .clickableNoRipple(onEdit),
                contentAlignment = Alignment.Center,
            ) {
                Text("✎", color = Theme.ink, fontSize = 14.sp)
            }
        }

        // 转型条（原型 .prof-transition）
        Box(
            Modifier.clip(RoundedCornerShape(999.dp))
                .background(Theme.blue.copy(alpha = 0.09f))
                .border(1.dp, Theme.blue.copy(alpha = 0.28f), RoundedCornerShape(999.dp))
                .padding(horizontal = 14.dp, vertical = 9.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                Text(profile.meta.from, color = Theme.sub, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Text("→", color = Theme.blue, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Text(profile.meta.to, color = Theme.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }

        Text("${profile.meta.years} · ${profile.meta.result}", color = Theme.faint, fontSize = 11.5.sp)

        if (profile.tags.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(7.dp),
                verticalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                profile.tags.forEach { TagPill(it) }
            }
        }
    }
}

@Composable
private fun HeroAvatar(initial: String, hue: Int) {
    Box(
        Modifier.size(62.dp).clip(CircleShape).background(Theme.hue(hue).gradient)
            .border(2.dp, Theme.hue(hue).accent, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(initial, color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun TagPill(text: String) {
    Box(
        Modifier.clip(RoundedCornerShape(999.dp))
            .background(Theme.blue.copy(alpha = 0.11f))
            .border(1.dp, Theme.blue.copy(alpha = 0.2f), RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Text(text, color = Color(0xFFC6D7FF), fontSize = 11.sp)
    }
}

// MARK: Tabs（原型 .my-prof-tabs）

private val tabItems = listOf(
    "persona" to "动态画像",
    "story" to "我的故事",
    "advice" to "经验与建议",
    "service" to "提供服务",
)

@Composable
private fun Tabs(current: String, onSelect: (String) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        tabItems.forEach { (key, label) ->
            val on = current == key
            Box(
                Modifier.weight(1f)
                    .clip(RoundedCornerShape(999.dp))
                    .background(if (on) Theme.buttonGradient else Brush.linearGradient(listOf(Theme.raised, Theme.raised)))
                    .border(
                        1.dp,
                        if (on) Color(0xFF6FA5FF).copy(alpha = 0.6f) else Theme.line,
                        RoundedCornerShape(999.dp),
                    )
                    .clickableNoRipple { onSelect(key) }
                    .padding(vertical = 9.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    color = if (on) Color.White else Theme.sub,
                    fontSize = 12.sp,
                    fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal,
                )
            }
        }
    }
}

// MARK: 通用小组件

@Composable
private fun SectionHeader(title: String, trailing: String? = null, isLink: Boolean = false, onTrailing: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        if (trailing != null) {
            Text(
                trailing,
                color = if (isLink) Theme.blue else Theme.faint,
                fontSize = 11.sp,
                modifier = if (onTrailing != null) Modifier.clickableNoRipple(onTrailing) else Modifier,
            )
        }
    }
}

private fun Modifier.card(radius: androidx.compose.ui.unit.Dp = Theme.Radius.card): Modifier =
    this.clip(RoundedCornerShape(radius)).background(Theme.card).border(1.dp, Theme.line, RoundedCornerShape(radius))

@Composable
private fun EmptyNote(text: String) {
    Box(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(16.dp)).background(Theme.card).border(1.dp, Theme.line, RoundedCornerShape(16.dp))
            .padding(vertical = 26.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = Theme.faint, fontSize = 12.sp)
    }
}

// MARK: 动态画像 Panel（原型 publicPersonaHTML(isMine)）

@Composable
private fun PersonaPanel(facts: List<app.possibility.android.core.model.ProfileFact>, onSettings: () -> Unit) {
    val all = MyProfileStore.personaItems(facts)
    val items = all.filter { it.hasResult }
    val total = all.size
    val lifeCards = items.firstOrNull { it.key == "life" }?.cards ?: emptyList()

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader("我的动态画像", trailing = "设置展示", isLink = true, onTrailing = onSettings)
        Column(
            Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(Theme.Radius.card)).background(Theme.card)
                .border(1.dp, Theme.line, RoundedCornerShape(Theme.Radius.card))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // 动态形象画布（SYNCED LIVE FORM）
            Box(
                Modifier.fillMaxWidth().height(200.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(Color(0xFF080C1A), Color(0xFF10162B), Color(0xFF080B16)),
                        ),
                    )
                    .border(1.dp, Color(0xFFACC9FF).copy(alpha = 0.12f), RoundedCornerShape(16.dp)),
            ) {
                // 发光的活形态
                Box(
                    Modifier.align(Alignment.Center).size(150.dp).blur(24.dp).clip(CircleShape)
                        .background(
                            Brush.radialGradient(
                                listOf(
                                    Theme.violetSoft.copy(alpha = 0.9f),
                                    Theme.blue.copy(alpha = 0.35f),
                                    Color.Transparent,
                                ),
                            ),
                        ),
                )
                Box(
                    Modifier.align(Alignment.Center).size(96.dp).clip(CircleShape).background(Theme.aurora),
                )
                Box(
                    Modifier.align(Alignment.TopStart).padding(start = 14.dp, top = 13.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(Color(0xFF070B18).copy(alpha = 0.54f))
                        .border(1.dp, Color(0xFFC6DAFF).copy(alpha = 0.18f), RoundedCornerShape(999.dp))
                        .padding(horizontal = 9.dp, vertical = 5.dp),
                ) {
                    Text("SYNCED LIVE FORM", color = Color(0xFFDCE8FF), fontSize = 8.5.sp, letterSpacing = 1.8.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            if (lifeCards.isNotEmpty()) {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Theme.raised).padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(9.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("我的人生底牌", color = Theme.ink, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        Text("已参与数字形象生成", color = Theme.faint, fontSize = 10.sp)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        lifeCards.forEach { card ->
                            Row(
                                Modifier.weight(1f)
                                    .clip(RoundedCornerShape(11.dp))
                                    .background(Theme.hue(0).gradient)
                                    .padding(vertical = 10.dp),
                                horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(card.glyph, color = Color.White, fontSize = 12.sp)
                                Text(card.name, color = Color.White, fontSize = 11.5.sp, fontWeight = FontWeight.Medium, maxLines = 1)
                            }
                        }
                    }
                }
            }

            if (items.isEmpty()) {
                Box(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Theme.raised).padding(vertical = 26.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("目前没有开启公开展示的画像内容", color = Theme.faint, fontSize = 12.sp)
                }
            } else {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(
                        Modifier.weight(1f).height(5.dp).clip(RoundedCornerShape(999.dp)).background(Theme.raised),
                    ) {
                        Box(
                            Modifier.fillMaxWidth(items.size.toFloat() / total.coerceAtLeast(1))
                                .height(5.dp).clip(RoundedCornerShape(999.dp)).background(Theme.aurora),
                        )
                    }
                    Text("${items.size}/$total 已公开", color = Theme.sub, fontSize = 11.sp)
                }

                Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    items.filter { it.key != "life" || it.cards.isEmpty() }.forEach { item ->
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Theme.raised)
                                .padding(horizontal = 13.dp, vertical = 11.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Box(
                                Modifier.size(32.dp).clip(RoundedCornerShape(11.dp))
                                    .background(Color(item.tint or 0xFF000000).copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(item.glyph, fontSize = 14.sp, color = Theme.ink)
                            }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text(item.label, color = Theme.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                Text(item.value, color = Theme.sub, fontSize = 11.sp, maxLines = 1)
                            }
                            Text(
                                if (item.hasResult) "已公开" else "待完善",
                                color = if (item.hasResult) Color(0xFF8EE7C8) else Theme.faint,
                                fontSize = 10.sp,
                            )
                        }
                    }
                }
            }
        }
    }
}

// MARK: 我的故事 Panel

@Composable
private fun StoryPanel(profile: MyProfile, onEdit: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        SectionHeader("我的人生关键轨迹", trailing = "编辑故事", isLink = true, onTrailing = onEdit)
        MeTimeline(profile.traj)

        Box(
            Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(Theme.blue.copy(alpha = 0.08f))
                .border(1.dp, Theme.blue.copy(alpha = 0.24f), RoundedCornerShape(16.dp))
                .padding(16.dp),
        ) {
            Text(
                "“${profile.quote}”",
                color = Color(0xFFC9D8FF),
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                fontStyle = FontStyle.Italic,
                lineHeight = 22.sp,
            )
        }

        Column(
            Modifier.fillMaxWidth().card().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            Text("我的转型故事", color = Theme.ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            Text(profile.meta.intro, color = Theme.sub, fontSize = 12.5.sp, lineHeight = 20.sp)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StoryFact(yearsNumber(profile), "真实实践", Modifier.weight(1f))
            StoryFact("${profile.traj.size}", "关键节点", Modifier.weight(1f))
            StoryFact("${profile.meta.consulted}", "已帮助人数", Modifier.weight(1f))
        }

        Column(
            Modifier.fillMaxWidth().card().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            Text("完整故事 · 最难的一关", color = Theme.ink, fontSize = 13.5.sp, fontWeight = FontWeight.Bold)
            Text(profile.meta.full, color = Theme.sub, fontSize = 12.5.sp, lineHeight = 20.sp)
        }
    }
}

private fun yearsNumber(profile: MyProfile): String {
    val digits = profile.meta.years.filter { it.isDigit() }
    return (digits.ifEmpty { profile.traj.size.toString() }) + " 年"
}

@Composable
private fun StoryFact(value: String, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier.clip(RoundedCornerShape(14.dp)).background(Theme.card)
            .border(1.dp, Theme.line, RoundedCornerShape(14.dp))
            .padding(vertical = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(value, color = Theme.blue, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Text(label, color = Theme.faint, fontSize = 10.5.sp)
    }
}

// MARK: 经验与建议 Panel

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AdvicePanel(profile: MyProfile, onEdit: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader("我愿意分享的经验", trailing = "编辑建议", isLink = true, onTrailing = onEdit)
        if (profile.adviceModules.isEmpty()) {
            EmptyNote("还没有公开经验模块，点击“编辑建议”添加第一条内容")
        } else {
            profile.adviceModules.forEachIndexed { index, module ->
                Column(
                    Modifier.fillMaxWidth().card().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(9.dp),
                ) {
                    Text("经验 ${"%02d".format(index + 1)}", color = Color(0xFF9DBCFF), fontSize = 9.5.sp, letterSpacing = 2.sp, fontWeight = FontWeight.SemiBold)
                    Text(module.title, color = Theme.ink, fontSize = 14.5.sp, fontWeight = FontWeight.Bold)
                    Text(module.content, color = Theme.sub, fontSize = 12.5.sp, lineHeight = 20.sp)
                    if (module.links.isNotEmpty()) {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            module.links.forEach { link ->
                                Box(
                                    Modifier.clip(RoundedCornerShape(999.dp)).background(Theme.blue.copy(alpha = 0.1f))
                                        .padding(horizontal = 10.dp, vertical = 5.dp),
                                ) {
                                    Text("🔗 ${link.label.ifEmpty { "查看相关链接" }}", color = Theme.blue, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// MARK: 提供服务 Panel

@Composable
private fun ServicePanel(profile: MyProfile, onEdit: () -> Unit) {
    val enabled = profile.services.filter { it.enabled }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader("我可以提供的服务", trailing = "编辑服务", isLink = true, onTrailing = onEdit)
        if (enabled.isEmpty()) {
            EmptyNote("暂未公开服务，可以在这里编辑并开启")
        } else {
            enabled.forEach { service ->
                Column(
                    Modifier.fillMaxWidth().card().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(9.dp),
                ) {
                    Row(verticalAlignment = Alignment.Top) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(service.type, color = Color(0xFF9DBCFF), fontSize = 10.sp, letterSpacing = 1.4.sp)
                            Text(service.title, color = Theme.ink, fontSize = 15.5.sp, fontWeight = FontWeight.Bold)
                        }
                        Text("¥${service.price}", color = Theme.blue, fontSize = 19.sp, fontWeight = FontWeight.Black)
                    }
                    Text(service.desc, color = Theme.sub, fontSize = 12.sp, lineHeight = 18.sp)
                }
            }
        }
    }
}

// MARK: 时间轴（原型 .prof-timeline，可展开节点）

@Composable
private fun MeTimeline(nodes: List<MyProfile.TimelineNode>) {
    var openIndex by remember { mutableIntStateOf(0) }
    Column {
        nodes.forEachIndexed { idx, node ->
            val open = openIndex == idx
            Row {
                Column(
                    Modifier.width(15.dp).padding(top = 15.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        Modifier.size(15.dp).clip(CircleShape).background(Theme.auroraDeep)
                            .border(3.dp, Color(0xFF0B0E17), CircleShape),
                    )
                    if (idx != nodes.size - 1) {
                        Box(
                            Modifier.padding(top = 2.dp).width(1.dp).height(if (open) 120.dp else 60.dp)
                                .background(
                                    Brush.verticalGradient(
                                        listOf(Theme.violetSoft, Theme.violetSoft.copy(alpha = 0.08f)),
                                    ),
                                ),
                        )
                    }
                }
                Column(
                    Modifier.padding(start = 15.dp, bottom = 12.dp).weight(1f)
                        .clip(RoundedCornerShape(18.dp)).background(Theme.card)
                        .border(1.dp, Theme.line, RoundedCornerShape(18.dp))
                        .clickableNoRipple { openIndex = if (openIndex == idx) -1 else idx }
                        .padding(15.dp),
                ) {
                    Row {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(node.age, color = Theme.blue, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                            Text(node.t, color = Theme.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        }
                        Text(if (open) "⌄" else "›", color = Theme.faint, fontSize = 15.sp)
                    }
                    if (open) {
                        Text(node.d, color = Theme.sub, fontSize = 12.sp, lineHeight = 17.sp, modifier = Modifier.padding(top = 9.dp))
                    }
                }
            }
        }
    }
}

// MARK: 账号（登录邮箱 / 隐私中心 / 补发验证 / 退出 / 注销）

@Composable
private fun AccountSection(
    accountBusy: Boolean,
    onPrivacy: () -> Unit,
    onResendEmail: () -> Unit,
    onSignOut: () -> Unit,
    onDelete: () -> Unit,
) {
    val email = SupabaseService.shared.emailDisplay ?: "已登录"
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader("账号")
        Column(Modifier.fillMaxWidth().card()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("登录邮箱", color = Theme.sub, fontSize = 13.sp, modifier = Modifier.weight(1f))
                Text(email, color = Color(0xFF8EE7C8), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            }
            RowDivider()
            AccountRow("个人档案与 AI 隐私", Theme.blue, accountBusy, onPrivacy)
            RowDivider()
            AccountRow("重发邮箱验证链接", Theme.sub, accountBusy, onResendEmail)
            RowDivider()
            AccountRow("退出登录", Theme.sub, accountBusy, onSignOut)
            RowDivider()
            AccountRow("注销账号", Theme.orange, accountBusy, onDelete)
        }
    }
}

@Composable
private fun RowDivider() {
    Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
}

@Composable
private fun AccountRow(title: String, tint: Color, busy: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickableNoRipple { if (!busy) onClick() }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, color = tint, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
        if (busy) {
            CircularProgressIndicator(color = Theme.faint, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
        } else {
            Text("›", color = Theme.faint, fontSize = 15.sp)
        }
    }
}
