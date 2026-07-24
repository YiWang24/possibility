import SwiftUI

// MARK: - 02 人生实验室（原型 scr-lab）
// 时间旋钮 + 拖选择卡进转盘 → 推演三种未来。

struct LabView: View {
    @Environment(SupabaseService.self) private var supabase
    @Environment(ToastCenter.self) private var toast
    @Environment(AppRouter.self) private var router
    @State private var model = LabModel()

    // 拖拽选择卡状态（客户端 UI 状态）
    @State private var draggingChoice: LabModel.Choice?
    @State private var dragPoint: CGPoint = .zero
    @State private var isHotDial = false
    @State private var dialFrame: CGRect = .zero
    /// 扇形牌堆：入场时从堆叠展开（原型 .choices:hover / .fanned）
    @State private var fanned = false
    /// 最近点过的卡（原型 .front-card：上浮 -9px + scale 1.035）
    @State private var frontCard: String?
    /// 自定义选择编辑器（原型 .custom-choice-editor）
    @State private var showCustomEditor = false
    @State private var customName = ""
    @State private var customDesc = ""

    private let space = "lab"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                PageHeader(eyebrow: "LIFE LAB", title: "人生实验室")
                questionCard.padding(.top, 18)
                dialArea.padding(.top, 30)
                presets.padding(.top, 18)
                Text("拖动旋钮，1 – 10 年任意停留")
                    .font(.system(size: 11)).tracking(1).foregroundStyle(Theme.faint)
                    .frame(maxWidth: .infinity).padding(.top, 12)
                choicesSection.padding(.top, 24)
                carrySection.padding(.top, 24)
                PrimaryButton(title: "开始推演", wide: true, enabled: model.canSim) {
                    Task { await model.runSim(supabase: supabase) }
                }
                .padding(.top, 26)
                disclaimer.padding(.top, 14)
            }
            .padding(.horizontal, 22).padding(.top, 20).padding(.bottom, 44)
        }
        .scrollIndicators(.hidden)
        .coordinateSpace(name: space)
        // Task { @MainActor } 包裹：兼容 Swift 6 严格模式下 onPreferenceChange 闭包的 @Sendable 化
        .onPreferenceChange(DialFrameKey.self) { value in
            Task { @MainActor in dialFrame = value }
        }
        .overlay(alignment: .topLeading) { dragGhost }
        .screenBackground()
        .sensoryFeedback(.success, trigger: model.pick)
        .overlay { if model.loading { SimLoadingOverlay(name: model.pick ?? "", step: model.loadStep) } }
        .fullScreenCover(item: $model.result) { ResultView(data: $0) }
        .onAppear { consumePendingQuestion() }
        .onChange(of: router.pendingLabQuestion) { consumePendingQuestion() }
    }

    /// 消费对话「去人生实验室」带来的问题
    private func consumePendingQuestion() {
        guard let q = router.pendingLabQuestion else { return }
        router.pendingLabQuestion = nil
        model.question = q
    }

    // MARK: 问题卡

    private var questionCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("当前探索问题").font(.system(size: 11)).tracking(2.5).foregroundStyle(Theme.faint)
            Text(model.question).font(.system(size: 16.5, weight: .bold)).lineSpacing(5)
                .foregroundStyle(Theme.ink).padding(.top, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
            if model.editing {
                editor.padding(.top, 12)
            } else {
                HStack {
                    Spacer()
                    Button("更换问题 ›") { model.beginEdit() }
                        .font(.system(size: 12)).foregroundStyle(Theme.blue).buttonStyle(.plain)
                }
                .padding(.top, 10)
            }
        }
        .padding(.horizontal, 20).padding(.vertical, 18)
        .kaleidoCard()
    }

    private var editor: some View {
        VStack(spacing: 10) {
            TextField("", text: $model.draft, axis: .vertical)
                .font(.system(size: 14)).lineSpacing(3).foregroundStyle(Theme.ink).tint(Theme.blue)
                .lineLimit(2...4)
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(Color(hex: 0x060810, alpha: 0.5), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.4), lineWidth: 1))
            HStack {
                Spacer()
                Button("取消") { model.editing = false }
                    .font(.system(size: 12.5)).foregroundStyle(Theme.faint).buttonStyle(.plain)
                Button("确定") { model.saveEdit() }
                    .font(.system(size: 12.5, weight: .semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 20).padding(.vertical, 8)
                    .background(Theme.buttonGradient, in: Capsule()).buttonStyle(.plain)
            }
        }
    }

    // MARK: 转盘

    private var dialArea: some View {
        DialView(year: $model.year, pick: model.pick, isHot: isHotDial)
            .frame(maxWidth: .infinity)
            .background(
                GeometryReader { geo in
                    Color.clear.preference(key: DialFrameKey.self, value: geo.frame(in: .named(space)))
                }
            )
    }

    private var presets: some View {
        HStack(spacing: 8) {
            ForEach([1, 3, 5, 10], id: \.self) { y in
                Button {
                    withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) { model.year = y }
                } label: {
                    Text("\(y)年").font(.system(size: 12, weight: model.year == y ? .semibold : .regular))
                        .monospacedDigit()
                        .foregroundStyle(model.year == y ? .white : Theme.sub)
                        .padding(.horizontal, 16).padding(.vertical, 8)
                        .background(model.year == y ? AnyShapeStyle(Theme.buttonGradient) : AnyShapeStyle(Theme.raised), in: Capsule())
                        .overlay(Capsule().strokeBorder(model.year == y ? Color(hex: 0x6FA5FF, alpha: 0.6) : Theme.line, lineWidth: 1))
                }
                .buttonStyle(PressScaleStyle())
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: 选择卡（原型 .choices 扇形牌堆：堆叠 → 展开，带弹性过冲）

    /// 牌堆条目：真实选择卡 + 末尾「自定义选择」创建卡
    private enum DeckItem: Identifiable {
        case choice(LabModel.Choice)
        case create
        var id: String {
            switch self {
            case .choice(let c): return c.id
            case .create: return "__create__"
            }
        }
    }

    private var deckItems: [DeckItem] {
        model.choices.map { .choice($0) } + [.create]
    }

    private var choicesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "我的选择卡", trailing: "点选或拖进上方转盘")
            gestureHint
            if showCustomEditor { customEditor }
            choiceDeck
        }
    }

    /// 原型 .choice-gesture-hint
    private var gestureHint: some View {
        HStack(spacing: 6) {
            Text("手势")
                .font(.system(size: 9)).foregroundStyle(Color(hex: 0xD9D0F5))
                .padding(.horizontal, 7).padding(.vertical, 3)
                .background(Color(hex: 0x8F7BFF, alpha: 0.1), in: Capsule())
                .overlay(Capsule().strokeBorder(Color(hex: 0x8F7BFF, alpha: 0.17), lineWidth: 1))
            Text("单击选中").font(.system(size: 9.5)).foregroundStyle(Color(hex: 0xB6BED0))
            Text("·").foregroundStyle(Color(hex: 0x5D6578))
            Text("按住拖入转盘").font(.system(size: 9.5)).foregroundStyle(Color(hex: 0xB6BED0))
            Text("·").foregroundStyle(Color(hex: 0x5D6578))
            Text("长按自定义卡可删除").font(.system(size: 9.5)).foregroundStyle(Color(hex: 0x5D6578))
        }
    }

    /// 原型 layoutChoiceDeck：spread = min(310, max(224, (n-1)*52))，
    /// y = -5 + |norm|^1.35 * 23，rotate = norm * 16deg，弹性 cubic-bezier(.22,1.32,.36,1)
    private var choiceDeck: some View {
        let items = deckItems
        let total = items.count
        let spread = min(310.0, max(224.0, Double(total - 1) * 52))
        let step = total > 1 ? spread / Double(total - 1) : 0
        let center = Double(total - 1) / 2
        return ZStack {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                let distance = Double(index) - center
                let normalized = center > 0 ? distance / center : 0
                deckCard(item)
                    .rotationEffect(.degrees(fanned ? normalized * 16 : 0), anchor: .bottom)
                    .offset(x: fanned ? distance * step : 0,
                            y: fanned ? -5 + pow(abs(normalized), 1.35) * 23 + (frontCard == item.id ? -9 : 0) : 0)
                    .scaleEffect(frontCard == item.id && fanned ? 1.035 : 1)
                    .zIndex(deckZ(item, distance: distance))
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: total > 7 ? 194 : 178)
        .padding(.top, 6)
        .onAppear {
            guard !fanned else { return }
            withAnimation(.spring(response: 0.55, dampingFraction: 0.62).delay(0.25)) { fanned = true }
        }
    }

    private func deckZ(_ item: DeckItem, distance: Double) -> Double {
        if case .choice(let c) = item {
            if draggingChoice?.id == c.id { return 30 }
            if frontCard == c.id { return 28 }
            if model.pick == c.name { return 24 }
        }
        return 20 - abs(distance) * 2
    }

    @ViewBuilder
    private func deckCard(_ item: DeckItem) -> some View {
        switch item {
        case .choice(let choice):
            let isDragging = draggingChoice?.id == choice.id
            ChoiceCardBody(choice: choice, isOn: model.pick == choice.name)
                .opacity(isDragging ? 0.22 : 1)
                .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .onTapGesture {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.65)) {
                        model.pickChoice(choice.name)
                        frontCard = choice.id
                    }
                }
                .contextMenu {
                    if choice.isCustom {
                        Button(role: .destructive) {
                            withAnimation(.spring(response: 0.45, dampingFraction: 0.7)) {
                                model.removeCustomChoice(choice.name)
                            }
                        } label: { Label("删除这张卡", systemImage: "trash") }
                    }
                }
                .gesture(dragGesture(choice))
        case .create:
            createCard
        }
    }

    /// 原型 .choice-create「自定义选择」卡
    private var createCard: some View {
        Button {
            withAnimation(.easeOut(duration: 0.22)) { showCustomEditor.toggle() }
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Text("✍️").font(.system(size: 14))
                    .frame(width: 27, height: 27)
                    .background(Color(hex: 0xE35CC1, alpha: 0.12), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .strokeBorder(Color(hex: 0xE35CC1, alpha: 0.24), lineWidth: 1))
                Text("自定义选择").font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color(hex: 0xE3D9F4)).padding(.top, 10)
                Text("写下真正在考虑的那条路").font(.system(size: 10.5))
                    .foregroundStyle(Color(hex: 0x777F93)).lineSpacing(2).padding(.top, 6)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 13).padding(.vertical, 17)
            .frame(width: 116, height: 148, alignment: .topLeading)
            .background {
                ZStack(alignment: .topTrailing) {
                    Color(hex: 0x131720)
                    RadialGradient(colors: [Color(hex: 0xE35CC1, alpha: 0.15), .clear],
                                   center: UnitPoint(x: 0.82, y: -0.12), startRadius: 0, endRadius: 120)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.white.opacity(0.13), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])))
            .shadow(color: .black.opacity(0.5), radius: 6, y: 3)
        }
        .buttonStyle(.plain)
    }

    /// 原型 .custom-choice-editor
    private var customEditor: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("写一张自己的选择卡").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.ink)
                Spacer()
                Text("名称 ≤18 字 · 描述 ≤42 字").font(.system(size: 9)).foregroundStyle(Theme.faint)
            }
            TextField("", text: $customName,
                      prompt: Text("选择名称，例如：去大厂做 AI").foregroundColor(Theme.faint))
                .font(.system(size: 11.5)).foregroundStyle(Theme.ink).tint(Theme.blue)
                .padding(.horizontal, 11).padding(.vertical, 9)
                .background(Color(hex: 0x060810, alpha: 0.54), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).strokeBorder(Color.white.opacity(0.1), lineWidth: 1))
            TextField("", text: $customDesc,
                      prompt: Text("一句话描述这条路").foregroundColor(Theme.faint), axis: .vertical)
                .font(.system(size: 11.5)).foregroundStyle(Theme.ink).tint(Theme.blue)
                .lineLimit(2...2)
                .padding(.horizontal, 11).padding(.vertical, 9)
                .background(Color(hex: 0x060810, alpha: 0.54), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).strokeBorder(Color.white.opacity(0.1), lineWidth: 1))
            HStack {
                Spacer()
                Button("取消") {
                    withAnimation(.easeOut(duration: 0.2)) { showCustomEditor = false }
                }
                .font(.system(size: 11.5)).foregroundStyle(Theme.faint).buttonStyle(.plain)
                Button("加入牌堆") {
                    if model.addCustomChoice(name: customName, desc: customDesc) {
                        customName = ""; customDesc = ""
                        withAnimation(.spring(response: 0.5, dampingFraction: 0.65)) { showCustomEditor = false }
                        toast.show("已加入你的选择卡")
                    } else {
                        toast.show("名称和描述都要填，且不能重名")
                    }
                }
                .font(.system(size: 11.5, weight: .semibold)).foregroundStyle(.white)
                .padding(.horizontal, 16).padding(.vertical, 7)
                .background(Theme.buttonGradient, in: Capsule())
                .buttonStyle(.plain)
            }
        }
        .padding(13)
        .background(
            LinearGradient(colors: [Color(hex: 0x5E96FF, alpha: 0.08), Color(hex: 0xE35CC1, alpha: 0.055)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 17, style: .continuous)
        )
        .overlay(RoundedRectangle(cornerRadius: 17, style: .continuous)
            .strokeBorder(Color(hex: 0x8FA1FF, alpha: 0.19), lineWidth: 1))
        .transition(.opacity.combined(with: .move(edge: .top)))
    }

    private func dragGesture(_ choice: LabModel.Choice) -> some Gesture {
        DragGesture(minimumDistance: 8, coordinateSpace: .named(space))
            .onChanged { value in
                draggingChoice = choice
                dragPoint = value.location
                isHotDial = overDial(value.location)
            }
            .onEnded { value in
                let hit = overDial(value.location)
                if hit {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) { model.pickChoice(choice.name) }
                    toast.show("「\(choice.name)」已放入实验室")
                }
                draggingChoice = nil
                isHotDial = false
            }
    }

    private func overDial(_ point: CGPoint) -> Bool {
        guard dialFrame != .zero else { return false }
        let center = CGPoint(x: dialFrame.midX, y: dialFrame.midY)
        let dist = hypot(point.x - center.x, point.y - center.y)
        return dist < dialFrame.width / 2 + 30
    }

    @ViewBuilder
    private var dragGhost: some View {
        if let choice = draggingChoice {
            HStack(spacing: 8) {
                Text(choice.emoji)
                Text(choice.name).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.ink)
            }
            .padding(.horizontal, 18).padding(.vertical, 12)
            .background(Color(hex: 0x161A26, alpha: 0.94), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.55), lineWidth: 1.5))
            .shadow(color: Color(hex: 0x4F7DFF, alpha: 0.35), radius: 24)
            .position(dragPoint)
            .allowsHitTesting(false)
            .transition(.scale.combined(with: .opacity))
        }
    }

    // MARK: 底线卡（原型 carry-section）

    private var carrySection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("什么要一起带走？").font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.ink)
                Spacer()
                (Text("\(model.carry.count)").bold().foregroundColor(Theme.blue) + Text("/3").foregroundColor(Theme.faint))
                    .font(.system(size: 12)).monospacedDigit()
            }
            ScrollView(.horizontal) {
                HStack(spacing: 9) {
                    ForEach(LabModel.carryCards) { card in
                        carryCard(card)
                    }
                }
            }
            .scrollIndicators(.hidden)
            .padding(.horizontal, -22)
            .contentMargins(.horizontal, 22, for: .scrollContent)
        }
    }

    private func carryCard(_ card: LabModel.CarryCard) -> some View {
        let on = model.carry.contains(card.id)
        return Button {
            if let message = model.toggleCarry(card.id) { toast.show(message) }
        } label: {
            VStack(alignment: .leading, spacing: 5) {
                Text(card.glyph).font(.system(size: 15)).foregroundStyle(on ? Theme.blue : Theme.sub)
                Text(card.name).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Theme.ink)
                Text(card.source).font(.system(size: 9.5)).foregroundStyle(Theme.faint)
            }
            .frame(width: 96, alignment: .leading)
            .padding(.horizontal, 12).padding(.vertical, 12)
            .background(on ? Color(hex: 0x5E96FF, alpha: 0.1) : Theme.card,
                        in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(on ? Color(hex: 0x6FA5FF, alpha: 0.65) : Theme.line, lineWidth: on ? 1.4 : 1))
        }
        .buttonStyle(PressScaleStyle())
    }

    private var disclaimer: some View {
        Text("推演基于你的动态画像与 1,842 位相似旅人的真实经历\n它不是预言，是一面镜子")
            .font(.system(size: 11)).foregroundStyle(Theme.faint).lineSpacing(4)
            .multilineTextAlignment(.center).frame(maxWidth: .infinity)
    }
}

