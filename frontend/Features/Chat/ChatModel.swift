import Foundation
import Observation

// MARK: - 探索对话视图模型（付费漏斗主线，技术设计文档 §9.1）
//
// 首页发问 → 流式承接迷茫 / 澄清 → 岔路口成形 → match 抽 3 位结局不同旅人。
// 现场网络 / LLM 抖动时回退「黄金对话」+ 兜底 match（§13）。

@Observable
@MainActor
final class ChatModel {

    struct Message: Identifiable {
        let id = UUID()
        let role: Role
        var text: String
        enum Role { case user, ai }
    }

    let launch: ChatLaunch
    var messages: [Message] = []
    var input = ""
    var isStreaming = false

    /// 岔路口成形 → 解锁「看看走过这条路的人」
    var crossroadsReady = false
    var crossroadsSummary: String?
    private var matchQuery: MatchQuery?
    /// 服务端会话 ID：首轮 done 事件返回，后续追问带回以延续历史
    private var conversationId: UUID?

    /// match 结果
    var loadingMatch = false
    var matchReady = false
    var matches: [Traveler] = []
    var matchReasons: [Int: String] = [:]

    /// 追问建议
    let followups = ["如果失败，最坏会怎样？", "我需要先准备什么？", "别人是怎么熬过来的？"]

    init(launch: ChatLaunch) {
        self.launch = launch
    }

    var showCrossroadsCTA: Bool { crossroadsReady && !matchReady && !loadingMatch }

    // MARK: 启动：把首页问题作为第一条用户消息并请求 AI

    func start(supabase: SupabaseService) async {
        guard messages.isEmpty else { return }
        messages.append(Message(role: .user, text: launch.question))
        await runAssistant(userText: launch.question, supabase: supabase)
    }

    // MARK: 继续追问

    func send(_ text: String, supabase: SupabaseService) {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty, !isStreaming else { return }
        input = ""
        messages.append(Message(role: .user, text: clean))
        Task { await runAssistant(userText: clean, supabase: supabase) }
    }

    // MARK: 流式请求 + 打字机

    private func runAssistant(userText: String, supabase: SupabaseService) async {
        isStreaming = true
        defer { isStreaming = false }

        // 历史 = 当前用户消息之前的对话
        let history = messages.dropLast().map {
            ChatRequest.Turn(role: $0.role == .user ? "user" : "assistant", content: $0.text)
        }
        messages.append(Message(role: .ai, text: ""))
        let aiIndex = messages.count - 1

        let client = ChatStreamClient(tokenProvider: { [weak supabase] in
            guard let supabase else { throw URLError(.userAuthenticationRequired) }
            return try await supabase.jwt()
        })
        let request = ChatRequest(conversationId: conversationId, topic: launch.topic.rawValue,
                                  message: userText, history: Array(history))

        do {
            for try await event in client.stream(request) {
                switch event {
                case .token(let t):
                    messages[aiIndex].text += t
                case .done(let done):
                    applyDone(done)
                }
            }
            // 若服务端未标注岔路口，但已有足够往返，则本地判定成形
            if !crossroadsReady, messages.filter({ $0.role == .ai }).count >= 1 {
                markCrossroadsReady(summary: nil)
            }
        } catch {
            // 断网兜底：黄金对话
            if messages[aiIndex].text.isEmpty {
                messages[aiIndex].text = Self.goldenReply(for: launch)
            }
            markCrossroadsReady(summary: Self.goldenSummary(for: launch))
        }
    }

    private func applyDone(_ done: ChatStreamDone) {
        if let id = done.conversationId { conversationId = id }
        if let c = done.crossroads, c.ready {
            markCrossroadsReady(summary: c.summary)
            matchQuery = c.matchQuery
        }
    }

    private func markCrossroadsReady(summary: String?) {
        crossroadsReady = true
        if let summary { crossroadsSummary = summary }
    }

    // MARK: match（看看走过这条路的人）

    func showMatch(supabase: SupabaseService) async {
        guard !matchReady, !loadingMatch else { return }
        loadingMatch = true
        defer { loadingMatch = false }

        let query = matchQuery ?? Self.defaultQuery(for: launch)
        let pool = supabase.travelers.isEmpty ? DemoData.travelers : supabase.travelers

        if let resp = try? await supabase.match(userState: query) {
            var picked: [Traveler] = []
            for m in resp.matches {
                if let t = pool.first(where: { $0.id == m.travelerId }) {
                    picked.append(t)
                    matchReasons[t.id] = m.reason
                }
            }
            matches = picked.isEmpty ? Self.fallbackMatches(from: pool) : picked
        } else {
            matches = Self.fallbackMatches(from: pool)
        }
        matchReady = true
    }

    // MARK: - 兜底内容

    private static func fallbackMatches(from pool: [Traveler]) -> [Traveler] {
        let similar = pool.filter { $0.isSimilar }
        let base = similar.isEmpty ? pool : similar
        return Array(base.prefix(3))
    }

    private static func defaultQuery(for launch: ChatLaunch) -> MatchQuery {
        MatchQuery(lifeStage: "职业/身份转换期", constraints: ["害怕沉没成本", "收入波动顾虑"],
                   tension: launch.question, decisionStage: "临界点", supportNeed: "想看别人怎么走过")
    }

    private static func goldenSummary(for launch: ChatLaunch) -> String {
        switch launch.topic {
        case .career: return "深耕设计 vs 转型产品"
        case .study: return "继续工作 vs 辞职读研"
        case .family: return "留在当前城市 vs 搬回家乡"
        case .love: return "维持异地 vs 为 TA 换城"
        }
    }

    private static func goldenReply(for launch: ChatLaunch) -> String {
        "先接住你——会反复盘旋，说明这件事对你不轻。给你一个**初步判断**（不是结论）：你纠结的其实不是「能不能学会新技能」，而是「要不要放下已经积累的身份」。\n\n我们把它收敛成一个更清楚的岔路口：\n\n**\(goldenSummary(for: launch))**。\n\n两条路都没有标准答案，区别在于你更怕哪一种「后悔」。要不要看看真正走过这条路的人，是怎么面对同一个岔路口的？"
    }
}
