import Foundation

// MARK: - Supabase created_at 统一解析 / 展示
//
// 服务端时间串形如 "2026-07-25T03:21:11.123456+00:00"（偶见空格分隔或无时区变体）。
// 此前四处各写一套解析（ChatView / HomeModel / DiaryModel / BountyDetailView），
// 且裸切 prefix(10) 会把 UTC 日期在东八区晚间显示成前一天 —— 统一收敛到这里：
// 解析成 Date 后一律按本地时区格式化展示。

enum SupabaseTimestamp {

    // MARK: 解析（formatter 静态缓存，避免每次调用重建）

    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let iso = ISO8601DateFormatter()

    /// 无时区后缀的兜底（按 UTC 解释，与服务端存储一致）
    private static let bareSeconds: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return f
    }()

    private static let bareMinutes: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm"
        return f
    }()

    /// created_at 字符串 → Date；不认识的格式返回 nil
    static func parse(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        let normalized = raw.replacingOccurrences(of: " ", with: "T")
        if let date = isoFractional.date(from: normalized) ?? iso.date(from: normalized) {
            return date
        }
        if normalized.count >= 19, let date = bareSeconds.date(from: String(normalized.prefix(19))) {
            return date
        }
        if normalized.count >= 16, let date = bareMinutes.date(from: String(normalized.prefix(16))) {
            return date
        }
        return nil
    }

    // MARK: 展示（本地时区）

    /// "yyyy-MM-dd"（本地时区，周历 key / 日记日期 / 悬赏日期通用）
    private static let dayOut: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "zh_CN")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// "M月d日 HH:mm"（历史会话列表）
    private static let timeOut: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "zh_CN")
        f.dateFormat = "M月d日 HH:mm"
        return f
    }()

    /// "M月d日 · 周x"（日记详情 label）
    private static let diaryLabelOut: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "zh_CN")
        f.dateFormat = "M月d日 · EEE"
        return f
    }()

    static func dayString(from date: Date) -> String {
        dayOut.string(from: date)
    }

    /// created_at → 本地时区 "yyyy-MM-dd"；解析失败返回 nil
    static func dayString(fromRaw raw: String?) -> String? {
        parse(raw).map(dayString(from:))
    }

    /// created_at → "M月d日 HH:mm"；解析失败返回 nil（调用方不显示）
    static func timeLabel(fromRaw raw: String?) -> String? {
        parse(raw).map { timeOut.string(from: $0) }
    }

    static func diaryLabel(from date: Date) -> String {
        diaryLabelOut.string(from: date)
    }
}
