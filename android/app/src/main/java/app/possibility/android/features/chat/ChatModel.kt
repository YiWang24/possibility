package app.possibility.android.features.chat

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import app.possibility.android.core.model.Crossroads
import app.possibility.android.core.model.ExploreTopic
import app.possibility.android.core.model.MatchQuery
import app.possibility.android.core.model.RemoteConversation
import app.possibility.android.core.model.Traveler
import app.possibility.android.core.network.ChatConclusion
import app.possibility.android.core.network.ChatRecommendedNextStep
import app.possibility.android.core.network.ChatRequest
import app.possibility.android.core.network.ChatStreamClient
import app.possibility.android.core.network.ChatStreamEvent
import app.possibility.android.core.network.SupabaseService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// 探索对话视图模型（付费漏斗主线，对应 ios/Possibility/Features/Chat/ChatModel.swift）。
//
// 首页发问 → 流式承接迷茫 / 澄清 → AI 给出「暂时的理解」→ 验证反馈
// （嗯，比较接近 / 还不太对，可循环纠正）→ 信息足够 → 下一步面板
// （去人生实验室 / 看走过这条路的人 / 分享 / 完整总结）。对照原型 chatState 阶段机。
//
// 所有问题（包括首页预置问题）都直接进入真实 /chat 流式接口。
// 岔路口成形后用 crossroads.match_query 调 /match。

/** 对话阶段（对照原型 chatState.stage） */
enum class ChatStage {
    CLARIFY,      // 澄清中
    REVIEW,       // AI 给出理解，等待用户验证
    CORRECTION,   // 用户说「还不太对」，等待改写
    READY,        // 信息足够，展示下一步面板
}

