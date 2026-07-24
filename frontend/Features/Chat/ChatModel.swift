import Foundation
import Observation

// MARK: - 探索对话视图模型（付费漏斗主线，技术设计文档 §9.1）
//
// 首页发问 → 流式承接迷茫 / 澄清 → AI 给出「暂时的理解」→ 验证反馈
// （嗯，比较接近 / 还不太对，可循环纠正）→ 信息足够 → 下一步面板
// （去人生实验室 / 看相似经历 / 分享 / 完整总结）。对照原型 chatState 阶段机。
// 现场网络 / LLM 抖动时回退「黄金对话」（§13）。

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

    init(launch: ChatLaunch) {
        self.launch = launch
    }

    var confirmLabel: String { hadCorrection ? "这次准确了" : "嗯，比较接近" }
    var correctLabel: String { hadCorrection ? "我再补充一点" : "还不太对" }

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
            // 纠正回合：本地复述用户原话（对照原型 sendChat correction 分支），不走流式
            Task {
                await localAssistant("明白了。更准确的说法应该是：**\(clean)**\n\n我会保留你的原话，不再把它改写成一个性格结论。", delay: 0.7)
                try? await Task.sleep(for: .milliseconds(760))
                hadCorrection = true
                stage = .review
                showActionChips = true
            }
        } else {
            Task { await runAssistant(userText: clean, supabase: supabase) }
        }
    }

    // MARK: 验证反馈（chips）

    /// 「嗯，比较接近 / 这次准确了」→ AI 结论 → 下一步面板
    func confirmInsight() {
        showActionChips = false
        messages.append(Message(role: .user, text: "嗯，这个理解比较接近我。"))
        let a0 = answers.first ?? "真正想要的生活"
        let a1 = answers.count > 1 ? answers[1] : "暂时不能失去的东西"
        Task {
            await localAssistant("现在的信息已经够了。我的判断是：你并不是没有答案，而是**想靠近「\(a0)」的同时，也在保护「\(a1)」**。\n\n真正需要验证的，不是哪条路绝对正确，而是哪一种代价是你愿意承担、也有能力承担的。", delay: 0.7)
            try? await Task.sleep(for: .milliseconds(820))
            stage = .ready
            showNextPanel = true
        }
    }

    /// 「还不太对 / 我再补充一点」→ AI 追问最不准确的部分
    func requestCorrection() {
        showActionChips = false
        messages.append(Message(role: .user, text: "还不太对。"))
        stage = .correction
        Task {
            await localAssistant("谢谢你纠正我。**最不准确的是哪一部分？**你可以直接改写成你自己的话，我会以你的表达为准。", delay: 0.7)
        }
    }

    // MARK: 分享文案（原型 shareChatExploration 模板）

    var shareText: String {
        let a0 = answers.first ?? "真正想要的生活"
        let a1 = answers.count > 1 ? answers[1] : "暂时不能失去的东西"
        return "我刚在万花筒探索了一个问题：\(launch.question)\n\n我现在更清楚的是：我既想靠近\(a0)，也在保护\(a1)。"
    }

    // MARK: 本地 AI 消息（带思考延迟，对照原型 assistantAfter）

    private func localAssistant(_ text: String, delay: Double) async {
        isStreaming = true
        messages.append(Message(role: .ai, text: ""))
        let index = messages.count - 1
        try? await Task.sleep(for: .seconds(delay))
        messages[index].text = text
        isStreaming = false
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
        let request = ChatRequest(conversationId: conversationId, topic: launch.topic?.rawValue ?? "综合",
                                  message: userText, history: Array(history))

        var reachedInsight = false
        do {
            for try await event in client.stream(request) {
                switch event {
                case .token(let t):
                    messages[aiIndex].text += t
                case .done(let done):
                    if let id = done.conversationId { conversationId = id }
                    if let c = done.crossroads, c.ready { reachedInsight = true }
                }
            }
        } catch {
            // 断网兜底：黄金对话（直接给出「暂时的理解」）
            if messages[aiIndex].text.isEmpty {
                messages[aiIndex].text = Self.goldenReply(for: launch)
            }
            reachedInsight = true
        }

        // AI 已给出足够的理解（服务端标注岔路口 / 已有两轮澄清）→ 出验证 chips
        let aiCount = messages.filter { $0.role == .ai && !$0.text.isEmpty }.count
        if stage == .clarify, reachedInsight || aiCount >= 2 {
            try? await Task.sleep(for: .milliseconds(850))
            stage = .review
            showActionChips = true
        }
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
