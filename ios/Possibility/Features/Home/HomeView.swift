import SwiftUI
import Foundation

// MARK: - 01 认识你自己（首页）
// 原型 scr-home：问候 · 语音日记 · AI 发问 · 动态画像。

struct HomeView: View {
    @Environment(ToastCenter.self) private var toast
    @Environment(SupabaseService.self) private var supabase
    @State private var model = HomeModel()
    @State private var chatLaunch: ChatLaunch?
    @State private var diaryLaunch: DiaryLaunch?
    @State private var activeDimension: DimensionKey?
    @State private var assessmentKind: AssessmentKind?
    @State private var showStudio = false
    @State private var showCardHub = false
    @State private var launchGame: CardGameKind?
    /// 从画像半屏浮层启动卡牌时，等待 sheet 完成退场后再呈现全屏游戏。
    /// 同一轮更新里同时 dismiss sheet / present cover 会被 SwiftUI 丢弃。
    @State private var pendingCardGame: CardGameKind?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                greet
                DiaryCard(model: model, onOpenDiary: { diaryLaunch = DiaryLaunch(date: $0) })
                    .padding(.top, 18)
                HomeAskCard(model: model, onSend: send)
                    .padding(.top, 22)
                LifeEntryButton { showCardHub = true }
                    .padding(.top, 14)
                portraitSection
                    .padding(.top, 24)
            }
            .padding(.horizontal, 22)
            .padding(.top, 20)
            .padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .screenBackground()
        .onAppear { model.loadPortrait(using: supabase) }
        .task { await model.loadDiaryOverview(using: supabase) }
        .fullScreenCover(item: $chatLaunch) { ChatView(launch: $0, entryPoint: .home) }
        .fullScreenCover(item: $diaryLaunch) { launch in
            DiaryDetailView(
                launch: launch,
                hasRecordedToday: model.hasRecordedToday,
                onStartRecording: {
                    if !model.isRecording { model.toggleRecording() }
                }
            )
        }
        .sheet(item: $activeDimension, onDismiss: {
            guard let game = pendingCardGame else { return }
            pendingCardGame = nil
            launchGame = game
        }) { key in
            DimensionSheet(key: key, initialSelected: model.selectedKeywords(for: key), onSave: { keywords in
                model.saveDimension(key, keywords: keywords, using: supabase)
            }, onSaveAssessment: { kind, tags, answers, scores in
                model.saveDimension(
                    key,
                    keywords: tags,
                    using: supabase,
                    assessmentKind: kind,
                    assessmentAnswers: answers,
                    assessmentScores: scores
                )
            }, onLaunchCardGame: { game in
                guard let game = CardGameKind(rawValue: game) else { return }
                pendingCardGame = game
                activeDimension = nil
            })
            .presentationDetents([.fraction(0.82)])
            .presentationDragIndicator(.visible)
            .presentationBackground(Color(hex: 0x10131C))
        }
        .fullScreenCover(isPresented: $showStudio) {
            ProfileStudioView(home: model)
            .environment(toast)
            .environment(supabase)
        }
        .fullScreenCover(item: $assessmentKind) { kind in
            AssessmentFlowView(kind: kind, onSaveToProfile: saveAssessment)
                .environment(toast)
        }
        .fullScreenCover(isPresented: $showCardHub) {
            CardGameHubView(home: model)
                .environment(toast)
                .environment(supabase)
        }
        .fullScreenCover(item: $launchGame) { kind in
            CardGameView(kind: kind, home: model)
                .environment(toast)
                .environment(supabase)
        }
    }

    private func send() {
        guard model.canSend else { return }
        chatLaunch = ChatLaunch(topic: model.topic, question: model.trimmedQuestion)
    }

    // MARK: 问候

    private var greet: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 6) {
                Text(Self.todayText).font(.system(size: 11)).tracking(3).foregroundStyle(Theme.faint)
                Text("晚上好，\(model.userName)")
                    .font(.system(size: 27, weight: .bold)).tracking(0.8).foregroundStyle(Theme.ink)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("已探索").font(.system(size: 12)).foregroundStyle(Theme.sub)
                Text("第 \(model.exploredDays) 天")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.aurora)
            }
        }
    }

    private static var todayText: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "zh_CN")
        f.dateFormat = "M月d日 · EEEE"
        return f.string(from: Date())
    }

    // MARK: 动态画像

    private var portraitSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "我的动态画像", trailing: "探索更多画像 ›", isLink: true) {
                showStudio = true
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("我们无可避免跟自己保持陌生，我们不明白自己，我们搞不清楚自己，我们的永恒判词是：“离每个人最远的，就是他自己。”——对于我们自己，我们不是“知者”……")
                    .font(.system(size: 12, design: .serif))
                    .foregroundStyle(Theme.sub)
                    .lineSpacing(6)
                    .fixedSize(horizontal: false, vertical: true)
                Text("——尼采《道德的系谱》")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.faint)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .padding(.top, 4)
            .padding(.leading, 14)
            .overlay(alignment: .leading) {
                Rectangle()
                    .fill(Theme.sub.opacity(0.34))
                    .frame(width: 1)
            }
            PortraitCard(
                model: model,
                animationPaused: chatLaunch != nil || diaryLaunch != nil || showStudio,
                onTapDim: handleDimTap
            )
        }
    }

    /// 维度点击路由：软维度开浮层；人格底色直接进入大五人格测评
    private func handleDimTap(_ dim: HomeModel.PortraitDim) {
        if let key = dim.dimensionKey {
            activeDimension = key
        } else {
            assessmentKind = .bigfive
        }
    }

    private func saveAssessment(
        _ kind: AssessmentKind,
        tags: [String],
        answers: [Int],
        scores: [String: Int]
    ) {
        guard kind == .bigfive else { return }
        var text = "大五：" + tags.prefix(3).joined(separator: " · ")
        if let mbti = MBTIStore.current { text += " · MBTI：\(mbti)" }
        model.savePersonality(
            text,
            using: supabase,
            assessmentKind: kind,
            assessmentAnswers: answers,
            assessmentScores: scores
        )
        toast.show("结果已写入人格底色 · 原始答案默认私密")
    }
}

