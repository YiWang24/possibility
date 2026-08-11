package app.possibility.android.features.studio

import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.network.SupabaseService
import app.possibility.android.core.theme.Theme
import kotlinx.coroutines.launch

// MARK: - 画像工坊（迁移自 iOS ProfileStudioView.swift · 原型 #profileStudio）
//
// 大五主卡（进入 / 继续 n/120 / 查看结果）· 生活画像五维网格 · MBTI 面板 · 来源图例。
// 网格卡点击进入对应 AssessmentFlowSheet；深色主题严格用 Theme token。

/** 生活画像网格项定义（对齐 iOS gridSpecs）。 */
private data class GridSpec(
    val id: String,
    val mark: String,
    val markColor: Long,
    val markBg: Long,
    val title: String,
    val fallback: String,
    /** 未填时参考的测评（进度 / 已完成状态）；null 表示暂无测评 */
    val assessment: AssessmentKind?,
)

private val gridSpecs = listOf(
    GridSpec("skill", "✦", 0xBFD2FF, 0x5E96FF, "我擅长", "选择关键词、换一批，也可以自己输入", AssessmentKind.STRENGTH),
    GridSpec("like", "♡", 0xF4BDE0, 0xE35CC1, "我喜欢", "可用关键词或霍兰德兴趣测评继续探索", AssessmentKind.HOLLAND),
    GridSpec("love", "✿", 0xFFB69E, 0xFF7A4D, "我在恋爱关系中在意", "关键词、关系测评与婚姻卡牌", AssessmentKind.LOVE),
    GridSpec("family", "⌂", 0x8EE7C8, 0x3ED9A4, "我在家庭关系中在意", "关键词、家庭关系测评与家庭卡牌", AssessmentKind.FAMILY),
    GridSpec("social", "◎", 0xBFD2FF, 0x5E96FF, "我在人际交往中在意", "关键词、人际需要测评与人际交往卡牌", AssessmentKind.SOCIAL),
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProfileStudioSheet(onDismiss: () -> Unit) {
    val context = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()

    var cover by remember { mutableStateOf<AssessmentKind?>(null) }
    var mbtiOpen by remember { mutableStateOf(false) }
    var mbti by remember { mutableStateOf(MBTIStore.current(context)) }
    // 测评浮层关闭后自增触发卡片状态刷新
    var tick by remember { mutableIntStateOf(0) }

    BackHandler(enabled = cover == null) { onDismiss() }

    Box(Modifier.fillMaxSize().background(Theme.paper)) {
        Column(Modifier.fillMaxSize().systemBarsPadding()) {
            // 顶栏
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 14.dp, bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier.size(34.dp).clip(CircleShape).background(Theme.raised).clickable(onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.KeyboardArrowLeft, contentDescription = "返回", tint = Theme.ink, modifier = Modifier.size(22.dp))
                }
                Spacer(Modifier.width(12.dp))
                Text("画像工坊", color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))

            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 22.dp)
                    .padding(top = 16.dp, bottom = 36.dp),
                verticalArrangement = Arrangement.spacedBy(22.dp),
            ) {
                Section("人格底色") {
                    BigFiveCard(context, tick) { cover = AssessmentKind.BIGFIVE }
                }
                Section("生活画像") {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        gridSpecs.forEach { spec ->
                            GridCard(spec, context, tick) {
                                if (spec.assessment != null) {
                                    cover = spec.assessment
                                } else {
                                    ToastCenter.show("该维度可在首页用关键词与卡牌完善")
                                }
                            }
                        }
                    }
                }
                Section("MBTI") {
                    MbtiPanel(
                        mbti = mbti,
                        open = mbtiOpen,
                        onToggle = { mbtiOpen = !mbtiOpen },
                        onSelect = { type ->
                            MBTIStore.save(context, type)
                            mbti = type
                            scope.launch {
                                val bigfive = AssessmentModel(AssessmentKind.BIGFIVE, context)
                                val text = if (bigfive.result != null) {
                                    "大五：" + bigfive.resultTags.take(3).joinToString(" · ") + " · MBTI：$type"
                                } else {
                                    "MBTI：$type"
                                }
                                runCatching {
                                    SupabaseService.shared.saveDimensionRemote(
                                        dimension = "personality",
                                        tags = listOf(text),
                                        source = "manual",
                                    )
                                }
                            }
                            ToastCenter.show("已添加 MBTI：$type")
                        },
                    )
                }
                SourceKey()
            }
        }

        // 统一测评浮层（覆盖工坊）；关闭后刷新卡片状态
        cover?.let { kind ->
            AssessmentFlowSheet(kind = kind) {
                cover = null
                tick += 1
            }
        }
    }
}

// MARK: 通用块

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(11.dp)) {
        Text(title, color = Theme.ink, fontSize = 14.5.sp, fontWeight = FontWeight.Bold)
        content()
    }
}

// MARK: 大五主卡

