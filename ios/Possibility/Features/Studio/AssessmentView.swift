import SwiftUI

// MARK: - 统一测评答题器（原型 #assessmentPage：intro → 逐题 → 结果）

struct AssessmentFlowView: View {
    let kind: AssessmentKind
    /// 结果写入画像（tags 为可写入的关键词组）
    var onSaveToProfile: (AssessmentKind, [String], [Int], [String: Int]) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastCenter.self) private var toast
    @State private var model: AssessmentModel

    init(
        kind: AssessmentKind,
        onSaveToProfile: @escaping (AssessmentKind, [String], [Int], [String: Int]) -> Void
    ) {
        self.kind = kind
        self.onSaveToProfile = onSaveToProfile
        _model = State(initialValue: AssessmentModel(kind: kind))
    }

    var body: some View {
        VStack(spacing: 0) {
            if model.phase == .result {
                AssessmentResultView(model: model, onSave: {
                    onSaveToProfile(
                        kind,
                        model.resultTags,
                        model.answers.compactMap { $0 },
                        model.result?.scores ?? [:]
                    )
                    dismiss()
                }, onBack: { dismiss() })
            } else {
                topBar
                switch model.phase {
                case .intro: intro
                case .questions: questions
                case .result: EmptyView()
                }
            }
        }
        .background(Theme.paper.ignoresSafeArea())
        .onAppear {
            // 已有结果直接进结果页（原型 openAssessmentIntro 分流）
            if model.result != nil { model.phase = .result }
        }
    }

    // MARK: 顶栏 + 进度

    private var topBar: some View {
        HStack(spacing: 12) {
            Button {
                model.persist()
                if model.phase == .questions { toast.show("进度已保留，下次可以继续") }
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                    .frame(width: 34, height: 34)
                    .background(Theme.raised, in: Circle())
            }
            .buttonStyle(PressScaleStyle())
            .accessibilityLabel("退出并保存")

            VStack(alignment: .leading, spacing: 2) {
                Text(model.config.title).font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink)
                Text(model.config.sub).font(.system(size: 10.5)).foregroundStyle(Theme.faint)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 5) {
                Capsule().fill(Theme.raised)
                    .overlay(alignment: .leading) {
                        GeometryReader { geo in
                            Capsule().fill(Theme.aurora)
                                .frame(width: geo.size.width * model.progress)
                                .animation(.easeOut(duration: 0.3), value: model.progress)
                        }
                    }
                    .frame(width: 74, height: 4)
                Text(model.phase == .intro ? "准备开始" : "\(model.index + 1) / \(model.config.items.count)")
                    .font(.system(size: 10)).monospacedDigit().foregroundStyle(Theme.faint)
            }
        }
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 12)
        .background(Theme.paper.opacity(0.92))
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    // MARK: 简介

    private var intro: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text(model.config.kicker)
                        .font(.system(size: 10, weight: .semibold)).tracking(2.4)
                        .foregroundStyle(Color(hex: 0x9DBCFF))
                    Text(model.config.introTitle)
                        .font(.system(size: 24, weight: .bold)).lineSpacing(7)
                        .foregroundStyle(Theme.ink)
                        .padding(.top, 14)
                    Text(model.config.intro)
                        .font(.system(size: 13.5)).lineSpacing(6).foregroundStyle(Theme.sub)
                        .padding(.top, 14)

                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(model.config.notices, id: \.self) { n in
                            HStack(alignment: .top, spacing: 9) {
                                Circle().fill(Theme.blue).frame(width: 4, height: 4).padding(.top, 6)
                                Text(n).font(.system(size: 12)).lineSpacing(3).foregroundStyle(Theme.sub)
                            }
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
                    .padding(.top, 22)
                }
                .padding(.horizontal, 24).padding(.top, 30).padding(.bottom, 30)
            }
            foot(secondary: ("以后再说", { dismiss() }),
                 primary: (model.answeredCount > 0 ? "继续 \(model.answeredCount)/\(model.config.items.count)" : "开始测评",
                           { withAnimation(.easeOut(duration: 0.25)) { model.begin() } }),
                 primaryDisabled: false)
        }
    }

    // MARK: 逐题

    private var questions: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text(model.config.kind == .holland ? "凭第一感觉回答 · 不考能力" : "按照真实状态回答 · 没有正确答案")
                        .font(.system(size: 10, weight: .semibold)).tracking(2)
                        .foregroundStyle(Color(hex: 0x9DBCFF))
                    Text(model.config.items[model.index].text)
                        .font(.system(size: 21, weight: .bold)).lineSpacing(7).foregroundStyle(Theme.ink)
                        .padding(.top, 14)
                        .id(model.index)
                        .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity),
                                                removal: .opacity))

                    likert.padding(.top, 24)

                    Text(model.currentAnswer == nil ? "选择后自动保存" : "✓ 已保存在当前设备")
                        .font(.system(size: 11)).foregroundStyle(Theme.faint)
                        .padding(.top, 16)
                }
                .padding(.horizontal, 24).padding(.top, 28).padding(.bottom, 30)
                .animation(.easeOut(duration: 0.22), value: model.index)
            }
            foot(secondary: ("上一题", { model.previous() }),
                 primary: (model.isLast ? "生成结果" : "下一题", advance),
                 primaryDisabled: model.currentAnswer == nil,
                 secondaryDisabled: model.index == 0)
        }
    }

    private var likert: some View {
        VStack(spacing: 9) {
            ForEach(Array(model.config.likert.enumerated()), id: \.offset) { value, label in
                let on = model.currentAnswer == value
                Button {
                    model.select(value)
                } label: {
                    Text(label)
                        .font(.system(size: 13.5, weight: on ? .semibold : .regular))
                        .foregroundStyle(on ? .white : Theme.sub)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(on ? AnyShapeStyle(Theme.buttonGradient) : AnyShapeStyle(Theme.raised),
                                    in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous)
                            .strokeBorder(on ? Color(hex: 0x6FA5FF, alpha: 0.7) : Theme.line, lineWidth: 1))
                }
                .buttonStyle(PressScaleStyle())
            }
        }
    }

    private func advance() {
        if let message = model.next() { toast.show(message) }
    }

    // MARK: 底部按钮

    private func foot(secondary: (String, () -> Void), primary: (String, () -> Void),
                      primaryDisabled: Bool, secondaryDisabled: Bool = false) -> some View {
        HStack(spacing: 12) {
            Button(secondary.0, action: secondary.1)
                .font(.system(size: 13.5, weight: .medium)).foregroundStyle(Theme.sub)
                .frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(Theme.raised, in: Capsule())
                .buttonStyle(PressScaleStyle())
                .disabled(secondaryDisabled)
                .opacity(secondaryDisabled ? 0.4 : 1)
            Button(primary.0, action: primary.1)
                .font(.system(size: 13.5, weight: .semibold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(Theme.buttonGradient, in: Capsule())
                .buttonStyle(PressScaleStyle())
                .disabled(primaryDisabled)
                .opacity(primaryDisabled ? 0.45 : 1)
        }
        .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 14)
        .background(Theme.paper)
        .overlay(alignment: .top) { Rectangle().fill(Theme.line).frame(height: 1) }
    }
}

