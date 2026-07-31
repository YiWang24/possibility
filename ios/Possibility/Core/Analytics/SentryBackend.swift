import Foundation
import CryptoKit
import OSLog
import Sentry

// MARK: - Layer 3：Sentry（docs/engineering/埋点方案.md §0）
//
// Sentry 不是分析工具，这里也不把它当分析工具用。它的价值是**崩溃现场的上下文**：
// 每个埋点事件挂成一条 breadcrumb，崩溃报告里就能直接读出「用户崩前做了什么」——
// 「paywall_viewed → purchase_started → 崩」和「冷启动就崩」是完全不同的两个 bug。

/// 把埋点事件写成 Sentry breadcrumb 的后端。未配置 DSN 时 `make()` 返回 nil。
struct SentryBackend: AnalyticsBackend {

    /// breadcrumb 分类：Sentry 界面按 category 分组，和 SDK 自带的 http/ui 面包屑区分开
    private static let category = "analytics"

    /// 启动 Sentry SDK 并返回可注册的 backend；DSN 缺省时返回 nil（不启动 SDK）。
    /// - Important: 必须在 App 启动最早期调用，否则启动期崩溃抓不到。
    static func make() -> SentryBackend? {
        let dsn = AppConfig.Analytics.sentryDSN
        guard !dsn.isEmpty else {
            // 同 PostHog：没配就不启动 SDK，不崩不弹错（见 Config.xcconfig.example）
            Logger.analytics.notice("SENTRY_DSN 未配置，跳过 Sentry；崩溃不会上报")
            return nil
        }

        SentrySDK.start { options in
            options.dsn = dsn
            options.environment = AppConfig.Analytics.environment
            options.releaseName = "possibility@\(AppConfig.Analytics.appVersion)"
            // 埋点事件本身就会占掉不少 breadcrumb 额度，默认 100 条容易把
            // 真正有用的早期步骤挤掉；放宽到 200 条覆盖一次完整付费漏斗。
            options.maxBreadcrumbs = 200
            // 不采集 IP / cookie 等默认 PII —— docs/engineering/埋点方案.md §1 的约束同样适用于崩溃上报
            options.sendDefaultPii = false
            // 卡顿也当问题看：AI 流式回复期间主线程被阻塞是这个产品的高发故障
            options.enableAppHangTracking = true
            #if DEBUG
            options.debug = true
            // Debug 构建不占生产配额，性能采样也没有统计意义
            options.tracesSampleRate = 0
            #else
            options.tracesSampleRate = 0.2
            #endif
        }
        return SentryBackend()
    }

    func track(_ event: AnalyticsEvent) {
        let crumb = Breadcrumb(level: .info, category: Self.category)
        crumb.type = "user"
        crumb.message = event.name
        crumb.data = Self.privacySafeProperties(event.props)
        SentrySDK.addBreadcrumb(crumb)
    }

    func identify(userId: String, properties: [String: AnalyticsValue]) {
        // sendDefaultPii=false 只管 SDK 自动采集的数据；手工 setUser / breadcrumb 仍会发送。
        // Sentry 只需要稳定地聚合同一用户的故障，不需要拿到 Supabase 原始 UUID。
        let user = User(userId: Self.hashedIdentifier(userId))
        // 只挂派生属性（is_anonymous / has_phone 之类）。手机号、姓名不进 Sentry —— 同 §1。
        user.data = properties.rawValues
        SentrySDK.setUser(user)
    }

    func alias(previousId: String, newId: String) {
        // Sentry 没有 alias 概念（它只关心「这次崩溃是谁」）。
        // 但把换 id 这件事留成面包屑很有用：登录切换前后崩溃率差异是个真实排查方向。
        let crumb = Breadcrumb(level: .info, category: Self.category)
        crumb.type = "user"
        crumb.message = "identity_aliased"
        crumb.data = [
            "previous_id_hash": Self.hashedIdentifier(previousId),
            "new_id_hash": Self.hashedIdentifier(newId),
        ]
        SentrySDK.addBreadcrumb(crumb)
    }

    func reset() {
        SentrySDK.setUser(nil)
    }

    /// 固定长度单向摘要；加命名空间避免同一原始值在别的系统散列后被直接关联。
    static func hashedIdentifier(_ value: String) -> String {
        let digest = SHA256.hash(data: Data("possibility:sentry:\(value)".utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    private static func privacySafeProperties(
        _ properties: [String: AnalyticsValue]
    ) -> [String: Any] {
        properties.reduce(into: [:]) { output, pair in
            let (key, value) = pair
            if key == "anonymous_id" || key == "user_id" {
                if case .string(let identifier) = value {
                    output["\(key)_hash"] = hashedIdentifier(identifier)
                }
                return
            }
            output[key] = value.rawValue
        }
    }
}
