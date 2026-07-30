import Foundation

// MARK: - 埋点门面（契约层 · 见 docs/埋点方案.md）
//
// 调用侧只依赖本文件与 AnalyticsEvent.swift；具体上报实现（PostHog / app_events / Sentry）
// 通过 AnalyticsBackend 注册进来。这样调用点不感知第三方 SDK，也便于测试替换。

/// 埋点属性值：显式枚举而非 Any，保证 Sendable 且序列化行为可预期。
/// 只允许 string / int / double / bool —— 与 docs/埋点方案.md §1 一致。
enum AnalyticsValue: Sendable, Equatable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)

    /// 转成第三方 SDK / JSON 需要的原始值
    var rawValue: Any {
        switch self {
        case .string(let v): return v
        case .int(let v): return v
        case .double(let v): return v
        case .bool(let v): return v
        }
    }
}

/// 一个埋点事件：名字 + 属性。构造只走 AnalyticsEvent.swift 里的工厂方法，
/// 避免调用点手写字符串导致事件名漂移。
enum AnalyticsFactDelivery: Sendable, Equatable {
    /// 同时进入 PostHog / Sentry 与自有 `app_events` 事实表。
    case all
    /// 只进入客户端第三方后端；`app_events` 已由服务端写入，避免同一事实重复两次。
    case externalOnly
}

struct AnalyticsEvent: Sendable, Equatable {
    let name: String
    let props: [String: AnalyticsValue]
    let factDelivery: AnalyticsFactDelivery

    init(
        _ name: String,
        _ props: [String: AnalyticsValue] = [:],
        factDelivery: AnalyticsFactDelivery = .all
    ) {
        self.name = name
        self.props = props
        self.factDelivery = factDelivery
    }

    /// 服务端已把同一业务事实写入 `app_events` 时，iOS 仍给 PostHog / Sentry 留一份，
    /// 但不再往自有事实表重复插入。
    func externalOnly() -> Self {
        Self(name, props, factDelivery: .externalOnly)
    }
}

/// 上报后端。实现方负责自己的线程调度与失败降级——门面不做重试。
protocol AnalyticsBackend: Sendable {
    func track(_ event: AnalyticsEvent)

    /// 关联匿名身份到已知用户
    func identify(userId: String, properties: [String: AnalyticsValue])

    /// 旧 user_id 与新 user_id 是同一个人（Apple 登录换 id 时必须调用，
    /// 否则匿名期行为成为孤儿事件，完整漏斗断裂）
    func alias(previousId: String, newId: String)

    /// 登出：清除本地身份关联
    func reset()
}

/// 全局埋点入口。调用点形如：
/// ```
/// Analytics.shared.track(.paywallViewed(sku: .unlockProfile, price: 9.9, context: "profile"))
/// ```
@MainActor
final class Analytics {
    static let shared = Analytics()

    private var backends: [AnalyticsBackend] = []

    /// App 启动时注册；未注册任何后端时所有调用是无害的 no-op，
    /// 便于单元测试和「SDK 未配置」的降级场景。
    func register(_ backend: AnalyticsBackend) {
        backends.append(backend)
    }

    /// 仅供测试：清空已注册后端
    func removeAllBackends() {
        backends.removeAll()
    }

    func track(_ event: AnalyticsEvent) {
        for backend in backends { backend.track(event) }
    }

    func identify(userId: String, properties: [String: AnalyticsValue] = [:]) {
        for backend in backends { backend.identify(userId: userId, properties: properties) }
    }

    func alias(previousId: String, newId: String) {
        for backend in backends { backend.alias(previousId: previousId, newId: newId) }
    }

    func reset() {
        for backend in backends { backend.reset() }
    }
}
