import Foundation
import Supabase
import Testing
@testable import Possibility

// MARK: - 测试替身

/// 记录调用序列的假 backend。埋点的价值全在「调了什么、按什么顺序调」，
/// 所以这里存的是有序的调用清单而不是最终状态。
///
/// 用锁而非 actor：`AnalyticsBackend` 的方法是同步的（调用点不能为埋点等一个 await），
/// actor 无法满足同步要求。生产侧的共享可变状态在 `SupabaseEventBackend` 里，那边是 actor。
private final class SpyBackend: AnalyticsBackend, @unchecked Sendable {

    enum Call: Equatable {
        case track(String)
        case identify(userId: String)
        case alias(previousId: String, newId: String)
        case reset
    }

    private let lock = NSLock()
    private var recorded: [Call] = []
    private var recordedProperties: [String: AnalyticsValue] = [:]

    var calls: [Call] { lock.withLock { recorded } }
    /// 最近一次 identify 带上来的 person properties
    var lastIdentifyProperties: [String: AnalyticsValue] { lock.withLock { recordedProperties } }

    func track(_ event: AnalyticsEvent) {
        append(.track(event.name))
    }

    func identify(userId: String, properties: [String: AnalyticsValue]) {
        lock.withLock { recordedProperties = properties }
        append(.identify(userId: userId))
    }

    func alias(previousId: String, newId: String) {
        append(.alias(previousId: previousId, newId: newId))
    }

    func reset() {
        append(.reset)
    }

    private func append(_ call: Call) {
        lock.withLock { recorded.append(call) }
    }
}

// MARK: - 门面：fan-out
//
// .serialized 不是保险起见：Analytics.shared 是进程级单例，Swift Testing 默认并行跑，
// 不串行化的话 A 测试的 init 会在 B 测试跑到一半时把 B 的 backend 清掉。

@Suite("埋点共享状态", .serialized)
@MainActor
struct AnalyticsSharedStateTests {

@Suite("埋点门面")
@MainActor
struct AnalyticsFanOutTests {

    /// 每个测试拿到全新实例 → 这里等价于「每个测试开始前清空全局状态」，
    /// 因此测试之间不依赖执行顺序。
    init() {
        Analytics.shared.removeAllBackends()
    }

    @Test("每个注册的 backend 都收到全部调用，且顺序一致")
    func everyRegisteredBackendReceivesEveryCall() {
        let first = SpyBackend()
        let second = SpyBackend()
        Analytics.shared.register(first)
        Analytics.shared.register(second)

        Analytics.shared.track(.paywallViewed(sku: .unlockProfile, price: 9.9, context: "profile"))
        Analytics.shared.identify(userId: "u1", properties: ["has_email": .bool(true)])
        Analytics.shared.alias(previousId: "old", newId: "new")
        Analytics.shared.reset()

        let expected: [SpyBackend.Call] = [
            .track("paywall_viewed"),
            .identify(userId: "u1"),
            .alias(previousId: "old", newId: "new"),
            .reset,
        ]
        #expect(first.calls == expected, "三层上报缺一层，数据主权 / 兜底的设计就失效了")
        #expect(second.calls == expected)
        #expect(first.lastIdentifyProperties == ["has_email": .bool(true)])
    }

    @Test("未注册任何 backend 时全部调用是无害 no-op")
    func noBackendRegisteredIsHarmlessNoOp() {
        // 密钥没配、Layer 1 也没起来时就是这个状态：调用点照常埋点，不该崩也不该抛
        Analytics.shared.track(.cardGameStarted)
        Analytics.shared.identify(userId: "u1")
        Analytics.shared.alias(previousId: "a", newId: "b")
        Analytics.shared.reset()
    }

    @Test("事件名与 docs/engineering/埋点方案.md §3 一致", arguments: [
        (AnalyticsEvent.appOpened(isFirstOpen: true, isAuthenticated: false), "app_opened"),
        (AnalyticsEvent.authCompleted(method: "apple"), "auth_completed"),
        (AnalyticsEvent.purchaseCompleted(sku: .consult, price: 29), "purchase_completed"),
    ])
    func eventFactoriesMatchSpecNames(event: AnalyticsEvent, expected: String) {
        // 事件名漂移是最难发现的埋点故障：看板照常出图，只是数字永远是 0
        #expect(event.name == expected)
    }
}

// MARK: - 身份关联（docs/engineering/埋点方案.md §2）
//
// 匿名模式停用后 alias 从认证路径上退场了（冷启动即登录墙，第一个 user_id
// 就是正式账号，没有前序身份可接），原先覆盖「什么时候该 alias」的三条规则用例
// 随之删除。留下的是 person properties —— 它承载 §1 的隐私红线，仍需守住。

@Suite("埋点身份关联")
@MainActor
struct AnalyticsIdentityTests {

