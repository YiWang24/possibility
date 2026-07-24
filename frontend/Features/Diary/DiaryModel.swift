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
    /// 「更新总结」假加载中
    var refreshing = false

    /// 今天是否已录音（由首页 HomeModel.analysis 推导传入）
    let hasRecordedToday: Bool

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

    /// 全部条目（今天已录则含 7/23）
    var entries: [DiaryNote] {
        hasRecordedToday ? DiaryData.entries + [DiaryData.todayEntry] : DiaryData.entries
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
