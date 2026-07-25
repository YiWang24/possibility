import SwiftUI

// MARK: - 我的主页 Tab（原型 #scr-me · renderMyProfile）
//
// hero（头像 / 徽章 / 转型条 / 标签 / 编辑）→ 4 tab：动态画像 / 我的故事 / 经验与建议 / 提供服务。

struct MeView: View {
    @Environment(SupabaseService.self) private var supabase
    @State private var store = MyProfileStore()
    @State private var editMode: MeEditMode?
    /// 编辑保存后刷新画像 item（依赖 UserDefaults 的部分）
    @State private var tick = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                PageHeader(eyebrow: "MY PUBLIC PAGE", title: "我的主页")
                hero.padding(.top, 16)
                tabs.padding(.top, 16)
                panel.padding(.top, 16)
            }
            .padding(.horizontal, 22)
            .padding(.top, 20)
            .padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
        .screenBackground()
        .task {
            // 真实优先 + 静默兜底：本地缓存已先渲染，这里拉云端 public_profile 合并刷新
            await store.syncFromRemote(using: supabase)
        }
        .fullScreenCover(item: $editMode, onDismiss: { tick += 1 }) { mode in
            MeEditView(store: store, mode: mode)
        }
    }

    private var profile: MyProfile { store.profile }

    // MARK: Hero（原型 .prof-hero）

    private var hero: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                TravelerAvatar(initial: String(profile.name.prefix(1)), hue: profile.hue, size: 62)
                    .overlay(Circle().strokeBorder(Theme.hue(profile.hue).gradient, lineWidth: 2).padding(-4))
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 8) {
                        Text(profile.name).font(.system(size: 21, weight: .bold)).foregroundStyle(Theme.ink)
                        Text("我的公开主页")
                            .font(.system(size: 9.5, weight: .semibold)).foregroundStyle(Color(hex: 0x8EE7C8))
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Color(hex: 0x3ED9A4, alpha: 0.13), in: Capsule())
                            .overlay(Capsule().strokeBorder(Color(hex: 0x3ED9A4, alpha: 0.4), lineWidth: 1))
                    }
                    Text("\(profile.meta.age) 岁 · \(profile.meta.city)")
                        .font(.system(size: 12)).foregroundStyle(Theme.sub)
                }
                Spacer()
                Button {
                    editMode = .basic
                } label: {
                    Text("✎").font(.system(size: 14))
                        .foregroundStyle(Theme.ink)
                        .frame(width: 34, height: 34)
                        .background(Theme.raised, in: Circle())
                        .overlay(Circle().strokeBorder(Theme.line, lineWidth: 1))
                }
                .buttonStyle(PressScaleStyle())
                .accessibilityLabel("编辑个人资料")
            }

            // 转型条（原型 .prof-transition）
            HStack(spacing: 9) {
                Text(profile.meta.from).foregroundStyle(Theme.sub)
                Text("→").foregroundStyle(Theme.blue)
                Text(profile.meta.to).foregroundStyle(Theme.ink)
            }
            .font(.system(size: 13, weight: .semibold))
            .padding(.horizontal, 14).padding(.vertical, 9)
            .background(Color(hex: 0x5E96FF, alpha: 0.09), in: Capsule())
            .overlay(Capsule().strokeBorder(Color(hex: 0x5E96FF, alpha: 0.28), lineWidth: 1))

            Text("\(profile.meta.years) · \(profile.meta.result)")
                .font(.system(size: 11.5)).foregroundStyle(Theme.faint)

            FlowLayout(spacing: 7) {
                ForEach(profile.tags, id: \.self) { TagPill(text: $0) }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .kaleidoCard()
    }

    // MARK: Tabs（原型 .my-prof-tabs）

    private static let tabItems: [(String, String)] = [
        ("persona", "动态画像"), ("story", "我的故事"), ("advice", "经验与建议"), ("service", "提供服务"),
    ]

    private var tabs: some View {
        HStack(spacing: 7) {
            ForEach(Self.tabItems, id: \.0) { key, label in
                let on = store.tab == key
                Button {
                    withAnimation(.easeOut(duration: 0.2)) { store.tab = key }
                } label: {
                    Text(label)
                        .font(.system(size: 12, weight: on ? .semibold : .regular))
                        .foregroundStyle(on ? .white : Theme.sub)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(on ? AnyShapeStyle(Theme.buttonGradient) : AnyShapeStyle(Theme.raised), in: Capsule())
                        .overlay(Capsule().strokeBorder(on ? Color(hex: 0x6FA5FF, alpha: 0.6) : Theme.line, lineWidth: 1))
                }
                .buttonStyle(PressScaleStyle())
            }
        }
    }

    @ViewBuilder
    private var panel: some View {
        switch store.tab {
        case "story": storyPanel
        case "advice": advicePanel
        case "service": servicePanel
        default: personaPanel
        }
    }

    // MARK: 动态画像 Panel（原型 publicPersonaHTML(isMine)）

    private var personaPanel: some View {
        let _ = tick
        let items = store.visibleItems
        let lifeCards = items.first { $0.key == "life" }?.cards ?? []
        return VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "我的动态画像", trailing: "设置展示", isLink: true) {
                editMode = .persona
            }
            VStack(spacing: 14) {
                ZStack(alignment: .topLeading) {
                    LinearGradient(colors: [Color(hex: 0x080C1A), Color(hex: 0x10162B), Color(hex: 0x080B16)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                    RadialGradient(colors: [Color(hex: 0x5373FF, alpha: 0.22), .clear],
                                   center: UnitPoint(x: 0.5, y: 0.48), startRadius: 0, endRadius: 170)
                    PersonaCanvasView(model: store.personaModel)
                    Text("SYNCED LIVE FORM")
                        .font(.system(size: 8.5, weight: .semibold)).tracking(1.8)
                        .foregroundStyle(Color(hex: 0xDCE8FF))
                        .padding(.horizontal, 9).padding(.vertical, 5)
                        .background(Color(hex: 0x070B18, alpha: 0.54), in: Capsule())
                        .overlay(Capsule().strokeBorder(Color(hex: 0xC6DAFF, alpha: 0.18), lineWidth: 1))
                        .padding(.leading, 14).padding(.top, 13)
                }
                .frame(height: 200)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Color(hex: 0xACC9FF, alpha: 0.12), lineWidth: 1))

                if !lifeCards.isEmpty {
                    VStack(alignment: .leading, spacing: 9) {
                        HStack {
                            Text("我的人生底牌").font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Theme.ink)
                            Spacer()
                            Text("已参与数字形象生成").font(.system(size: 10)).foregroundStyle(Theme.faint)
                        }
                        HStack(spacing: 8) {
                            ForEach(lifeCards, id: \.self) { card in
                                HStack(spacing: 6) {
                                    Text(card.glyph).font(.system(size: 12))
                                    Text(card.name).font(.system(size: 11.5, weight: .medium)).lineLimit(1)
                                }
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity).padding(.vertical, 10)
                                .background(Theme.hue(0).gradient.opacity(0.85), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                            }
                        }
                    }
                    .padding(12)
                    .background(Theme.raised, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }

                if items.isEmpty {
                    Text("目前没有开启公开展示的画像内容")
                        .font(.system(size: 12)).foregroundStyle(Theme.faint)
                        .frame(maxWidth: .infinity).padding(.vertical, 26)
                        .background(Theme.raised, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                } else {
                    HStack(spacing: 10) {
                        GeometryReader { geo in
                            Capsule().fill(Theme.raised)
                                .overlay(alignment: .leading) {
                                    Capsule().fill(Theme.aurora)
                                        .frame(width: geo.size.width * Double(items.count) / 7)
                                }
                        }
                        .frame(height: 5)
                        Text("\(items.count) 项公开").font(.system(size: 11)).foregroundStyle(Theme.sub)
                    }

                    VStack(spacing: 9) {
                        ForEach(items.filter { $0.key != "life" || $0.cards.isEmpty }) { item in
                            HStack(spacing: 12) {
                                Text(item.glyph).font(.system(size: 14))
                                    .frame(width: 32, height: 32)
                                    .background(Color(hex: item.tint, alpha: 0.15), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(item.label).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.ink)
                                    Text(item.value).font(.system(size: 11)).lineLimit(1).foregroundStyle(Theme.sub)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                Text(item.hasResult ? "已公开" : "待完善")
                                    .font(.system(size: 10)).foregroundStyle(item.hasResult ? Color(hex: 0x8EE7C8) : Theme.faint)
                            }
                            .padding(.horizontal, 13).padding(.vertical, 11)
                            .background(Theme.raised, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }

                    Text("动态画像与“认识自己”保持一致；这里展示你在“设置展示”中开启的画像内容。")
                        .font(.system(size: 10.5)).lineSpacing(4).foregroundStyle(Theme.faint)
                }
            }
            .padding(14)
            .kaleidoCard()
        }
    }

    // MARK: 我的故事 Panel

    private var storyPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "我的人生关键轨迹", trailing: "编辑故事", isLink: true) {
                editMode = .story
            }
            MeTimeline(nodes: profile.traj)

            Text("“\(profile.quote)”")
                .font(.system(size: 14, weight: .medium)).italic().lineSpacing(6)
                .foregroundStyle(Color(hex: 0xC9D8FF))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(Color(hex: 0x5E96FF, alpha: 0.08), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color(hex: 0x5E96FF, alpha: 0.24), lineWidth: 1))

            VStack(alignment: .leading, spacing: 9) {
                Text("我的转型故事").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.ink)
                Text(profile.meta.intro).font(.system(size: 12.5)).lineSpacing(6).foregroundStyle(Theme.sub)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .kaleidoCard()

            HStack(spacing: 10) {
                storyFact(value: yearsNumber, label: "真实实践")
                storyFact(value: "\(profile.traj.count)", label: "关键节点")
                storyFact(value: "\(profile.meta.consulted)", label: "已帮助人数")
            }

            VStack(alignment: .leading, spacing: 9) {
                Text("完整故事 · 最难的一关").font(.system(size: 13.5, weight: .bold)).foregroundStyle(Theme.ink)
                Text(profile.meta.full).font(.system(size: 12.5)).lineSpacing(6).foregroundStyle(Theme.sub)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .kaleidoCard()
        }
    }

    private var yearsNumber: String {
        let digits = profile.meta.years.filter(\.isNumber)
        return (digits.isEmpty ? "\(profile.traj.count)" : digits) + " 年"
    }

    private func storyFact(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.aurora)
            Text(label).font(.system(size: 10.5)).foregroundStyle(Theme.faint)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 14)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }

    // MARK: 经验与建议 Panel

    private var advicePanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "我愿意分享的经验", trailing: "编辑建议", isLink: true) {
                editMode = .advice
            }
            if profile.adviceModules.isEmpty {
                emptyNote("还没有公开经验模块，点击“编辑建议”添加第一条内容")
            } else {
                ForEach(Array(profile.adviceModules.enumerated()), id: \.element.id) { index, module in
                    VStack(alignment: .leading, spacing: 9) {
                        Text("经验 \(String(format: "%02d", index + 1))")
                            .font(.system(size: 9.5, weight: .semibold)).tracking(2)
                            .foregroundStyle(Color(hex: 0x9DBCFF))
                        Text(module.title).font(.system(size: 14.5, weight: .bold)).foregroundStyle(Theme.ink)
                        Text(module.content).font(.system(size: 12.5)).lineSpacing(6).foregroundStyle(Theme.sub)
                        if !module.links.isEmpty {
                            FlowLayout(spacing: 7) {
                                ForEach(module.links) { link in
                                    Text("🔗 \(link.label.isEmpty ? "查看相关链接" : link.label)")
                                        .font(.system(size: 11)).foregroundStyle(Theme.blue)
                                        .padding(.horizontal, 10).padding(.vertical, 5)
                                        .background(Color(hex: 0x5E96FF, alpha: 0.1), in: Capsule())
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .kaleidoCard()
                }
            }
        }
    }

    // MARK: 提供服务 Panel

    private var servicePanel: some View {
        let enabled = profile.services.filter(\.enabled)
        return VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "我可以提供的服务", trailing: "编辑服务", isLink: true) {
                editMode = .service
            }
            if enabled.isEmpty {
                emptyNote("暂未公开服务，可以在这里编辑并开启")
            } else {
                ForEach(enabled) { service in
                    VStack(alignment: .leading, spacing: 9) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(service.type).font(.system(size: 10)).tracking(1.4).foregroundStyle(Color(hex: 0x9DBCFF))
                                Text(service.title).font(.system(size: 15.5, weight: .bold)).foregroundStyle(Theme.ink)
                            }
                            Spacer()
                            Text("¥\(service.price)")
                                .font(.system(size: 19, weight: .heavy)).foregroundStyle(Theme.aurora)
                        }
                        Text(service.desc).font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .kaleidoCard()
                }
            }
        }
    }

    private func emptyNote(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12)).foregroundStyle(Theme.faint)
            .frame(maxWidth: .infinity).padding(.vertical, 26)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }
}