@Composable
private fun BigFiveCard(context: Context, @Suppress("UNUSED_PARAMETER") tick: Int, onEnter: () -> Unit) {
    // tick 作为变化的入参强制重组，从而在测评浮层关闭后重新读取快照
    val snap = AssessmentModel.snapshot(context, AssessmentKind.BIGFIVE)
    val (meta, action) = when {
        snap.result != null -> {
            val model = AssessmentModel(AssessmentKind.BIGFIVE, context)
            "已完成 · ${model.resultTags.take(2).joinToString(" · ")}" to "查看结果"
        }
        snap.answered > 0 -> "已完成 ${snap.answered}/${snap.total} · 进度自动保存" to "继续 ${snap.answered}/${snap.total}"
        else -> "120题，从五个主要维度和三十个细分面向理解你的稳定倾向。" to "进入测试"
    }
    val shape = RoundedCornerShape(20.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Brush.linearGradient(listOf(hexColor(0x1B1A38), hexColor(0x211A45), hexColor(0x141329))))
            .border(1.dp, hexColor(0x8F7BFF, 0.3f), shape)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("SCIENTIFIC BASELINE", color = hexColor(0xB6A8FF), fontSize = 9.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.2.sp)
        Text("大五人格", color = Theme.ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text(meta, color = Theme.sub, fontSize = 12.sp, lineHeight = 16.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            listOf("120 题", "约 15–20 分钟", "默认私密").forEach { m ->
                Box(
                    Modifier.clip(CircleShape).background(Color.White.copy(alpha = 0.07f)).padding(horizontal = 10.dp, vertical = 4.dp),
                ) {
                    Text(m, color = Theme.sub, fontSize = 10.5.sp)
                }
            }
        }
        Box(
            Modifier
                .fillMaxWidth()
                .padding(top = 4.dp)
                .clip(CircleShape)
                .background(Theme.buttonGradient)
                .clickable(onClick = onEnter)
                .padding(vertical = 12.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(action, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

// MARK: 生活画像网格

@Composable
private fun GridCard(spec: GridSpec, context: Context, @Suppress("UNUSED_PARAMETER") tick: Int, onTap: () -> Unit) {
    var meta = spec.fallback
    var action = "进入"
    var progress: Float? = null
    if (spec.assessment != null) {
        val snap = AssessmentModel.snapshot(context, spec.assessment)
        val result = snap.result
        if (result != null) {
            if (spec.assessment == AssessmentKind.HOLLAND) {
                meta = "已完成 · ${result.displayCode ?: result.code ?: ""} 兴趣组合"
                action = "查看画像"
            } else {
                meta = "测评已完成 · 可写入画像"
                action = "进入"
            }
        } else if (snap.answered > 0) {
            val name = if (spec.assessment == AssessmentKind.HOLLAND) "霍兰德测评" else "测评"
            meta = "${name}已完成 ${snap.answered}/${snap.total} · 进度自动保存"
            action = "继续"
            progress = snap.answered.toFloat() / snap.total
        }
    }
    val shape = RoundedCornerShape(16.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Theme.card)
            .border(1.dp, Theme.line, shape)
            .clickable(onClick = onTap)
            .padding(horizontal = 14.dp, vertical = 13.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(
                Modifier.size(34.dp).clip(RoundedCornerShape(11.dp)).background(hexColor(spec.markBg, 0.15f)),
                contentAlignment = Alignment.Center,
            ) {
                Text(spec.mark, color = hexColor(spec.markColor), fontSize = 15.sp)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(spec.title, color = Theme.ink, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
                Text(meta, color = Theme.sub, fontSize = 11.sp, maxLines = 1)
            }
            Box(
                Modifier
                    .clip(CircleShape)
                    .background(hexColor(0x5E96FF, 0.14f))
                    .border(1.dp, hexColor(0x5E96FF, 0.4f), CircleShape)
                    .padding(horizontal = 13.dp, vertical = 6.dp),
            ) {
                Text(action, color = hexColor(0x9DBCFF), fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        progress?.let { p ->
            Box(Modifier.padding(top = 10.dp).fillMaxWidth().height(3.dp).clip(CircleShape).background(Theme.raised)) {
                Box(Modifier.fillMaxHeight().fillMaxWidth(p.coerceIn(0f, 1f)).clip(CircleShape).background(Theme.aurora))
            }
        }
    }
}

// MARK: MBTI 面板

@Composable
private fun MbtiPanel(
    mbti: String?,
    open: Boolean,
    onToggle: () -> Unit,
    onSelect: (String) -> Unit,
) {
    val shape = RoundedCornerShape(18.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Theme.card)
            .border(1.dp, Theme.line, shape)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("MBTI：", color = Theme.ink, fontSize = 13.5.sp, fontWeight = FontWeight.Bold)
            Text(
                mbti ?: "未设置",
                color = if (mbti == null) Theme.faint else Theme.blue,
                fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold,
            )
        }
        Text(
            if (open) "收起 ↑" else "选择或修改类型 ↓",
            color = Theme.blue, fontSize = 12.sp, modifier = Modifier.clickable(onClick = onToggle),
        )
        AnimatedVisibility(visible = open) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                AssessmentData.mbtiTypes.chunked(4).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { type ->
                            val on = mbti == type
                            val cellShape = RoundedCornerShape(10.dp)
                            val base = Modifier.weight(1f).clip(cellShape)
                            val filled = if (on) base.background(Theme.buttonGradient) else base.background(Theme.raised)
                            Box(
                                filled
                                    .border(1.dp, if (on) hexColor(0x6FA5FF, 0.7f) else Theme.line, cellShape)
                                    .clickable { onSelect(type) }
                                    .padding(vertical = 9.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    type,
                                    color = if (on) Color.White else Theme.sub,
                                    fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// MARK: 来源图例

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SourceKey() {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        legendPairs.forEach { (color, text) ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Box(Modifier.size(7.dp).clip(CircleShape).background(hexColor(color)))
                Text(text, color = Theme.faint, fontSize = 10.5.sp)
            }
        }
    }
}

private val legendPairs = listOf(
    0x5968D9L to "正式量表",
    0xA85586L to "主题探索",
    0xB77928L to "人生卡牌",
    0x258579L to "自己填写",
    0x60758AL to "日记推断",
)
