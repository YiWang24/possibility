import SwiftUI

// MARK: - 我的主页 Tab（原型 #scr-me · renderMyProfile）
//
// hero（头像 / 徽章 / 转型条 / 标签 / 编辑）→ 4 tab：动态画像 / 我的故事 / 经验与建议 / 提供服务。

struct MeView: View {
    @Environment(SupabaseService.self) private var supabase
    @Environment(ToastCenter.self) private var toast
    @State private var store = MyProfileStore()
    @State private var editMode: MeEditMode?
    /// 编辑保存后刷新画像 item（依赖 UserDefaults 的部分）
    @State private var tick = 0
    /// 编辑公开主页是关键动作：游客先登录（AuthGate 就地弹 LoginSheet）
    @State private var authGate = AuthGateCenter()
    @State private var showDeleteConfirm = false
    @State private var showProfilePrivacy = false
    @State private var accountBusy = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                PageHeader(eyebrow: "MY PUBLIC PAGE", title: "我的主页")
                hero.padding(.top, 16)
                tabs.padding(.top, 16)
                panel.padding(.top, 16)
                accountSection.padding(.top, 24)
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
        .fullScreenCover(isPresented: $showProfilePrivacy, onDismiss: { tick += 1 }) {
            ProfilePrivacyView(store: store)
        }
        .authGate(authGate)
    }

    private var profile: MyProfile { store.profile }

    /// 编辑公开主页统一走登录门控（游客登录成功后继续打开编辑页）
    private func requestEdit(_ mode: MeEditMode) {
        authGate.require(supabase, trigger: .profileEdit) { editMode = mode }
    }

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
                    requestEdit(.basic)
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
        let totalItemCount = store.allPersonaItems.count
        let lifeCards = items.first { $0.key == "life" }?.cards ?? []
        return VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "我的动态画像", trailing: "设置展示", isLink: true) {
                requestEdit(.persona)
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
                                        .frame(width: geo.size.width * CGFloat(items.count) / CGFloat(max(totalItemCount, 1)))
                                }
                        }
                        .frame(height: 5)
                        Text("\(items.count)/\(totalItemCount) 已公开").font(.system(size: 11)).foregroundStyle(Theme.sub)
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
                requestEdit(.story)
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
                requestEdit(.advice)
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
                requestEdit(.service)
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

    // MARK: 账号（登录状态 / 登录 / 退出 / 注销 —— 技术设计文档 §登录系统）

    private var accountStatusText: String {
        if supabase.isAnonymous { return "游客模式" }
        if let phone = supabase.phoneDisplay { return phone }
        if supabase.isAppleLinked { return "Apple 账号" }
        return "已登录"
    }

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "账号")
            VStack(spacing: 0) {
                HStack {
                    Text("登录状态").font(.system(size: 13)).foregroundStyle(Theme.sub)
                    Spacer()
                    Text(accountStatusText)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(supabase.isAnonymous ? Theme.faint : Color(hex: 0x8EE7C8))
                }
                .padding(.horizontal, 16).padding(.vertical, 14)

                Divider().overlay(Theme.line)

                accountRow("个人档案与 AI 隐私", tint: Theme.blue) {
                    showProfilePrivacy = true
                }

                Divider().overlay(Theme.line)

                if supabase.isAnonymous {
                    accountRow("登录 / 注册", tint: Theme.blue) {
                        // 空续接：仅弹登录页；成功后 authStateChanges 刷新状态行。
                        // trigger 传 nil：这是用户主动点「登录/注册」，事件清单的
                        // AuthTrigger 里没有对应取值，不硬塞成 profile_edit 之类。
                        authGate.require(supabase, trigger: nil) {}
                    }
                    HStack(spacing: 6) {
                        Image(systemName: "info.circle").font(.system(size: 10))
                        Text("游客数据保存在本机对应的匿名账号里，登录后自动并入正式账号。")
                    }
                    .font(.system(size: 10.5)).foregroundStyle(Theme.faint)
                    .padding(.horizontal, 16).padding(.bottom, 13)
                } else {
                    accountRow("退出登录", tint: Theme.sub) {
                        guard !accountBusy else { return }
                        accountBusy = true
                        Task {
                            await supabase.signOut()
                            accountBusy = false
                            toast.show("已退出登录，切换为游客模式")
                        }
                    }
                    Divider().overlay(Theme.line)
                    accountRow("注销账号", tint: Theme.orange) {
                        showDeleteConfirm = true
                    }
                }
            }
            .kaleidoCard()
        }
        .confirmationDialog(
            "注销后账号与全部数据将被永久删除，且无法恢复。",
            isPresented: $showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("永久删除我的账号", role: .destructive) {
                guard !accountBusy else { return }
                accountBusy = true
                Task {
                    do {
                        try await supabase.deleteAccount()
                        toast.show("账号已注销")
                    } catch {
                        toast.show("注销失败，请稍后重试")
                    }
                    accountBusy = false
                }
            }
            Button("取消", role: .cancel) {}
        }
    }

    private func accountRow(_ title: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(title).font(.system(size: 13, weight: .semibold)).foregroundStyle(tint)
                Spacer()
                if accountBusy {
                    ProgressView().controlSize(.small).tint(Theme.faint)
                } else {
                    Text("›").font(.system(size: 15)).foregroundStyle(Theme.faint)
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(accountBusy)
    }
}

