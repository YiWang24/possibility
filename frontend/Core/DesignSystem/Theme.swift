import SwiftUI
import UIKit

/// 设计系统 · 色板与渐变 —— 与原型 CSS `:root` 变量一一对应。
enum Theme {

    // MARK: - 基础色（--stage / --paper / --card / --raised / --ink / --sub / --faint / --line）

    static let stage  = Color(hex: 0x05070D)
    static let paper  = Color(hex: 0x0A0C12)
    static let card   = Color(hex: 0x13161F)
    static let raised = Color(hex: 0x1B1F2B)
    static let ink    = Color(hex: 0xF2F4F9)
    static let sub    = Color(hex: 0x98A0B3)
    static let faint  = Color(hex: 0x5A6172)
    static let line   = Color.white.opacity(0.08)

    // MARK: - 品牌色

    static let blue       = Color(hex: 0x5E96FF)
    static let blueDeep   = Color(hex: 0x2F63E8)
    static let violetSoft = Color(hex: 0x8F7BFF)
    static let pink       = Color(hex: 0xF06ACD)
    static let magenta    = Color(hex: 0xE35CC1)
    static let orange     = Color(hex: 0xFF7A4D)
    static let apricot    = Color(hex: 0xFFB067)
    static let teal       = Color(hex: 0x3ED9A4)
    static let lime       = Color(hex: 0xD7F464)

    // MARK: - 渐变（--aurora / --aurora-deep / --btn-g）

    /// 极光渐变：135deg, #5E96FF 0% → #8F7BFF 40% → #E35CC1 75% → #FF7A4D 100%
    static let aurora = LinearGradient(
        stops: [
            .init(color: Color(hex: 0x5E96FF), location: 0.00),
            .init(color: Color(hex: 0x8F7BFF), location: 0.40),
            .init(color: Color(hex: 0xE35CC1), location: 0.75),
            .init(color: Color(hex: 0xFF7A4D), location: 1.00),
        ],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )

    static let auroraDeep = LinearGradient(
        stops: [
            .init(color: Color(hex: 0x2F63E8), location: 0.00),
            .init(color: Color(hex: 0xB03390), location: 0.60),
            .init(color: Color(hex: 0xE8542F), location: 1.00),
        ],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )

    /// 主按钮渐变：linear-gradient(135deg,#6FA5FF,#2F63E8)
    static let buttonGradient = LinearGradient(
        colors: [Color(hex: 0x6FA5FF), Color(hex: 0x2F63E8)],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )

    /// 光球/万花筒的 conic 色环：#5E96FF → #8F7BFF → #E35CC1 → #FF7A4D → 回到起点
    static let orbConicColors: [Color] = [
        Color(hex: 0x5E96FF), Color(hex: 0x8F7BFF),
        Color(hex: 0xE35CC1), Color(hex: 0xFF7A4D), Color(hex: 0x5E96FF),
    ]

    // MARK: - 旅人头像配色（原型 HUES 0..4）

    struct Hue: Identifiable {
        let id: Int
        let gradient: LinearGradient
        let accent: Color
    }

