import Foundation
import Observation

// MARK: - 探索对话视图模型（付费漏斗主线，技术设计文档 §9.1）
//
// 首页发问 → 流式承接迷茫 / 澄清 → AI 给出「暂时的理解」→ 验证反馈
// （嗯，比较接近 / 还不太对，可循环纠正）→ 信息足够 → 下一步面板
// （去人生实验室 / 看走过这条路的人 / 分享 / 完整总结）。对照原型 chatState 阶段机。
//
// 真实优先：验证 / 纠正回合同样作为消息经 /chat 续轮（带 conversation_id，
// 服务端自动加载最近历史）；岔路口成形后用 crossroads.match_query 调 /match。
// 现场网络 / LLM 抖动时回退本地文案（§13），不让页面卡死。

@Observable
@MainActor
final class ChatModel {

    struct Message: Identifiable {
        let id = UUID()
        let role: Role
        var text: String
        enum Role { case user, ai }
    }

    /// 对话阶段（对照原型 chatState.stage）
    enum Stage {
        case clarify      // 澄清中
        case review       // AI 给出理解，等待用户验证
        case correction   // 用户说「还不太对」，等待改写
        case ready        // 信息足够，展示下一步面板
    }

    let launch: ChatLaunch
    var messages: [Message] = []
    var input = ""
    var isStreaming = false

    var stage: Stage = .clarify
    /// 验证 chips 是否可见（AI 理解后出现，点击即移除）
    var showActionChips = false
    /// 经历过纠正循环 → chips 文案变为「这次准确了 / 我再补充一点」
    var hadCorrection = false
    /// 下一步面板（信息已经足够 · 选择下一步）
    var showNextPanel = false
    /// 完整总结页
    var showSummary = false
    /// 用户在澄清 / 纠正中的原话（结论、总结与分享文案插值）
    var answers: [String] = []

    /// 服务端会话 ID：首轮 done 事件返回，后续追问带回以延续历史
    private var conversationId: UUID?
    /// 最近一次 done 事件（或历史恢复）携带的岔路口信号
    private(set) var crossroads: Crossroads?

    // MARK: 岔路口 → /match（走过这条路的人）

    /// 匹配到的旅人（≤3 位，已按 supabase.travelers 解析出完整信息）
    private(set) var matchedTravelers: [Traveler] = []
    /// traveler_id → 推荐理由（可解释）
    private(set) var matchReasons: [Int: String] = [:]
    /// 每个岔路口只请求一次；失败静默（面板回退「看相似经历」切 Tab）
    private var matchAttempted = false

    // MARK: 历史会话

    /// 近期会话（listConversations；失败为空 → 入口不显示）
    private(set) var history: [RemoteConversation] = []
    var showHistory = false
    /// 恢复历史会话后覆盖 launch 的话题 / 问题（顶栏与总结页展示用）
    private(set) var restoredTopic: String?
    private(set) var restoredQuestion: String?

    init(launch: ChatLaunch) {
        self.launch = launch
    }

    var confirmLabel: String { hadCorrection ? "这次准确了" : "嗯，比较接近" }
    var correctLabel: String { hadCorrection ? "我再补充一点" : "还不太对" }

    /// 顶栏 / 总结页展示的话题（历史恢复后取会话自身的 topic）
    var displayTopic: String? { restoredTopic ?? launch.topic?.rawValue }
    /// 总结页 / 分享文案的问题（历史恢复后取该会话首条用户消息）
    var displayQuestion: String { restoredQuestion ?? launch.question }

    /// 历史入口条目（排除当前会话自身）
    var historyEntries: [RemoteConversation] {
        history.filter { $0.id != conversationId }
    }

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
        answers.append(clean)

