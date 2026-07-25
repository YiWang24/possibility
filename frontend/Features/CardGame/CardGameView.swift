import SwiftUI

// MARK: - 卡牌游戏（原型 #lifeGame / #relationshipGame / #valueGame 通用界面）
//
// intro → 选 9 张（竖向列表）→ 抽情境（扇形背面牌，翻牌）→ 决策 → 交换 → 结果。

struct CardGameView: View {
    let kind: CardGameKind
    let home: HomeModel

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastCenter.self) private var toast
    @Environment(SupabaseService.self) private var supabase
    @State private var engine: CardGameEngine
    /// 结果页动画
    @State private var resultAppeared = false

    init(kind: CardGameKind, home: HomeModel) {
        self.kind = kind
        self.home = home
        _engine = State(initialValue: CardGameEngine(kind: kind))
    }

    private var cfg: CardGameConfig { engine.config }
    private var accent: Color { Color(hex: cfg.accent) }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            switch engine.phase {
            case .intro: intro
            case .select: select
            case .draw: draw
            case .decision: decision
            case .trade: trade
            case .result: result
            }
        }
        .background(Theme.paper.ignoresSafeArea())
        .animation(.easeOut(duration: 0.25), value: engine.phaseKey)
    }

    // MARK: 顶栏

    private var topInfo: (title: String, sub: String, progressText: String) {
        switch engine.phase {
        case .intro:
            return (cfg.title, "一次关于取舍的模拟", "准备开始")
        case .select:
            return ("选择\(cfg.title.prefix(2))底牌", "向下滑动浏览全部 \(cfg.cards.count) 张", "已选 \(engine.selected.count)/9")
        case .trade:
            return ("交换底牌", "选择 2 张牌作为代价", "已选 \(engine.tradePick.count)/2")
        case .result:
            return ("这一局的回望", "结果默认仅自己可见", "完成")
        default:
            let stage = engine.stageMeta
            return (stage.age, "\(stage.name) · 持有 \(engine.held.count) 张底牌", "第 \(engine.round + 1) 轮")
        }
    }

    private var topBar: some View {
        let info = topInfo
        return HStack(spacing: 12) {
            Button { back() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                    .frame(width: 34, height: 34)
                    .background(Theme.raised, in: Circle())
            }
            .buttonStyle(PressScaleStyle())
            .accessibilityLabel("返回")
            VStack(alignment: .leading, spacing: 2) {
                Text(info.title).font(.system(size: 15.5, weight: .bold)).foregroundStyle(Theme.ink)
                Text(info.sub).font(.system(size: 10.5)).foregroundStyle(Theme.faint)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 5) {
                Capsule().fill(Theme.raised)
                    .overlay(alignment: .leading) {
                        GeometryReader { geo in
                            Capsule().fill(LinearGradient(colors: [accent, accent.opacity(0.6)],
                                                          startPoint: .leading, endPoint: .trailing))
                                .frame(width: geo.size.width * engine.progress())
                        }
                    }
                    .frame(width: 70, height: 4)
                Text(info.progressText).font(.system(size: 10)).monospacedDigit().foregroundStyle(Theme.faint)
            }
        }
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 12)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    private func back() {
        switch engine.phase {
        case .trade: engine.phase = .decision
        case .decision: engine.phase = .draw
        case .draw:
            toast.show("\(cfg.title)进度已为你保留")
            dismiss()
        default: dismiss()
        }
    }

    // MARK: intro

    private var intro: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    fanSpread.frame(maxWidth: .infinity).padding(.top, 12)
                    Text(cfg.eyebrow)
                        .font(.system(size: 9.5, weight: .semibold)).tracking(2.6)
                        .foregroundStyle(accent.opacity(0.9))
                    Text(cfg.introTitle)
                        .font(.system(size: 23, weight: .bold)).lineSpacing(7).foregroundStyle(Theme.ink)
                    Text(cfg.introCopy)
                        .font(.system(size: 12.5)).lineSpacing(6).foregroundStyle(Theme.sub)
                    VStack(spacing: 10) {
                        ForEach(Array(cfg.rules.enumerated()), id: \.offset) { idx, rule in
                            HStack(alignment: .top, spacing: 12) {
                                Text(String(format: "%02d", idx + 1))
                                    .font(.system(size: 11, weight: .bold)).foregroundStyle(accent)
                                    .frame(width: 28, height: 28)
                                    .background(accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(rule.0).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.ink)
                                    Text(rule.1).font(.system(size: 11)).lineSpacing(3).foregroundStyle(Theme.sub)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(12)
                            .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
                        }
                    }
                    if let warning = cfg.contentWarning {
                        Text(warning)
                            .font(.system(size: 10.5)).lineSpacing(4).foregroundStyle(Theme.faint)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(Color(hex: 0xFF7A4D, alpha: 0.07), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .strokeBorder(Color(hex: 0xFF7A4D, alpha: 0.22), lineWidth: 1))
                    }
                }
                .padding(.horizontal, 24).padding(.top, 14).padding(.bottom, 26)
            }
            foot(primary: ("开始这一局", { engine.start() }), enabled: true)
        }
    }

    /// 顶部扇形装饰牌（原型 .linear-spread）
    private var fanSpread: some View {
        ZStack {
            ForEach(0..<5, id: \.self) { i in
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(LinearGradient(colors: [accent.opacity(0.55), accent.opacity(0.2)],
                                         startPoint: .topLeading, endPoint: .bottomTrailing))
                    .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .strokeBorder(.white.opacity(0.2), lineWidth: 1))
                    .frame(width: 52, height: 74)
                    .rotationEffect(.degrees(Double(i - 2) * 11))
                    .offset(x: Double(i - 2) * 26, y: abs(Double(i - 2)) * 6)
            }
        }
        .frame(height: 96)
    }

    // MARK: 选牌

    private var select: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("YOUR FOUNDATION")
                                .font(.system(size: 9, weight: .semibold)).tracking(2.2)
                                .foregroundStyle(accent.opacity(0.9))
                            Text(cfg.selectTitle)
                                .font(.system(size: 19, weight: .bold)).foregroundStyle(Theme.ink)
                        }
                        Spacer()
                        VStack(spacing: 1) {
                            Text("已选").font(.system(size: 9.5)).foregroundStyle(Theme.faint)
                            HStack(alignment: .lastTextBaseline, spacing: 1) {
                                Text("\(engine.selected.count)").font(.system(size: 20, weight: .heavy)).foregroundStyle(accent)
                                    .contentTransition(.numericText())
                                Text("/9").font(.system(size: 11)).foregroundStyle(Theme.faint)
                            }
                        }
                    }
                    GeometryReader { geo in
                        Capsule().fill(Theme.raised)
                            .overlay(alignment: .leading) {
                                Capsule().fill(accent)
                                    .frame(width: geo.size.width * Double(engine.selected.count) / 9)
                                    .animation(.easeOut(duration: 0.25), value: engine.selected.count)
                            }
                    }
                    .frame(height: 4)
                    Text("没有标准答案，此刻的选择只代表这一局")
                        .font(.system(size: 10.5)).foregroundStyle(Theme.faint)

                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        ForEach(Array(cfg.cards.enumerated()), id: \.element.id) { idx, card in
                            selectCard(card, index: idx)
                        }
                    }
                    .padding(.top, 4)
                    Text("已展示全部 \(cfg.cards.count) 张底牌")
                        .font(.system(size: 10.5)).foregroundStyle(Theme.faint)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 6)
                }
                .padding(.horizontal, 22).padding(.top, 14).padding(.bottom, 24)
            }
            foot(primary: (engine.selected.count == 9 ? "带着这 9 张牌出发" : "还需选择 \(9 - engine.selected.count) 张",
                           { engine.confirmSelection() }),
                 enabled: engine.selected.count == 9)
        }
    }

    private func selectCard(_ card: GameCard, index: Int) -> some View {
        let on = engine.selected.contains(card.id)
        return Button {
            if let message = engine.toggleSelect(card.id) { toast.show(message) }
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("\(cfg.cardPrefix) · \(String(format: "%02d", index + 1))")
                        .font(.system(size: 7.5, weight: .semibold)).tracking(1).foregroundStyle(Theme.faint)
                    Spacer()
                    Text(on ? "✓" : "+")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(on ? .white : Theme.faint)
                        .frame(width: 19, height: 19)
                        .background(on ? accent : Theme.raised, in: Circle())
                }
                Text(card.glyph).font(.system(size: 21)).foregroundStyle(on ? accent : Theme.sub)
                VStack(alignment: .leading, spacing: 2) {
                    Text(card.name).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Theme.ink)
                        .lineLimit(1).minimumScaleFactor(0.8)
                    Text(card.group).font(.system(size: 9.5)).foregroundStyle(Theme.faint)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(on ? accent.opacity(0.1) : Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(on ? accent.opacity(0.65) : Theme.line, lineWidth: on ? 1.4 : 1))
            .shadow(color: on ? accent.opacity(0.22) : .clear, radius: 10, y: 4)
        }
        .buttonStyle(PressScaleStyle())
    }

    // MARK: 抽牌（扇形背面牌）

    private var draw: some View {
        let options = engine.scenarioOptions
        let severity = engine.severityMeta
        return ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("STAGE \(String(format: "%02d", engine.round + 1)) · \(engine.stageMeta.age)")
                        .font(.system(size: 9.5, weight: .semibold)).tracking(2)
                        .foregroundStyle(accent.opacity(0.9))
                    Text(engine.stageMeta.name).font(.system(size: 21, weight: .bold)).foregroundStyle(Theme.ink)
                    Text(engine.acceptStreak > 0
                         ? "你已连续接受 \(engine.acceptStreak) 次，压力正在加码。"
                         : "命运放下了五张牌。凭直觉，抽一张。")
                        .font(.system(size: 12)).foregroundStyle(Theme.sub)
                }

                // 压力表（原型 .fate-pressure）
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(cfg.pressureLabel).font(.system(size: 10.5)).foregroundStyle(Theme.faint)
                        Spacer()
                        Text(severity.name).font(.system(size: 12.5, weight: .bold)).foregroundStyle(pressureColor)
                    }
                    HStack(spacing: 5) {
                        ForEach(1...4, id: \.self) { level in
                            Capsule()
                                .fill(level <= engine.pressure ? pressureColor : Theme.raised)
                                .frame(height: 4)
                        }
                    }
                    Text(severity.copy).font(.system(size: 11)).lineSpacing(3).foregroundStyle(Theme.sub)
                }
                .padding(13)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(pressureColor.opacity(0.3), lineWidth: 1))

                // 可滑动扇形牌弧（原型 .stamp-scroll / .stamp-arc）
                fanArc(options)

                Text("左右滑动牌弧 · 点击其中一张")
                    .font(.system(size: 10.5)).foregroundStyle(Theme.faint)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 24).padding(.top, 16).padding(.bottom, 26)
        }
    }

    private var pressureColor: Color {
        [Color(hex: 0x7CABFF), Color(hex: 0xD9B563), Color(hex: 0xFF9A6B), Color(hex: 0xF06A6A)][engine.pressure - 1]
    }

    // MARK: 扇形牌弧
    //
    // 牌位用 .position 真实布局（而非 offset/rotation 纯视觉变换），
    // 保证任意 iOS 版本上命中区域与牌面位置一致 —— 修复真机上扇形牌点不中的问题。
    // 牌弧宽于屏幕，放在横向 ScrollView 中左右滑动浏览（原型「左右滑动牌弧」）。

    /// 牌弧几何（原型 .stamp-arc：460 宽、牌 120×165、扇形 ±146px / ±25°、中间牌最高最上层）
    private static let arcW: CGFloat = 460
    private static let arcH: CGFloat = 214

    private func fanArc(_ options: [GameScenario]) -> some View {
        let mid = CGFloat(options.count - 1) / 2
        return ScrollView(.horizontal, showsIndicators: false) {
            ZStack {
                ForEach(Array(options.enumerated()), id: \.offset) { i, scenario in
                    let d = CGFloat(i) - mid
                    Button {
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                            engine.draw(scenario)
                        }
                    } label: {
                        faceDownCard
                            .rotationEffect(.degrees(Double(d) * 12.5))
                    }
                    .buttonStyle(PressScaleStyle(scale: 0.94))
                    // 弧线：中间高、两侧低（原型 y = -10 / 7 / 28）
                    .position(x: Self.arcW / 2 + d * 73,
                              y: Self.arcH / 2 - 8 + (2 * d * d + 15 * abs(d) - 10))
                    .zIndex(-abs(Double(d)))   // 中间牌在最上层（原型 z 金字塔）
                    .accessibilityLabel("抽第 \(i + 1) 张牌")
                }
            }
            .frame(width: Self.arcW, height: Self.arcH)
        }
        .defaultScrollAnchor(.center)
        .scrollClipDisabled()
        .frame(height: Self.arcH)
        .padding(.top, 10)
    }

    private var faceDownCard: some View {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(LinearGradient(colors: [Color(hex: 0x232948), Color(hex: 0x161A30)],
                                 startPoint: .topLeading, endPoint: .bottomTrailing))
            .overlay(
                Text("✦")
                    .font(.system(size: 21)).foregroundStyle(accent.opacity(0.5))
            )
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(accent.opacity(0.35), lineWidth: 1))
            .frame(width: 120, height: 165)
            .shadow(color: .black.opacity(0.45), radius: 10, y: 6)
    }

    // MARK: 决策

    private var decision: some View {
        let scenario = engine.current!
        let severity = engine.severityMeta
        return VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 15) {
                    Text("第 \(engine.round + 1) 轮 · \(engine.config.kind == .life ? engine.stageMeta.name : scenario.theme)")
                        .font(.system(size: 10.5, weight: .semibold)).foregroundStyle(Theme.sub)
                        .padding(.horizontal, 12).padding(.vertical, 5)
                        .background(Theme.raised, in: Capsule())

                    // 情境卡（翻牌进入）
                    VStack(alignment: .leading, spacing: 11) {
                        Text("\(cfg.cardPrefix) · SETBACK \(String(format: "%02d", engine.round + 1))")
                            .font(.system(size: 8.5, weight: .semibold)).tracking(2)
                            .foregroundStyle(.white.opacity(0.55))
                        Text(cfg.glyph).font(.system(size: 22)).foregroundStyle(.white.opacity(0.4))
                            .frame(maxWidth: .infinity, alignment: .trailing)
                        Text(scenario.title).font(.system(size: 21, weight: .bold)).foregroundStyle(.white)
                        Text(scenario.copy).font(.system(size: 12.5)).lineSpacing(5).foregroundStyle(.white.opacity(0.78))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                    .background(
                        LinearGradient(colors: [accent.opacity(0.75), accent.opacity(0.35), Color(hex: 0x161A30)],
                                       startPoint: .topLeading, endPoint: .bottomTrailing),
                        in: RoundedRectangle(cornerRadius: 20, style: .continuous)
                    )
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .strokeBorder(.white.opacity(0.2), lineWidth: 1))
                    .transition(.asymmetric(insertion: .scale(scale: 0.8).combined(with: .opacity), removal: .opacity))

                    Text("\(severity.name) · 拒绝需交换 2 张")
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(pressureColor)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(pressureColor.opacity(0.1), in: Capsule())
                        .overlay(Capsule().strokeBorder(pressureColor.opacity(0.4), lineWidth: 1))

                    Text("接受它，会保留所有底牌，但下一轮会继续加码；\n拒绝它，则放下 2 张底牌。直到手中自然只剩三张。")
                        .font(.system(size: 11.5)).lineSpacing(5).foregroundStyle(Theme.sub)
                        .multilineTextAlignment(.center)

                    // 持有条
                    FlowLayout(spacing: 6) {
                        ForEach(engine.heldCards) { card in
                            Text(card.name).font(.system(size: 10.5)).foregroundStyle(Theme.sub)
                                .padding(.horizontal, 9).padding(.vertical, 4)
                                .background(Theme.raised, in: Capsule())
                        }
                    }
                }
                .padding(.horizontal, 24).padding(.top, 16).padding(.bottom, 20)
            }
            HStack(spacing: 12) {
                Button("接受它") {
                    withAnimation(.easeOut(duration: 0.25)) { engine.accept() }
                }
                .font(.system(size: 13.5, weight: .semibold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(Theme.buttonGradient, in: Capsule())
                .buttonStyle(PressScaleStyle())

                Button(engine.canTrade ? "我不接受" : "只剩最终底牌") {
                    withAnimation(.easeOut(duration: 0.25)) { engine.beginTrade() }
                }
                .font(.system(size: 13.5, weight: .semibold)).foregroundStyle(engine.canTrade ? Color(hex: 0xFF9A8A) : Theme.faint)
                .frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(Color(hex: 0xFF6A5C, alpha: engine.canTrade ? 0.12 : 0.05), in: Capsule())
                .overlay(Capsule().strokeBorder(Color(hex: 0xFF6A5C, alpha: engine.canTrade ? 0.45 : 0.15), lineWidth: 1))
                .buttonStyle(PressScaleStyle())
                .disabled(!engine.canTrade)
            }
            .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 14)
            .overlay(alignment: .top) { Rectangle().fill(Theme.line).frame(height: 1) }
        }
    }

    // MARK: 交换

    private var trade: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("THE PRICE")
                            .font(.system(size: 9, weight: .semibold)).tracking(2.2)
                            .foregroundStyle(accent.opacity(0.9))
                        Text("你愿意用什么交换？").font(.system(size: 19, weight: .bold)).foregroundStyle(Theme.ink)
                    }
                    Text("为了让“\(engine.current?.title ?? "")”不发生，请从仍持有的 \(engine.held.count) 张底牌中放下 2 张。最后三张会被保留。")
                        .font(.system(size: 11.5)).lineSpacing(5).foregroundStyle(Theme.sub)
                        .padding(12)
                        .background(accent.opacity(0.07), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .strokeBorder(accent.opacity(0.25), lineWidth: 1))

                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        ForEach(Array(engine.heldCards.enumerated()), id: \.element.id) { idx, card in
                            tradeCard(card, index: idx)
                        }
                    }

                    reasonField(label: "为什么你不能接受这件事？", hint: "写下第一反应",
                                placeholder: "例如：我无法接受重要的人因为我受到伤害……",
                                text: Bindable(engine).reasonCannotAccept)
                    reasonField(label: "为什么愿意放弃这 2 张牌？", hint: "没有标准答案",
                                placeholder: "例如：这些东西可以以后再争取……",
                                text: Bindable(engine).reasonAbandon)
                    Text("你的原话会成为结果分析的重要依据，默认只进入私密画像。")
                        .font(.system(size: 10)).foregroundStyle(Theme.faint)
                }
                .padding(.horizontal, 22).padding(.top, 16).padding(.bottom, 20)
            }
            foot(primary: ("确认交换 2 张牌", {
                withAnimation(.easeOut(duration: 0.25)) { engine.confirmTrade() }
            }), enabled: engine.tradePick.count == 2)
        }
    }

    private func tradeCard(_ card: GameCard, index: Int) -> some View {
        let picked = engine.tradePick.contains(card.id)
        return Button {
            if let message = engine.toggleTrade(card.id) { toast.show(message) }
        } label: {
            HStack(spacing: 10) {
                Text(card.glyph).font(.system(size: 16)).foregroundStyle(picked ? Color(hex: 0xFF9A8A) : Theme.sub)
                VStack(alignment: .leading, spacing: 2) {
                    Text(card.name).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.ink)
                        .lineLimit(1).minimumScaleFactor(0.8)
                    Text(card.group).font(.system(size: 9.5)).foregroundStyle(Theme.faint)
                }
                Spacer(minLength: 0)
                Text(picked ? "×" : "")
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(Color(hex: 0xFF9A8A))
            }
            .padding(.horizontal, 12).padding(.vertical, 12)
            .background(picked ? Color(hex: 0xFF6A5C, alpha: 0.1) : Theme.card,
                        in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous)
                .strokeBorder(picked ? Color(hex: 0xFF6A5C, alpha: 0.55) : Theme.line, lineWidth: picked ? 1.4 : 1))
        }
        .buttonStyle(PressScaleStyle())
    }

    private func reasonField(label: String, hint: String, placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text(label).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.ink)
                Spacer()
                Text(hint).font(.system(size: 10)).foregroundStyle(Theme.faint)
            }
            TextField("", text: text,
                      prompt: Text(placeholder).foregroundColor(Theme.faint), axis: .vertical)
                .font(.system(size: 12.5)).foregroundStyle(Theme.ink).tint(Theme.blue)
                .lineLimit(2...4)
                .padding(11)
                .background(Theme.raised, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
        }
    }

    // MARK: 结果

    private var result: some View {
        VStack(spacing: 0) {
            ScrollView {
                if kind == .life {
                    lifeResult
                } else {
                    relationResult
                }
            }
            .scrollIndicators(.hidden)
            foot(primary: (kind == .life ? "保存到我的私密画像" : "保存最关心的三点", { saveAndClose() }), enabled: true)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.7).delay(0.15)) { resultAppeared = true }
        }
    }

    private func saveAndClose() {
        let tags = engine.saveResult(home: home, supabase: supabase)
        if kind == .life {
            toast.show("三张底牌已融入动态画像 · 深层分析保持私密")
        } else {
            toast.show("\(cfg.title.prefix(2))中最关心的三点已写入画像：\(tags.joined(separator: " · "))")
        }
        dismiss()
    }

    /// 婚姻 / 家庭 / 人际结果（原型 renderRelationshipResult）
    private var relationResult: some View {
        let cards = engine.heldCards
        return VStack(spacing: 16) {
            Text(cfg.glyph).font(.system(size: 30)).foregroundStyle(accent)
                .frame(width: 66, height: 66)
                .background(accent.opacity(0.12), in: Circle())
                .overlay(Circle().strokeBorder(accent.opacity(0.4), lineWidth: 1))
            Text("\(cfg.title.prefix(2))中，你最关心这三点")
                .font(.system(size: 19, weight: .bold)).foregroundStyle(Theme.ink)
            Text("\(engine.groupNarrative)\n它们来自多轮情境与交换，不是固定答案，而是你此刻真实的优先级。")
                .font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub)
                .multilineTextAlignment(.center)

            HStack(spacing: 10) {
                ForEach(cards) { card in
                    VStack(spacing: 7) {
                        Text(card.glyph).font(.system(size: 19)).foregroundStyle(accent)
                        Text(card.name).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.ink)
                            .lineLimit(1).minimumScaleFactor(0.75)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 16)
                    .background(accent.opacity(0.09), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(accent.opacity(0.4), lineWidth: 1))
                    .scaleEffect(resultAppeared ? 1 : 0.85)
                    .opacity(resultAppeared ? 1 : 0)
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("SIGNAL · 可写入画像")
                    .font(.system(size: 9, weight: .semibold)).tracking(2)
                    .foregroundStyle(accent.opacity(0.9))
                Text(cards.map(\.name).joined(separator: " · "))
                    .font(.system(size: 14.5, weight: .bold)).foregroundStyle(Theme.ink)
                Text("本次经历了 \(engine.round) 轮情境，接受 \(engine.accepted.count) 次、主动交换 \(engine.traded.count) 次。这三点会成为画像的优先信号。")
                    .font(.system(size: 11.5)).lineSpacing(5).foregroundStyle(Theme.sub)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(15)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
        }
        .padding(.horizontal, 24).padding(.top, 22).padding(.bottom, 20)
    }

    /// 人生卡牌结果（原型 renderLifeResult：真相 / 原话线索 / 光谱 / 张力 / 盲点 / 反问）
    private var lifeResult: some View {
        let a = engine.lifeAnalysis()
        return VStack(spacing: 16) {
            Circle()
                .fill(AngularGradient(colors: Theme.orbConicColors, center: .center))
                .frame(width: 62, height: 62)
                .overlay(Circle().fill(RadialGradient(colors: [Color(hex: 0x0B0E17, alpha: 0.2), Color(hex: 0x0B0E17, alpha: 0.75)], center: .center, startRadius: 2, endRadius: 30)))
                .overlay(Circle().strokeBorder(.white.opacity(0.25), lineWidth: 1))
            VStack(spacing: 6) {
                Text("你的动态数字人 · 新切面")
                    .font(.system(size: 9.5, weight: .semibold)).tracking(2).foregroundStyle(Theme.faint)
                Text(a.title).font(.system(size: 22, weight: .heavy)).foregroundStyle(Theme.aurora)
                Text("这不是在判断你好或不好，\n而是在看代价出现时，你最先保护了什么。")
                    .font(.system(size: 11.5)).lineSpacing(4).foregroundStyle(Theme.sub)
                    .multilineTextAlignment(.center)
            }

            resultBlock(kicker: "THE TRUTH BENEATH · 内心真相", tint: 0x8F7BFF) {
                Text(a.truth).font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.ink.opacity(0.92))
                Text("判断来自你留下、典当和为之接受挫折的牌，而不只是最终结果。")
                    .font(.system(size: 9.5)).foregroundStyle(Theme.faint)
            }

            if !a.voiceQuotes.isEmpty {
                resultBlock(kicker: "YOUR OWN WORDS · 你亲口说出的线索", tint: 0x3ED9A4) {
                    ForEach(Array(a.voiceQuotes.enumerated()), id: \.offset) { _, quote in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(quote.label).font(.system(size: 10.5, weight: .semibold)).foregroundStyle(Color(hex: 0x8EE7C8))
                            Text("“\(quote.text)”").font(.system(size: 11.5)).italic().lineSpacing(4).foregroundStyle(Theme.sub)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(10)
                        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    Text(a.reasonInsight).font(.system(size: 11)).lineSpacing(4).foregroundStyle(Theme.sub)
                }
            }

            resultBlock(kicker: "将融入动态画像的三张底牌", tint: 0x5E96FF) {
                HStack(spacing: 8) {
                    ForEach(a.held) { card in
                        HStack(spacing: 5) {
                            Text(card.glyph).font(.system(size: 12))
                            Text(card.name).font(.system(size: 11.5, weight: .medium)).lineLimit(1).minimumScaleFactor(0.7)
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 11)
                        .background(Theme.hue(0).gradient.opacity(0.85), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                    }
                }
            }

            // 心理倾向光谱
            resultBlock(kicker: "你的心理倾向光谱", tint: 0x8F7BFF) {
                ForEach(Array(a.spectrum.enumerated()), id: \.offset) { _, row in
                    VStack(spacing: 5) {
                        HStack {
                            Text(row.left).font(.system(size: 10)).foregroundStyle(Theme.faint)
                            Spacer()
                            Text(row.right).font(.system(size: 10)).foregroundStyle(Theme.faint)
                        }
                        GeometryReader { geo in
                            Capsule().fill(Theme.raised).frame(height: 4).frame(maxHeight: .infinity, alignment: .center)
                            Circle().fill(Color(hex: 0x9F8DF5))
                                .overlay(Circle().strokeBorder(Color(hex: 0x7666D9), lineWidth: 2).padding(-1))
                                .frame(width: 12, height: 12)
                                .position(x: geo.size.width * (resultAppeared ? Double(row.value) / 100 : 0.5),
                                          y: geo.size.height / 2)
                        }
                        .frame(height: 14)
                    }
                }
            }

            resultBlock(kicker: "INNER TENSION · 内在张力", tint: 0xE35CC1) {
                Text("你想拥有的，和你会拿去交换的").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.ink)
                Text(a.tension).font(.system(size: 11.5)).lineSpacing(5).foregroundStyle(Theme.sub)
            }
            resultBlock(kicker: "POSSIBLE BLIND SPOT · 可能的盲点", tint: 0xFF7A4D) {
                Text(a.blindspot).font(.system(size: 11.5)).lineSpacing(5).foregroundStyle(Theme.sub)
            }
            resultBlock(kicker: "留给真实生活的一个问题", tint: 0x9DBCFF) {
                Text(a.reflection).font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.ink.opacity(0.9))
            }

            Text("本次推断基于：接受 \(a.acceptedCount) 次挫折、主动交换 \(a.tradedCount) 次、最终保留 \(a.held.count) 张底牌。它是一面自我探索的镜子，不是心理诊断。")
                .font(.system(size: 9.5)).lineSpacing(4).foregroundStyle(Theme.faint)
            HStack(alignment: .top, spacing: 8) {
                Text("◉").font(.system(size: 11)).foregroundStyle(Color(hex: 0x8EE7C8))
                Text("三张人生底牌会作为画像信号融入动态数字形象；其余 \(a.hiddenTraits.count) 条深层推断仍默认私密，只用于帮助数字人理解你。")
                    .font(.system(size: 10)).lineSpacing(4).foregroundStyle(Theme.faint)
            }
            .padding(11)
            .background(Color(hex: 0x3ED9A4, alpha: 0.06), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .padding(.horizontal, 24).padding(.top, 22).padding(.bottom, 20)
    }

    private func resultBlock(kicker: String, tint: UInt32, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(kicker)
                .font(.system(size: 9, weight: .semibold)).tracking(1.8)
                .foregroundStyle(Color(hex: tint, alpha: 0.95))
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(15)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
            .strokeBorder(Color(hex: tint, alpha: 0.22), lineWidth: 1))
    }

    // MARK: 底部按钮

    private func foot(primary: (String, () -> Void), enabled: Bool) -> some View {
        Button(primary.0, action: primary.1)
            .font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
            .frame(maxWidth: .infinity).padding(.vertical, 15)
            .background(Theme.buttonGradient, in: Capsule())
            .buttonStyle(PressScaleStyle())
            .disabled(!enabled)
            .opacity(enabled ? 1 : 0.45)
            .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 14)
            .overlay(alignment: .top) { Rectangle().fill(Theme.line).frame(height: 1) }
    }
}

// 动画触发用的 phase 标识
extension CardGameEngine {
    var phaseKey: Int {
        switch phase {
        case .intro: return 0
        case .select: return 1
        case .draw: return 2
        case .decision: return 3
        case .trade: return 4
        case .result: return 5
        }
    }
}

#Preview {
    CardGameView(kind: .marriage, home: HomeModel())
        .environment(ToastCenter())
        .environment(SupabaseService())
        .preferredColorScheme(.dark)
}
