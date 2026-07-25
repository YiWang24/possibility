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

/// SSE `event: done` 的载荷（对应 §6.1 二次结构化 + §7.3 岔路口成形判定）
struct ChatStreamDone: Decodable, Sendable {
    /// 本轮归属的会话；后续追问带回 `conversation_id`，服务端据此取历史
    var conversationId: UUID?
    /// 岔路口信号；`ready == true` 时前端解锁「看看走过这条路的人」
    var crossroads: Crossroads?
    /// 本轮抽取的画像信号（维度名 → 内容），供 Home 动态画像生长
    var profileSignals: [String: String]?

    enum CodingKeys: String, CodingKey {
        case crossroads
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
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let urlRequest = try await makeRequest(request)
                    let (bytes, response) = try await session.bytes(for: urlRequest)
                    try Self.validate(response)

                    var event = "message"
                    var dataBuffer = ""

                    for try await line in bytes.lines {
                        if line.isEmpty {
                            try dispatch(event: event, data: dataBuffer, to: continuation)
                            event = "message"
                            dataBuffer = ""
                        } else if let value = line.dropPrefix("event:") {
                            event = value.trimmingCharacters(in: .whitespaces)
                        } else if let value = line.dropPrefix("data:") {
                            dataBuffer += value.trimmingCharacters(in: .whitespaces)
                        }
                        // 以 `:` 开头的注释行与未知字段忽略
                    }
                    // 流结束前最后一段未被空行终结的缓冲
                    try dispatch(event: event, data: dataBuffer, to: continuation)
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    // MARK: - 私有

    private func makeRequest(_ body: ChatRequest) async throws -> URLRequest {
        var req = URLRequest(url: AppConfig.functionURL(functionName))
        req.httpMethod = "POST"
        req.timeoutInterval = 60
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        req.setValue(apiKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(try await tokenProvider())", forHTTPHeaderField: "Authorization")
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
                message: err?.error?.message ?? "回复中断，请稍后重试。"
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
    }
}

/// 服务端 SSE `event: error` 对应的错误（携带后端 code/message）
struct ChatStreamServerError: LocalizedError, Sendable {
    let code: String
    let message: String
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
