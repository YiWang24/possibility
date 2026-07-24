import SwiftUI

// MARK: - 画像驱动的抽象数字形象（原型 dynamicPersona · Canvas 移植）
//
// 由画像快照文本 FNV-1a 哈希 + 关键词计分选出 4 种形态之一：
// 折光晶灵（crystal）/ 共生花灵（bloom）/ 流光翼影（wing）/ 星轨旅者（orbit）。
// mulberry32 种子随机保证同一画像稳定复现；TimelineView 驱动呼吸 / 公转 / 粒子流动。

struct PersonaModel: Equatable {
    enum Form: String { case crystal, bloom, wing, orbit }

    let seed: UInt32
    let filled: Int
    let signature: [String]
    let form: Form
    let hue: Double
    let lobes: Double
    let shapeName: String

    /// 由画像内容构建（对照原型 currentPersonaSnapshot + refreshDynamicPersona）
    static func build(values: [String], signature: [String]) -> PersonaModel {
        let text = (values + signature).joined(separator: "|")
        let seed = fnv1a(text.isEmpty ? "屿岸·持续探索" : text)
        let content = (values + signature).joined(separator: " ")

        func score(_ words: [String]) -> Int {
            words.reduce(0) { $0 + content.components(separatedBy: $1).count - 1 }
        }
        let signals: [(Form, Int, Double, Double, String)] = [
            (.crystal, score(["结构", "有序", "计划", "理性", "思考", "分析", "原则", "边界", "才华", "智商"]), 216, 6, "折光晶灵"),
            (.bloom, score(["共情", "陪伴", "关系", "家庭", "亲情", "朋友", "人际", "真诚", "尊重", "回应", "交流", "支持", "爱", "善良", "信任"]), 286, 7, "共生花灵"),
            (.wing, score(["视觉", "手绘", "创造", "审美", "表达", "自由", "好奇", "喜欢"]), 190, 4, "流光翼影"),
            (.orbit, score(["独处", "探索", "学习", "尝试", "成长", "行动", "勇气", "坚强"]), 248, 5, "星轨旅者"),
        ]
        let top = signals.map(\.1).max() ?? 0
        let candidates = signals.filter { $0.1 == top }
        let pick = candidates[Int(seed) % candidates.count]
        return PersonaModel(
            seed: seed,
            filled: values.count,
            signature: signature,
            form: pick.0,
            hue: pick.2 + Double(Int(seed % 23) - 11),
            lobes: pick.3,
            shapeName: pick.4
        )
    }

    /// FNV-1a 32 位哈希（对照原型 dynamicPersonaHash，UTF-16 码元）
    private static func fnv1a(_ text: String) -> UInt32 {
        var hash: UInt32 = 2166136261
        for unit in text.utf16 {
            hash ^= UInt32(unit)
            hash = hash &* 16777619
        }
        return hash
    }
}

/// mulberry32 种子随机（对照原型 dynamicPersonaRandom；Math.imul = 32 位截断乘法）
private struct Mulberry32 {
    private var state: UInt32
    init(seed: UInt32) { state = seed }
    private static func imul(_ a: UInt32, _ b: UInt32) -> UInt32 {
        UInt32(truncatingIfNeeded: UInt64(a) &* UInt64(b))
    }
    mutating func next() -> Double {
        state = state &+ 0x6D2B79F5
        var t = Self.imul(state ^ (state >> 15), state | 1)
        t = (t &+ Self.imul(t ^ (t >> 7), t | 61)) ^ t
        return Double(t ^ (t >> 14)) / 4294967296
    }
}

/// hsla → Color（原型全程用 hsl 色域）
private func hsla(_ h: Double, _ s: Double, _ l: Double, _ a: Double) -> Color {
    let hue = ((h.truncatingRemainder(dividingBy: 360)) + 360).truncatingRemainder(dividingBy: 360) / 360
    // HSL → HSB
    let brightness = l + s * min(l, 1 - l)
    let saturation = brightness == 0 ? 0 : 2 * (1 - l / brightness)
    return Color(hue: hue, saturation: saturation, brightness: brightness, opacity: a)
}

