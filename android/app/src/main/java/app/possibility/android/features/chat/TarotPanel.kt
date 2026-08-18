package app.possibility.android.features.chat

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color as AndroidColor
import android.graphics.Paint
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.theme.Theme
import app.possibility.android.features.profile.clickableNoRipple
import java.io.File
import java.io.FileOutputStream

@Composable
fun TarotPanel(model: ChatModel) {
    val selectedIds = remember { mutableStateListOf<String>() }

    LaunchedEffect(model.tarotPhase) {
        if (model.tarotPhase == TarotPhase.DRAWING) selectedIds.clear()
    }

    val shape = RoundedCornerShape(22.dp)
    Column(
        Modifier
            .padding(top = 14.dp)
            .fillMaxWidth()
            .background(
                Brush.linearGradient(listOf(Theme.blue.copy(alpha = 0.12f), Theme.violetSoft.copy(alpha = 0.06f))),
                shape,
            )
            .border(1.dp, Color(0xFF6FA5FF).copy(alpha = 0.28f), shape)
            .padding(15.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        when (model.tarotPhase) {
            TarotPhase.NONE -> Unit
            TarotPhase.OFFER -> TarotOffer(model)
            TarotPhase.DRAWING -> TarotDrawing(model, selectedIds)
            TarotPhase.CONFIRM -> TarotConfirmation(model)
            TarotPhase.RESULT -> TarotResult(model)
            TarotPhase.LOCKED -> TarotLocked(model)
        }
    }

    if (model.showTarotShare) {
        TarotSharePosterDialog(model = model, onDismiss = { model.showTarotShare = false })
    }
}

@Composable
private fun TarotHeading(model: ChatModel) {
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text("三张牌 · 象征分析", color = Color(0xFF91B1FF), fontSize = 9.sp, letterSpacing = 1.6.sp)
        Text(
            model.tarotDisplayQuestion,
            color = Theme.ink,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            lineHeight = 19.sp,
        )
    }
}

@Composable
private fun TarotOffer(model: ChatModel) {
    TarotHeading(model)
    Text(
        "从 12 张候选牌中亲手选出 3 张，分别代表现状、核心阻力与行动走向。它不会替你决定未来，而是提供一个新的观察角度。",
        color = Theme.sub, fontSize = 12.sp, lineHeight = 18.sp,
    )
    TarotPrimaryButton("开始抽取 3 张牌") { model.beginTarotDraw() }
    if (!model.tarotRequired) {
        Text(
            "暂时不抽牌",
            color = Theme.sub,
            fontSize = 11.5.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().clickableNoRipple { model.answerWithoutTarot() },
        )
    }
    TarotQuotaFooter(model)
}

@Composable
private fun TarotDrawing(model: ChatModel, selectedIds: MutableList<String>) {
    TarotHeading(model)
    Text("请选择 3 张 · 已选 ${selectedIds.size}/3", color = Theme.sub, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
    model.tarotCandidates.chunked(4).forEachIndexed { rowIndex, row ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            row.forEachIndexed { columnIndex, card ->
                val selected = card.id in selectedIds
                Column(
                    Modifier
                        .weight(1f)
                        .height(72.dp)
                        .background(
                            if (selected) Color(0xFF446FE2).copy(alpha = 0.58f) else Color.White.copy(alpha = 0.045f),
                            RoundedCornerShape(12.dp),
                        )
                        .border(
                            1.dp,
                            if (selected) Color(0xFF91B1FF) else Theme.line,
                            RoundedCornerShape(12.dp),
                        )
                        .clickableNoRipple {
                            if (selected) selectedIds.remove(card.id)
                            else if (selectedIds.size < 3) selectedIds.add(card.id)
                        },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(if (selected) "✦" else "◌", color = if (selected) Color.White else Theme.sub, fontSize = 18.sp)
                    Text("候选 ${rowIndex * 4 + columnIndex + 1}", color = if (selected) Color.White else Theme.sub, fontSize = 9.sp)
                }
            }
            repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
        }
    }
    TarotPrimaryButton("确认这 3 张牌", enabled = selectedIds.size == 3) {
        model.prepareTarotConfirmation(selectedIds.toList())
    }
}

