import Foundation
import Supabase

// MARK: - 会话变化 → 埋点身份（docs/埋点方案.md §2）
//
// 拆成独立文件而非塞进 SupabaseService.swift：那个文件已经贴着 800 行上限，
// 且埋点身份是一个能独立读懂的关注点 —— 会话怎么切是 Supabase 的事，
// 切完该 identify 还是 alias 是埋点的事。

extension SupabaseService {

    /// 把一次会话变化翻译成埋点动作。判定规则（user_id 变没变 → 要不要 alias）
    /// 集中在 `AnalyticsIdentityTransition.resolve`，三条路径由单测覆盖；
    /// 这里只负责在正确的时机喂进正确的新旧 id。
    func syncAnalyticsIdentity(previousUserId: UUID?, user: User) {
        AnalyticsIdentityTransition
            .resolve(previousUserId: previousUserId?.uuidString, newUserId: user.id.uuidString)
            .apply(properties: Self.analyticsPersonProperties(for: user))
    }

    /// person properties 只放派生特征：手机号 / 姓名 / 日记与对话正文一律不进埋点
    /// （docs/埋点方案.md §1）。所以是 `has_phone: Bool` 而不是号码本身。
    ///
    /// 用传入的 user 而非 `self.currentUser`：后者由 authStateChanges 异步刷新，
    /// 登录刚返回的这一刻还是旧值，会把 is_anonymous / has_apple 算反。
    static func analyticsPersonProperties(for user: User) -> [String: AnalyticsValue] {
        [
            "is_anonymous": .bool(user.isAnonymous),
            "has_phone": .bool(!(user.phone ?? "").isEmpty),
            "has_apple": .bool(user.identities?.contains { $0.provider == "apple" } ?? false),
        ]
    }
}
