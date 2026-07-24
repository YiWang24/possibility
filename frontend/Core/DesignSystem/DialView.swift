import SwiftUI

// MARK: - 时间旋钮（签名交互）
//
// 原型 `.dial`：拖拽在 240° 扇区内设定 1–10 年（钟表 8 点 → 4 点的区间）。
//   yearToAng(y) = -120 + (y-1)*(240/9)   // year1=-120°(8点) · year10=+120°(4点) · 0°=正上
//   拖拽角 = clamp(atan2(dx, -dy), -120, 120)，正下方死区就近吸附
// conic ring + glowring 随指针臂旋转；刻度每 4.8°，主刻度带年份数字；
// drop-hot：拖拽选择卡悬停时高亮（虚线旋转边框）。触感反馈见 §8.4。

struct DialView: View {
    @Binding var year: Int
    /// 已选择卡名称；nil 显示占位「把选择卡拖进来」
    var pick: String?
    /// 拖拽选择卡悬停高亮
    var isHot: Bool = false
    var size: CGFloat = 260

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dragging = false
    @State private var liveAngle: Double = 0

    private static let yMin = 1, yMax = 10
    /// 表盘扫角：±120°（钟表 8 点 → 4 点）
    private static let sweep: Double = 120
    private static func yearToAngle(_ y: Int) -> Double {
        -sweep + Double(y - yMin) * (2 * sweep / Double(yMax - yMin))
    }
    private static func angleToYear(_ a: Double) -> Int {
        let raw = Double(yMin) + (a + sweep) * (Double(yMax - yMin) / (2 * sweep))
        return min(yMax, max(yMin, Int(raw.rounded())))
    }

    private var armAngle: Double { dragging ? liveAngle : Self.yearToAngle(year) }

    var body: some View {
        ZStack {
            glowRing
            base
            ring
            DialTicks(size: size, currentYear: year)
            arm
            core
            if isHot { dropHotBorder }
        }
        .frame(width: size, height: size)
        .contentShape(Circle())
        .gesture(dragGesture)
        .sensoryFeedback(.selection, trigger: year)
        .accessibilityElement()
        .accessibilityLabel("时间旋钮")
        .accessibilityValue("推演 \(year) 年")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: year = min(Self.yMax, year + 1)
            case .decrement: year = max(Self.yMin, year - 1)
            default: break
            }
        }
    }

    // MARK: - 图层

    private var base: some View {
        Circle()
            .fill(RadialGradient(
                colors: [Color(hex: 0x1E222E), Color(hex: 0x161923), Color(hex: 0x0F1118)],
                center: UnitPoint(x: 0.5, y: 0.42), startRadius: 0, endRadius: size * 0.55
            ))
            .overlay(Circle().strokeBorder(.white.opacity(0.09), lineWidth: 1))
            .shadow(color: .black.opacity(0.5), radius: 8)
    }

    private var ring: some View {
        Circle()
            .strokeBorder(
                AngularGradient(colors: Theme.orbConicColors, center: .center, angle: .degrees(210)),
                lineWidth: 3
            )
            .rotationEffect(.degrees(armAngle))
            .animation(reduceMotion || dragging ? nil : .spring(response: 0.55, dampingFraction: 0.7), value: armAngle)
    }

    private var glowRing: some View {
        Circle()
            .strokeBorder(
                AngularGradient(colors: Theme.orbConicColors, center: .center, angle: .degrees(210)),
                lineWidth: 10
            )
            .blur(radius: 18)
            .opacity(isHot ? 0.9 : 0.55)
            .padding(-14)
            .rotationEffect(.degrees(armAngle))
            .animation(reduceMotion || dragging ? nil : .spring(response: 0.55, dampingFraction: 0.7), value: armAngle)
    }

    private var arm: some View {
        ZStack {
            // 指针杆
            Capsule()
                .fill(LinearGradient(
                    colors: [Color(hex: 0x6FA5FF, alpha: 0.85), Color(hex: 0x6FA5FF, alpha: 0)],
                    startPoint: .top, endPoint: .bottom
                ))
                .frame(width: 2.5, height: 16)
                .offset(y: -(size / 2 - 56 - 12))
            // 把手
            Circle()
                .fill(Color(hex: 0xF2F4F9))
                .frame(width: 16, height: 16)
                .overlay(Circle().fill(Theme.auroraDeep).padding(3.5))
                .overlay(Circle().strokeBorder(.white.opacity(0.15), lineWidth: 3))
                .shadow(color: .black.opacity(0.5), radius: 3, y: 3)
                .offset(y: -(size / 2 - 56 - 8))
        }
        .rotationEffect(.degrees(armAngle))
        .animation(reduceMotion || dragging ? nil : .spring(response: 0.45, dampingFraction: 0.6), value: armAngle)
    }

    private var core: some View {
        VStack(spacing: 8) {
            Text("时间旋钮 · 年")
                .font(.system(size: 10.5)).tracking(3).foregroundStyle(Theme.faint)
            Text(pick ?? "把选择卡拖进来")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(isHot || pick != nil ? Theme.blue : Theme.ink)
                .multilineTextAlignment(.center)
                .contentTransition(.opacity)
                .frame(minHeight: 28)
            (Text("推演 ") + Text("\(year)").font(.system(size: 20, weight: .bold)).foregroundColor(Theme.blue) + Text(" 年后的你"))
                .font(.system(size: 12)).foregroundStyle(Theme.sub)
                .monospacedDigit()
        }
        .padding(.horizontal, 44)
        .frame(width: size, height: size)
        .allowsHitTesting(false)
    }

    private var dropHotBorder: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            let angle = OrbView.angle(timeline.date.timeIntervalSinceReferenceDate, period: 16)
            Circle()
                .strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.55), style: StrokeStyle(lineWidth: 2, dash: [6, 6]))
                .padding(12)
                .rotationEffect(.degrees(angle))
        }
    }

    // MARK: - 拖拽设定年份

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                dragging = true
                let a = clampedAngle(at: value.location)
                liveAngle = a
                let y = Self.angleToYear(a)
                if y != year { year = y }
            }
            .onEnded { _ in
                withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                    dragging = false
                }
            }
    }

    /// 触点 → 表盘角度（0=上，顺时针+），clamp 到 ±120°；正下方死区就近吸附
    private func clampedAngle(at location: CGPoint) -> Double {
        let c = size / 2
        let dx = location.x - c
        let dy = location.y - c
        let deg = atan2(dx, -dy) * 180 / .pi     // -180..180
        return min(Self.sweep, max(-Self.sweep, deg))
    }
}

