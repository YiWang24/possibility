import SwiftUI

// MARK: - 万花筒抽取盘（签名动画）
//
// 与 HTML 原型同构的"三镜筒"实现（参考 bobbyroe/kaleidoscope 架构）：
// - 筒内景：7 颗轨道宝石（圆/棱形/方条/三角，径向渐变高光）持续公转 + 自转；
// - 三镜筒：正三角形交替镜像，6 三角 = 1 六边形，中心 + 外环 6 组共 42 个三角铺满圆盘，
//   每个三角贴同一份筒内景 → 蜂窝对称的万花筒图案；
// - 抽取时注入速度脉冲（指数衰减，先快后慢）+ 整盘旋转，图案持续折叠重组。
//
// 计时由父视图掌控（对应原型 setTimeout 2750ms）；本视图只负责视觉。
// `spinTrigger` 每自增一次触发一次速度脉冲；idle 时缓慢流动。

struct KaleidoscopeView: View {
    var size: CGFloat = 230
    /// 每次自增触发一次抽取旋转
    var spinTrigger: Int

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var spinStart: Date?

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            let now = timeline.date
            let dt = spinStart.map { max(0, now.timeIntervalSince($0)) }
            disc(t: effectiveTime(now), spinDt: dt)
        }
        .frame(width: size, height: size)
        .background(
            Circle()
                .fill(Color(hex: 0x6070DE, alpha: 0.55))
                .blur(radius: 35)
        )
        .onAppear { if !reduceMotion { spinStart = Date() } }
        .onChange(of: spinTrigger) { _, _ in spinStart = Date() }
        .accessibilityLabel("万花筒正在为你转出一位旅人")
    }

    private func disc(t: Double, spinDt: Double?) -> some View {
        // 抽取脉冲附加的整盘旋转（390°，指数缓出）与中段模糊
        let extraAngle: Double
        let blur: Double
        if let dt = spinDt {
            extraAngle = 390 * (1 - exp(-dt / 0.9))
            blur = dt < 1.4 ? 2.2 * sin(min(dt / 1.4, 1) * .pi) : 0
        } else {
            extraAngle = 0
            blur = 0
        }
        return Canvas { ctx, canvasSize in
            Self.draw(ctx, size: canvasSize, t: t)
        }
        .rotationEffect(.degrees(extraAngle))
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(.white.opacity(0.3), lineWidth: 1.5))
        .blur(radius: blur)
        .shadow(color: Color(hex: 0xA86FE3, alpha: 0.4), radius: 24)
    }

    /// 慢速基础流动 + 抽取速度脉冲的解析积分（先快后慢，不突变）
    private func effectiveTime(_ now: Date) -> Double {
        let base = now.timeIntervalSinceReferenceDate * 0.05
        guard let s = spinStart else { return base }
        let dt = max(0, now.timeIntervalSince(s))
        let tau = 0.85, boost = 40.0
        return base + boost * tau * (1 - exp(-dt / tau)) * 0.05
    }

    // MARK: - 筒内景：轨道宝石（固定种子，可复现）

    private struct Gem {
        let orbit: Double     // 公转半径（k 的倍数）
        let phase: Double
        let spd: Double       // 公转速度
        let rspd: Double      // 自转速度
        let r: Double         // 宝石大小（k 的倍数）
        let color: Color
        let kind: Int         // 0 圆 / 1 棱形 / 2 方条 / 3 三角
    }

    private static let gemColors: [UInt32] = [
        0xF06ACD, 0x9FBEFF, 0x5E96FF, 0x8F7BFF, 0xD9B3F5, 0xFF7A4D, 0xFFB067,
    ]

    private static let gems: [Gem] = {
        var seed = 12
        func rnd() -> Double {
            seed = (seed * 9301 + 49297) % 233280
            return Double(seed) / 233280
        }
        return (0..<7).map { _ in
            Gem(orbit: 0.22 + rnd() * 0.62,
                phase: rnd() * 2 * .pi,
                spd: (0.9 + rnd() * 1.6) * (rnd() > 0.5 ? 1 : -1),
                rspd: (rnd() > 0.5 ? 1 : -1) * (1.2 + rnd() * 2.2),
                r: 0.20 + rnd() * 0.22,
                color: Color(hex: gemColors[Int(rnd() * Double(gemColors.count)) % gemColors.count]),
                kind: Int(rnd() * 4) % 4)
        }
    }()

    // MARK: - Canvas 绘制：42 个交替镜像三角铺满圆盘

    private static func draw(_ ctx: GraphicsContext, size: CGSize, t: Double) {
        let radius = min(size.width, size.height) / 2
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let k = radius * 0.30      // 三角外接圆半径；六边形组间距 3k

        // 底色（被三角覆盖前的兜底）
        ctx.fill(
            Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)),
            with: .color(Color(hex: 0x2A2F9E))
        )

        for h in -1..<6 {
            let hx = h == -1 ? 0 : cos(.pi / 3 * Double(h)) * 3 * k
            let hy = h == -1 ? 0 : sin(.pi / 3 * Double(h)) * 3 * k
            for i in 0..<6 {
                var c = ctx
                c.translateBy(x: center.x + hx, y: center.y + hy)
                c.rotate(by: .radians(.pi / 3 * Double(i)))
                c.translateBy(x: -k, y: 0)
                if i % 2 == 1 { c.scaleBy(x: 1, y: -1) }   // 交替镜像 → 接缝对齐

                var tri = Path()
                tri.move(to: CGPoint(x: k, y: 0))
                tri.addLine(to: CGPoint(x: k * cos(2 * .pi / 3), y: k * sin(2 * .pi / 3)))
                tri.addLine(to: CGPoint(x: k * cos(4 * .pi / 3), y: k * sin(4 * .pi / 3)))
                tri.closeSubpath()
                c.clip(to: tri)

                drawSource(&c, k: k, t: t)
            }
        }

        // 中心亮核
        let coreR = radius * 0.15
        ctx.fill(
            Path(ellipseIn: CGRect(x: center.x - coreR, y: center.y - coreR, width: coreR * 2, height: coreR * 2)),
            with: .radialGradient(
                Gradient(stops: [
                    .init(color: .white.opacity(0.85), location: 0),
                    .init(color: Color(hex: 0xD9B3F5, alpha: 0.3), location: 0.6),
                    .init(color: .clear, location: 1),
                ]),
                center: center, startRadius: 0, endRadius: coreR
            )
        )
    }

    /// 同一份筒内景（背景 + 7 颗运动宝石），贴入每个三角
    private static func drawSource(_ c: inout GraphicsContext, k: CGFloat, t: Double) {
        // 底：深蓝紫渐变
        c.fill(
            Path(CGRect(x: -k, y: -k, width: k * 2, height: k * 2)),
            with: .linearGradient(
                Gradient(colors: [Color(hex: 0x3D48C8), Color(hex: 0x6070DE), Color(hex: 0x2A2F9E)]),
                startPoint: CGPoint(x: -k, y: -k), endPoint: CGPoint(x: k, y: k)
            )
        )
        for g in gems {
            let a = g.phase + t * g.spd
            var gc = c
            gc.translateBy(x: cos(a) * g.orbit * k, y: sin(a) * g.orbit * k)
            gc.rotate(by: .radians(t * g.rspd))
            let r = g.r * k
            let path = gemPath(kind: g.kind, r: r)
            let shading = GraphicsContext.Shading.radialGradient(
                Gradient(stops: [
                    .init(color: .white.opacity(0.95), location: 0),
                    .init(color: g.color, location: 0.4),
                    .init(color: Color(hex: 0x0A0C28, alpha: 0.9), location: 1),
                ]),
                center: CGPoint(x: -r * 0.3, y: -r * 0.3), startRadius: r * 0.1, endRadius: r * 1.3
            )
            gc.fill(path, with: shading)
            gc.stroke(path, with: .color(.white.opacity(0.55)), lineWidth: 1)
        }
    }

    private static func gemPath(kind: Int, r: CGFloat) -> Path {
        var p = Path()
        switch kind {
        case 0:
            p.addEllipse(in: CGRect(x: -r, y: -r, width: r * 2, height: r * 2))
        case 1:
            p.move(to: CGPoint(x: 0, y: -r))
            p.addLine(to: CGPoint(x: r * 0.8, y: 0))
            p.addLine(to: CGPoint(x: 0, y: r))
            p.addLine(to: CGPoint(x: -r * 0.8, y: 0))
            p.closeSubpath()
        case 2:
            p.addRoundedRect(in: CGRect(x: -r, y: -r * 0.4, width: r * 2, height: r * 0.8), cornerSize: CGSize(width: 2, height: 2))
        default:
            p.move(to: CGPoint(x: 0, y: -r))
            p.addLine(to: CGPoint(x: r, y: r * 0.7))
            p.addLine(to: CGPoint(x: -r, y: r * 0.7))
            p.closeSubpath()
        }
        return p
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
