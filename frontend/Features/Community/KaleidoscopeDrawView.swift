import SwiftUI

// MARK: - 万花筒抽取浮层（原型 .kal）
// 选「类似 / 相反」→ 万花筒旋转 → 转出一位真实旅人 → 查看主页。

struct KaleidoscopeDrawView: View {
    @Environment(SupabaseService.self) private var supabase
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    enum Phase { case choose, spinning, result }
    enum Mode: String { case similar, opposite }

    @State private var phase: Phase = .choose
    @State private var mode: Mode = .similar
    @State private var spinTrigger = 0
    @State private var drawn: Traveler?
    /// 后端 AI 抽取给出的匹配理由（本地兜底时为 nil）
    @State private var drawReason: String?

    private var pool: [Traveler] {
        supabase.travelers.isEmpty ? DemoData.travelers : supabase.travelers
    }

    var body: some View {
        ZStack {
            background.ignoresSafeArea()
            VStack(spacing: 0) {
                header.padding(.top, 90)
                Spacer(minLength: 20)
                content
                Spacer(minLength: 20)
                actions.padding(.bottom, 50)
            }
            .padding(.horizontal, 28)
            closeButton
        }
    }

    private var background: some View {
        ZStack {
            Color(hex: 0x06080E, alpha: 0.97)
            RadialGradient(colors: [Color(hex: 0x5E96FF, alpha: 0.075), .clear], center: UnitPoint(x: 0.5, y: 0.30), startRadius: 0, endRadius: 300)
            RadialGradient(colors: [Color(hex: 0xE35CC1, alpha: 0.035), .clear], center: UnitPoint(x: 0.5, y: 0.90), startRadius: 0, endRadius: 240)
        }
        .background(.ultraThinMaterial)
    }

    private var closeButton: some View {
        VStack {
            HStack {
                Spacer()
                Button("关闭 ✕") { dismiss() }
                    .font(.system(size: 12.5)).foregroundStyle(Theme.faint)
                    .padding(.top, 62).padding(.trailing, 20)
            }
            Spacer()
        }
    }

    // MARK: 文案

