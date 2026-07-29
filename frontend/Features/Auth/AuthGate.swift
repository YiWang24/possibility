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

    /// 游客则弹登录页并记住待办动作；正式用户直接执行
    func require(_ supabase: SupabaseService, then action: @escaping @MainActor () -> Void) {
        if supabase.isAnonymous {
            pendingAction = action
            showLogin = true
        } else {
            action()
        }
    }

    /// LoginSheet 登录成功：收起后稍等 sheet 关闭动画，再继续原动作
    /// （立即执行可能与 sheet dismiss 的呈现互相打架）
    func loginSucceeded() {
        showLogin = false
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
