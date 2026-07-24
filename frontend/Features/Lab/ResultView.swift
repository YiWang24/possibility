import SwiftUI

// MARK: - 推演结果（原型 resultPage）

struct ResultView: View {
    let data: SimResultData

    @Environment(\.dismiss) private var dismiss
    @State private var tab = 1   // 默认「一般情况」

    private struct TabSpec {
        let title: String
        let eyebrow: String
        let accent: UInt32
        let bg: [UInt32]
        let scenario: Simulation.Scenario
    }

    private var specs: [TabSpec] {
        [
            TabSpec(title: "最好的结果", eyebrow: "BEST · 顺光面", accent: 0xF06ACD,
                    bg: [0x2C1533, 0x1A1226], scenario: data.scenarios.optimistic),
            TabSpec(title: "一般情况", eyebrow: "LIKELY · 大概率", accent: 0x6FA5FF,
                    bg: [0x152048, 0x11142B], scenario: data.scenarios.general),
            TabSpec(title: "最坏的结果", eyebrow: "WORST · 背光面", accent: 0xFF8A5E,
                    bg: [0x33160E, 0x1C0F0C], scenario: data.scenarios.cautionary),
        ]
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    head
                    ScenarioPanel(eyebrow: specs[tab].eyebrow, accent: specs[tab].accent,
                                  bg: specs[tab].bg, scenario: specs[tab].scenario)
                        .padding(.top, 16).id(tab)
                    peopleSection.padding(.top, 8)
                    PrimaryButton(title: "重新选择", wide: true) { dismiss() }
                        .padding(.top, 24)
                    Color.clear.frame(height: 30)
                }
                .padding(.horizontal, 20).padding(.top, 8)
            }
            .scrollIndicators(.hidden)
        }
        .background(Theme.paper.ignoresSafeArea())
    }

    private var topBar: some View {
        HStack(spacing: 13) {
            BackButton { dismiss() }
            VStack(alignment: .leading, spacing: 2) {
                Text("推演结果").font(.system(size: 16, weight: .semibold)).tracking(0.8)
                Text("\(data.choice) · \(data.years) 年后").font(.system(size: 11)).foregroundStyle(Theme.faint)
            }
            Spacer()
        }
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 22).padding(.top, 12).padding(.bottom, 12)
        .background(.ultraThinMaterial)
    }

    private var head: some View {
        VStack(alignment: .leading, spacing: 16) {
            (Text("「") + Text(data.question).foregroundColor(Theme.ink).bold() + Text("」的三种可能 —— 先看一般情况，再看两端。"))
                .font(.system(size: 12)).foregroundStyle(Theme.sub).lineSpacing(4)
            segControl
        }
        .padding(.top, 4)
    }

    private var segControl: some View {
        HStack(spacing: 4) {
            ForEach(specs.indices, id: \.self) { i in
                Button {
                    withAnimation(.easeOut(duration: 0.25)) { tab = i }
                } label: {
                    Text(specs[i].title)
                        .font(.system(size: 13, weight: tab == i ? .semibold : .regular))
                        .foregroundStyle(tab == i ? .white : Theme.sub)
                        .frame(maxWidth: .infinity).padding(.vertical, 9)
                        .background(tab == i ? AnyShapeStyle(Theme.buttonGradient) : AnyShapeStyle(Color.clear), in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Theme.raised, in: Capsule())
    }

    private var peopleSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "类似经验的人", trailing: "左右滑动查看")
            TravelerSimRow(travelers: data.people)
                .padding(.horizontal, -20)
        }
        .padding(.top, 12)
    }
}

// MARK: - 单结局面板

private struct ScenarioPanel: View {
    let eyebrow: String
    let accent: UInt32
    let bg: [UInt32]
    let scenario: Simulation.Scenario

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            summary
            dimsCard
            twoLists
            if let key = scenario.keyCondition {
                keyBox(key)
            }
        }
        .transition(.opacity)
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(eyebrow).font(.system(size: 11)).tracking(2.5).foregroundStyle(Color(hex: accent))
            Text(scenario.headline).font(.system(size: 16, weight: .bold)).lineSpacing(6).foregroundStyle(Theme.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background {
            ZStack(alignment: .topTrailing) {
                LinearGradient(colors: bg.map { Color(hex: $0) }, startPoint: .topLeading, endPoint: .bottomTrailing)
                RadialGradient(colors: [Color(hex: accent, alpha: 0.4), .clear], center: .topTrailing, startRadius: 0, endRadius: 180)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Color(hex: accent, alpha: 0.35), lineWidth: 1))
    }

    private var dimsCard: some View {
        VStack(spacing: 0) {
            ForEach(Array(scenario.dimensions.enumerated()), id: \.offset) { idx, dim in
                HStack(alignment: .firstTextBaseline, spacing: 13) {
                    Text(dim.label).font(.system(size: 12)).foregroundStyle(Theme.faint).frame(width: 60, alignment: .leading)
                    Text(dim.text).font(.system(size: 13)).foregroundStyle(Theme.ink).lineSpacing(3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.vertical, 13)
                if idx < scenario.dimensions.count - 1 { Divider().overlay(Theme.line) }
            }
        }
        .padding(.horizontal, 20).padding(.vertical, 6)
        .kaleidoCard()
    }

    private var twoLists: some View {
        HStack(alignment: .top, spacing: 11) {
            listCard(title: "可能获得", dot: Theme.teal, items: scenario.gains)
            listCard(title: "需要留意", dot: Theme.pink, items: scenario.costs)
        }
    }

    private func listCard(title: String, dot: Color, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Circle().fill(dot).frame(width: 7, height: 7)
                Text(title).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.ink)
            }
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 8) {
                    Circle().fill(Theme.faint).frame(width: 4, height: 4).padding(.top, 6)
                    Text(item).font(.system(size: 11.5)).foregroundStyle(Theme.sub).lineSpacing(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .kaleidoCard(radius: 18)
    }

    private func keyBox(_ text: String) -> some View {
        (Text("最关键的条件：").foregroundColor(Theme.ink).bold() + Text(text).foregroundColor(Theme.sub))
            .font(.system(size: 12.5)).lineSpacing(4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 18).padding(.vertical, 15)
            .background(
                LinearGradient(colors: [Color(hex: 0x5E96FF, alpha: 0.12), Color(hex: 0xD7F464, alpha: 0.08)], startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 16, style: .continuous)
            )
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.45), style: StrokeStyle(lineWidth: 1, dash: [4, 4])))
    }
}

#Preview {
    ResultView(data: SimResultData(
        question: "我是否要从交互设计师转为产品经理？",
        choice: "转 AI 产品", years: 5,
        scenarios: LabModel.cannedScenarios(choice: "转 AI 产品", years: 5),
        people: DemoData.travelers.filter(\.isSimilar)
    ))
    .preferredColorScheme(.dark)
}
