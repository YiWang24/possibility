import SwiftUI

// MARK: - 万花筒光球 · 熔岩灯（签名元素）
//
// 对应原型 `.orb` 熔岩灯版：深蓝"灯瓶"内两团彩色蜡团（蓝紫 / 品红-橙）
// 以不同周期的利萨如轨迹游走、胀缩，screen 混合发光，相遇时颜色融合；
// `.orb-halo`：外圈呼吸光晕 6s。reduceMotion 时蜡团静置。

struct OrbView: View {
    var size: CGFloat = 96
    /// 是否绘制外圈呼吸光晕
    var showHalo: Bool = true

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            let t = reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate
            let pulse = reduceMotion ? 0.5 : Self.wave(t, period: 6)

            ZStack {
                if showHalo { halo(pulse: pulse) }
                orbBody(t: t)
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

    // 灯瓶 + metaball 熔岩（4 团蜡团，竖向为主的慢漂移）+ 顶部高光
    private func orbBody(t: Double) -> some View {
        ZStack {
            // 深蓝灯瓶
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color(hex: 0x4A55D6), Color(hex: 0x2A2F9E), Color(hex: 0x1B1E5C)],
                        center: UnitPoint(x: 0.5, y: 0.55),
                        startRadius: 0,
                        endRadius: size * 0.62
                    )
                )

            LavaLampView(
                specs: [
                    LavaBlobSpec(baseX: 0.38, baseY: 0.32, ampX: 0.12, ampY: 0.26, periodX: 9,  periodY: 13, phase: 0.8, radius: 0.24),
                    LavaBlobSpec(baseX: 0.66, baseY: 0.66, ampX: 0.14, ampY: 0.24, periodX: 11, periodY: 8,  phase: 2.4, radius: 0.21),
                    LavaBlobSpec(baseX: 0.30, baseY: 0.74, ampX: 0.10, ampY: 0.22, periodX: 7,  periodY: 15, phase: 4.2, radius: 0.16),
                    LavaBlobSpec(baseX: 0.68, baseY: 0.26, ampX: 0.12, ampY: 0.20, periodX: 13, periodY: 10, phase: 5.5, radius: 0.13),
                ],
                color1: Color(hex: 0x6FA5FF),   // 顶：蓝
                color2: Color(hex: 0xF06ACD),   // 底：品红
                threshold: 1.0,
                softness: size * 0.015
            )
            .opacity(0.92)

            // 顶部高光（轻薄，避免盖白熔岩）
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.white.opacity(0.22), .clear],
                        center: UnitPoint(x: 0.38, y: 0.28),
                        startRadius: 0,
                        endRadius: size * 0.36
                    )
                )
        }
        .clipShape(Circle())
    }

    // MARK: - 时间 → 角度 / 呼吸

    /// 连续自转角度（0..360）
    static func angle(_ t: TimeInterval, period: Double) -> Double {
        (t.truncatingRemainder(dividingBy: period) / period) * 360
    }

    /// 呼吸波（0..1）
    static func wave(_ t: TimeInterval, period: Double, phase: Double = 0) -> Double {
        (sin(t / period * 2 * .pi + phase) + 1) / 2
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
