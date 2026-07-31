package app.possibility.android.core

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class AppTab(val title: String) {
    HOME("认识你自己"),
    LAB("人生实验室"),
    COMMUNITY("万花筒社区"),
    ME("我的主页"),
}

/** 跨 Tab 路由，对应 ios/Possibility/App/Navigation.swift 的 AppRouter。 */
object AppRouter {
    val selectedTab = MutableStateFlow(AppTab.HOME)

    private val _pendingLabQuestion = MutableStateFlow<String?>(null)
    val pendingLabQuestion: StateFlow<String?> = _pendingLabQuestion.asStateFlow()

    /** 对话页「去实验室」→ 切 Tab 并带入问题。 */
    fun openLab(question: String) {
        _pendingLabQuestion.value = question
        selectedTab.value = AppTab.LAB
    }

    fun consumeLabQuestion(): String? {
        val q = _pendingLabQuestion.value
        _pendingLabQuestion.value = null
        return q
    }
}

/** 全局轻提示。 */
object ToastCenter {
    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    fun show(text: String) {
        _message.value = text
    }

    fun dismiss() {
        _message.value = null
    }
}