// MARK: - 刻度环（±120° 弧，主刻度带数字）

private struct DialTicks: View {
    let size: CGFloat
    let currentYear: Int

    /// 与 DialView 一致的扫角
    private static let sweep: Double = 120
    /// 年份间隔角：240/9 ≈ 26.67°
    private static let step: Double = 2 * sweep / 9
    /// 细刻度：每个年份间隔均分 5 段
    private static let minorStep: Double = step / 5

    var body: some View {
        ZStack {
            Canvas { ctx, canvasSize in draw(ctx, canvasSize) }
            ForEach(1...10, id: \.self) { y in
                Text("\(y)")
                    .font(.system(size: 9.5, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(y == currentYear ? .white : Theme.faint)
                    .position(labelPoint(year: y))
            }
        }
        .frame(width: size, height: size)
        .allowsHitTesting(false)
    }

    private func angle(_ y: Int) -> Double { -Self.sweep + Double(y - 1) * Self.step }

    private func labelPoint(year y: Int) -> CGPoint {
        let c = size / 2
        let r = size / 2 - 26
        let rad = angle(y) * .pi / 180
        return CGPoint(x: c + sin(rad) * r, y: c - cos(rad) * r)
    }

    private func draw(_ ctx: GraphicsContext, _ canvasSize: CGSize) {
        let c = CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)
        let rOuter = canvasSize.width / 2 - 8
        var idx = 0
        for a in stride(from: -Self.sweep, through: Self.sweep + 0.01, by: Self.minorStep) {
            let major = idx % 5 == 0
            let len: CGFloat = major ? 12 : 6
            let rad = a * .pi / 180
            let dir = CGPoint(x: sin(rad), y: -cos(rad))
            let p1 = CGPoint(x: c.x + dir.x * rOuter, y: c.y + dir.y * rOuter)
            let p2 = CGPoint(x: c.x + dir.x * (rOuter - len), y: c.y + dir.y * (rOuter - len))
            var path = Path()
            path.move(to: p1)
            path.addLine(to: p2)
            let year = idx / 5 + 1
            let on = major && year == currentYear
            let color = on ? Color.white : Color(hex: 0x9DBCFF, alpha: major ? 0.65 : 0.28)
            ctx.stroke(path, with: .color(color), lineWidth: major ? 2.5 : 1.5)
            idx += 1
        }
    }
}

#Preview {
    struct Demo: View {
        @State private var year = 5
        var body: some View {
            ZStack {
                Theme.stage.ignoresSafeArea()
                DialView(year: $year, pick: "转 AI 产品")
            }
        }
    }
    return Demo().preferredColorScheme(.dark)
}
