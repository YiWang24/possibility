import Foundation

// MARK: - 身份接续（docs/埋点方案.md §2）
//
// 整个埋点里最容易错、错了最贵的一处，所以把「该调什么」从「怎么调」里拆出来单测。
//
// 前提：App 启动即 signInAnonymously()，任何时刻都有 user_id。于是只有两种情形：
//
//   user_id 没变  → 冷启动 / 手机号原地转正（updateUser 链接手机号）
//                   只 identify（更新 person properties）。此时调 alias 是有害的：
//                   自己 alias 自己会在 PostHog 里制造无意义的 $create_alias 噪音。
//
//   user_id 变了  → Apple 登录，或手机号命中既有账号（phone_exists → 换会话登录）
//                   必须先 alias(旧, 新) 再 identify(新)。漏掉 alias，匿名期的全部行为
//                   会成为孤儿事件，「进入 → 付费」漏斗从登录那一刻断开 ——
//                   而这恰恰是最想看的那条曲线。

/// 一次身份变化该执行的埋点动作序列。
enum AnalyticsIdentityTransition: Equatable, Sendable {

    /// user_id 未变化：只 identify
    case identify(userId: String)

    /// user_id 变化：先 alias(previousId → userId)，再 identify(userId)
    case aliasThenIdentify(previousId: String, userId: String)

    /// 根据新旧 user_id 判定动作。previousUserId 为 nil（冷启动、或旧会话已丢失）时
    /// 无从 alias，只能 identify —— 这也是为什么 Apple 登录路径必须在
    /// signInWithIdToken **之前** 就把旧 id 抓在手里。
    static func resolve(previousUserId: String?, newUserId: String) -> Self {
        guard let previousUserId, !previousUserId.isEmpty, previousUserId != newUserId else {
            return .identify(userId: newUserId)
        }
        return .aliasThenIdentify(previousId: previousUserId, userId: newUserId)
    }

    /// 最终归到的 user_id
    var userId: String {
        switch self {
        case .identify(let userId): return userId
        case .aliasThenIdentify(_, let userId): return userId
        }
    }

    /// 派发到埋点门面。alias 必须先于 identify —— PostHog 的 alias 以
    /// 「当前 distinct_id」为源端，identify 之后再调就串到新 id 上了。
    @MainActor
    func apply(properties: [String: AnalyticsValue] = [:]) {
        if case .aliasThenIdentify(let previousId, let userId) = self {
            Analytics.shared.alias(previousId: previousId, newId: userId)
        }
        Analytics.shared.identify(userId: userId, properties: properties)
    }
}