// MARK: - 喜欢 × 擅长完整探索

struct SelfDiscoveryView: View {
    enum Phase { case intro, questions, analyzing, result }

    var onSave: ([String], [String]) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastCenter.self) private var toast
    @Environment(SupabaseService.self) private var supabase

    @State private var phase: Phase = .intro
    @State private var index = 0
    @State private var answers: [String: DiscoveryAnswer] = [:]
    @State private var customDraft = ""
    @State private var analysis: SelfDiscoveryAnalysis?
    @State private var usedAI = false
    @State private var saved = false

    private var question: DiscoveryQuestion { SelfDiscoveryData.questions[index] }
    private var current: DiscoveryAnswer { answers[question.id] ?? DiscoveryAnswer() }
    private var canAdvance: Bool {
        !current.selected.isEmpty || !current.custom.isEmpty || !customDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    private var progress: Double {
        switch phase {
        case .intro: return 0
        case .questions: return Double(index + 1) / Double(SelfDiscoveryData.questions.count)
        case .analyzing, .result: return 1
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            switch phase {
            case .intro: intro
            case .questions: questions
            case .analyzing: analyzing
            case .result: result
            }
        }
        .background(Theme.paper.ignoresSafeArea())
    }

    private var topBar: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button(action: back) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                        .frame(width: 34, height: 34).background(Theme.raised, in: Circle())
                }
                .buttonStyle(PressScaleStyle()).accessibilityLabel("退出探索")
                VStack(alignment: .leading, spacing: 2) {
                    Text("喜欢 × 擅长").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink)
                    Text("想做的事探索").font(.system(size: 10.5)).foregroundStyle(Theme.faint)
                }
                Spacer()
                if phase == .questions {
                    Text("\(index + 1)/\(SelfDiscoveryData.questions.count)")
                        .font(.system(size: 10, weight: .medium)).foregroundStyle(Theme.faint)
                }
            }
            .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 10)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Theme.raised
                    Theme.aurora.frame(width: geo.size.width * progress)
                }
            }
            .frame(height: 3)
        }
    }

    private var intro: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("中文原创自我探索")
                    .font(.system(size: 10, weight: .semibold)).tracking(2.2).foregroundStyle(Theme.blue)
                Text("用完整证据链，找到\n你喜欢和擅长的事")
                    .font(.system(size: 28, weight: .bold)).lineSpacing(7).foregroundStyle(Theme.ink).padding(.top, 12)
                Text("沿用“喜欢 × 擅长 × 价值观”的方法结构，通过 12 个原创情境寻找你的注意力、投入、他人反馈与成功模式，最后交给 AI 综合分析。")
                    .font(.system(size: 14)).lineSpacing(7).foregroundStyle(Theme.sub).padding(.top, 16)
                HStack(spacing: 8) {
                    formula("喜欢的事", "反复吸引你的内容领域", 0xE35CC1)
                    formula("擅长的事", "自然复用的行为模式", 0x5E96FF)
                    formula("尝试方向", "结合价值观验证", 0x3ED9A4)
                }
                .padding(.top, 24)
                VStack(alignment: .leading, spacing: 9) {
                    Text("01  每题可选 1–3 项")
                    Text("02  支持补充自己的答案")
                    Text("03  AI 区分兴趣与可复用优势")
                }
                .font(.system(size: 12.5)).foregroundStyle(Theme.sub)
                .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.raised, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .padding(.top, 18)
                Text("题目为方法结构上的产品化原创表达，不复制任何书籍原句。")
                    .font(.system(size: 10.5)).foregroundStyle(Theme.faint).padding(.top, 14)
                primaryButton("开始完整探索 · 约 10 分钟") { phase = .questions }
                    .padding(.top, 24)
            }
            .padding(.horizontal, 24).padding(.top, 30).padding(.bottom, 36)
        }
    }

    private func formula(_ title: String, _ desc: String, _ tint: UInt32) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.ink)
            Text(desc).font(.system(size: 9.5)).foregroundStyle(Theme.sub).lineLimit(2)
        }
        .padding(12).frame(maxWidth: .infinity, minHeight: 88, alignment: .topLeading)
        .background(Color(hex: tint, alpha: 0.18), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color(hex: tint, alpha: 0.35)))
    }

    private var questions: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text(question.eyebrow).font(.system(size: 10, weight: .semibold)).tracking(1.8).foregroundStyle(Theme.blue)
                Text(question.title).font(.system(size: 23, weight: .bold)).lineSpacing(6).foregroundStyle(Theme.ink).padding(.top, 9)
                Text(question.hint).font(.system(size: 12.5)).lineSpacing(5).foregroundStyle(Theme.sub).padding(.top, 8)

                LazyVGrid(columns: [GridItem(.flexible(), spacing: 9), GridItem(.flexible())], spacing: 9) {
                    ForEach(question.options) { option in
                        let selected = current.selected.contains(option.label)
                        Button { toggle(option.label) } label: {
                            HStack(spacing: 9) {
                                Text(selected ? "✓" : option.glyph)
                                    .font(.system(size: 15)).foregroundStyle(Color(hex: 0xBFD2FF))
                                    .frame(width: 30, height: 30).background(Theme.raised, in: RoundedRectangle(cornerRadius: 9))
                                Text(option.label).font(.system(size: 12.5, weight: .medium)).foregroundStyle(Theme.ink)
                                    .frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true)
                            }
                            .padding(11).frame(maxWidth: .infinity, minHeight: 70)
                            .background(selected ? Color(hex: 0x5373FF, alpha: 0.18) : Theme.raised,
                                        in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous)
                                .strokeBorder(selected ? Color(hex: 0x6FA5FF, alpha: 0.72) : Theme.line))
                        }
                        .buttonStyle(PressScaleStyle())
                    }
                }
                .padding(.top, 18)

                VStack(alignment: .leading, spacing: 10) {
                    Text("选项里没有我的答案").font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Theme.ink)
                    TextField("写下真实答案，按回车添加", text: $customDraft)
                        .font(.system(size: 13)).foregroundStyle(Theme.ink).tint(Theme.blue)
                        .padding(.horizontal, 13).padding(.vertical, 12).background(Theme.paper, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.line)).submitLabel(.done).onSubmit(addCustom)
                    if !current.custom.isEmpty {
                        FlowLayout(spacing: 7) {
                            ForEach(current.custom, id: \.self) { value in
                                Button { removeCustom(value) } label: {
                                    Text("\(value)  ×").font(.system(size: 11.5)).foregroundStyle(Color(hex: 0xBFD2FF))
                                        .padding(.horizontal, 11).padding(.vertical, 7)
                                        .background(Color(hex: 0x5E96FF, alpha: 0.12), in: Capsule())
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(14).background(Theme.raised, in: RoundedRectangle(cornerRadius: 16, style: .continuous)).padding(.top, 14)

                HStack(spacing: 11) {
                    secondaryButton("返回") { back() }
                    primaryButton(index == SelfDiscoveryData.questions.count - 1 ? "交给 AI 综合分析" : "继续") { advance() }
                        .disabled(!canAdvance).opacity(canAdvance ? 1 : 0.42)
                }
                .padding(.top, 22)
            }
            .padding(.horizontal, 22).padding(.top, 24).padding(.bottom, 34)
        }
    }

    private var analyzing: some View {
        VStack(spacing: 18) {
            ProgressView().tint(Theme.blue).scaleEffect(1.4)
            Text("AI 正在整理你的证据").font(.system(size: 22, weight: .bold)).foregroundStyle(Theme.ink)
            Text("它会区分“被什么内容吸引”和“习惯怎样行动”，并结合你的自由回答寻找重复线索。")
                .font(.system(size: 13)).lineSpacing(6).multilineTextAlignment(.center).foregroundStyle(Theme.sub)
        }
        .padding(32).frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder private var result: some View {
        if let analysis {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text(usedAI ? "AI 综合分析" : "本地证据归纳")
                        .font(.system(size: 10, weight: .semibold)).tracking(1.8).foregroundStyle(Color(hex: 0x3ED9A4))
                    Text("你反复出现的两组线索").font(.system(size: 25, weight: .bold)).foregroundStyle(Theme.ink).padding(.top, 8)
                    Text(analysis.summary).font(.system(size: 13)).lineSpacing(6).foregroundStyle(Theme.sub).padding(.top, 9)
                    insightBlock("我喜欢的事", analysis.likes, 0xE35CC1).padding(.top, 20)
                    insightBlock("我擅长的事", analysis.strengths, 0x5E96FF).padding(.top, 12)
                    Text("可以开始验证的方向").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.ink).padding(.top, 22)
                    ForEach(analysis.directions) { direction in
                        VStack(alignment: .leading, spacing: 7) {
                            Text(direction.title).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.ink)
                            Text(direction.why).font(.system(size: 11.5)).foregroundStyle(Theme.sub)
                            Text("第一步：\(direction.firstStep)").font(.system(size: 11.5)).foregroundStyle(Color(hex: 0xBFD2FF))
                        }
                        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.raised, in: RoundedRectangle(cornerRadius: 15)).padding(.top, 9)
                    }
                    Text(analysis.confidenceNote).font(.system(size: 10.5)).lineSpacing(4).foregroundStyle(Theme.faint).padding(.top, 15)
                    HStack(spacing: 11) {
                        secondaryButton("返回修改") { phase = .questions; index = SelfDiscoveryData.questions.count - 1 }
                        primaryButton(saved ? "已保存到动态画像" : "保存到我的动态画像") { saveResult() }
                    }
                    .padding(.top, 22)
                }
                .padding(.horizontal, 22).padding(.top, 24).padding(.bottom, 36)
            }
        }
    }

    private func insightBlock(_ title: String, _ items: [DiscoveryInsight], _ tint: UInt32) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.ink)
            ForEach(items) { item in
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.label).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Color(hex: tint))
                    Text("\(item.evidence) · \(item.reason)").font(.system(size: 11)).lineSpacing(4).foregroundStyle(Theme.sub)
                }
            }
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: tint, alpha: 0.09), in: RoundedRectangle(cornerRadius: 17))
        .overlay(RoundedRectangle(cornerRadius: 17).strokeBorder(Color(hex: tint, alpha: 0.24)))
    }

    private func toggle(_ label: String) {
        var answer = current
        if let existing = answer.selected.firstIndex(of: label) {
            answer.selected.remove(at: existing)
        } else if answer.selected.count < 3 {
            answer.selected.append(label)
        } else {
            toast.show("每题最多选择 3 项，也可以补充自己的答案")
        }
        answers[question.id] = answer
    }

    private func addCustom() {
        let value = customDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return }
        var answer = current
        guard answer.custom.count < 2 else { toast.show("每题最多补充 2 条自己的答案"); return }
        if !answer.custom.contains(value) { answer.custom.append(value) }
        answers[question.id] = answer
        customDraft = ""
    }

    private func removeCustom(_ value: String) {
        var answer = current
        answer.custom.removeAll { $0 == value }
        answers[question.id] = answer
    }

    private func advance() {
        let pending = customDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        if !pending.isEmpty { addCustom() }
        guard canAdvance || !pending.isEmpty else { return }
        customDraft = ""
        if index < SelfDiscoveryData.questions.count - 1 { index += 1; return }
        phase = .analyzing
        let snapshot = answers
        Task {
            do {
                analysis = try await supabase.analyzeSelfDiscovery(SelfDiscoveryData.request(snapshot))
                usedAI = true
            } catch {
                analysis = SelfDiscoveryData.localAnalysis(snapshot)
                usedAI = false
                toast.show("AI 暂时不可用，已先按重复证据生成结果")
            }
            phase = .result
        }
    }

    private func back() {
        customDraft = ""
        switch phase {
        case .intro: dismiss()
        case .questions where index > 0: index -= 1
        case .questions: phase = .intro
        case .analyzing: break
        case .result: phase = .questions; index = SelfDiscoveryData.questions.count - 1
        }
    }

    private func saveResult() {
        guard let analysis, !saved else { return }
        saved = true
        onSave(Array(analysis.likes.map(\.label).prefix(5)), Array(analysis.strengths.map(\.label).prefix(5)))
    }

    private func primaryButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .font(.system(size: 13.5, weight: .semibold)).foregroundStyle(.white)
            .frame(maxWidth: .infinity).padding(.vertical, 14).background(Theme.buttonGradient, in: Capsule())
            .buttonStyle(PressScaleStyle())
    }

    private func secondaryButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .font(.system(size: 13.5, weight: .medium)).foregroundStyle(Theme.sub)
            .frame(maxWidth: .infinity).padding(.vertical, 14).background(Theme.raised, in: Capsule())
            .buttonStyle(PressScaleStyle())
    }
}

#Preview {
    AssessmentFlowView(kind: .strength) { _, _, _, _ in }
        .environment(ToastCenter())
        .preferredColorScheme(.dark)
}