    private var header: some View {
        VStack(spacing: 8) {
            Text(title).font(.system(size: 20, weight: .bold)).tracking(0.8).foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
            if let sub {
                Text(sub).font(.system(size: 12)).foregroundStyle(Theme.sub).lineSpacing(4)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private var title: String {
        switch phase {
        case .choose: return "你想看见哪一面的人生？"
        case .spinning: return mode == .similar ? "寻找和你同路的人" : "寻找你没走过的路"
        case .result: return mode == .similar ? "与你的画像最相似的人" : "与你的轨迹完全相反的人"
        }
    }

    private var sub: String? {
        switch phase {
        case .choose: return "万花筒会为你转出一位真实的旅人"
        case .spinning: return nil
        case .result: return drawReason ?? "看看 TA 的人生轨迹"
        }
    }

    // MARK: 主内容

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .choose: modeOptions
        case .spinning:
            VStack(spacing: 20) {
                KaleidoscopeView(spinTrigger: spinTrigger)
                Text("光在旋转，人生在折叠……").font(.system(size: 12)).tracking(1.5).foregroundStyle(Theme.faint)
            }
        case .result:
            if let drawn { resultCard(drawn) }
        }
    }

    private var modeOptions: some View {
        HStack(spacing: 12) {
            modeCard(.similar, emoji: "🪞", title: "和我有类似经历", desc: "在同路人身上\n看见自己的下一步")
            modeCard(.opposite, emoji: "🔭", title: "和我经历完全相反", desc: "在另一种人生里\n看见没走过的路")
        }
    }

    private func modeCard(_ m: Mode, emoji: String, title: String, desc: String) -> some View {
        let on = mode == m
        return Button {
            withAnimation(.easeOut(duration: 0.2)) { mode = m }
        } label: {
            VStack(spacing: 0) {
                Text(emoji).font(.system(size: 22))
                Text(title).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink).padding(.top, 10)
                Text(desc).font(.system(size: 11)).foregroundStyle(Theme.sub).lineSpacing(3)
                    .multilineTextAlignment(.center).padding(.top, 5)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 14).padding(.vertical, 20)
            .background(
                on
                    ? AnyShapeStyle(LinearGradient(colors: [Color(hex: 0x5E96FF, alpha: 0.16), Color(hex: 0xE35CC1, alpha: 0.1)], startPoint: .topLeading, endPoint: .bottomTrailing))
                    : AnyShapeStyle(Theme.card),
                in: RoundedRectangle(cornerRadius: 20, style: .continuous)
            )
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(on ? Color(hex: 0x6FA5FF, alpha: 0.7) : Theme.line, lineWidth: 1.5))
            .offset(y: on ? -2 : 0)
        }
        .buttonStyle(PressScaleStyle())
    }

    private func resultCard(_ t: Traveler) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HueBandHeader(initial: t.initial, hue: t.hue, bandHeight: 74, avatarSize: 52,
                          imageName: MockAvatar.name(for: t.id))
            VStack(alignment: .leading, spacing: 8) {
                Text(t.name).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.ink)
                Text("「\(t.quote)」").font(.system(size: 13)).foregroundStyle(Theme.sub).lineSpacing(5)
                    .frame(maxWidth: .infinity, alignment: .leading)
                FlowLayout(spacing: 5) {
                    ForEach(t.tags, id: \.self) { TagPill(text: $0) }
                }
                .padding(.top, 4)
            }
            .padding(.horizontal, 20).padding(.top, 28).padding(.bottom, 20)
        }
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
        .shadow(color: .black.opacity(0.5), radius: 30, y: 12)
        .transition(.scale(scale: 0.92).combined(with: .opacity))
    }

    // MARK: 底部动作

    @ViewBuilder
    private var actions: some View {
        switch phase {
        case .choose:
            PrimaryButton(title: "开始转动 · 抽一位旅人") { spin() }
        case .spinning:
            EmptyView()
        case .result:
            VStack(spacing: 10) {
                if let drawn {
                    TravelerProfileLink(travelerId: drawn.id) {
                        Text("查看 TA 的主页")
                            .font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                            .frame(maxWidth: .infinity).padding(.vertical, 15)
                            .background(Theme.buttonGradient, in: Capsule())
                            .shadow(color: Color(hex: 0x4F7DFF, alpha: 0.6), radius: 14, y: 8)
                    }
                }
                Button("再转一次") { withAnimation { phase = .choose; drawn = nil; drawReason = nil } }
                    .font(.system(size: 12.5)).foregroundStyle(Theme.faint).padding(.top, 2)
            }
        }
    }

    // MARK: 抽取

    private func spin() {
        withAnimation(.easeInOut(duration: 0.3)) { phase = .spinning }
        spinTrigger += 1
        let delay: Duration = reduceMotion ? .milliseconds(400) : .milliseconds(1450)
        let modeParam = mode == .similar ? "similar" : "different"
        Task {
            // 动画和远程抽取并行，接口最多占用一个动画周期；
            // 超时立即回落本地候选，避免网络延迟把转盘停在中间态。
            async let spinWait: Void? = try? await Task.sleep(for: delay)
            let picked = await withTaskGroup(
                of: (travelerId: Int, reason: String)?.self
            ) { group in
                group.addTask {
                    try? await supabase.kaleidoscopeDraw(mode: modeParam)
                }
                group.addTask {
                    try? await Task.sleep(for: delay)
                    return nil
                }
                let first = await group.next() ?? nil
                group.cancelAll()
                return first
            }
            _ = await spinWait

            let chosen: Traveler?
            if let picked, let t = pool.first(where: { $0.id == picked.travelerId }) {
                chosen = t
                drawReason = picked.reason
            } else {
                let candidates = pool.filter { mode == .similar ? $0.isSimilar : !$0.isSimilar }
                chosen = (candidates.isEmpty ? pool : candidates).randomElement()
                drawReason = nil
            }
            withAnimation(.spring(response: 0.5, dampingFraction: 0.75)) {
                drawn = chosen
                phase = .result
            }
        }
    }
}

#Preview {
    KaleidoscopeDrawView()
        .environment(SupabaseService())
        .preferredColorScheme(.dark)
}
