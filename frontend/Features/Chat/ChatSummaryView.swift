import SwiftUI

// MARK: - 下一步面板（原型 .chat-next-panel）
//
// 「信息已经足够 · 选择下一步」：去人生实验室（primary 跨两列）/ 看相似经历 /
// 分享这次探索（系统分享）+ 可选「先查看完整总结 →」链接。

struct ChatNextPanel: View {
    var showSummaryLink: Bool
    var onGoLab: () -> Void
    var onGoSimilar: () -> Void
    var shareText: String
    var onOpenSummary: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("信息已经足够 · 选择下一步")
                .font(.system(size: 9)).tracking(1.6).foregroundStyle(Color(hex: 0x91B1FF))
            Text("把刚才的理解带去哪里？")
                .font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink)
                .padding(.top, 5)

            Button(action: onGoLab) {
                pathLabel(icon: "◉", title: "去人生实验室", note: "带着当前问题，推演几种可能")
                    .background(
                        LinearGradient(colors: [Color(hex: 0x3E70E8, alpha: 0.28), Color(hex: 0x6B55D3, alpha: 0.18)],
                                       startPoint: .topLeading, endPoint: .bottomTrailing),
                        in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.34), lineWidth: 1))
            }
            .buttonStyle(PressScaleStyle())
            .padding(.top, 11)

            HStack(spacing: 8) {
                Button(action: onGoSimilar) {
                    pathLabel(icon: "⌁", title: "看相似经历", note: "去社区找走过这段路的人")
                        .background(Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(Theme.line, lineWidth: 1))
                }
                .buttonStyle(PressScaleStyle())

                ShareLink(item: shareText) {
                    pathLabel(icon: "↗", title: "分享这次探索", note: "发给一个你信任的人")
                        .background(Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(Theme.line, lineWidth: 1))
                }
                .buttonStyle(PressScaleStyle())
            }
            .padding(.top, 8)

            if showSummaryLink {
                Button("先查看完整总结 →", action: onOpenSummary)
                    .font(.system(size: 10)).foregroundStyle(Color(hex: 0x9DBCFF))
                    .buttonStyle(.plain)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 11)
            }
        }
        .padding(14)
        .background(
            LinearGradient(colors: [Color(hex: 0x5E96FF, alpha: 0.11), Color(hex: 0x8F7BFF, alpha: 0.055)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous)
            .strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.2), lineWidth: 1))
        .transition(.opacity)
    }

    private func pathLabel(icon: String, title: String, note: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(icon).font(.system(size: 15)).foregroundStyle(Theme.ink)
            Text(title).font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Theme.ink).padding(.top, 7)
            Text(note).font(.system(size: 9)).lineSpacing(3).foregroundStyle(Theme.faint).padding(.top, 3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(11)
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

// MARK: - 探索总结页（原型 chatSummaryPage）

struct ChatSummaryView: View {
    let model: ChatModel
    var onGoLab: () -> Void
    var onGoSimilar: () -> Void
    /// 完成本次探索（关总结 + 关对话）
    var onFinish: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            topBar
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    hero
                    card(eyebrow: "你真正想解决的",
                         title: "不是选出标准答案，而是确认什么值得你承担代价",
                         body: "你的犹豫并不等于没有方向。它提醒你：愿望与代价需要被分开看见。")
                    card(eyebrow: "此刻的两股拉力",
                         title: "想靠近的，和想保护的",
                         body: "一边是「\(answer(0, "你真正想靠近的生活"))」；另一边是「\(answer(1, "你暂时还不能轻易放下的部分"))」。两边都是真的，不必把其中一边解释成软弱。",
                         accent: Color(hex: 0xA97DFF, alpha: 0.25))
                    card(eyebrow: "已经比较清楚的",
                         title: "你的原话比标签更重要",
                         body: model.answers.last ?? "你愿意先理解自己的真实需要，再做决定。")
                    card(eyebrow: "下一步的小验证",
                         title: "先收集一个真实证据",
                         body: "未来 7 天，做一次成本很低、可以撤回的小尝试。记录行动前后的期待、精力和抗拒，再判断你是\u{201C}不想要\u{201D}，还是\u{201C}暂时承担不起\u{201D}。",
                         accent: Color(hex: 0x3ED9A4, alpha: 0.25))
                    ChatNextPanel(showSummaryLink: false,
                                  onGoLab: onGoLab, onGoSimilar: onGoSimilar,
                                  shareText: model.shareText)
                        .padding(.top, 2)
                }
                .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 20)
            }
            .scrollIndicators(.hidden)

            PrimaryButton(title: "完成本次探索", action: onFinish)
                .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 12)
        }
        .background(Theme.paper.ignoresSafeArea())
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private func answer(_ index: Int, _ fallback: String) -> String {
        model.answers.count > index ? model.answers[index] : fallback
    }

    private var topBar: some View {
        HStack(spacing: 13) {
            BackButton { dismiss() }
            VStack(alignment: .leading, spacing: 2) {
                Text("本次探索总结").font(.system(size: 16, weight: .semibold)).tracking(0.8)
                Text("不是定论，是此刻更清楚的你").font(.system(size: 11)).foregroundStyle(Theme.faint)
            }
            Spacer()
        }
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 22).padding(.top, 16).padding(.bottom, 12)
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("\(model.launch.topic?.rawValue ?? "此刻的选择") · EXPLORATION NOTE")
                .font(.system(size: 10)).tracking(2).foregroundStyle(Color(hex: 0x91B1FF))
            Text(model.launch.question)
                .font(.system(size: 22, weight: .bold)).lineSpacing(7).foregroundStyle(Theme.ink)
                .padding(.top, 10)
            Text("这份总结来自刚才的对话，只记录你此刻认可的理解，不替你下结论。")
                .font(.system(size: 12)).lineSpacing(6).foregroundStyle(Theme.sub)
                .padding(.top, 9)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(22)
        .background(
            LinearGradient(colors: [Color(hex: 0x4065CB, alpha: 0.24), Color(hex: 0x7149AA, alpha: 0.12)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous)
            .strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.25), lineWidth: 1))
    }

    private func card(eyebrow: String, title: String, body text: String, accent: Color? = nil) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(eyebrow).font(.system(size: 10)).tracking(1.8).foregroundStyle(Color(hex: 0x91B1FF))
            Text(title).font(.system(size: 15, weight: .semibold)).lineSpacing(5).foregroundStyle(Theme.ink)
                .padding(.top, 8)
            Text(text).font(.system(size: 13)).lineSpacing(8).foregroundStyle(Color(hex: 0xC6CDDE))
                .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous)
            .strokeBorder(accent ?? Theme.line, lineWidth: 1))
    }
}
