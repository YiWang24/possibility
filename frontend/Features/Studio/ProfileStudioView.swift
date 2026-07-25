import SwiftUI

// MARK: - 画像工坊（原型 #profileStudio）
//
// 大五主卡（进入 / 继续 n/120 / 查看结果）· 处境扫描 CTA · 生活画像五维网格 ·
// MBTI 面板 · 来源图例。从首页「探索更多画像」进入（fullScreenCover）。

struct ProfileStudioView: View {
    let home: HomeModel

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastCenter.self) private var toast
    @Environment(SupabaseService.self) private var supabase

    @State private var assessmentKind: AssessmentKind?
    @State private var showContextScan = false
    @State private var activeDimension: DimensionKey?
    @State private var launchGame: CardGameKind?
    @State private var mbtiOpen = false
    @State private var mbti = MBTIStore.current
    /// 测评浮层关闭后触发状态刷新
    @State private var tick = 0

    var body: some View {
        VStack(spacing: 0) {
            topBar
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    section(title: "人格底色") { bigFiveCard }
                    section(title: "此刻的处境") { contextCard }
                    section(title: "生活画像") { assessmentGrid }
                    section(title: "MBTI") { mbtiPanel }
                    sourceKey
                }
                .padding(.horizontal, 22).padding(.top, 16).padding(.bottom, 36)
            }
            .scrollIndicators(.hidden)
        }
        .background(Theme.paper.ignoresSafeArea())
        .fullScreenCover(item: $assessmentKind, onDismiss: { tick += 1 }) { kind in
            AssessmentFlowView(kind: kind, onSaveToProfile: saveAssessment)
                .environment(toast)
        }
        .fullScreenCover(isPresented: $showContextScan) {
            ContextScanView().environment(toast)
        }
        .sheet(item: $activeDimension) { key in
            DimensionSheet(
                key: key,
                initialSelected: home.selectedKeywords(for: key),
                onSave: { keywords in
                    home.saveDimension(key, keywords: keywords, using: supabase)
                },
                onLaunchCardGame: { game in
                    activeDimension = nil
                    launchGame = CardGameKind(rawValue: game)
                }
            )
            .presentationDetents([.fraction(0.82)])
            .presentationDragIndicator(.visible)
            .presentationBackground(Color(hex: 0x10131C))
        }
        .fullScreenCover(item: $launchGame) { kind in
            CardGameView(kind: kind, home: home)
                .environment(toast)
                .environment(supabase)
        }
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
            Text("画像工坊").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink)
            Spacer()
        }
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 12)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    private func section(title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            Text(title).font(.system(size: 14.5, weight: .bold)).foregroundStyle(Theme.ink)
            content()
        }
    }

    // MARK: 大五主卡（原型 .studio-primary + updateDemoStudioState）

    private var bigFiveState: (meta: String, action: String) {
        _ = tick
        let snap = AssessmentModel.snapshot(.bigfive)
        if snap.result != nil {
            let model = AssessmentModel(kind: .bigfive)
            return ("已完成 · \(model.resultTags.prefix(2).joined(separator: " · "))", "查看结果")
        }
        if snap.answered > 0 {
            return ("已完成 \(snap.answered)/\(snap.total) · 进度自动保存", "继续 \(snap.answered)/\(snap.total)")
        }
        return ("120题，从五个主要维度和三十个细分面向理解你的稳定倾向。", "进入测试")
    }

    private var bigFiveCard: some View {
        let state = bigFiveState
        return VStack(alignment: .leading, spacing: 10) {
            Text("SCIENTIFIC BASELINE")
                .font(.system(size: 9, weight: .semibold)).tracking(2.2)
                .foregroundStyle(Color(hex: 0xB6A8FF))
            Text("大五人格").font(.system(size: 18, weight: .bold)).foregroundStyle(Theme.ink)
            Text(state.meta).font(.system(size: 12)).lineSpacing(4).foregroundStyle(Theme.sub)
            HStack(spacing: 7) {
                ForEach(["120 题", "约 15–20 分钟", "默认私密"], id: \.self) { m in
                    Text(m).font(.system(size: 10.5)).foregroundStyle(Theme.sub)
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background(Color.white.opacity(0.07), in: Capsule())
                }
            }
            Button(state.action) { assessmentKind = .bigfive }
                .font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(Theme.buttonGradient, in: Capsule())
                .buttonStyle(PressScaleStyle())
                .padding(.top, 4)
        }
        .padding(18)
        .background {
            ZStack(alignment: .topTrailing) {
                LinearGradient(colors: [Color(hex: 0x1B1A38), Color(hex: 0x211A45), Color(hex: 0x141329)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                RadialGradient(colors: [Color(hex: 0x8F7BFF, alpha: 0.3), .clear],
                               center: .topTrailing, startRadius: 0, endRadius: 160)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Color(hex: 0x8F7BFF, alpha: 0.3), lineWidth: 1))
    }

    // MARK: 处境扫描 CTA（原型 .context-scan-card）

    private var contextCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("CONTEXT CHECK-IN · 约 2 分钟")
                .font(.system(size: 9, weight: .semibold)).tracking(2.2)
                .foregroundStyle(Color(hex: 0x8EE7C8))
            Text("最近，什么正在作用于你？").font(.system(size: 16.5, weight: .bold)).foregroundStyle(Theme.ink)
            Text("不测你是哪类人。只把精力、现实压力、支持与选择空间分开看，避免把一时的处境写成永久的性格。")
                .font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub)
            Button("开始处境扫描") { showContextScan = true }
                .font(.system(size: 13, weight: .semibold)).foregroundStyle(Color(hex: 0x0B241C))
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(Color(hex: 0x3ED9A4), in: Capsule())
                .buttonStyle(PressScaleStyle())
                .padding(.top, 4)
        }
        .padding(18)
        .background(
            LinearGradient(colors: [Color(hex: 0x11241F), Color(hex: 0x122031), Color(hex: 0x0E1420)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 20, style: .continuous)
        )
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Color(hex: 0x3ED9A4, alpha: 0.26), lineWidth: 1))
    }

    // MARK: 生活画像网格（原型 .assessment-grid + syncStudioDimensionCards）

    private struct GridItemSpec {
        let key: DimensionKey
        let mark: String
        let markColor: UInt32
        let markBg: UInt32
        let title: String
        let fallback: String
        /// 未填时参考的测评（进度 / 已完成状态）
        let assessment: AssessmentKind?
    }

    private static let gridSpecs: [GridItemSpec] = [
        GridItemSpec(key: .skill, mark: "✦", markColor: 0xBFD2FF, markBg: 0x5E96FF, title: "我擅长",
                     fallback: "选择关键词、换一批，也可以自己输入", assessment: .strength),
        GridItemSpec(key: .like, mark: "♡", markColor: 0xF4BDE0, markBg: 0xE35CC1, title: "我喜欢",
                     fallback: "可用关键词或霍兰德兴趣测评继续探索", assessment: .holland),
        GridItemSpec(key: .love, mark: "✿", markColor: 0xFFB69E, markBg: 0xFF7A4D, title: "我在恋爱关系中在意",
                     fallback: "关键词、关系测评与婚姻卡牌", assessment: .love),
        GridItemSpec(key: .family, mark: "⌂", markColor: 0x8EE7C8, markBg: 0x3ED9A4, title: "我在家庭关系中在意",
                     fallback: "关键词、家庭关系测评与家庭卡牌", assessment: .family),
        GridItemSpec(key: .social, mark: "◎", markColor: 0xBFD2FF, markBg: 0x5E96FF, title: "我在人际交往中在意",
                     fallback: "关键词与人际交往卡牌", assessment: nil),
    ]

    private func gridState(_ spec: GridItemSpec) -> (meta: String, action: String, progress: Double?) {
        _ = tick
        if let value = home.filledDims[spec.key.rawValue], !value.isEmpty {
            return ("已形成画像 · \(value)", "编辑", nil)
        }
        if let kind = spec.assessment {
            let snap = AssessmentModel.snapshot(kind)
            if let result = snap.result {
                if kind == .holland {
                    return ("已完成 · \(result.displayCode ?? result.code ?? "") 兴趣组合", "查看画像", nil)
                }
                return ("测评已完成 · 可写入画像", "进入", nil)
            }
            if snap.answered > 0 {
                let name = kind == .holland ? "霍兰德测评" : "测评"
                return ("\(name)已完成 \(snap.answered)/\(snap.total) · 进度自动保存", "继续",
                        Double(snap.answered) / Double(snap.total))
            }
        }
        return (spec.fallback, "进入", nil)
    }

    private var assessmentGrid: some View {
        VStack(spacing: 10) {
            ForEach(Self.gridSpecs, id: \.key) { spec in
                let state = gridState(spec)
                Button {
                    activeDimension = spec.key
                } label: {
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(spacing: 12) {
                            Text(spec.mark).font(.system(size: 15))
                                .foregroundStyle(Color(hex: spec.markColor))
                                .frame(width: 34, height: 34)
                                .background(Color(hex: spec.markBg, alpha: 0.15), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                            VStack(alignment: .leading, spacing: 3) {
                                Text(spec.title).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink)
                                Text(state.meta).font(.system(size: 11)).lineLimit(1).foregroundStyle(Theme.sub)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            Text(state.action)
                                .font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Color(hex: 0x9DBCFF))
                                .padding(.horizontal, 13).padding(.vertical, 6)
                                .background(Color(hex: 0x5E96FF, alpha: 0.14), in: Capsule())
                                .overlay(Capsule().strokeBorder(Color(hex: 0x5E96FF, alpha: 0.4), lineWidth: 1))
                                .fixedSize()
                        }
                        if let progress = state.progress {
                            Capsule().fill(Theme.raised)
                                .overlay(alignment: .leading) {
                                    GeometryReader { geo in
                                        Capsule().fill(Theme.aurora).frame(width: geo.size.width * progress)
                                    }
                                }
                                .frame(height: 3)
                                .padding(.top, 10)
                        }
                    }
                    .padding(.horizontal, 14).padding(.vertical, 13)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
                }
                .buttonStyle(PressScaleStyle())
            }
        }
    }

    // MARK: MBTI（原型 .mbti-panel）

    private var mbtiPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Text("MBTI：").font(.system(size: 13.5, weight: .bold)).foregroundStyle(Theme.ink)
                Text(mbti ?? "未设置").font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(mbti == nil ? Theme.faint : Theme.blue)
                Spacer()
            }
            Button(mbtiOpen ? "收起 ↑" : "选择或修改类型 ↓") {
                withAnimation(.easeOut(duration: 0.22)) { mbtiOpen.toggle() }
            }
            .font(.system(size: 12)).foregroundStyle(Theme.blue)
            .buttonStyle(.plain)

            if mbtiOpen {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
                    ForEach(AssessmentData.mbtiTypes, id: \.self) { type in
                        let on = mbti == type
                        Button {
                            selectMBTI(type)
                        } label: {
                            Text(type)
                                .font(.system(size: 12, weight: .semibold)).monospaced()
                                .foregroundStyle(on ? .white : Theme.sub)
                                .frame(maxWidth: .infinity).padding(.vertical, 9)
                                .background(on ? AnyShapeStyle(Theme.buttonGradient) : AnyShapeStyle(Theme.raised),
                                            in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .strokeBorder(on ? Color(hex: 0x6FA5FF, alpha: 0.7) : Theme.line, lineWidth: 1))
                        }
                        .buttonStyle(PressScaleStyle())
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(16)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }

    // MARK: 来源图例（原型 .source-key）

    private var sourceKey: some View {
        FlowLayout(spacing: 14) {
            legend(0x5968D9, "正式量表")
            legend(0xA85586, "主题探索")
            legend(0xB77928, "人生卡牌")
            legend(0x258579, "自己填写")
            legend(0x60758A, "日记推断")
        }
        .padding(.top, 2)
    }

    private func legend(_ color: UInt32, _ text: String) -> some View {
        HStack(spacing: 5) {
            Circle().fill(Color(hex: color)).frame(width: 7, height: 7)
            Text(text).font(.system(size: 10.5)).foregroundStyle(Theme.faint)
        }
    }

    // MARK: 动作

    /// 测评结果写入画像（原型 saveHollandToProfile / saveDemoAssessmentToProfile）
    private func saveAssessment(_ kind: AssessmentKind, tags: [String]) {
        if kind == .bigfive {
            var text = "大五：" + tags.prefix(3).joined(separator: " · ")
            if let mbti { text += " · MBTI：\(mbti)" }
            home.savePersonality(text)
        } else if let key = kind.targetDimension {
            home.saveDimension(key, keywords: tags, using: supabase)
        }
        tick += 1
        toast.show("结果已写入画像 · 原始答案默认私密")
    }

    /// MBTI 选择（原型 selectMBTI）
    private func selectMBTI(_ type: String) {
        MBTIStore.save(type)
        mbti = type
        let bigfive = AssessmentModel(kind: .bigfive)
        if bigfive.result != nil {
            home.savePersonality("大五：" + bigfive.resultTags.prefix(3).joined(separator: " · ") + " · MBTI：\(type)")
        } else {
            home.savePersonality("MBTI：\(type)")
        }
        toast.show("已添加 MBTI：\(type)")
    }
}

#Preview {
    ProfileStudioView(home: HomeModel())
        .environment(ToastCenter())
        .environment(SupabaseService())
        .preferredColorScheme(.dark)
}