// MARK: - 语音日记卡

/// 录音计时标签：把逐秒变化的 elapsed 隔离在此，避免整卡逐秒重建
private struct RecorderElapsedLabel: View {
    var model: HomeModel
    var body: some View {
        Text(model.elapsedText)
            .font(.system(size: 12)).monospacedDigit().foregroundStyle(Theme.lime).frame(width: 38)
    }
}

private struct DiaryCard: View {
    @Bindable var model: HomeModel
    var onOpenDiary: (String?) -> Void
    @Environment(SupabaseService.self) private var supabase

    /// 转写全文是否展开（默认折叠为几行）
    @State private var transcriptExpanded = false
    /// 是否处于「自己输入」编辑态
    @State private var editingTranscript = false

    /// 首页前 6 天固定使用 demo 心情；只有「今天」读取真实日记。
    private var mockWeek: [(emoji: String, label: String, date: String)] {
        let emojis = ["🙂", "😮‍💨", "😊", "😐", "🙂", "😌"]
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let weekday = DateFormatter()
        weekday.locale = Locale(identifier: "zh_CN")
        weekday.dateFormat = "EEEEE"

        return zip((-6 ... -1), emojis).compactMap { offset, emoji in
            guard let date = calendar.date(byAdding: .day, value: offset, to: today) else { return nil }
            return (emoji, weekday.string(from: date), SupabaseTimestamp.dayString(from: date))
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Button { onOpenDiary(nil) } label: {
                    HStack(spacing: 7) {
                        Text("我的语音日记").font(.system(size: 14.5, weight: .semibold)).foregroundStyle(Theme.ink)
                        Text("›").font(.system(size: 14))
                            .foregroundStyle(.white.opacity(0.8))
                            .frame(width: 18, height: 18)
                            .background(Color.white.opacity(0.06), in: Circle())
                            .overlay(Circle().strokeBorder(.white.opacity(0.18), lineWidth: 1))
                    }
                }
                .buttonStyle(PressScaleStyle())
                .accessibilityLabel("查看全部语音日记详情")
                Spacer()
                Button(model.isRecording ? "■ 停止记录" : "◉ 记录今日") {
                    if model.isRecording {
                        model.startAnalyzeDiary(using: supabase)
                    } else {
                        model.toggleRecording()
                    }
                }
                .font(.system(size: 12.5, weight: .medium))
                .foregroundStyle(Theme.blue)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(Color(hex: 0x5E96FF, alpha: 0.12), in: Capsule())
                .contentShape(Capsule())
                .buttonStyle(.plain)
                .disabled(model.analyzing)
            }
            weekRow
            if model.isRecording { recorder }
            if !model.transcript.isEmpty && !model.isRecording { transcriptBlock }
            if model.analyzing { analyzingView }
            if let analysis = model.analysis { result(analysis) }
            if let error = model.analysisError { analysisFailure(error) }
        }
        .padding(.horizontal, 20).padding(.vertical, 17)
        .kaleidoCard()
        .onChange(of: model.isRecording) {
            // 重新录音时复位转写块的展开 / 编辑态
            if model.isRecording {
                transcriptExpanded = false
                editingTranscript = false
            }
        }
    }

    private var weekRow: some View {
        HStack {
            ForEach(Array(mockWeek.enumerated()), id: \.offset) { _, day in
                Button { onOpenDiary(day.date) } label: {
                    dayCell(emoji: day.emoji, label: day.label, filled: true, today: false)
                }
                .buttonStyle(PressScaleStyle())
                Spacer()
            }
            Button { onOpenDiary(model.diaryTodayDate) } label: {
                dayCell(emoji: model.todayDisplayEmoji,
                        label: "今天",
                        filled: model.hasRecordedToday,
                        today: true)
            }
            .buttonStyle(PressScaleStyle())
        }
    }

    private func dayCell(emoji: String, label: String, filled: Bool, today: Bool) -> some View {
        VStack(spacing: 6) {
            Text(emoji)
                .font(.system(size: 15))
                .frame(width: 30, height: 30)
                .background(
                    Circle().fill(filled
                        ? AnyShapeStyle(LinearGradient(colors: [Color(hex: 0x3E77F2), Color(hex: 0xB03390)], startPoint: .topLeading, endPoint: .bottomTrailing))
                        : AnyShapeStyle(Theme.raised))
                )
                .overlay {
                    if today {
                        Circle().strokeBorder(Color(hex: 0x5E96FF, alpha: 0.55), style: StrokeStyle(lineWidth: 2, dash: [3, 3])).padding(-2)
                    }
                }
            Text(label).font(.system(size: 10)).foregroundStyle(today ? Theme.blue : Theme.faint)
        }
    }

    private var recorder: some View {
        HStack(spacing: 12) {
            WaveformView()
            // 计时文字独立成子视图：每秒的 elapsed 更新只重建它，
            // 不再逐秒重建整张卡（否则「完成」按钮会被重建打断命中，偶发点不动）
            RecorderElapsedLabel(model: model)
            Button("完成") {
                model.startAnalyzeDiary(using: supabase)
            }
                .font(.system(size: 12.5, weight: .medium)).foregroundStyle(.white)
                .padding(.horizontal, 14).padding(.vertical, 7)
                .background(Theme.buttonGradient, in: Capsule())
                .contentShape(Capsule())
                .buttonStyle(.plain)
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(
            LinearGradient(colors: [Color(hex: 0x5E96FF, alpha: 0.14), Color(hex: 0xE35CC1, alpha: 0.10)],
                           startPoint: .leading, endPoint: .trailing),
            in: RoundedRectangle(cornerRadius: 14, style: .continuous)
        )
        .transition(.opacity.combined(with: .move(edge: .top)))
    }

    // MARK: 转写全文（收起 + 自己输入）

    private var transcriptBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Text("语音转写").font(.system(size: 11)).foregroundStyle(Theme.faint)
                Spacer()
                if editingTranscript {
                    Button("取消") {
                        withAnimation(.easeOut(duration: 0.2)) { editingTranscript = false }
                    }
                    .font(.system(size: 11)).foregroundStyle(Theme.faint).buttonStyle(.plain)
                    Button("重新分析") {
                        editingTranscript = false
                        model.submitEditedTranscript(using: supabase)
                    }
                    .font(.system(size: 11, weight: .medium)).foregroundStyle(Theme.blue).buttonStyle(.plain)
                    .disabled(model.analyzing
                              || model.transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                } else {
                    Button("编辑") {
                        transcriptExpanded = true
                        withAnimation(.easeOut(duration: 0.2)) { editingTranscript = true }
                    }
                    .font(.system(size: 11)).foregroundStyle(Theme.blue).buttonStyle(.plain)
                    .disabled(model.analyzing)
                    if transcriptIsLong {
                        Button(transcriptExpanded ? "收起" : "展开全文") {
                            withAnimation(.easeOut(duration: 0.2)) { transcriptExpanded.toggle() }
                        }
                        .font(.system(size: 11)).foregroundStyle(Theme.blue).buttonStyle(.plain)
                    }
                }
            }

            if editingTranscript {
                TextEditor(text: $model.transcript)
                    .font(.system(size: 12.5)).lineSpacing(4).foregroundStyle(Theme.ink)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 96)
                    .padding(8)
                    .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
            } else {
                Text(model.transcript)
                    .font(.system(size: 12.5)).lineSpacing(6).foregroundStyle(Color(hex: 0xC8CEDA))
                    .lineLimit(transcriptExpanded || !transcriptIsLong ? nil : 3)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(12)
        .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
        .transition(.opacity)
    }

    /// 转写是否长到需要折叠（短文本不显示展开/收起）
    private var transcriptIsLong: Bool { model.transcript.count > 48 }

    private var analyzingView: some View {
        HStack(spacing: 9) {
            ProgressView().tint(Theme.blue).controlSize(.small)
            Text("正在转写并分析这次记录…")
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.sub)
                .accessibilityLabel("正在分析语音日记")
            Spacer()
            // 网关偶发挂起时不至于卡死：随时可取消，取消后能立即重录或重试
            Button("取消") { model.cancelAnalysis() }
                .font(.system(size: 11.5, weight: .medium))
                .foregroundStyle(Theme.faint)
                .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 5)
    }

    private func analysisFailure(_ message: String) -> some View {
        HStack {
            Text(message).font(.system(size: 11.5)).foregroundStyle(Theme.sub)
            Spacer()
            Button("重试") {
                model.startRetryAnalysis(using: supabase)
            }
            .font(.system(size: 11.5, weight: .medium))
            .foregroundStyle(Theme.blue)
            .buttonStyle(.plain)
        }
        .padding(.vertical, 5)
    }

    private func result(_ analysis: DiaryAnalysis) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider().overlay(Theme.line)
            Text("这次记录里，我听见了").font(.system(size: 11)).foregroundStyle(Theme.faint)
            FlowChips(items: analysis.emotions.map { .emotion($0) } + analysis.keywords.map { .keyword($0) })
            Button("查看详情 ›") { onOpenDiary(model.diaryTodayDate) }
                .font(.system(size: 11)).foregroundStyle(Theme.blue)
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(.top, 3)
        .transition(.opacity)
    }
}

// MARK: - 情绪 / 关键词流式标签

private struct FlowChips: View {
    enum Item: Hashable { case emotion(String), keyword(String) }
    let items: [Item]

    var body: some View {
        FlowLayout(spacing: 6) {
            ForEach(items, id: \.self) { item in
                switch item {
                case .emotion(let t):
                    Text(t).font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Color(hex: 0x0B0F18))
                        .padding(.horizontal, 11).padding(.vertical, 4)
                        .background(Theme.lime, in: Capsule())
                case .keyword(let t):
                    Text(t).font(.system(size: 11.5)).foregroundStyle(Color(hex: 0x9DBCFF))
                        .padding(.horizontal, 11).padding(.vertical, 4)
                        .background(Color(hex: 0x5E96FF, alpha: 0.13), in: Capsule())
                        .overlay(Capsule().strokeBorder(Color(hex: 0x5E96FF, alpha: 0.3), lineWidth: 1))
                }
            }
        }
    }
}

#Preview {
    HomeView()
        .environment(SupabaseService())
        .environment(ToastCenter())
        .preferredColorScheme(.dark)
}