    static let hues: [Hue] = [
        Hue(id: 0,
            gradient: LinearGradient(stops: [
                .init(color: Color(hex: 0x0F1F52), location: 0),
                .init(color: Color(hex: 0x2E5EDB), location: 0.55),
                .init(color: Color(hex: 0x6FA5FF), location: 1),
            ], startPoint: .topLeading, endPoint: .bottomTrailing),
            accent: Color(hex: 0x3D6EF0)),
        Hue(id: 1,
            gradient: LinearGradient(stops: [
                .init(color: Color(hex: 0x3A1035), location: 0),
                .init(color: Color(hex: 0xB03390), location: 0.55),
                .init(color: Color(hex: 0xF06ACD), location: 1),
            ], startPoint: .topLeading, endPoint: .bottomTrailing),
            accent: Color(hex: 0xC445A4)),
        Hue(id: 2,
            gradient: LinearGradient(stops: [
                .init(color: Color(hex: 0x0E2A22), location: 0),
                .init(color: Color(hex: 0x1F8A66), location: 0.60),
                .init(color: Color(hex: 0x8FD84B), location: 1),
            ], startPoint: .topLeading, endPoint: .bottomTrailing),
            accent: Color(hex: 0x2FA98C)),
        Hue(id: 3,
            gradient: LinearGradient(stops: [
                .init(color: Color(hex: 0x3A140C), location: 0),
                .init(color: Color(hex: 0xD14A24), location: 0.60),
                .init(color: Color(hex: 0xFF8A54), location: 1),
            ], startPoint: .topLeading, endPoint: .bottomTrailing),
            accent: Color(hex: 0xE85A34)),
        Hue(id: 4,
            gradient: LinearGradient(stops: [
                .init(color: Color(hex: 0x171243), location: 0),
                .init(color: Color(hex: 0x4A3BD1), location: 0.60),
                .init(color: Color(hex: 0x8F7BFF), location: 1),
            ], startPoint: .topLeading, endPoint: .bottomTrailing),
            accent: Color(hex: 0x6E58E8)),
    ]

    static func hue(_ index: Int) -> Hue {
        hues[((index % hues.count) + hues.count) % hues.count]
    }

    // MARK: - 卡面点缀色

    /// LLM 卡的点缀色板。模型返回的 CSS 颜色只当色相提示用，一律吸附到这几档，
    /// 否则一屏扇形卡会出现互不相干的随机彩虹色，正是「模型生成感」的来源之一。
    static let cardAccents: [Color] = [blue, violetSoft, magenta, apricot, teal]

    private static let cardAccentHues: [Double] = cardAccents.map { $0.hsb?.hue ?? 0 }

    /// 把任意颜色吸附到最近的品牌点缀色。
    /// 解析失败、或颜色接近中性灰（没有可用色相）时，按卡片位次轮转取色。
    static func cardAccent(near color: Color?, index: Int) -> Color {
        let rotated = cardAccents[((index % cardAccents.count) + cardAccents.count) % cardAccents.count]
        guard let hsb = color?.hsb, hsb.saturation > 0.15, hsb.brightness > 0.12 else { return rotated }
        let nearest = cardAccentHues.enumerated().min {
            hueDistance($0.element, hsb.hue) < hueDistance($1.element, hsb.hue)
        }
        return nearest.map { cardAccents[$0.offset] } ?? rotated
    }

    /// 色相是环形的：0.98 与 0.02 只差 0.04，不是 0.96。
    private static func hueDistance(_ lhs: Double, _ rhs: Double) -> Double {
        let delta = abs(lhs - rhs)
        return min(delta, 1 - delta)
    }

    // MARK: - 圆角 / 阴影

    enum Radius {
        static let card: CGFloat = 22
        static let sheet: CGFloat = 30
        static let chip: CGFloat = 999
    }
}

// MARK: - Color(hex:)

extension Color {
    /// HSB 分量（均为 0...1）；无法转换时返回 nil。用于把外部颜色吸附到品牌色板。
    var hsb: (hue: Double, saturation: Double, brightness: Double)? {
        var hue: CGFloat = 0, saturation: CGFloat = 0, brightness: CGFloat = 0, alpha: CGFloat = 0
        guard UIColor(self).getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: &alpha)
        else { return nil }
        return (Double(hue), Double(saturation), Double(brightness))
    }

    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

// MARK: - 通用卡片样式

struct CardBackground: ViewModifier {
    var radius: CGFloat = Theme.Radius.card
    func body(content: Content) -> some View {
        content
            .background(Theme.card)
            // 内容（如顶部渐变色带）一并裁进圆角，保证四角一致
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(Theme.line, lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.55), radius: 8, y: 2)
    }
}

extension View {
    func kaleidoCard(radius: CGFloat = Theme.Radius.card) -> some View {
        modifier(CardBackground(radius: radius))
    }
}
