package app.possibility.android.features.home

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.theme.Theme
import app.possibility.android.features.cardgame.CardGameHubSheet
import app.possibility.android.features.chat.ChatScreen
import app.possibility.android.features.diary.DiaryDetailSheet
import app.possibility.android.features.studio.AssessmentFlowSheet
import app.possibility.android.features.studio.AssessmentKind
import app.possibility.android.features.studio.ProfileStudioSheet
import app.possibility.android.features.studio.SelfDiscoveryScreen

// MARK: - 01 认识你自己（首页）—— 对应 ios/Possibility/Features/Home/HomeView.swift
//
// 问候 · 语音日记 · AI 发问 · 人生卡牌入口 · 动态画像。Tab 根，无入参。
// 各浮层（对话 / 日记详情 / 维度 / 工坊 / 测评 / 卡牌大厅）作为全屏覆盖层在本 composable 内管理开关。

@Composable
fun HomeScreen() {
    val context = LocalContext.current
    val model = remember { HomeModel(context.applicationContext) }

    // RECORD_AUDIO 运行时权限：拒绝或设备不支持时明确提示用户改用文字输入。
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* 结果无需处理：model 每次录音都会重新校验权限 */ }

    // 冷启动：读取本地画像 + 请求录音权限 + 拉取日记概览
    LaunchedEffect(Unit) {
        model.loadPortrait()
        if (!model.hasAudioPermission()) {
            permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }
    LaunchedEffect(Unit) { model.loadDiaryOverview() }
    DisposableEffect(Unit) { onDispose { model.dispose() } }

    // 浮层开关
    var chatLaunch by remember { mutableStateOf<Pair<String, String>?>(null) }
    var diaryLaunch by remember { mutableStateOf(false) }
    var activeDimension by remember { mutableStateOf<DimensionKey?>(null) }
    var assessmentKind by remember { mutableStateOf<AssessmentKind?>(null) }
    var showSelfDiscovery by remember { mutableStateOf(false) }
    var showStudio by remember { mutableStateOf(false) }
    var showCardHub by remember { mutableStateOf(false) }


    fun send() {
        if (!model.canSend) return
        chatLaunch = (model.topic?.label ?: "") to model.trimmedQuestion
    }

    fun handleDimTap(dim: HomeModel.PortraitDim) {
        val key = dim.dimensionKey
        if (key != null) activeDimension = key else assessmentKind = AssessmentKind.BIGFIVE
    }

    Box(Modifier.fillMaxSize().background(Theme.stage)) {
        Column(
            Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp)
                .padding(top = 20.dp, bottom = 40.dp),
        ) {
            Greet(model)
            Spacer(Modifier.height(18.dp))
            DiaryCard(model, onOpenDiary = { diaryLaunch = true })
            Spacer(Modifier.height(22.dp))
            HomeAskCard(model, onSend = ::send)
            Spacer(Modifier.height(14.dp))
            LifeEntryButton { showCardHub = true }
            Spacer(Modifier.height(24.dp))
            PortraitSection(model, onTapDim = ::handleDimTap) { showStudio = true }
        }
    }

    // 全屏覆盖浮层
    chatLaunch?.let { (topic, question) ->
        ChatScreen(topic = topic, initialQuestion = question, onDismiss = { chatLaunch = null })
    }
    if (diaryLaunch) {
        DiaryDetailSheet(onDismiss = { diaryLaunch = false })
    }
    activeDimension?.let { key ->
        DimensionSheet(
            dimension = key,
            initialSelected = model.selectedKeywords(key),
            onSave = { keywords -> model.saveDimension(key, keywords) },
            onStartAssessment = { kind -> activeDimension = null; assessmentKind = kind },
            onStartSelfDiscovery = { activeDimension = null; showSelfDiscovery = true },
            onDismiss = { activeDimension = null },
        )
    }
    assessmentKind?.let { kind ->
        AssessmentFlowSheet(kind = kind, onDismiss = { assessmentKind = null })
    }
    if (showSelfDiscovery) {
        SelfDiscoveryScreen(
            onSave = { likes, strengths ->
                model.saveDimension(DimensionKey.LIKE, likes)
                model.saveDimension(DimensionKey.SKILL, strengths)
            },
            onDismiss = { showSelfDiscovery = false },
        )
    }
    if (showStudio) {
        ProfileStudioSheet(onDismiss = { showStudio = false })
    }
    if (showCardHub) {
        CardGameHubSheet(onDismiss = { showCardHub = false })
    }
}

// MARK: 问候

@Composable
private fun Greet(model: HomeModel) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(model.todayText, color = Theme.faint, fontSize = 11.sp, letterSpacing = 3.sp)
            Text(model.greeting, color = Theme.ink, fontSize = 27.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp)
        }
        Spacer(Modifier.width(12.dp))
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("已探索", color = Theme.sub, fontSize = 12.sp)
            Text(
                "第 ${model.exploredDays} 天",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Theme.blue,
            )
        }
    }
}

// MARK: 动态画像区

@Composable
private fun PortraitSection(
    model: HomeModel,
    onTapDim: (HomeModel.PortraitDim) -> Unit,
    onOpenStudio: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        HomeSectionHeader("我的动态画像", "探索更多画像 ›", onOpenStudio)
        NietzscheQuote()
        PortraitCard(model, onTapDim = onTapDim)
    }
}