        if stage == .correction {
            // 纠正回合：把用户改写的原话续轮发回 /chat；网络失败回退本地复述
            Task {
                _ = await streamAssistant(
                    userText: clean, supabase: supabase,
                    fallback: "明白了。更准确的说法应该是：**\(clean)**\n\n我会保留你的原话，不再把它改写成一个性格结论。")
                hadCorrection = true
                stage = .review
                showActionChips = true
            }
        } else {
            Task { await runAssistant(userText: clean, supabase: supabase) }
        }
    }

    // MARK: 验证反馈（chips）—— 作为真实消息续轮

    /// 「嗯，比较接近 / 这次准确了」→ 续轮拿 AI 结论 → 下一步面板
    func confirmInsight(supabase: SupabaseService) {
        guard !isStreaming else { return }
        showActionChips = false
        let userText = hadCorrection ? "这次准确了。" : "嗯，这个理解比较接近我。"
        messages.append(Message(role: .user, text: userText))
        let a0 = answers.first ?? "真正想要的生活"
        let a1 = answers.count > 1 ? answers[1] : "暂时不能失去的东西"
        Task {
            _ = await streamAssistant(
                userText: userText, supabase: supabase,
                fallback: "现在的信息已经够了。我的判断是：你并不是没有答案，而是**想靠近「\(a0)」的同时，也在保护「\(a1)」**。\n\n真正需要验证的，不是哪条路绝对正确，而是哪一种代价是你愿意承担、也有能力承担的。")
            try? await Task.sleep(for: .milliseconds(500))
            stage = .ready
            showNextPanel = true
            requestMatch(supabase: supabase)
        }
    }

    /// 「还不太对 / 我再补充一点」→ 续轮请 AI 追问最不准确的部分
    func requestCorrection(supabase: SupabaseService) {
        guard !isStreaming else { return }
        showActionChips = false
        let userText = "还不太对。"
        messages.append(Message(role: .user, text: userText))
        stage = .correction
        Task {
            _ = await streamAssistant(
                userText: userText, supabase: supabase,
                fallback: "谢谢你纠正我。**最不准确的是哪一部分？**你可以直接改写成你自己的话，我会以你的表达为准。")
        }
    }

    // MARK: 岔路口 → /match

    /// crossroads.ready 后用 match_query 请求 3 位旅人；失败静默（不打断主线）
    func requestMatch(supabase: SupabaseService) {
        guard !matchAttempted, let query = crossroads?.matchQuery, crossroads?.ready == true else { return }
        matchAttempted = true
        Task {
            do {
                let response = try await supabase.match(userState: query)
                if supabase.travelers.isEmpty { await supabase.loadTravelers() }
                var travelers: [Traveler] = []
                var reasons: [Int: String] = [:]
                for m in response.matches {
                    guard let t = supabase.travelers.first(where: { $0.id == m.travelerId }) else { continue }
                    travelers.append(t)
                    reasons[t.id] = m.reason
                }
                matchedTravelers = travelers
                matchReasons = reasons
            } catch {
                // 静默：下一步面板回退「看相似经历」切 Tab
            }
        }
    }

    // MARK: 历史会话（listConversations + loadMessages）

    func loadHistory(supabase: SupabaseService) async {
        do {
            history = try await supabase.listConversations(limit: 20, offset: 0).conversations
        } catch {
            history = []   // 静默：入口不显示
        }
    }

    /// 恢复一段历史会话：loadMessages 回填消息与 conversation_id，继续对话
    func restore(_ convo: RemoteConversation, supabase: SupabaseService) async {
        guard !isStreaming else { return }
        let remote = await supabase.loadMessages(conversationId: convo.id)
        guard !remote.isEmpty else { return }   // 拉取失败静默，保持当前对话

        conversationId = convo.id
        restoredTopic = convo.topic
        restoredQuestion = remote.first(where: { $0.role == .user })?.content
        crossroads = convo.crossroads
        messages = remote.map { Message(role: $0.role == .user ? .user : .ai, text: $0.content) }
        answers = Array(remote.filter { $0.role == .user }.map(\.content).dropFirst())
        hadCorrection = false
        showNextPanel = false
        showSummary = false
        matchedTravelers = []
        matchReasons = [:]
        matchAttempted = false

        if convo.crossroads?.ready == true {
            // 岔路口已成形：直接进入验证态，允许继续确认 / 纠正
            stage = .review
            showActionChips = true
            requestMatch(supabase: supabase)
        } else {
            stage = .clarify
            showActionChips = false
        }
        showHistory = false
    }

    // MARK: 分享文案（原型 shareChatExploration 模板）

    var shareText: String {
        let a0 = answers.first ?? "真正想要的生活"
        let a1 = answers.count > 1 ? answers[1] : "暂时不能失去的东西"
        return "我刚在万花筒探索了一个问题：\(displayQuestion)\n\n我现在更清楚的是：我既想靠近\(a0)，也在保护\(a1)。"
    }

    // MARK: 流式请求 + 打字机

    /// 澄清回合：流式请求，失败回退黄金对话，并按信号决定是否出验证 chips
    private func runAssistant(userText: String, supabase: SupabaseService) async {
        let result = await streamAssistant(userText: userText, supabase: supabase,
                                           fallback: Self.goldenReply(for: launch))
        // AI 已给出足够的理解（服务端标注岔路口 / 黄金对话兜底 / 已有两轮澄清）→ 出验证 chips
        let aiCount = messages.filter { $0.role == .ai && !$0.text.isEmpty }.count
        if stage == .clarify, result.ready || !result.delivered || aiCount >= 2 {
            try? await Task.sleep(for: .milliseconds(850))
            stage = .review
            showActionChips = true
        }
    }

    /// 通用续轮：把 userText 经 /chat 流式发送（带 conversation_id）。
    /// - Returns: delivered = 是否拿到真实回复（false 表示已用 fallback 文案兜底）；
    ///            ready = 本轮 done 事件是否标注岔路口成形。
    @discardableResult
    private func streamAssistant(
        userText: String,
        supabase: SupabaseService,
        fallback: @autoclosure () -> String
    ) async -> (delivered: Bool, ready: Bool) {
        isStreaming = true
        defer { isStreaming = false }

        // 历史 = 当前用户消息之前的对话（服务端也会按 conversation_id 取库内历史）
        let history = messages.dropLast().map {
            ChatRequest.Turn(role: $0.role == .user ? "user" : "assistant", content: $0.text)
        }
        messages.append(Message(role: .ai, text: ""))
        let aiIndex = messages.count - 1

        let client = ChatStreamClient(tokenProvider: { [weak supabase] in
            guard let supabase else { throw URLError(.userAuthenticationRequired) }
            return try await supabase.jwt()
        })
        let request = ChatRequest(conversationId: conversationId,
                                  topic: displayTopic ?? "综合",
                                  message: userText, history: Array(history))

        var ready = false
        do {
            for try await event in client.stream(request) {
                switch event {
                case .token(let t):
                    messages[aiIndex].text += t
                case .done(let done):
                    if let id = done.conversationId { conversationId = id }
                    if let c = done.crossroads {
                        crossroads = c   // 后端每轮 done 都带 crossroads，持续刷新
                        if c.ready { ready = true }
                    }
                }
            }
        } catch {
            // 断网 / 服务抖动：已有部分文本则保留，否则回退本地文案
            if messages[aiIndex].text.isEmpty {
                try? await Task.sleep(for: .milliseconds(700))
                messages[aiIndex].text = fallback()
                return (false, ready)
            }
        }
        if messages[aiIndex].text.isEmpty {
            messages[aiIndex].text = fallback()
            return (false, ready)
        }
        if ready { requestMatch(supabase: supabase) }   // 岔路口成形 → 预取匹配旅人
        return (true, ready)
    }

    // MARK: - 兜底内容

    private static func goldenSummary(for launch: ChatLaunch) -> String {
        switch launch.topic {
        case .career, nil: return "深耕设计 vs 转型产品"
        case .study: return "继续工作 vs 辞职读研"
        case .family: return "留在当前城市 vs 搬回家乡"
        case .love: return "维持异地 vs 为 TA 换城"
        }
    }

    private static func goldenReply(for launch: ChatLaunch) -> String {
        "先接住你——会反复盘旋，说明这件事对你不轻。我先试着说一个**暂时的理解**：你卡住的可能不只是「该选哪一个」，而是既想保护「真正重视的东西」，又不想忽略「现实里已经出现的信号」。\n\n我们把它收敛成一个更清楚的岔路口：\n\n**\(goldenSummary(for: launch))**。\n\n所以你需要的也许不是别人替你判断，而是把**真实意愿**和**害怕付出的代价**拆开来看。这个理解接近你吗？"
    }
}
