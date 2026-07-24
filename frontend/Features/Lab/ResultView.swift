import SwiftUI

// MARK: - 推演结果（原型 resultPage）

struct ResultView: View {
    let data: SimResultData
    /// /simulate 返回的底线卡守护分析；nil（服务端未返回/离线兜底）时不展示该区块
    var bottomLine: SimulationResult.BottomLineAnalysis? = nil

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
                    if tab == 2 && !data.carry.isEmpty {
                        FloorTestPanel(carryIds: data.carry).padding(.top, 14)
                    }
                    if let bottomLine {
                        BottomLinePanel(analysis: bottomLine).padding(.top, 14)
                    }
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

// MARK: - 底线压力测试（原型 .floor-test / renderFloorTest / answerFloor）

private struct FloorTestPanel: View {
    let carryIds: [String]
    @State private var answers: [String: Bool] = [:]   // id → 可承受(true) / 越线(false)

    private var cards: [LabModel.CarryCard] {
        carryIds.compactMap { LabModel.carryCard($0) }
    }
    private var allAnswered: Bool { answers.count == cards.count && !cards.isEmpty }
    private var rejected: [String] {
        cards.filter { answers[$0.id] == false }.map(\.name)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            Text("FLOOR TEST · 底线压力测试")
                .font(.system(size: 8.5, weight: .semibold)).tracking(2.2)
                .foregroundStyle(Color(hex: 0xFF9B77))
            Text("最坏的结果，会击穿你带进来的底线吗？")
                .font(.system(size: 15, weight: .bold)).lineSpacing(4).foregroundStyle(Theme.ink)
            Text("逐张确认：如果这个结局真的发生，这张底线卡还守得住吗？")
                .font(.system(size: 10.5)).lineSpacing(4).foregroundStyle(Theme.sub)

            ForEach(cards) { card in
                VStack(alignment: .leading, spacing: 9) {
                    HStack(spacing: 8) {
                        Text(card.glyph).font(.system(size: 13)).foregroundStyle(Color(hex: 0xFF9B77))
                        Text(card.name).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.ink)
                    }
                    Text(card.risk).font(.system(size: 11.5)).lineSpacing(5).foregroundStyle(Theme.sub)
                    HStack(spacing: 9) {
                        floorButton("最差如此，仍可承受", accept: true, card: card)
                        floorButton("这已经越过底线", accept: false, card: card)
                    }
                }
                .padding(13)
                .background(Theme.raised, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            if allAnswered { verdict }
        }
        .padding(17)
        .background(Color(hex: 0x11151D), in: RoundedRectangle(cornerRadius: 21, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 21, style: .continuous)
            .strokeBorder(Color(hex: 0xFF7A4D, alpha: 0.24), lineWidth: 1))
        .animation(.easeOut(duration: 0.3), value: allAnswered)
    }

    private func floorButton(_ title: String, accept: Bool, card: LabModel.CarryCard) -> some View {
        let on = answers[card.id] == accept
        let tint: Color = accept ? Theme.teal : Color(hex: 0xFF8A5E)
        return Button {
            answers[card.id] = accept
        } label: {
            Text(title)
                .font(.system(size: 10.5, weight: on ? .semibold : .regular))
                .foregroundStyle(on ? tint : Theme.sub)
                .frame(maxWidth: .infinity).padding(.vertical, 9)
                .background(on ? tint.opacity(0.12) : Color.white.opacity(0.05), in: Capsule())
                .overlay(Capsule().strokeBorder(on ? tint.opacity(0.55) : Theme.line, lineWidth: 1))
        }
        .buttonStyle(PressScaleStyle())
    }

