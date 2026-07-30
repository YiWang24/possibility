import SwiftUI
import Foundation

// MARK: - 时间线 Panel（原型 prof-timeline）

struct TimelinePanel: View {
    @Bindable var model: ProfileModel
    @State private var openIndex = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeader(title: "人生关键轨迹", trailing: "点击节点展开详情")
            let nodes = model.traveler?.trajectory ?? []
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(nodes.enumerated()), id: \.offset) { idx, node in
                    TimelineNodeRow(node: node, isLast: idx == nodes.count - 1, open: openIndex == idx) {
                        let expanding = openIndex != idx
                        withAnimation(.easeOut(duration: 0.25)) { openIndex = openIndex == idx ? -1 : idx }
                        // 只在展开时上报，收起不算一次查看；rank 为节点在轨迹中的序号
                        if expanding {
                            Analytics.shared.track(.experienceExpanded(travelerId: model.travelerId, rank: idx))
                        }
                    }
                }
            }
            .padding(.top, 12)
            noteCard.padding(.top, 8)
        }
    }

    private var noteCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("轨迹说明").font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Color(hex: 0xB9CCFF))
            Text("以上节点由本人补充，并结合公开履历完成基础验证。经历只代表个人路径，不构成标准答案。")
                .font(.system(size: 13)).lineSpacing(6).foregroundStyle(Theme.sub)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }
}

private struct TimelineNodeRow: View {
    let node: TrajectoryNode
    let isLast: Bool
    let open: Bool
    var toggle: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            VStack(spacing: 0) {
                Circle().fill(Theme.auroraDeep).frame(width: 15, height: 15)
                    .overlay(Circle().strokeBorder(Color(hex: 0x0B0E17), lineWidth: 3))
                    .overlay(Circle().strokeBorder(Color(hex: 0x8F7BFF, alpha: 0.5), lineWidth: 1).padding(-1))
                if !isLast {
                    Rectangle().fill(LinearGradient(colors: [Theme.violetSoft, Color(hex: 0x8F7BFF, alpha: 0.08)], startPoint: .top, endPoint: .bottom))
                        .frame(width: 1).frame(maxHeight: .infinity)
                }
            }
            .frame(width: 15)
            .padding(.top, 15)

            Button(action: toggle) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(node.age).font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.blue)
                            Text(node.title).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.ink)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        Text("›").font(.system(size: 15)).foregroundStyle(Theme.faint)
                            .rotationEffect(.degrees(open ? 90 : 0))
                    }
                    if open {
                        Text(node.detail).font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub)
                            .padding(.top, 9).frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(15)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .padding(.leading, 15).padding(.bottom, 12)
        }
    }
}

// MARK: - 经验与建议 Panel（原型 prof-advice）

struct AdvicePanel: View {
    @Bindable var model: ProfileModel

    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            SectionHeader(title: "把踩过的坑留给后来人", trailing: "全部可见")
            HStack(spacing: 7) {
                ForEach(AdviceKind.allCases) { kind in
                    ChipToggle(label: kind.label, isOn: model.adviceKind == kind) {
                        withAnimation(.easeOut(duration: 0.2)) { model.adviceKind = kind }
                    }
                }
            }
            adviceCard
        }
    }

    private var adviceCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(model.adviceKind.label.uppercased()).font(.system(size: 10)).tracking(2).foregroundStyle(Theme.blue)
            Text(model.adviceTitle).font(.system(size: 15, weight: .semibold)).lineSpacing(3).foregroundStyle(Theme.ink).padding(.top, 7)

            let tips = model.adviceTips
            VStack(alignment: .leading, spacing: 9) {
                ForEach(Array(tips.enumerated()), id: \.offset) { i, tip in
                    HStack(alignment: .top, spacing: 10) {
                        Text("\(i + 1)").font(.system(size: 10)).foregroundStyle(Theme.teal)
                            .frame(width: 20, height: 20).background(Color(hex: 0x3ED9A4, alpha: 0.12), in: RoundedRectangle(cornerRadius: 7))
                        Text(tip).font(.system(size: 12)).lineSpacing(4).foregroundStyle(Color(hex: 0xC9CFDC))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            .padding(.top, 14)
        }
        .padding(19).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }
}

// MARK: - 可提供服务 Panel（原型 prof-service）

