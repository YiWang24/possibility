import SwiftUI
import Observation

// MARK: - 跨 Feature 导航载荷与复用件
//
// 导航策略：探索对话 / 推演结果 / 旅人主页均以 .fullScreenCover 呈现（技术设计文档 §8.5）。
// 旅人主页可从社区 / 对话 match / 推演结果 / 万花筒抽取四处进入 —— 用 TravelerProfileLink
// 就地封装 cover（谁触发谁呈现），避免跨层嵌套 cover 的呈现问题。

/// 探索对话启动参数（Home 发问 → ChatView）；topic 为 nil = 无话题自由提问
struct ChatLaunch: Identifiable, Hashable {
    let id = UUID()
    let topic: ExploreTopic?
    let question: String
}

/// 语音日记详情页启动参数（Home 日记卡 → DiaryDetailView）；date 为 nil = 默认最近一天
struct DiaryLaunch: Identifiable, Hashable {
    let id = UUID()
    let date: String?
}

// MARK: - 跨 tab 路由（探索对话「去人生实验室 / 看相似经历」）

/// 根部注入的全局路由：切换底部 tab，并可携带待带入实验室的问题
@Observable
@MainActor
final class AppRouter {
    var tab: AppTab = .home
    /// 对话「去人生实验室」携带的问题，LabView 出现时消费
    var pendingLabQuestion: String?

    init() {
        // 调试便利：`simctl launch ... -possibility-tab lab|community|me` 直达指定 tab
        switch UserDefaults.standard.string(forKey: "possibility-tab") {
        case "lab": tab = .lab
        case "community": tab = .community
        case "me": tab = .me
        default: break
        }
    }
}

/// 推演结果载荷（Lab 推演完成 → ResultView）
struct SimResultData: Identifiable {
    let id = UUID()
    let question: String
    let choice: String
    let horizon: SimulationHorizon
    let scenarios: Simulation.Scenarios
    /// 类似经验的人
    let people: [Traveler]
    /// 一起带走的底线卡 id（原型 carry-deck，供最坏结果的底线压力测试）
    var carry: [String] = []
}

// MARK: - 旅人主页入口（就地 cover）

/// 包裹任意卡片，点击以 fullScreenCover 打开该旅人主页。
struct TravelerProfileLink<Label: View>: View {
    let travelerId: Int
    @ViewBuilder var label: Label

    @State private var open = false

    var body: some View {
        Button { open = true } label: { label }
            .buttonStyle(PressScaleStyle())
            .fullScreenCover(isPresented: $open) {
                ProfileView(travelerId: travelerId)
            }
    }
}

// MARK: - 类似经验的人 · 横滑卡片行（对话 match / 推演结果复用，原型 .simrow）

struct TravelerSimRow: View {
    let travelers: [Traveler]
    /// 可选：每位旅人的匹配理由（对话 match 场景展示）
    var reasons: [Int: String] = [:]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(travelers) { t in
                    TravelerProfileLink(travelerId: t.id) {
                        SimCard(traveler: t, reason: reasons[t.id])
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 4)
        }
        // 明确高度，防止横滑行在嵌套滚动视图中塌陷（卡片高度 + 上下各 4 的内边距）
        .frame(height: SimCard.cardHeight + 8)
    }
}

/// 单张 sim 卡片（原型 .simcard）
struct SimCard: View {
    /// 固定卡片高度：横滑行嵌套在外层竖向 ScrollView 中时，仅靠内容内在高度会在部分 iOS 版本塌陷为 0，
    /// 给卡片一个明确高度即可保证横滑行有可见高度（内容自然高度约 163，留出余量避免裁切）。
    static let cardHeight: CGFloat = 172

    let traveler: Traveler
    var reason: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HueBandHeader(initial: traveler.initial, hue: traveler.hue,
                          bandHeight: 52, avatarSize: 36,
                          imageName: MockAvatar.name(for: traveler.id))
            VStack(alignment: .leading, spacing: 5) {
                Text(traveler.name).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.ink)
                Text(reason ?? traveler.quote)
                    .font(.system(size: 11)).foregroundStyle(Theme.sub)
                    .lineLimit(2).lineSpacing(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if !traveler.tags.isEmpty {
                    HStack(spacing: 5) {
                        ForEach(traveler.tags.prefix(2), id: \.self) { TagPill(text: $0) }
                    }
                    .padding(.top, 3)
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 20).padding(.bottom, 14)
        }
        .frame(width: 168, height: SimCard.cardHeight, alignment: .topLeading)
        .kaleidoCard(radius: 18)
    }
}
