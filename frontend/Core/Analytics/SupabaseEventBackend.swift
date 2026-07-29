import Foundation
import OSLog
import Supabase

// MARK: - Layer 1：Supabase app_events（docs/埋点方案.md §0 / §4）
//
// 这是兜底的事实表：PostHog Cloud 在国内网络可达性不稳定，一旦上报失败数据永久丢失；
// app_events 又是唯一能和 match_results / unlocks 等业务表 JOIN 的地方。
//
// 三条硬约束：
// 1. 批量 + 异步 —— 每个事件一次 INSERT 会把 chat 流式过程打成网络风暴
// 2. 任何失败静默吞掉，绝不冒泡到 UI
// 3. 内存占用有上限 —— 断网时缓冲不能无限涨

/// 写入 Supabase `app_events` 的上报后端。自身无可变状态（值语义），
/// 全部共享可变状态收在 `EventBuffer` actor 里；对调用方是即返的 fire-and-forget。
struct SupabaseEventBackend: AnalyticsBackend {

    private let buffer: EventBuffer

    /// 本次冷启动的会话标识（`app_events.session_id`）：
    /// 同一 session 内的事件序列才是「一次使用」，留存/深度指标按它切片。
    static let sessionId = UUID().uuidString

    init(client: SupabaseClient) {
        buffer = EventBuffer(client: client, sessionId: Self.sessionId)
    }

    /// 启动周期性 flush。App 退到后台时也会被 AnalyticsBootstrap 触发一次强制 flush。
    func start() {
        Task { await buffer.startFlushLoop() }
    }

    func track(_ event: AnalyticsEvent) {
        Task { await buffer.enqueue(event) }
    }

    func identify(userId: String, properties _: [String: AnalyticsValue]) {
        // person properties 不落 app_events：这张表存事件流，用户画像属性
        // 在 profiles / auth.users 里已有权威副本，重复存只会两边不一致。
        Task { await buffer.updateUser(id: userId) }
    }

    func alias(previousId: String, newId: String) {
        Task { await buffer.reassignUser(from: previousId, to: newId) }
    }

    func reset() {
        Task { await buffer.clearIdentity() }
    }

    /// 退到后台前的最后一次冲刷 —— 之后进程随时可能被回收
    func flushBeforeSuspend() {
        Task { await buffer.flushBeforeSuspend() }
    }
}

// MARK: - 缓冲区

