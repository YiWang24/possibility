package app.possibility.android.features.profile

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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.model.Traveler
import app.possibility.android.core.model.TravelerServiceItem
import app.possibility.android.core.theme.Theme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private data class PeerMessage(val id: Long, val mine: Boolean, val text: String)

@Composable
fun ConsultChatDialog(model: ProfileModel, traveler: Traveler, onDismiss: () -> Unit) {
    val messages = remember {
        mutableStateListOf(
            PeerMessage(
                0,
                mine = false,
                text = "你好，我是${traveler.name}。可以先免费聊聊你现在的处境；如果需要更深入的支持，再从下面选择服务。",
            ),
        )
    }
    val purchasedIds = remember { mutableStateListOf<String>() }
    var input by remember { mutableStateOf("") }
    var selectedService by remember { mutableStateOf<TravelerServiceItem?>(null) }
    val scope = rememberCoroutineScope()

    fun send() {
        val clean = input.trim()
        if (clean.isEmpty()) return
        input = ""
        messages.add(PeerMessage(System.nanoTime(), true, clean))
        scope.launch {
            delay(550)
            messages.add(
                PeerMessage(
                    System.nanoTime(),
                    false,
                    "我看到了。你可以先说说：在这个问题里，最希望我用亲身经历帮你判断的是什么？",
                ),
            )
        }
    }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxSize().background(Theme.paper)) {
            Row(
                Modifier.fillMaxWidth().background(Color(0xFF0A0C12)).statusBarsPadding()
                    .padding(horizontal = 18.dp, vertical = 13.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(42.dp).background(Theme.hue(traveler.hue).gradient, RoundedCornerShape(15.dp)), contentAlignment = Alignment.Center) {
                    Text(traveler.initial, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        Text("与${traveler.name}聊天", color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        Text(
                            "免费 1v1", color = Theme.teal, fontSize = 9.5.sp, fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.background(Theme.teal.copy(alpha = 0.12f), RoundedCornerShape(999.dp)).padding(horizontal = 7.dp, vertical = 4.dp),
                        )
                    }
                    Text("先聊清楚，再按需选择付费服务", color = Theme.faint, fontSize = 10.5.sp)
                }
                Box(
                    Modifier.size(34.dp).background(Theme.raised, CircleShape).clickableNoRipple(onDismiss),
                    contentAlignment = Alignment.Center,
                ) { Text("✕", color = Theme.sub, fontSize = 12.sp) }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))

            LazyColumn(
                Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
            ) {
                item { PeerBubble(messages.first()) }
                item { ServicesInChat(model, traveler, purchasedIds) { selectedService = it } }
                items(messages.drop(1), key = { it.id }) { PeerBubble(it) }
            }

            Row(
                Modifier.fillMaxWidth().background(Color(0xFF0A0C12)).imePadding().navigationBarsPadding()
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                Box(
                    Modifier.weight(1f).background(Theme.raised, RoundedCornerShape(18.dp))
                        .border(1.dp, Theme.line, RoundedCornerShape(18.dp)).padding(horizontal = 15.dp, vertical = 12.dp),
                ) {
                    BasicTextField(
                        value = input,
                        onValueChange = { input = it },
                        textStyle = TextStyle(color = Theme.ink, fontSize = 13.5.sp),
                        modifier = Modifier.fillMaxWidth(),
                        decorationBox = { inner ->
                            if (input.isEmpty()) Text("免费聊聊你的问题…", color = Theme.faint, fontSize = 13.5.sp)
                            inner()
                        },
                    )
                }
                Box(
                    Modifier.background(Theme.buttonGradient, RoundedCornerShape(999.dp)).clickableNoRipple(::send)
                        .padding(horizontal = 18.dp, vertical = 12.dp),
                ) { Text("发送", color = Color.White, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold) }
            }
        }
    }

    selectedService?.let { service ->
        ServiceCheckoutDialog(
            service = service,
            onDismiss = { selectedService = null },
            onPaid = {
                if (service.id !in purchasedIds) purchasedIds.add(service.id)
                selectedService = null
                messages.add(
                    PeerMessage(
                        System.nanoTime(),
                        false,
                        "你已选择「${personalized(service.title, traveler.name)}」。我会在聊天中和你确认目标、时间与交付方式。",
                    ),
                )
                ToastCenter.show("演示环境：已模拟支付成功，不会产生真实扣款")
            },
        )
    }
}

