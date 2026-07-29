import SwiftUI
import AuthenticationServices

// MARK: - 登录页（技术设计文档 §登录系统）
//
// 手机验证码（两步式：输号码 → 输验证码）+ Apple 登录；微信按钮位预留（资质到位后启用）。
// 匿名数据处理：手机号走 updateUser 原地转正（user_id 不变）；Apple / 已注册手机号
// 走新会话 + merge-anonymous 迁移，均由 SupabaseService 封装，本视图只管交互。

struct LoginSheet: View {
    /// 登录成功回调（AuthGate 继续被拦截的动作）
    var onSuccess: () -> Void = {}

    @Environment(\.dismiss) private var dismiss
    @Environment(SupabaseService.self) private var supabase

    private enum Step { case phone, code }
    @State private var step: Step = .phone
    @State private var phone = ""
    @State private var code = ""
    @State private var flow: SupabaseService.PhoneOTPFlow = .linkAnonymous
    @State private var busy = false
    @State private var errorText: String?
    @State private var resendCountdown = 0
    @State private var appleNonce = ""

    /// 微信登录预留位：开放平台资质到位、wechat-login 函数上线后置 true
    private let wechatEnabled = false

    private var phoneValid: Bool {
        let digits = phone.filter(\.isNumber)
        return digits.count == 11 && digits.hasPrefix("1")
    }
    private var codeValid: Bool { code.filter(\.isNumber).count == 6 }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                switch step {
                case .phone: phoneStep
                case .code: codeStep
                }

                divider

                appleButton
                if wechatEnabled { wechatButton }

                Text("登录即代表同意用户协议与隐私政策。游客数据在登录后自动并入你的账号。")
                    .font(.system(size: 10.5)).lineSpacing(4).foregroundStyle(Theme.faint)
            }
            .padding(.horizontal, 22).padding(.top, 24).padding(.bottom, 26)
        }
        .scrollIndicators(.hidden)
    }

    // MARK: 头部

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("登录 Possibility").font(.system(size: 17, weight: .bold)).foregroundStyle(Theme.ink)
            Text("发布、回应与公开主页需要一个可以找回的账号。")
                .font(.system(size: 11.5)).foregroundStyle(Theme.sub)
        }
    }

    // MARK: 手机号步骤

    private var phoneStep: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("手机号登录").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.sub)
            HStack(spacing: 10) {
                Text("+86").font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.ink)
                TextField("", text: $phone, prompt: Text("请输入手机号").foregroundStyle(Theme.faint))
                    .font(.system(size: 14)).foregroundStyle(Theme.ink)
                    .keyboardType(.numberPad)
                    .textContentType(.telephoneNumber)
            }
            .padding(.horizontal, 14).padding(.vertical, 13)
            .background(Theme.raised, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))

            if let errorText { hint(errorText) }

            Button(busy ? "发送中…" : "获取验证码") { sendCode() }
                .font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(phoneValid && !busy ? AnyShapeStyle(Theme.buttonGradient) : AnyShapeStyle(Theme.raised), in: Capsule())
                .buttonStyle(PressScaleStyle())
                .disabled(!phoneValid || busy)
        }
    }

    // MARK: 验证码步骤

    private var codeStep: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("验证码已发送至 +86 \(phone)")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.sub)
                Spacer()
                Button("换个号码") {
                    step = .phone
                    code = ""
                    errorText = nil
                }
                .font(.system(size: 11.5)).foregroundStyle(Theme.blue)
            }
            TextField("", text: $code, prompt: Text("6 位验证码").foregroundStyle(Theme.faint))
                .font(.system(size: 18, weight: .semibold)).foregroundStyle(Theme.ink)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .padding(.horizontal, 14).padding(.vertical, 13)
                .background(Theme.raised, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))

            if let errorText { hint(errorText) }

            Button(busy ? "验证中…" : "登录") { verifyCode() }
                .font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(codeValid && !busy ? AnyShapeStyle(Theme.buttonGradient) : AnyShapeStyle(Theme.raised), in: Capsule())
                .buttonStyle(PressScaleStyle())
                .disabled(!codeValid || busy)

            Button(resendCountdown > 0 ? "重新发送（\(resendCountdown)s）" : "重新发送") { sendCode() }
                .font(.system(size: 12)).foregroundStyle(resendCountdown > 0 ? Theme.faint : Theme.blue)
                .frame(maxWidth: .infinity)
                .disabled(resendCountdown > 0 || busy)
        }
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

    private func hint(_ text: String) -> some View {
        Text(text).font(.system(size: 11)).foregroundStyle(Theme.orange)
    }

    // MARK: 动作

    private func sendCode() {
        guard phoneValid, !busy else { return }
        busy = true
        errorText = nil
        Task {
            do {
                flow = try await supabase.sendPhoneOTP(phone)
                step = .code
                startResendCountdown()
            } catch {
                errorText = "验证码发送失败：\(error.localizedDescription)"
            }
            busy = false
        }
    }

    private func verifyCode() {
        guard codeValid, !busy else { return }
        busy = true
        errorText = nil
        Task {
            do {
                try await supabase.verifyPhoneOTP(phone, code: code.filter(\.isNumber), flow: flow)
                busy = false
                dismiss()
                onSuccess()
            } catch {
                busy = false
                errorText = "验证码不正确或已过期，请重试"
            }
        }
    }

    private func handleApple(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            busy = true
            errorText = nil
            Task {
                do {
                    let credential = try AppleSignIn.credential(from: authorization)
                    try await supabase.signInWithApple(
                        idToken: credential.idToken,
                        nonce: appleNonce,
                        fullName: credential.fullName
                    )
                    busy = false
                    dismiss()
                    onSuccess()
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

    private func startResendCountdown() {
        resendCountdown = 60
        Task {
            while resendCountdown > 0 {
                try? await Task.sleep(for: .seconds(1))
                resendCountdown -= 1
            }
        }
    }
}

#Preview {
    LoginSheet()
        .environment(SupabaseService())
        .preferredColorScheme(.dark)
        .background(Theme.paper)
}
