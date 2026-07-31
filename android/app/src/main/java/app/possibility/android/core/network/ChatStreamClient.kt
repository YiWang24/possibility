package app.possibility.android.core.network

import app.possibility.android.core.AppConfig
import app.possibility.android.core.model.AIContextDisclosure
import app.possibility.android.core.model.Crossroads
import app.possibility.android.core.model.LenientAIContextSerializer
import app.possibility.android.core.model.LenientCrossroadsSerializer
import io.ktor.client.HttpClient
import io.ktor.client.plugins.timeout
import io.ktor.client.request.header
import io.ktor.client.request.preparePost
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsChannel
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.utils.io.readUTF8Line
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.FlowCollector
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

// 探索对话流式客户端（SSE）。
// 对应 ios/Possibility/Core/Network/ChatStreamClient.swift（技术设计文档 §8.3）：
// 不走 functions.invoke（会缓冲整段响应，打字机效果丢失），
// 而是用 ktor prepareRequest + bodyAsChannel 直连 Edge Function URL，逐行解析 SSE。

/** 一次流式事件：打字机 token，或结束事件（携带岔路口/画像信号） */
sealed interface ChatStreamEvent {
    /** 增量文本片段 */
    data class Token(val text: String) : ChatStreamEvent

    /** 结束事件：岔路口是否成形、画像信号 */
    data class Done(val payload: ChatStreamDone) : ChatStreamEvent
}

/** AI 判断本轮已可自然收尾时，只推荐一个不打断对话的后续入口。 */
@Serializable
enum class ChatRecommendedNextStep {
    @SerialName("match") MATCH,
    @SerialName("lab") LAB,
}

@Serializable
data class ChatConclusion(
    val ready: Boolean,
    @SerialName("next_step") val nextStep: ChatRecommendedNextStep,
    val reason: String,
)

/** SSE `event: done` 的载荷（对应 §6.1 二次结构化 + §7.3 岔路口成形判定） */
@Serializable
data class ChatStreamDone(
    /** 本轮归属的会话；后续追问带回 `conversation_id`，服务端据此取历史 */
    @SerialName("conversation_id") val conversationId: String? = null,
    /** 岔路口信号；`ready == true` 时前端解锁「看看走过这条路的人」 */
    @Serializable(with = LenientCrossroadsSerializer::class)
    val crossroads: Crossroads? = null,
    /** 本轮抽取的画像信号（维度名 → 内容），供 Home 动态画像生长 */
    @SerialName("profile_signals") val profileSignals: Map<String, String>? = null,
    /** 与 crossroads.ready 分离：只有 AI 判断下一轮已完成回答时才为 ready。 */
    @Serializable(with = LenientChatConclusionSerializer::class)
    val conclusion: ChatConclusion? = null,
    /** 本轮实际使用的长期画像维度；不包含画像原文。 */
    @SerialName("ai_context")
    @Serializable(with = LenientAIContextSerializer::class)
    val aiContext: AIContextDisclosure? = null,
)

object LenientChatConclusionSerializer :
    app.possibility.android.core.model.LenientFieldSerializer<ChatConclusion>(ChatConclusion.serializer())

/** POST /chat 请求体：一次迷茫 → 一个岔路口 */
@Serializable
data class ChatRequest(
    @SerialName("conversation_id") val conversationId: String? = null,
    val topic: String,
    val message: String,
    /** 历史消息（前端带上，Edge Function 也可从库取） */
    val history: List<Turn> = emptyList(),
) {
    @Serializable
    data class Turn(val role: String, val content: String)
}

/** 服务端 SSE `event: error` 对应的错误（携带后端 code/message） */
class ChatStreamServerError(
    val code: String,
    override val message: String,
    val requestId: String?,
) : Exception(message)

/**
 * 直连 Edge Function 的 SSE 流式客户端。
 * 通过注入 `tokenProvider` 拿当前 JWT，避免与 [SupabaseService] 硬耦合（便于测试注入）。
 */
