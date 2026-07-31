package app.possibility.android.features.community

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.model.Bounty
import app.possibility.android.core.model.BountyDetailResponse
import app.possibility.android.core.model.DemoData
import app.possibility.android.core.model.MyProfile
import app.possibility.android.core.network.SupabaseService
import app.possibility.android.core.theme.Theme
import app.possibility.android.features.auth.AuthGateCenter
import app.possibility.android.features.auth.AuthGateHost
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

// MARK: - 悬赏详情页（原型 #bountyPage · renderBountyDetail）
//
// 标签 / 标题 / 发布者 / 悬赏卡 / 问题详情 / 亲历者回应 / 发送名片。
// 对应 ios/Possibility/Features/Community/BountyDetailView.swift。
// 采用 bountyId 入参：先用缓存/DemoData 兜底秒开，再 getBounty 补远端详情与回应。

private const val SENT_KEY = "kaleido_bounty_sent_v1"
private const val MY_PROFILE_KEY = "kaleido_my_profile_v2"
private const val PREFS_FILE = "possibility"

private val lenientJson = Json { ignoreUnknownKeys = true; encodeDefaults = true }

/**
 * 悬赏详情全屏浮层。
 * @param bountyId 悬赏 id（列表点击传入）。
 * @param onDismiss 关闭浮层。
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BountyDetailSheet(bountyId: Int, onDismiss: () -> Unit) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        val context = LocalContext.current
        val service = SupabaseService.shared
        val scope = rememberCoroutineScope()

        val cacheBounties by service.bounties.collectAsState()
        val cacheBounty = cacheBounties.firstOrNull { it.id == bountyId }
        val demoBounty = DemoData.bounties.firstOrNull { it.id == bountyId }
        // 缓存为空或整体等于 DemoData 时，视为演示数据（配套演示详情，不混远端）
        val cacheIsDemo = cacheBounties.isEmpty() || cacheBounties == DemoData.bounties

        var remote by remember { mutableStateOf<BountyDetailResponse?>(null) }
        var didFinishRemoteLoad by remember { mutableStateOf(false) }
        var sent by remember { mutableStateOf(sentIds(context).contains(bountyId)) }
        var showCardModal by remember { mutableStateOf(false) }
        var sending by remember { mutableStateOf(false) }

        LaunchedEffect(bountyId) {
            remote = runCatching { service.getBounty(bountyId) }.getOrNull()
            didFinishRemoteLoad = true
        }

        val usesDemoData = remote == null && cacheBounty == null || (remote == null && cacheIsDemo)
        val base: Bounty? = remote?.bounty ?: cacheBounty ?: demoBounty
        val demoDetail = DemoData.bountyDetail(bountyId)

        val displayTags: List<String> = remote?.bounty?.tags?.takeIf { it.isNotEmpty() }
            ?: base?.tags?.takeIf { it.isNotEmpty() }
            ?: if (usesDemoData) demoDetail.tags else emptyList()
        val displayQuestion = base?.question ?: demoDetail.detail
        val displayDetail = remote?.bounty?.detail?.takeIf { it.isNotBlank() }
            ?: base?.detail?.takeIf { it.isNotBlank() }
            ?: if (usesDemoData) demoDetail.detail else "详情暂未填写。"
        val statusText = (remote?.bounty?.status ?: base?.status)?.let {
            if (it == "closed") "已结束" else "征集中"
        } ?: if (usesDemoData) demoDetail.goal else "征集中"
        val responseCountText = when {
            usesDemoData -> "${demoDetail.replies.size} 人回应"
            remote != null -> "${remote!!.responses.size} 人回应"
            didFinishRemoteLoad -> "回应加载失败"
            else -> "回应加载中"
        }

        Column(
            Modifier
                .fillMaxSize()
                .background(Theme.paper),
        ) {
            // 顶栏
            Column(Modifier.statusBarsPadding()) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .padding(top = 14.dp, bottom = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(Theme.raised)
                            .communityClickable(onDismiss),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("‹", color = Theme.ink, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text("悬赏详情", color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Text("$statusText · $responseCountText", color = Theme.faint, fontSize = 10.5.sp)
                    }
                }
                Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
            }

            Column(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 22.dp)
                    .padding(top = 16.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                if (displayTags.isNotEmpty()) {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        displayTags.forEach { CommunityTagPill(it) }
                    }
                }
                Text(displayQuestion, color = Theme.ink, fontSize = 21.sp, fontWeight = FontWeight.Bold, lineHeight = 30.sp)

                Publisher(base, usesDemoData, demoDetail)
                PrizeCard(base, usesDemoData, demoDetail, statusText)
                CopyBlock(displayDetail)
                Replies(remote, usesDemoData, demoDetail, didFinishRemoteLoad, responseCountText, bountyId)

                if (sent) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(13.dp))
                            .background(Theme.teal.copy(alpha = 0.08f))
                            .border(1.dp, Theme.teal.copy(alpha = 0.3f), RoundedCornerShape(13.dp))
                            .padding(13.dp),
                    ) {
                        Text(
                            "你的名片与补充说明已发送，发帖人可以查看你的经历并与你联系。",
                            color = Color(0xFF8EE7C8),
                            fontSize = 11.5.sp,
                            lineHeight = 17.sp,
                        )
                    }
                }
            }

            // 底部动作栏
            Column {
                Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
                Box(
                    Modifier
                        .navigationBarsPadding()
                        .padding(horizontal = 20.dp)
                        .padding(top = 12.dp, bottom = 14.dp)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (sent) SolidColor(Theme.raised) else Theme.buttonGradient)
                        .communityClickable {
                            if (sent) {
                                ToastCenter.show("你的名片已经发送")
                            } else {
                                AuthGateCenter.require("bounty_respond") { showCardModal = true }
                            }
                        }
                        .padding(vertical = 15.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        if (sent) "名片已发送 ✓" else "发送我的名片",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }

        if (showCardModal) {
            CardModal(
                sending = sending,
                onDismiss = { showCardModal = false },
                onConfirm = { message ->
                    if (sending) return@CardModal
                    sending = true
                    scope.launch {
                        val profile = loadMyProfile(context)
                        val trimmed = message.trim()
                        val payload = if (trimmed.isEmpty()) "我是${profile.name.ifBlank { "旅人" }}：${profile.bio}" else trimmed
                        val ok = runCatching {
                            service.respondBounty(bountyId, payload.take(500))
                        }.isSuccess
                        sending = false
                        showCardModal = false
                        if (ok) {
                            addSentId(context, bountyId)
                            sent = true
                            ToastCenter.show("名片已发送给发帖人")
                            remote = runCatching { service.getBounty(bountyId) }.getOrNull()
                        } else {
                            ToastCenter.show("发送失败，请稍后重试")
                        }
                    }
                },
            )
        }

        // 会话中途失效时补登录
        AuthGateHost()
    }
}

@Composable
private fun Publisher(base: Bounty?, usesDemoData: Boolean, demoDetail: DemoData.BountyDetail) {
    val name = if (usesDemoData) demoDetail.asker else "匿名旅人"
    val meta = if (usesDemoData) "${demoDetail.city} · ${demoDetail.time}发布" else "已发布"
    val hue = (base?.id ?: 0) % 5
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
        Box(
            Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(Theme.hue(hue).gradient),
            contentAlignment = Alignment.Center,
        ) {
            Text(name.take(1), color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(name, color = Theme.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text(meta, color = Theme.faint, fontSize = 11.sp)
        }
    }
}

/** 杏色悬赏卡。演示数据展示 ¥金额，真实数据展示 reward 文案。 */
@Composable
private fun PrizeCard(base: Bounty?, usesDemoData: Boolean, demoDetail: DemoData.BountyDetail, statusText: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(
                Brush.linearGradient(listOf(Color(0xFFFFC98A), Color(0xFFFFB067), Color(0xFFF08E4E))),
            )
            .padding(horizontal = 17.dp, vertical = 15.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text("本帖悬赏", color = Color(0xFF2B1A08).copy(alpha = 0.75f), fontSize = 10.5.sp)
            if (usesDemoData) {
                Text("¥${demoDetail.amount}", color = Color(0xFF2B1A08), fontSize = 24.sp, fontWeight = FontWeight.Black)
            } else {
                Text(base?.reward.orEmpty(), color = Color(0xFF2B1A08), fontSize = 17.sp, fontWeight = FontWeight.Black)
            }
        }
        Text(statusText, color = Color(0xFF2B1A08).copy(alpha = 0.8f), fontSize = 11.5.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun CopyBlock(detail: String) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Theme.Radius.card))
            .background(Theme.card)
            .border(1.dp, Theme.line, RoundedCornerShape(Theme.Radius.card))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Text("TA 想了解的具体情况", color = Theme.ink, fontSize = 13.5.sp, fontWeight = FontWeight.Bold)
        Text(detail, color = Theme.sub, fontSize = 12.5.sp, lineHeight = 19.sp)
    }
}

