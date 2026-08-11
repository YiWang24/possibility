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
    @State private var analysis: SelfDiscoveryAnalysis?
    @State private var usedAI = false
    @State private var saved = false
    @State private var deepUnlocked = false

    private var question: DiscoveryQuestion { SelfDiscoveryData.questions[index] }
    private var current: DiscoveryAnswer { answers[question.id] ?? DiscoveryAnswer() }
    private var canAdvance: Bool {
        switch question.kind {
        case .interest: current.like != nil
        case .strength: current.like != nil && current.skill != nil
        case .environment: current.scale != nil
        case .open: !(current.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .select, .choice: !current.selected.isEmpty
        }
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
                Text("通过 \(SelfDiscoveryData.questions.count) 个原创题收集兴趣主题、优势动作双评分、外部证据、价值、环境与真实叙事，再由 AI 形成可验证的探索结论。")
                    .font(.system(size: 14)).lineSpacing(7).foregroundStyle(Theme.sub).padding(.top, 16)
                HStack(spacing: 8) {
                    formula("喜欢的事", "反复吸引你的内容领域", 0xE35CC1)
                    formula("擅长的事", "自然复用的行为模式", 0x5E96FF)
                    formula("能量与环境", "判断能否持续发挥", 0x3ED9A4)
                }
                .padding(.top, 24)
                VStack(alignment: .leading, spacing: 9) {
                    Text("01  同一优势动作分别评价喜欢与自然擅长")
                    Text("02  外部证据、环境取舍与价值观交叉验证")
                    Text("03  5 个真实叙事问题让 AI 读懂具体经历")
                }
                .font(.system(size: 12.5)).foregroundStyle(Theme.sub)
                .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.raised, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .padding(.top, 18)
                Text("题目为方法结构上的产品化原创表达，不复制任何书籍原句。")
                    .font(.system(size: 10.5)).foregroundStyle(Theme.faint).padding(.top, 14)
                primaryButton("开始完整探索 · 约 15 分钟") { phase = .questions }
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

                questionInput.padding(.top, 18)

                HStack(spacing: 11) {
                    secondaryButton("上一个") { back() }
                    primaryButton(index == SelfDiscoveryData.questions.count - 1 ? "交给 AI 综合分析" : "继续") { advance() }
                        .disabled(!canAdvance).opacity(canAdvance ? 1 : 0.42)
                }
                .padding(.top, 22)
            }
            .padding(.horizontal, 22).padding(.top, 24).padding(.bottom, 34)
        }
    }

    @ViewBuilder private var questionInput: some View {
        switch question.kind {
        case .interest:
            scoreControl("你有多喜欢这样？", low: "完全没兴趣", high: "愿意持续投入", value: current.like) { value in
                var answer = current; answer.like = value; answers[question.id] = answer
            }
        case .strength:
            VStack(spacing: 14) {
                scoreControl("你有多喜欢这样做？", low: "很消耗", high: "做完有能量", value: current.like) { value in
                    var answer = current; answer.like = value; answers[question.id] = answer
                }
                scoreControl("你有多自然地能做好？", low: "明显吃力", high: "常被认为是优势", value: current.skill) { value in
                    var answer = current; answer.skill = value; answers[question.id] = answer
                }
            }
        case .environment:
            scoreControl("更接近哪一端？", low: question.left ?? "左侧", high: question.right ?? "右侧", value: current.scale) { value in
                var answer = current; answer.scale = value; answers[question.id] = answer
            }
        case .open:
            VStack(alignment: .leading, spacing: 10) {
                Text("真实经历比“正确答案”更重要").font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Theme.ink)
                TextEditor(text: Binding(get: { current.text ?? "" }, set: { text in var answer = current; answer.text = String(text.prefix(400)); answers[question.id] = answer }))
                    .font(.system(size: 14)).foregroundStyle(Theme.ink).frame(minHeight: 150)
                    .padding(8).background(Theme.paper, in: RoundedRectangle(cornerRadius: 12))
                Text("\((current.text ?? "").count)/400").font(.system(size: 10)).foregroundStyle(Theme.faint).frame(maxWidth: .infinity, alignment: .trailing)
            }.padding(14).background(Theme.raised, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        case .select, .choice:
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 9), GridItem(.flexible())], spacing: 9) {
                ForEach(question.options) { option in
                    let selected = current.selected.contains(option.label)
                    Button { toggle(option.label, single: question.kind == .choice) } label: {
                        HStack(spacing: 9) {
                            Text(selected ? "✓" : option.glyph).font(.system(size: 15)).foregroundStyle(Color(hex: 0xBFD2FF)).frame(width: 30, height: 30).background(Theme.paper, in: RoundedRectangle(cornerRadius: 9))
                            Text(option.label).font(.system(size: 12.5, weight: .medium)).foregroundStyle(Theme.ink).frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true)
                        }.padding(11).frame(maxWidth: .infinity, minHeight: 70).background(selected ? Color(hex: 0x5373FF, alpha: 0.18) : Theme.raised, in: RoundedRectangle(cornerRadius: 15, style: .continuous)).overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).strokeBorder(selected ? Color(hex: 0x6FA5FF, alpha: 0.72) : Theme.line))
                    }.buttonStyle(PressScaleStyle())
                }
            }
        }
    }

    private func scoreControl(_ label: String, low: String, high: String, value: Int?, onChoose: @escaping (Int) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(label).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.ink)
            HStack(spacing: 8) { ForEach(1...5, id: \.self) { score in
                Button("\(score)") { onChoose(score) }.font(.system(size: 14, weight: .bold)).foregroundStyle(value == score ? Color(hex: 0xBFD2FF) : Theme.sub).frame(maxWidth: .infinity).padding(.vertical, 12).background(value == score ? Color(hex: 0x5373FF, alpha: 0.24) : Theme.paper, in: RoundedRectangle(cornerRadius: 11)).overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(value == score ? Color(hex: 0x6FA5FF, alpha: 0.78) : Theme.line)).buttonStyle(PressScaleStyle())
            }}
            HStack { Text(low); Spacer(); Text(high).multilineTextAlignment(.trailing) }.font(.system(size: 10.5)).foregroundStyle(Theme.faint)
        }.padding(14).background(Theme.raised, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
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
                    Text("你喜欢与擅长的基本结论").font(.system(size: 25, weight: .bold)).foregroundStyle(Theme.ink).padding(.top, 8)
                    Text(analysis.summary).font(.system(size: 13)).lineSpacing(6).foregroundStyle(Theme.sub).padding(.top, 9)
                    freeProfile(analysis).padding(.top, 18)
                    basicInsightBlock("我喜欢什么", analysis.likes, 0xE35CC1).padding(.top, 20)
                    basicInsightBlock("我擅长什么", analysis.strengths, 0x5E96FF).padding(.top, 12)
                    discoveryMap(analysis).padding(.top, 12)
                    if deepUnlocked {
                        Text("你的完整行动报告").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink).padding(.top, 22)
                        insightBlock("为什么会喜欢", analysis.likes, 0xE35CC1).padding(.top, 12)
                        insightBlock("优势如何发挥", analysis.strengths, 0x5E96FF).padding(.top, 12)
                        fullCommercialReport(analysis).padding(.top, 14)
                        Text(analysis.confidenceNote).font(.system(size: 10.5)).lineSpacing(4).foregroundStyle(Theme.faint).padding(.top, 15)
                    } else {
                        deepAnalysisGate
                    }
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

    private func freeProfile(_ analysis: SelfDiscoveryAnalysis) -> some View {
        let like = analysis.likes.first?.label ?? "持续好奇"
        let strength = analysis.strengths.first?.label ?? "解决问题"
        return VStack(alignment: .leading, spacing: 0) {
            Text("FREE PROFILE · 免费基础报告").font(.system(size: 10, weight: .semibold)).tracking(1.6).foregroundStyle(Color(hex: 0xBFD2FF))
            Text("你的画像：\(strength)型探索者").font(.system(size: 18, weight: .bold)).foregroundStyle(Theme.ink).padding(.top, 6)
            Text("你会被「\(like)」持续吸引，并自然用「\(strength)」把模糊的问题向前推进。先找同时需要这两件事的真实任务，比急着决定职业名称更重要。")
                .font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub).padding(.top, 8)
            HStack(spacing: 7) {
                freeSignal("最佳组合", "\(like) × \(strength)")
                freeSignal("先探索", "职业 / 副业 / 兴趣")
                freeSignal("下一步", "一个真实小任务")
            }.padding(.top, 13)
            Text("免费结论已回答：你被什么吸引、怎样解决问题、现在最值得从哪里开始。")
                .font(.system(size: 10.5)).foregroundStyle(Color(hex: 0xBFD2FF)).padding(.top, 12)
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: 0x5373FF, alpha: 0.12), in: RoundedRectangle(cornerRadius: 17, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 17).strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.3)))
    }

    private func freeSignal(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.system(size: 9.5)).foregroundStyle(Theme.faint)
            Text(value).font(.system(size: 10.5, weight: .semibold)).lineLimit(2).foregroundStyle(Theme.ink)
        }.padding(9).frame(maxWidth: .infinity, minHeight: 58, alignment: .topLeading)
            .background(Color.black.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
    }

    private func fullCommercialReport(_ analysis: SelfDiscoveryAnalysis) -> some View {
        let likes = analysis.likes.map(\.label)
        let strengths = analysis.strengths.map(\.label)
        let allLikes = SelfDiscoveryData.rankedTags(.like, answers: answers, limit: 9).map { "\($0.tag) \($0.count)" }.joined(separator: " · ")
        let allStrengths = SelfDiscoveryData.rankedTags(.skill, answers: answers, limit: 13).map { "\($0.tag) \($0.count)" }.joined(separator: " · ")
        let energy = SelfDiscoveryData.energySignals(answers).prefix(2).joined(separator: "、")
        let context = SelfDiscoveryData.environmentSignals(answers).prefix(2).joined(separator: "、")
        return VStack(alignment: .leading, spacing: 12) {
            commercialBlock("01 · 完整喜欢地图", "9 个兴趣主题的投入强度", allLikes)
            commercialBlock("02 · 完整擅长地图", "13 个优势动作的自然优势", "\(allStrengths)\n深入报告将它们与喜欢度交叉，区分天赋热爱、兴趣潜力、熟练消耗和非优先区。")
            commercialBlock("03 · 优势组合链", "你的天然解决问题路径", "\(strengths.joined(separator: " → "))\n这不是单一技能，而是更容易形成差异化的解决问题路径。")
            commercialBlock("04 · 能量与边界", "怎样才会持续发挥", "你更可能在「\(energy)」中被充电，并需要「\(context)」这样的环境。擅长不等于适合长期承担。")
            commercialBlock("05 · 消耗模式", "能做，不等于该长期做", "「\(strengths.dropFirst().joined(separator: "、"))」是可靠能力；如果长期没有能量回流，更适合作为辅助能力，而不是职业唯一核心。")
            commercialBlock("06 · 职业探索", "领域 × 角色 × 工作方式", careerSummary(for: likes.first))
            commercialBlock("07 · 副业探索", "最低成本的商业化实验", "围绕「\(likes.first ?? "兴趣主题") × \(strengths.first ?? "优势动作")」，连续 4 周输出 4 次可被别人使用的成果，观察想继续做、有人认可、能产生价值是否同时出现。")
            commercialBlock("08 · 兴趣保留", "不必每一种喜欢都赚钱", "「\(likes.dropFirst().joined(separator: "、"))」可以先作为纯粹兴趣或低压力练习保留；先验证能量与持续性，再决定是否副业化。")
            VStack(alignment: .leading, spacing: 8) {
                Text("09 · 未来 30 天人生实验").font(.system(size: 10, weight: .semibold)).tracking(1.4).foregroundStyle(Color(hex: 0xBFD2FF))
                Text("把结论变成新的证据").font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.ink)
                ForEach(Array(analysis.directions.enumerated()), id: \.element.id) { index, direction in
                    VStack(alignment: .leading, spacing: 5) {
                        Text(["职业实验", "副业实验", "兴趣实验"][index]).font(.system(size: 10, weight: .semibold)).foregroundStyle(Color(hex: 0xBFD2FF))
                        Text(direction.title).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.ink)
                        Text(direction.why).font(.system(size: 11)).foregroundStyle(Theme.sub)
                        Text("本周第一步：\(direction.firstStep)").font(.system(size: 11)).foregroundStyle(Color(hex: 0xBFD2FF))
                    }.padding(12).frame(maxWidth: .infinity, alignment: .leading).background(Theme.raised, in: RoundedRectangle(cornerRadius: 13))
                }
                Text("一个月后回来看喜欢度、能量、能力与外部反馈的变化，再回写到动态画像和人生实验室。")
                    .font(.system(size: 10.5)).foregroundStyle(Theme.sub).padding(.top, 2)
            }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(Theme.card, in: RoundedRectangle(cornerRadius: 17))
        }
    }

    private func commercialBlock(_ eyebrow: String, _ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(eyebrow).font(.system(size: 10, weight: .semibold)).tracking(1.4).foregroundStyle(Color(hex: 0xBFD2FF))
            Text(title).font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.ink)
            Text(text).font(.system(size: 11.5)).lineSpacing(4).foregroundStyle(Theme.sub)
        }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(Theme.card, in: RoundedRectangle(cornerRadius: 17))
    }

    private func careerSummary(for like: String?) -> String {
        switch like {
        case "艺术与审美": return "优先体验：体验／内容设计、品牌与创意策略、内容策划。重点验证表达是否能产生真实价值。"
        case "知识与思想": return "优先体验：用户／行业研究、产品策略、知识内容。重点验证研究与判断是否愿意长期投入。"
        case "人与心理": return "优先体验：用户研究、教育／咨询服务、社群体验运营。重点验证理解人是否让你持续有能量。"
        case "商业与市场": return "优先体验：商业策略、增长／用户运营、创业探索。重点验证价值判断是否愿意长期投入。"
        case "科技与未来": return "优先体验：AI 产品探索、科技内容、创新研究。重点验证新技术是否让你好奇又愿意行动。"
        case "系统与优化": return "优先体验：产品经理、运营策略、服务设计。重点验证复杂系统能否让你越做越清晰。"
        default: return "优先从真实问题、内容与研究、服务与体验三类任务中选择小项目，验证主题、优势与环境是否同时匹配。"
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

    private func basicInsightBlock(_ title: String, _ items: [DiscoveryInsight], _ tint: UInt32) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.ink)
            FlowLayout(spacing: 8) {
                ForEach(items) { item in
                    Text(item.label).font(.system(size: 12, weight: .semibold)).foregroundStyle(Color(hex: tint))
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(Color(hex: tint, alpha: 0.12), in: Capsule())
                }
            }
            Text("这些结论来自重复出现的选择与自由回答；深入分析会解释具体证据与适合你的行动路径。")
                .font(.system(size: 11)).lineSpacing(4).foregroundStyle(Theme.sub)
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.raised, in: RoundedRectangle(cornerRadius: 17, style: .continuous))
    }

    private var deepAnalysisGate: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("DEEPER VIEW").font(.system(size: 10, weight: .semibold)).tracking(2).foregroundStyle(Color(hex: 0xBFD2FF))
            Text("从“我大概是谁”到“我该怎么选”").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink)
            Text("完整报告将展示以下目录；个人分数、组合判断和推荐内容会在解锁后显示。")
                .font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub)
            VStack(alignment: .leading, spacing: 6) {
                Text("01  9 项兴趣地图与核心／延展兴趣")
                Text("02  13 项优势双评分与四象限位置")
                Text("03  解题路径、能量边界与消耗提醒")
                Text("04  职业／副业／兴趣建议与 30 天实验")
            }.font(.system(size: 10.5)).foregroundStyle(Color(hex: 0xBFD2FF)).padding(11).frame(maxWidth: .infinity, alignment: .leading).background(Theme.raised, in: RoundedRectangle(cornerRadius: 12))
            primaryButton("解锁完整深入报告 ¥9.9") {
                deepUnlocked = true
                toast.show("已解锁深入分析（预览环境）")
            }.padding(.top, 5)
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: 0x5373FF, alpha: 0.12), in: RoundedRectangle(cornerRadius: 17, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 17).strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.38)))
        .padding(.top, 18)
    }

    private func discoveryMap(_ analysis: SelfDiscoveryAnalysis) -> some View {
        let energy = SelfDiscoveryData.energySignals(answers)
        let context = SelfDiscoveryData.environmentSignals(answers)
        return VStack(alignment: .leading, spacing: 0) {
            Text("LIFE MAP · 基础结论").font(.system(size: 10, weight: .semibold)).tracking(1.6).foregroundStyle(Color(hex: 0x3ED9A4))
            Text("你的喜欢 × 擅长人生地图").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink).padding(.top, 4)
            Text("先看你该优先投入哪里，而不是急着把自己归类成某个职业。")
                .font(.system(size: 11)).foregroundStyle(Theme.sub).padding(.top, 4)
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 1), GridItem(.flexible(), spacing: 1)], spacing: 1) {
                mapCell("天赋热爱区 · 优先探索", "把「\(analysis.likes.first?.label ?? "喜欢的主题")」和「\(analysis.strengths.first?.label ?? "擅长的方式")」放进真实项目，最值得成为职业核心或长期副业。", 0x3ED9A4)
                mapCell("兴趣潜力区 · 值得练习", "对「\(analysis.likes.dropFirst().map(\.label).joined(separator: "、"))」先用低成本作品或体验验证。", 0x5E96FF)
                mapCell("熟练消耗区 · 需要边界", "即使擅长「\(analysis.strengths.dropFirst().map(\.label).joined(separator: "、"))」，也要结合能量感判断。", 0xF0A949)
                mapCell("发挥条件 · 选择环境", "你更可能在「\(energy.prefix(2).joined(separator: "、"))」中被充电，并需要「\(context.prefix(2).joined(separator: "、"))」。", 0x6E7B98)
            }.padding(.top, 12)
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.raised, in: RoundedRectangle(cornerRadius: 17, style: .continuous))
    }

    private func mapCell(_ title: String, _ detail: String, _ tint: UInt32) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.system(size: 10.5, weight: .semibold)).foregroundStyle(Color(hex: tint))
            Text(detail).font(.system(size: 10.5)).lineSpacing(3).foregroundStyle(Theme.sub)
        }
        .padding(11).frame(maxWidth: .infinity, minHeight: 128, alignment: .topLeading)
        .background(Color(hex: tint, alpha: 0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func toggle(_ label: String, single: Bool = false) {
        var answer = current
        if let existing = answer.selected.firstIndex(of: label) {
            answer.selected.remove(at: existing)
        } else if single {
            answer.selected = [label]
        } else if answer.selected.count < 3 {
            answer.selected.append(label)
        } else {
            toast.show("每题最多选择 3 项")
        }
        answers[question.id] = answer
    }

    private func advance() {
        guard canAdvance else { return }
        if index < SelfDiscoveryData.questions.count - 1 { index += 1; return }
        phase = .analyzing
        deepUnlocked = false
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
