import SwiftUI
import AuthenticationServices

// MARK: - 登录页（技术设计文档 §登录系统）
//
// 邮箱 + 密码（登录 / 注册切 tab，字段完全一致）+ Apple 登录；微信按钮位预留。
// 同一个视图两种呈现：
//   .wall  —— 冷启动无会话时的全屏登录墙（RootView 分流，见 PossibilityApp）
//   .sheet —— 会话中途过期时 AuthGate 就地弹出的补登录
// 差别只在头部文案与外框，表单与第三方登录完全共用。

struct LoginSheet: View {

    enum Presentation { case wall, sheet }

    var presentation: Presentation = .sheet
    /// 登录成功回调（AuthGate 继续被拦截的动作；登录墙由 isAuthenticated 自动切走）
    var onSuccess: () -> Void = {}

    @Environment(\.dismiss) private var dismiss
    @Environment(SupabaseService.self) private var supabase
    @Environment(ToastCenter.self) private var toast

    private enum Mode { case signIn, signUp }
    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var busy = false
    @State private var errorText: String?
    @State private var noticeText: String?
    @State private var appleNonce = ""

    /// 与 config.toml 的 minimum_password_length 保持一致
    private static let minPasswordLength = 6

    /// 微信登录预留位：开放平台资质到位、wechat-login 函数上线后置 true
    private let wechatEnabled = false

    private var emailValid: Bool {
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        guard let at = trimmed.firstIndex(of: "@"), at != trimmed.startIndex else { return false }
        let domain = trimmed[trimmed.index(after: at)...]
        return !domain.isEmpty && domain.contains(".") && !domain.hasSuffix(".") && !domain.contains("@")
    }
    private var passwordValid: Bool { password.count >= Self.minPasswordLength }
    private var canSubmit: Bool { emailValid && passwordValid && !busy }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                modePicker
                fields
                if let errorText { hint(errorText, tint: Theme.orange) }
                if let noticeText { hint(noticeText, tint: Theme.blue) }
                submitButton

                divider

                appleButton
                if wechatEnabled { wechatButton }

