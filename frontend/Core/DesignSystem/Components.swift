import SwiftUI

// MARK: - 共享 UI 组件（与原型样式类对应）

// MARK: 头像

/// 旅人头像（gradient 填充圆角方 / 圆）—— 主页 hero、抽取结果
/// imageName 指定资产头像时优先渲染图片，缺失回退 initial + hue 渐变
struct TravelerAvatar: View {
    let initial: String
    let hue: Int
    var size: CGFloat = 52
    var cornerRadius: CGFloat = 999   // 999 = 圆
    var imageName: String? = nil

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: min(cornerRadius, size / 2), style: .continuous)
    }

    var body: some View {
        Group {
            if let imageName, UIImage(named: imageName) != nil {
                Image(imageName)
                    .resizable()
                    .scaledToFill()
                    .frame(width: size, height: size)
                    .clipShape(shape)
            } else {
                shape
                    .fill(Theme.hue(hue).gradient)
                    .frame(width: size, height: size)
                    .overlay(
                        Text(initial)
                            .font(.system(size: size * 0.36, weight: .semibold))
                            .foregroundStyle(.white)
                    )
            }
        }
        .overlay(
            shape.strokeBorder(.white.opacity(0.18), lineWidth: 1)
        )
    }
}

/// mock 数据头像:按 id 稳定映射到 assets 的 avatar-01...16
enum MockAvatar {
    static let count = 16
    static func name(for id: Int) -> String {
        let index = (abs(id) - 1) % count + 1
        return String(format: "avatar-%02d", index)
    }
    static func name(hashing text: String) -> String {
        let index = abs(text.unicodeScalars.reduce(0) { $0 &* 31 &+ Int($1.value) }) % count + 1
        return String(format: "avatar-%02d", index)
    }
}

/// 卡片顶部渐变色带 + 悬挂的小圆头像（社区/对话/抽取卡通用）
struct HueBandHeader: View {
    let initial: String
    let hue: Int
    var bandHeight: CGFloat = 64
    var avatarSize: CGFloat = 40
    var cardColor: Color = Theme.card
    var imageName: String? = nil

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Theme.hue(hue).gradient
                .frame(height: bandHeight)
            Group {
                if let imageName, UIImage(named: imageName) != nil {
                    Image(imageName)
                        .resizable()
                        .scaledToFill()
                        .frame(width: avatarSize, height: avatarSize)
                        .clipShape(Circle())
                } else {
                    Circle()
                        .fill(Theme.hue(hue).accent)
                        .frame(width: avatarSize, height: avatarSize)
                        .overlay(Text(initial).font(.system(size: avatarSize * 0.38, weight: .semibold)).foregroundStyle(.white))
                }
            }
            .overlay(Circle().strokeBorder(cardColor, lineWidth: 3))
            .offset(x: 14, y: avatarSize * 0.4)
        }
    }
}

// MARK: 标签 / chip

/// 小蓝标签（原型 .stag / .prof-tags span）
struct TagPill: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(size: 11))
            .foregroundStyle(Color(hex: 0x9DBCFF))
            .padding(.horizontal, 9).padding(.vertical, 3.5)
            .background(Color(hex: 0x5E96FF, alpha: 0.13), in: Capsule())
            .overlay(Capsule().strokeBorder(Color(hex: 0x5E96FF, alpha: 0.3), lineWidth: 1))
    }
}

/// 可切换 chip（原型 .chip / .advice-chip / .seg）
struct ChipToggle: View {
    let label: String
    let isOn: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 12.5, weight: isOn ? .medium : .regular))
                .foregroundStyle(isOn ? .white : Theme.sub)
                .padding(.horizontal, 15).padding(.vertical, 8)
                .background(isOn ? Theme.blueDeep : Theme.raised, in: Capsule())
                .overlay(Capsule().strokeBorder(isOn ? Color(hex: 0x6FA5FF, alpha: 0.6) : Theme.line, lineWidth: 1))
        }
        .buttonStyle(PressScaleStyle())
    }
}

