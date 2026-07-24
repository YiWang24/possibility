import SwiftUI

// MARK: - 万花筒光球（签名元素）
//
// 原型 `.orb`：conic 色环自转 26s + 内层反向自转 18s + 中心高光；
// `.orb-halo`：外圈呼吸光晕 6s（scale 1↔1.12 / opacity .7↔1）。
// 用 TimelineView 驱动连续自转（§8.4），reduceMotion 时暂停并静置。

struct OrbView: View {
    var size: CGFloat = 96
    /// 是否绘制外圈呼吸光晕
    var showHalo: Bool = true

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            let outer = Self.angle(t, period: 26)
            let inner = -Self.angle(t, period: 18)
            let pulse = reduceMotion ? 0.5 : Self.wave(t, period: 6)

            ZStack {
                if showHalo { halo(pulse: pulse) }
                orbBody(outer: outer, inner: inner)
            }
            .frame(width: size, height: size)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    // 呼吸光晕：inset -16% 的模糊径向光，随 pulse 缩放/明暗
    private func halo(pulse: Double) -> some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [
                        Color(hex: 0x5E96FF, alpha: 0.5),
                        Color(hex: 0xE35CC1, alpha: 0.25),
                        .clear,
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: size * 0.7
                )
            )
            .frame(width: size * 1.32, height: size * 1.32)
            .blur(radius: 10)
            .scaleEffect(1 + 0.12 * pulse)
            .opacity(0.7 + 0.3 * pulse)
    }

    private func orbBody(outer: Double, inner: Double) -> some View {
        ZStack {
            // 外层 conic 色环
            Circle()
                .fill(AngularGradient(colors: Theme.orbConicColors, center: .center))
                .rotationEffect(.degrees(outer))

            // 内层反向自转 + 模糊
            Circle()
                .fill(AngularGradient(
                    colors: [
                        Color(hex: 0xFF7A4D), Color(hex: 0x5E96FF),
                        Color(hex: 0xE35CC1), Color(hex: 0xFF7A4D),
                    ],
                    center: .center,
                    angle: .degrees(140)
                ))
                .padding(size * 0.14)
                .blur(radius: size * 0.06)
                .opacity(0.9)
                .rotationEffect(.degrees(inner))

            // 中心高光
            Circle()
                .fill(
                    RadialGradient(
                        colors: [.white, Color(hex: 0xE8F0FF, alpha: 0.7), .clear],
                        center: UnitPoint(x: 0.4, y: 0.35),
                        startRadius: 0,
                        endRadius: size * 0.22
                    )
                )
                .padding(size * 0.30)
        }
        .clipShape(Circle())
    }

    // MARK: - 时间 → 角度 / 呼吸

    /// 连续自转角度（0..360）
    static func angle(_ t: TimeInterval, period: Double) -> Double {
        (t.truncatingRemainder(dividingBy: period) / period) * 360
    }

    /// 呼吸波（0..1）
    static func wave(_ t: TimeInterval, period: Double) -> Double {
        (sin(t / period * 2 * .pi) + 1) / 2
    }
}

// MARK: - 迷你光球（对话 thinking / 抽取 FAB）

struct MiniOrb: View {
    var size: CGFloat = 20
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            let angle = OrbView.angle(timeline.date.timeIntervalSinceReferenceDate, period: 8)
            Circle()
                .fill(AngularGradient(colors: Theme.orbConicColors, center: .center))
                .rotationEffect(.degrees(angle))
                .frame(width: size, height: size)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

#Preview {
    ZStack {
        Theme.stage.ignoresSafeArea()
        VStack(spacing: 40) {
            OrbView(size: 96)
            MiniOrb(size: 24)
        }
    }
    .preferredColorScheme(.dark)
}
