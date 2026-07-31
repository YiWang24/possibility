package app.possibility.android.features.me

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.model.MyProfile
import app.possibility.android.core.theme.Theme
import java.util.UUID

// MARK: - 我的主页编辑（对应 ios/Possibility/Features/Me/MeEditView.swift · 原型 #myEditPage）
//
// 4 种编辑模式：basic / story / advice / service。
// 编辑基于草稿副本，保存时整体写回 MyProfileStore.update（原型 myEditDraft 语义）。

enum class MeEditMode(
    val title: String,
    val subtitle: String,
    val saveLabel: String,
    val savedToast: String,
) {
    BASIC("编辑基础资料", "只修改主页名片上的公开信息", "保存基础资料", "已保存基础资料"),
    STORY("编辑我的故事", "修改故事内容和人生时间线", "保存故事", "已保存故事"),
    ADVICE("编辑经验与建议", "自由组合标题、内容与链接", "保存建议", "已保存建议"),
    SERVICE("编辑提供服务", "设置服务内容、价格和公开状态", "保存服务", "已保存服务"),
}

@Composable
fun MeEditSheet(mode: MeEditMode, onDismiss: () -> Unit) {
    val base = remember { MyProfileStore.profile.value }

    // 草稿副本（整体保存）
    var hue by remember { mutableIntStateOf(base.hue) }
    var name by remember { mutableStateOf(base.name) }
    var ageText by remember { mutableStateOf(base.meta.age.toString()) }
    var city by remember { mutableStateOf(base.meta.city) }
    var fromRole by remember { mutableStateOf(base.meta.from) }
    var toRole by remember { mutableStateOf(base.meta.to) }
    var years by remember { mutableStateOf(base.meta.years) }
    var result by remember { mutableStateOf(base.meta.result) }
    var tagsText by remember { mutableStateOf(base.tags.joinToString("，")) }
    var quote by remember { mutableStateOf(base.quote) }
    var intro by remember { mutableStateOf(base.meta.intro) }
    var full by remember { mutableStateOf(base.meta.full) }

    val traj = remember { mutableStateListOf<MyProfile.TimelineNode>().apply { addAll(base.traj) } }
    val modules = remember { mutableStateListOf<MyProfile.AdviceModule>().apply { addAll(base.adviceModules) } }
    val services = remember { mutableStateListOf<MyProfile.ServiceOffer>().apply { addAll(base.services) } }

    BackHandler { onDismiss() }

    fun save() {
        val parsedTags = tagsText
            .split('，', ',', ' ', '、')
            .map { it.trim() }
            .filter { it.isNotEmpty() }
        val cleanTraj = if (mode == MeEditMode.STORY) {
            traj.filter { it.t.trim().isNotEmpty() }
        } else {
            traj.toList()
        }
        val updated = base.copy(
            name = name,
            hue = hue,
            quote = quote,
            tags = parsedTags,
            traj = cleanTraj,
            adviceModules = modules.toList(),
            services = services.toList(),
            meta = base.meta.copy(
                age = ageText.toIntOrNull() ?: base.meta.age,
                city = city,
                from = fromRole,
                to = toRole,
                years = years,
                result = result,
                intro = intro,
                full = full,
            ),
        )
        MyProfileStore.update(updated)
        ToastCenter.show(mode.savedToast)
        onDismiss()
    }

    Box(Modifier.fillMaxSize().background(Theme.paper)) {
        Column(Modifier.fillMaxSize().systemBarsPadding()) {
            // 顶栏
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 14.dp, bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier.size(34.dp).clip(CircleShape).background(Theme.raised)
                        .clickableNoRipple(onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.KeyboardArrowLeft, contentDescription = "返回", tint = Theme.ink, modifier = Modifier.size(22.dp))
                }
                Spacer(Modifier.width(12.dp))
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(mode.title, color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Text(mode.subtitle, color = Theme.faint, fontSize = 10.5.sp)
                }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))

            // 内容
            Column(
                Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())
                    .padding(horizontal = 22.dp).padding(top = 16.dp, bottom = 30.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                when (mode) {
                    MeEditMode.BASIC -> BasicEditor(
                        hue = hue, onHue = { hue = it },
                        name = name, onName = { name = it },
                        ageText = ageText, onAge = { ageText = it },
                        city = city, onCity = { city = it },
                        fromRole = fromRole, onFrom = { fromRole = it },
                        toRole = toRole, onTo = { toRole = it },
                        years = years, onYears = { years = it },
                        result = result, onResult = { result = it },
                        tagsText = tagsText, onTags = { tagsText = it },
                    )
                    MeEditMode.STORY -> StoryEditor(
                        quote = quote, onQuote = { quote = it },
                        intro = intro, onIntro = { intro = it },
                        full = full, onFull = { full = it },
                        traj = traj,
                    )
                    MeEditMode.ADVICE -> AdviceEditor(modules)
                    MeEditMode.SERVICE -> ServiceEditor(services)
                }
            }

            // 保存栏
            Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
            Box(
                Modifier.fillMaxWidth().background(Theme.paper)
                    .padding(horizontal = 20.dp).padding(top = 12.dp, bottom = 14.dp),
            ) {
                Box(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(999.dp))
                        .background(Theme.buttonGradient)
                        .clickableNoRipple { save() }
                        .padding(vertical = 15.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(mode.saveLabel, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

// MARK: 基础资料

@Composable
private fun BasicEditor(
    hue: Int, onHue: (Int) -> Unit,
    name: String, onName: (String) -> Unit,
    ageText: String, onAge: (String) -> Unit,
    city: String, onCity: (String) -> Unit,
    fromRole: String, onFrom: (String) -> Unit,
    toRole: String, onTo: (String) -> Unit,
    years: String, onYears: (String) -> Unit,
    result: String, onResult: (String) -> Unit,
    tagsText: String, onTags: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        SectionTitle("头像色彩", "点击切换主页配色")
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            (0..4).forEach { h ->
                Box(
                    Modifier.size(44.dp).clip(CircleShape).background(Theme.hue(h).gradient)
                        .then(
                            if (hue == h) Modifier.border(2.dp, Color.White, CircleShape) else Modifier,
                        )
                        .clickableNoRipple { onHue(h) },
                )
            }
        }

        SectionTitle("基础信息", "显示在主页名片")
        Field("昵称", name, onValueChange = onName)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.weight(1f)) { Field("年龄", ageText, onValueChange = onAge) }
            Box(Modifier.weight(1f)) { Field("所在城市", city, onValueChange = onCity) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.weight(1f)) { Field("过去身份", fromRole, onValueChange = onFrom) }
            Box(Modifier.weight(1f)) { Field("现在身份", toRole, onValueChange = onTo) }
        }
        Field("当前阶段", years, onValueChange = onYears)
        Field("目前状态", result, onValueChange = onResult)
        Field("主页标签（用逗号分隔）", tagsText, onValueChange = onTags)
    }
}

