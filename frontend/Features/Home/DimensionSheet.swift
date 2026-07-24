import SwiftUI

// MARK: - 动态画像维度浮层（原型 #skillSheet / DIMENSION_CONFIG）
//
// 四个软维度通用：关键词批次（换一批）+ 自定义关键词 + 小工具入口，保存回填画像。

struct DimensionSheet: View {
    let key: DimensionKey
    var initialSelected: [String] = []
    var onSave: ([String]) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastCenter.self) private var toast

    @State private var batch = 0
    @State private var selected: [String] = []      // 系统词（保序）
    @State private var custom: [String] = []         // 自定义词
    @State private var showCustomInput = false
    @State private var customText = ""
    @State private var activeAssessment: AssessmentKind?
    /// 卡牌游戏启动回调（Phase C 接入；nil → toast 占位）
    var onLaunchCardGame: ((String) -> Void)? = nil

    private var cfg: DimensionConfig { DimensionData.config(key) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text(cfg.title).font(.system(size: 19, weight: .bold)).foregroundStyle(Theme.ink)

                HStack {
                    HStack(spacing: 6) {
                        Text("01").foregroundStyle(Theme.blue)
                        Text(cfg.question).foregroundStyle(Theme.ink)
                    }
                    .font(.system(size: 14, weight: .semibold))
                    Spacer()
                    Button("换一批 ↻") { rotateBatch() }
                        .font(.system(size: 12)).foregroundStyle(Theme.blue).buttonStyle(.plain)
                }
                .padding(.top, 20)

                chips.padding(.top, 12)
                sourceLegend.padding(.top, 12)
                customArea.padding(.top, 12)

                HStack(spacing: 6) {
                    Text("02").foregroundStyle(Theme.blue)
                    Text("或者，用小工具继续探索").foregroundStyle(Theme.ink)
                }
                .font(.system(size: 14, weight: .semibold))
                .padding(.top, 22)

                toolGrid.padding(.top, 12)

                PrimaryButton(title: "保存到我的画像") { save() }
                    .padding(.top, 22)
                    .disabled(selected.isEmpty && custom.isEmpty)
                    .opacity(selected.isEmpty && custom.isEmpty ? 0.4 : 1)
            }
            .padding(.horizontal, 24).padding(.top, 8).padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
        .onAppear { if selected.isEmpty { selected = initialSelected } }
        .fullScreenCover(item: $activeAssessment) { kind in
            // 小工具测评：结果写回当前维度（原型 saveDemoAssessmentToProfile 目标一致）
            AssessmentFlowView(kind: kind) { _, tags in
                onSave(tags)
                toast.show("结果已写入画像 · 原始答案默认私密")
                dismiss()
            }
            .environment(toast)
        }
    }

    // MARK: 关键词云

    /// 展示序：已选(不在当前批) + 当前批 + 自定义，去重
    private var chipWords: [(word: String, isCustom: Bool)] {
        let batchWords = cfg.batches[batch]
        let selectedExtra = selected.filter { !batchWords.contains($0) }
        var seen = Set<String>()
        var out: [(String, Bool)] = []
        for w in selectedExtra + batchWords where !seen.contains(w) { seen.insert(w); out.append((w, false)) }
        for w in custom where !seen.contains(w) { seen.insert(w); out.append((w, true)) }
        return out
    }

    private var chips: some View {
        FlowLayout(spacing: 8) {
            ForEach(chipWords, id: \.word) { item in
                chip(item.word, isCustom: item.isCustom)
            }
        }
    }

    private func chip(_ word: String, isCustom: Bool) -> some View {
        let on = isCustom || selected.contains(word)
        return Button {
            toggle(word, isCustom: isCustom)
        } label: {
            Text(word)
                .font(.system(size: 12.5, weight: on ? .medium : .regular))
                .foregroundStyle(on ? .white : Theme.sub)
                .padding(.horizontal, 15).padding(.vertical, 8)
                .background(chipBackground(on: on, isCustom: isCustom), in: Capsule())
                .overlay(Capsule().strokeBorder(chipBorder(on: on, isCustom: isCustom), lineWidth: 1))
        }
        .buttonStyle(PressScaleStyle())
    }

    private func chipBackground(on: Bool, isCustom: Bool) -> Color {
        guard on else { return Theme.raised }
        return isCustom ? Color(hex: 0x2FA98C) : Theme.blueDeep
    }
    private func chipBorder(on: Bool, isCustom: Bool) -> Color {
        guard on else { return Theme.line }
        return isCustom ? Color(hex: 0x3ED9A4, alpha: 0.6) : Color(hex: 0x6FA5FF, alpha: 0.6)
    }

    private var sourceLegend: some View {
        HStack(spacing: 16) {
            legendItem(color: Theme.blueDeep, text: "系统推荐")
            legendItem(color: Color(hex: 0x2FA98C), text: "我添加的")
        }
        .font(.system(size: 11)).foregroundStyle(Theme.faint)
    }

    private func legendItem(color: Color, text: String) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(text)
        }
    }

    // MARK: 自定义关键词

    private var customArea: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                withAnimation(.easeOut(duration: 0.2)) { showCustomInput.toggle() }
            } label: {
                Text("＋ 自己输入一个关键词")
                    .font(.system(size: 12.5)).foregroundStyle(Theme.blue)
            }
            .buttonStyle(.plain)

            if showCustomInput {
                HStack(spacing: 8) {
                    TextField("输入一个最像你的词", text: $customText)
                        .font(.system(size: 13)).foregroundStyle(Theme.ink).tint(Theme.blue)
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .background(Theme.raised, in: Capsule())
                        .overlay(Capsule().strokeBorder(Theme.line, lineWidth: 1))
                        .submitLabel(.done)
                        .onSubmit(addCustom)
                    Button("添加", action: addCustom)
                        .font(.system(size: 12.5, weight: .semibold)).foregroundStyle(.white)
                        .padding(.horizontal, 16).padding(.vertical, 10)
                        .background(Theme.buttonGradient, in: Capsule())
                        .buttonStyle(.plain)
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    // MARK: 小工具

    private var toolGrid: some View {
        VStack(spacing: 11) {
            ForEach(cfg.tools) { tool in
                Button {
                    if let kind = tool.assessment {
                        activeAssessment = kind
                    } else if let game = tool.cardGame, let onLaunchCardGame {
                        onLaunchCardGame(game)
                    } else {
                        toast.show("「\(tool.name)」即将上线")
                    }
                } label: {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(tool.name).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink)
                            Text(tool.desc).font(.system(size: 11)).foregroundStyle(Theme.sub).lineSpacing(2)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        Text(tool.duration).font(.system(size: 10.5)).foregroundStyle(Color(hex: 0x9DBCFF))
                            .padding(.horizontal, 9).padding(.vertical, 3)
                            .background(Color.white.opacity(0.08), in: Capsule())
                            .fixedSize()
                    }
                    .padding(.horizontal, 15).padding(.vertical, 14)
                    .frame(maxWidth: .infinity)
                    .background(toolBackground(tool.tint))
                    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.white.opacity(0.1), lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(PressScaleStyle())
            }
        }
    }

    private func toolBackground(_ tint: UInt32) -> some View {
        ZStack(alignment: .topTrailing) {
            Color(hex: tint)
            RadialGradient(colors: [Color.white.opacity(0.12), .clear], center: .topTrailing, startRadius: 0, endRadius: 150)
        }
    }

    // MARK: 动作

    private func rotateBatch() {
        withAnimation(.easeOut(duration: 0.2)) { batch = (batch + 1) % cfg.batches.count }
    }

    private func toggle(_ word: String, isCustom: Bool) {
        if isCustom {
            custom.removeAll { $0 == word }
        } else if let i = selected.firstIndex(of: word) {
            selected.remove(at: i)
        } else {
            selected.append(word)
        }
    }

    private func addCustom() {
        let w = customText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !w.isEmpty, !custom.contains(w), !selected.contains(w) else { customText = ""; return }
        custom.append(w)
        customText = ""
    }

    private func save() {
        let keywords = Array((selected + custom).prefix(5))
        guard !keywords.isEmpty else { return }
        onSave(keywords)
        toast.show("已保存到你的画像")
        dismiss()
    }
}

#Preview {
    Color.black.sheet(isPresented: .constant(true)) {
        DimensionSheet(key: .skill) { _ in }
            .environment(ToastCenter())
            .presentationBackground(Color(hex: 0x10131C))
            .preferredColorScheme(.dark)
    }
}
