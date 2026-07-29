import AuthenticationServices
import CryptoKit
import Foundation

// MARK: - Apple 登录工具（技术设计文档 §登录系统）
//
// 原生 signInWithIdToken 流：随机 nonce 原文交给 Supabase 校验，
// sha256(nonce) 放进 ASAuthorization request（Apple 会封进 id_token 的 nonce claim）。
// 姓名只在用户首次授权时返回 —— 拿到后立即写入 user metadata（LoginSheet 处理）。

enum AppleSignIn {

    /// 一次 Apple 登录所需的 idToken + 首次授权才有的姓名
    struct Credential {
        let idToken: String
        let fullName: String?
    }

    /// 密码学安全的随机 nonce（字母数字，默认 32 位）
    static func randomNonce(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var bytes = [UInt8](repeating: 0, count: length)
        let status = SecRandomCopyBytes(kSecRandomDefault, length, &bytes)
        precondition(status == errSecSuccess, "SecRandomCopyBytes failed: \(status)")
        return String(bytes.map { charset[Int($0) % charset.count] })
    }

    /// hex 编码的 SHA-256（ASAuthorizationAppleIDRequest.nonce 要求）
    static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }

    /// 从 SignInWithAppleButton 回调结果提取凭证
    static func credential(from authorization: ASAuthorization) throws -> Credential {
        guard
            let appleID = authorization.credential as? ASAuthorizationAppleIDCredential,
            let tokenData = appleID.identityToken,
            let idToken = String(data: tokenData, encoding: .utf8)
        else {
            throw AppleSignInError.missingIdentityToken
        }
        let fullName = appleID.fullName.flatMap {
            PersonNameComponentsFormatter.localizedString(from: $0, style: .default)
                .trimmingCharacters(in: .whitespaces)
        }
        return Credential(idToken: idToken, fullName: (fullName?.isEmpty ?? true) ? nil : fullName)
    }

    enum AppleSignInError: LocalizedError {
        case missingIdentityToken
        var errorDescription: String? { "未能获取 Apple 登录凭证，请重试。" }
    }
}