// MARK: - 选择卡卡面（原型 .choice：116×148 · 虚线边 · 右上光斑 · 选中 ✓）

private struct ChoiceCardBody: View {
    let choice: LabModel.Choice
    let isOn: Bool

    /// 自定义卡右上光斑偏品红（原型 --stamp-glow 交替）
    private var stampGlow: Color {
        choice.isCustom ? Color(hex: 0xE35CC1, alpha: 0.18) : Color(hex: 0x5E96FF, alpha: 0.16)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(choice.emoji).font(.system(size: 19))
            Text(choice.name).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.ink)
                .lineSpacing(3).padding(.top, 10)
            Text(choice.desc).font(.system(size: 10.5)).foregroundStyle(Theme.sub).lineSpacing(2).padding(.top, 6)
                .frame(maxWidth: .infinity, alignment: .leading)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 13).padding(.vertical, 17)
        .frame(width: 116, height: 148, alignment: .topLeading)
        .background {
            ZStack(alignment: .topTrailing) {
                Color(hex: 0x151922)
                RadialGradient(colors: [stampGlow, .clear],
                               center: UnitPoint(x: 0.82, y: -0.12), startRadius: 0, endRadius: 120)
                if isOn {
                    LinearGradient(colors: [Color(hex: 0x5E96FF, alpha: 0.26), Color(hex: 0x8F7BFF, alpha: 0.13)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            if isOn {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.72), lineWidth: 1.5)
            } else {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.2), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
            }
        }
        .overlay(alignment: .topTrailing) {
            if isOn {
                Text("✓").font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 20, height: 20).background(Theme.buttonGradient, in: Circle())
                    .padding(.top, 10).padding(.trailing, 12)
            }
        }
        .shadow(color: isOn ? Color(hex: 0x4F7DFF, alpha: 0.5) : .black.opacity(0.5),
                radius: isOn ? 12 : 6, y: isOn ? 8 : 3)
    }
}

// MARK: - 转盘 frame 偏好（拖拽命中检测）

private struct DialFrameKey: PreferenceKey {
    static let defaultValue: CGRect = .zero
    static func reduce(value: inout CGRect, nextValue: () -> CGRect) {
        let next = nextValue()
        if next != .zero { value = next }
    }
}

// MARK: - 推演加载浮层（原型 .simload）

struct SimLoadingOverlay: View {
    let name: String
    let step: Int

    var body: some View {
        ZStack {
            Color(hex: 0x08090F, alpha: 0.94).ignoresSafeArea()
            VStack(spacing: 22) {
                OrbView(size: 110)
                Text("正在推演 \(name)").font(.system(size: 18, weight: .bold)).foregroundStyle(Theme.ink)
                Text(LabModel.loadSteps[min(step, LabModel.loadSteps.count - 1)])
                    .font(.system(size: 12.5)).foregroundStyle(Theme.sub)
                    .contentTransition(.opacity)
                    .animation(.easeInOut, value: step)
            }
            .padding(40)
        }
        .transition(.opacity)
    }
}

#Preview {
    LabView()
        .environment(SupabaseService())
        .environment(ToastCenter())
        .preferredColorScheme(.dark)
}
