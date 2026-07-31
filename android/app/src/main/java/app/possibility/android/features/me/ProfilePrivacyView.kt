package app.possibility.android.features.me

import android.content.Intent
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.model.ProfileFact
import app.possibility.android.core.model.ProfilePrivacySnapshot
import app.possibility.android.core.model.ProfileProposal
import app.possibility.android.core.network.SupabaseService
import app.possibility.android.core.theme.Theme
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

// MARK: - 个人档案与 AI 隐私（对应 ios/Possibility/Features/Me/MeView.swift 的 ProfilePrivacyView）
//
// 画像事实确认 / 提案审核（accept/reject）/ AI 使用回执 / 按维度删除 / 可见性设置 / 一键清空。
// 所有写操作带 profile_revision 乐观锁（SupabaseService 已封装）。

private val dimensionKeys = listOf("personality", "skill", "like", "love", "family", "social", "life")
private val dimensionLabels = mapOf(
    "personality" to "人格底色", "skill" to "我擅长", "like" to "我喜欢",
    "love" to "恋爱关系", "family" to "家庭关系", "social" to "人际交往", "life" to "人生底牌",
)
private val sourceLabels = mapOf(
    "manual" to "本人填写", "assessment" to "测评结果", "card_game" to "卡牌选择",
    "chat" to "探索对话推断", "diary" to "日记推断", "legacy" to "历史资料",
)
private val purposeLabels = mapOf(
    "persona" to "动态 AI 形象", "chat" to "探索对话",
    "match" to "相似经历匹配", "lab" to "人生实验室", "community" to "社区与万花筒",
)

private sealed interface PendingAction {
    data class Dimension(val key: String) : PendingAction
    data object Clear : PendingAction
}

