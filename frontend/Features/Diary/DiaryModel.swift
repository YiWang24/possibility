import Foundation
import Observation

// MARK: - 语音日记详情页视图模型
//
// 对照原型 diaryPage：day/month/year 三视图切换 + 选中日期；音频播放为纯 UI 演示。

@Observable
@MainActor
final class DiaryModel {

    enum ViewKind: String, CaseIterable {
        case day, month, year
        var label: String {
            switch self {
            case .day: "每日记录"
            case .month: "月度总结"
            case .year: "年度总结"
            }
        }
    }

    var view: ViewKind = .day
    var selectedDate: String
    var isPlaying = false
    /// 「更新总结」加载中（真实重新拉取 diary-summary）
    var refreshing = false

    /// 今天是否已录音（由首页 HomeModel.analysis 推导传入）
    let hasRecordedToday: Bool

    /// 云端真实日记（list-diary，按日期覆盖 demo 底座）
    private var remoteNotes: [DiaryNote] = []

    /// 云端月/年总结（diary-summary）；nil = 未加载 / 失败（视图回退硬编码 demo）
    private(set) var monthSummary: DiarySummaryResponse?
    private(set) var yearSummary: DiarySummaryResponse?

    init(launch: DiaryLaunch, hasRecordedToday: Bool) {
        self.hasRecordedToday = hasRecordedToday
        // 对照原型 openVoiceDiary：指定日期 > 今天已录 > 最近一篇
        if let date = launch.date {
            selectedDate = date
        } else if hasRecordedToday {
            selectedDate = "2026-07-23"
        } else {
            selectedDate = DiaryData.entries.last?.date ?? "2026-07-23"
        }
    }

    /// 拉取云端真实条目（analyze-diary 落库的记录），失败静默保持 demo 底座
    func loadRemote(using supabase: SupabaseService) async {
        guard let rows = try? await supabase.listDiary() else { return }
        remoteNotes = rows.compactMap(Self.note(from:))
    }

    // MARK: 月/年总结（diary-summary 真实聚合，失败回退硬编码 demo）

    /// 当前月 ref："2026-07"（服务端按 UTC 边界聚合，ref 必须用 UTC 计算，避免时区错位）
    static var currentMonthRef: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "zh_CN")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM"
        return f.string(from: Date())
    }

    /// 当前年 ref："2026"（同上，按服务端 UTC 边界取年份）
    static var currentYearRef: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "zh_CN")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy"
        return f.string(from: Date())
    }

    /// 并发拉取月 + 年总结（冷启动调用；任一失败静默保留兜底）
    func loadSummaries(using supabase: SupabaseService) async {
        async let month = try? supabase.diarySummary(period: "month", ref: Self.currentMonthRef)
        async let year = try? supabase.diarySummary(period: "year", ref: Self.currentYearRef)
        if let m = await month { monthSummary = m }
        if let y = await year { yearSummary = y }
    }

    /// 「更新总结」：重新拉取对应周期；返回是否成功（供 toast 提示）
    func refreshSummary(isMonth: Bool, using supabase: SupabaseService) async -> Bool {
        guard !refreshing else { return false }
        refreshing = true
        defer { refreshing = false }
        if isMonth {
            guard let m = try? await supabase.diarySummary(period: "month", ref: Self.currentMonthRef) else { return false }
            monthSummary = m
        } else {
            guard let y = try? await supabase.diarySummary(period: "year", ref: Self.currentYearRef) else { return false }
            yearSummary = y
        }
        return true
    }

    /// 远端行 → DiaryNote（真实表无标题 / emoji / 时长等富字段，做合理降级）
    private static func note(from row: SupabaseService.RemoteDiaryEntry) -> DiaryNote? {
        guard let transcript = row.transcript, !transcript.isEmpty else { return nil }
        // created_at（ISO8601）→ "yyyy-MM-dd" 与 "M月d日 · 周x"
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = iso.date(from: row.createdAt)
            ?? ISO8601DateFormatter().date(from: row.createdAt)
            ?? Date()
        let day = DateFormatter()
        day.locale = Locale(identifier: "zh_CN")
        day.dateFormat = "yyyy-MM-dd"
        let label = DateFormatter()
        label.locale = Locale(identifier: "zh_CN")
        label.dateFormat = "M月d日 · EEE"
        // 标题 = 转写首句截断
        let firstSentence = transcript
            .components(separatedBy: CharacterSet(charactersIn: "。！？!?\n"))
            .first { !$0.isEmpty } ?? transcript
        let emotions = row.emotions ?? []
        return DiaryNote(
            date: day.string(from: date),
            label: label.string(from: date),
            emoji: Self.emoji(for: emotions.first),
            emotion: emotions.isEmpty ? "已记录" : emotions.joined(separator: "，"),
            duration: "--:--",
            title: String(firstSentence.prefix(24)),
            keywords: row.keywords ?? [],
            transcript: transcript
                .components(separatedBy: "\n")
                .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        )
    }

    private static func emoji(for emotion: String?) -> String {
        guard let emotion else { return "🎙" }
        if emotion.contains("焦虑") || emotion.contains("担") { return "😮‍💨" }
        if emotion.contains("平静") || emotion.contains("踏实") { return "😌" }
        if emotion.contains("开心") || emotion.contains("成就") || emotion.contains("被") { return "😊" }
        if emotion.contains("纠结") || emotion.contains("犹豫") { return "😕" }
        return "🙂"
    }

    /// 全部条目：demo 底座 + 今天刚录（7/23）+ 云端真实条目按日期覆盖 / 插入
    var entries: [DiaryNote] {
        var base = hasRecordedToday ? DiaryData.entries + [DiaryData.todayEntry] : DiaryData.entries
        for note in remoteNotes {
            if let i = base.firstIndex(where: { $0.date == note.date }) {
                base[i] = note
            } else {
                base.append(note)
            }
        }
        return base.sorted { $0.date < $1.date }
    }

    var selectedEntry: DiaryNote? {
        entries.first { $0.date == selectedDate }
    }

    /// 选中条目在列表中的序号（波形 seed）
    var selectedIndex: Int {
        max(0, entries.firstIndex { $0.date == selectedDate } ?? 0)
    }

    /// 日期轨：全部条目日期 + 今天（若无 7/23 条目则补空位）
    var railDates: [(date: String, day: Int, week: String, emoji: String?)] {
        var rail = entries.map { ($0.date, $0.dayNumber, $0.weekday, Optional($0.emoji)) }
        if !rail.contains(where: { $0.0 == "2026-07-23" }) {
            rail.append(("2026-07-23", 23, "今天", nil))
        }
        return rail.sorted { $0.0 < $1.0 }
    }

    func select(_ date: String) {
        selectedDate = date
        isPlaying = false
    }
}
