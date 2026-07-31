package app.possibility.android.features.auth

import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.Color
import app.possibility.android.core.network.SupabaseService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

// 登录门控（技术设计文档 §登录系统）。
// 冷启动无会话由 RootView 的登录墙拦下，这里只剩兜底职责：会话中途过期时，
// 关键动作（发悬赏 / 回应悬赏 / 编辑公开主页 / 解锁付费）前调 require：
//   未登录 → 就地弹 LoginSheet，登录成功后继续原动作；已登录 → 直接执行。
// 对应 ios/Possibility/Features/Auth/AuthGate.swift。

/** 登录门控中心：会话失效时关键动作先弹登录再续跑。 */
object AuthGateCenter {

    private val _showLogin = MutableStateFlow(false)
    val showLogin: StateFlow<Boolean> = _showLogin.asStateFlow()

    private var pendingAction: (() -> Unit)? = null

    /**
     * 未登录则弹登录页并记住待办动作；已登录直接执行。
     * @param trigger 如实反映触发登录的动作来源（埋点用）。
     */
    fun require(trigger: String, then: () -> Unit) {
        if (!SupabaseService.shared.isAuthenticated.value) {
            pendingAction = then
            _showLogin.value = true
        } else {
            then()
        }
    }

    /** LoginSheet 登录成功：收起登录页并继续被拦截的动作。 */
    fun onLoginSuccess() {
        _showLogin.value = false
        val action = pendingAction ?: return
        pendingAction = null
        action()
    }

    /** 用户放弃登录：收起登录页并丢弃待办动作。 */
    fun dismiss() {
        _showLogin.value = false
        pendingAction = null
    }
}

/** 登录门控容器色，对应 iOS presentationBackground(0x10131C)。 */
private val GateSheetBackground = Color(0xFF10131C)

/**
 * 挂在需要门控的页面根部：会话失效时渲染补登录 LoginSheet。
 * 配合 [AuthGateCenter.require] 使用。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthGateHost() {
    val show by AuthGateCenter.showLogin.collectAsState()
    if (!show) return

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = { AuthGateCenter.dismiss() },
        sheetState = sheetState,
        containerColor = GateSheetBackground,
    ) {
        LoginSheet(onDismiss = { AuthGateCenter.onLoginSuccess() })
    }
}