@Composable
private fun Replies(
    remote: BountyDetailResponse?,
    usesDemoData: Boolean,
    demoDetail: DemoData.BountyDetail,
    didFinishRemoteLoad: Boolean,
    responseCountText: String,
    bountyId: Int,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("亲历者回应", color = Theme.ink, fontSize = 13.5.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Text(responseCountText, color = Theme.faint, fontSize = 11.sp)
        }
        when {
            remote != null -> {
                if (remote.responses.isEmpty()) {
                    EmptyReplies()
                } else {
                    remote.responses.forEachIndexed { i, reply ->
                        ReplyRow(
                            name = anonymousName(reply.userId),
                            role = "亲历者",
                            text = reply.message,
                            hue = (bountyId + i + 2) % 5,
                        )
                    }
                }
            }
            usesDemoData -> {
                if (demoDetail.replies.isEmpty()) {
                    EmptyReplies()
                } else {
                    demoDetail.replies.forEachIndexed { i, reply ->
                        ReplyRow(reply.name, reply.role, reply.text, (bountyId + i + 2) % 5)
                    }
                }
            }
            else -> {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Theme.raised)
                        .padding(13.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (!didFinishRemoteLoad) {
                        CircularProgressIndicator(color = Theme.faint, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
                    }
                    Text(
                        if (didFinishRemoteLoad) "回应暂时加载失败，请稍后再试。" else "正在加载回应…",
                        color = Theme.faint,
                        fontSize = 12.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun EmptyReplies() {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Theme.raised)
            .padding(13.dp),
    ) {
        Text("还没有旅人回应，成为第一个分享经历的人吧。", color = Theme.faint, fontSize = 12.sp)
    }
}

@Composable
private fun ReplyRow(name: String, role: String, text: String, hue: Int) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Theme.raised)
            .padding(13.dp),
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(Theme.hue(hue).gradient),
            contentAlignment = Alignment.Center,
        ) {
            Text(name.take(1), color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(name, color = Theme.ink, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                Text(role, color = Theme.blue, fontSize = 10.sp)
            }
            Text(text, color = Theme.sub, fontSize = 12.sp, lineHeight = 17.sp)
        }
    }
}

