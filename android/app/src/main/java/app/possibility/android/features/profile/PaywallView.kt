package app.possibility.android.features.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.AppConfig
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.model.Traveler
import app.possibility.android.core.network.SupabaseService
import app.possibility.android.core.theme.Theme
import kotlinx.coroutines.launch

// 结账弹层（原型 prof-modal · §10 demo mock 支付）
// 对应 ios/Possibility/Features/Profile/PaywallView.swift。
// 三档：解锁完整经验 ¥9.9（真解锁）/ 1 对 1 咨询 ¥29 / 阶段陪跑 ¥599（仅展示，敬请期待）。

private const val PAY_NOTE =
    "演示环境：点击即模拟完成，不产生真实扣款。正式版将通过 App 内购安全支付。"

/** 付费墙底部弹层。unlock 档 mock 支付成功后 toast + onUnlocked；咨询/陪跑仅展示。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaywallSheet(
    traveler: Traveler,
    onDismiss: () -> Unit,
    onUnlocked: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()

    var processing by remember { mutableStateOf(false) }
    var succeeded by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF11141D),
        dragHandle = null,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 22.dp)
                .padding(top = 18.dp, bottom = 28.dp),
        ) {
            if (succeeded) {
                SuccessView(onDone = onDismiss)
            } else {
                // 标题栏
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "支持这位旅人",
                        color = Theme.ink,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    Box(
                        Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(Theme.raised)
                            .clickableNoRipple(onDismiss),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("✕", color = Theme.sub, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                }

                Spacer(Modifier.padding(top = 4.dp))
                Text(
                    "选择一种方式，解锁 ${traveler.name} 的完整经验或与 TA 直接连接。",
                    color = Theme.sub,
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                    modifier = Modifier.padding(top = 6.dp),
                )

                // 三档
                Column(
                    Modifier.padding(top = 18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    TierCard(
                        kicker = "解锁完整经验",
                        title = "${traveler.name} · 完整转型经验",
                        subtitle = "完整故事 + 全部踩坑建议 + 完整轨迹",
                        price = AppConfig.Price.UNLOCK_PROFILE,
                        unit = "次",
                        accentBg = listOf(Color(0xFF151C34), Color(0xFF111327)),
                        accentBorder = Color(0xFF6FA5FF),
                        ctaLabel = if (processing) "处理中…" else "确认解锁 · ¥${formatPrice(AppConfig.Price.UNLOCK_PROFILE)}",
                        ctaEnabled = !processing,
                        onCta = {
                            if (processing) return@TierCard
                            processing = true
                            scope.launch {
                                val ok = SupabaseService.shared.unlockProfile(traveler.id)
                                processing = false
                                if (ok) {
                                    ToastCenter.show("已解锁完整经验")
                                    onUnlocked()
                                    succeeded = true
                                } else {
                                    ToastCenter.show("解锁失败，请稍后再试")
                                }
                            }
                        },
                    )
                    TierCard(
                        kicker = "1 对 1 咨询",
                        title = "与 ${traveler.name} 进行 1 小时咨询",
                        subtitle = "针对你的处境深入拆解，24 小时内可追问一次",
                        price = AppConfig.Price.CONSULT,
                        unit = "次",
                        accentBg = listOf(Color(0xFF172820), Color(0xFF101A17)),
                        accentBorder = Color(0xFF3ED9A4),
                        ctaLabel = "向 TA 咨询 · ¥${formatPrice(AppConfig.Price.CONSULT)}",
                        ctaEnabled = !processing,
                        onCta = { ToastCenter.show("敬请期待") },
                    )
                    TierCard(
                        kicker = "阶段陪跑",
                        title = "4 周申请陪跑",
                        subtitle = "目标拆解 · 每周复盘 · 材料反馈，双方确认适合后开始",
                        price = AppConfig.Price.COMPANION,
                        unit = "期",
                        accentBg = listOf(Color(0xFF2B1B2D), Color(0xFF17121F)),
                        accentBorder = Color(0xFFE35CC1),
                        ctaLabel = "申请陪跑 · ¥${formatPrice(AppConfig.Price.COMPANION)}",
                        ctaEnabled = !processing,
                        onCta = { ToastCenter.show("敬请期待") },
                    )
                }

                Text(
                    PAY_NOTE,
                    color = Theme.faint,
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                    modifier = Modifier.padding(top = 14.dp),
                )
            }
        }
    }
}

@Composable
private fun TierCard(
    kicker: String,
    title: String,
    subtitle: String,
    price: Double,
    unit: String,
    accentBg: List<Color>,
    accentBorder: Color,
    ctaLabel: String,
    ctaEnabled: Boolean,
    onCta: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(accentBg))
            .border(1.dp, accentBorder.copy(alpha = 0.28f), RoundedCornerShape(24.dp))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.Bottom) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    kicker.uppercase(),
                    color = Color(0xFF9DBCFF),
                    fontSize = 10.sp,
                    letterSpacing = 2.5.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(title, color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.width(10.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Text("¥${formatPrice(price)}", color = Color.White, fontSize = 25.sp, fontWeight = FontWeight.Bold)
                Text(" / $unit", color = Theme.sub, fontSize = 11.sp, modifier = Modifier.padding(bottom = 3.dp))
            }
        }
        Text(subtitle, color = Theme.sub, fontSize = 12.sp, lineHeight = 17.sp)
        Box(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(999.dp))
                .background(if (ctaEnabled) Theme.buttonGradient else Brush.linearGradient(listOf(Theme.raised, Theme.raised)))
                .clickableNoRipple { if (ctaEnabled) onCta() }
                .padding(vertical = 14.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(ctaLabel, color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun SuccessView(onDone: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(top = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier
                .size(62.dp)
                .clip(CircleShape)
                .background(Theme.teal.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Check, contentDescription = null, tint = Theme.teal, modifier = Modifier.size(28.dp))
        }
        Text(
            "已解锁完整经验",
            color = Theme.ink,
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "完整故事、踩坑建议与轨迹已全部展开，回到主页查看。",
            color = Theme.sub,
            fontSize = 12.sp,
            lineHeight = 18.sp,
            modifier = Modifier.padding(top = 8.dp),
        )
        Box(
            Modifier
                .padding(top = 24.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(999.dp))
                .background(Theme.buttonGradient)
                .clickableNoRipple(onDone)
                .padding(vertical = 15.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text("好的", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}
