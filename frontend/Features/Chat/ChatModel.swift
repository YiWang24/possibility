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

    // MARK: API 失败重试

    private enum RequestContext {
        case clarify
        case correctionFollowUp
        case confirm
        case rejection
    }

    private struct RetryRequest {
        let userText: String
        let context: RequestContext
    }

    private var retryRequest: RetryRequest?
    var canRetry: Bool { retryRequest != nil && !isStreaming }

    // MARK: 岔路口 → /match（走过这条路的人）

    /// 匹配到的旅人（对话面板固定展示 2 位，已解析出完整信息）
    private(set) var matchedTravelers: [Traveler] = []
    /// traveler_id → 推荐理由（可解释）
    private(set) var matchReasons: [Int: String] = [:]
    /// 每个岔路口只请求一次；请求期间或失败时保留本地兜底卡片
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

    // MARK: 验证 chips 发送给 API 的用户反馈
    //
    // confirmInsight / requestCorrection 以这些短句作为真实续轮；
    // restore 重建 answers 时按此集合过滤，避免污染结论 / 分享文案的插值。

    private static let confirmPhrase = "嗯，这个理解比较接近我。"
    private static let confirmAfterCorrectionPhrase = "这次准确了。"
    private static let correctionPhrase = "还不太对。"
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
            await performAssistant(userText: launch.question, context: .clarify, supabase: supabase)
        }
    }

    // MARK: 继续追问

    func send(_ text: String, supabase: SupabaseService) {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty, !isStreaming else { return }
        let previousStage = stage
        input = ""
        showActionChips = false
        // 用户直接输入就是在继续补充或修正；旧的确认按钮不应与新回复并存。
        if previousStage == .review || previousStage == .ready {
            stage = .clarify
            showNextPanel = false
            matchedTravelers = []
            matchReasons = [:]
            matchAttempted = false
        }
        messages.append(Message(role: .user, text: clean))
        answers.append(clean)

        if previousStage == .correction {
            // 纠正回合：用户已经输入新内容，始终续轮请求 /chat。
            Task {
                await performAssistant(userText: clean, context: .correctionFollowUp, supabase: supabase)
            }
        } else {
            Task { await performAssistant(userText: clean, context: .clarify, supabase: supabase) }
        }
    }

    // MARK: 验证反馈（chips）—— 每一步都续接真实 API

    /// 「嗯，比较接近 / 这次准确了」→ API 基于完整历史生成分析与建议
    /// → 成功后才展示人生实验室与相似经历。
    func confirmInsight(supabase: SupabaseService) {
        guard !isStreaming else { return }
        showActionChips = false
        let userText = hadCorrection ? Self.confirmAfterCorrectionPhrase : Self.confirmPhrase
        messages.append(Message(role: .user, text: userText))
        Task {
            await performAssistant(userText: userText, context: .confirm, supabase: supabase)
        }
    }

    /// 「还不太对 / 我再补充一点」→ API 根据被否定的具体上下文生成下一句追问。
    func requestCorrection(supabase: SupabaseService) {
        guard !isStreaming else { return }
        showActionChips = false
        messages.append(Message(role: .user, text: Self.correctionPhrase))
        stage = .correction
        Task {
            await performAssistant(userText: Self.correctionPhrase, context: .rejection, supabase: supabase)
        }
    }

    /// 失败气泡下的“重新发送”：移除失败占位，原样重放请求，不重复用户消息。
    func retry(supabase: SupabaseService) {
        guard let request = retryRequest, !isStreaming else { return }
        retryRequest = nil
        if messages.last?.role == .ai, messages.last?.text == Self.apiFailureMessage {
            messages.removeLast()
        }
        Task {
            await performAssistant(userText: request.userText,
                                   context: request.context,
                                   supabase: supabase)
        }
    }

    // MARK: 岔路口 → /match

    /// 信息足够后请求匹配，并始终为对话面板准备 2 位旅人。
    /// 服务端岔路口缺失时（例如本地示例链路），用当前问题和用户补充生成保守条件。
    func requestMatch(supabase: SupabaseService) {
        guard !matchAttempted else { return }
        matchAttempted = true
        Task {
            if supabase.travelers.isEmpty { await supabase.loadTravelers() }
            let pool = supabase.travelers.isEmpty ? DemoData.travelers : supabase.travelers
            applyMatchFallback(from: pool)

            let query = effectiveMatchQuery()
            do {
                let response = try await supabase.match(userState: query)
                var travelers: [Traveler] = []
                var reasons: [Int: String] = [:]
                for m in response.matches {
                    guard let t = supabase.travelers.first(where: { $0.id == m.travelerId }) else { continue }
                    guard !travelers.contains(where: { $0.id == t.id }) else { continue }
                    travelers.append(t)
                    reasons[t.id] = m.reason
                    if travelers.count == 2 { break }
                }
                // 服务端只解析出一位时，沿用已经按当前对话精准筛过的本地/模拟卡，
                // 不从素材池头部随便补一个无关人物。
                for traveler in matchedTravelers where travelers.count < 2 && !travelers.contains(where: { $0.id == traveler.id }) {
                    travelers.append(traveler)
                    if let reason = matchReasons[traveler.id] {
                        reasons[traveler.id] = reason
                    }
                }
                if travelers.count == 2 {
                    matchedTravelers = travelers
                    matchReasons = reasons
                }
            } catch {
                // 保留已经展示的两张兜底卡，不让网络失败打断主线。
            }
        }
    }

    private func effectiveMatchQuery() -> MatchQuery {
        if crossroads?.ready == true, let query = crossroads?.matchQuery {
            return query
        }
        let userContext = answers.isEmpty ? displayQuestion : answers.joined(separator: "；")
        return MatchQuery(
            lifeStage: nil,
            constraints: answers.count > 1 ? Array(answers.dropFirst().prefix(2)) : [],
            tension: "\(displayQuestion)；\(userContext)",
            decisionStage: "正在澄清选择与代价",
            supportNeed: "需要不同路径的真实经验与可验证的下一步"
        )
    }

    private func applyMatchFallback(from pool: [Traveler]) {
        let context = ([displayQuestion] + answers).joined(separator: "；")
        let localMatches = pool
            .map { ($0, localMatchScore($0, context: context)) }
            .filter { $0.1 > 0 }
            .sorted {
                if $0.1 == $1.1 { return $0.0.id < $1.0.id }
                return $0.1 > $1.1
            }
            .prefix(2)
            .map(\.0)

        var selected = Array(localMatches)
        while selected.count < 2 {
            selected.append(makeSyntheticTraveler(index: selected.count))
        }
        matchedTravelers = selected
        matchReasons = Dictionary(uniqueKeysWithValues: selected.map {
            ($0.id, fallbackReason(for: $0))
        })
    }

    /// 只把与当前原话存在明确语义交集的本地素材放上去；零分不硬凑。
    private func localMatchScore(_ traveler: Traveler, context: String) -> Int {
        let profile = ([traveler.bio, traveler.quote] + traveler.tags).joined(separator: " ")
        let semanticSignals: [([String], [String])] = [
            (["转行", "转型", "换赛道", "职业", "工作", "产品", "设计"], ["转型", "转行", "产品", "设计"]),
            (["读研", "考研", "读书", "留学", "本科", "学习"], ["本科", "硕士", "在读", "学习"]),
            (["裸辞", "休息", "间隔年", "gap", "倦怠"], ["裸辞", "gap", "休息", "环岛"]),
            (["独立开发", "创业", "自由职业", "副业", "做产品"], ["独立开发", "创业", "产品", "一个人"]),
            (["心理", "咨询", "倾听", "助人"], ["心理", "咨询", "倾听"]),
        ]
        var score = 0
        for (queryWords, profileWords) in semanticSignals
        where queryWords.contains(where: context.localizedCaseInsensitiveContains)
            && profileWords.contains(where: profile.localizedCaseInsensitiveContains) {
            score += 3
        }
        for tag in traveler.tags where tag.count >= 3 && context.localizedCaseInsensitiveContains(tag) {
            score += 2
        }
        return score
    }

    private func fallbackReason(for traveler: Traveler) -> String {
        if traveler.id < 0 {
            return traveler.quote
        }
        let clue = traveler.tags.first ?? traveler.bio
        return "本地经历中，TA 的「\(clue)」与你现在要验证的选择和代价最接近。"
    }

    /// 素材库覆盖不到当前处境时，用用户自己的两股拉力生成一张明确标注的模拟路径卡。
    /// 两张卡分别代表“先靠近”与“先守底线”，避免只给单一方向造成确认偏误。
    private func makeSyntheticTraveler(index: Int) -> Traveler {
        let approaching = answers.first ?? displayQuestion
        let protecting = answers.count > 1 ? answers[1] : "当前不能轻易失去的部分"
        let moveFirst = index.isMultiple(of: 2)
        let name = moveFirst ? "模拟路径 · 先试一步" : "模拟路径 · 先守底线"
        let quote = moveFirst
            ? "先用一次可撤回的小尝试验证「\(approaching)」，同时为「\(protecting)」设好停止条件。"
            : "先补足能保护「\(protecting)」的现实条件，再给「\(approaching)」设一个明确复盘日。"
        return Traveler(
            id: -9_101 - index,
            name: name,
            initial: moveFirst ? "试" : "守",
            hue: moveFirst ? 0 : 4,
            isSimilar: true,
            quote: quote,
            bio: "基于本轮回答生成的对照经历样本",
            tags: moveFirst ? ["可撤回尝试", "主动验证"] : ["先补缓冲", "定期复盘"],
            dims: [],
            trajectory: [
                TrajectoryNode(
                    age: "下一步",
                    title: moveFirst ? "做一次最小现实接触" : "先补齐关键保护条件",
                    detail: quote
                ),
            ]
        )
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
        retryRequest = nil

        if shouldOfferVerification(resultReady: convo.crossroads?.ready == true) {
            // 历史会话也必须同时满足“结构已成形 + 最后一轮明确邀请确认”。
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

    /// 统一执行 API 请求，并在成功后恢复原本所属的状态分支。
    /// 失败只记录可重放请求，不再恢复一组可能与失败气泡冲突的旧按钮。
    private func performAssistant(
        userText: String,
        context: RequestContext,
        supabase: SupabaseService
    ) async {
        let result = await streamAssistant(userText: userText, supabase: supabase)
        guard result.delivered else {
            retryRequest = RetryRequest(userText: userText, context: context)
            showActionChips = false
            return
        }
        retryRequest = nil

        switch context {
        case .clarify:
            // 只有“结构已清晰 + 本轮明确邀请确认”才进入验证态。
            if shouldOfferVerification(resultReady: result.ready) {
                try? await Task.sleep(for: .milliseconds(850))
                stage = .review
                showActionChips = true
            } else {
                stage = .clarify
                showActionChips = false
            }
        case .correctionFollowUp:
            hadCorrection = true
            if shouldOfferVerification(resultReady: result.ready) {
                stage = .review
                showActionChips = true
            } else {
                stage = .correction
                showActionChips = false
            }
        case .confirm:
            stage = .ready
            showNextPanel = true
            requestMatch(supabase: supabase)
        case .rejection:
            hadCorrection = true
            stage = .correction
            showActionChips = false
        }
    }

    /// 服务端的 ready 表示问题结构已成形；回复文本中的确认邀请表示
    /// AI 本轮确实已经把暂时理解交给用户验证。二者缺一都不展示按钮。
    private func shouldOfferVerification(resultReady: Bool) -> Bool {
        guard resultReady,
              let reply = messages.last(where: { $0.role == .ai && !$0.text.isEmpty })?.text
        else { return false }
        let verificationCues = [
            "这个理解接近你吗",
            "这个理解准确吗",
            "这个理解对吗",
            "这样的理解接近你吗",
            "这份理解接近你吗",
            "你可以纠正我",
        ]
        return verificationCues.contains(where: reply.contains)
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
            let continuationInstruction: String
            if userText == Self.confirmPhrase || userText == Self.confirmAfterCorrectionPhrase {
                continuationInstruction = """
                用户已经确认你的理解准确。不要继续索取信息，也不要复述“我看见了你的困惑”。请基于上述完整上下文，直接给出有依据但不说死的暂时分析、贴合这个用户的低成本建议；先完成回答，再自然承接人生实验室与相似经历。
                """
            } else if userText == Self.correctionPhrase {
                continuationInstruction = """
                用户明确认为刚才的理解不准确。请真正重新阅读上下文，不要使用固定道歉模板，也不要为原判断辩护；指出你需要修正的具体假设，并只追问一个最能降低不确定性的问题。
                """
            } else {
                continuationInstruction = """
                请承接这段上下文继续倾听。如果用户不认同初步理解，不要为原判断辩护，也不要立即换一组新的二者对立。先区分：是对两股拉力的具体理解不准确，还是用户的问题本身就不适合二元框架。如果不适合，停止使用 vs 结构，转而探索多重方向、信息缺口、行动阻力或尚未命名的感受。
                """
            }
            apiMessage = """
            此前的本地示例对话上下文：
            用户最初的问题：\(launch.question)
            助手给出的初步理解：\(Self.goldenReply(for: launch))

            用户现在的反馈或补充：\(userText)

            \(continuationInstruction)
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

}
