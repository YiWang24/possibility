import SwiftUI

// MARK: - 我的主页编辑（原型 #myEditPage · renderMyProfileEditor）
//
// 5 种编辑模式：basic / story / advice / service / persona（展示开关）。
// 编辑基于草稿副本，保存时整体写回（原型 myEditDraft 语义）。

enum MeEditMode: String, Identifiable {
    case basic, story, advice, service, persona
    var id: String { rawValue }

    var title: String {
        switch self {
        case .basic: return "编辑基础资料"
        case .story: return "编辑我的故事"
        case .advice: return "编辑经验与建议"
        case .service: return "编辑提供服务"
        case .persona: return "设置动态画像"
        }
    }

    var subtitle: String {
        switch self {
        case .basic: return "只修改主页名片上的公开信息"
        case .story: return "修改故事内容和人生时间线"
        case .advice: return "自由组合标题、内容与链接"
        case .service: return "设置服务内容、价格和公开状态"
        case .persona: return "选择主页允许公开的画像内容"
        }
    }

    var saveLabel: String {
        switch self {
        case .basic: return "保存基础资料"
        case .story: return "保存故事"
        case .advice: return "保存建议"
        case .service: return "保存服务"
        case .persona: return "保存展示设置"
        }
    }

    var savedToast: String {
        switch self {
        case .basic: return "已保存基础资料"
        case .story: return "已保存故事"
        case .advice: return "已保存建议"
        case .service: return "已保存服务"
        case .persona: return "已保存展示设置"
        }
    }
}

