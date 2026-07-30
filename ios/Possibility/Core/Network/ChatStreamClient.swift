import Foundation

// MARK: - 探索对话流式客户端（SSE）
//
// 不走 supabase-swift 的 functions.invoke（它会缓冲整段响应，打字机效果丢失），
// 而是用 URLSession.bytes(for:) 直连 Edge Function URL，逐行解析 SSE，
// 以 AsyncThrowingStream 把 token / 结束事件吐给 ChatModel。
// 对应技术设计文档 §8.3。

/// 一次流式事件：打字机 token，或结束事件（携带岔路口/画像信号）
enum ChatStreamEvent: Sendable {
    /// 增量文本片段
    case token(String)
    /// 结束事件：岔路口是否成形、画像信号
    case done(ChatStreamDone)
}

/// AI 判断本轮已可自然收尾时，只推荐一个不打断对话的后续入口。
enum ChatRecommendedNextStep: String, Codable, Sendable {
    case match
    case lab
}

struct ChatConclusion: Decodable, Sendable {
    var ready: Bool
    var nextStep: ChatRecommendedNextStep
    var reason: String

    enum CodingKeys: String, CodingKey {
        case ready, reason
        case nextStep = "next_step"
    }
}

/// SSE `event: done` 的载荷（对应 §6.1 二次结构化 + §7.3 岔路口成形判定）
struct ChatStreamDone: Decodable, Sendable {
    /// 本轮归属的会话；后续追问带回 `conversation_id`，服务端据此取历史
    var conversationId: UUID?
    /// 岔路口信号；`ready == true` 时前端解锁「看看走过这条路的人」
    var crossroads: Crossroads?
    /// 本轮抽取的画像信号（维度名 → 内容），供 Home 动态画像生长
    var profileSignals: [String: String]?
    /// 与 crossroads.ready 分离：只有 AI 判断下一轮已完成回答时才为 ready。
    var conclusion: ChatConclusion?

    enum CodingKeys: String, CodingKey {
        case crossroads, conclusion
        case conversationId = "conversation_id"
        case profileSignals = "profile_signals"
    }
}

/// POST /chat 请求体：一次迷茫 → 一个岔路口
struct ChatRequest: Encodable, Sendable {
    var conversationId: UUID?
    var topic: String
    var message: String
    /// 历史消息（前端带上，Edge Function 也可从库取）
    var history: [Turn]

    struct Turn: Encodable, Sendable {
        let role: String
        let content: String
    }

    enum CodingKeys: String, CodingKey {
        case topic, message, history
        case conversationId = "conversation_id"
    }
}

/// 直连 Edge Function 的 SSE 流式客户端。
///
/// 通过注入 `tokenProvider` 拿当前 JWT，避免与 `SupabaseService` 硬耦合（便于测试注入）。
struct ChatStreamClient: Sendable {

    /// 取当前用户 JWT（ChatModel 传入 `supabase.jwt`）
    let tokenProvider: @Sendable () async throws -> String
    /// App 侧可公开的 anon key（apikey 头）
    var apiKey: String = AppConfig.supabaseAnonKey
    /// 函数名（默认 chat），便于本地 functions serve 调试切换
    var functionName: String = "chat"
    var session: URLSession = .shared

    /// 发起一次流式对话。逐行解析 SSE：
    /// - `event:` 记录当前事件名（默认 message）
    /// - `data:` 累积 JSON；空行触发派发
    func stream(_ request: ChatRequest) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        let requestId = UUID().uuidString
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let urlRequest = try await makeRequest(request, requestId: requestId)
                    let (bytes, response) = try await session.bytes(for: urlRequest)
                    try Self.validate(response)

                    // SSE 解析：不依赖空行分隔。URLSession.AsyncBytes.lines 会把连续换行
                    // （\n\n）合并、不稳定吐出空行，导致原来「靠空行触发派发」的写法把每个
                    // token 的 data 行全累积起来、一条都发不出（实测 t=0 done=true）。
                    // 本后端每个事件是单行 JSON，故每见到一个 data 行即视为一次完整事件派发。
                    var event = "message"
                    for try await line in bytes.lines {
                        if let value = line.dropPrefix("event:") {
                            event = value.trimmingCharacters(in: .whitespaces)
                        } else if let value = line.dropPrefix("data:") {
                            try dispatch(
                                event: event,
                                data: value.trimmingCharacters(in: .whitespaces),
                                to: continuation
                            )
                            event = "message"
                        }
                        // 空行与以 `:` 开头的注释行忽略
                    }
                    continuation.finish()
                } catch {
                    if !Task.isCancelled {
                        let correlatedId = (error as? ChatStreamServerError)?.requestId ?? requestId
                        AppObservability.recordRequestFailure(
                            function: functionName,
                            requestId: correlatedId,
                            error: error
                        )
                    }
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    // MARK: - 私有

    private func makeRequest(_ body: ChatRequest, requestId: String) async throws -> URLRequest {
        var req = URLRequest(url: AppConfig.functionURL(functionName))
        req.httpMethod = "POST"
        req.timeoutInterval = 60
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        req.setValue(apiKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(try await tokenProvider())", forHTTPHeaderField: "Authorization")
        req.setValue(requestId, forHTTPHeaderField: "X-Request-ID")
        req.httpBody = try JSONEncoder().encode(body)
        return req
    }

    private static func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        guard (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    /// 把一段 SSE 事件解码后 yield 给流
    private func dispatch(
        event: String,
        data: String,
        to continuation: AsyncThrowingStream<ChatStreamEvent, Error>.Continuation
    ) throws {
        guard !data.isEmpty else { return }
        let payload = Data(data.utf8)

        if event == "done" {
            let done = (try? JSONDecoder().decode(ChatStreamDone.self, from: payload)) ?? ChatStreamDone()
            continuation.yield(.done(done))
            return
        }
        // 服务端流内失败（LLM 中断等）：event: error + {"error":{code,message}}。
        // 抛给调用方走统一错误路径，而不是静默吞掉让调用方误判为正常截断。
        if event == "error" {
            let err = try? JSONDecoder().decode(ServerErrorPayload.self, from: payload)
            throw ChatStreamServerError(
                code: err?.error?.code ?? "STREAM_ERROR",
                message: err?.error?.message ?? "回复中断，请稍后重试。",
                requestId: err?.requestId
            )
        }
        // 常规文本片段：{"t":"..."}
        if let token = try? JSONDecoder().decode(TokenChunk.self, from: payload), !token.t.isEmpty {
            continuation.yield(.token(token.t))
        }
    }

    private struct TokenChunk: Decodable { let t: String }

    private struct ServerErrorPayload: Decodable {
        struct Inner: Decodable {
            let code: String?
            let message: String?
        }
        let error: Inner?
        let requestId: String?

        enum CodingKeys: String, CodingKey {
            case error
            case requestId = "request_id"
        }
    }
}

/// 服务端 SSE `event: error` 对应的错误（携带后端 code/message）
struct ChatStreamServerError: LocalizedError, Sendable {
    let code: String
    let message: String
    let requestId: String?
    var errorDescription: String? { message }
}

// MARK: - SSE 行前缀工具

private extension String {
    /// 若以 `prefix` 开头，返回去掉前缀后的子串；否则 nil。
    func dropPrefix(_ prefix: String) -> String? {
        guard hasPrefix(prefix) else { return nil }
        return String(dropFirst(prefix.count))
    }
}
