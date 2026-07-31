import Foundation
import Supabase

// MARK: - 会话变化 → 埋点身份（docs/engineering/埋点方案.md §2）
//
// 拆成独立文件而非塞进 SupabaseService.swift：那个文件已经贴着 800 行上限，
// 且埋点身份是一个能独立读懂的关注点 —— 会话怎么切是 Supabase 的事，
// 切完该报什么身份是埋点的事。
//
// 匿名模式停用后这里只剩 identify：以前需要 alias，是因为「匿名 id → 正式 id」
// 要把匿名期行为接到新账号上；现在冷启动就是登录墙，第一个 user_id 即正式账号，
// 没有前序身份可接。登出走 Analytics.reset()，下一个账号从干净的 distinct_id 开始。

extension SupabaseService {

    /// 会话确立后同步埋点身份（冷启动恢复会话 / 注册 / 登录）
    func syncAnalyticsIdentity(user: User) {
        Analytics.shared.identify(
            userId: user.id.uuidString,
            properties: Self.analyticsPersonProperties(for: user)
        )
    }

    /// person properties 只放派生特征：邮箱 / 姓名 / 日记与对话正文一律不进埋点
    /// （docs/engineering/埋点方案.md §1）。所以是 `has_email: Bool` 而不是邮箱本身。
    ///
    /// 用传入的 user 而非 `self.currentUser`：后者由 authStateChanges 异步刷新，
    /// 登录刚返回的这一刻还是旧值，会把 has_apple 算反。
    static func analyticsPersonProperties(for user: User) -> [String: AnalyticsValue] {
        [
            "has_email": .bool(!(user.email ?? "").isEmpty),
            "has_apple": .bool(user.identities?.contains { $0.provider == "apple" } ?? false),
        ]
    }
}
