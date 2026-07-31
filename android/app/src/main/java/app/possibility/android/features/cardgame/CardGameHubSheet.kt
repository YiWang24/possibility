package app.possibility.android.features.cardgame

import android.content.SharedPreferences
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.model.CardGameManifestResponse
import app.possibility.android.core.network.SupabaseService
import app.possibility.android.core.theme.Theme
import kotlinx.serialization.builtins.ListSerializer

// MARK: - 卡牌游戏大厅（迁移自 ios/Possibility/Features/CardGame/CardGameHubView.swift）
//
// 全屏覆盖层。大厅拉取远端 manifest（SharedPreferences 按 content hash 缓存 + 内建兜底），
// 展示人生主卡 + 更多专题列表；完成/进行中角标 = 本地标记 ∪ 云端回读。点玩法进入 CardGameScreen。

private const val MANIFEST_CACHE_KEY = "card_game_manifest_cache_v1"
private const val MANIFEST_SIG_KEY = "card_game_manifest_sig_v1"

@Composable
fun CardGameHubSheet(onDismiss: () -> Unit) {
    val context = LocalContext.current
    val prefs = remember { CardGamePrefs.get(context) }
    val supabase = SupabaseService.shared

    var manifest by remember { mutableStateOf(loadCachedManifest(prefs)) }
    var completedKinds by remember { mutableStateOf<Set<CardGameKind>>(emptySet()) }
    var progressKinds by remember { mutableStateOf<Set<CardGameKind>>(emptySet()) }
    var didSyncRemote by remember { mutableStateOf(false) }
    var selectedKind by remember { mutableStateOf<CardGameKind?>(null) }

    val userScope by supabase.userId.collectAsState()

    fun currentKinds(): List<CardGameKind> {
        val games = if (manifest.isEmpty()) fallbackManifest() else manifest
        return games.mapNotNull { CardGameKind.fromKey(it.gameKey) }
    }

    fun refreshLocal() {
        val ks = currentKinds()
        completedKinds = CardGameLocalRecord.doneKinds(ks, userScope, prefs)
        progressKinds = CardGameLocalRecord.progressKinds(ks, userScope, prefs)
    }

    LaunchedEffect(Unit) {
        // 远端 manifest 优先，成功且非空则更新并按内容签名回写缓存
        val remote = runCatching { supabase.fetchCardGameManifest() }.getOrNull()
        if (!remote.isNullOrEmpty()) {
            manifest = remote
            persistManifest(prefs, remote)
        }
        runCatching { supabase.jwt() }
        refreshLocal()
        if (!didSyncRemote) {
            didSyncRemote = true
            val kinds = currentKinds()
            if (completedKinds.size < kinds.size) {
                val profile = runCatching { supabase.fetchRemoteProfile() }.getOrNull()
                profile?.cardGames?.forEach { game ->
                    val kind = CardGameKind.fromKey(game.kind)
                    if (kind != null && kinds.contains(kind) && game.finalCards.isNotEmpty() &&
                        !CardGameLocalRecord.isDone(kind, userScope, prefs)
                    ) {
                        restoreLocalCache(kind, game.finalCards, prefs)
                        CardGameLocalRecord.markDone(kind, userScope, prefs)
                    }
                }
                refreshLocal()
            }
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Theme.paper),
    ) {
        if (selectedKind != null) {
            BackHandler { selectedKind = null; refreshLocal() }
            CardGameScreen(kind = selectedKind!!, onExit = { selectedKind = null; refreshLocal() })
        } else {
            BackHandler { onDismiss() }
            HubContent(
                manifest = if (manifest.isEmpty()) fallbackManifest() else manifest,
                completedKinds = completedKinds,
                progressKinds = progressKinds,
                onBack = onDismiss,
                onLaunch = { selectedKind = it },
            )
        }
    }
}

