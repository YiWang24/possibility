package app.possibility.android.features.home

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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.theme.Theme
import app.possibility.android.features.studio.AssessmentKind

// MARK: - 动态画像维度浮层（0.82 高度）—— 对应 ios/Possibility/Features/Home/DimensionSheet.swift
//
// 展示已保存事实 + 关键词批次（换一批）+ 自定义关键词 + 小工具入口；保存回填画像、可发起测评。

private fun dc(rgb: Long, alpha: Float = 1f): Color = Color(0xFF000000L or rgb).copy(alpha = alpha)

/**
 * 画像维度浮层。
 * @param dimension 软维度键。
 * @param initialSelected 已保存的关键词（回显）。
 * @param onSave 保存关键词到画像。
 * @param onStartAssessment 发起对应测评。
 * @param onDismiss 关闭浮层。
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DimensionSheet(
    dimension: DimensionKey,
    initialSelected: List<String> = emptyList(),
    onSave: (List<String>) -> Unit,
    onStartAssessment: (AssessmentKind) -> Unit,
    onStartSelfDiscovery: () -> Unit,
    onDismiss: () -> Unit,
) {
    val cfg = remember(dimension) { DimensionData.config(dimension) }
    val uriHandler = LocalUriHandler.current

    var batch by remember { mutableStateOf(0) }
    val selected = remember { mutableStateListOf<String>().apply { addAll(initialSelected) } }
    val custom = remember { mutableStateListOf<String>() }
    var showCustomInput by remember { mutableStateOf(false) }
    var customText by remember { mutableStateOf("") }

    fun addCustom() {
        val w = customText.trim()
        if (w.isEmpty() || custom.contains(w) || selected.contains(w)) { customText = ""; return }
        custom.add(w)
        customText = ""
    }

    fun save() {
        val keywords = (selected + custom).take(5)
        if (keywords.isEmpty()) return
        onSave(keywords)
        ToastCenter.show("已保存到你的画像")
        onDismiss()
    }

    // 展示序：已选(不在当前批) + 当前批 + 自定义，去重
    val batchWords = cfg.batches[batch]
    val chipWords = remember(batch, selected.toList(), custom.toList()) {
        val seen = HashSet<String>()
        val out = mutableListOf<Pair<String, Boolean>>()
        for (w in selected.filter { it !in batchWords } + batchWords) {
            if (seen.add(w)) out.add(w to false)
        }
        for (w in custom) if (seen.add(w)) out.add(w to true)
        out
    }

    // 全屏 scrim + 底部 0.82 高度浮层
    Box(Modifier.fillMaxSize()) {
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.5f))
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onDismiss,
                ),
        )
        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .fillMaxHeight(0.82f)
                .clip(RoundedCornerShape(topStart = Theme.Radius.sheet, topEnd = Theme.Radius.sheet))
                .background(dc(0x10131C))
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = {},
                ),
        ) {
            // 抓手
            Box(
                Modifier
                    .padding(top = 10.dp)
                    .align(Alignment.CenterHorizontally)
                    .width(38.dp)
                    .height(4.dp)
                    .clip(CircleShape)
                    .background(Theme.faint.copy(alpha = 0.5f)),
            )
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp)
                    .padding(top = 16.dp, bottom = 40.dp),
            ) {
                Text(cfg.title, color = Theme.ink, fontSize = 19.sp, fontWeight = FontWeight.Bold)

                // 01 问题 + 换一批
                Row(
                    Modifier.fillMaxWidth().padding(top = 20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("01 ", color = Theme.blue, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text(cfg.question, color = Theme.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Text(
                        "换一批 ↻", color = Theme.blue, fontSize = 12.sp,
                        modifier = Modifier.clickable { batch = (batch + 1) % cfg.batches.size },
                    )
                }

                // 关键词云
                FlowRow(
                    Modifier.padding(top = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    chipWords.forEach { (word, isCustom) ->
                        val on = isCustom || selected.contains(word)
                        val bg = when {
                            !on -> Theme.raised
                            isCustom -> dc(0x2FA98C)
                            else -> Theme.blueDeep
                        }
                        val bd = when {
                            !on -> Theme.line
                            isCustom -> dc(0x3ED9A4, 0.6f)
                            else -> dc(0x6FA5FF, 0.6f)
                        }
                        Box(
                            Modifier
                                .clip(CircleShape)
                                .background(bg)
                                .border(1.dp, bd, CircleShape)
                                .clickable {
                                    if (isCustom) custom.remove(word)
                                    else if (selected.contains(word)) selected.remove(word)
                                    else selected.add(word)
                                }
                                .padding(horizontal = 15.dp, vertical = 8.dp),
                        ) {
                            Text(
                                word,
                                color = if (on) Color.White else Theme.sub,
                                fontSize = 12.5.sp,
                                fontWeight = if (on) FontWeight.Medium else FontWeight.Normal,
                            )
                        }
                    }
                }

                // 来源图例
                Row(
                    Modifier.padding(top = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    LegendItem(Theme.blueDeep, "系统推荐")
                    LegendItem(dc(0x2FA98C), "我添加的")
                }

                // 自定义关键词
                Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "＋ 自己输入一个关键词", color = Theme.blue, fontSize = 12.5.sp,
                        modifier = Modifier.clickable { showCustomInput = !showCustomInput },
                    )
                    if (showCustomInput) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                Modifier
                                    .weight(1f)
                                    .clip(CircleShape)
                                    .background(Theme.raised)
                                    .border(1.dp, Theme.line, CircleShape)
                                    .padding(horizontal = 14.dp, vertical = 10.dp),
                            ) {
                                if (customText.isEmpty()) {
                                    Text("输入一个最像你的词", color = Theme.faint, fontSize = 13.sp)
                                }
                                BasicTextField(
                                    value = customText,
                                    onValueChange = { customText = it },
                                    singleLine = true,
                                    textStyle = TextStyle(color = Theme.ink, fontSize = 13.sp),
                                    cursorBrush = SolidColor(Theme.blue),
                                )
                            }
                            Box(
                                Modifier
                                    .clip(CircleShape)
                                    .background(Theme.buttonGradient)
                                    .clickable { addCustom() }
                                    .padding(horizontal = 16.dp, vertical = 10.dp),
                            ) {
                                Text("添加", color = Color.White, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }

                // 02 小工具
                Row(Modifier.padding(top = 22.dp)) {
                    Text("02 ", color = Theme.blue, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text("或者，用小工具继续探索", color = Theme.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }

                Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
                    cfg.tools.forEach { tool ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(dc(tool.tint))
                                .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(18.dp))
                                .clickable {
                                    when {
                                        tool.selfDiscovery -> onStartSelfDiscovery()
                                        tool.externalUrl != null -> uriHandler.openUri(tool.externalUrl)
                                        tool.assessment != null -> onStartAssessment(tool.assessment)
                                        tool.cardGame != null -> ToastCenter.show("「${tool.name}」请在人生卡牌入口开始")
                                        else -> ToastCenter.show("「${tool.name}」即将上线")
                                    }
                                }
                                .padding(horizontal = 15.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text(tool.name, color = Theme.ink, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
                                    if (tool.externalUrl != null) {
                                        Text("官方 ↗", color = dc(0x9DBCFF), fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
                                    }
                                }
                                Text(tool.desc, color = Theme.sub, fontSize = 11.sp, lineHeight = 15.sp)
                                if (tool.provider != null && tool.access != null) {
                                    Text("${tool.provider} · ${tool.access}", color = Theme.faint, fontSize = 9.5.sp)
                                }
                            }
                            Spacer(Modifier.width(10.dp))
                            Box(
                                Modifier
                                    .clip(CircleShape)
                                    .background(Color.White.copy(alpha = 0.08f))
                                    .padding(horizontal = 9.dp, vertical = 3.dp),
                            ) {
                                Text(tool.duration, color = dc(0x9DBCFF), fontSize = 10.5.sp)
                            }
                        }
                    }
                }

                // 保存
                val canSave = selected.isNotEmpty() || custom.isNotEmpty()
                Box(
                    Modifier
                        .padding(top = 22.dp)
                        .fillMaxWidth()
                        .clip(CircleShape)
                        .background(Theme.buttonGradient)
                        .then(if (canSave) Modifier.clickable { save() } else Modifier)
                        .padding(vertical = 15.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "保存到我的画像",
                        color = Color.White.copy(alpha = if (canSave) 1f else 0.4f),
                        fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}

@Composable
private fun LegendItem(color: Color, text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(color))
        Text(text, color = Theme.faint, fontSize = 11.sp)
    }
}
