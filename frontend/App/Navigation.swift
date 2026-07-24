import SwiftUI

// MARK: - 跨 Feature 导航载荷与复用件
//
// 导航策略：探索对话 / 推演结果 / 旅人主页均以 .fullScreenCover 呈现（技术设计文档 §8.5）。
// 旅人主页可从社区 / 对话 match / 推演结果 / 万花筒抽取四处进入 —— 用 TravelerProfileLink
// 就地封装 cover（谁触发谁呈现），避免跨层嵌套 cover 的呈现问题。

/// 探索对话启动参数（Home 发问 → ChatView）
struct ChatLaunch: Identifiable, Hashable {
    let id = UUID()
    let topic: ExploreTopic
    let question: String
}

/// 推演结果载荷（Lab 推演完成 → ResultView）
struct SimResultData: Identifiable {
    let id = UUID()
    let question: String
    let choice: String
    let years: Int
    let scenarios: Simulation.Scenarios
    /// 类似经验的人
    let people: [Traveler]
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
    }
}

/// 单张 sim 卡片（原型 .simcard）
struct SimCard: View {
    let traveler: Traveler
    var reason: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HueBandHeader(initial: traveler.initial, hue: traveler.hue,
                          bandHeight: 52, avatarSize: 36)
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
        .frame(width: 168, alignment: .leading)
        .kaleidoCard(radius: 18)
    }
}