@Composable
private fun HubContent(
    manifest: List<CardGameManifestResponse.Item>,
    completedKinds: Set<CardGameKind>,
    progressKinds: Set<CardGameKind>,
    onBack: () -> Unit,
    onLaunch: (CardGameKind) -> Unit,
) {
    val availableKinds = manifest.mapNotNull { CardGameKind.fromKey(it.gameKey) }
    val lifeItem = manifest.firstOrNull { CardGameKind.fromKey(it.gameKey) == CardGameKind.LIFE }
    Column(
        Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.systemBars),
    ) {
        // 顶栏
        Column {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(top = 14.dp, bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(Theme.raised)
                        .clickable { onBack() },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("‹", color = Theme.ink, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                }
                Text("卡牌探索", color = Theme.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Theme.line))
        }

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp)
                .padding(top = 16.dp, bottom = 34.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Hero()
            if (availableKinds.contains(CardGameKind.LIFE)) {
                LifePrimary(
                    introCopy = lifeItem?.introCopy ?: CardGameData.life.introCopy,
                    completed = completedKinds.contains(CardGameKind.LIFE),
                    inProgress = progressKinds.contains(CardGameKind.LIFE),
                    onClick = { onLaunch(CardGameKind.LIFE) },
                )
            }
            Text(
                "更多专题", color = Theme.faint,
                fontSize = 11.sp, letterSpacing = 1.sp,
                modifier = Modifier.padding(top = 4.dp),
            )
            manifest.filter { CardGameKind.fromKey(it.gameKey) != CardGameKind.LIFE }.forEach { item ->
                val kind = CardGameKind.fromKey(item.gameKey)
                if (kind != null) {
                    GameOption(
                        title = item.title,
                        sub = item.introCopy,
                        accent = rgb(accentValue(item.accent)),
                        glyph = item.glyph,
                        completed = completedKinds.contains(kind),
                        inProgress = progressKinds.contains(kind),
                        onClick = { onLaunch(kind) },
                    )
                }
            }
        }
    }
}

@Composable
private fun Hero() {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(
                Brush.linearGradient(listOf(rgb(0x141A34L), rgb(0x241A3EL), rgb(0x10132AL))),
            )
            .border(1.dp, rgba(0x8F7BFFL, 0.28f), RoundedCornerShape(22.dp))
            .padding(20.dp),
    ) {
        Text(
            "每套卡牌都会让你在有限的底牌里做选择。最终留下的牌，会成为画像的一部分。",
            color = Theme.sub, fontSize = 12.sp, lineHeight = 17.sp,
        )
    }
}

@Composable
private fun LifePrimary(
    introCopy: String,
    completed: Boolean,
    inProgress: Boolean,
    onClick: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(
                Brush.linearGradient(listOf(rgb(0x1B1A38L), rgb(0x241A45L), rgb(0x141329L))),
            )
            .border(1.dp, rgba(0x8F7BFFL, 0.32f), RoundedCornerShape(18.dp))
            .clickable { onClick() }
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            MiniDeck()
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    "LIFE CARDS · 5–8 分钟", color = rgb(0xB6A8FFL),
                    fontSize = 9.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.8.sp,
                )
                Text("人生卡牌：你最后会留下什么？", color = Theme.ink, fontSize = 15.5.sp, fontWeight = FontWeight.Bold)
                Text(introCopy, color = Theme.sub, fontSize = 11.sp, maxLines = 2)
            }
            if (completed || inProgress) StatusBadge(completed, inProgress)
            Text("›", color = Theme.faint, fontSize = 16.sp)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            RuleChip("01", "选择")
            RuleChip("02", "加码")
            RuleChip("03", "交换")
        }
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.RuleChip(no: String, label: String) {
    Row(
        Modifier
            .weight(1f)
            .clip(RoundedCornerShape(999.dp))
            .background(Color.White.copy(alpha = 0.06f))
            .padding(vertical = 7.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(no, color = rgb(0xB6A8FFL), fontSize = 9.5.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.width(6.dp))
        Text(label, color = Theme.sub, fontSize = 10.5.sp)
    }
}

@Composable
private fun MiniDeck() {
    Box(Modifier.width(44.dp).height(40.dp), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .offset(x = (-4).dp)
                .rotate(-10f)
                .width(26.dp)
                .height(36.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(Theme.hue(4).gradient),
        )
        Box(
            Modifier
                .offset(x = 4.dp)
                .rotate(9f)
                .width(26.dp)
                .height(36.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(Theme.hue(1).gradient),
        )
    }
}

@Composable
private fun GameOption(
    title: String,
    sub: String,
    accent: Color,
    glyph: String,
    completed: Boolean,
    inProgress: Boolean,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Theme.card)
            .border(1.dp, accent.copy(alpha = 0.24f), RoundedCornerShape(16.dp))
            .clickable { onClick() }
            .padding(horizontal = 15.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        Box(
            Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(13.dp))
                .background(accent.copy(alpha = 0.13f)),
            contentAlignment = Alignment.Center,
        ) {
            Text(glyph, color = accent, fontSize = 17.sp)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, color = Theme.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text(sub, color = Theme.sub, fontSize = 11.sp, maxLines = 2)
        }
        if (completed || inProgress) StatusBadge(completed, inProgress)
        Text("›", color = Theme.faint, fontSize = 15.sp)
    }
}