@Composable
fun ProfilePrivacySheet(onDismiss: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var snapshot by remember { mutableStateOf<ProfilePrivacySnapshot?>(null) }
    var loading by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf<String?>(null) }
    var errorText by remember { mutableStateOf<String?>(null) }
    var pendingAction by remember { mutableStateOf<PendingAction?>(null) }
    var exportJson by remember { mutableStateOf<String?>(null) }

    suspend fun reload() {
        loading = true
        errorText = null
        runCatching { SupabaseService.shared.fetchProfilePrivacy() }
            .onSuccess { snapshot = it }
            .onFailure { errorText = "暂时无法读取隐私设置，请稍后重试。" }
        loading = false
    }

    BackHandler { onDismiss() }
    LaunchedEffect(Unit) { reload() }

    fun confirm(fact: ProfileFact) {
        val revision = snapshot?.profileRevision ?: return
        busy = "fact:${fact.id}"
        errorText = null
        scope.launch {
            runCatching { SupabaseService.shared.confirmProfileFact(fact.id, revision) }
                .onSuccess { reload() }
                .onFailure { errorText = "确认失败，画像可能已在其他设备更新，请刷新后重试。" }
            busy = null
        }
    }

    fun review(proposal: ProfileProposal, accept: Boolean) {
        val revision = snapshot?.profileRevision ?: return
        busy = "proposal:${proposal.id}"
        errorText = null
        scope.launch {
            runCatching { SupabaseService.shared.reviewProfileProposal(proposal.id, accept, revision) }
                .onSuccess { reload() }
                .onFailure { errorText = "处理失败，画像可能已在其他设备更新，请刷新后重试。" }
            busy = null
        }
    }

    fun setVisibility(fact: ProfileFact) {
        val revision = snapshot?.profileRevision ?: return
        busy = "visibility:${fact.id}"
        errorText = null
        scope.launch {
            runCatching {
                SupabaseService.shared.setProfileFactVisibility(
                    fact.id,
                    if (fact.visibility == "public") "private" else "public",
                    revision,
                )
            }
                .onSuccess {
                    reload()
                    MyProfileStore.refreshFacts()
                }
                .onFailure { errorText = "修改失败，画像可能已在其他设备更新，请刷新后重试。" }
            busy = null
        }
    }

    fun run(action: PendingAction) {
        val revision = snapshot?.profileRevision ?: return
        busy = if (action is PendingAction.Dimension) "dimension:${action.key}" else "clear"
        errorText = null
        scope.launch {
            val result = runCatching {
                when (action) {
                    is PendingAction.Dimension -> {
                        SupabaseService.shared.deleteProfileDimension(action.key, revision)
                        MyProfileStore.clearDimensionCache(action.key)
                    }
                    PendingAction.Clear -> {
                        SupabaseService.shared.clearProfile(revision)
                        MyProfileStore.clearProfileCache()
                    }
                }
            }
            result.onSuccess {
                reload()
                ToastCenter.show("设置已更新")
            }.onFailure { errorText = "操作失败，画像可能已更新；请刷新后重试。" }
            busy = null
        }
    }

    fun exportProfile() {
        busy = "export"
        errorText = null
        scope.launch {
            runCatching { SupabaseService.shared.exportProfileData() }
                .onSuccess { exportJson = it }
                .onFailure { errorText = "导出失败，请稍后重试。" }
            busy = null
        }
    }

    Box(Modifier.fillMaxSize().background(Theme.stage)) {
        Column(Modifier.fillMaxSize().systemBarsPadding()) {
            // 顶栏
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 14.dp, bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier.size(34.dp).clip(CircleShape).background(Theme.raised).clickableNoRipple(onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.Close, contentDescription = "关闭", tint = Theme.ink, modifier = Modifier.size(18.dp))
                }
                Spacer(Modifier.width(12.dp))
                Text("个人档案与 AI 隐私", color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                Text(
                    "刷新",
                    color = if (loading || busy != null) Theme.faint else Theme.blue,
                    fontSize = 13.sp,
                    modifier = Modifier.clickableNoRipple { if (!loading && busy == null) scope.launch { reload() } },
                )
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))

            if (loading && snapshot == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        CircularProgressIndicator(color = Theme.blue, strokeWidth = 3.dp)
                        Text("正在读取个人档案…", color = Theme.sub, fontSize = 13.sp)
                    }
                }
            } else {
                Column(
                    Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp).padding(vertical = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(22.dp),
                ) {
                    errorText?.let { msg ->
                        Box(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
                                .background(Theme.orange.copy(alpha = 0.1f)).padding(12.dp),
                        ) {
                            Text(msg, color = Theme.orange, fontSize = 11.5.sp)
                        }
                    }
                    FactsSection(snapshot, busy, onConfirm = ::confirm, onVisibility = ::setVisibility) { pendingAction = PendingAction.Dimension(it) }
                    ProposalsSection(snapshot, busy, onReview = ::review)
                    ReceiptsSection(snapshot)
                    DataSection(busy, onExport = ::exportProfile) { pendingAction = PendingAction.Clear }
                }
            }
        }
    }

    // 二次确认（删除维度 / 清空）
    pendingAction?.let { action ->
        val (title, message) = when (action) {
            is PendingAction.Dimension ->
                "删除整个画像维度？" to "将永久删除“${dimensionLabels[action.key] ?: action.key}”及其来源记录。"
            PendingAction.Clear ->
                "清空全部画像？" to "全部画像事实将永久删除；你的主页基础资料不会受到影响。"
        }
        AlertDialog(
            onDismissRequest = { pendingAction = null },
            containerColor = Theme.card,
            title = { Text(title, color = Theme.ink, fontWeight = FontWeight.Bold) },
            text = { Text(message, color = Theme.sub, fontSize = 13.sp) },
            confirmButton = {
                TextButton(onClick = {
                    pendingAction = null
                    run(action)
                }) { Text("确认", color = Theme.orange, fontWeight = FontWeight.SemiBold) }
            },
            dismissButton = {
                TextButton(onClick = { pendingAction = null }) { Text("取消", color = Theme.sub) }
            },
        )
    }

    // 导出结果
    exportJson?.let { jsonText ->
        AlertDialog(
            onDismissRequest = { exportJson = null },
            containerColor = Theme.card,
            title = { Text("档案已准备完成", color = Theme.ink, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "JSON 包含画像事实、来源与最小化 AI 使用记录。你可以分享或保存给自己。",
                        color = Theme.sub,
                        fontSize = 13.sp,
                        lineHeight = 19.sp,
                    )
                    Box(
                        Modifier.fillMaxWidth().heightIn(max = 220.dp)
                            .clip(RoundedCornerShape(12.dp)).background(Theme.raised)
                            .verticalScroll(rememberScrollState()).padding(12.dp),
                    ) {
                        Text(jsonText, color = Theme.sub, fontSize = 11.sp)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val send = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, jsonText)
                    }
                    context.startActivity(Intent.createChooser(send, "分享 / 保存 JSON"))
                    exportJson = null
                }) { Text("分享 / 保存 JSON", color = Theme.blue, fontWeight = FontWeight.SemiBold) }
            },
            dismissButton = {
                TextButton(onClick = { exportJson = null }) { Text("关闭", color = Theme.sub) }
            },
        )
    }
}

