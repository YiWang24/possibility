package app.possibility.android.features.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.AppConfig
import app.possibility.android.core.model.Traveler
import app.possibility.android.core.model.TravelerServiceItem
import app.possibility.android.core.network.SupabaseService
import app.possibility.android.core.theme.Theme
import app.possibility.android.features.auth.AuthGateCenter
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// 结账弹层（原型 prof-modal · §10 demo mock 支付）
// 对应 ios/Possibility/Features/Profile/PaywallView.swift：单商品订单卡，
// 由入口决定结账对象 —— 锁定块 → 解锁完整经验；服务卡 → 该项服务。
// 解锁走真实 unlocks 写入；具体服务（咨询 / 资料包 / 陪跑）demo 模拟下单。

/** 结账类型，对应 iOS ProfileModel.Checkout。 */
sealed interface ProfileCheckout {
    data object Unlock : ProfileCheckout
    data class Service(val item: TravelerServiceItem) : ProfileCheckout
}

private const val PAY_NOTE =
    "演示环境：点击即模拟完成，不产生真实扣款。正式版将通过 App 内购安全支付。"

/** 付费墙底部弹层：单商品订单卡 + mock 支付。付费是关键动作，先过登录门控。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaywallSheet(
    traveler: Traveler,
    checkout: ProfileCheckout,
    onDismiss: () -> Unit,
    onUnlocked: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()

    var processing by remember { mutableStateOf(false) }
    var succeeded by remember { mutableStateOf(false) }

    val service = (checkout as? ProfileCheckout.Service)?.item
    val consult = service?.kind == "consult"

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
                SuccessView(
                    title = when {
                        service == null -> "已解锁完整经验"
                        consult -> "预约成功"
                        else -> "购买成功"
                    },
                    subtitle = if (service == null) {
                        "完整故事、踩坑建议与轨迹已全部展开，回到主页查看。"
                    } else {
                        "TA 会尽快与你确认。可在消息中追问具体细节。"
                    },
                    onDone = onDismiss,
                )
            } else {
                // 标题栏
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        when {
                            service == null -> "解锁完整经验"
                            consult -> "预约咨询"
                            else -> "确认订单"
                        },
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

                // 订单卡（iOS orderCard）
                val price = service?.price ?: AppConfig.Price.UNLOCK_PROFILE
                Row(
                    Modifier
                        .padding(top = 18.dp)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .background(Theme.card)
                        .border(1.dp, Theme.line, RoundedCornerShape(18.dp))
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            service?.title ?: "${traveler.name} · 完整转型经验",
                            color = Theme.ink,
                            fontSize = 13.5.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            service?.description ?: "完整故事 + 全部踩坑建议 + 完整轨迹",
                            color = Theme.sub,
                            fontSize = 11.sp,
                            lineHeight = 16.sp,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                    Spacer(Modifier.width(14.dp))
                    Text("¥${formatPrice(price)}", color = Theme.ink, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                }

                Text(
                    PAY_NOTE,
                    color = Theme.faint,
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                    modifier = Modifier.padding(top = 13.dp),
                )

                Box(
                    Modifier
                        .padding(top = 20.dp)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(999.dp))
                        .background(Theme.buttonGradient)
                        .clickableNoRipple {
                            if (processing) return@clickableNoRipple
                            // 与 iOS pay() 对齐：付费是关键动作，游客先被登录门控拦下，
                            // 登录成功后继续本次支付（AuthGateHost 由旅人主页根部挂载）。
                            AuthGateCenter.require("paywall") {
                                processing = true
                                scope.launch {
                                    if (service == null) {
                                        // 与 iOS confirmUnlock 一致：只有写库成功才标记解锁，
                                        // 但 demo 弹层无论成败都进成功态。
                                        if (SupabaseService.shared.unlockProfile(traveler.id)) onUnlocked()
                                    } else {
                                        delay(600)   // demo：模拟下单
                                    }
                                    processing = false
                                    succeeded = true
                                }
                            }
                        }
                        .padding(vertical = 15.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        when {
                            processing -> "处理中…"
                            service == null -> "确认解锁 · ¥${formatPrice(price)}"
                            consult -> "确认预约 · ¥${formatPrice(price)}"
                            else -> "确认购买 · ¥${formatPrice(price)}"
                        },
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}

@Composable
private fun SuccessView(title: String, subtitle: String, onDone: () -> Unit) {
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
            title,
            color = Theme.ink,
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            subtitle,
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
