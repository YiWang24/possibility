import SwiftUI

// MARK: - 月度 / 年度总结视图（原型 renderDiarySummary）

struct DiarySummaryView: View {
    @Bindable var model: DiaryModel
    let isMonth: Bool
    @Environment(ToastCenter.self) private var toast

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            DiaryViewHead(
                eyebrow: isMonth ? "MONTHLY REVIEW" : "YEARLY REVIEW",
                title: isMonth ? "2026年7月" : "2026年度",
                subtitle: isMonth ? "\(model.entries.count)篇日记已纳入总结" : "143篇日记已纳入总结",
                trailing: { AnyView(refreshButton) }
            )

            if isMonth { monthContent } else { yearContent }
        }
    }

    // MARK: 更新总结（850ms 假加载）

    private var refreshButton: some View {
        Button {
            guard !model.refreshing else { return }
            model.refreshing = true
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(850))
                model.refreshing = false
                toast.show(isMonth ? "月度总结已根据最新日记更新" : "年度总结已根据最新日记更新")
            }
        } label: {
            Text(model.refreshing ? "总结中…" : "更新总结")
                .font(.system(size: 10.5)).foregroundStyle(Color(hex: 0xBBD0FF))
                .padding(.horizontal, 11).padding(.vertical, 8)
                .background(Color(hex: 0x5E96FF, alpha: 0.1), in: Capsule())
                .overlay(Capsule().strokeBorder(Color(hex: 0x5E96FF, alpha: 0.2), lineWidth: 1))
        }
        .buttonStyle(PressScaleStyle())
        .opacity(model.refreshing ? 0.55 : 1)
    }

    // MARK: 月度

    private var monthContent: some View {
        VStack(alignment: .leading, spacing: 14) {
            summaryHero(cap: DiaryData.MonthSummary.cap,
                        headline: DiaryData.MonthSummary.headline,
                        body: DiaryData.MonthSummary.body,
                        stats: DiaryData.MonthSummary.stats)
                .padding(.top, 15)

            summaryCard {
                DiaryBlockHead(title: "本月情绪流动", note: "前紧后松")
                emotionChart.padding(.top, 15)
            }

            summaryCard {
                DiaryBlockHead(title: "反复出现的主题", note: "跨 \(model.entries.count) 篇日记")
                DiaryKeywordFlow(items: DiaryData.MonthSummary.themes).padding(.top, 12)
                VStack(spacing: 10) {
                    ForEach(DiaryData.MonthSummary.insights, id: \.self) { insightCard($0) }
                }
                .padding(.top, 13)
            }
        }
    }

    private var emotionChart: some View {
        HStack(alignment: .bottom, spacing: 8) {
            ForEach(DiaryData.MonthSummary.emotionBars, id: \.self) { bar in
                VStack(spacing: 6) {
                    UnevenRoundedRectangle(topLeadingRadius: 7, bottomLeadingRadius: 3,
                                           bottomTrailingRadius: 3, topTrailingRadius: 7)
                        .fill(LinearGradient(colors: [Color(hex: 0x8F7BFF), Color(hex: 0x3E77F2)],
                                             startPoint: .top, endPoint: .bottom))
                        .opacity(0.75)
                        .frame(height: max(10, 104 * bar.value))
                        .frame(maxHeight: .infinity, alignment: .bottom)
                    Text(bar.label).font(.system(size: 8.5)).foregroundStyle(Theme.faint)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .frame(height: 122)
        .padding(.horizontal, 3)
    }

    // MARK: 年度

    private var yearContent: some View {
        VStack(alignment: .leading, spacing: 14) {
            summaryHero(cap: DiaryData.YearSummary.cap,
                        headline: DiaryData.YearSummary.headline,
                        body: DiaryData.YearSummary.body,
                        stats: DiaryData.YearSummary.stats)
                .padding(.top, 15)

            summaryCard {
                DiaryBlockHead(title: "年度关键词", note: "按出现与情绪权重排序")
                DiaryKeywordFlow(items: DiaryData.YearSummary.keywords).padding(.top, 12)
            }

            summaryCard {
                DiaryBlockHead(title: "这一年的四个章节", note: "持续生成中")
                yearLine.padding(.top, 14)
            }

            summaryCard {
                DiaryBlockHead(title: "写给年底的你", note: "AI 年度回望")
                insightCard(DiaryData.YearSummary.letter).padding(.top, 13)
            }
        }
    }

    /// 年度时间轴（.diary-year-line：左竖线 + 发光节点）
    private var yearLine: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(DiaryData.YearSummary.nodes.enumerated()), id: \.element) { i, node in
                HStack(alignment: .top, spacing: 12) {
                    Circle()
                        .fill(Color(hex: 0x8F7BFF))
                        .frame(width: 8, height: 8)
                        .shadow(color: Color(hex: 0x8F7BFF, alpha: 0.6), radius: 5)
                        .padding(.top, 5)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(node.period).font(.system(size: 9.5)).foregroundStyle(Color(hex: 0x9DBCFF))
                        Text(node.title).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Theme.ink)
                        Text(node.body).font(.system(size: 10.5)).lineSpacing(4).foregroundStyle(Theme.sub)
                            .padding(.top, 1)
                    }
                    .padding(.bottom, i == DiaryData.YearSummary.nodes.count - 1 ? 2 : 16)
                }
            }
        }
        .background(alignment: .topLeading) {
            Rectangle().fill(Color(hex: 0x8F7BFF, alpha: 0.35))
                .frame(width: 1)
                .padding(.leading, 3.5)
                .padding(.vertical, 6)
        }
    }

    // MARK: 共用件

    private func summaryHero(cap: String, headline: String, body: String, stats: [DiaryData.Stat]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(cap).font(.system(size: 9.5)).tracking(2.4).foregroundStyle(Color(hex: 0xC4B9FF))
            Text(headline)
                .font(.system(size: 20, weight: .bold)).lineSpacing(8).foregroundStyle(Theme.ink)
                .padding(.top, 8)
            Text(body)
                .font(.system(size: 11.5)).lineSpacing(7).foregroundStyle(Color(hex: 0xBCC4D4))
                .padding(.top, 9)
            HStack(spacing: 7) {
                ForEach(stats, id: \.self) { stat in
                    VStack(spacing: 4) {
                        Text(stat.value).font(.system(size: 17, weight: .bold)).foregroundStyle(Theme.ink)
                        Text(stat.label).font(.system(size: 9)).foregroundStyle(Theme.faint)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous)
                        .strokeBorder(.white.opacity(0.06), lineWidth: 1))
                }
            }
            .padding(.top, 14)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(21)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0x1A1830), Color(hex: 0x111522)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                RadialGradient(colors: [Color(hex: 0xE35CC1, alpha: 0.24), .clear],
                               center: .topTrailing, startRadius: 0, endRadius: 220)
                RadialGradient(colors: [Color(hex: 0x5E96FF, alpha: 0.22), .clear],
                               center: .bottomLeading, startRadius: 0, endRadius: 190)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous)
            .strokeBorder(Color(hex: 0x9A8BEA, alpha: 0.3), lineWidth: 1))
    }

    private func summaryCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0, content: content)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(17)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }

    private func insightCard(_ insight: DiaryData.Insight) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            if let cap = insight.cap {
                Text(cap).font(.system(size: 9)).tracking(1.2).foregroundStyle(Color(hex: 0x9DBCFF))
            }
            Text(insight.title).font(.system(size: 13, weight: .semibold)).lineSpacing(5).foregroundStyle(Theme.ink)
            Text(insight.body).font(.system(size: 11)).lineSpacing(6).foregroundStyle(Theme.sub)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
            .strokeBorder(.white.opacity(0.06), lineWidth: 1))
    }
}
