import Foundation

// MARK: - 异步操作超时 helper
//
// 「真实调用优先 + 超时静默兜底」的统一实现：op 与计时器并发赛跑，
// 先完成者胜出，随后取消另一方（超时即取消底层网络任务）。
// 失败 / 超时均返回 nil，由调用方走本地兜底（技术设计文档 §13）。

/// 在 `seconds` 内等待 `op` 完成；超时或抛错返回 nil，并取消底层任务。
func withTimeout<T: Sendable>(
    seconds: Double,
    _ op: @escaping @Sendable () async throws -> T
) async -> T? {
    await withTaskGroup(of: T?.self) { group -> T? in
        group.addTask { try? await op() }
        group.addTask {
            try? await Task.sleep(for: .seconds(seconds))
            return nil
        }
        let first = await group.next() ?? nil
        group.cancelAll()
        return first
    }
}