    @ViewBuilder
    private var verdict: some View {
        let pass = rejected.isEmpty
        VStack(alignment: .leading, spacing: 7) {
            Text(pass ? "可以继续转变 · 但不是盲目乐观" : "暂时不要直接跨过去")
                .font(.system(size: 9, weight: .semibold)).tracking(1.6)
                .foregroundStyle(pass ? Theme.teal : Color(hex: 0xFF9B77))
            Text(pass
                 ? "你看见了最差结果，也确认它没有击穿带入的 \(cards.count) 张底线卡。"
                 : "最坏结果会击穿：\(rejected.joined(separator: "、"))")
                .font(.system(size: 13, weight: .bold)).lineSpacing(4).foregroundStyle(Theme.ink)
            Text(pass
                 ? "这说明这条路值得继续验证。下一步不是立刻跳下去，而是为这些底线分别保留现实缓冲。"
                 : "这不等于你不适合改变。先为这些底线建立保护条件，再回来重新测试。")
                .font(.system(size: 11.5)).lineSpacing(5).foregroundStyle(Theme.sub)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background((pass ? Theme.teal : Color(hex: 0xFF7A4D)).opacity(0.08),
                    in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
            .strokeBorder((pass ? Theme.teal : Color(hex: 0xFF7A4D)).opacity(0.3), lineWidth: 1))
        .transition(.opacity.combined(with: .move(edge: .top)))
    }
}

// MARK: - 底线分析（/simulate bottom_line_analysis · 与底线压力测试同一 deep-space 视觉）

private struct BottomLinePanel: View {
    let analysis: SimulationResult.BottomLineAnalysis

    private var accent: Color { analysis.isAcceptable ? Theme.teal : Color(hex: 0xFF9B77) }
    private var border: Color {
        analysis.isAcceptable ? Theme.teal.opacity(0.24) : Color(hex: 0xFF7A4D, alpha: 0.24)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            Text("BOTTOM LINE · 底线分析")
                .font(.system(size: 8.5, weight: .semibold)).tracking(2.2)
                .foregroundStyle(accent)
            Text(analysis.isAcceptable
                 ? "最坏的结果，仍在你的底线之内"
                 : "最坏的结果，可能击穿你的底线")
                .font(.system(size: 15, weight: .bold)).lineSpacing(4).foregroundStyle(Theme.ink)
            Text(analysis.isAcceptable
                 ? "结合你带走的底线卡与三种结局推演，这条路的最差情况大概率守得住。"
                 : "结合你带走的底线卡与三种结局推演，先为下面的风险建立保护条件，再考虑迈出这一步。")
                .font(.system(size: 10.5)).lineSpacing(4).foregroundStyle(Theme.sub)

            if !analysis.risks.isEmpty {
                bulletList(title: "需要警惕的风险", dot: Color(hex: 0xFF8A5E), items: analysis.risks)
            }
            if !analysis.protectiveConditions.isEmpty {
                bulletList(title: "保护条件", dot: Theme.teal, items: analysis.protectiveConditions)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(17)
        .background(Color(hex: 0x11151D), in: RoundedRectangle(cornerRadius: 21, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 21, style: .continuous)
            .strokeBorder(border, lineWidth: 1))
    }

    private func bulletList(title: String, dot: Color, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Circle().fill(dot).frame(width: 7, height: 7)
                Text(title).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.ink)
            }
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .top, spacing: 8) {
                    Circle().fill(Theme.faint).frame(width: 4, height: 4).padding(.top, 6)
                    Text(item).font(.system(size: 11.5)).lineSpacing(4).foregroundStyle(Theme.sub)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(13)
        .background(Theme.raised, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

#Preview {
    ResultView(data: SimResultData(
        question: "我是否要从交互设计师转为产品经理？",
        choice: "转 AI 产品", years: 5,
        scenarios: LabModel.cannedScenarios(choice: "转 AI 产品", years: 5),
        people: DemoData.travelers.filter(\.isSimilar),
        carry: ["income", "health"]
    ), bottomLine: SimulationResult.BottomLineAnalysis(
        isAcceptable: true,
        risks: ["转型初期收入下降，可能触及「稳定收入」底线", "高强度学习挤压恢复时间"],
        protectiveConditions: ["保留 6 个月生活备用金再行动", "每周固定两晚不安排学习"]
    ))
    .preferredColorScheme(.dark)
}