    private let userId = UUID(uuidString: "11111111-1111-1111-1111-111111111111")!

    init() {
        Analytics.shared.removeAllBackends()
    }

    @Test("person properties 只放派生特征，不带邮箱原文")
    func personPropertiesNeverCarryRawEmail() {
        // §1 红线：邮箱 / 姓名 / 正文一律不进埋点。这条一旦破，PII 会散进
        // PostHog 与 Sentry 两个第三方，事后无从收回 —— 所以按 key 白名单断言。
        let properties = SupabaseService.analyticsPersonProperties(for: user(email: "a@b.com"))

        #expect(Set(properties.keys) == ["has_email", "has_apple"])
        #expect(properties["has_email"] == .bool(true))
    }

    @Test("has_email / has_apple 如实反映账号构成", arguments: [
        (String?.none, false, false, false),
        ("a@b.com", false, true, false),
        ("a@b.com", true, true, true),
    ])
    func derivedFlagsReflectAccount(
        email: String?, appleLinked: Bool, expectedEmail: Bool, expectedApple: Bool
    ) {
        let properties = SupabaseService.analyticsPersonProperties(
            for: user(email: email, appleLinked: appleLinked)
        )
        #expect(properties["has_email"] == .bool(expectedEmail))
        #expect(properties["has_apple"] == .bool(expectedApple))
    }

    private func user(email: String?, appleLinked: Bool = false) -> User {
        User(
            id: userId,
            appMetadata: [:],
            userMetadata: [:],
            aud: "authenticated",
            email: email,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0),
            identities: appleLinked
                ? [UserIdentity(
                    id: "apple-identity",
                    identityId: userId,
                    userId: userId,
                    identityData: [:],
                    provider: "apple",
                    createdAt: nil, lastSignInAt: nil, updatedAt: nil
                )]
                : nil
        )
    }
}

}

// MARK: - 属性序列化

@Suite("埋点属性序列化")
struct AnalyticsPropertyEncodingTests {

    @Test("props 写入 jsonb 时保持标量类型")
    func propsKeepTypesForJSONBColumn() {
        // app_events.props 是 jsonb：数字被写成字符串的话，
        // SQL 里 avg(latency_ms) 直接失效（docs/engineering/埋点方案.md §1 只允许四种标量）
        let props: [String: AnalyticsValue] = [
            "sku": .string("unlock_profile"),
            "turn_index": .int(3),
            "price": .double(9.9),
            "is_first_open": .bool(true),
        ]

        #expect(props.jsonObject == [
            "sku": .string("unlock_profile"),
            "turn_index": .integer(3),
            "price": .double(9.9),
            "is_first_open": .bool(true),
        ])
    }

    @Test("rawValues 还原成第三方 SDK 要的原生标量")
    func rawValuesUnwrapToPlatformScalars() {
        let raw = ["count": AnalyticsValue.int(2), "ok": .bool(false)].rawValues
        #expect(raw["count"] as? Int == 2)
        #expect(raw["ok"] as? Bool == false)
    }

    @Test("服务端权威事件可跳过 app_events 客户端副本")
    func externalOnlyDeliveryIsExplicit() {
        let event = AnalyticsEvent.chatTurnCompleted(
            turnIndex: 1,
            latencyMs: 100,
            responseChars: 20
        )
        #expect(event.factDelivery == .all)
        #expect(event.externalOnly().factDelivery == .externalOnly)
        #expect(event.externalOnly().name == event.name)
        #expect(event.externalOnly().props == event.props)
    }

    @Test("Sentry 身份只保留稳定摘要")
    func sentryIdentifierIsHashed() {
        let raw = "11111111-1111-1111-1111-111111111111"
        let first = SentryBackend.hashedIdentifier(raw)
        let second = SentryBackend.hashedIdentifier(raw)
        #expect(first == second)
        #expect(first != raw)
        #expect(first.count == 64)
    }
}
