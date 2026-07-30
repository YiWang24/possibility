import SwiftUI
import Observation

// MARK: - 登录门控（技术设计文档 §登录系统 · 游客模式 + 按需登录）
//
// 关键动作（发悬赏 / 回应悬赏 / 编辑公开主页 / 解锁付费）前调 require：
// 游客 → 就地弹 LoginSheet，登录成功后继续原动作；正式用户 → 直接执行。
// 呈现遵循项目导航策略「谁触发谁呈现」（见 Navigation.swift）：每个触发视图
// 自持一个 AuthGateCenter 并挂 .authGate(_:)，避免 fullScreenCover 挡住根部 sheet。

@Observable
@MainActor
final class AuthGateCenter {
    var showLogin = false
    private var pendingAction: (@MainActor () -> Void)?
    /// 本次弹窗由哪个动作触发 —— auth_prompted / auth_abandoned 的 trigger 来源。
    /// 登录成功时清空，这样成功后的 onDismiss 不会被记成「放弃登录」。
    private var pendingTrigger: AuthTrigger?

    /// 游客则弹登录页并记住待办动作；正式用户直接执行。
    /// - Parameter trigger: 如实反映触发登录的动作（docs/埋点方案.md §3.2）；
    ///   事件清单里没有对应取值的入口传 nil —— 不上报好过错报成别的动作。
    func require(_ supabase: SupabaseService,
                 trigger: AuthTrigger?,
                 then action: @escaping @MainActor () -> Void) {
        if supabase.isAnonymous {
            pendingAction = action
            pendingTrigger = trigger
            showLogin = true
            if let trigger {
                Analytics.shared.track(.authPrompted(trigger: trigger))
            }
        } else {
            action()
        }
    }

    /// LoginSheet 登录成功：收起后稍等 sheet 关闭动画，再继续原动作
    /// （立即执行可能与 sheet dismiss 的呈现互相打架）
    func loginSucceeded() {
        showLogin = false
        // 先于 sheet 的 onDismiss 清空，避免成功登录被 cancelled() 记为放弃
        pendingTrigger = nil
        guard let action = pendingAction else { return }
        pendingAction = nil
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(400))
            action()
        }
    }

    /// 用户放弃登录：丢弃待办动作
    func cancelled() {
        pendingAction = nil
        guard let trigger = pendingTrigger else { return }   // 已登录成功
        pendingTrigger = nil
        Analytics.shared.track(.authAbandoned(trigger: trigger))
    }
}

extension View {
    /// 挂载登录门控的 LoginSheet（配合 AuthGateCenter.require 使用）
    func authGate(_ gate: AuthGateCenter) -> some View {
        sheet(isPresented: Bindable(gate).showLogin, onDismiss: { gate.cancelled() }) {
            LoginSheet { gate.loginSucceeded() }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationBackground(Color(hex: 0x10131C))
        }
    }
}