// MARK: - 时间轴（原型 .prof-timeline，可展开节点）

struct MeTimeline: View {
    let nodes: [MyProfile.TimelineNode]
    @State private var openIndex = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(nodes.enumerated()), id: \.element.id) { idx, node in
                HStack(alignment: .top, spacing: 0) {
                    VStack(spacing: 0) {
                        Circle().fill(Theme.auroraDeep).frame(width: 15, height: 15)
                            .overlay(Circle().strokeBorder(Color(hex: 0x0B0E17), lineWidth: 3))
                            .overlay(Circle().strokeBorder(Color(hex: 0x8F7BFF, alpha: 0.5), lineWidth: 1).padding(-1))
                        if idx != nodes.count - 1 {
                            Rectangle()
                                .fill(LinearGradient(colors: [Theme.violetSoft, Color(hex: 0x8F7BFF, alpha: 0.08)],
                                                     startPoint: .top, endPoint: .bottom))
                                .frame(width: 1).frame(maxHeight: .infinity)
                        }
                    }
                    .frame(width: 15)
                    .padding(.top, 15)

                    Button {
                        withAnimation(.easeOut(duration: 0.25)) { openIndex = openIndex == idx ? -1 : idx }
                    } label: {
                        VStack(alignment: .leading, spacing: 0) {
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(node.age).font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.blue)
                                    Text(node.t).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.ink)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                Text("›").font(.system(size: 15)).foregroundStyle(Theme.faint)
                                    .rotationEffect(.degrees(openIndex == idx ? 90 : 0))
                            }
                            if openIndex == idx {
                                Text(node.d).font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub)
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
    }
}

#Preview {
    MeView()
        .environment(SupabaseService())
        .environment(ToastCenter())
        .preferredColorScheme(.dark)
}
