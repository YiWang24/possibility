import Foundation
import Observation
import Supabase

/// Supabase 封装：邮箱密码 / Apple Auth、Postgres 读写（受 RLS 约束）、mock 解锁。
/// 服务端状态经此拉取缓存；UI/客户端状态留在各 Feature Model（二者分治，见技术设计文档 §8.2）。
@Observable
@MainActor
final class SupabaseService {

    let client: SupabaseClient

    // MARK: - 会话状态

    private(set) var userId: UUID?
    private(set) var isReady = false
    private(set) var lastError: String?
    /// 当前 Auth 用户；登录/登出/换账号后由 authStateChanges 刷新
    private(set) var currentUser: User?
    private var authListener: Task<Void, Never>?

    /// 是否已登录 —— 匿名模式已停用，根视图据此在登录墙与主界面之间分流
    var isAuthenticated: Bool { currentUser != nil }

    /// 当前账号邮箱（Me 页展示；Apple 私密转发地址也是邮箱）
    var emailDisplay: String? {
        guard let email = currentUser?.email, !email.isEmpty else { return nil }
        return email
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

    // MARK: - 启动：恢复会话 + 预取

    /// 冷启动。匿名登录已停用 —— 没有会话就停在 isReady 上，由根视图切登录墙；
    /// 此时预取毫无意义（所有 Edge Function 都强制校验 JWT，只会换回一片 401）。
    func bootstrap() async {
        startAuthListener()
        if let session = try? await client.auth.session {
            userId = session.user.id
            currentUser = session.user
            isReady = true
            syncAnalyticsIdentity(user: session.user)
            await prefetchAll()
        } else {
            isReady = true
        }
    }

    /// 预取公开内容 + 用户侧数据（需要有效会话）
    private func prefetchAll() async {
        async let t: Void = loadTravelers()
        async let b: Void = loadBounties()
        async let p: Void = loadProfile()
        async let u: Void = loadUnlocks()
        _ = await (t, b, p, u)
    }

    /// 监听会话变化（换账号 / 登出 / 刷新 token），保持 currentUser 与 UI 同步
    private func startAuthListener() {
        guard authListener == nil else { return }
        authListener = Task { [weak self] in
            guard let self else { return }
            for await (event, session) in self.client.auth.authStateChanges {
                guard [.signedIn, .signedOut, .userUpdated, .tokenRefreshed].contains(event) else { continue }
                // 登出时 session 为 nil，userId 必须跟着置空：留着旧 id 会让
                // loadProfile / loadUnlocks 继续拿别人的 uid 去查（RLS 下必然失败）
                self.currentUser = session?.user
                self.userId = session?.user.id
            }
        }
    }

    /// 当前 JWT（ChatStreamClient / callFunction 用）。
    /// 匿名登录已停用：没有会话就是真的没登录 —— 直接抛，让登录墙接管，
    /// 而不是拿一个注定 401 的请求去撞后端。
    func jwt() async throws -> String {
        guard let session = try? await client.auth.session else {
            throw NotSignedInError()
        }
        return session.accessToken
    }

    // MARK: - 登录（邮箱密码 / Apple —— 技术设计文档 §登录系统）

    /// 会话缺失（未登录或已过期）
    struct NotSignedInError: LocalizedError {
        var errorDescription: String? { "登录已过期，请重新登录" }
    }

    /// 注册成功但未直接拿到会话（线上开启了邮箱确认）
    struct EmailConfirmationRequired: LocalizedError {
        var errorDescription: String? { "注册成功，请查收确认邮件并完成验证后登录" }
    }

    /// 邮箱注册。config.toml 关了邮箱确认 → 正常返回即带 session（注册即登录）；
    /// 线上若开着确认邮件，session 为 nil，此时抛错提示查收邮件而不是假装已登录。
    func signUp(email: String, password: String) async throws {
        let response = try await client.auth.signUp(email: email, password: password)
        guard let session = response.session else { throw EmailConfirmationRequired() }
        await completeSignIn(user: session.user, method: "email")
    }

    /// 邮箱密码登录
    func signIn(email: String, password: String) async throws {
        let session = try await client.auth.signIn(email: email, password: password)
        await completeSignIn(user: session.user, method: "email")
    }

    /// Apple 原生登录（signInWithIdToken）。
    /// - Parameter fullName: Apple 仅首次授权返回，随手写入 user metadata
    func signInWithApple(idToken: String, nonce: String, fullName: String?) async throws {
        let session = try await client.auth.signInWithIdToken(
            credentials: .init(provider: .apple, idToken: idToken, nonce: nonce)
        )
        if let fullName, !fullName.isEmpty {
            _ = try? await client.auth.update(user: UserAttributes(data: ["full_name": .string(fullName)]))
        }
        await completeSignIn(user: session.user, method: "apple")
    }

    /// 登录成功后的统一收尾：埋点身份 → 会话状态 → 全量预取。
    /// 拉的是全量而非只有用户侧：登录前 bootstrap 跳过了预取，公开内容也还是空的。
    private func completeSignIn(user: User, method: String) async {
        syncAnalyticsIdentity(user: user)
        userId = user.id
        currentUser = user
        invalidateRemoteProfileCache()
        await prefetchAll()
        Analytics.shared.track(.authCompleted(method: method))
    }

    /// 退出登录：清空会话与本地缓存（不再回落匿名，根视图自动切回登录墙）
    func signOut() async {
        try? await client.auth.signOut()
        resetUserCaches()
        // 断开本地身份关联：登出后的行为不能继续挂在旧账号上
        Analytics.shared.reset()
    }

    /// 注销账号（App Store 5.1.1(v)）：服务端删除 auth 用户（业务表级联清理）后本地登出
    func deleteAccount() async throws {
        struct Body: Encodable {}
        struct Response: Decodable { let ok: Bool }
        _ = try await callFunction("delete-account", body: Body(), as: Response.self)
        await signOut()
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
            profile = UserProfile(id: uid, portraitPct: AppConfig.Threshold.portraitInitialPct)
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
        let requestId: String?
        var statusCode: Int = 0

        enum CodingKeys: String, CodingKey {
            case error
            case requestId = "request_id"
        }

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
        let requestId = UUID().uuidString
        var req = URLRequest(url: AppConfig.functionURL(name))
        req.httpMethod = "POST"
        // simulate/match 的结构化生成可达 2 分钟以上，默认 60s 会提前断开
        req.timeoutInterval = 180
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(try await jwt())", forHTTPHeaderField: "Authorization")
        req.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.setValue(requestId, forHTTPHeaderField: "X-Request-ID")
        req.httpBody = try JSONEncoder().encode(body)
        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            try Self.throwIfHTTPError(response, data: data)
            return try JSONDecoder().decode(Out.self, from: data)
        } catch {
            let correlatedId = (error as? EdgeFunctionError)?.requestId ?? requestId
            AppObservability.recordRequestFailure(
                function: name,
                requestId: correlatedId,
                error: error
            )
            throw error
        }
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
    func analyzeDiary(transcript: String, inputMethod: String) async throws -> DiaryAnalysis {
        struct Body: Encodable {
            let transcript: String
            let input_method: String
        }
        return try await callFunction(
            "analyze-diary",
            body: Body(transcript: transcript, input_method: inputMethod),
            as: DiaryAnalysis.self
        )
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

    /// POST /save-profile action=save_dimension：画像事实落库；测评来源同时原子保存原始结果。
    func saveDimensionRemote(
        key: DimensionKey,
        tags: [String],
        source: String = "manual",
        assessmentKind: AssessmentKind? = nil,
        assessmentAnswers: [Int]? = nil,
        assessmentScores: [String: Int]? = nil
    ) async throws {
        try await saveDimensionRemote(
            dimension: key.rawValue,
            tags: tags,
            source: source,
            assessmentKind: assessmentKind,
            assessmentAnswers: assessmentAnswers,
            assessmentScores: assessmentScores
        )
    }

    /// 人格底色不属于 DimensionKey 的软维度枚举，使用字符串重载走同一后端契约。
    func saveDimensionRemote(
        dimension: String,
        tags: [String],
        source: String = "manual",
        assessmentKind: AssessmentKind? = nil,
        assessmentAnswers: [Int]? = nil,
        assessmentScores: [String: Int]? = nil
    ) async throws {
        struct Body: Encodable {
            let action = "save_dimension"
            let dimension: String
            let tags: [String]
            let source: String
            let assessmentKind: String?
            let assessmentAnswers: [Int]?
            let assessmentScores: [String: Int]?

            enum CodingKeys: String, CodingKey {
                case action, dimension, tags, source
                case assessmentKind = "assessment_kind"
                case assessmentAnswers = "assessment_answers"
                case assessmentScores = "assessment_scores"
            }
        }
        struct Response: Decodable { let ok: Bool }
        _ = try await callFunction(
            "save-profile",
            body: Body(
                dimension: dimension,
                tags: tags,
                source: source,
                assessmentKind: assessmentKind?.rawValue,
                assessmentAnswers: assessmentAnswers,
                assessmentScores: assessmentScores
            ),
            as: Response.self
        )
        invalidateRemoteProfileCache()
    }

    /// GET /get-profile：云端画像全量出参，事实表是唯一画像内容来源。
    struct RemoteProfile: Decodable {
        struct Verification: Decodable, Sendable {
            let status: String
            let provider: String?
            let verifiedAt: String?

            enum CodingKeys: String, CodingKey {
                case status, provider
                case verifiedAt = "verified_at"
            }
        }

        let portraitPct: Int
        let profileRevision: Int
        let verification: Verification
        let facts: [ProfileFact]
        /// card_game_results 行：[{kind, final_cards, rounds, accepted, traded}]
        let cardGames: [RemoteCardGame]
        /// public_profiles 行（未建档为 nil）
        let publicProfile: RemotePublicProfile?

        enum CodingKeys: String, CodingKey {
            case portraitPct = "portrait_pct"
            case profileRevision = "profile_revision"
            case facts, verification
            case cardGames = "card_games"
            case publicProfile = "public_profile"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            portraitPct = try c.decode(Int.self, forKey: .portraitPct)
            profileRevision = (try? c.decodeIfPresent(Int.self, forKey: .profileRevision)) ?? 0
            verification = (try? c.decodeIfPresent(
                Verification.self,
                forKey: .verification
            )) ?? Verification(status: "unverified", provider: nil, verifiedAt: nil)
            facts = (try? c.decodeIfPresent([ProfileFact].self, forKey: .facts)) ?? []
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

    func fetchRemoteProfile(force: Bool = false) async throws -> RemoteProfile {
        if !force, let cached = remoteProfileCache,
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

    // MARK: - 个人档案与 AI 隐私

    func fetchProfilePrivacy() async throws -> ProfilePrivacySnapshot {
        struct Body: Encodable { let action = "get" }
        return try await callFunction(
            "profile-privacy",
            body: Body(),
            as: ProfilePrivacySnapshot.self
        )
    }

    /// 返回格式化后的可移植 JSON；服务端导出中包含事实来源和最小化使用回执。
    func exportProfileData() async throws -> String {
        struct Body: Encodable { let action = "export" }
        var req = URLRequest(url: AppConfig.functionURL("profile-privacy"))
        req.httpMethod = "POST"
        req.timeoutInterval = 180
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(try await jwt())", forHTTPHeaderField: "Authorization")
        req.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.httpBody = try JSONEncoder().encode(Body())
        let (data, response) = try await URLSession.shared.data(for: req)
        try Self.throwIfHTTPError(response, data: data)
        let object = try JSONSerialization.jsonObject(with: data)
        let pretty = try JSONSerialization.data(
            withJSONObject: object,
            options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        )
        return String(decoding: pretty, as: UTF8.self)
    }

    func confirmProfileFact(_ id: UUID, expectedRevision: Int) async throws {
        struct Body: Encodable {
            let action = "confirm_fact"
            let factId: UUID
            let profileRevision: Int

            enum CodingKeys: String, CodingKey {
                case action
                case factId = "fact_id"
                case profileRevision = "profile_revision"
            }
        }
        struct Response: Decodable { let ok: Bool }
        _ = try await callFunction(
            "profile-privacy",
            body: Body(factId: id, profileRevision: expectedRevision),
            as: Response.self
        )
        invalidateRemoteProfileCache()
    }

    func reviewProfileProposal(
        _ id: UUID,
        accept: Bool,
        expectedRevision: Int
    ) async throws {
        struct Body: Encodable {
            let action = "review_proposal"
            let proposalId: UUID
            let accept: Bool
            let profileRevision: Int

            enum CodingKeys: String, CodingKey {
                case action, accept
                case proposalId = "proposal_id"
                case profileRevision = "profile_revision"
            }
        }
        struct Response: Decodable { let ok: Bool }
        _ = try await callFunction(
            "profile-privacy",
            body: Body(
                proposalId: id,
                accept: accept,
                profileRevision: expectedRevision
            ),
            as: Response.self
        )
        invalidateRemoteProfileCache()
    }

    func deleteProfileDimension(_ dimension: String, expectedRevision: Int) async throws {
        struct Body: Encodable {
            let action = "delete_dimension"
            let dimension: String
            let profileRevision: Int

            enum CodingKeys: String, CodingKey {
                case action, dimension
                case profileRevision = "profile_revision"
            }
        }
        struct Response: Decodable { let ok: Bool }
        _ = try await callFunction(
            "profile-privacy",
            body: Body(dimension: dimension, profileRevision: expectedRevision),
            as: Response.self
        )
        invalidateRemoteProfileCache()
    }

    func setProfileFactVisibility(
        _ id: UUID,
        visibility: String,
        expectedRevision: Int
    ) async throws {
        struct Body: Encodable {
            let action = "set_visibility"
            let factId: UUID
            let visibility: String
            let profileRevision: Int

            enum CodingKeys: String, CodingKey {
                case action, visibility
                case factId = "fact_id"
                case profileRevision = "profile_revision"
            }
        }
        struct Response: Decodable { let ok: Bool }
        _ = try await callFunction(
            "profile-privacy",
            body: Body(
                factId: id,
                visibility: visibility,
                profileRevision: expectedRevision
            ),
            as: Response.self
        )
        invalidateRemoteProfileCache()
    }

    func clearProfile(expectedRevision: Int) async throws {
        struct Body: Encodable {
            let action = "clear_profile"
            let profileRevision: Int

            enum CodingKeys: String, CodingKey {
                case action
                case profileRevision = "profile_revision"
            }
        }
        struct Response: Decodable { let ok: Bool }
        _ = try await callFunction(
            "profile-privacy",
            body: Body(profileRevision: expectedRevision),
            as: Response.self
        )
        invalidateRemoteProfileCache()
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

    /// POST /save-profile action=save_card_game：卡牌结果与对应画像事实原子落库。
    /// - Parameters:
    ///   - kind: "life" | "marriage" | "family" | "social"
    ///   - finalCards: 1–9 张（id/name 必填）
    /// - Returns: 服务端写入画像事实的标签（final_cards 名称）
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
