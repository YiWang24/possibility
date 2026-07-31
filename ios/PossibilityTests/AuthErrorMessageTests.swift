import Foundation
import Supabase
import Testing
@testable import Possibility

// MARK: - Auth 错误文案映射
//
// 这层映射的失效方式很安静：GoTrue 换个 message 措辞，用户就开始看到一串英文，
// 但没有任何请求失败、没有任何日志异常。所以按错误码逐条钉住。

@Suite("Auth 错误文案")
struct AuthErrorMessageTests {

    @Test("错误码 → 中文提示", arguments: [
        ("user_already_exists", "该邮箱已注册，请直接登录"),
        ("email_exists", "该邮箱已注册，请直接登录"),
        ("invalid_credentials", "邮箱或密码不正确"),
        ("weak_password", "密码至少需要 6 位"),
        ("validation_failed", "邮箱格式不正确"),
        ("email_not_confirmed", "邮箱尚未验证，请查收确认邮件"),
        ("over_request_rate_limit", "操作过于频繁，请稍后再试"),
        ("over_email_send_rate_limit", "操作过于频繁，请稍后再试"),
    ])
    func knownCodesMapToChineseCopy(code: String, expected: String) {
        #expect(SupabaseService.authErrorMessage(apiError(code: code)) == expected)
    }

    @Test("未收录的错误码回落原始描述，不吞掉信息")
    func unknownCodeFallsBackToLocalizedDescription() {
        let error = apiError(code: "some_new_code_2027")
        // 兜底文案宁可是英文原文，也不能是「未知错误」—— 后者让线上排查无从下手
        #expect(SupabaseService.authErrorMessage(error) == error.localizedDescription)
    }

    @Test("非 AuthError（网络中断等）原样透出系统文案")
    func nonAuthErrorPassesThrough() {
        let error = URLError(.notConnectedToInternet)
        #expect(SupabaseService.authErrorMessage(error) == error.localizedDescription)
    }

    @Test("邮箱占用判定只认这两个码", arguments: [
        ("user_already_exists", true),
        ("email_exists", true),
        ("invalid_credentials", false),
        ("weak_password", false),
    ])
    func emailExistsDetection(code: String, expected: Bool) {
        // 注册 tab 据此自动切到登录 tab；判错会把「密码太弱」也变成「已注册」
        #expect(SupabaseService.isEmailExistsError(apiError(code: code)) == expected)
    }

    private func apiError(code: String) -> AuthError {
        .api(
            message: "server message for \(code)",
            errorCode: ErrorCode(rawValue: code),
            underlyingData: Data(),
            underlyingResponse: HTTPURLResponse(
                url: URL(string: "https://example.supabase.co/auth/v1/signup")!,
                statusCode: 400, httpVersion: nil, headerFields: nil
            )!
        )
    }
}
