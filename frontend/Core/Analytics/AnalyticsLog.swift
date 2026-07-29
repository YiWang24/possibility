import Foundation
import OSLog

// MARK: - 埋点日志

extension Logger {
    /// 埋点专用 logger。埋点的失败是**静默**的（绝不冒泡到 UI），
    /// 所以「为什么看板没数据」只能靠这里回答 —— 用 os.Logger 而非 print，
    /// 生产构建里可以用 Console.app 按 subsystem/category 过滤出来。
    static let analytics = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.johnnywang.possibility",
        category: "analytics"
    )
}