@Composable
private fun TarotConfirmation(model: ChatModel) {
    TarotHeading(model)
    Text("确认你的三张牌", color = Theme.sub, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    TarotCardsRow(model.tarotSelection, revealMeaning = false)
    TarotPrimaryButton(if (model.isTarotSubmitting) "正在生成答案…" else "确认并查看分析", !model.isTarotSubmitting) {
        model.confirmTarotDraw()
    }
    Text(
        "重新选择", color = Theme.sub, fontSize = 11.5.sp, textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth().clickableNoRipple { model.beginTarotDraw() },
    )
}

@Composable
private fun TarotResult(model: ChatModel) {
    Text("你的三张牌", color = Color(0xFF91B1FF), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    TarotCardsRow(model.tarotReading?.cards ?: model.tarotSelection, revealMeaning = true)
    TarotQuotaFooter(model)
}

@Composable
private fun TarotLocked(model: ChatModel) {
    Text("今天的基础次数已用完", color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    Text(
        "每天有 3 次基础机会。你可以免费分享领取次数、开通连续包月，或购买加量包。",
        color = Theme.sub, fontSize = 12.sp, lineHeight = 18.sp,
    )
    UnlockCard("分享免费领取次数", "每次完成分享 +1 次，不限次数", "立即分享") {
        model.showTarotShare = true
    }
    UnlockCard("¥9.9 连续包月", "首月优惠；第 2 个月起 ¥25/月，可随时关闭", "立即开通", primary = true) {
        model.purchaseTarotAccess(TarotPurchaseProduct.SUBSCRIPTION)
        ToastCenter.show("演示环境：已开通包月不限次")
    }
    UnlockCard("¥19 15次加量包", "15 次 ¥19；也可选择 100 次 ¥99", "购买次数") {
        model.purchaseTarotAccess(TarotPurchaseProduct.CREDITS_15)
        ToastCenter.show("演示环境：已增加 15 次")
    }
    Text(
        "购买 100 次 · ¥99",
        color = Color(0xFFAFC7FF),
        fontSize = 11.5.sp,
        fontWeight = FontWeight.SemiBold,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth().clickableNoRipple {
            model.purchaseTarotAccess(TarotPurchaseProduct.CREDITS_100)
            ToastCenter.show("演示环境：已增加 100 次")
        },
    )
}

@Composable
private fun UnlockCard(
    title: String,
    note: String,
    action: String,
    primary: Boolean = false,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(18.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .height(132.dp)
            .background(Color.White.copy(alpha = 0.045f), shape)
            .border(1.dp, Theme.line, shape)
            .padding(15.dp),
    ) {
        Text(title, color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Text(note, color = Theme.sub, fontSize = 11.sp, lineHeight = 15.sp, modifier = Modifier.padding(top = 7.dp))
        Spacer(Modifier.weight(1f))
        Box(
            Modifier
                .fillMaxWidth()
                .background(
                    if (primary) Theme.buttonGradient else Brush.linearGradient(listOf(Theme.blue.copy(alpha = 0.1f), Theme.blue.copy(alpha = 0.1f))),
                    RoundedCornerShape(999.dp),
                )
                .clickableNoRipple(onClick)
                .padding(vertical = 10.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(action, color = if (primary) Color.White else Color(0xFFAFC7FF), fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun TarotCardsRow(cards: List<DrawnTarotCard>, revealMeaning: Boolean) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        cards.take(3).forEachIndexed { index, drawn ->
            Column(
                Modifier
                    .weight(1f)
                    .height(if (revealMeaning) 128.dp else 96.dp)
                    .background(Color(0xFF315AA8).copy(alpha = 0.22f), RoundedCornerShape(14.dp))
                    .border(1.dp, Color(0xFF6FA5FF).copy(alpha = 0.42f), RoundedCornerShape(14.dp))
                    .padding(vertical = 9.dp, horizontal = 5.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(TarotEngine.positions[index], color = Color(0xFF91B1FF), fontSize = 8.5.sp)
                Text(drawn.card.symbol, color = Theme.ink, fontSize = 22.sp, modifier = Modifier.padding(top = 4.dp))
                Text(drawn.card.name, color = Theme.ink, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
                Text(drawn.orientation, color = Theme.faint, fontSize = 9.sp)
                if (revealMeaning) {
                    Text(drawn.meaning, color = Theme.sub, fontSize = 8.5.sp, lineHeight = 11.sp, maxLines = 2, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 2.dp))
                }
            }
        }
    }
}

@Composable
private fun TarotPrimaryButton(title: String, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .background(
                if (enabled) Theme.buttonGradient else Brush.linearGradient(listOf(Theme.faint, Theme.faint)),
                RoundedCornerShape(999.dp),
            )
            .clickableNoRipple { if (enabled) onClick() }
            .padding(vertical = 13.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(title, color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun TarotQuotaFooter(model: ChatModel) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text("可用额度：${model.tarotRemainingLabel}", color = Theme.faint, fontSize = 10.5.sp)
        Spacer(Modifier.weight(1f))
        Text(
            "解锁更多次数 ↗",
            color = Color(0xFFAFC7FF),
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.clickableNoRipple { model.showTarotShare = true },
        )
    }
}

@Composable
private fun TarotSharePosterDialog(model: ChatModel, onDismiss: () -> Unit) {
    val context = LocalContext.current
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp)
                .background(Theme.card, RoundedCornerShape(24.dp))
                .border(1.dp, Theme.line, RoundedCornerShape(24.dp))
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text("分享免费领取次数", color = Theme.ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text("每完成一次分享即可领取 1 次，没有每日上限。", color = Theme.sub, fontSize = 11.sp)
                }
                Text("✕", color = Theme.sub, fontSize = 14.sp, modifier = Modifier.clickableNoRipple(onDismiss))
            }

            PosterPreview()
            Text("选择分享渠道", color = Theme.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            TarotShareChannel.entries.chunked(2).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    row.forEach { channel ->
                        Column(
                            Modifier
                                .weight(1f)
                                .background(Theme.raised, RoundedCornerShape(15.dp))
                                .border(1.dp, Theme.line, RoundedCornerShape(15.dp))
                                .clickableNoRipple {
                                    sharePoster(context, channel) {
                                        model.claimTarotShareReward(channel)
                                        ToastCenter.show("分享完成，已领取 1 次")
                                    }
                                }
                                .padding(13.dp),
                        ) {
                            Text(channel.label, color = Theme.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Text(channel.note, color = Theme.faint, fontSize = 10.sp, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun PosterPreview() {
    val shape = RoundedCornerShape(18.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .height(285.dp)
            .background(
                Brush.linearGradient(listOf(Color(0xFF090B12), Color(0xFF11172A), Color(0xFF241633))),
                shape,
            )
            .border(1.dp, Color(0xFF6FA5FF).copy(alpha = 0.3f), shape)
            .padding(22.dp),
    ) {
        Text("POSSIBILITY · 万花筒", color = Color(0xFFAFC7FF), fontSize = 8.5.sp, letterSpacing = 1.8.sp)
        Text("认识你自己，\n推演人生的可能性", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold, lineHeight = 29.sp, modifier = Modifier.padding(top = 16.dp))
        Text("让动态画像、语音日记与真实经验，陪你找到更贴近自己的下一步。", color = Color.White.copy(alpha = 0.65f), fontSize = 10.sp, lineHeight = 15.sp, modifier = Modifier.padding(top = 9.dp))
        Spacer(Modifier.weight(1f))
        Text("◉ 动态画像    ✦ 人生实验室    ⌁ 相似经验", color = Color(0xFFAFC7FF), fontSize = 9.sp)
        Text("海报不包含你的画像、日记或对话内容", color = Color.White.copy(alpha = 0.42f), fontSize = 7.5.sp, modifier = Modifier.padding(top = 8.dp))
    }
}

// 对齐 iOS ActivityShareSheet 的 completionWithItemsHandler：只有系统回调
// EXTRA_CHOSEN_COMPONENT（用户真的选中了分享目标）才算完成，直接关掉分享面板不发奖励。
// receiver 挂 applicationContext 并自解注册；同一时间只保留一个，防重复打开泄漏。
private var pendingShareChosenReceiver: BroadcastReceiver? = null

private fun shareChooser(
    context: Context,
    target: Intent,
    title: String,
    onChosen: () -> Unit,
): Intent {
    val app = context.applicationContext
    pendingShareChosenReceiver?.let { previous -> runCatching { app.unregisterReceiver(previous) } }
    val action = "${app.packageName}.action.TAROT_SHARE_CHOSEN"
    val receiver = object : BroadcastReceiver() {
        override fun onReceive(receiverContext: Context?, intent: Intent?) {
            runCatching { app.unregisterReceiver(this) }
            if (pendingShareChosenReceiver === this) pendingShareChosenReceiver = null
            onChosen()
        }
    }
    pendingShareChosenReceiver = receiver
    ContextCompat.registerReceiver(app, receiver, IntentFilter(action), ContextCompat.RECEIVER_NOT_EXPORTED)
    // 系统需要往回调 intent 里填 EXTRA_CHOSEN_COMPONENT，PendingIntent 必须可变。
    val sender = PendingIntent.getBroadcast(
        app,
        0,
        Intent(action).setPackage(app.packageName),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
    ).intentSender
    return Intent.createChooser(target, title, sender)
}

private fun sharePoster(context: Context, channel: TarotShareChannel, onChosen: () -> Unit) {
    runCatching {
        val bitmap = Bitmap.createBitmap(1080, 1440, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(AndroidColor.rgb(10, 13, 22))
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        paint.color = AndroidColor.rgb(175, 199, 255)
        paint.textSize = 34f
        paint.isFakeBoldText = true
        canvas.drawText("POSSIBILITY · 万花筒", 84f, 118f, paint)
        paint.color = AndroidColor.WHITE
        paint.textSize = 76f
        canvas.drawText("认识你自己，", 84f, 290f, paint)
        canvas.drawText("推演人生的可能性", 84f, 390f, paint)
        paint.color = AndroidColor.rgb(186, 194, 215)
        paint.textSize = 31f
        paint.isFakeBoldText = false
        canvas.drawText("动态画像 · 人生实验室 · 相似经验", 84f, 650f, paint)
        canvas.drawText("陪你找到更贴近自己的下一步", 84f, 710f, paint)
        paint.color = AndroidColor.rgb(175, 199, 255)
        paint.textSize = 29f
        canvas.drawText("分享万花筒，一起看见更多人生可能", 84f, 1280f, paint)
        paint.color = AndroidColor.rgb(135, 143, 164)
        paint.textSize = 23f
        canvas.drawText("海报不包含你的画像、日记或对话内容", 84f, 1340f, paint)

        val directory = File(context.cacheDir, "shared_posters").apply { mkdirs() }
        val file = File(directory, "possibility-app-poster.png")
        FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TEXT, "万花筒 · 认识你自己，推演人生的可能性")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(shareChooser(context, intent, "通过${channel.label}分享", onChosen))
    }.onFailure {
        val fallback = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, "万花筒 · 认识你自己，推演人生的可能性")
        }
        context.startActivity(shareChooser(context, fallback, "分享万花筒", onChosen))
    }
}
