import SwiftUI

// MARK: - 万花筒抽取盘（签名动画）
//
// 参考数字世界中的蓝青数据流，并保留真实万花筒的晶体折射结构：
// - 深海军蓝为底，青蓝为绝对主色，紫色仅存在于少量折射面；
// - 同一组晶体花瓣在十二面镜筒中折射，形成三层嵌套花型；
// - 数据粒子沿晶体棱线流动，科技感依附于万花筒而不是取代它；
// - 呼吸仅通过核心半径与线条位置变化完成，不改变整盘透明度；
// - 抽取时镜盘与内部纹样反向扭转，呈现真实的“拧动”感。

struct KaleidoscopeView: View {
    var size: CGFloat = 230
    var spinTrigger: Int

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var spinStart: Date?

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: reduceMotion)) { timeline in
            let now = timeline.date
            let elapsed = spinStart.map { max(0, now.timeIntervalSince($0)) }
            let breath = reduceMotion
                ? 1
                : 1 + sin(now.timeIntervalSinceReferenceDate * 0.72) * 0.014
            let motion = motionState(elapsed)

            ZStack {
                outerHalo(breath: breath)

                Canvas { context, canvasSize in
                    Self.draw(
                        context,
                        size: canvasSize,
                        time: effectiveTime(now),
                        twist: motion.innerTwist,
                        sourceScale: motion.sourceScale,
                        sourceOffsetX: motion.sourceOffsetX,
                        sourceOffsetY: motion.sourceOffsetY,
                        breath: breath
                    )
                }
                .rotationEffect(.degrees(motion.discRotation))
                .clipShape(Circle())
                .overlay(rim)
                .drawingGroup(opaque: false, colorMode: .linear)
            }
            .frame(width: size, height: size)
        }
        .onAppear {
            if !reduceMotion, spinTrigger > 0 { spinStart = Date() }
        }
        .onChange(of: spinTrigger) { _, _ in spinStart = Date() }
        .accessibilityLabel("万花筒正在为你转出一位旅人")
    }

    private struct MotionState {
        let discRotation: Double
        let innerTwist: Double
        let sourceScale: Double
        let sourceOffsetX: Double
        let sourceOffsetY: Double
    }

    private func motionState(_ elapsed: Double?) -> MotionState {
        guard let elapsed else {
            return MotionState(
                discRotation: 0,
                innerTwist: 0,
                sourceScale: 1,
                sourceOffsetX: 0,
                sourceOffsetY: 0
            )
        }

        let progress = min(1, elapsed / 1.35)
        let turn = 1 - pow(1 - progress, 4)
        let envelope = sin(progress * .pi)
        let sizeKeyframe = sin(progress * .pi * 2) * envelope
        let centerXKeyframe = sin(progress * .pi * 2) * envelope
        let centerYKeyframe = sin(progress * .pi * 3 + 0.35) * envelope
        return MotionState(
            // 圆框不动，内部成品花纹完成一次明确的顺时针拧转。
            discRotation: 150 * turn,
            // 扭转在结束时回正，避免彩色晶体停在镜面裁切区外。
            innerTwist: 0.18 * envelope + 0.035 * centerYKeyframe,
            // 对应 CC Kaleida Size：一次完整、清晰的放大—缩小，而非连续抖动。
            sourceScale: 1 + 0.2 * sizeKeyframe,
            // 对应 CC Kaleida Center：采样中心走二维弧线，花瓣会跨镜面重新拼合。
            sourceOffsetX: 0.145 * centerXKeyframe,
            sourceOffsetY: 0.105 * centerYKeyframe
        )
    }

    private func effectiveTime(_ now: Date) -> Double {
        let idle = now.timeIntervalSinceReferenceDate * 0.12
        guard let spinStart else { return idle }
        let elapsed = max(0, now.timeIntervalSince(spinStart))
        let progress = min(1, elapsed / 1.2)
        return idle + (1 - pow(1 - progress, 4)) * 2.7
    }

    private func outerHalo(breath: Double) -> some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [
                        Color(hex: 0x32E6FF, alpha: 0.18),
                        Color(hex: 0x1677FF, alpha: 0.13),
                        Color(hex: 0x645BFF, alpha: 0.035),
                        .clear,
                    ],
                    center: .center,
                    startRadius: size * 0.37,
                    endRadius: size * 0.65
                )
            )
            .scaleEffect(1.12 * breath)
            .blur(radius: 13)
    }

    private var rim: some View {
        Circle()
            .strokeBorder(
                AngularGradient(
                    colors: [
                        Color(hex: 0x32E6FF),
                        Color(hex: 0x1677FF),
                        Color(hex: 0x33B8FF),
                        Color(hex: 0x6C5CFF),
                        Color(hex: 0x1677FF),
                        Color(hex: 0x32E6FF),
                    ],
                    center: .center
                ),
                lineWidth: 1.15
            )
            .overlay(
                Circle()
                    .strokeBorder(Color.white.opacity(0.16), lineWidth: 0.55)
                    .padding(5)
            )
            .shadow(color: Color(hex: 0x32E6FF, alpha: 0.28), radius: 4)
    }

    // MARK: - 镜筒

    private static let cyan = UInt32(0x32E6FF)
    private static let blue = UInt32(0x1677FF)
    private static let violet = UInt32(0x7D4DFF)

    private static func draw(
        _ context: GraphicsContext,
        size: CGSize,
        time: Double,
        twist: Double,
        sourceScale: Double,
        sourceOffsetX: Double,
        sourceOffsetY: Double,
        breath: Double
    ) {
        let radius = min(size.width, size.height) / 2
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let disc = Path(ellipseIn: CGRect(
            x: center.x - radius,
            y: center.y - radius,
            width: radius * 2,
            height: radius * 2
        ))

        context.fill(
            disc,
            with: .radialGradient(
                Gradient(stops: [
                    .init(color: Color(hex: 0x0E58A8), location: 0),
                    .init(color: Color(hex: 0x063B88), location: 0.36),
                    .init(color: Color(hex: 0x0B245B), location: 0.7),
                    .init(color: Color(hex: 0x050C22), location: 1),
                ]),
                center: center,
                startRadius: 0,
                endRadius: radius
            )
        )

        drawMirrorSectors(
            context,
            center: center,
            radius: radius,
            time: time,
            twist: twist,
            sourceScale: sourceScale,
            sourceOffsetX: sourceOffsetX,
            sourceOffsetY: sourceOffsetY,
            breath: breath
        )
        drawCore(context, center: center, radius: radius, time: time, breath: breath)
        drawOuterNodes(context, center: center, radius: radius, time: time)
    }

    /// 十二面镜筒：每片都来自同一个晶体母纹样，相邻镜片严格反射。
    private static func drawMirrorSectors(
        _ context: GraphicsContext,
        center: CGPoint,
        radius: CGFloat,
        time: Double,
        twist: Double,
        sourceScale: Double,
        sourceOffsetX: Double,
        sourceOffsetY: Double,
        breath: Double
    ) {
        let sectorCount = 12
        let halfAngle = .pi / Double(sectorCount)

        for index in 0..<sectorCount {
            var mirror = context
            mirror.translateBy(x: center.x, y: center.y)
            mirror.rotate(by: .radians(
                Double(index) * .pi * 2 / Double(sectorCount)
            ))
            if index.isMultiple(of: 2) {
                mirror.scaleBy(x: 1, y: -1)
            }

            var wedge = Path()
            wedge.move(to: .zero)
            wedge.addLine(to: CGPoint(
                x: cos(-halfAngle) * Double(radius * 1.04),
                y: sin(-halfAngle) * Double(radius * 1.04)
            ))
            wedge.addLine(to: CGPoint(
                x: cos(halfAngle) * Double(radius * 1.04),
                y: sin(halfAngle) * Double(radius * 1.04)
            ))
            wedge.closeSubpath()
            mirror.clip(to: wedge)

            // 先改变母图，再交给镜面复制：这是图案聚散而非整盘缩放的来源。
            mirror.rotate(by: .radians(twist))
            mirror.translateBy(
                x: radius * CGFloat(sourceOffsetX),
                y: radius * CGFloat(sourceOffsetY)
            )
            mirror.scaleBy(
                x: CGFloat(sourceScale),
                y: CGFloat(1 + (sourceScale - 1) * 0.62)
            )

            drawPrismaticMotif(
                &mirror,
                radius: radius,
                time: time,
                breath: breath
            )
        }
    }

    /// 一片镜筒中的唯一母纹样：四层晶体碎片先构成花瓣，再由镜筒折射成花。
    private static func drawPrismaticMotif(
        _ context: inout GraphicsContext,
        radius: CGFloat,
        time: Double,
        breath: Double
    ) {
        let breatheShift = (breath - 1) * radius * 0.7

        var atmosphere = Path()
        atmosphere.move(to: .zero)
        atmosphere.addLine(to: CGPoint(x: radius * 1.2, y: -radius * 0.78))
        atmosphere.addLine(to: CGPoint(x: radius * 1.2, y: radius * 0.78))
        atmosphere.closeSubpath()
        context.fill(
            atmosphere,
            with: .linearGradient(
                Gradient(stops: [
                    .init(color: Color(hex: cyan, alpha: 0.18), location: 0),
                    .init(color: Color(hex: blue, alpha: 0.14), location: 0.5),
                    .init(color: Color(hex: violet, alpha: 0.055), location: 1),
                ]),
                startPoint: .zero,
                endPoint: CGPoint(x: radius, y: 0)
            )
        )

        drawFacet(
            context,
            radius: radius,
            points: [
                CGPoint(x: 0.07, y: 0),
                CGPoint(x: 0.24, y: -0.045),
                CGPoint(x: 0.36, y: 0),
                CGPoint(x: 0.24, y: 0.045),
            ],
            colors: [0xB9FCFF, cyan, blue],
            shift: breatheShift * 0.25
        )
        drawFacet(
            context,
            radius: radius,
            points: [
                CGPoint(x: 0.28, y: 0.045),
                CGPoint(x: 0.43, y: -0.062),
                CGPoint(x: 0.58, y: -0.012),
                CGPoint(x: 0.46, y: 0.092),
            ],
            colors: [cyan, 0x33B8FF, blue],
            shift: breatheShift * 0.48
        )
        drawFacet(
            context,
            radius: radius,
            points: [
                CGPoint(x: 0.45, y: -0.105),
                CGPoint(x: 0.63, y: -0.145),
                CGPoint(x: 0.79, y: -0.052),
                CGPoint(x: 0.61, y: 0.012),
            ],
            colors: [0x31DFFF, blue, violet],
            shift: breatheShift * 0.72
        )
        drawFacet(
            context,
            radius: radius,
            points: [
                CGPoint(x: 0.65, y: 0.045),
                CGPoint(x: 0.82, y: 0.015),
                CGPoint(x: 0.98, y: 0.12),
                CGPoint(x: 0.82, y: 0.19),
            ],
            colors: [blue, 0x22B8FF, cyan],
            shift: breatheShift
        )
        drawFacet(
            context,
            radius: radius,
            points: [
                CGPoint(x: 0.76, y: -0.19),
                CGPoint(x: 0.88, y: -0.22),
                CGPoint(x: 0.98, y: -0.13),
                CGPoint(x: 0.86, y: -0.085),
            ],
            colors: [0x49F4FF, blue, 0x6C5CFF],
            shift: breatheShift
        )

        drawDataStreams(&context, radius: radius, time: time, breath: breath)
    }

    private static func drawFacet(
        _ context: GraphicsContext,
        radius: CGFloat,
        points: [CGPoint],
        colors: [UInt32],
        shift: CGFloat
    ) {
        guard let first = points.first else { return }
        var facet = Path()
        facet.move(to: CGPoint(x: first.x * radius + shift, y: first.y * radius))
        for point in points.dropFirst() {
            facet.addLine(to: CGPoint(
                x: point.x * radius + shift,
                y: point.y * radius
            ))
        }
        facet.closeSubpath()

        let minX = points.map(\.x).min() ?? 0
        let maxX = points.map(\.x).max() ?? 1
        context.fill(
            facet,
            with: .linearGradient(
                Gradient(stops: [
                    .init(color: Color(hex: colors[0], alpha: 0.88), location: 0),
                    .init(color: Color(hex: colors[1], alpha: 0.72), location: 0.54),
                    .init(color: Color(hex: colors[2], alpha: 0.56), location: 1),
                ]),
                startPoint: CGPoint(x: minX * radius + shift, y: -radius * 0.12),
                endPoint: CGPoint(x: maxX * radius + shift, y: radius * 0.12)
            )
        )
        context.stroke(
            facet,
            with: .color(Color(hex: cyan, alpha: 0.2)),
            style: StrokeStyle(lineWidth: 4, lineJoin: .round)
        )
        context.stroke(
            facet,
            with: .linearGradient(
                Gradient(colors: [
                    Color.white.opacity(0.78),
                    Color(hex: cyan, alpha: 0.9),
                    Color(hex: blue, alpha: 0.76),
                ]),
                startPoint: CGPoint(x: minX * radius + shift, y: 0),
                endPoint: CGPoint(x: maxX * radius + shift, y: 0)
            ),
            style: StrokeStyle(lineWidth: 0.7, lineJoin: .round)
        )
    }

    /// 粒子沿两条棱镜数据轨道由内向外流动，所有镜片共享相位以保持万花筒秩序。
    private static func drawDataStreams(
        _ context: inout GraphicsContext,
        radius: CGFloat,
        time: Double,
        breath: Double
    ) {
        let tracks: [(CGFloat, CGFloat)] = [(0.082, 0.015), (-0.17, -0.012)]
        for (trackIndex, track) in tracks.enumerated() {
            var rail = Path()
            rail.move(to: CGPoint(x: radius * 0.19, y: radius * track.1))
            rail.addLine(to: CGPoint(x: radius * 0.48, y: radius * track.0 * 0.42))
            rail.addLine(to: CGPoint(x: radius * 0.72, y: radius * track.0 * 0.74))
            rail.addLine(to: CGPoint(x: radius * 0.98, y: radius * track.0))
            context.stroke(
                rail,
                with: .linearGradient(
                    Gradient(colors: [
                        Color(hex: cyan, alpha: 0.12),
                        Color(hex: cyan, alpha: 0.55),
                        Color(hex: blue, alpha: 0.32),
                    ]),
                    startPoint: CGPoint(x: radius * 0.18, y: 0),
                    endPoint: CGPoint(x: radius, y: 0)
                ),
                style: StrokeStyle(lineWidth: 0.55, lineCap: .round)
            )

            for particleIndex in 0..<6 {
                let phase = Double(particleIndex) / 6
                let speed = trackIndex == 0 ? 0.24 : 0.19
                let progress = (time * speed + phase).truncatingRemainder(dividingBy: 1)
                let x = radius * CGFloat(0.18 + progress * 0.8)
                let normalizedX = x / radius
                let y = radius * (
                    track.1 + (track.0 - track.1) * normalizedX
                )
                let length = radius * (particleIndex.isMultiple(of: 3) ? 0.045 : 0.024)
                let thickness = radius * (particleIndex.isMultiple(of: 2) ? 0.009 : 0.006)
                let particleColor: UInt32 = particleIndex == 4 ? violet : (
                    particleIndex.isMultiple(of: 2) ? cyan : blue
                )

                context.fill(
                    Path(roundedRect: CGRect(
                        x: x - length / 2,
                        y: y - thickness / 2,
                        width: length,
                        height: thickness
                    ), cornerRadius: thickness / 2),
                    with: .color(Color(hex: particleColor, alpha: 0.94))
                )

                if particleIndex.isMultiple(of: 3) {
                    drawNode(
                        context,
                        center: CGPoint(x: x, y: y),
                        radius: radius * 0.012 * breath,
                        color: particleColor
                    )
                }
            }
        }
    }

    private static func drawNode(
        _ context: GraphicsContext,
        center: CGPoint,
        radius: CGFloat,
        color: UInt32
    ) {
        context.fill(
            Path(ellipseIn: CGRect(
                x: center.x - radius * 2.6,
                y: center.y - radius * 2.6,
                width: radius * 5.2,
                height: radius * 5.2
            )),
            with: .radialGradient(
                Gradient(stops: [
                    .init(color: Color(hex: color, alpha: 0.42), location: 0),
                    .init(color: Color(hex: color, alpha: 0), location: 1),
                ]),
                center: center,
                startRadius: 0,
                endRadius: radius * 2.6
            )
        )
        context.fill(
            Path(ellipseIn: CGRect(
                x: center.x - radius,
                y: center.y - radius,
                width: radius * 2,
                height: radius * 2
            )),
            with: .radialGradient(
                Gradient(colors: [.white, Color(hex: color)]),
                center: center,
                startRadius: 0,
                endRadius: radius
            )
        )
        context.stroke(
            Path(ellipseIn: CGRect(
                x: center.x - radius * 1.55,
                y: center.y - radius * 1.55,
                width: radius * 3.1,
                height: radius * 3.1
            )),
            with: .color(Color(hex: color, alpha: 0.72)),
            lineWidth: 0.7
        )
    }

    private static func drawCore(
        _ context: GraphicsContext,
        center: CGPoint,
        radius: CGFloat,
        time: Double,
        breath: Double
    ) {
        let coreRadius = radius * 0.105 * breath
        context.fill(
            Path(ellipseIn: CGRect(
                x: center.x - coreRadius * 2.9,
                y: center.y - coreRadius * 2.9,
                width: coreRadius * 5.8,
                height: coreRadius * 5.8
            )),
            with: .radialGradient(
                Gradient(stops: [
                    .init(color: Color(hex: cyan, alpha: 0.44), location: 0),
                    .init(color: Color(hex: blue, alpha: 0.2), location: 0.42),
                    .init(color: .clear, location: 1),
                ]),
                center: center,
                startRadius: 0,
                endRadius: coreRadius * 2.9
            )
        )

        for index in 0..<3 {
            let ringRadius = coreRadius * (1.25 + CGFloat(index) * 0.58)
            var ringContext = context
            ringContext.translateBy(x: center.x, y: center.y)
            ringContext.rotate(by: .radians(
                time * (index.isMultiple(of: 2) ? 0.08 : -0.06)
            ))
            ringContext.stroke(
                Path(ellipseIn: CGRect(
                    x: -ringRadius,
                    y: -ringRadius * (index == 1 ? 0.62 : 1),
                    width: ringRadius * 2,
                    height: ringRadius * (index == 1 ? 1.24 : 2)
                )),
                with: .color(Color(
                    hex: index == 2 ? violet : cyan,
                    alpha: index == 2 ? 0.58 : 0.74
                )),
                lineWidth: index == 0 ? 1.2 : 0.65
            )
        }

        context.fill(
            Path(ellipseIn: CGRect(
                x: center.x - coreRadius,
                y: center.y - coreRadius,
                width: coreRadius * 2,
                height: coreRadius * 2
            )),
            with: .radialGradient(
                Gradient(stops: [
                    .init(color: .white, location: 0),
                    .init(color: Color(hex: cyan), location: 0.36),
                    .init(color: Color(hex: blue), location: 0.72),
                    .init(color: Color(hex: violet), location: 1),
                ]),
                center: center,
                startRadius: 0,
                endRadius: coreRadius
            )
        )
    }

    private static func drawOuterNodes(
        _ context: GraphicsContext,
        center: CGPoint,
        radius: CGFloat,
        time: Double
    ) {
        let colors = [cyan, blue, cyan, violet]
        for index in 0..<24 {
            let angle = Double(index) / 24 * .pi * 2 + time * 0.018
            let orbit = radius * (index.isMultiple(of: 2) ? 0.88 : 0.81)
            let point = CGPoint(
                x: center.x + CGFloat(cos(angle)) * orbit,
                y: center.y + CGFloat(sin(angle)) * orbit
            )
            let side: CGFloat = index.isMultiple(of: 5) ? 2.9 : 1.55
            context.fill(
                Path(roundedRect: CGRect(
                    x: point.x - side / 2,
                    y: point.y - side / 2,
                    width: side,
                    height: side
                ), cornerRadius: side * 0.2),
                with: .color(Color(
                    hex: colors[index % colors.count],
                    alpha: 0.92
                ))
            )
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
