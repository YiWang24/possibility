import SwiftUI
import Foundation

// MARK: - 01 认识自己（首页）
// 原型 scr-home：问候 · 语音日记 · AI 发问 · 动态画像。

struct HomeView: View {
    @Environment(ToastCenter.self) private var toast
    @Environment(SupabaseService.self) private var supabase
    @State private var model = HomeModel()
    @State private var chatLaunch: ChatLaunch?
    @State private var diaryLaunch: DiaryLaunch?
    @State private var activeDimension: DimensionKey?
    @State private var showStudio = false
    @State private var showCardHub = false
    @State private var launchGame: CardGameKind?

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
        .screenBackground()
        .onAppear { model.loadPortrait(using: supabase) }
        .task { await model.loadDiaryOverview(using: supabase) }
        .fullScreenCover(item: $chatLaunch) { ChatView(launch: $0) }
        .fullScreenCover(item: $diaryLaunch) { launch in
            DiaryDetailView(
                launch: launch,
                hasRecordedToday: model.analysis != nil,
                onStartRecording: {
                    if !model.isRecording { model.toggleRecording() }
                }
            )
        }
        .sheet(item: $activeDimension) { key in
            DimensionSheet(key: key, initialSelected: model.selectedKeywords(for: key), onSave: { keywords in
                model.saveDimension(key, keywords: keywords, using: supabase)
            }, onLaunchCardGame: { game in
                activeDimension = nil
                launchGame = CardGameKind(rawValue: game)
            })
            .presentationDetents([.fraction(0.82)])
            .presentationDragIndicator(.visible)
            .presentationBackground(Color(hex: 0x10131C))
        }
        .fullScreenCover(isPresented: $showStudio) {
            ProfileStudioView(home: model) { key in
                activeDimension = key
            }
            .environment(toast)
            .environment(supabase)
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
            PortraitCard(
                model: model,
                animationPaused: chatLaunch != nil || diaryLaunch != nil || showStudio,
                onTapDim: handleDimTap
            )
        }
    }

    /// 维度点击路由：软维度开浮层；人格底色进画像工作室
    private func handleDimTap(_ dim: HomeModel.PortraitDim) {
        if let key = dim.dimensionKey {
            activeDimension = key
        } else {
            showStudio = true
        }
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

    /// 兜底周历（对齐原型 7/17–7/22；list-diary 加载失败时展示）
    private static let week: [(String, String, String)] = [
        ("🙂", "五", "2026-07-17"), ("😮‍💨", "六", "2026-07-18"), ("😊", "日", "2026-07-19"),
        ("😐", "一", "2026-07-20"), ("🙂", "二", "2026-07-21"), ("😌", "三", "2026-07-22"),
    ]

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
                        model.finishRecording()   // 同步收起，UI 立即响应；分析异步跟进
                        Task { await model.analyzeDiary(using: supabase) }
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
            }
            weekRow
            if model.isRecording { recorder }
            if let analysis = model.analysis { result(analysis) }
        }
        .padding(.horizontal, 20).padding(.vertical, 17)
        .kaleidoCard()
    }

    private var weekRow: some View {
        HStack {
            // 真实周历（list-diary 聚合最近 7 天）优先；未加载 / 失败走硬编码兜底
            if let cells = model.weekCells {
                ForEach(cells) { cell in
                    Button { onOpenDiary(cell.date) } label: {
                        dayCell(emoji: cell.emoji, label: cell.label, filled: cell.filled, today: false)
                    }
                    .buttonStyle(PressScaleStyle())
                    Spacer()
                }
            } else {
                ForEach(Self.week.indices, id: \.self) { i in
                    Button { onOpenDiary(Self.week[i].2) } label: {
                        dayCell(emoji: Self.week[i].0, label: Self.week[i].1, filled: true, today: false)
                    }
                    .buttonStyle(PressScaleStyle())
                    Spacer()
                }
            }
            Button { onOpenDiary(model.diaryTodayDate) } label: {
                dayCell(emoji: model.analysis != nil ? "🙂" : (model.todayEmoji ?? ""),
                        label: "今天",
                        filled: model.analysis != nil || model.todayEmoji != nil,
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
                model.finishRecording()           // 同步收起，UI 立即响应；分析异步跟进
                Task { await model.analyzeDiary(using: supabase) }
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
