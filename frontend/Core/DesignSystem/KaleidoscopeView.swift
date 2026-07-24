import SwiftUI

// MARK: - 万花筒抽取盘（签名动画）
//
// 原型 `.kal-disc`：SVG 楔形对称图案，`kspin` 2.6s 旋转 1170° + 中途 blur，
// 内层 `k-l2` 反转 -660°、`k-flower` 转 420° 制造纵深。
// SwiftUI 用 Canvas 绘 12 楔对称图案（§8.4），KeyframeAnimator 驱动整段抽取动画。
//
// 计时由父视图掌控（对应原型 setTimeout 2750ms）；本视图只负责视觉。
// `spinTrigger` 每自增一次触发一次完整旋转；idle 时缓慢自转。

struct KaleidoscopeView: View {
    var size: CGFloat = 230
    /// 每次自增触发一次抽取旋转
    var spinTrigger: Int

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private struct Spin: Equatable {
        var outer = 0.0
        var mid = 0.0
        var flower = 0.0
        var blur = 0.0
    }

    var body: some View {
        Group {
            if reduceMotion {
                disc(outer: 0, mid: 0, flower: 0, blur: 0)
            } else {
                KeyframeAnimator(initialValue: Spin(), trigger: spinTrigger) { s in
                    disc(outer: s.outer, mid: s.mid, flower: s.flower, blur: s.blur)
                } keyframes: { _ in
                    KeyframeTrack(\.outer) { CubicKeyframe(1170, duration: 2.6) }
                    KeyframeTrack(\.mid) { CubicKeyframe(-660, duration: 2.6) }
                    KeyframeTrack(\.flower) { CubicKeyframe(420, duration: 2.6) }
                    KeyframeTrack(\.blur) {
                        CubicKeyframe(2.5, duration: 0.78)   // 峰值约 30%
                        CubicKeyframe(0, duration: 1.82)
                    }
                }
            }
        }
        .frame(width: size, height: size)
        .background(
            Circle()
                .fill(Color(hex: 0x6070DE, alpha: 0.55))
                .blur(radius: 35)
        )
        .accessibilityLabel("万花筒正在为你转出一位旅人")
    }

    // 三层叠加的万花筒盘
    private func disc(outer: Double, mid: Double, flower: Double, blur: Double) -> some View {
        ZStack {
            Canvas { ctx, size in Self.drawWedges(ctx, size: size) }
                .rotationEffect(.degrees(outer))
            Canvas { ctx, size in Self.drawMidRing(ctx, size: size) }
                .rotationEffect(.degrees(mid))
                .blendMode(.screen)
            Canvas { ctx, size in Self.drawFlower(ctx, size: size) }
                .rotationEffect(.degrees(flower))
                .blendMode(.plusLighter)
            // 中心亮核
            Circle()
                .fill(RadialGradient(
                    colors: [.white, Color(hex: 0xC9C2D6, alpha: 0.6), .clear],
                    center: .center, startRadius: 0, endRadius: size * 0.14
                ))
                .frame(width: size * 0.34, height: size * 0.34)
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(.white.opacity(0.15), lineWidth: 1))
        .blur(radius: blur)
        .shadow(color: Color(hex: 0xA86FE3, alpha: 0.4), radius: 24)
    }

    // MARK: - Canvas 绘制（12 楔对称）

    private static let wedgeCount = 12

    /// 底层：12 个交替配色的扇形楔
    private static func drawWedges(_ ctx: GraphicsContext, size: CGSize) {
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let radius = min(size.width, size.height) / 2
        let step = 2 * Double.pi / Double(wedgeCount)
        let fills: [Color] = [
            Color(hex: 0x2338B8), Color(hex: 0x7C2168),
            Color(hex: 0x2A2F9E), Color(hex: 0x1F8A66),
        ]
        for i in 0..<wedgeCount {
            let a0 = step * Double(i) - .pi / 2
            let a1 = a0 + step
            var path = Path()
            path.move(to: center)
            path.addArc(center: center, radius: radius,
                        startAngle: .radians(a0), endAngle: .radians(a1), clockwise: false)
            path.closeSubpath()
            ctx.fill(path, with: .color(fills[i % fills.count].opacity(0.92)))
        }
    }

    /// 中层：环形花瓣（screen 混合提亮）
    private static func drawMidRing(_ ctx: GraphicsContext, size: CGSize) {
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let radius = min(size.width, size.height) / 2
        let petals = 6
        let step = 2 * Double.pi / Double(petals)
        let colors: [Color] = [Color(hex: 0x9FBEFF), Color(hex: 0xE883D6), Color(hex: 0xD9B3F5)]
        for i in 0..<petals {
            let angle = step * Double(i)
            let cx = center.x + cos(angle) * radius * 0.5
            let cy = center.y + sin(angle) * radius * 0.5
            let rect = CGRect(x: cx - radius * 0.22, y: cy - radius * 0.10,
                              width: radius * 0.44, height: radius * 0.20)
            let ellipse = Path(ellipseIn: rect)
            ctx.fill(ellipse, with: .color(colors[i % colors.count].opacity(0.5)))
        }
    }

    /// 顶层：中心花冠（plusLighter 混合成高光）
    private static func drawFlower(_ ctx: GraphicsContext, size: CGSize) {
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let radius = min(size.width, size.height) / 2
        let petals = 8
        let step = 2 * Double.pi / Double(petals)
        for i in 0..<petals {
            let angle = step * Double(i)
            let cx = center.x + cos(angle) * radius * 0.26
            let cy = center.y + sin(angle) * radius * 0.26
            let rect = CGRect(x: cx - radius * 0.10, y: cy - radius * 0.10,
                              width: radius * 0.20, height: radius * 0.20)
            ctx.fill(Path(ellipseIn: rect), with: .color(Color(hex: 0xA86FE3, alpha: 0.35)))
        }
    }
}

#Preview {
    struct Demo: View {
        @State private var trigger = 0
        var body: some View {
            ZStack {
                Theme.stage.ignoresSafeArea()
                VStack(spacing: 30) {
                    KaleidoscopeView(spinTrigger: trigger)
                    Button("转一次") { trigger += 1 }
                        .foregroundStyle(Theme.blue)
                }
            }
        }
    }
    return Demo().preferredColorScheme(.dark)
}