// MARK: 名片弹层（原型 openBountyCardModal）

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun CardModal(sending: Boolean, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    val context = LocalContext.current
    val profile = remember { loadMyProfile(context) }
    var message by remember { mutableStateOf("") }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF10131C),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp)
                .padding(top = 4.dp, bottom = 26.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("发送我的名片", color = Theme.ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)

            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Theme.card)
                    .border(1.dp, Theme.line, RoundedCornerShape(16.dp))
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                    Box(
                        Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(Theme.hue(profile.hue).gradient),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(profile.name.take(1).ifBlank { "旅" }, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(profile.name.ifBlank { "旅人" }, color = Theme.ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        Text(profile.bio, color = Theme.sub, fontSize = 11.5.sp)
                    }
                }
                if (profile.tags.isNotEmpty()) {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        profile.tags.forEach { CommunityTagPill(it) }
                    }
                }
            }

            Text("补充一句话，让对方知道你为什么能回答", color = Theme.sub, fontSize = 11.5.sp)
            ComposeInputField(
                value = message,
                onValueChange = { message = it },
                placeholder = "例如：我去年完成了相似转型，可以分享第一份工作的准备过程。",
                minHeight = 84.dp,
            )
            Text(
                "发送后，你的回应会和公开画像一起展示在这条悬赏下，所有旅人可见；请不要在补充说明中留下联系方式。",
                color = Theme.faint,
                fontSize = 10.5.sp,
                lineHeight = 16.sp,
            )

            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(999.dp))
                    .background(if (sending) SolidColor(Theme.raised) else Theme.buttonGradient)
                    .communityClickable { if (!sending) onConfirm(message) }
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(if (sending) "发送中…" else "确认发送名片", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

/** 通用多行输入框（玻璃底 + 边框），供名片弹层与发帖表单复用。 */
@Composable
internal fun ComposeInputField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    minHeight: androidx.compose.ui.unit.Dp = 44.dp,
) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(13.dp))
            .background(Theme.raised)
            .border(1.dp, Theme.line, RoundedCornerShape(13.dp))
            .padding(12.dp),
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(color = Theme.ink, fontSize = 12.5.sp, lineHeight = 18.sp),
            cursorBrush = SolidColor(Theme.blue),
            modifier = Modifier
                .fillMaxWidth()
                .height(minHeight),
        )
        if (value.isEmpty()) {
            Text(placeholder, color = Theme.faint, fontSize = 12.5.sp, lineHeight = 18.sp)
        }
    }
}

// MARK: 本地存储辅助

private fun sentIds(context: Context): Set<Int> {
    val prefs = context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
    return prefs.getStringSet(SENT_KEY, emptySet())
        ?.mapNotNull { it.toIntOrNull() }?.toSet() ?: emptySet()
}

private fun addSentId(context: Context, id: Int) {
    val prefs = context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
    val next = sentIds(context) + id
    prefs.edit().putStringSet(SENT_KEY, next.map { it.toString() }.toSet()).apply()
}

private fun loadMyProfile(context: Context): MyProfile {
    val prefs = context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
    val raw = prefs.getString(MY_PROFILE_KEY, null) ?: return MyProfile.defaultProfile
    return runCatching { lenientJson.decodeFromString<MyProfile>(raw) }.getOrDefault(MyProfile.defaultProfile)
}

/** 匿名展示：user_id 截短为「旅人 #XXXX」。 */
private fun anonymousName(userId: String): String =
    "旅人 #${userId.take(4).uppercase()}"
