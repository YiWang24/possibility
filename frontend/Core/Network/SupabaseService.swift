import Foundation
import Observation
import Supabase

/// Supabase 封装：匿名 Auth、Postgres 读写（受 RLS 约束）、mock 解锁。
/// 服务端状态经此拉取缓存；UI/客户端状态留在各 Feature Model（二者分治，见技术设计文档 §8.2）。
@Observable
@MainActor
final class SupabaseService {

    let client: SupabaseClient

    // MARK: - 会话状态

    private(set) var userId: UUID?
    private(set) var isReady = false
    private(set) var lastError: String?
    /// 当前 Auth 用户（匿名或正式）；登录/登出/转正后由 authStateChanges 刷新
    private(set) var currentUser: User?
    private var authListener: Task<Void, Never>?

    /// 游客（匿名会话或尚未建立会话）——AuthGate 据此决定是否弹登录页
    var isAnonymous: Bool { currentUser?.isAnonymous ?? true }

    /// 已绑定手机号（Supabase 存储格式 8613812345678 → +86 138****5678 脱敏展示）
    var phoneDisplay: String? {
        guard var phone = currentUser?.phone, !phone.isEmpty else { return nil }
        if phone.hasPrefix("86"), phone.count == 13 { phone.removeFirst(2) }
        guard phone.count == 11 else { return phone }
        return "+86 \(phone.prefix(3))****\(phone.suffix(4))"
    }

    /// 是否绑定了 Apple 身份
    var isAppleLinked: Bool {
        currentUser?.identities?.contains { $0.provider == "apple" } ?? false
    }

    // MARK: - 服务端状态缓存

    private(set) var travelers: [Traveler] = []
    private(set) var travelerDetails: [Int: TravelerDetail] = [:]
    private(set) var services: [TravelerServiceItem] = []
    private(set) var bounties: [Bounty] = []
    private(set) var profile: UserProfile?
    private(set) var unlockedProfileIds: Set<Int> = []

    init(client: SupabaseClient? = nil) {
        self.client = client ?? SupabaseClient(
            supabaseURL: AppConfig.supabaseURL,
            supabaseKey: AppConfig.supabaseAnonKey
        )
    }

    // MARK: - 启动：匿名登录 + 预取公开内容

