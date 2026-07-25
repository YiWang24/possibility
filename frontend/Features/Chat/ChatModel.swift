import Foundation
import Observation

// MARK: - 探索对话视图模型（付费漏斗主线，技术设计文档 §9.1）
//
// 首页发问 → 流式承接迷茫 / 澄清 → AI 给出「暂时的理解」→ 验证反馈
// （嗯，比较接近 / 还不太对，可循环纠正）→ 信息足够 → 下一步面板
// （去人生实验室 / 看走过这条路的人 / 分享 / 完整总结）。对照原型 chatState 阶段机。
//
// 首页四条示例问题的首轮、验证后的结论与纠正追问使用本地 mock，保证产品主线
// 确定可达；用户在纠正追问后给出自己的改写时，再把完整上下文交给 /chat。
// 岔路口成形后用 crossroads.match_query 调 /match。

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
    /// 四条示例问题从本地 mock 开场；第一次转真实 API 时需要显式补齐这段上下文。
    private var startedWithMock = false
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

    // MARK: 验证 chips 发送的固定短语
    //
    // confirmInsight / requestCorrection 以这些固定句作为用户消息续轮；
    // restore 重建 answers 时按此集合过滤，避免污染结论 / 分享文案的插值。

    private static let confirmPhrase = "嗯，这个理解比较接近我。"
    private static let confirmAfterCorrectionPhrase = "这次准确了。"
    private static let correctionPhrase = "还不太对。"
    private static let correctionPrompt = "谢谢你纠正我。**最不准确的是哪一部分？**你可以直接改写成你自己的话，我会以你的表达为准。"
    private static let verificationPhrases: Set<String> = [
        confirmPhrase, confirmAfterCorrectionPhrase, correctionPhrase,
    ]
    private static let apiFailureMessage = "我好像在接你的路上迷路了，请重试一下。"

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
        if ExploreTopic.isSampleQuestion(launch.question) {
            startedWithMock = true
            await appendLocalReply(Self.goldenReply(for: launch))
            stage = .review
            showActionChips = true
        } else {
            await runAssistant(userText: launch.question, supabase: supabase)
        }
    }

    // MARK: 继续追问

    func send(_ text: String, supabase: SupabaseService) {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty, !isStreaming else { return }
        input = ""
        messages.append(Message(role: .user, text: clean))
        answers.append(clean)

        if stage == .correction {
            // 纠正回合：用户已经输入新内容，始终续轮请求 /chat。
            Task {
                let result = await streamAssistant(userText: clean, supabase: supabase)
                if result.delivered {
                    hadCorrection = true
                    stage = .review
                    showActionChips = true
                }
            }
        } else {
            Task { await runAssistant(userText: clean, supabase: supabase) }
        }
    }

    // MARK: 验证反馈（chips）—— 本地主线，纠正后的用户原话再接 API

    /// 「嗯，比较接近 / 这次准确了」→ 本地结论 → 下一步面板。
    /// 这是原型定义的确定性主线，不依赖 API 是否可用。
    func confirmInsight(supabase: SupabaseService) {
        guard !isStreaming else { return }
        showActionChips = false
        let userText = hadCorrection ? Self.confirmAfterCorrectionPhrase : Self.confirmPhrase
        messages.append(Message(role: .user, text: userText))
        Task {
            await appendLocalReply(Self.confirmedReply(answers: answers))
            stage = .ready
            showNextPanel = true
            requestMatch(supabase: supabase)
        }
    }

    /// 「还不太对 / 我再补充一点」→ 先展示固定追问，不请求 API。
    /// 用户下一轮写下自己的改写后，send(_:supabase:) 才会进入 /chat。
    func requestCorrection() {
        guard !isStreaming else { return }
        showActionChips = false
        messages.append(Message(role: .user, text: Self.correctionPhrase))
        stage = .correction
        Task {
            await appendLocalReply(Self.correctionPrompt)
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
        // answers = 首条问题之后的用户原话；过滤 chips 固定验证短语，
        // 避免「嗯，这个理解比较接近我。」之类混入结论 / 分享文案插值
        answers = remote.filter { $0.role == .user }.map(\.content).dropFirst()
            .filter { !Self.verificationPhrases.contains($0) }
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

    /// 澄清回合：流式请求，并按服务端信号决定是否出验证 chips。
    private func runAssistant(userText: String, supabase: SupabaseService) async {
        let result = await streamAssistant(userText: userText, supabase: supabase)
        guard result.delivered else { return }
        // AI 已给出足够的理解（服务端标注岔路口 / 已有两轮澄清）→ 出验证 chips
        let aiCount = messages.filter { $0.role == .ai && !$0.text.isEmpty }.count
        if stage == .clarify, result.ready || aiCount >= 2 {
            try? await Task.sleep(for: .milliseconds(850))
            stage = .review
            showActionChips = true
        }
    }

    /// 通用续轮：把 userText 经 /chat 流式发送（带 conversation_id）。
    /// - Returns: delivered = 是否完整拿到真实回复（收到 done 事件；false 表示
    ///            半途中断或 API 失败，调用方不推进状态）；
    ///            ready = 本轮 done 事件是否标注岔路口成形。
    @discardableResult
    private func streamAssistant(
        userText: String,
        supabase: SupabaseService,
    ) async -> (delivered: Bool, ready: Bool) {
        isStreaming = true
        defer { isStreaming = false }

        // 服务端按 conversation_id 自取库内历史（validateChatInput 忽略 history）。
        // mock 首轮尚无 conversation_id，因此第一次调用 API 时把原问题、mock 理解和
        // 用户最新反馈合并进 message，确保模型知道用户正在认同或否定什么。
        let history: [ChatRequest.Turn] = conversationId != nil ? [] : messages.dropLast().map {
            ChatRequest.Turn(role: $0.role == .user ? "user" : "assistant", content: $0.text)
        }
        messages.append(Message(role: .ai, text: ""))
        let aiIndex = messages.count - 1

        let client = ChatStreamClient(tokenProvider: { [weak supabase] in
            guard let supabase else { throw URLError(.userAuthenticationRequired) }
            return try await supabase.jwt()
        })
        let apiMessage: String
        if startedWithMock, conversationId == nil {
            apiMessage = """
            此前的本地示例对话上下文：
            用户最初的问题：\(launch.question)
            助手给出的初步理解：\(Self.goldenReply(for: launch))

            用户现在的反馈或补充：\(userText)

            请承接这段上下文继续倾听。如果用户不认同初步理解，不要为原判断辩护，也不要立即换一组新的二者对立。先区分：是对两股拉力的具体理解不准确，还是用户的问题本身就不适合二元框架。如果不适合，停止使用 vs 结构，转而探索多重方向、信息缺口、行动阻力或尚未命名的感受。
            """
        } else {
            apiMessage = userText
        }
        let request = ChatRequest(conversationId: conversationId,
                                  topic: displayTopic ?? "综合",
                                  message: apiMessage, history: history)

        var ready = false
        var receivedDone = false
        do {
            for try await event in client.stream(request) {
                switch event {
                case .token(let t):
                    messages[aiIndex].text += t
                case .done(let done):
                    receivedDone = true
                    if let id = done.conversationId { conversationId = id }
                    if let c = done.crossroads {
                        crossroads = c   // 后端每轮 done 都带 crossroads，持续刷新
                        if c.ready { ready = true }
                    }
                }
            }
        } catch {
            messages[aiIndex].text = Self.apiFailureMessage
            return (false, ready)
        }
        if messages[aiIndex].text.isEmpty {
            messages[aiIndex].text = Self.apiFailureMessage
            return (false, ready)
        }
        guard receivedDone else {
            // 流结束但没有 done 事件，视为 API 失败，不展示不完整的模型输出。
            messages[aiIndex].text = Self.apiFailureMessage
            return (false, ready)
        }
        if ready { requestMatch(supabase: supabase) }   // 岔路口成形 → 预取匹配旅人
        return (true, ready)
    }

    /// 四条首页示例问题首轮使用的本地 mock 回复。
    private func appendLocalReply(_ text: String) async {
        isStreaming = true
        defer { isStreaming = false }
        messages.append(Message(role: .ai, text: ""))
        let aiIndex = messages.count - 1
        try? await Task.sleep(for: .milliseconds(700))
        messages[aiIndex].text = text
    }

    // MARK: - 兜底内容

    private static func goldenSummary(for launch: ChatLaunch) -> String {
        switch launch.topic {
        case .career, nil:
            return "想赌一次更高薪、拥有更大影响力的可能 vs 舍不得放下多年深耕的积累，走进一个全新而未知的领域"
        case .family:
            return "不想放弃在大城市继续拼搏、证明自己能站稳脚跟的可能 vs 对父母的感恩与牵挂，让你越来越想回家陪伴他们"
        case .study:
            return "想用读研突破学历与职业发展的天花板 vs 害怕放下已经拥有的工作节奏，承担收入、时间和机会成本"
        case .love:
            return "想守住这段感情，把彼此带向真正共同的生活 vs 害怕为爱换城后失去自己的事业根基与生活主动权"
        }
    }

    private static func goldenReply(for launch: ChatLaunch) -> String {
        "我先试着说一个**暂时的理解**：你卡住的可能不只是「该选哪一个」，而是既想保护「真正重视的东西」，又不想放弃「现实里已经出现的信号」。\n\n我们把它收敛成一个更清楚的岔路口：\n\n**\(goldenSummary(for: launch))**。\n\n所以你需要的也许不是别人替你判断，而是把**真实意愿**和**害怕付出的代价**拆开来看。这个理解接近你吗？"
    }

    private static func confirmedReply(answers: [String]) -> String {
        let approaching = answers.first ?? "真正想要的生活"
        let protecting = answers.count > 1 ? answers[1] : "暂时不能失去的东西"
        return "现在的信息已经够了。我的判断是：你并不是没有答案，而是**想靠近「\(approaching)」的同时，也在保护「\(protecting)」**。\n\n真正需要验证的，不是哪条路绝对正确，而是哪一种代价是你愿意承担、也有能力承担的。"
    }
}