@Composable
private fun ServicesInChat(
    model: ProfileModel,
    traveler: Traveler,
    purchasedIds: List<String>,
    onSelect: (TravelerServiceItem) -> Unit,
) {
    val shape = RoundedCornerShape(20.dp)
    Column(
        Modifier.padding(vertical = 14.dp).fillMaxWidth().background(Theme.blue.copy(alpha = 0.08f), shape)
            .border(1.dp, Color(0xFF6FA5FF).copy(alpha = 0.25f), shape).padding(15.dp),
    ) {
        Row(verticalAlignment = Alignment.Bottom) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("TA 可以提供的服务", color = Theme.ink, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
                Text("免费聊天无需选择服务，需要时再付费", color = Theme.faint, fontSize = 10.sp)
            }
            Text("${model.services.size} 项", color = Color(0xFF91B1FF), fontSize = 10.sp)
        }
        if (model.services.isEmpty()) {
            Text("TA 暂未发布付费服务，你仍然可以继续免费聊天。", color = Theme.sub, fontSize = 11.5.sp, modifier = Modifier.padding(top = 12.dp))
        } else {
            LazyRow(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                items(model.services, key = { it.id }) { service ->
                    Column(
                        Modifier.width(142.dp).height(132.dp).background(Color.White.copy(alpha = 0.045f), RoundedCornerShape(16.dp))
                            .border(1.dp, Theme.line, RoundedCornerShape(16.dp)).clickableNoRipple { onSelect(service) }.padding(12.dp),
                    ) {
                        Text(serviceKind(service.kind), color = Color(0xFF91B1FF), fontSize = 9.sp, letterSpacing = 1.2.sp)
                        Text(
                            personalized(service.title, traveler.name), color = Theme.ink, fontSize = 11.5.sp,
                            fontWeight = FontWeight.SemiBold, lineHeight = 15.sp, maxLines = 2, modifier = Modifier.padding(top = 8.dp),
                        )
                        Spacer(Modifier.weight(1f))
                        Text(
                            if (service.id in purchasedIds) "已选择" else "¥${formatPrice(service.price)} / ${service.unit}",
                            color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PeerBubble(message: PeerMessage) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = if (message.mine) Arrangement.End else Arrangement.Start) {
        Text(
            message.text,
            color = if (message.mine) Color.White else Theme.ink,
            fontSize = 13.sp,
            lineHeight = 19.sp,
            modifier = Modifier.widthIn(max = 300.dp)
                .background(if (message.mine) Theme.buttonGradient else Brush.linearGradient(listOf(Theme.card, Theme.card)), RoundedCornerShape(18.dp))
                .then(if (message.mine) Modifier else Modifier.border(1.dp, Theme.line, RoundedCornerShape(18.dp)))
                .padding(horizontal = 15.dp, vertical = 12.dp),
        )
    }
}

@Composable
private fun ServiceCheckoutDialog(service: TravelerServiceItem, onDismiss: () -> Unit, onPaid: () -> Unit) {
    var processing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().background(Theme.card, RoundedCornerShape(22.dp)).border(1.dp, Theme.line, RoundedCornerShape(22.dp)).padding(20.dp),
        ) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Text("选择付费服务", color = Color(0xFF91B1FF), fontSize = 10.sp, letterSpacing = 1.5.sp)
                    Text(service.title, color = Theme.ink, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                }
                Text("✕", color = Theme.sub, fontSize = 13.sp, modifier = Modifier.clickableNoRipple(onDismiss))
            }
            Text(service.description, color = Theme.sub, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 14.dp))
            Row(Modifier.padding(top = 20.dp).fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                Text("确认后在聊天中沟通服务细节", color = Theme.faint, fontSize = 10.sp, modifier = Modifier.weight(1f))
                Text("¥${formatPrice(service.price)}", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            }
            Box(
                Modifier.padding(top = 18.dp).fillMaxWidth().background(Theme.buttonGradient, RoundedCornerShape(999.dp))
                    .clickableNoRipple {
                        if (!processing) {
                            processing = true
                            scope.launch { delay(650); onPaid() }
                        }
                    }.padding(vertical = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(if (processing) "处理中…" else "确认支付 ¥${formatPrice(service.price)}", color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
            }
            Text("演示环境：模拟支付，不会产生真实扣款", color = Theme.faint, fontSize = 9.5.sp, modifier = Modifier.padding(top = 10.dp).align(Alignment.CenterHorizontally))
        }
    }
}

private fun personalized(title: String, travelerName: String): String = title.replace("与TA", "与$travelerName")

private fun serviceKind(kind: String): String = when (kind) {
    "materials" -> "资料工具包"
    "companion" -> "阶段陪跑"
    else -> "1 对 1 咨询"
}