// MARK: - 画布视图

struct PersonaCanvasView: View {
    let model: PersonaModel

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            // 原型 time 单位为 ms
            let t = reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate * 1000
            Canvas { ctx, size in
                Self.draw(ctx, size: size, model: model, time: t)
            }
        }
        .accessibilityLabel("根据当前画像内容生成的抽象数字形象：\(model.shapeName)")
    }

    // MARK: 绘制（对照原型 drawDynamicPersona，坐标 / 色值照抄）

    private static func draw(_ context: GraphicsContext, size: CGSize, model: PersonaModel, time t: Double) {
        var ctx = context
        let w = size.width, h = size.height
        var rand = Mulberry32(seed: model.seed)
        let cx = w * 0.5, cy = h * 0.48
        let breathe = 1 + sin(t * 0.00105) * 0.035
        let hue = model.hue
        ctx.blendMode = .plusLighter

        // 1. 背景微尘
        for i in 0..<72 {
            let x = rand.next() * w, y = rand.next() * h
            let s = 0.35 + rand.next() * 1.25
            let drift = sin(t * 0.00035 + Double(i)) * 2.5
            let color = hsla(hue + (rand.next() - 0.5) * 75, 0.9, 0.72, 0.1 + rand.next() * 0.34)
            ctx.fill(Path(CGRect(x: x + drift, y: y, width: s, height: s)), with: .color(color))
        }

        // 2. aura 呼吸光晕
        let auraRect = CGRect(x: cx - 92 * breathe, y: cy - 70 * breathe, width: 184 * breathe, height: 140 * breathe)
        ctx.fill(Path(ellipseIn: auraRect), with: .radialGradient(
            Gradient(stops: [
                .init(color: hsla(hue + 28, 1, 0.76, 0.42), location: 0),
                .init(color: hsla(hue, 0.95, 0.57, 0.16), location: 0.42),
                .init(color: hsla(hue - 22, 0.9, 0.42, 0), location: 1),
            ]),
            center: CGPoint(x: cx, y: cy), startRadius: 2, endRadius: 92))

        // 形体填充渐变与描边
        let formShading = GraphicsContext.Shading.radialGradient(
            Gradient(stops: [
                .init(color: Color(red: 247 / 255, green: 250 / 255, blue: 1, opacity: 0.9), location: 0),
                .init(color: hsla(hue + 34, 1, 0.8, 0.72), location: 0.16),
                .init(color: hsla(hue, 0.95, 0.6, 0.28), location: 0.55),
                .init(color: hsla(hue - 24, 0.9, 0.42, 0.04), location: 1),
            ]),
            center: CGPoint(x: cx - 18, y: cy - 24), startRadius: 2, endRadius: 76)
        let strokeColor = hsla(hue + 24, 1, 0.84, 0.66)

        // 3. 形体
        switch model.form {
        case .crystal:
            var path = Path()
            for i in 0..<16 {
                let angle = -Double.pi / 2 + Double(i) * .pi / 8
                let radius = (i % 2 == 1 ? 46.0 : 68.0) * (1 + (i % 4 == 0 ? 0.15 : 0)) * breathe
                let p = CGPoint(x: cx + cos(angle) * radius, y: cy + sin(angle) * radius * 0.86)
                if i == 0 { path.move(to: p) } else { path.addLine(to: p) }
            }
            path.closeSubpath()
            ctx.fill(path, with: formShading)
            ctx.stroke(path, with: .color(strokeColor), lineWidth: 1.15)
            var inner = Path()
            inner.move(to: CGPoint(x: cx, y: cy - 43))
            inner.addLine(to: CGPoint(x: cx + 34, y: cy))
            inner.addLine(to: CGPoint(x: cx, y: cy + 48))
            inner.addLine(to: CGPoint(x: cx - 34, y: cy))
            inner.closeSubpath()
            ctx.stroke(inner, with: .color(hsla(hue + 54, 1, 0.9, 0.48)), lineWidth: 1.15)

        case .bloom:
            for i in 0..<7 {
                var petal = ctx
                petal.translateBy(x: cx, y: cy)
                petal.rotate(by: .radians(Double(i) * .pi * 2 / 7 + t * 0.000035))
                var path = Path()
                path.move(to: CGPoint(x: 0, y: -7))
                path.addCurve(to: CGPoint(x: 0, y: -67 * breathe),
                              control1: CGPoint(x: 20, y: -21), control2: CGPoint(x: 27, y: -53))
                path.addCurve(to: CGPoint(x: 0, y: -7),
                              control1: CGPoint(x: -27, y: -53), control2: CGPoint(x: -20, y: -21))
                path.closeSubpath()
                petal.fill(path, with: .color(hsla(hue + Double(i) * 9, 1, Double(70 + i % 2 * 8) / 100, 0.25)))
                petal.stroke(path, with: .color(strokeColor), lineWidth: 1.15)
            }

        case .wing:
            for side in [-1.0, 1.0] {
                var wing = ctx
                wing.translateBy(x: cx, y: cy)
                wing.scaleBy(x: side, y: 1)
                var path = Path()
                path.move(to: CGPoint(x: 5, y: -28))
                path.addCurve(to: CGPoint(x: 68, y: -20), control1: CGPoint(x: 24, y: -66), control2: CGPoint(x: 72, y: -66))
                path.addCurve(to: CGPoint(x: 12, y: 22), control1: CGPoint(x: 62, y: 8), control2: CGPoint(x: 35, y: 10))
                path.addCurve(to: CGPoint(x: 42, y: 58), control1: CGPoint(x: 37, y: 18), control2: CGPoint(x: 54, y: 38))
                path.addCurve(to: CGPoint(x: 5, y: -28), control1: CGPoint(x: 20, y: 48), control2: CGPoint(x: 9, y: 23))
                path.closeSubpath()
                // 镜像坐标系里用局部渐变（等效原型复用 formGradient 的观感）
                wing.fill(path, with: .radialGradient(
                    Gradient(stops: [
                        .init(color: Color(red: 247 / 255, green: 250 / 255, blue: 1, opacity: 0.9), location: 0),
                        .init(color: hsla(hue + 34, 1, 0.8, 0.72), location: 0.16),
                        .init(color: hsla(hue, 0.95, 0.6, 0.28), location: 0.55),
                        .init(color: hsla(hue - 24, 0.9, 0.42, 0.04), location: 1),
                    ]),
                    center: CGPoint(x: -18, y: -24), startRadius: 2, endRadius: 76))
                wing.stroke(path, with: .color(strokeColor), lineWidth: 1.15)
            }
            let body = Path(ellipseIn: CGRect(x: cx - 10, y: cy - 48 * breathe, width: 20, height: 96 * breathe))
            ctx.fill(body, with: formShading)
            ctx.stroke(body, with: .color(strokeColor), lineWidth: 1.15)

        case .orbit:
            let core = Path(ellipseIn: CGRect(x: cx - 38 * breathe, y: cy - 38 * breathe,
                                              width: 76 * breathe, height: 76 * breathe))
            ctx.fill(core, with: formShading)
            ctx.stroke(core, with: .color(strokeColor), lineWidth: 1.15)
            for i in 0..<3 {
                var orbit = ctx
                orbit.translateBy(x: cx, y: cy)
                orbit.rotate(by: .radians(Double(i) * 0.72 + t * 0.00006))
                let rx = 58.0 + Double(i) * 10, ry = 23.0 + Double(i) * 7
                let ring = Path(ellipseIn: CGRect(x: -rx, y: -ry, width: rx * 2, height: ry * 2))
                orbit.stroke(ring, with: .color(hsla(hue + 18 + Double(i) * 18, 1, 0.82, 0.38 - Double(i) * 0.07)), lineWidth: 1.15)
            }
        }

        // 4. 淡椭圆轨道环
        let orbitCount = 2 + min(4, model.filled)
        for orbit in 0..<orbitCount {
            var ring = ctx
            ring.translateBy(x: cx, y: cy)
            ring.rotate(by: .radians(Double(model.seed % 9) * 0.07 + Double(orbit) * 0.38))
            let rx = 56.0 + Double(orbit) * 13, ry = 31.0 + Double(orbit) * 8
            ring.stroke(Path(ellipseIn: CGRect(x: -rx, y: -ry, width: rx * 2, height: ry * 2)),
                        with: .color(hsla(hue + Double(orbit) * 18, 0.9, 0.7, 0.08 + Double(orbit) * 0.018)),
                        lineWidth: 0.7)
        }

        // 5. 粒子云（沿波瓣边缘）
        let particleCount = 190 + model.filled * 28 + model.signature.count * 18
        for i in 0..<particleCount {
            let angle = Double(i) / Double(particleCount) * .pi * 2
            let layer = 0.32 + rand.next() * 0.78
            let edge = 48 * (1 + 0.25 * sin(model.lobes * angle + Double(model.seed % 17) * 0.11 + t * 0.00022)) * breathe
            let radius = edge * layer + (rand.next() - 0.5) * 9
            let x = cx + cos(angle) * radius * (1.02 + 0.12 * sin(t * 0.0003))
            let y = cy + sin(angle) * radius * 0.78 + (rand.next() - 0.5) * 5
            let s = 0.65 + rand.next() * 2.15 * (0.55 + layer * 0.65)
            let pHue = hue + sin(angle * 2) * 35 + (rand.next() - 0.5) * 18
            let color = hsla(pHue, 0.95, 0.64 + rand.next() * 0.22, 0.24 + layer * 0.62)
            if i % 4 == 0 {
                ctx.fill(Path(CGRect(x: x - s / 2, y: y - s / 2, width: s, height: s)), with: .color(color))
            } else {
                let r = s * 0.42
                ctx.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)), with: .color(color))
            }
        }

        // 6. 核心发光
        let coreR = 42 * breathe
        ctx.fill(Path(ellipseIn: CGRect(x: cx - coreR, y: cy - coreR, width: coreR * 2, height: coreR * 2)),
                 with: .radialGradient(
                    Gradient(stops: [
                        .init(color: hsla(hue + 32, 1, 0.88, 0.82), location: 0),
                        .init(color: hsla(hue, 0.95, 0.66, 0.3), location: 0.26),
                        .init(color: hsla(hue - 18, 0.9, 0.42, 0), location: 1),
                    ]),
                    center: CGPoint(x: cx, y: cy), startRadius: 1, endRadius: 42))

        // 7. 维度节点小方块
        let nodes = max(3, model.filled + model.signature.count)
        for i in 0..<nodes {
            let angle = Double(i) / Double(nodes) * .pi * 2 + t * 0.00016 * (i % 2 == 1 ? 1 : -1) + Double(model.seed % 13)
            let radius = 70.0 + Double(i % 3) * 14
            let x = cx + cos(angle) * radius, y = cy + sin(angle) * radius * 0.55
            ctx.fill(Path(CGRect(x: x - 1.8, y: y - 1.8, width: 3.6, height: 3.6)),
                     with: .color(hsla(hue + Double(i) * 17, 1, 0.78, 0.88)))
        }

        // 8. 底牌高光 + 连心线
        for i in 0..<min(3, model.signature.count) {
            let angle = -Double.pi * 0.9 + Double(i) * .pi * 0.9 + sin(t * 0.00045 + Double(i)) * 0.08
            let radius = 64.0 + Double(i % 2) * 18
            let x = cx + cos(angle) * radius, y = cy + sin(angle) * radius * 0.58
            ctx.fill(Path(ellipseIn: CGRect(x: x - 12, y: y - 12, width: 24, height: 24)),
                     with: .radialGradient(
                        Gradient(stops: [
                            .init(color: hsla(hue + 42 + Double(i) * 24, 1, 0.88, 0.95), location: 0),
                            .init(color: hsla(hue + Double(i) * 24, 0.95, 0.67, 0.48), location: 0.28),
                            .init(color: hsla(hue + Double(i) * 24, 0.95, 0.55, 0), location: 1),
                        ]),
                        center: CGPoint(x: x, y: y), startRadius: 0, endRadius: 12))
            var line = Path()
            line.move(to: CGPoint(x: cx, y: cy))
            line.addLine(to: CGPoint(x: x, y: y))
            ctx.stroke(line, with: .color(hsla(hue + 20 + Double(i) * 24, 1, 0.82, 0.34)), lineWidth: 0.7)
        }
    }
}