class ChatStreamClient(
    /** 取当前用户 JWT（ChatModel 传入 `SupabaseService.shared::jwt`） */
    private val tokenProvider: suspend () -> String,
    /** App 侧可公开的 anon key（apikey 头） */
    private val apiKey: String = AppConfig.supabaseAnonKey,
    /** 函数名（默认 chat），便于本地 functions serve 调试切换 */
    private val functionName: String = "chat",
    private val httpClient: HttpClient = SupabaseService.httpClient,
) {
    private val json = SupabaseService.json

    /**
     * 发起一次流式对话。逐行解析 SSE：
     * - `event:` 记录当前事件名（默认 message）
     * - 本后端每个事件是单行 JSON，每见到一个 `data:` 行即视为一次完整事件派发
     *   （不依赖空行分隔；空行与 `:` 开头的注释行忽略）
     */
    fun stream(request: ChatRequest): Flow<ChatStreamEvent> = flow {
        val requestId = UUID.randomUUID().toString()
        httpClient.preparePost(AppConfig.functionUrl(functionName)) {
            timeout {
                // 流式响应可能持续数分钟：整体不设上限，仅限制建立连接/单次读
                requestTimeoutMillis = Long.MAX_VALUE
                socketTimeoutMillis = 180_000
            }
            contentType(ContentType.Application.Json)
            header(HttpHeaders.Accept, "text/event-stream")
            header("apikey", apiKey)
            header(HttpHeaders.Authorization, "Bearer ${tokenProvider()}")
            header("X-Request-ID", requestId)
            setBody(json.encodeToString(request))
        }.execute { response ->
            if (!response.status.isSuccess()) {
                val body = runCatching { response.bodyAsText() }.getOrDefault("")
                throw ChatStreamServerError(
                    code = "HTTP_${response.status.value}",
                    message = "服务暂时不可用（HTTP ${response.status.value}）",
                    requestId = parseRequestId(body) ?: requestId,
                )
            }
            val channel = response.bodyAsChannel()
            var event = "message"
            while (true) {
                val line = channel.readUTF8Line() ?: break
                when {
                    line.startsWith("event:") -> event = line.removePrefix("event:").trim()
                    line.startsWith("data:") -> {
                        dispatch(event, line.removePrefix("data:").trim())
                        event = "message"
                    }
                    // 空行与以 `:` 开头的注释行忽略
                }
            }
        }
    }

    // MARK: - 私有

    private suspend fun FlowCollector<ChatStreamEvent>.dispatch(event: String, data: String) {
        if (data.isEmpty()) return
        when (event) {
            "done" -> {
                val done = runCatching { json.decodeFromString<ChatStreamDone>(data) }
                    .getOrDefault(ChatStreamDone())
                emit(ChatStreamEvent.Done(done))
            }
            // 服务端流内失败（LLM 中断等）：event: error + {"error":{code,message}}。
            // 抛给调用方走统一错误路径，而不是静默吞掉让调用方误判为正常截断。
            "error" -> {
                val err = runCatching { json.decodeFromString<ServerErrorPayload>(data) }.getOrNull()
                throw ChatStreamServerError(
                    code = err?.error?.code ?: "STREAM_ERROR",
                    message = err?.error?.message ?: "回复中断，请稍后重试。",
                    requestId = err?.requestId,
                )
            }
            // 常规文本片段：{"t":"..."}
            else -> {
                val token = runCatching { json.decodeFromString<TokenChunk>(data) }.getOrNull()
                if (token != null && token.t.isNotEmpty()) emit(ChatStreamEvent.Token(token.t))
            }
        }
    }

    private fun parseRequestId(body: String): String? =
        runCatching { json.decodeFromString<ServerErrorPayload>(body).requestId }.getOrNull()

    @Serializable
    private data class TokenChunk(val t: String = "")

    @Serializable
    private data class ServerErrorPayload(
        val error: Inner? = null,
        @SerialName("request_id") val requestId: String? = null,
    ) {
        @Serializable
        data class Inner(val code: String? = null, val message: String? = null)
    }
}