    func bootstrap() async {
        startAuthListener()
        do {
            if let session = try? await client.auth.session {
                userId = session.user.id
                currentUser = session.user
            } else {
                let session = try await client.auth.signInAnonymously()
                userId = session.user.id
                currentUser = session.user
            }
            isReady = true
            async let t: Void = loadTravelers()
            async let b: Void = loadBounties()
            async let p: Void = loadProfile()
            async let u: Void = loadUnlocks()
            _ = await (t, b, p, u)
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// 监听会话变化（转正 / 换账号 / 登出），保持 currentUser 与 UI 同步
    private func startAuthListener() {
        guard authListener == nil else { return }
        authListener = Task { [weak self] in
            guard let self else { return }
            for await (event, session) in self.client.auth.authStateChanges {
                guard [.signedIn, .signedOut, .userUpdated, .tokenRefreshed].contains(event) else { continue }
                self.currentUser = session?.user
                if let id = session?.user.id { self.userId = id }
            }
        }
    }

    /// 当前 JWT（ChatStreamClient / callFunction 用）。
    /// 会话缺失时（冷启动 bootstrap 尚未完成、失败或会话过期）现场补一次匿名登录，
    /// 不让「暂时没有会话」直接把 chat / analyze-diary 等打成 sessionMissing 报错。
    func jwt() async throws -> String {
        if let session = try? await client.auth.session {
            return session.accessToken
        }
        let session = try await client.auth.signInAnonymously()
        userId = session.user.id
        isReady = true
        return session.accessToken
    }

    // MARK: - 真实登录（手机验证码 / Apple —— 技术设计文档 §登录系统）

    /// 手机验证码流向：匿名转正（updateUser 原地链接，user_id 不变）或既有账号登录
    enum PhoneOTPFlow: Sendable {
        case linkAnonymous   // verifyOTP 用 .phoneChange
        case signIn          // verifyOTP 用 .sms（登录后触发匿名数据迁移）
    }

    /// 发送验证码。匿名态优先走转正路径；号码已被注册（phone_exists）时
    /// 自动切换为既有账号登录流，verify 成功后经 merge-anonymous 迁移匿名数据。
    func sendPhoneOTP(_ rawPhone: String) async throws -> PhoneOTPFlow {
        let phone = Self.e164Phone(rawPhone)
        if isAnonymous, (try? await client.auth.session) != nil {
            do {
                try await client.auth.update(user: UserAttributes(phone: phone))
                return .linkAnonymous
            } catch let error as AuthError where error.errorCode.rawValue == "phone_exists" {
                try await client.auth.signInWithOTP(phone: phone)
                return .signIn
            }
        }
        try await client.auth.signInWithOTP(phone: phone)
        return .signIn
    }

    /// 校验验证码。signIn 流会替换会话：先暂存匿名 token，成功后迁移数据。
    func verifyPhoneOTP(_ rawPhone: String, code: String, flow: PhoneOTPFlow) async throws {
        let phone = Self.e164Phone(rawPhone)
        switch flow {
        case .linkAnonymous:
            try await client.auth.verifyOTP(phone: phone, token: code, type: .phoneChange)
        case .signIn:
            let anonymousToken = await anonymousAccessToken()
            try await client.auth.verifyOTP(phone: phone, token: code, type: .sms)
            await mergeAnonymousData(token: anonymousToken)
        }
        await refreshAfterAuthChange()
    }

    /// Apple 原生登录（signInWithIdToken）。会产生/命中另一个正式账号：
    /// 先暂存匿名 token，登录成功后经 merge-anonymous 迁移数据。
    /// - Parameter fullName: Apple 仅首次授权返回，随手写入 user metadata
    func signInWithApple(idToken: String, nonce: String, fullName: String?) async throws {
        let anonymousToken = await anonymousAccessToken()
        try await client.auth.signInWithIdToken(
            credentials: .init(provider: .apple, idToken: idToken, nonce: nonce)
        )
        if let fullName, !fullName.isEmpty {
            try? await client.auth.update(user: UserAttributes(data: ["full_name": .string(fullName)]))
        }
        await mergeAnonymousData(token: anonymousToken)
        await refreshAfterAuthChange()
    }

    /// 退出登录：清空本地缓存后回落到全新匿名会话（游客模式仍可用）
    func signOut() async {
        try? await client.auth.signOut()
        resetUserCaches()
        await bootstrap()
    }

    /// 注销账号（App Store 5.1.1(v)）：服务端删除 auth 用户（业务表级联清理）后本地登出
    func deleteAccount() async throws {
        struct Body: Encodable {}
        struct Response: Decodable { let ok: Bool }
        _ = try await callFunction("delete-account", body: Body(), as: Response.self)
        await signOut()
    }

    // MARK: 登录私有工具

    /// 展示用手机号 → E.164（默认 +86；11 位裸号自动补前缀）
    static func e164Phone(_ raw: String) -> String {
        let digits = raw.filter(\.isNumber)
        if raw.hasPrefix("+") { return "+\(digits)" }
        if digits.hasPrefix("86"), digits.count == 13 { return "+\(digits)" }
        return "+86\(digits)"
    }

    /// 当前会话若是匿名，取其 access token（登录切换账号前暂存，供数据迁移）
    private func anonymousAccessToken() async -> String? {
        guard let session = try? await client.auth.session, session.user.isAnonymous else { return nil }
        return session.accessToken
    }

    /// POST /merge-anonymous：把旧匿名账号数据迁到当前正式账号。
    /// 失败不阻断登录（记录 lastError，可由后台任务/客服兜底）。
    private func mergeAnonymousData(token: String?) async {
        guard let token else { return }
        struct Body: Encodable { let anonymous_access_token: String }
        struct Response: Decodable { let ok: Bool }
        do {
            _ = try await callFunction("merge-anonymous", body: Body(anonymous_access_token: token), as: Response.self)
        } catch {
            lastError = "匿名数据迁移失败：\(error.localizedDescription)"
        }
    }

    /// 登录 / 转正 / 登出后：同步会话状态并重拉用户侧数据
    private func refreshAfterAuthChange() async {
        if let session = try? await client.auth.session {
            userId = session.user.id
            currentUser = session.user
        }
        invalidateRemoteProfileCache()
        async let p: Void = loadProfile()
        async let u: Void = loadUnlocks()
        _ = await (p, u)
    }

    /// 登出 / 注销时清空所有仅属于旧账号的本地缓存
    private func resetUserCaches() {
        userId = nil
        currentUser = nil
        profile = nil
        unlockedProfileIds = []
        invalidateRemoteProfileCache()
    }

    // MARK: - 公开内容

    func loadTravelers() async {
        do {
            let rows: [Traveler] = try await client.from("travelers")
                .select().order("id").execute().value
            travelers = rows.isEmpty ? DemoData.travelers : rows
        } catch {
            lastError = error.localizedDescription
            travelers = DemoData.travelers   // 断网兜底（§13）
        }
    }

    /// 把实时生成/新拉取的旅人按 id 去重合并进缓存，并按 id 排序。
    /// 推演实时生成的旅人需并入 `travelers`，ProfileView 才能按 id 命中（见 ProfileModel）。
    func mergeTravelers(_ incoming: [Traveler]) {
        guard !incoming.isEmpty else { return }
        var byId = Dictionary(travelers.map { ($0.id, $0) }, uniquingKeysWith: { current, _ in current })
        for t in incoming { byId[t.id] = t }
        travelers = byId.values.sorted { $0.id < $1.id }
    }

    func loadTravelerDetail(id: Int) async -> TravelerDetail? {
        if let cached = travelerDetails[id] { return cached }
        do {
            let detail: TravelerDetail = try await client.from("traveler_details")
                .select().eq("traveler_id", value: id).single().execute().value
            travelerDetails[id] = detail
            return detail
        } catch {
            lastError = error.localizedDescription
            let fallback = DemoData.details[id]
            if let fallback { travelerDetails[id] = fallback }
            return fallback
        }
    }

    func loadServices(travelerId: Int) async -> [TravelerServiceItem] {
        do {
            let items: [TravelerServiceItem] = try await client.from("traveler_services")
                .select().eq("traveler_id", value: travelerId).execute().value
            let resolved = items.isEmpty ? DemoData.services(for: travelerId) : items
            services = resolved
            return resolved
        } catch {
            lastError = error.localizedDescription
            let fallback = DemoData.services(for: travelerId)
            services = fallback
            return fallback
        }
    }

    func loadBounties() async {
        do {
            let rows: [Bounty] = try await client.from("bounties")
                .select().order("created_at", ascending: false).execute().value
            bounties = rows.isEmpty ? DemoData.bounties : rows
        } catch {
            lastError = error.localizedDescription
            bounties = DemoData.bounties
        }
    }

    // MARK: - 用户数据（RLS：仅本人）

    func loadProfile() async {
        guard let uid = userId else { return }
        do {
            profile = try await client.from("profiles")
                .select().eq("id", value: uid).single().execute().value
        } catch {
            // 首次进入没有 profile 行：本地兜底，后续 upsert
            profile = UserProfile(id: uid, portraitPct: AppConfig.Threshold.portraitInitialPct, dims: [:])
        }
    }

    func saveProfile(_ p: UserProfile) async {
        do {
            try await client.from("profiles").upsert(p).execute()
            profile = p
        } catch {
            lastError = error.localizedDescription
        }
    }

    func createConversation(topic: String) async -> Conversation? {
        guard let uid = userId else { return nil }
        struct NewConversation: Encodable {
            let user_id: UUID
            let topic: String
        }
        do {
            let convo: Conversation = try await client.from("conversations")
                .insert(NewConversation(user_id: uid, topic: topic))
                .select().single().execute().value
            return convo
        } catch {
            lastError = error.localizedDescription
            return nil
        }
    }

    func loadMessages(conversationId: UUID) async -> [ChatMessage] {
        do {
            return try await client.from("messages")
                .select().eq("conversation_id", value: conversationId)
                .order("id").execute().value
        } catch {
            lastError = error.localizedDescription
            return []
        }
    }

    // MARK: - 解锁（demo mock 支付：直接写 unlocks）

    func loadUnlocks() async {
        guard let uid = userId else { return }
        struct Row: Decodable {
            let kind: String
            let target_id: String
        }
        do {
            let rows: [Row] = try await client.from("unlocks")
                .select("kind, target_id").eq("user_id", value: uid).execute().value
            unlockedProfileIds = Set(rows.filter { $0.kind == "profile" }.compactMap { Int($0.target_id) })
        } catch {
            lastError = error.localizedDescription
        }
    }

    func isUnlocked(travelerId: Int) -> Bool {
        unlockedProfileIds.contains(travelerId)
    }

    /// mock 解锁完整经验（¥9.9）：INSERT unlocks → 本地标记
    @discardableResult
    func unlockProfile(travelerId: Int) async -> Bool {
        guard let uid = userId else { return false }
        let record = Unlock(
            userId: uid,
            kind: .profile,
            targetId: String(travelerId),
            amount: AppConfig.Price.unlockProfile
        )
        do {
            try await client.from("unlocks").insert(record).execute()
            unlockedProfileIds.insert(travelerId)
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    // MARK: - Edge Functions（非流式：match / simulate / analyze-diary）

    /// Edge Function 返回的业务错误：{"error":{"code","message"}}
    /// 携带后端 message，让 UI/日志能区分「限流 / 上游 AI 不可用 / 参数错误」而非笼统的网络失败。
    struct EdgeFunctionError: LocalizedError, Decodable {
        struct Inner: Decodable {
            let code: String?
            let message: String?
        }
        let error: Inner?
        var statusCode: Int = 0

        enum CodingKeys: String, CodingKey { case error }

        var errorDescription: String? {
            error?.message ?? "服务暂时不可用（HTTP \(statusCode)）"
        }
    }

    private static func throwIfHTTPError(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        guard !(200..<300).contains(http.statusCode) else { return }
        if var backendError = try? JSONDecoder().decode(EdgeFunctionError.self, from: data) {
            backendError.statusCode = http.statusCode
            throw backendError
        }
        throw URLError(.badServerResponse)
    }

    /// 通用 JSON POST 到 Edge Function（带 JWT + apikey）
    private func callFunction<In: Encodable, Out: Decodable>(
        _ name: String, body: In, as _: Out.Type
    ) async throws -> Out {
        var req = URLRequest(url: AppConfig.functionURL(name))
        req.httpMethod = "POST"
        // simulate/match 的结构化生成可达 2 分钟以上，默认 60s 会提前断开
        req.timeoutInterval = 180
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(try await jwt())", forHTTPHeaderField: "Authorization")
        req.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: req)
        try Self.throwIfHTTPError(response, data: data)
        return try JSONDecoder().decode(Out.self, from: data)
    }

    /// POST /match：3 位结局不同旅人 + 匹配理由
    func match(userState: MatchQuery) async throws -> MatchResponse {
        struct Body: Encodable { let user_state: MatchQuery }
        return try await callFunction("match", body: Body(user_state: userState), as: MatchResponse.self)
    }

    /// POST /simulate 完整出参：{scenarios, bottom_line_analysis, recommended_traveler_ids}
    /// - Parameter carryCards: 底线卡（最多 6 张，validate.ts validateSimulateInputV2）
    func simulateFull(
        question: String, choice: String, horizon: SimulationHorizon, carryCards: [String]? = nil
    ) async throws -> SimulationResult {
        struct Body: Encodable {
            let question: String
            let choice: String
            let years: Int
            let timeHorizon: String
            let carryCards: [String]?
            enum CodingKeys: String, CodingKey {
                case question, choice, years
                case timeHorizon = "time_horizon"
                case carryCards = "carry_cards"
            }
        }
        return try await callFunction(
            "simulate",
            body: Body(question: question, choice: choice, years: horizon.apiYears,
                       timeHorizon: horizon.label, carryCards: carryCards),
            as: SimulationResult.self
        )
    }

    /// POST /analyze-diary：情绪 + 关键词
    func analyzeDiary(transcript: String) async throws -> DiaryAnalysis {
        struct Body: Encodable { let transcript: String }
        return try await callFunction("analyze-diary", body: Body(transcript: transcript), as: DiaryAnalysis.self)
    }

    // MARK: - Edge Functions（画像 / 社区 / 日记 —— 真实调用优先，失败由调用方兜底）

    /// POST /community action=kaleidoscope_draw：AI 抽取一位旅人 + 理由
    func kaleidoscopeDraw(mode: String) async throws -> (travelerId: Int, reason: String) {
        struct Body: Encodable {
            let action = "kaleidoscope_draw"
            let mode: String
        }
        struct DrawTraveler: Decodable { let id: Int }
        struct Response: Decodable {
            let traveler: DrawTraveler
            let reason: String
        }
        let res = try await callFunction("community", body: Body(mode: mode), as: Response.self)
        return (res.traveler.id, res.reason)
    }

    /// POST /save-profile action=save_dimension：维度关键词落库（服务端同步 profiles.dims）
    func saveDimensionRemote(key: DimensionKey, tags: [String]) async throws {
        struct Body: Encodable {
            let action = "save_dimension"
            let dimension: String
            let tags: [String]
            let source = "manual"
        }
        struct Response: Decodable { let ok: Bool }
        _ = try await callFunction("save-profile", body: Body(dimension: key.rawValue, tags: tags), as: Response.self)
        invalidateRemoteProfileCache()
    }

    /// GET /get-profile：云端画像全量出参。
    /// 旧调用方只用 portraitPct/dims 不受影响；新增字段解码失败时降级为空值，不让整体失败。
    struct RemoteProfile: Decodable {
        let portraitPct: Int
        let dims: [String: String]
        /// profile_dimensions 行：[{dimension, tags, source, updated_at}]
        let dimensions: [RemoteProfileDimension]
        /// card_game_results 行：[{kind, final_cards, rounds, accepted, traded}]
        let cardGames: [RemoteCardGame]
        /// public_profiles 行（未建档为 nil）
        let publicProfile: RemotePublicProfile?

        enum CodingKeys: String, CodingKey {
            case dims, dimensions
            case portraitPct = "portrait_pct"
            case cardGames = "card_games"
            case publicProfile = "public_profile"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            portraitPct = try c.decode(Int.self, forKey: .portraitPct)
            dims = try c.decode([String: String].self, forKey: .dims)
            dimensions = (try? c.decodeIfPresent([RemoteProfileDimension].self, forKey: .dimensions)) ?? []
            cardGames = (try? c.decodeIfPresent([RemoteCardGame].self, forKey: .cardGames)) ?? []
            publicProfile = try? c.decodeIfPresent(RemotePublicProfile.self, forKey: .publicProfile)
        }
    }

    // MARK: get-profile 会话缓存（60s TTL；写路径成功后失效）
    //
    // HomeModel.loadPortrait / CardGameHubView.syncRemoteGames / MeModel.syncFromRemote
    // 各自全量拉 get-profile，短时间内重复请求同一份数据 —— 在此做轻量缓存，对调用方透明。

    private var remoteProfileCache: (profile: RemoteProfile, fetchedAt: Date)?
    private static let remoteProfileCacheTTL: TimeInterval = 60

    private func invalidateRemoteProfileCache() {
        remoteProfileCache = nil
    }

    func fetchRemoteProfile() async throws -> RemoteProfile {
        if let cached = remoteProfileCache,
           Date().timeIntervalSince(cached.fetchedAt) < Self.remoteProfileCacheTTL {
            return cached.profile
        }
        var req = URLRequest(url: AppConfig.functionURL("get-profile"))
        req.timeoutInterval = 20
        req.setValue("Bearer \(try await jwt())", forHTTPHeaderField: "Authorization")
        req.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
        let (data, response) = try await URLSession.shared.data(for: req)
        try Self.throwIfHTTPError(response, data: data)
        let profile = try JSONDecoder().decode(RemoteProfile.self, from: data)
        remoteProfileCache = (profile, Date())
        return profile
    }

    /// POST /list-diary：云端真实日记条目（analyze-diary 落库）
    struct RemoteDiaryEntry: Decodable {
        let id: Int
        let transcript: String?
        let emotions: [String]?
        let keywords: [String]?
        let createdAt: String
        enum CodingKeys: String, CodingKey {
            case id, transcript, emotions, keywords
            case createdAt = "created_at"
        }
    }

    func listDiary(limit: Int = 50) async throws -> [RemoteDiaryEntry] {
        struct Body: Encodable { let limit: Int }
        struct Response: Decodable { let entries: [RemoteDiaryEntry] }
        return try await callFunction("list-diary", body: Body(limit: limit), as: Response.self).entries
    }

    /// POST /diary-summary：按月/年聚合日记 + LLM 洞察
    /// - Parameters:
    ///   - period: "month" | "year"
    ///   - ref: 月为 "2026-07"，年为 "2026"
    func diarySummary(period: String, ref: String) async throws -> DiarySummaryResponse {
        struct Body: Encodable {
            let period: String
            let ref: String
        }
        return try await callFunction("diary-summary", body: Body(period: period, ref: ref), as: DiarySummaryResponse.self)
    }

    // MARK: - Edge Functions（persona / lab-choices / list-conversations）

    /// POST /persona action=generate：按已授权画像生成数字形象（同步落库，status 通常直接 completed）
    func personaGenerate(promptOverride: String? = nil) async throws -> PersonaJob {
        struct Body: Encodable {
            let action = "generate"
            let promptOverride: String?
            enum CodingKeys: String, CodingKey {
                case action
                case promptOverride = "prompt_override"
            }
        }
        return try await callFunction("persona", body: Body(promptOverride: promptOverride), as: PersonaJob.self)
    }

    /// POST /lab-choices：人生实验室动态选择卡（{cards, rationale}）
    func labChoices(
        question: String,
        topic: String? = nil,
        constraints: [String]? = nil,
        previousChoices: [String]? = nil
    ) async throws -> LabChoiceResponse {
        struct Body: Encodable {
            let question: String
            let topic: String?
            let constraints: [String]?
            let previousChoices: [String]?
            enum CodingKeys: String, CodingKey {
                case question, topic, constraints
                case previousChoices = "previous_choices"
            }
        }
        return try await callFunction(
            "lab-choices",
            body: Body(question: question, topic: topic, constraints: constraints, previousChoices: previousChoices),
            as: LabChoiceResponse.self
        )
    }

    /// POST /list-conversations：历史会话分页（created_at 倒序）
    func listConversations(limit: Int = 20, offset: Int = 0) async throws -> (conversations: [RemoteConversation], total: Int) {
        struct Body: Encodable {
            let limit: Int
            let offset: Int
        }
        struct Response: Decodable {
            let conversations: [RemoteConversation]
            let total: Int
        }
        let res = try await callFunction("list-conversations", body: Body(limit: limit, offset: offset), as: Response.self)
        return (res.conversations, res.total)
    }

    // MARK: - Edge Functions（community 悬赏系列，按 action 分发）

    /// POST /community action=list_bounties：悬赏分页（created_at 倒序，limit 上限 50）
    func listBountiesRemote(limit: Int = 20, offset: Int = 0) async throws -> (bounties: [Bounty], total: Int) {
        struct Body: Encodable {
            let action = "list_bounties"
            let limit: Int
            let offset: Int
        }
        struct Response: Decodable {
            let bounties: [Bounty]
            let total: Int
        }
        let res = try await callFunction("community", body: Body(limit: limit, offset: offset), as: Response.self)
        return (res.bounties, res.total)
    }

    /// POST /community action=create_bounty：发布悬赏，返回新悬赏 id
    /// - Parameters:
    ///   - question: ≤200 字；tags ≤5 项（每项 ≤30 字）；detail ≤2000 字；reward ≤50 字
    @discardableResult
    func createBounty(question: String, tags: [String], detail: String, reward: String) async throws -> Int {
        struct Body: Encodable {
            let action = "create_bounty"
            let question: String
            let tags: [String]
            let detail: String
            let reward: String
        }
        struct Response: Decodable {
            let ok: Bool
            let id: Int
        }
        let res = try await callFunction(
            "community",
            body: Body(question: question, tags: tags, detail: detail, reward: reward),
            as: Response.self
        )
        return res.id
    }

    /// POST /community action=respond_bounty：对悬赏发送名片（同一悬赏同一用户 upsert 覆盖）
    func respondBounty(bountyId: Int, message: String) async throws {
        struct Body: Encodable {
            let action = "respond_bounty"
            let bountyId: Int
            let message: String
            enum CodingKeys: String, CodingKey {
                case action, message
                case bountyId = "bounty_id"
            }
        }
        struct Response: Decodable { let ok: Bool }
        _ = try await callFunction("community", body: Body(bountyId: bountyId, message: message), as: Response.self)
    }

    /// POST /community action=get_bounty：悬赏详情 + 回应列表
    func getBounty(bountyId: Int) async throws -> BountyDetailResponse {
        struct Body: Encodable {
            let action = "get_bounty"
            let bountyId: Int
            enum CodingKeys: String, CodingKey {
                case action
                case bountyId = "bounty_id"
            }
        }
        return try await callFunction("community", body: Body(bountyId: bountyId), as: BountyDetailResponse.self)
    }

    // MARK: - Edge Functions（save-profile：卡牌局 / 公开主页）

    /// POST /save-profile action=save_card_game：卡牌局结果上云（同 kind upsert 覆盖，
    /// 服务端同步把 final_cards 名称写入 profiles.dims 对应维度）。
    /// - Parameters:
    ///   - kind: "life" | "marriage" | "family" | "social"
    ///   - finalCards: 1–9 张（id/name 必填）
    /// - Returns: 服务端写入 dims 的标签（final_cards 名称）
    @discardableResult
    func saveCardGameRemote(
        kind: String,
        finalCards: [CardGameCardPayload],
        rounds: Int,
        accepted: [CardGameAcceptedEvent] = [],
        traded: [CardGameTradedEvent] = []
    ) async throws -> [String] {
        struct Body: Encodable {
            let action = "save_card_game"
            let kind: String
            let finalCards: [CardGameCardPayload]
            let rounds: Int
            let accepted: [CardGameAcceptedEvent]
            let traded: [CardGameTradedEvent]
            enum CodingKeys: String, CodingKey {
                case action, kind, rounds, accepted, traded
                case finalCards = "final_cards"
            }
        }
        struct Response: Decodable {
            let ok: Bool
            let tags: [String]?
        }
        let res = try await callFunction(
            "save-profile",
            body: Body(kind: kind, finalCards: finalCards, rounds: rounds, accepted: accepted, traded: traded),
            as: Response.self
        )
        invalidateRemoteProfileCache()
        return res.tags ?? []
    }

    /// POST /save-profile action=save_public_profile：Me 公开主页上云（public_profiles upsert）
    func savePublicProfileRemote(_ profile: MyProfile) async throws {
        struct Body: Encodable {
            let action = "save_public_profile"
            let payload: RemotePublicProfile

            func encode(to encoder: Encoder) throws {
                // 扁平化：action 与 payload 字段同级（后端从顶层读 name/quote/... ）
                var c = encoder.container(keyedBy: DynamicKey.self)
                try c.encode(action, forKey: DynamicKey("action"))
                try payload.encode(to: encoder)
            }

            struct DynamicKey: CodingKey {
                let stringValue: String
                var intValue: Int? { nil }
                init(_ key: String) { stringValue = key }
                init?(stringValue: String) { self.stringValue = stringValue }
                init?(intValue: Int) { return nil }
            }
        }
        struct Response: Decodable { let ok: Bool }
        _ = try await callFunction("save-profile", body: Body(payload: profile.remotePayload), as: Response.self)
        invalidateRemoteProfileCache()
    }

    /// GET /get-profile 的 public_profile 字段（未建档为 nil）；Me 主页云端恢复用（复用缓存）
    func fetchPublicProfileRemote() async throws -> RemotePublicProfile? {
        try await fetchRemoteProfile().publicProfile
    }
}
