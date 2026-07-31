package app.possibility.android.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.Hive
import androidx.compose.material.icons.filled.Science
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.possibility.android.core.AppRouter
import app.possibility.android.core.AppTab
import app.possibility.android.core.ToastCenter
import app.possibility.android.core.network.SupabaseService
import app.possibility.android.core.theme.Theme
import app.possibility.android.features.auth.AuthWallView
import app.possibility.android.features.community.CommunityScreen
import app.possibility.android.features.home.HomeScreen
import app.possibility.android.features.lab.LabScreen
import app.possibility.android.features.me.MeScreen
import kotlinx.coroutines.delay

private val darkScheme = darkColorScheme(
    primary = Theme.blue,
    background = Theme.stage,
    surface = Theme.paper,
    surfaceContainer = Theme.card,
    onPrimary = Theme.ink,
    onBackground = Theme.ink,
    onSurface = Theme.ink,
)

/** 根状态机：Splash → AuthWall → MainTab，对应 ios PossibilityApp.RootView。 */
@Composable
fun RootView() {
    MaterialTheme(colorScheme = darkScheme) {
        val service = SupabaseService.shared
        val isReady by service.isReady.collectAsState()
        val isAuthenticated by service.isAuthenticated.collectAsState()

        LaunchedEffect(Unit) { service.bootstrap() }

        Box(Modifier.fillMaxSize().background(Theme.stage)) {
            when {
                !isReady -> SplashView()
                !isAuthenticated -> AuthWallView()
                else -> MainTabView()
            }
            ToastOverlay(Modifier.align(Alignment.BottomCenter))
        }
    }
}

@Composable
private fun SplashView() {
    Box(Modifier.fillMaxSize().background(Theme.stage), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("我有可能", color = Theme.ink, fontSize = 30.sp, fontWeight = FontWeight.Bold)
            Text(
                "POSSIBILITY",
                color = Theme.sub,
                fontSize = 12.sp,
                letterSpacing = 4.sp,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

private fun tabIcon(tab: AppTab): ImageVector = when (tab) {
    AppTab.HOME -> Icons.Filled.AccountCircle
    AppTab.LAB -> Icons.Filled.Science
    AppTab.COMMUNITY -> Icons.Filled.Hive
    AppTab.ME -> Icons.Filled.Badge
}

@Composable
fun MainTabView() {
    val selected by AppRouter.selectedTab.collectAsState()

    Scaffold(
        containerColor = Theme.stage,
        bottomBar = {
            NavigationBar(containerColor = Theme.paper, tonalElevation = 0.dp) {
                AppTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selected == tab,
                        onClick = { AppRouter.selectedTab.value = tab },
                        icon = { Icon(tabIcon(tab), contentDescription = tab.title) },
                        label = { Text(tab.title, fontSize = 10.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Theme.blue,
                            selectedTextColor = Theme.blue,
                            unselectedIconColor = Theme.faint,
                            unselectedTextColor = Theme.faint,
                            indicatorColor = Theme.raised,
                        ),
                    )
                }
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when (selected) {
                AppTab.HOME -> HomeScreen()
                AppTab.LAB -> LabScreen()
                AppTab.COMMUNITY -> CommunityScreen()
                AppTab.ME -> MeScreen()
            }
        }
    }
}

@Composable
private fun ToastOverlay(modifier: Modifier = Modifier) {
    val message by ToastCenter.message.collectAsState()

    LaunchedEffect(message) {
        if (message != null) {
            delay(2600)
            ToastCenter.dismiss()
        }
    }

    AnimatedVisibility(visible = message != null, modifier = modifier, enter = fadeIn(), exit = fadeOut()) {
        Box(
            Modifier
                .navigationBarsPadding()
                .padding(bottom = 90.dp)
                .background(Theme.raised, RoundedCornerShape(999.dp))
                .padding(horizontal = 18.dp, vertical = 10.dp),
        ) {
            Text(message.orEmpty(), color = Theme.ink, fontSize = 13.sp)
        }
    }
}