/// 事件缓冲 + 批量写入。所有可变状态收在 actor 内，天然线程安全。
private actor EventBuffer {

    /// 攒够这么多条立刻发，不等定时器 —— 对话流式过程会短时间内产出一批事件
    private static let flushThreshold = 20
    /// 单次 INSERT 上限，避免一次请求体过大
    private static let batchSize = 50
    /// 定时冲刷间隔
    private static let flushInterval: Duration = .seconds(15)
    /// 缓冲上限：断网时丢最旧的，保证内存有界（每条事件量级 ~200 B）
    private static let capacity = 300
    /// 单批最多重试一次，避免「毒药批次」永远卡住队列
    private static let maxAttempts = 2

    private let client: SupabaseClient
    private let sessionId: String
    /// 带毫秒：同一秒内多个事件的先后顺序对漏斗时序有意义。
    /// 作为 actor 实例属性而非全局，省掉一层 Sendable 讨论。
    private let timestampFormatter: ISO8601DateFormatter
    private var pending: [PendingEvent] = []
    private var userId: String?
    private var isFlushing = false
    private var flushLoop: Task<Void, Never>?

    init(client: SupabaseClient, sessionId: String) {
        self.client = client
        self.sessionId = sessionId
        timestampFormatter = ISO8601DateFormatter()
        timestampFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    }

    func startFlushLoop() {
        guard flushLoop == nil else { return }
        flushLoop = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: Self.flushInterval)
                await self?.flush()
            }
        }
    }

    func enqueue(_ event: AnalyticsEvent) {
        // created_at 用「事件发生时刻」而非入库时刻：批量意味着最长延迟一个 flushInterval，
        // 用服务端 now() 会把同一轮对话的事件压成同一时间点，漏斗时序直接失真。
        pending.append(PendingEvent(
            row: EventRow(
                userId: userId,
                event: event.name,
                props: event.props.jsonObject,
                sessionId: sessionId,
                appVersion: AppConfig.Analytics.appVersion,
                createdAt: timestampFormatter.string(from: Date())
            )
        ))
        trimToCapacity()
        if pending.count >= Self.flushThreshold {
            Task { await self.flush() }
        }
    }

    func updateUser(id: String) {
        userId = id
        // 补齐 identify 之前就产生的事件。冷启动网络慢时 bootstrap 会晚几百毫秒到几秒，
        // 这段窗口里的事件（首当其冲是 app_opened）若带着 nil user_id 就永远发不出去 ——
        // 而 app_opened 是「全链路转化率」的分母。
        restamp(from: nil, to: id)
    }

    /// Apple 登录换 id 后，缓冲里还没发出去的匿名事件要改挂到新账号名下。
    /// 理由有两层：① app_events 的 RLS 是 `user_id = auth.uid()`，
    /// 带旧 id 的行在新会话下会被整批拒绝；② 0017 迁移里的 merge_anonymous_user
    /// 本就把旧匿名账号的 app_events 迁到新账号，改挂与服务端口径一致（同一个人）。
    func reassignUser(from previousId: String, to newId: String) {
        userId = newId
        restamp(from: previousId, to: newId)
    }

    /// 把缓冲里挂在 `oldUserId` 下的行改挂到 `newUserId`（nil 表示「还没 identify 的行」）。
    /// 返回新数组而非原地改：PendingEvent 是值类型，替换比就地 mutate 更难写错。
    private func restamp(from oldUserId: String?, to newUserId: String) {
        pending = pending.map { $0.row.userId == oldUserId ? $0.stamped(userId: newUserId) : $0 }
    }

    /// 登出：残留事件属于上一个账号，新的匿名会话下必被 RLS 拒绝，直接丢弃。
    func clearIdentity() {
        pending.removeAll()
        userId = nil
    }

    /// 退到后台前的最后一次冲刷。与定时 flush 的唯一区别：如果此刻还没拿到 user_id，
    /// 这些事件将随进程回收永久丢失 —— 定时 flush 遇到这种情况只是「再等等」，
    /// 这里则是「最后通牒」，必须留痕。
    func flushBeforeSuspend() async {
        if userId == nil, !pending.isEmpty {
            let stranded = pending.count
            Logger.analytics.error(
                "退到后台时仍未取得 user_id，\(stranded) 条事件将随进程回收丢失（bootstrap 失败？）"
            )
        }
        await flush()
    }

    func flush() async {
        // 尚未 identify 时按兵不动：app_events 的 RLS 是 `user_id = auth.uid()`，
        // NULL 参与比较结果不成立，带 nil 的行会让整批 INSERT 被拒 —— 而且此刻
        // 多半连有效会话都没有，发出去也是 401。攒着等 updateUser 补齐才有意义。
        //
        // 这不会无限期卡住：identify 的触发点有两个，bootstrap() 的匿名登录，
        // 以及任何 Edge Function 调用走的 jwt() 兜底匿名登录。两者都会调
        // syncAnalyticsIdentity → updateUser → restamp(from: nil) 把积压事件补齐。
        guard !isFlushing, userId != nil, !pending.isEmpty else { return }
        isFlushing = true
        defer { isFlushing = false }

        let batch = Array(pending.prefix(Self.batchSize))
        pending.removeFirst(batch.count)
        do {
            // returning: .minimal 是硬要求，不是优化：0017 迁移 revoke 了 authenticated
            // 的全部权限后只 grant insert，一旦要求回传行会直接 403，整条上报链路静默失效。
            try await client.from("app_events")
                .insert(batch.map(\.row), returning: .minimal)
                .execute()
            Logger.analytics.debug("app_events 已上报 \(batch.count) 条")
        } catch {
            // 静默降级：退回队首等下一轮；超过重试上限的直接丢，
            // 埋点失败不该演变成无限重试的后台流量。
            let retriable = batch.map { $0.retried() }.filter { $0.attempts < Self.maxAttempts }
            let discarded = batch.count - retriable.count
            Logger.analytics.error(
                "app_events 上报失败，重排 \(retriable.count) 条 / 丢弃 \(discarded) 条：\(error.localizedDescription, privacy: .public)"
            )
            pending.insert(contentsOf: retriable, at: 0)
            trimToCapacity()
        }
    }

    /// 缓冲溢出时丢最旧的。断网久了必然走到这里，所以要留日志 ——
    /// 否则「数据少了一截」在事后完全无从解释。
    private func trimToCapacity() {
        guard pending.count > Self.capacity else { return }
        let overflow = pending.count - Self.capacity
        pending.removeFirst(overflow)
        Logger.analytics.error("app_events 缓冲已满，丢弃最旧 \(overflow) 条")
    }
}

// MARK: - 行结构（docs/埋点方案.md §4）

/// 一条待发事件 + 它已经试过几次。值类型，所有「修改」都返回新实例。
private struct PendingEvent {
    let row: EventRow
    let attempts: Int

    init(row: EventRow, attempts: Int = 0) {
        self.row = row
        self.attempts = attempts
    }

    func retried() -> Self {
        Self(row: row, attempts: attempts + 1)
    }

    func stamped(userId: String) -> Self {
        Self(row: row.stamping(userId: userId), attempts: attempts)
    }
}

/// `app_events` 一行。`source` 恒为 "ios" —— 服务端事件由 Edge Function 自己写。
private struct EventRow: Encodable {
    let userId: String?
    let event: String
    let props: [String: AnyJSON]
    let sessionId: String
    let appVersion: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case event, props, source
        case userId = "user_id"
        case sessionId = "session_id"
        case appVersion = "app_version"
        case createdAt = "created_at"
    }

    /// 改挂到另一个 user_id，返回新行（其余字段原样保留）
    func stamping(userId: String) -> Self {
        Self(
            userId: userId,
            event: event,
            props: props,
            sessionId: sessionId,
            appVersion: appVersion,
            createdAt: createdAt
        )
    }

    func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(userId, forKey: .userId)
        try c.encode(event, forKey: .event)
        try c.encode(props, forKey: .props)
        try c.encode("ios", forKey: .source)
        try c.encode(sessionId, forKey: .sessionId)
        try c.encode(appVersion, forKey: .appVersion)
        try c.encode(createdAt, forKey: .createdAt)
    }
}

// MARK: - 转换工具

extension [String: AnalyticsValue] {
    /// AnalyticsValue → jsonb（`app_events.props`）
    var jsonObject: [String: AnyJSON] {
        mapValues { value in
            switch value {
            case .string(let v): .string(v)
            case .int(let v): .integer(v)
            case .double(let v): .double(v)
            case .bool(let v): .bool(v)
            }
        }
    }
}
