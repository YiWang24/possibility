import Foundation
import Supabase

// MARK: - Auth 错误 → 中文文案（与 web/stores/auth.ts authErrorMessage 一一对应）
//
// 拆成独立文件而非塞进 SupabaseService.swift：那个文件已经贴着 800 行上限，
// 且「错误码怎么翻译成人话」是能独立读懂、也该独立演进的一件事。
//
// 按 errorCode 判定而不是匹配 message 文案：后者随 GoTrue 版本改动，
// 一改就悄悄退化成英文原文，而且没有任何测试会发现。

extension SupabaseService {

    /// 邮箱已被注册 —— 注册 tab 据此自动切到登录 tab
    nonisolated static func isEmailExistsError(_ error: Error) -> Bool {
        switch authErrorCode(error) {
        case "user_already_exists", "email_exists": return true
        default: return false
        }
    }

    /// Auth 错误 → 用户可读中文提示（未收录的错误码回落 localizedDescription）
    nonisolated static func authErrorMessage(_ error: Error) -> String {
        switch authErrorCode(error) {
        case "user_already_exists", "email_exists": return "该邮箱已注册，请直接登录"
        case "invalid_credentials": return "邮箱或密码不正确"
        case "weak_password": return "密码至少需要 6 位"
        case "validation_failed": return "邮箱格式不正确"
        case "email_not_confirmed": return "邮箱尚未验证，请查收确认邮件"
        case "over_request_rate_limit", "over_email_send_rate_limit": return "操作过于频繁，请稍后再试"
        default: return error.localizedDescription
        }
    }

    /// 取 GoTrue 错误码；非 AuthError（网络错误、本端自定义错误）返回 nil，
    /// 由调用方回落 localizedDescription —— 那些错误本就已经是中文或系统文案。
    nonisolated private static func authErrorCode(_ error: Error) -> String? {
        (error as? AuthError)?.errorCode.rawValue
    }
}