struct MeEditView: View {
    let store: MyProfileStore
    let mode: MeEditMode

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastCenter.self) private var toast

    @State private var draft: MyProfile
    @State private var tagsText: String
    @State private var ageText: String
    @FocusState private var inputFocused: Bool

    init(store: MyProfileStore, mode: MeEditMode) {
        self.store = store
        self.mode = mode
        _draft = State(initialValue: store.profile)
        _tagsText = State(initialValue: store.profile.tags.joined(separator: "，"))
        _ageText = State(initialValue: "\(store.profile.meta.age)")
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    switch mode {
                    case .basic: basicEditor
                    case .story: storyEditor
                    case .advice: adviceEditor
                    case .service: serviceEditor
                    case .persona: personaEditor
                    }
                }
                .padding(.horizontal, 22).padding(.top, 16).padding(.bottom, 30)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background {
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture { inputFocused = false }
            }
            saveBar
        }
        .background(Theme.paper.ignoresSafeArea())
    }

    private var topBar: some View {
        HStack(spacing: 12) {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                    .frame(width: 34, height: 34)
                    .background(Theme.raised, in: Circle())
            }
            .buttonStyle(PressScaleStyle())
            .accessibilityLabel("返回")
            VStack(alignment: .leading, spacing: 2) {
                Text(mode.title).font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink)
                Text(mode.subtitle).font(.system(size: 10.5)).foregroundStyle(Theme.faint)
            }
            Spacer()
        }
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 12)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.line).frame(height: 1) }
        .simultaneousGesture(TapGesture().onEnded { inputFocused = false })
    }

    private var saveBar: some View {
        Button {
            // 中文输入法可能仍有未提交的组合文字。先结束编辑，让系统提交文字，
            // 再在下一轮主线程读取草稿，避免保存到输入前的旧值。
            inputFocused = false
            Task { @MainActor in
                await Task.yield()
                save()
            }
        } label: {
            Text(mode.saveLabel)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 15)
                .background(Theme.buttonGradient, in: Capsule())
                .contentShape(Capsule())
        }
            .buttonStyle(PressScaleStyle())
            .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 14)
            .background(Theme.paper)
            .overlay(alignment: .top) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    private func save() {
        var updated = draft
        if mode == .basic {
            updated.tags = tagsText
                .components(separatedBy: CharacterSet(charactersIn: "，, "))
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
            updated.meta.age = Int(ageText) ?? draft.meta.age
        }
        if mode == .story {
            updated.traj = updated.traj.filter { !$0.t.trimmingCharacters(in: .whitespaces).isEmpty }
        }
        store.save(updated)
        toast.show(mode.savedToast)
        dismiss()
    }

    // MARK: 通用输入

    private func field(_ label: String, text: Binding<String>, axis: Axis = .horizontal) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.system(size: 10.5)).foregroundStyle(Theme.faint)
            TextField("", text: text, axis: axis)
                .font(.system(size: 13.5)).foregroundStyle(Theme.ink).tint(Theme.blue)
                .lineLimit(axis == .vertical ? 3...6 : 1...1)
                .focused($inputFocused)
                .submitLabel(.done)
                .onSubmit { inputFocused = false }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(Theme.raised, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
        }
    }

    private func sectionTitle(_ title: String, note: String) -> some View {
        HStack {
            Text(title).font(.system(size: 13.5, weight: .bold)).foregroundStyle(Theme.ink)
            Spacer()
            Text(note).font(.system(size: 10.5)).foregroundStyle(Theme.faint)
        }
    }

    // MARK: 基础资料

    private var basicEditor: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle("头像色彩", note: "点击切换主页配色")
            HStack(spacing: 12) {
                ForEach(0..<5, id: \.self) { hue in
                    Button {
                        draft.hue = hue
                    } label: {
                        Circle().fill(Theme.hue(hue).gradient)
                            .frame(width: 44, height: 44)
                            .overlay {
                                if draft.hue == hue {
                                    Circle().strokeBorder(.white, lineWidth: 2).padding(-4)
                                }
                            }
                    }
                    .buttonStyle(PressScaleStyle())
                }
            }
            .padding(.bottom, 4)

            sectionTitle("基础信息", note: "显示在主页名片")
            field("昵称", text: $draft.name)
            HStack(spacing: 10) {
                field("年龄", text: $ageText)
                field("所在城市", text: $draft.meta.city)
            }
            HStack(spacing: 10) {
                field("过去身份", text: $draft.meta.from)
                field("现在身份", text: $draft.meta.to)
            }
            field("当前阶段", text: $draft.meta.years)
            field("目前状态", text: $draft.meta.result)
            field("主页标签（用逗号分隔）", text: $tagsText)
        }
    }

    // MARK: 我的故事

    private var storyEditor: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle("我的故事", note: "公开叙事")
            field("故事题记", text: $draft.quote, axis: .vertical)
            field("故事摘要", text: $draft.meta.intro, axis: .vertical)
            field("完整故事", text: $draft.meta.full, axis: .vertical)

            sectionTitle("故事时间线", note: "可增删节点").padding(.top, 6)
            ForEach($draft.traj) { $node in
                VStack(alignment: .leading, spacing: 9) {
                    HStack {
                        field("年龄", text: $node.age).frame(width: 110)
                        Spacer()
                        Button {
                            draft.traj.removeAll { $0.id == node.id }
                        } label: {
                            Text("删除").font(.system(size: 11.5)).foregroundStyle(Color(hex: 0xFF8A8A))
                        }
                        .buttonStyle(.plain)
                    }
                    field("节点标题", text: $node.t)
                    field("节点描述", text: $node.d, axis: .vertical)
                }
                .padding(13)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
            }
            Button("＋ 添加一个人生节点") {
                draft.traj.append(MyProfile.TimelineNode(age: "", t: "", d: ""))
            }
            .font(.system(size: 12.5)).foregroundStyle(Theme.blue)
            .buttonStyle(.plain)
        }
    }

    // MARK: 经验与建议

    private var adviceEditor: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle("经验与建议模块", note: "标题、正文与链接")
            ForEach($draft.adviceModules) { $module in
                VStack(alignment: .leading, spacing: 9) {
                    HStack {
                        Text("模块").font(.system(size: 10.5)).foregroundStyle(Theme.faint)
                        Spacer()
                        Button {
                            draft.adviceModules.removeAll { $0.id == module.id }
                        } label: {
                            Text("删除").font(.system(size: 11.5)).foregroundStyle(Color(hex: 0xFF8A8A))
                        }
                        .buttonStyle(.plain)
                    }
                    field("标题", text: $module.title)
                    field("内容（每行一条）", text: $module.content, axis: .vertical)
                    ForEach($module.links) { $link in
                        HStack(spacing: 8) {
                            field("链接标题", text: $link.label)
                            field("URL", text: $link.url)
                        }
                    }
                    Button("＋ 添加链接") {
                        module.links.append(MyProfile.AdviceModule.Link(label: "", url: ""))
                    }
                    .font(.system(size: 11.5)).foregroundStyle(Theme.blue)
                    .buttonStyle(.plain)
                }
                .padding(13)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
            }
            Button("＋ 新增经验模块") {
                draft.adviceModules.append(MyProfile.AdviceModule(
                    id: UUID().uuidString, title: "", content: "", links: []))
            }
            .font(.system(size: 12.5)).foregroundStyle(Theme.blue)
            .buttonStyle(.plain)
            Text("每个模块都可以独立增删；链接保存后可直接访问。")
                .font(.system(size: 10.5)).foregroundStyle(Theme.faint)
        }
    }

    // MARK: 提供服务

    private var serviceEditor: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle("提供服务", note: "可自定义与开关")
            ForEach($draft.services) { $service in
                VStack(alignment: .leading, spacing: 9) {
                    Toggle(isOn: $service.enabled) {
                        Text(service.type).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.ink)
                    }
                    .tint(Theme.blue)
                    field("服务标题", text: $service.title)
                    HStack(spacing: 10) {
                        field("价格 ¥", text: $service.price).frame(width: 120)
                        field("类型", text: $service.type)
                    }
                    field("服务说明", text: $service.desc, axis: .vertical)
                }
                .padding(13)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
            }
        }
    }

    // MARK: 画像展示开关（原型 visibility-list）

    private var personaEditor: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle("动态画像展示", note: "开启后即在主页展示")
            ForEach(store.allPersonaItems) { item in
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(item.label).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.ink)
                        Text(item.value).font(.system(size: 11)).lineLimit(1).foregroundStyle(Theme.sub)
                    }
                    Spacer()
                    Toggle("", isOn: Binding(
                        get: { draft.visibility[item.key] ?? false },
                        set: { draft.visibility[item.key] = $0 }
                    ))
                    .labelsHidden()
                    .tint(Theme.blue)
                }
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
            }
            Text("原始答案与未开启的画像内容不会出现在主页。")
                .font(.system(size: 10.5)).foregroundStyle(Theme.faint)
        }
    }
}

#Preview {
    MeEditView(store: MyProfileStore(), mode: .basic)
        .environment(ToastCenter())
        .preferredColorScheme(.dark)
}
