import SwiftUI

// MARK: - 共享 UI 组件（与原型样式类对应）

// MARK: 头像

/// 旅人头像（gradient 填充圆角方 / 圆）—— 主页 hero、抽取结果
struct TravelerAvatar: View {
    let initial: String
    let hue: Int
    var size: CGFloat = 52
    var cornerRadius: CGFloat = 999   // 999 = 圆

    var body: some View {
        RoundedRectangle(cornerRadius: min(cornerRadius, size / 2), style: .continuous)
            .fill(Theme.hue(hue).gradient)
            .frame(width: size, height: size)
            .overlay(
                Text(initial)
                    .font(.system(size: size * 0.36, weight: .semibold))
                    .foregroundStyle(.white)
            )
            .overlay(
                RoundedRectangle(cornerRadius: min(cornerRadius, size / 2), style: .continuous)
                    .strokeBorder(.white.opacity(0.18), lineWidth: 1)
            )
    }
}

/// 卡片顶部渐变色带 + 悬挂的小圆头像（社区/对话/抽取卡通用）
struct HueBandHeader: View {
    let initial: String
    let hue: Int
    var bandHeight: CGFloat = 64
    var avatarSize: CGFloat = 40
    var cardColor: Color = Theme.card

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Theme.hue(hue).gradient
                .frame(height: bandHeight)
            Circle()
                .fill(Theme.hue(hue).accent)
                .frame(width: avatarSize, height: avatarSize)
                .overlay(Text(initial).font(.system(size: avatarSize * 0.38, weight: .semibold)).foregroundStyle(.white))
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
                .foregroundStyle(.white)
                .frame(maxWidth: wide ? 230 : .infinity)
                .padding(.vertical, 15)
                .background(Theme.buttonGradient, in: Capsule())
                .shadow(color: Color(hex: 0x4F7DFF, alpha: 0.6), radius: 14, y: 8)
        }
        .buttonStyle(PressScaleStyle())
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.35)
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
