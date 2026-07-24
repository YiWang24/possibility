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
        do {
            if let session = try? await client.auth.session {
                userId = session.user.id
            } else {
                let session = try await client.auth.signInAnonymously()
                userId = session.user.id
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

    /// 当前 JWT（ChatStreamClient 直连 Edge Function 用）
    func jwt() async throws -> String {
        try await client.auth.session.accessToken
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
                .select().order("id").execute().value
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
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(Out.self, from: data)
    }

    /// POST /match：3 位结局不同旅人 + 匹配理由
    func match(userState: MatchQuery) async throws -> MatchResponse {
        struct Body: Encodable { let user_state: MatchQuery }
        return try await callFunction("match", body: Body(user_state: userState), as: MatchResponse.self)
    }

    /// POST /simulate：{general, optimistic, cautionary}
    func simulate(question: String, choice: String, years: Int) async throws -> Simulation.Scenarios {
        struct Body: Encodable {
            let question: String
            let choice: String
            let years: Int
        }
        struct Response: Decodable { let scenarios: Simulation.Scenarios }
        let res = try await callFunction(
            "simulate",
            body: Body(question: question, choice: choice, years: years),
            as: Response.self
        )
        return res.scenarios
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
    }

    /// GET /get-profile：云端画像（dims 用于换机 / 重装漫游）
    struct RemoteProfile: Decodable {
        let portraitPct: Int
        let dims: [String: String]
        enum CodingKeys: String, CodingKey {
            case portraitPct = "portrait_pct"
            case dims
        }
    }

    func fetchRemoteProfile() async throws -> RemoteProfile {
        var req = URLRequest(url: AppConfig.functionURL("get-profile"))
        req.timeoutInterval = 20
        req.setValue("Bearer \(try await jwt())", forHTTPHeaderField: "Authorization")
        req.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(RemoteProfile.self, from: data)
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
}