// MARK: 我的故事

@Composable
private fun StoryEditor(
    quote: String, onQuote: (String) -> Unit,
    intro: String, onIntro: (String) -> Unit,
    full: String, onFull: (String) -> Unit,
    traj: androidx.compose.runtime.snapshots.SnapshotStateList<MyProfile.TimelineNode>,
) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        SectionTitle("我的故事", "公开叙事")
        Field("故事题记", quote, singleLine = false, onValueChange = onQuote)
        Field("故事摘要", intro, singleLine = false, onValueChange = onIntro)
        Field("完整故事", full, singleLine = false, onValueChange = onFull)

        SectionTitle("故事时间线", "可增删节点")
        traj.forEachIndexed { index, node ->
            EditorCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.width(110.dp)) {
                        Field("年龄", node.age) { traj[index] = traj[index].copy(age = it) }
                    }
                    Spacer(Modifier.weight(1f))
                    Text(
                        "删除",
                        color = Color(0xFFFF8A8A),
                        fontSize = 11.5.sp,
                        modifier = Modifier.clickableNoRipple { traj.removeAt(index) },
                    )
                }
                Field("节点标题", node.t) { traj[index] = traj[index].copy(t = it) }
                Field("节点描述", node.d, singleLine = false) { traj[index] = traj[index].copy(d = it) }
            }
        }
        Text(
            "＋ 添加一个人生节点",
            color = Theme.blue,
            fontSize = 12.5.sp,
            modifier = Modifier.clickableNoRipple { traj.add(MyProfile.TimelineNode(age = "", t = "", d = "")) },
        )
    }
}

// MARK: 经验与建议

