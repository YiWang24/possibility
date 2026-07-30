import Foundation
import OSLog
import PostHog

// MARK: - Layer 2：PostHog（docs/埋点方案.md §0）
//
// 只做一件事：把 AnalyticsEvent 翻译成 PostHog 的 capture/identify/alias。
// 不做重试、不做缓冲 —— posthog-ios 自带磁盘队列与批量上报，重复造一层只会打架。

/// PostHog 上报后端。未配置 project token 时 `make()` 返回 nil，调用方不注册，
/// 全链路降级为「只写 app_events」。
struct PostHogBackend: AnalyticsBackend {

    /// 初始化 SDK 并返回可注册的 backend；token 缺省时返回 nil。
    /// - Note: `setup` 在同一进程内只生效一次，重复调用被 SDK 忽略。
    static func make() -> PostHogBackend? {
        let token = AppConfig.Analytics.posthogAPIKey
        guard !token.isEmpty else {
            // 没配 key 不是错误，是预期的降级路径（见 Config.xcconfig.example）。
            // 留一行日志，免得「PostHog 看板没数据」要靠猜。
            Logger.analytics.notice("POSTHOG_API_KEY 未配置，跳过 PostHog；事件仍写入 app_events")
            return nil
        }

        let config = PostHogConfig(projectToken: token, host: AppConfig.Analytics.posthogHost)
        // 生命周期/屏幕事件由 SDK 自动采集，与 docs 里的自定义事件互不冲突，
        // 留着能白拿 $screen 分布和 App 启动/退到后台的时间线。
        config.captureApplicationLifecycleEvents = true
        config.captureScreenViews = true
        // 匿名期不建 person profile（PostHog 默认策略），identify 后才落人；
        // 这正是 §2 依赖 alias 串接匿名期行为的前提。
        config.personProfiles = .identifiedOnly
        #if DEBUG
        config.debug = true
        #endif

        PostHogSDK.shared.setup(config)
        PostHogSDK.shared.register(["environment": AppConfig.Analytics.environment])
        return PostHogBackend()
    }

    func track(_ event: AnalyticsEvent) {
        PostHogSDK.shared.capture(event.name, properties: event.props.rawValues)
    }

    func identify(userId: String, properties: [String: AnalyticsValue]) {
        // 规则 1（冷启动）与规则 2（手机号转正，user_id 不变）都走这里：
        // 前者 SDK 会自动带上 $anon_distinct_id 把匿名期事件接上，
        // 后者 distinctId 未变，SDK 只发 $set 更新 person properties。
        PostHogSDK.shared.identify(userId, userProperties: properties.rawValues)
    }

    func alias(previousId: String, newId: String) {
        // 规则 3（Apple 登录换 user_id）。PostHog 的 alias 只收一个参数：
        // 它把**当前 distinct_id**（此刻仍是 previousId）与传入的 newId 标成同一人，
        // 所以必须在 identify(newId) 之前调用 —— 顺序由 AnalyticsIdentityTransition 保证。
        //
        // alias 先建立 current distinct_id → newId 的服务端关联，随后 identify(newId)
        // 再切换本地身份并更新 person properties；两步各司其职，不能省略或倒序。
        guard previousId != newId else { return }
        PostHogSDK.shared.alias(newId)
    }

    func reset() {
        PostHogSDK.shared.reset()
    }
}

// MARK: - 属性转换

extension [String: AnalyticsValue] {
    /// AnalyticsValue → 第三方 SDK 要的原始值（string / int / double / bool）
    var rawValues: [String: Any] {
        mapValues(\.rawValue)
    }
}