// MARK: 按钮

/// 主 CTA 按钮（原型 .btn-ink）
struct PrimaryButton: View {
    let title: String
    var wide: Bool = false
    var enabled: Bool = true
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .tracking(wide ? 3 : 0.8)
                .padding(.leading, wide ? 3 : 0)   // 抵消 tracking 在末字后的空隙，文字视觉居中
                .foregroundStyle(.white)
                .frame(maxWidth: wide ? 230 : .infinity)
                .padding(.vertical, 15)
                .background(Theme.buttonGradient, in: Capsule())
                .shadow(color: Color(hex: 0x4F7DFF, alpha: 0.6), radius: 14, y: 8)
        }
        .buttonStyle(PressScaleStyle())
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.35)
        .frame(maxWidth: .infinity)                // 在父容器中水平居中（父级左对齐时也居中）
    }
}

/// 描边幽灵按钮（原型 .btn-ghost）
struct GhostButton: View {
    let title: String
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13)).tracking(0.8)
                .foregroundStyle(Theme.blue)
                .padding(.horizontal, 20).padding(.vertical, 11)
                .overlay(Capsule().strokeBorder(Color(hex: 0x5E96FF, alpha: 0.45), lineWidth: 1.5))
        }
        .buttonStyle(PressScaleStyle())
    }
}

/// 按压缩放样式（原型 :active{transform:scale(.97)}）
struct PressScaleStyle: ButtonStyle {
    var scale: CGFloat = 0.96
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

// MARK: 标题

/// 页眉：eyebrow + 大标题（原型 .eyebrow + h1.page）
struct PageHeader: View {
    let eyebrow: String
    let title: String
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(eyebrow).font(.system(size: 11)).tracking(3.5).foregroundStyle(Theme.faint)
            Text(title).font(.system(size: 27, weight: .bold)).tracking(0.8).foregroundStyle(Theme.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// 分区标题：标题 + 右侧说明/链接（原型 .sec-t）
struct SectionHeader: View {
    let title: String
    var trailing: String? = nil
    var isLink: Bool = false
    var action: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(.system(size: 15, weight: .semibold)).tracking(0.9).foregroundStyle(Theme.ink)
            Spacer()
            if let trailing {
                if let action {
                    Button(trailing, action: action)
                        .font(.system(size: 12))
                        .foregroundStyle(isLink ? Theme.blue : Theme.faint)
                        .buttonStyle(.plain)
                } else {
                    Text(trailing).font(.system(size: 12)).foregroundStyle(Theme.faint)
                }
            }
        }
    }
}

// MARK: 屏幕背景（原型 .screen 的点阵 + 极光径向底）

struct ScreenBackground: View {
    var body: some View {
        ZStack {
            Theme.paper
            RadialGradient(colors: [Color(hex: 0x4A74FF, alpha: 0.16), .clear],
                           center: UnitPoint(x: 1.08, y: -0.05), startRadius: 0, endRadius: 320)
            RadialGradient(colors: [Color(hex: 0xE35CC1, alpha: 0.07), .clear],
                           center: UnitPoint(x: -0.15, y: 0.3), startRadius: 0, endRadius: 260)
        }
        .ignoresSafeArea()
    }
}

extension View {
    /// 统一屏幕底：极光背景 + 暗色
    func screenBackground() -> some View {
        background(ScreenBackground())
    }

    /// 键盘上方「收起」工具栏。
    /// 多行 TextField（axis: .vertical）的回车键用于换行、无法收起键盘，
    /// 给这类输入框挂上本修饰器即可在键盘上方获得一个统一的收起按钮。
    func keyboardDismissToolbar() -> some View {
        toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("收起") { KeyboardHelper.dismiss() }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.blue)
            }
        }
    }
}

/// 全局收起键盘：resign 当前 first responder，无需为每个字段声明 FocusState。
enum KeyboardHelper {
    @MainActor static func dismiss() {
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil
        )
    }
}

// MARK: Toast