                Text("继续即代表同意用户协议与隐私政策。")
                    .font(.system(size: 10.5)).lineSpacing(4).foregroundStyle(Theme.faint)
            }
            .padding(.horizontal, 22).padding(.top, presentation == .wall ? 56 : 24).padding(.bottom, 26)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: 头部

    @ViewBuilder
    private var header: some View {
        switch presentation {
        case .wall:
            // 登录墙：靠尺度对比与一道极光竖线立住品牌，不用居中大标题的套路版式
            HStack(alignment: .top, spacing: 14) {
                Capsule().fill(Theme.aurora).frame(width: 3).frame(maxHeight: .infinity)
                VStack(alignment: .leading, spacing: 10) {
                    Text("POSSIBILITY · 万花筒")
                        .font(.system(size: 11)).tracking(3.5).foregroundStyle(Theme.faint)
                    Text("认识你自己，\n推演你的人生可能性")
                        .font(.system(size: 28, weight: .bold)).tracking(0.6).lineSpacing(6)
                        .foregroundStyle(Theme.ink)
                    Text("画像、推演与社区都绑定在你的账号上。用邮箱注册一个可以找回的身份，换设备也能接着往下走。")
                        .font(.system(size: 12.5)).lineSpacing(6).foregroundStyle(Theme.sub)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            .padding(.bottom, 8)

        case .sheet:
            VStack(alignment: .leading, spacing: 6) {
                Text("登录 Possibility").font(.system(size: 17, weight: .bold)).foregroundStyle(Theme.ink)
                Text("会话已过期，重新登录后继续刚才的操作。")
                    .font(.system(size: 11.5)).foregroundStyle(Theme.sub)
            }
        }
    }

    // MARK: 登录 / 注册切换

    private var modePicker: some View {
        HStack(spacing: 7) {
            modeTab("登录", value: .signIn)
            modeTab("注册", value: .signUp)
        }
    }

    private func modeTab(_ title: String, value: Mode) -> some View {
        let on = mode == value
        return Button {
            mode = value
            errorText = nil
            noticeText = nil
        } label: {
            Text(title)
                .font(.system(size: 12.5, weight: on ? .semibold : .regular))
                .foregroundStyle(on ? Color.white : Theme.sub)
                .frame(maxWidth: .infinity).padding(.vertical, 9)
                .background(on ? AnyShapeStyle(Theme.buttonGradient) : AnyShapeStyle(Theme.raised), in: Capsule())
        }
        .buttonStyle(PressScaleStyle())
    }

    // MARK: 输入

    private var fields: some View {
        VStack(alignment: .leading, spacing: 10) {
            field {
                TextField("", text: $email, prompt: Text("邮箱地址").foregroundStyle(Theme.faint))
                    .font(.system(size: 14)).foregroundStyle(Theme.ink)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
            field {
                Group {
                    if showPassword {
                        TextField("", text: $password, prompt: passwordPrompt)
                    } else {
                        SecureField("", text: $password, prompt: passwordPrompt)
                    }
                }
                .font(.system(size: 14)).foregroundStyle(Theme.ink)
                .textContentType(mode == .signUp ? .newPassword : .password)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.go)
                .onSubmit { submit() }

                Button(showPassword ? "隐藏" : "显示") { showPassword.toggle() }
                    .font(.system(size: 11.5)).foregroundStyle(Theme.sub)
                    .buttonStyle(PressScaleStyle())
                    .accessibilityLabel(showPassword ? "隐藏密码" : "显示密码")
            }
        }
    }

    private var passwordPrompt: Text {
        Text("密码（至少 \(Self.minPasswordLength) 位）").foregroundStyle(Theme.faint)
    }

    private func field<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        HStack(spacing: 10) { content() }
            .padding(.horizontal, 14).padding(.vertical, 13)
            .background(Theme.raised, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }

    private var submitButton: some View {
        Button(submitTitle) { submit() }
            .font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
            .frame(maxWidth: .infinity).padding(.vertical, 14)
            .background(canSubmit ? AnyShapeStyle(Theme.buttonGradient) : AnyShapeStyle(Theme.raised), in: Capsule())
            .buttonStyle(PressScaleStyle())
            .disabled(!canSubmit)
    }

    private var submitTitle: String {
        if busy { return mode == .signUp ? "注册中…" : "登录中…" }
        return mode == .signUp ? "注册并进入" : "登录"
    }

    // MARK: 第三方登录

    private var divider: some View {
        HStack(spacing: 12) {
            Rectangle().fill(Theme.line).frame(height: 1)
            Text("或").font(.system(size: 11)).foregroundStyle(Theme.faint)
            Rectangle().fill(Theme.line).frame(height: 1)
        }
    }

    private var appleButton: some View {
        SignInWithAppleButton(.signIn) { request in
            // 这个闭包在用户点按后、系统授权面板拉起前执行 —— 即「发起 Apple 登录」
            Analytics.shared.track(.authAppleStarted)
            let nonce = AppleSignIn.randomNonce()
            appleNonce = nonce
            request.requestedScopes = [.fullName]
            request.nonce = AppleSignIn.sha256(nonce)
        } onCompletion: { result in
            handleApple(result)
        }
        .signInWithAppleButtonStyle(.white)
        .frame(height: 48)
        .clipShape(Capsule())
        .disabled(busy)
    }

    /// 微信登录（预留）：拉起微信 SDK 拿 code → wechat-login Edge Function 换 session
    private var wechatButton: some View {
        Button {
            // TODO(wechat-login): 微信开放平台资质到位后实现
        } label: {
            Text("微信登录")
                .font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(Color(hex: 0x07C160), in: Capsule())
        }
        .buttonStyle(PressScaleStyle())
    }

    private func hint(_ text: String, tint: Color) -> some View {
        Text(text).font(.system(size: 11)).foregroundStyle(tint)
    }

    // MARK: 动作

    private func submit() {
        guard canSubmit else { return }
        busy = true
        errorText = nil
        noticeText = nil
        let address = email.trimmingCharacters(in: .whitespaces)
        Task {
            do {
                switch mode {
                case .signUp:
                    let sent = try await supabase.signUp(email: address, password: password)
                    // 注册即登录：本页马上随登录墙消失，提示只能交给根部 toast。
                    // 措辞要说清「不验证也能用」，否则用户会以为卡在验证这一步。
                    toast.show(
                        sent
                            ? "验证邮件已发送至 \(address)，稍后验证即可，不影响使用"
                            : "验证邮件发送失败，不影响使用，可稍后在「我」里重发",
                        duration: .seconds(5)
                    )
                case .signIn: try await supabase.signIn(email: address, password: password)
                }
                busy = false
                finishSuccess()
            } catch let error as SupabaseService.EmailConfirmationRequired {
                // 线上开了确认邮件才会走到：此时还没有会话，不能当成功继续
                busy = false
                mode = .signIn
                noticeText = error.localizedDescription
            } catch {
                busy = false
                // 邮箱已注册：直接把用户送到登录 tab，省掉一次「为什么失败」的猜测
                if mode == .signUp, SupabaseService.isEmailExistsError(error) { mode = .signIn }
                errorText = SupabaseService.authErrorMessage(error)
            }
        }
    }

    private func handleApple(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            busy = true
            errorText = nil
            noticeText = nil
            Task {
                do {
                    let credential = try AppleSignIn.credential(from: authorization)
                    try await supabase.signInWithApple(
                        idToken: credential.idToken,
                        nonce: appleNonce,
                        fullName: credential.fullName
                    )
                    busy = false
                    finishSuccess()
                } catch {
                    busy = false
                    errorText = "Apple 登录失败：\(error.localizedDescription)"
                }
            }
        case .failure(let error):
            // 用户主动取消不算错误
            if (error as? ASAuthorizationError)?.code != .canceled {
                errorText = "Apple 登录失败，请重试"
            }
        }
    }

    /// 登录墙由 isAuthenticated 自动切走，不需要（也不能）dismiss —— 它不是被 present 出来的
    private func finishSuccess() {
        guard presentation == .sheet else { return }
        dismiss()
        onSuccess()
    }
}

// MARK: - 全屏登录墙（冷启动无会话）

/// 全部 Edge Function 都强制校验 JWT，未登录时任何页面都只会换回一片 401，
/// 所以冷启动直接拦在这里，而不是让用户进去看一屏报错。
struct AuthWallView: View {
    var body: some View {
        LoginSheet(presentation: .wall)
            .screenBackground()
    }
}

// ToastCenter 由 RootView 注入（注册成功提示要跨越登录墙 → 主界面的切换），
// 预览没有 RootView，得各自补一个，否则 @Environment 取不到值直接崩在 canvas。
#Preview("登录墙") {
    AuthWallView()
        .environment(SupabaseService())
        .environment(ToastCenter())
        .preferredColorScheme(.dark)
}

#Preview("补登录 sheet") {
    LoginSheet()
        .environment(SupabaseService())
        .environment(ToastCenter())
        .preferredColorScheme(.dark)
        .background(Theme.paper)
}