class ChatModel(
    /** 顶栏使用的话题（首页四条预置问题的中文标签），无话题自由提问为 null */
    topic: String?,
    /** 首页问题正文，作为第一条用户消息 */
    val question: String,
    private val service: SupabaseService,
    private val scope: CoroutineScope,
) {

    /** 单条消息；text 为可观察状态，流式 token 逐字追加时驱动重组。 */
    class Message(val role: Role, text: String) {
        val id: Long = nextId++
        var text: String by mutableStateOf(text)

        enum class Role { USER, AI }

        companion object {
            private var nextId = 0L
        }
    }

    /** 首页四条预置问题时命中的 ExploreTopic。 */
    private val topicEnum: ExploreTopic? = topic?.let { label ->
        ExploreTopic.entries.firstOrNull { it.label == label }
    }
    private val launchTopicLabel: String? = topic ?: topicEnum?.label

    val messages: SnapshotStateList<Message> = mutableStateListOf()
    var input: String by mutableStateOf("")
    var isStreaming: Boolean by mutableStateOf(false)
        private set

    var stage: ChatStage by mutableStateOf(ChatStage.CLARIFY)
        private set
    /** 验证 chips 是否可见（AI 理解后出现，点击即移除） */
    var showActionChips: Boolean by mutableStateOf(false)
        private set
    /** 经历过纠正循环 → chips 文案变为「这次准确了 / 我再补充一点」 */
    var hadCorrection: Boolean by mutableStateOf(false)
        private set
    /** 下一步面板（信息已经足够 · 选择下一步） */
    var showNextPanel: Boolean by mutableStateOf(false)
        private set
    /** AI 在收尾时选择的单一后续路径；旧服务端无该字段时保留兼容兜底。 */
    var recommendedNextStep: ChatRecommendedNextStep? by mutableStateOf(null)
        private set
    /** 完整总结页 */
    var showSummary: Boolean by mutableStateOf(false)
    /** 用户在澄清 / 纠正中的原话（结论、总结与分享文案插值） */
    val answers: SnapshotStateList<String> = mutableStateListOf()

    /** 服务端会话 ID：首轮 done 事件返回，后续追问带回以延续历史 */
    private var conversationId: String? = null
    /** 最近一次 done 事件（或历史恢复）携带的岔路口信号 */
    private var crossroads: Crossroads? = null

    // MARK: API 失败重试

    private enum class RequestContext { CLARIFY, CORRECTION_FOLLOW_UP, CONFIRM, REJECTION }

    private data class RetryRequest(val userText: String, val context: RequestContext)

    private var retryRequest: RetryRequest? by mutableStateOf(null)
    val canRetry: Boolean get() = retryRequest != null && !isStreaming

    // MARK: 岔路口 → /match（走过这条路的人）

    /** 匹配到的旅人（对话面板固定展示 2 位，已解析出完整信息） */
    var matchedTravelers: List<Traveler> by mutableStateOf(emptyList())
        private set
    /** traveler_id → 推荐理由（可解释） */
    var matchReasons: Map<Int, String> by mutableStateOf(emptyMap())
        private set
    /** 每个岔路口只请求一次；只展示服务端返回并能解析到真实旅人资料的结果。 */
    private var matchAttempted = false

    // MARK: 历史会话

    /** 近期会话（listConversations；失败为空 → 入口不显示） */
    var history: List<RemoteConversation> by mutableStateOf(emptyList())
        private set
    var showHistory: Boolean by mutableStateOf(false)
    /** 恢复历史会话后覆盖 launch 的话题 / 问题（顶栏与总结页展示用） */
    private var restoredTopic: String? = null
    private var restoredQuestion: String? = null

    val confirmLabel: String get() = if (hadCorrection) "这次准确了" else "嗯，比较接近"
    val correctLabel: String get() = if (hadCorrection) "我再补充一点" else "还不太对"

    // MARK: 验证 chips 发送给 API 的用户反馈

    /** 顶栏 / 总结页展示的话题（历史恢复后取会话自身的 topic） */
    val displayTopic: String? get() = restoredTopic ?: launchTopicLabel
    /** 总结页 / 分享文案的问题（历史恢复后取该会话首条用户消息） */
    val displayQuestion: String get() = restoredQuestion ?: question

    /** 历史入口条目（排除当前会话自身） */
    val historyEntries: List<RemoteConversation>
        get() = history.filter { it.id != conversationId }

    // MARK: 启动：把首页问题作为第一条用户消息并请求 AI

    fun start() {
        if (messages.isNotEmpty()) return
        messages.add(Message(Message.Role.USER, question))
        scope.launch { performAssistant(question, RequestContext.CLARIFY) }
    }

    // MARK: 继续追问

    fun send(text: String) {
        val clean = text.trim()
        if (clean.isEmpty() || isStreaming) return
        val previousStage = stage
        input = ""
        showActionChips = false
        // 用户直接输入就是在继续补充或修正；旧的确认按钮不应与新回复并存。
        if (previousStage == ChatStage.REVIEW || previousStage == ChatStage.READY) {
            stage = ChatStage.CLARIFY
            showNextPanel = false
            recommendedNextStep = null
        }
        // 任意新补充都可能改变匹配条件，不能沿用上一版理解预取的用户卡。
        resetMatch()
        messages.add(Message(Message.Role.USER, clean))
        answers.add(clean)

        scope.launch {
            if (previousStage == ChatStage.CORRECTION) {
                performAssistant(clean, RequestContext.CORRECTION_FOLLOW_UP)
            } else {
                performAssistant(clean, RequestContext.CLARIFY)
            }
        }
    }

    // MARK: 验证反馈（chips）—— 每一步都续接真实 API

    /** 「嗯，比较接近 / 这次准确了」→ API 基于完整历史生成分析与建议，成功后展示下一步。 */
    fun confirmInsight() {
        if (isStreaming) return
        showActionChips = false
        val userText = if (hadCorrection) CONFIRM_AFTER_CORRECTION_PHRASE else CONFIRM_PHRASE
        messages.add(Message(Message.Role.USER, userText))
        scope.launch { performAssistant(userText, RequestContext.CONFIRM) }
    }

    /** 「还不太对 / 我再补充一点」→ API 根据被否定的具体上下文生成下一句追问。 */
    fun requestCorrection() {
        if (isStreaming) return
        showActionChips = false
        resetMatch()
        messages.add(Message(Message.Role.USER, CORRECTION_PHRASE))
        stage = ChatStage.CORRECTION
        scope.launch { performAssistant(CORRECTION_PHRASE, RequestContext.REJECTION) }
    }

    /** 失败气泡下的“重新发送”：移除失败占位，原样重放请求，不重复用户消息。 */
    fun retry() {
        val request = retryRequest ?: return
        if (isStreaming) return
        retryRequest = null
        val last = messages.lastOrNull()
        if (last?.role == Message.Role.AI && last.text == API_FAILURE_MESSAGE) {
            messages.removeAt(messages.size - 1)
        }
        scope.launch { performAssistant(request.userText, request.context) }
    }

    // MARK: 岔路口 → /match

    private fun resetMatch() {
        matchedTravelers = emptyList()
        matchReasons = emptyMap()
        matchAttempted = false
    }

    /**
     * 信息足够后请求匹配，并始终为对话面板准备 2 位旅人。
     * 服务端岔路口缺失时（例如本地示例链路），用当前问题和用户补充生成保守条件。
     */
    fun requestMatch() {
        if (matchAttempted) return
        matchAttempted = true
        scope.launch {
            if (service.travelers.value.isEmpty()) service.loadTravelers()
            val query = effectiveMatchQuery()
            runCatching {
                val response = service.match(query)
                val travelers = mutableListOf<Traveler>()
                val reasons = mutableMapOf<Int, String>()
                for (m in response.matches) {
                    val t = service.travelers.value.firstOrNull { it.id == m.travelerId } ?: continue
                    if (travelers.any { it.id == t.id }) continue
                    travelers.add(t)
                    reasons[t.id] = m.reason
                    if (travelers.size == 2) break
                }
                matchedTravelers = travelers
                matchReasons = reasons
            }
        }
    }

    private fun effectiveMatchQuery(): MatchQuery {
        val c = crossroads
        if (c?.ready == true && c.matchQuery != null) return c.matchQuery!!
        val userContext = if (answers.isEmpty()) displayQuestion else answers.joinToString("；")
        return MatchQuery(
            lifeStage = null,
            constraints = if (answers.size > 1) answers.drop(1).take(2) else emptyList(),
            tension = "$displayQuestion；$userContext",
            decisionStage = "正在澄清选择与代价",
            supportNeed = "需要不同路径的真实经验与可验证的下一步",
        )
    }

    // MARK: 历史会话（listConversations + loadMessages）

    suspend fun loadHistory() {
        history = runCatching { service.listConversations(limit = 20, offset = 0).conversations }
            .getOrDefault(emptyList())   // 静默：入口不显示
    }

    /** 恢复一段历史会话：loadMessages 回填消息与 conversation_id，继续对话 */
    fun restore(convo: RemoteConversation) {
        if (isStreaming) return
        scope.launch {
            val remote = service.loadMessages(convo.id)
            if (remote.isEmpty()) return@launch   // 拉取失败静默，保持当前对话

            conversationId = convo.id
            restoredTopic = convo.topic
            restoredQuestion = remote.firstOrNull { it.role.name == "USER" }?.content
            crossroads = convo.crossroads
            messages.clear()
            remote.forEach {
                val role = if (it.role.name == "USER") Message.Role.USER else Message.Role.AI
                messages.add(Message(role, it.content))
            }
            // answers = 首条问题之后的用户原话；过滤 chips 固定验证短语，
            // 避免「嗯，这个理解比较接近我。」之类混入结论 / 分享文案插值
            answers.clear()
            remote.filter { it.role.name == "USER" }
                .map { it.content }
                .drop(1)
                .filter { it !in VERIFICATION_PHRASES }
                .forEach { answers.add(it) }
            hadCorrection = false
            showNextPanel = false
            recommendedNextStep = null
            showSummary = false
            matchedTravelers = emptyList()
            matchReasons = emptyMap()
            matchAttempted = false
            retryRequest = null

            if (shouldOfferVerification(convo.crossroads?.ready == true)) {
                // 历史会话也必须同时满足“结构已成形 + 最后一轮明确邀请确认”。
                stage = ChatStage.REVIEW
                showActionChips = true
                requestMatch()
            } else {
                stage = ChatStage.CLARIFY
                showActionChips = false
            }
            showHistory = false
        }
    }

    // MARK: 分享文案（原型 shareChatExploration 模板）

    val shareText: String
        get() {
            val a0 = answers.firstOrNull() ?: "真正想要的生活"
            val a1 = if (answers.size > 1) answers[1] else "暂时不能失去的东西"
            return "我刚在万花筒探索了一个问题：$displayQuestion\n\n我现在更清楚的是：我既想靠近$a0，也在保护$a1。"
        }

    // MARK: 流式请求 + 打字机

    private data class StreamResult(
        val delivered: Boolean,
        val ready: Boolean,
        val conclusion: ChatConclusion?,
    )

    /**
     * 统一执行 API 请求，并在成功后恢复原本所属的状态分支。
     * 失败只记录可重放请求，不再恢复一组可能与失败气泡冲突的旧按钮。
     */
    private suspend fun performAssistant(userText: String, context: RequestContext) {
        val result = streamAssistant(userText)
        if (!result.delivered) {
            retryRequest = RetryRequest(userText, context)
            showActionChips = false
            return
        }
        retryRequest = null

        if (result.conclusion?.ready == true && context != RequestContext.REJECTION) {
            stage = ChatStage.READY
            showActionChips = false
            showNextPanel = true
            recommendedNextStep = result.conclusion.nextStep
            if (recommendedNextStep == ChatRecommendedNextStep.MATCH) requestMatch()
            return
        }

        when (context) {
            RequestContext.CLARIFY -> {
                // 只有“结构已清晰 + 本轮明确邀请确认”才进入验证态。
                if (shouldOfferVerification(result.ready)) {
                    delay(850)
                    stage = ChatStage.REVIEW
                    showActionChips = true
                } else {
                    stage = ChatStage.CLARIFY
                    showActionChips = false
                }
            }
            RequestContext.CORRECTION_FOLLOW_UP -> {
                hadCorrection = true
                if (shouldOfferVerification(result.ready)) {
                    stage = ChatStage.REVIEW
                    showActionChips = true
                } else {
                    stage = ChatStage.CORRECTION
                    showActionChips = false
                }
            }
            RequestContext.CONFIRM -> {
                stage = ChatStage.READY
                showNextPanel = true
                recommendedNextStep = result.conclusion?.nextStep ?: ChatRecommendedNextStep.MATCH
                if (recommendedNextStep == ChatRecommendedNextStep.MATCH) requestMatch()
            }
            RequestContext.REJECTION -> {
                hadCorrection = true
                stage = ChatStage.CORRECTION
                showActionChips = false
            }
        }
    }

    /**
     * 服务端的 ready 表示问题结构已成形；回复文本中的确认邀请表示 AI 本轮确实已经把
     * 暂时理解交给用户验证。二者缺一都不展示按钮。
     */
    private fun shouldOfferVerification(resultReady: Boolean): Boolean {
        if (!resultReady) return false
        val reply = messages.lastOrNull { it.role == Message.Role.AI && it.text.isNotEmpty() }?.text
            ?: return false
        val verificationCues = listOf(
            "这个理解接近你吗",
            "这个理解准确吗",
            "这个理解对吗",
            "这样的理解接近你吗",
            "这份理解接近你吗",
            "你可以纠正我",
        )
        return verificationCues.any { reply.contains(it) }
    }

    /**
     * 通用续轮：把 userText 经 /chat 流式发送（带 conversation_id）。
     * delivered = 是否完整拿到真实回复（收到 done 事件）；ready = 本轮 done 是否标注岔路口成形。
     */
    private suspend fun streamAssistant(userText: String): StreamResult {
        isStreaming = true
        try {
            // 服务端按 conversation_id 自取库内历史；首轮没有 conversation_id 时携带端上历史。
            val history: List<ChatRequest.Turn> = if (conversationId != null) {
                emptyList()
            } else {
                messages.dropLast(1).map {
                    ChatRequest.Turn(
                        role = if (it.role == Message.Role.USER) "user" else "assistant",
                        content = it.text,
                    )
                }
            }
            val aiMessage = Message(Message.Role.AI, "")
            messages.add(aiMessage)

            val client = ChatStreamClient(tokenProvider = { service.jwt() })

            val request = ChatRequest(
                conversationId = conversationId,
                topic = displayTopic ?: "综合",
                message = userText,
                history = history,
            )

            var ready = false
            var receivedDone = false
            var conclusion: ChatConclusion? = null
            try {
                client.stream(request).collect { event ->
                    when (event) {
                        is ChatStreamEvent.Token -> aiMessage.text += event.text
                        is ChatStreamEvent.Done -> {
                            receivedDone = true
                            event.payload.conversationId?.let { conversationId = it }
                            event.payload.crossroads?.let { c ->
                                crossroads = c   // 后端每轮 done 都带 crossroads，持续刷新
                                if (c.ready) ready = true
                            }
                            conclusion = event.payload.conclusion
                        }
                    }
                }
            } catch (e: Exception) {
                aiMessage.text = API_FAILURE_MESSAGE
                return StreamResult(false, ready, conclusion)
            }
            if (aiMessage.text.isEmpty()) {
                aiMessage.text = API_FAILURE_MESSAGE
                return StreamResult(false, ready, conclusion)
            }
            if (!receivedDone) {
                // 流结束但没有 done 事件，视为 API 失败，不展示不完整的模型输出。
                aiMessage.text = API_FAILURE_MESSAGE
                return StreamResult(false, ready, conclusion)
            }
            if (ready || conclusion?.nextStep == ChatRecommendedNextStep.MATCH) {
                requestMatch()
            }
            return StreamResult(true, ready, conclusion)
        } finally {
            isStreaming = false
        }
    }

    companion object {
        private const val CONFIRM_PHRASE = "嗯，这个理解比较接近我。"
        private const val CONFIRM_AFTER_CORRECTION_PHRASE = "这次准确了。"
        private const val CORRECTION_PHRASE = "还不太对。"
        private val VERIFICATION_PHRASES: Set<String> = setOf(
            CONFIRM_PHRASE, CONFIRM_AFTER_CORRECTION_PHRASE, CORRECTION_PHRASE,
        )
        private const val API_FAILURE_MESSAGE = "我好像在接你的路上迷路了，请重试一下。"
    }
}