// MARK: - 个人档案与 AI 隐私

private struct ProfilePrivacyView: View {
    @Environment(SupabaseService.self) private var supabase
    @Environment(ToastCenter.self) private var toast
    @Environment(\.dismiss) private var dismiss

    let store: MyProfileStore

    @State private var snapshot: ProfilePrivacySnapshot?
    @State private var loading = true
    @State private var busy: String?
    @State private var errorText: String?
    @State private var pendingAction: PendingAction?
    @State private var exportDocument: ProfileExportDocument?

    private static let dimensionKeys = [
        "personality", "skill", "like", "love", "family", "social", "life",
    ]
    private static let dimensionLabels = [
        "personality": "人格底色", "skill": "我擅长", "like": "我喜欢",
        "love": "恋爱关系", "family": "家庭关系", "social": "人际交往",
        "life": "人生底牌",
    ]
    private static let sourceLabels = [
        "manual": "本人填写", "assessment": "测评结果", "card_game": "卡牌选择",
        "chat": "探索对话推断", "diary": "日记推断", "legacy": "历史资料",
    ]
    private static let purposeLabels = [
        "persona": "动态 AI 形象", "chat": "探索对话",
        "match": "相似经历匹配", "lab": "人生实验室",
    ]

    private enum PendingAction: Identifiable {
        case dimension(String)
        case revoke
        case clear

        var id: String {
            switch self {
            case let .dimension(value): "dimension:" + value
            case .revoke: "revoke"
            case .clear: "clear"
            }
        }
    }