/// 轻提示中心（原型 toast()）—— 环境注入，根部 ToastHost 呈现
@Observable
@MainActor
final class ToastCenter {
    private(set) var message: String?
    private var token = 0

    func show(_ text: String) {
        message = text
        token += 1
        let current = token
        Task {
            try? await Task.sleep(for: .seconds(2))
            if current == token { message = nil }
        }
    }
}

/// 根部 toast 呈现层（原型 .toast）
struct ToastHost: View {
    var message: String?
    var body: some View {
        VStack {
            Spacer()
            if let message {
                Text(message)
                    .font(.system(size: 13))
                    .foregroundStyle(Color(hex: 0xCFE0FF))
                    .padding(.horizontal, 22).padding(.vertical, 12)
                    .background(Color(hex: 0x161A26, alpha: 0.95), in: Capsule())
                    .overlay(Capsule().strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.4), lineWidth: 1))
                    .shadow(color: .black.opacity(0.6), radius: 20, y: 8)
                    .padding(.bottom, 150)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: message)
        .allowsHitTesting(false)
    }
}

// MARK: - 熔岩灯（metaball 场，Metal shader）
//
// 参照 lucia-gomez/lava-lamp：逐像素累加 r²/d² 的 metaball 场函数，
// 超过阈值即为熔岩，颜色沿垂直方向双色渐变。blob 相互靠近时场强叠加，
// 未接触就先"隆起"相吸，继而粘连、融合、拉丝 —— 真实熔岩灯的物理观感。
// blob 轨迹用确定性的利萨如参数（竖向为主的慢漂移 + 半径呼吸）。

/// 单个熔岩 blob 的轨迹参数（均为容器尺寸的比例）
struct LavaBlobSpec {
    var baseX: Double        // 基准位置（0..1）
    var baseY: Double
    var ampX: Double         // 漂移振幅（0..1）
    var ampY: Double
    var periodX: Double      // 漂移周期（秒）
    var periodY: Double
    var phase: Double
    var radius: Double       // 半径（相对 min(W,H) 的比例）
    var pulse: Double = 0.18 // 半径呼吸幅度
}

struct LavaLampView: View {
    var specs: [LavaBlobSpec]
    var color1: Color                 // 顶部色
    var color2: Color                 // 底部色
    /// 场阈值：越低越"稠"（blob 显得更大、隔更远就融合）
    var threshold: Double = 0.9
    /// 边缘柔化
    var softness: CGFloat = 1.5

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            let t = reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate
            GeometryReader { geo in
                let w = geo.size.width, h = geo.size.height
                let base = min(w, h)
                let data: [Float] = specs.flatMap { s -> [Float] in
                    let x = s.baseX * w + s.ampX * w * sin(t * 2 * .pi / s.periodX + s.phase)
                    let y = s.baseY * h + s.ampY * h * sin(t * 2 * .pi / s.periodY + s.phase * 1.7)
                    let r = s.radius * base * (1 + s.pulse * sin(t * 2 * .pi / (s.periodY * 0.7) + s.phase * 2.3))
                    return [Float(x), Float(y), Float(r)]
                }
                Rectangle()
                    .fill(.white)
                    .colorEffect(ShaderLibrary.lavaLamp(
                        .float2(Float(w), Float(h)),
                        .floatArray(data),
                        .color(color1),
                        .color(color2),
                        .float(Float(threshold))
                    ))
                    .blur(radius: softness)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

#Preview {
    ZStack {
        ScreenBackground()
        VStack(spacing: 20) {
            PageHeader(eyebrow: "LIFE LAB", title: "人生实验室")
            HStack { TagPill(text: "28 岁转型"); TagPill(text: "设计背景") }
            ChipToggle(label: "职业", isOn: true) {}
            PrimaryButton(title: "开始推演", wide: true) {}
            GhostButton(title: "更换问题") {}
            TravelerAvatar(initial: "可", hue: 0, size: 74, cornerRadius: 26)
        }
        .padding()
    }
    .preferredColorScheme(.dark)
}