@Composable
private fun StatusBadge(completed: Boolean, inProgress: Boolean) {
    val pendingSync = completed && inProgress
    val title = when {
        pendingSync -> "待同步"
        completed -> "已完成"
        else -> "继续"
    }
    val color = when {
        pendingSync -> rgb(0xFFB096L)
        completed -> rgb(0x8EE7C8L)
        else -> rgb(0x9DBCFFL)
    }
    Text(
        title, color = color, fontSize = 9.5.sp, fontWeight = FontWeight.SemiBold,
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(color.copy(alpha = 0.12f))
            .border(1.dp, color.copy(alpha = 0.35f), RoundedCornerShape(999.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
    )
}

// MARK: 缓存 + 兜底 + 恢复

private fun manifestSignature(items: List<CardGameManifestResponse.Item>): String =
    items.joinToString("|") { "${it.gameKey}:${it.version}:${it.contentHash}" }

private fun loadCachedManifest(prefs: SharedPreferences): List<CardGameManifestResponse.Item> {
    val raw = prefs.getString(MANIFEST_CACHE_KEY, null) ?: return emptyList()
    return runCatching {
        CardGamePrefs.json.decodeFromString(
            ListSerializer(CardGameManifestResponse.Item.serializer()), raw,
        )
    }.getOrDefault(emptyList())
}

private fun persistManifest(prefs: SharedPreferences, items: List<CardGameManifestResponse.Item>) {
    val signature = manifestSignature(items)
    if (prefs.getString(MANIFEST_SIG_KEY, null) == signature) return
    runCatching {
        val encoded = CardGamePrefs.json.encodeToString(
            ListSerializer(CardGameManifestResponse.Item.serializer()), items,
        )
        prefs.edit()
            .putString(MANIFEST_CACHE_KEY, encoded)
            .putString(MANIFEST_SIG_KEY, signature)
            .apply()
    }
}

/** 内建兜底 manifest（对应 iOS fallbackManifest），源自本地四套牌库。 */
private fun fallbackManifest(): List<CardGameManifestResponse.Item> =
    CardGameKind.allCases.mapIndexed { index, kind ->
        val config = CardGameData.config(kind)
        CardGameManifestResponse.Item(
            gameKey = kind.rawValue,
            title = config.title,
            introCopy = config.introCopy,
            accent = String.format("#%06X", config.accent),
            glyph = config.glyph,
            version = config.catalogVersion,
            contentHash = config.contentHash ?: "built-in",
            sortOrder = index,
        )
    }

private fun accentValue(value: String): Long =
    value.trim().removePrefix("#").toLongOrNull(16) ?: 0x8F7BFFL

/** 远端最终卡组 → 本地展示模型：life 写人生底牌签名（本地无记录时）。 */
private fun restoreLocalCache(
    kind: CardGameKind,
    cards: List<app.possibility.android.core.model.CardGameCardPayload>,
    prefs: SharedPreferences,
) {
    if (kind != CardGameKind.LIFE) return
    if (prefs.contains(CardGamePrefs.LIFE_SIGNATURE_KEY)) return
    val signature = cards.map { LifeSignatureCard(glyph = it.glyph ?: "✦", name = it.name) }
    runCatching {
        val encoded = CardGamePrefs.json.encodeToString(
            ListSerializer(LifeSignatureCard.serializer()), signature,
        )
        prefs.edit().putString(CardGamePrefs.LIFE_SIGNATURE_KEY, encoded).apply()
    }
}
