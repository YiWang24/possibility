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

@Suite("埋点门面", .serialized)
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
        Analytics.shared.identify(userId: "u1", properties: ["is_anonymous": .bool(false)])
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
        #expect(first.lastIdentifyProperties == ["is_anonymous": .bool(false)])
    }

    @Test("未注册任何 backend 时全部调用是无害 no-op")
    func noBackendRegisteredIsHarmlessNoOp() {
        // 密钥没配、Layer 1 也没起来时就是这个状态：调用点照常埋点，不该崩也不该抛
        Analytics.shared.track(.cardGameStarted)
        Analytics.shared.identify(userId: "u1")
        Analytics.shared.alias(previousId: "a", newId: "b")
        Analytics.shared.reset()
    }

    @Test("事件名与 docs/埋点方案.md §3 一致", arguments: [
        (AnalyticsEvent.appOpened(isFirstOpen: true, isAnonymous: true), "app_opened"),
        (AnalyticsEvent.authCompleted(method: "apple", wasAnonymous: true), "auth_completed"),
        (AnalyticsEvent.identityMerged(anonymousId: "a"), "identity_merged"),
        (AnalyticsEvent.purchaseCompleted(sku: .consult, price: 29), "purchase_completed"),
    ])
    func eventFactoriesMatchSpecNames(event: AnalyticsEvent, expected: String) {
        // 事件名漂移是最难发现的埋点故障：看板照常出图，只是数字永远是 0
        #expect(event.name == expected)
    }
}

// MARK: - 身份关联：三条路径（docs/埋点方案.md §2）

@Suite("埋点身份关联", .serialized)
@MainActor
struct AnalyticsIdentityTests {

    private let anonymousId = "11111111-1111-1111-1111-111111111111"
    private let appleId = "22222222-2222-2222-2222-222222222222"

    init() {
        Analytics.shared.removeAllBackends()
    }

    // MARK: 判定

    @Test("规则 1 · 冷启动：没有旧 id，只 identify")
    func coldStartIdentifiesWithoutAlias() {
        // 冷启动没有「上一个 user_id」，alias 无源端可用
        #expect(
            AnalyticsIdentityTransition.resolve(previousUserId: nil, newUserId: anonymousId)
                == .identify(userId: anonymousId))
    }

    @Test("规则 2 · 手机号原地转正：user_id 不变，不调 alias")
    func phoneUpgradeKeepsSameIdAndSkipsAlias() {
        // updateUser 原地链接手机号，user_id 不变 → 只更新 person properties。
        // 这里若误调 alias，等于让用户和自己 alias，PostHog 里堆一堆无意义的 $create_alias。
        #expect(
            AnalyticsIdentityTransition.resolve(previousUserId: anonymousId, newUserId: anonymousId)
                == .identify(userId: anonymousId))
    }

    @Test("规则 3 · Apple 登录换 id：必须 alias")
    func appleSignInAliasesOldIdToNewId() {
        #expect(
            AnalyticsIdentityTransition.resolve(previousUserId: anonymousId, newUserId: appleId)
                == .aliasThenIdentify(previousId: anonymousId, userId: appleId))
    }

    @Test("空串旧 id 当作「没有旧 id」")
    func emptyPreviousIdIsTreatedAsAbsent() {
        // 空串不是合法的 distinct_id，别把它 alias 上去
        #expect(
            AnalyticsIdentityTransition.resolve(previousUserId: "", newUserId: appleId)
                == .identify(userId: appleId))
    }

    // MARK: 派发顺序

    @Test("Apple 路径：alias 必须先于 identify 派发")
    func aliasIsDispatchedBeforeIdentify() {
        let spy = SpyBackend()
        Analytics.shared.register(spy)

        AnalyticsIdentityTransition
            .resolve(previousUserId: anonymousId, newUserId: appleId)
            .apply(properties: ["is_anonymous": .bool(false)])

        // 顺序不能反：PostHog 的 alias 以「当前 distinct_id」为源端，
        // identify 之后再 alias 就把新 id 串到新 id 上，匿名期行为依然是孤儿。
        #expect(spy.calls == [
            .alias(previousId: anonymousId, newId: appleId),
            .identify(userId: appleId),
        ])
    }

    @Test("冷启动路径：只派发 identify")
    func coldStartDispatchesIdentifyOnly() {
        let spy = SpyBackend()
        Analytics.shared.register(spy)

        AnalyticsIdentityTransition
            .resolve(previousUserId: nil, newUserId: anonymousId)
            .apply(properties: ["is_anonymous": .bool(true)])

        #expect(spy.calls == [.identify(userId: anonymousId)])
        #expect(spy.lastIdentifyProperties == ["is_anonymous": .bool(true)])
    }

    @Test("手机号转正路径：只派发 identify，但带上刷新后的 person properties")
    func phoneUpgradeDispatchesIdentifyOnlyWithFreshProperties() {
        let spy = SpyBackend()
        Analytics.shared.register(spy)

        AnalyticsIdentityTransition
            .resolve(previousUserId: anonymousId, newUserId: anonymousId)
            .apply(properties: ["is_anonymous": .bool(false), "has_phone": .bool(true)])

        #expect(spy.calls == [.identify(userId: anonymousId)])
        #expect(spy.lastIdentifyProperties == ["is_anonymous": .bool(false), "has_phone": .bool(true)])
    }
}

// MARK: - 属性序列化

@Suite("埋点属性序列化")
struct AnalyticsPropertyEncodingTests {

    @Test("props 写入 jsonb 时保持标量类型")
    func propsKeepTypesForJSONBColumn() {
        // app_events.props 是 jsonb：数字被写成字符串的话，
        // SQL 里 avg(latency_ms) 直接失效（docs/埋点方案.md §1 只允许四种标量）
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
}