// MARK: 画像事实

@Composable
private fun FactsSection(
    snapshot: ProfilePrivacySnapshot?,
    busy: String?,
    onConfirm: (ProfileFact) -> Unit,
    onVisibility: (ProfileFact) -> Unit,
    onDeleteDimension: (String) -> Unit,
) {
    val grouped = (snapshot?.facts ?: emptyList()).groupBy { it.dimension }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text("画像事实", color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Text("版本 ${snapshot?.profileRevision ?: 0} · 本人确认与 AI 推断分开保存", color = Theme.faint, fontSize = 10.5.sp)
        }
        if (grouped.isEmpty()) {
            PrivacyEmpty("还没有画像事实")
        } else {
            dimensionKeys.filter { grouped[it]?.isNotEmpty() == true }.forEach { dimension ->
                Column(
                    Modifier.fillMaxWidth().privacyCard().padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(dimensionLabels[dimension] ?: dimension, color = Theme.ink, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        Text(
                            "删除整个维度",
                            color = Theme.orange,
                            fontSize = 10.5.sp,
                            modifier = Modifier.clickableNoRipple { if (busy == null) onDeleteDimension(dimension) },
                        )
                    }
                    (grouped[dimension] ?: emptyList()).forEach { fact ->
                        FactRow(fact, busy, onConfirm, onVisibility)
                    }
                }
            }
        }
    }
}

