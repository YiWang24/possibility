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

    // MARK: 选择卡

    private var choicesSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "我的选择卡", trailing: "按住卡片，拖进上方实验室")
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 11), GridItem(.flexible(), spacing: 11)], spacing: 11) {
                ForEach(model.choices) { choice in
                    choiceCard(choice)
                }
            }
        }
    }

    private func choiceCard(_ choice: LabModel.Choice) -> some View {
        let on = model.pick == choice.name
        let isDragging = draggingChoice?.id == choice.id
        return ChoiceCardBody(choice: choice, isOn: on)
            .opacity(isDragging ? 0.25 : 1)
            .scaleEffect(isDragging ? 0.96 : 1)
            .contentShape(Rectangle())
            .onTapGesture { withAnimation(.easeOut(duration: 0.18)) { model.pickChoice(choice.name) } }
            .gesture(dragGesture(choice))
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

// MARK: - 选择卡卡面

private struct ChoiceCardBody: View {
    let choice: LabModel.Choice
    let isOn: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(choice.emoji).font(.system(size: 19))
            Text(choice.name).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.ink).padding(.top, 9)
            Text(choice.desc).font(.system(size: 11)).foregroundStyle(Theme.sub).lineSpacing(2).padding(.top, 4)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 15).padding(.top, 18).padding(.bottom, 15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            isOn
                ? AnyShapeStyle(LinearGradient(colors: [Color(hex: 0x5E96FF, alpha: 0.16), Color(hex: 0x8F7BFF, alpha: 0.08)], startPoint: .topLeading, endPoint: .bottomTrailing))
                : AnyShapeStyle(Theme.card),
            in: RoundedRectangle(cornerRadius: 18, style: .continuous)
        )
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(isOn ? Color(hex: 0x6FA5FF, alpha: 0.7) : Theme.line, lineWidth: 1.5))
        .overlay(alignment: .topTrailing) {
            if isOn {
                Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 20, height: 20).background(Theme.buttonGradient, in: Circle())
                    .padding(10)
            }
        }
        .shadow(color: .black.opacity(0.4), radius: 6, y: 2)
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
