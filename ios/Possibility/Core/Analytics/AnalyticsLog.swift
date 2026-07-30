import Foundation
import OSLog
import Sentry

// MARK: - 埋点日志

extension Logger {
    /// 埋点专用 logger。埋点的失败是**静默**的（绝不冒泡到 UI），
    /// 所以「为什么看板没数据」只能靠这里回答 —— 用 os.Logger 而非 print，
    /// 生产构建里可以用 Console.app 按 subsystem/category 过滤出来。
    static let analytics = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.johnnywang.possibility",
        category: "analytics"
    )

    static let network = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.johnnywang.possibility",
        category: "network"
    )
}

/// 前后端故障串联：请求正文与用户身份都不进日志，只记录函数、request_id 和错误类型。
enum AppObservability {
    static func recordRequestFailure(
        function: String,
        requestId: String,
        error: any Error
    ) {
        Logger.network.error(
            "Edge Function \(function, privacy: .public) 失败 request_id=\(requestId, privacy: .public) type=\(String(describing: type(of: error)), privacy: .public)"
        )
        let crumb = Breadcrumb(level: .error, category: "network")
        crumb.type = "http"
        crumb.message = "edge_function_failed"
        crumb.data = [
            "function": function,
            "request_id": requestId,
            "error_type": String(describing: type(of: error)),
        ]
        SentrySDK.addBreadcrumb(crumb)
    }
}