// MARK: - 数字形象舞台（原型 .digital-human-stage：背景 + 画布 + 徽标 + caption）

struct PersonaStageView: View {
    let model: PersonaModel
    let userName: String
    /// 3 张人生底牌齐 → 边框高亮（.has-life-cards）
    var hasLifeCards: Bool { model.signature.count >= 3 }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // 舞台背景
            LinearGradient(colors: [Color(hex: 0x080C1A), Color(hex: 0x10162B), Color(hex: 0x080B16)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            RadialGradient(colors: [Color(hex: 0x5373FF, alpha: 0.22), .clear],
                           center: UnitPoint(x: 0.5, y: 0.48), startRadius: 0, endRadius: 170)
            RadialGradient(colors: [Color(hex: 0xE35CC1, alpha: 0.12), .clear],
                           center: UnitPoint(x: 0.3, y: 0.8), startRadius: 0, endRadius: 135)

            PersonaCanvasView(model: model)

            // 底部压暗（caption 可读性）
            LinearGradient(stops: [
                .init(color: .clear, location: 0.38),
                .init(color: Color(hex: 0x070A14, alpha: 0.07), location: 0.62),
                .init(color: Color(hex: 0x070912, alpha: 0.88), location: 1),
            ], startPoint: .top, endPoint: .bottom)

            // LIVE 徽标
            HStack(spacing: 6) {
                Circle().fill(Theme.teal).frame(width: 5, height: 5)
                    .modifier(BreatheModifier(enabled: true))
                Text("LIVE PROFILE FORM")
                    .font(.system(size: 8.5, weight: .semibold)).tracking(1.8)
            }
            .foregroundStyle(Color(hex: 0xDCE8FF))
            .padding(.horizontal, 9).padding(.vertical, 5)
            .background(Color(hex: 0x070B18, alpha: 0.54), in: Capsule())
            .overlay(Capsule().strokeBorder(Color(hex: 0xC6DAFF, alpha: 0.18), lineWidth: 1))
            .padding(.leading, 15).padding(.top, 14)
        }
        .frame(height: 216)
        .overlay(alignment: .bottomLeading) { caption }
        .overlay {
            // inset 描边（.digital-human-stage::after）
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(hasLifeCards ? Color(hex: 0xAEAEFF, alpha: 0.22) : Color(hex: 0xACC9FF, alpha: 0.12), lineWidth: 1)
                .shadow(color: Color(hex: 0x5E96FF, alpha: hasLifeCards ? 0.13 : 0.08), radius: 15)
                .padding(10)
        }
        .clipped()
    }

    private var caption: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("\(userName) · 动态数字形象")
                .font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Theme.ink)
            Text(metaText)
                .font(.system(size: 9.5)).foregroundStyle(Theme.faint)
        }
        .padding(.leading, 16).padding(.bottom, 14)
    }

    private var metaText: String {
        let count = model.filled + model.signature.count
        return count > 0
            ? "\(model.shapeName) · 根据下方 \(count) 组画像内容生成"
            : "由当前画像维度生成 · 持续生长"
    }
}