struct ServicePanel: View {
    @Bindable var model: ProfileModel
    let toast: ToastCenter

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(model.services) { service in
                ServiceCard(service: service) { model.checkout = .service(service) }
            }
            howItWorks.padding(.top, 6)
        }
    }

    private var howItWorks: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(Self.steps.enumerated()), id: \.offset) { i, step in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(i + 1)").font(.system(size: 10)).foregroundStyle(Theme.blue)
                        .frame(width: 22, height: 22).background(Color(hex: 0x5E96FF, alpha: 0.13), in: Circle())
                    VStack(alignment: .leading, spacing: 3) {
                        Text(step.0).font(.system(size: 12.5, weight: .medium)).foregroundStyle(Theme.ink)
                        Text(step.1).font(.system(size: 11)).foregroundStyle(Theme.faint)
                    }
                    Spacer()
                }
                .padding(.vertical, 10)
                if i < Self.steps.count - 1 { Divider().overlay(Theme.line) }
            }
        }
        .padding(18)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }

    private static let steps: [(String, String)] = [
        ("确认目标与边界", "先说明你的处境，双方确认服务适合再开始"),
        ("正式沟通 / 交付", "按约定形式进行咨询、交付资料或开始陪跑"),
        ("追问与复盘", "结束后保留一次追问，沉淀可执行的下一步"),
    ]
}

private struct ServiceCard: View {
    let service: TravelerServiceItem
    var action: () -> Void

    private var accent: (bg: [UInt32], border: UInt32) {
        switch service.kind {
        case "materials": ([0x172820, 0x101A17], 0x3ED9A4)
        case "companion": ([0x2B1B2D, 0x17121F], 0xE35CC1)
        default: ([0x151C34, 0x111327], 0x6FA5FF)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 7) {
                    Text(kindLabel.uppercased()).font(.system(size: 10)).tracking(2.5).foregroundStyle(Color(hex: 0x9DBCFF))
                    Text(service.title).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.ink)
                }
                Spacer()
                (Text("¥\(priceText)").font(.system(size: 25, weight: .bold)) + Text(" / \(service.unit)").font(.system(size: 11)).foregroundColor(Theme.sub))
                    .foregroundStyle(.white)
            }
            Text(service.description).font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub)
                .frame(maxWidth: .infinity, alignment: .leading)
            if !service.tags.isEmpty {
                FlowLayout(spacing: 7) {
                    ForEach(service.tags, id: \.self) { tag in
                        Text(tag).font(.system(size: 11)).foregroundStyle(Color(hex: 0xC8CEDD))
                            .padding(.horizontal, 10).padding(.vertical, 7)
                            .background(Color.white.opacity(0.055), in: Capsule())
                    }
                }
            }
            Button(action: action) {
                Text(ctaLabel).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(Theme.buttonGradient, in: Capsule())
            }
            .buttonStyle(PressScaleStyle())
        }
        .padding(21)
        .background(LinearGradient(colors: accent.bg.map { Color(hex: $0) }, startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(Color(hex: accent.border, alpha: 0.28), lineWidth: 1))
    }

    private var priceText: String {
        NSDecimalNumber(decimal: service.price).stringValue
    }
    private var kindLabel: String {
        switch service.kind {
        case "materials": "资料工具包"
        case "companion": "阶段陪跑"
        default: "1 对 1 咨询"
        }
    }
    private var ctaLabel: String {
        switch service.kind {
        case "materials": "购买资料包"
        case "companion": "申请陪跑"
        default: "向 TA 咨询"
        }
    }
}

// MARK: - 锁定块（原型 prof-lock / story-locked）

struct LockedBlock: View {
    let title: String
    let hint: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                VStack(alignment: .leading, spacing: 9) {
                    ForEach(0..<3, id: \.self) { i in
                        Capsule().fill(Theme.sub)
                            .frame(width: [1.0, 0.76, 0.88][i] * 220, height: 8)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .blur(radius: 4).opacity(0.24)

                VStack(spacing: 6) {
                    Image(systemName: "lock.fill").font(.system(size: 15)).foregroundStyle(Theme.blue)
                    Text(title).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink)
                    Text(hint).font(.system(size: 11)).foregroundStyle(Theme.sub).multilineTextAlignment(.center)
                }
            }
            .padding(19).frame(maxWidth: .infinity)
            .background(LinearGradient(colors: [Color(hex: 0x1B1F2B, alpha: 0.96), Color(hex: 0x12151F, alpha: 0.96)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.2), lineWidth: 1))
        }
        .buttonStyle(PressScaleStyle())
    }
}

// MARK: - 底部付费栏（原型 prof-paybar）

struct PayBar: View {
    @Bindable var model: ProfileModel
    let toast: ToastCenter

    var body: some View {
        HStack(spacing: 9) {
            Button { openConsult() } label: {
                HStack(spacing: 8) {
                    Text("向 TA 咨询")
                    Text("¥\(NSDecimalNumber(decimal: model.consultPrice).stringValue)").font(.system(size: 15, weight: .bold))
                }
                .font(.system(size: 12.5, weight: .semibold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).frame(minHeight: 50)
                .background(Theme.buttonGradient, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .shadow(color: Color(hex: 0x4F7DFF, alpha: 0.65), radius: 12, y: 6)
            }
            .buttonStyle(PressScaleStyle())
        }
        .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 8)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    private func openConsult() {
        if let consult = model.services.first(where: { $0.kind == "consult" }) {
            model.checkout = .service(consult)
        } else {
            toast.show("咨询服务加载中")
        }
    }
}