@Composable
private fun AdviceEditor(
    modules: androidx.compose.runtime.snapshots.SnapshotStateList<MyProfile.AdviceModule>,
) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        SectionTitle("经验与建议模块", "标题、正文与链接")
        modules.forEachIndexed { index, module ->
            EditorCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("模块", color = Theme.faint, fontSize = 10.5.sp)
                    Spacer(Modifier.weight(1f))
                    Text(
                        "删除",
                        color = Color(0xFFFF8A8A),
                        fontSize = 11.5.sp,
                        modifier = Modifier.clickableNoRipple { modules.removeAt(index) },
                    )
                }
                Field("标题", module.title) { modules[index] = modules[index].copy(title = it) }
                Field("内容（每行一条）", module.content, singleLine = false) {
                    modules[index] = modules[index].copy(content = it)
                }
                module.links.forEachIndexed { li, link ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.weight(1f)) {
                            Field("链接标题", link.label) {
                                val newLinks = modules[index].links.toMutableList()
                                newLinks[li] = newLinks[li].copy(label = it)
                                modules[index] = modules[index].copy(links = newLinks)
                            }
                        }
                        Box(Modifier.weight(1f)) {
                            Field("URL", link.url) {
                                val newLinks = modules[index].links.toMutableList()
                                newLinks[li] = newLinks[li].copy(url = it)
                                modules[index] = modules[index].copy(links = newLinks)
                            }
                        }
                    }
                }
                Text(
                    "＋ 添加链接",
                    color = Theme.blue,
                    fontSize = 11.5.sp,
                    modifier = Modifier.clickableNoRipple {
                        val newLinks = modules[index].links.toMutableList()
                        newLinks.add(MyProfile.AdviceModule.Link(label = "", url = ""))
                        modules[index] = modules[index].copy(links = newLinks)
                    },
                )
            }
        }
        Text(
            "＋ 新增经验模块",
            color = Theme.blue,
            fontSize = 12.5.sp,
            modifier = Modifier.clickableNoRipple {
                modules.add(
                    MyProfile.AdviceModule(id = UUID.randomUUID().toString(), title = "", content = "", links = emptyList()),
                )
            },
        )
        Text("每个模块都可以独立增删；链接保存后可直接访问。", color = Theme.faint, fontSize = 10.5.sp)
    }
}

// MARK: 提供服务

@Composable
private fun ServiceEditor(
    services: androidx.compose.runtime.snapshots.SnapshotStateList<MyProfile.ServiceOffer>,
) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        SectionTitle("提供服务", "可自定义与开关")
        services.forEachIndexed { index, service ->
            EditorCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(service.type, color = Theme.ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Switch(
                        checked = service.enabled,
                        onCheckedChange = { services[index] = services[index].copy(enabled = it) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = Theme.blue,
                            uncheckedThumbColor = Theme.sub,
                            uncheckedTrackColor = Theme.raised,
                            uncheckedBorderColor = Theme.line,
                        ),
                    )
                }
                Field("服务标题", service.title) { services[index] = services[index].copy(title = it) }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.width(120.dp)) {
                        Field("价格 ¥", service.price) { services[index] = services[index].copy(price = it) }
                    }
                    Box(Modifier.weight(1f)) {
                        Field("类型", service.type) { services[index] = services[index].copy(type = it) }
                    }
                }
                Field("服务说明", service.desc, singleLine = false) { services[index] = services[index].copy(desc = it) }
            }
        }
    }
}

// MARK: 通用输入

@Composable
private fun Field(
    label: String,
    value: String,
    singleLine: Boolean = true,
    onValueChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, color = Theme.faint, fontSize = 10.5.sp)
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(color = Theme.ink, fontSize = 13.5.sp),
            cursorBrush = SolidColor(Theme.blue),
            singleLine = singleLine,
            minLines = if (singleLine) 1 else 3,
            maxLines = if (singleLine) 1 else 6,
            modifier = Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Theme.raised)
                .border(1.dp, Theme.line, RoundedCornerShape(12.dp))
                .padding(horizontal = 12.dp, vertical = 10.dp),
        )
    }
}

@Composable
private fun SectionTitle(title: String, note: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = Theme.ink, fontSize = 13.5.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        Text(note, color = Theme.faint, fontSize = 10.5.sp)
    }
}

@Composable
private fun EditorCard(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Theme.card)
            .border(1.dp, Theme.line, RoundedCornerShape(14.dp))
            .padding(13.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp),
        content = content,
    )
}
