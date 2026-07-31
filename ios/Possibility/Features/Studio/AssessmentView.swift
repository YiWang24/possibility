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

#Preview {
    AssessmentFlowView(kind: .strength) { _, _, _, _ in }
        .environment(ToastCenter())
        .preferredColorScheme(.dark)
}
