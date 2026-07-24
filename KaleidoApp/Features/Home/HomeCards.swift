import SwiftUI

// MARK: - 首页 AI 发问卡（原型 .ask）

struct HomeAskCard: View {
    @Bindable var model: HomeModel
    var onSend: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("今天想探索什么")
                .font(.system(size: 11)).tracking(3.5)
                .foregroundStyle(Color(hex: 0x9DBCFF))
                .overlay(alignment: .leading) {
                    Rectangle().fill(Color(hex: 0x9DBCFF, alpha: 0.6))
                        .frame(width: 18, height: 1.5).offset(x: -26)
                }
                .padding(.leading, 26)

            (Text("说出那个\n") + Text("在心里盘旋").foregroundColor(Theme.blue) + Text("的问题"))
                .font(.system(size: 22, weight: .bold)).lineSpacing(6)
                .foregroundStyle(Theme.ink)
                .padding(.top, 12)

            askBox.padding(.top, 16)

            FlowLayout(spacing: 8) {
                ForEach(ExploreTopic.allCases) { t in
                    softChip(t)
                }
            }
            .padding(.top, 14)
        }
        .padding(.horizontal, 22).padding(.top, 24).padding(.bottom, 22)
        .background(askBackground)
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).strokeBorder(Color(hex: 0x7A9EFF, alpha: 0.3), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    }

    private var askBox: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 5) {
                Text("✦").font(.system(size: 11))
                Text("\(model.topic.rawValue) 分类下提问").font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(Color(hex: 0x9DBCFF))
            .padding(.horizontal, 11).padding(.vertical, 4)
            .background(Color(hex: 0x5E96FF, alpha: 0.16), in: Capsule())
            .overlay(Capsule().strokeBorder(Color(hex: 0x5E96FF, alpha: 0.4), lineWidth: 1))

            TextField("", text: $model.question, prompt: Text("比如：我是否要从交互设计师转为产品经理？").foregroundColor(Theme.faint), axis: .vertical)
                .font(.system(size: 15)).lineSpacing(4).foregroundStyle(Theme.ink)
                .focused($focused)
                .lineLimit(2...4)
                .tint(Theme.blue)

            HStack {
                Text("灵感来自你 3 天前的日记").font(.system(size: 11)).foregroundStyle(Theme.faint)
                Spacer()
                Button("发送") { focused = false; onSend() }
                    .font(.system(size: 13.5, weight: .semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 24).padding(.vertical, 10)
                    .background(Theme.buttonGradient, in: Capsule())
                    .shadow(color: Color(hex: 0x4F7DFF, alpha: 0.6), radius: 10, y: 6)
                    .buttonStyle(PressScaleStyle())
                    .disabled(!model.canSend)
                    .opacity(model.canSend ? 1 : 0.4)
            }
            .padding(.top, 2)
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(Color(hex: 0x060810, alpha: 0.45), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.white.opacity(0.12), lineWidth: 1))
    }

    private func softChip(_ t: ExploreTopic) -> some View {
        let on = model.topic == t
        return Button {
            withAnimation(.easeOut(duration: 0.18)) { model.topic = t }
        } label: {
            Text(t.rawValue)
                .font(.system(size: 12.5))
                .foregroundStyle(on ? Color(hex: 0x9DBCFF) : Theme.sub)
                .padding(.horizontal, 15).padding(.vertical, 8)
                .background(on ? Color(hex: 0x5E96FF, alpha: 0.14) : Color.white.opacity(0.07), in: Capsule())
                .overlay(Capsule().strokeBorder(on ? Color(hex: 0x5E96FF, alpha: 0.5) : Color.white.opacity(0.1), lineWidth: 1))
        }
        .buttonStyle(PressScaleStyle())
    }

    private var askBackground: some View {
        ZStack(alignment: .topTrailing) {
            LinearGradient(colors: [Color(hex: 0x141A34), Color(hex: 0x1A2350), Color(hex: 0x10132A)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            RadialGradient(colors: [Color(hex: 0x6FA5FF, alpha: 0.35), .clear],
                           center: .topTrailing, startRadius: 0, endRadius: 200)
            // 熔岩灯：metaball 场（蓝顶 → 品红底），blob 竖向慢漂移、相吸融合
            LavaLampView(
                specs: [
                    LavaBlobSpec(baseX: 0.78, baseY: 0.16, ampX: 0.14, ampY: 0.22, periodX: 13, periodY: 17, phase: 1.0, radius: 0.30),
                    LavaBlobSpec(baseX: 0.18, baseY: 0.80, ampX: 0.16, ampY: 0.30, periodX: 15, periodY: 19, phase: 2.6, radius: 0.26),
                    LavaBlobSpec(baseX: 0.46, baseY: 0.46, ampX: 0.18, ampY: 0.26, periodX: 11, periodY: 9,  phase: 4.0, radius: 0.18, pulse: 0.35),
                    LavaBlobSpec(baseX: 0.88, baseY: 0.70, ampX: 0.10, ampY: 0.24, periodX: 8,  periodY: 21, phase: 5.4, radius: 0.15),
                ],
                color1: Color(hex: 0x6FA5FF),   // 顶：蓝
                color2: Color(hex: 0xE35CC1),   // 底：品红
                threshold: 1.05,
                softness: 2
            )
            .opacity(0.5)
        }
    }
}

/// 呼吸缩放（ask 光球 / portrait 光晕）
struct BreatheModifier: ViewModifier {
    var enabled: Bool
    @State private var on = false
    func body(content: Content) -> some View {
        content
            .scaleEffect(enabled && on ? 1.1 : 1)
            .opacity(enabled ? (on ? 1 : 0.75) : 0.85)
            .onAppear {
                guard enabled else { return }
                withAnimation(.easeInOut(duration: 7).repeatForever(autoreverses: true)) { on = true }
            }
    }
}

// MARK: - 动态画像卡（原型 .portrait）

struct PortraitCard: View {
    let model: HomeModel
    let profile: UserProfile?
    var onTapSkill: () -> Void
    var onTapLike: () -> Void
    var onTapTodo: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            OrbView(size: 96).padding(.top, 4)
            Text("\(model.userName) · 动态数字人")
                .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink).padding(.top, 16)
            Text("探索者 LV.3")
                .font(.system(size: 11.5)).tracking(2).foregroundStyle(Theme.faint).padding(.top, 4)

            progressBar.padding(.top, 16)

            VStack(spacing: 9) {
                ForEach(model.portraitDims(profile: profile)) { dim in
                    dimRow(dim)
                }
            }
            .padding(.top, 16)
        }
        .padding(.horizontal, 20).padding(.top, 24).padding(.bottom, 18)
        .kaleidoCard()
    }

    private var progressBar: some View {
        HStack(spacing: 10) {
            GeometryReader { geo in
                Capsule().fill(Theme.raised)
                    .overlay(alignment: .leading) {
                        Capsule().fill(Theme.aurora)
                            .frame(width: geo.size.width * CGFloat(model.portraitPct(profile: profile)) / 100)
                    }
            }
            .frame(height: 5)
            Text("\(model.portraitPct(profile: profile))%")
                .font(.system(size: 11)).monospacedDigit().foregroundStyle(Theme.sub)
        }
        .frame(maxWidth: 250)
    }

    private func dimRow(_ dim: HomeModel.PortraitDim) -> some View {
        Button {
            switch dim.label {
            case "我擅长": onTapSkill()
            case "我喜欢": onTapLike()
            default: onTapTodo()
            }
        } label: {
            HStack(spacing: 12) {
                Text(dim.icon).font(.system(size: 15))
                    .frame(width: 34, height: 34)
                    .background(Color(hex: dim.iconTint, alpha: 0.15), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(dim.label).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink)
                    Text(dim.value).font(.system(size: 11.5))
                        .foregroundStyle(dim.isTodo ? Theme.blue : Theme.sub)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                Text("›").font(.system(size: 14)).foregroundStyle(Theme.faint)
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
            .background(dim.isTodo ? Color(hex: 0x5E96FF, alpha: 0.06) : Theme.raised,
                        in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(dim.isTodo ? Color(hex: 0x5E96FF, alpha: 0.4) : Theme.line,
                                  style: StrokeStyle(lineWidth: 1, dash: dim.isTodo ? [4, 4] : []))
            )
        }
        .buttonStyle(PressScaleStyle())
    }
}