    private struct ProfileExportDocument: Identifiable {
        let id = UUID()
        let json: String
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                if loading, snapshot == nil {
                    ProgressView("正在读取个人档案…")
                        .foregroundStyle(Theme.sub)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 100)
                } else {
                    VStack(alignment: .leading, spacing: 22) {
                        if let errorText {
                            Text(errorText)
                                .font(.system(size: 11.5))
                                .foregroundStyle(Theme.orange)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(12)
                                .background(
                                    Color(hex: 0xFF7A4D, alpha: 0.1),
                                    in: RoundedRectangle(cornerRadius: 14, style: .continuous)
                                )
                        }
                        factsSection
                        receiptsSection
                        dataSection
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 20)
                }
            }
            .scrollIndicators(.hidden)
            .screenBackground()
            .navigationTitle("个人档案与 AI 隐私")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("关闭") { dismiss() }
                        .foregroundStyle(Theme.blue)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("刷新") { Task { await load() } }
                        .foregroundStyle(Theme.blue)
                        .disabled(loading || busy != nil)
                }
            }
        }
        .task { await load() }
        .confirmationDialog(
            confirmationTitle,
            isPresented: Binding(
                get: { pendingAction != nil },
                set: { if !$0 { pendingAction = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("确认", role: .destructive) {
                guard let action = pendingAction else { return }
                pendingAction = nil
                Task { await run(action) }
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text(confirmationMessage)
        }
        .sheet(item: $exportDocument) { document in
            NavigationStack {
                VStack(alignment: .leading, spacing: 18) {
                    Text("档案已准备完成")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Theme.ink)
                    Text("JSON 包含画像事实、来源、授权与最小化 AI 使用记录。你可以保存到“文件”或发送给自己。")
                        .font(.system(size: 13))
                        .lineSpacing(5)
                        .foregroundStyle(Theme.sub)
                    ShareLink(item: document.json) {
                        Label("分享 / 保存 JSON", systemImage: "square.and.arrow.up")
                            .font(.system(size: 14, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .foregroundStyle(.white)
                            .background(Theme.buttonGradient, in: Capsule())
                    }
                    Spacer()
                }
                .padding(22)
                .screenBackground()
                .navigationTitle("导出个人档案")
                .navigationBarTitleDisplayMode(.inline)
            }
            .presentationDetents([.medium])
        }
    }

    private var groupedFacts: [String: [ProfileFact]] {
        Dictionary(grouping: snapshot?.facts ?? [], by: \.dimension)
    }

    private var factsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("画像事实")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.ink)
                    Text("版本 \(snapshot?.profileRevision ?? 0) · 本人确认与 AI 推断分开保存")
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.faint)
                }
                Spacer()
            }

            if groupedFacts.isEmpty {
                Text("还没有私密画像事实")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.faint)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 28)
                    .kaleidoCard()
            } else {
                ForEach(Self.dimensionKeys.filter { groupedFacts[$0]?.isEmpty == false }, id: \.self) { dimension in
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text(Self.dimensionLabels[dimension] ?? dimension)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(Theme.ink)
                            Spacer()
                            Button("删除整个维度") {
                                pendingAction = .dimension(dimension)
                            }
                            .font(.system(size: 10.5))
                            .foregroundStyle(Theme.orange)
                            .disabled(busy != nil)
                        }

                        ForEach(groupedFacts[dimension] ?? []) { fact in
                            HStack(alignment: .top, spacing: 10) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(fact.value)
                                        .font(.system(size: 12, weight: .medium))
                                        .foregroundStyle(Theme.ink)
                                    Text("\(Self.sourceLabels[fact.source] ?? fact.source) · 置信度 \(Int((fact.confidence * 100).rounded()))%")
                                        .font(.system(size: 9.5))
                                        .foregroundStyle(Theme.faint)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)

                                if fact.userConfirmed {
                                    Text("已确认")
                                        .font(.system(size: 9.5, weight: .semibold))
                                        .foregroundStyle(Color(hex: 0x8EE7C8))
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 5)
                                        .background(Color(hex: 0x3ED9A4, alpha: 0.12), in: Capsule())
                                } else {
                                    Button("确认准确") {
                                        Task { await confirm(fact) }
                                    }
                                    .font(.system(size: 9.5, weight: .semibold))
                                    .foregroundStyle(Theme.blue)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 5)
                                    .background(Color(hex: 0x5E96FF, alpha: 0.12), in: Capsule())
                                    .disabled(busy != nil)
                                }
                            }
                            .padding(11)
                            .background(Theme.raised, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                    }
                    .padding(14)
                    .kaleidoCard()
                }
            }
        }
    }

    private var receiptsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text("最近 AI 使用记录")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.ink)
                Text("只记录用途和维度，不保存发送给模型的原文")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.faint)
            }

            if snapshot?.accessReceipts.isEmpty != false {
                Text("暂无长期画像使用记录")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.faint)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 26)
                    .kaleidoCard()
            } else {
                VStack(spacing: 0) {
                    ForEach(Array((snapshot?.accessReceipts ?? []).prefix(20).enumerated()), id: \.element.id) { index, receipt in
                        VStack(alignment: .leading, spacing: 5) {
                            HStack {
                                Text(Self.purposeLabels[receipt.purpose] ?? receipt.purpose)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(Theme.ink)
                                Spacer()
                                Text(receipt.createdAt.replacingOccurrences(of: "T", with: " ").prefix(16))
                                    .font(.system(size: 9.5))
                                    .foregroundStyle(Theme.faint)
                            }
                            Text("使用：\(receipt.dimensions.map { Self.dimensionLabels[$0] ?? $0 }.joined(separator: "、")) · 版本 \(receipt.profileRevision)")
                                .font(.system(size: 10.5))
                                .foregroundStyle(Theme.sub)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        if index < min((snapshot?.accessReceipts.count ?? 0), 20) - 1 {
                            Divider().overlay(Theme.line)
                        }
                    }
                }
                .kaleidoCard()
            }
        }
    }

    private var dataSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text("数据管理")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.ink)
                Text("公开主页与私密画像相互独立")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.faint)
            }
            VStack(spacing: 0) {
                privacyAction(
                    "导出完整个人档案",
                    detail: "包含事实、来源、授权和使用记录"
                ) {
                    Task { await exportProfile() }
                }
                Divider().overlay(Theme.line)
                privacyAction(
                    "撤回全部 AI 授权",
                    detail: "保留画像，但所有 AI 场景立即停止读取"
                ) {
                    pendingAction = .revoke
                }
                Divider().overlay(Theme.line)
                privacyAction(
                    "清空全部私密画像",
                    detail: "删除事实、卡牌结果和 AI 形象；公开主页保留",
                    destructive: true
                ) {
                    pendingAction = .clear
                }
            }
            .kaleidoCard()
        }
    }

    private func privacyAction(
        _ title: String,
        detail: String,
        destructive: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(destructive ? Theme.orange : Theme.ink)
                    Text(detail)
                        .font(.system(size: 9.5))
                        .foregroundStyle(Theme.faint)
                }
                Spacer()
                if busy != nil {
                    ProgressView().controlSize(.small)
                } else {
                    Text("›").foregroundStyle(Theme.faint)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(busy != nil)
    }

    private var confirmationTitle: String {
        switch pendingAction {
        case .dimension: "删除整个画像维度？"
        case .revoke: "撤回全部 AI 授权？"
        case .clear: "清空全部私密画像？"
        case nil: "确认操作"
        }
    }

    private var confirmationMessage: String {
        switch pendingAction {
        case let .dimension(dimension):
            "将永久删除“\(Self.dimensionLabels[dimension] ?? dimension)”及其来源记录。"
        case .revoke:
            "所有 AI 用途授权都会关闭，但画像事实仍会保留。"
        case .clear:
            "全部私密画像将永久删除；你的公开主页不会受到影响。"
        case nil:
            ""
        }
    }

    @MainActor
    private func load() async {
        loading = true
        errorText = nil
        do {
            snapshot = try await supabase.fetchProfilePrivacy()
        } catch {
            errorText = "暂时无法读取隐私设置，请稍后重试。"
        }
        loading = false
    }

    @MainActor
    private func confirm(_ fact: ProfileFact) async {
        guard let revision = snapshot?.profileRevision else { return }
        busy = "fact:" + fact.id.uuidString
        errorText = nil
        do {
            try await supabase.confirmProfileFact(fact.id, expectedRevision: revision)
            await load()
        } catch {
            errorText = "确认失败，画像可能已在其他设备更新，请刷新后重试。"
        }
        busy = nil
    }

    @MainActor
    private func run(_ action: PendingAction) async {
        guard let revision = snapshot?.profileRevision else { return }
        busy = action.id
        errorText = nil
        do {
            switch action {
            case let .dimension(dimension):
                try await supabase.deleteProfileDimension(dimension, expectedRevision: revision)
                store.clearDimensionCache(dimension)
            case .revoke:
                try await supabase.revokeAllProfileAIPermissions()
                store.applyRevokedAIPermissionsLocally()
            case .clear:
                try await supabase.clearPrivateProfile(expectedRevision: revision)
                store.clearPrivateProfileCache()
            }
            await load()
            toast.show("设置已更新")
        } catch {
            errorText = "操作失败，画像可能已更新；请刷新后重试。"
        }
        busy = nil
    }

    @MainActor
    private func exportProfile() async {
        busy = "export"
        errorText = nil
        do {
            exportDocument = ProfileExportDocument(json: try await supabase.exportProfileData())
        } catch {
            errorText = "导出失败，请稍后重试。"
        }
        busy = nil
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