@Composable
private fun FactRow(fact: ProfileFact, busy: String?, onConfirm: (ProfileFact) -> Unit, onVisibility: (ProfileFact) -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Theme.raised).padding(11.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(fact.value, color = Theme.ink, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            Text(
                "${sourceLabels[fact.source] ?: fact.source} · 置信度 ${(fact.confidence * 100).roundToInt()}%",
                color = Theme.faint,
                fontSize = 9.5.sp,
            )
        }
        if (fact.userConfirmed) {
            Pill("已确认", Color(0xFF8EE7C8), Theme.teal.copy(alpha = 0.12f))
        } else {
            Box(
                Modifier.clip(RoundedCornerShape(999.dp)).background(Theme.blue.copy(alpha = 0.12f))
                    .clickableNoRipple { if (busy == null) onConfirm(fact) }
                    .padding(horizontal = 8.dp, vertical = 5.dp),
            ) {
                Text("确认准确", color = Theme.blue, fontSize = 9.5.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        val isPublic = fact.visibility == "public"
        Box(
            Modifier.clip(RoundedCornerShape(999.dp))
                .background(if (isPublic) Theme.teal.copy(alpha = 0.12f) else Theme.card)
                .clickableNoRipple { if (busy == null) onVisibility(fact) }
                .padding(horizontal = 8.dp, vertical = 5.dp),
        ) {
            Text(
                if (isPublic) "公开" else "私人",
                color = if (isPublic) Color(0xFF8EE7C8) else Theme.sub,
                fontSize = 9.5.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

// MARK: 待确认提案

@Composable
private fun ProposalsSection(snapshot: ProfilePrivacySnapshot?, busy: String?, onReview: (ProfileProposal, Boolean) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text("待你确认的理解", color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Text("Chat 和日记只能提出候选，不会直接覆盖正式画像", color = Theme.faint, fontSize = 10.5.sp)
        }
        val proposals = snapshot?.proposals ?: emptyList()
        if (proposals.isEmpty()) {
            PrivacyEmpty("暂无待确认内容")
        } else {
            proposals.forEach { proposal ->
                Column(
                    Modifier.fillMaxWidth().privacyCard().padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(proposal.value, color = Theme.ink, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    Text(
                        "${dimensionLabels[proposal.dimension] ?: proposal.dimension} · ${sourceLabels[proposal.sourceType] ?: proposal.sourceType} · 置信度 ${(proposal.confidence * 100).roundToInt()}%",
                        color = Theme.faint,
                        fontSize = 9.5.sp,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(
                            Modifier.weight(1f).clip(RoundedCornerShape(999.dp)).background(Theme.raised)
                                .clickableNoRipple { if (busy == null) onReview(proposal, false) }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("不是这样", color = Theme.sub, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        }
                        Box(
                            Modifier.weight(1f).clip(RoundedCornerShape(999.dp)).background(Theme.buttonGradient)
                                .clickableNoRipple { if (busy == null) onReview(proposal, true) }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("确认加入", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}

// MARK: AI 使用回执

@Composable
private fun ReceiptsSection(snapshot: ProfilePrivacySnapshot?) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text("最近 AI 使用记录", color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Text("只记录用途和维度，不保存发送给模型的原文", color = Theme.faint, fontSize = 10.5.sp)
        }
        val receipts = (snapshot?.accessReceipts ?: emptyList()).take(20)
        if (receipts.isEmpty()) {
            PrivacyEmpty("暂无长期画像使用记录")
        } else {
            Column(Modifier.fillMaxWidth().privacyCard()) {
                receipts.forEachIndexed { index, receipt ->
                    Column(
                        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(5.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(purposeLabels[receipt.purpose] ?: receipt.purpose, color = Theme.ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                            Text(receipt.createdAt.replace("T", " ").take(16), color = Theme.faint, fontSize = 9.5.sp)
                        }
                        Text(
                            "使用：${receipt.dimensions.joinToString("、") { dimensionLabels[it] ?: it }} · 版本 ${receipt.profileRevision}",
                            color = Theme.sub,
                            fontSize = 10.5.sp,
                        )
                        Text("公开 ${receipt.publicFactCount} 条 · 私人 ${receipt.privateFactCount} 条", color = Theme.faint, fontSize = 9.5.sp)
                    }
                    if (index < receipts.size - 1) {
                        Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
                    }
                }
            }
        }
    }
}

// MARK: 数据管理

@Composable
private fun DataSection(busy: String?, onExport: () -> Unit, onClear: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text("数据管理", color = Theme.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Text("公开事实会进入公开主页；私人事实只服务于你本人", color = Theme.faint, fontSize = 10.5.sp)
        }
        Column(Modifier.fillMaxWidth().privacyCard()) {
            PrivacyActionRow("导出完整个人档案", "包含事实、来源和使用记录", false, busy) { if (busy == null) onExport() }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
            PrivacyActionRow("清空全部画像", "删除公开和私人事实、卡牌结果及 AI 形象；主页基础资料保留", true, busy) { if (busy == null) onClear() }
        }
    }
}

@Composable
private fun PrivacyActionRow(title: String, detail: String, destructive: Boolean, busy: String?, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickableNoRipple(onClick).padding(horizontal = 14.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, color = if (destructive) Theme.orange else Theme.ink, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
            Text(detail, color = Theme.faint, fontSize = 9.5.sp)
        }
        if (busy != null) {
            CircularProgressIndicator(color = Theme.faint, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
        } else {
            Text("›", color = Theme.faint, fontSize = 15.sp)
        }
    }
}

// MARK: 小组件

@Composable
private fun Pill(text: String, textColor: Color, bg: Color) {
    Box(
        Modifier.clip(RoundedCornerShape(999.dp)).background(bg).padding(horizontal = 8.dp, vertical = 5.dp),
    ) {
        Text(text, color = textColor, fontSize = 9.5.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun PrivacyEmpty(text: String) {
    Box(
        Modifier.fillMaxWidth().privacyCard().padding(vertical = 27.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = Theme.faint, fontSize = 12.sp)
    }
}

private fun Modifier.privacyCard(): Modifier =
    this.clip(RoundedCornerShape(Theme.Radius.card)).background(Theme.card)
        .border(1.dp, Theme.line, RoundedCornerShape(Theme.Radius.card))
