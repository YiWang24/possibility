package app.possibility.android.features.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.possibility.android.core.model.Traveler
import app.possibility.android.core.theme.Theme
import app.possibility.android.features.profile.clickableNoRipple

// 探索总结页（原型 chatSummaryPage）—— 对应 ios/Possibility/Features/Chat/ChatSummaryView.swift。
// 完整总结：hero + 四张洞察卡（真正想解决的 / 两股拉力 / 已经比较清楚的 / 下一步小验证）
// + 下一步面板 + 「完成本次探索」主按钮。

/**
 * 本次探索总结全屏页。
 * @param onOpenTraveler 点击匹配旅人卡打开旅人主页
 * @param onFinish 完成本次探索（关总结 + 关对话）
 * @param onDismiss 仅关闭总结页返回对话
 */
@Composable
fun ChatSummarySheet(
    model: ChatModel,
    onGoLab: () -> Unit,
    onGoSimilar: () -> Unit,
    onOpenTraveler: (Traveler) -> Unit,
    onFinish: () -> Unit,
    onDismiss: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Theme.paper)) {
            Column(Modifier.fillMaxSize()) {
                // 顶栏
                Row(
                    Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 22.dp)
                        .padding(top = 16.dp, bottom = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    SummaryBackButton(onDismiss)
                    Spacer(Modifier.width(13.dp))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("本次探索总结", color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
                        Text("不是定论，是此刻更清楚的你", color = Theme.faint, fontSize = 11.sp)
                    }
                }

                LazyColumn(
                    Modifier.fillMaxWidth().weight(1f),
                    contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item { Hero(model) }
                    item {
                        SummaryCard(
                            eyebrow = "你真正想解决的",
                            title = "不是选出标准答案，而是确认什么值得你承担代价",
                            body = "你的犹豫并不等于没有方向。它提醒你：愿望与代价需要被分开看见。",
                        )
                    }
                    item {
                        SummaryCard(
                            eyebrow = "此刻的两股拉力",
                            title = "想靠近的，和想保护的",
                            body = "一边是「${answer(model, 0, "你真正想靠近的生活")}」；另一边是「${answer(model, 1, "你暂时还不能轻易放下的部分")}」。两边都是真的，不必把其中一边解释成软弱。",
                            accent = Color(0xFFA97DFF).copy(alpha = 0.25f),
                        )
                    }
                    item {
                        SummaryCard(
                            eyebrow = "已经比较清楚的",
                            title = "你的原话比标签更重要",
                            body = model.answers.lastOrNull() ?: "你愿意先理解自己的真实需要，再做决定。",
                        )
                    }
                    item {
                        SummaryCard(
                            eyebrow = "下一步的小验证",
                            title = "先收集一个真实证据",
                            body = "未来 7 天，做一次成本很低、可以撤回的小尝试。记录行动前后的期待、精力和抗拒，再判断你是“不想要”，还是“暂时承担不起”。",
                            accent = Theme.teal.copy(alpha = 0.25f),
                        )
                    }
                    item {
                        Box(Modifier.padding(top = 2.dp)) {
                            ChatNextPanel(
                                showSummaryLink = false,
                                preferredPath = model.recommendedNextStep,
                                matchedTravelers = model.matchedTravelers,
                                matchReasons = model.matchReasons,
                                onGoLab = onGoLab,
                                onGoSimilar = onGoSimilar,
                                shareText = model.shareText,
                                onOpenTraveler = onOpenTraveler,
                            )
                        }
                    }
                }

                // 完成本次探索
                Box(
                    Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .padding(horizontal = 20.dp)
                        .padding(top = 10.dp, bottom = 12.dp)
                        .background(Theme.buttonGradient, RoundedCornerShape(16.dp))
                        .clickableNoRipple(onFinish)
                        .padding(vertical = 15.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("完成本次探索", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

private fun answer(model: ChatModel, index: Int, fallback: String): String =
    model.answers.getOrNull(index) ?: fallback

@Composable
private fun SummaryBackButton(onClick: () -> Unit) {
    Box(
        Modifier
            .size(36.dp)
            .background(Theme.raised, CircleShape)
            .border(1.dp, Theme.line, CircleShape)
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text("‹", color = Theme.ink, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun Hero(model: ChatModel) {
    val shape = RoundedCornerShape(24.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .background(
                Brush.linearGradient(
                    listOf(Color(0xFF4065CB).copy(alpha = 0.24f), Color(0xFF7149AA).copy(alpha = 0.12f)),
                ),
                shape,
            )
            .border(1.dp, Color(0xFF6FA5FF).copy(alpha = 0.25f), shape)
            .padding(22.dp),
    ) {
        Text(
            "${model.displayTopic ?: "此刻的选择"} · EXPLORATION NOTE",
            color = Color(0xFF91B1FF),
            fontSize = 10.sp,
            letterSpacing = 2.sp,
        )
        Text(
            model.displayQuestion,
            color = Theme.ink,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            lineHeight = 30.sp,
            modifier = Modifier.padding(top = 10.dp),
        )
        Text(
            "这份总结来自刚才的对话，只记录你此刻认可的理解，不替你下结论。",
            color = Theme.sub,
            fontSize = 12.sp,
            lineHeight = 18.sp,
            modifier = Modifier.padding(top = 9.dp),
        )
    }
}

@Composable
private fun SummaryCard(eyebrow: String, title: String, body: String, accent: Color? = null) {
    val shape = RoundedCornerShape(20.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .background(Theme.card, shape)
            .border(1.dp, accent ?: Theme.line, shape)
            .padding(18.dp),
    ) {
        Text(eyebrow, color = Color(0xFF91B1FF), fontSize = 10.sp, letterSpacing = 1.8.sp)
        Text(
            title,
            color = Theme.ink,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            lineHeight = 21.sp,
            modifier = Modifier.padding(top = 8.dp),
        )
        Text(
            body,
            color = Color(0xFFC6CDDE),
            fontSize = 13.sp,
            lineHeight = 21.sp,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}
