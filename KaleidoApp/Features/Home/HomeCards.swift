import SwiftUI

// MARK: - 首页 AI 发问卡（原型 .ask）

struct HomeAskCard: View {
    @Bindable var model: HomeModel
    var onSend: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("今天想探索什么")
                .font(.system(size: 11)).tracking(3.5)
                .foregroundStyle(Color(hex: 0x9DBCFF))
                .overlay(alignment: .leading) {
                    Rectangle().fill(Color(hex: 0x9DBCFF, alpha: 0.6))
                        .frame(width: 18, height: 1.5).offset(x: -26)
                }
                .padding(.leading, 26)

            (Text("说出那个\n") + Text("在心里盘旋").foregroundColor(Theme.blue) + Text("的问题"))
                .font(.system(size: 22, weight: .bold)).lineSpacing(6)
                .foregroundStyle(Theme.ink)
                .padding(.top, 12)

            askBox.padding(.top, 16)

            FlowLayout(spacing: 8) {
                ForEach(ExploreTopic.allCases) { t in
                    softChip(t)
                }
            }
            .padding(.top, 14)
        }
        .padding(.horizontal, 22).padding(.top, 24).padding(.bottom, 22)
        .background(askBackground)
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).strokeBorder(Color(hex: 0x7A9EFF, alpha: 0.3), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    }

    private var askBox: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let topic = model.topic {
                HStack(spacing: 5) {
                    Text("✦").font(.system(size: 11))
                    Text(topic.rawValue).font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(Color(hex: 0x9DBCFF))
                .padding(.horizontal, 11).padding(.vertical, 4)
                .background(Color(hex: 0x5E96FF, alpha: 0.16), in: Capsule())
                .overlay(Capsule().strokeBorder(Color(hex: 0x5E96FF, alpha: 0.4), lineWidth: 1))
            }

            TextField("", text: $model.question, prompt: Text("写下任何正在心里盘旋的问题…").foregroundColor(Theme.faint), axis: .vertical)
                .font(.system(size: 15)).lineSpacing(4).foregroundStyle(Theme.ink)
                .focused($focused)
                .lineLimit(2...4)
                .tint(Theme.blue)
                .padding(.trailing, model.trimmedQuestion.isEmpty ? 0 : 26)

            HStack {
                Spacer()
                Button("发送") { focused = false; onSend() }
                    .font(.system(size: 13.5, weight: .semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 24).padding(.vertical, 10)
                    .background(Theme.buttonGradient, in: Capsule())
                    .shadow(color: Color(hex: 0x4F7DFF, alpha: 0.6), radius: 10, y: 6)
                    .buttonStyle(PressScaleStyle())
                    .disabled(!model.canSend)
                    .opacity(model.canSend ? 1 : 0.4)
            }
            .padding(.top, 2)
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(Color(hex: 0x060810, alpha: 0.45), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.white.opacity(0.12), lineWidth: 1))
        .overlay(alignment: .topTrailing) {
            // 清空按钮（原型 .ask-clear）：仅有文本时显示
            if !model.trimmedQuestion.isEmpty {
                Button {
                    model.question = ""
                    focused = true
                } label: {
                    Text("×").font(.system(size: 18)).foregroundStyle(Color(hex: 0xAEB7CC))
                        .frame(width: 24, height: 24)
                        .background(Color.white.opacity(0.08), in: Circle())
                }
                .buttonStyle(.plain)
                .padding(.top, 11).padding(.trailing, 13)
                .accessibilityLabel("清空输入")
            }
        }
    }

    private func softChip(_ t: ExploreTopic) -> some View {
        let on = model.topic == t
        return Button {
            withAnimation(.easeOut(duration: 0.18)) { model.topic = on ? nil : t }
        } label: {
            Text(t.rawValue)
                .font(.system(size: 12.5))
                .foregroundStyle(on ? Color(hex: 0x9DBCFF) : Theme.sub)
                .padding(.horizontal, 15).padding(.vertical, 8)
                .background(on ? Color(hex: 0x5E96FF, alpha: 0.14) : Color.white.opacity(0.07), in: Capsule())
                .overlay(Capsule().strokeBorder(on ? Color(hex: 0x5E96FF, alpha: 0.5) : Color.white.opacity(0.1), lineWidth: 1))
        }
        .buttonStyle(PressScaleStyle())
    }

    private var askBackground: some View {
        ZStack(alignment: .topTrailing) {
            LinearGradient(colors: [Color(hex: 0x141A34), Color(hex: 0x1A2350), Color(hex: 0x10132A)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            RadialGradient(colors: [Color(hex: 0x6FA5FF, alpha: 0.35), .clear],
                           center: .topTrailing, startRadius: 0, endRadius: 200)
            // 熔岩灯：metaball 场（蓝顶 → 品红底），blob 竖向慢漂移、相吸融合
            LavaLampView(
                specs: [
                    LavaBlobSpec(baseX: 0.78, baseY: 0.16, ampX: 0.14, ampY: 0.22, periodX: 13, periodY: 17, phase: 1.0, radius: 0.30),
                    LavaBlobSpec(baseX: 0.18, baseY: 0.80, ampX: 0.16, ampY: 0.30, periodX: 15, periodY: 19, phase: 2.6, radius: 0.26),
                    LavaBlobSpec(baseX: 0.46, baseY: 0.46, ampX: 0.18, ampY: 0.26, periodX: 11, periodY: 9,  phase: 4.0, radius: 0.18, pulse: 0.35),
                    LavaBlobSpec(baseX: 0.88, baseY: 0.70, ampX: 0.10, ampY: 0.24, periodX: 8,  periodY: 21, phase: 5.4, radius: 0.15),
                ],
                color1: Color(hex: 0x6FA5FF),   // 顶：蓝
                color2: Color(hex: 0xE35CC1),   // 底：品红
                threshold: 1.05,
                softness: 2
            )
            .opacity(0.5)
        }
    }
}

/// 呼吸缩放（ask 光球 / portrait 光晕）
struct BreatheModifier: ViewModifier {
    var enabled: Bool
    @State private var on = false
    func body(content: Content) -> some View {
        content
            .scaleEffect(enabled && on ? 1.1 : 1)
            .opacity(enabled ? (on ? 1 : 0.75) : 0.85)
            .onAppear {
                guard enabled else { return }
                withAnimation(.easeInOut(duration: 7).repeatForever(autoreverses: true)) { on = true }
            }
    }
}

// MARK: - 动态画像卡（原型 .portrait）

struct PortraitCard: View {
    let model: HomeModel
    /// 首页被 cover（对话 / 日记）覆盖时暂停数字形象动画
    var animationPaused = false
    var onTapDim: (HomeModel.PortraitDim) -> Void
    var onTapLifeGame: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            digitalHumanStage
            progressBar.padding(.top, 18)

            VStack(spacing: 9) {
                ForEach(model.portraitDims) { dim in
                    dimRow(dim)
                }
            }
            .padding(.top, 16)

            lifeEntry.padding(.top, 14)
            if !model.lifeSignature.isEmpty { lifeSignature.padding(.top, 14) }
        }
        .padding(.horizontal, 20).padding(.top, 22).padding(.bottom, 18)
        .kaleidoCard()
    }

    // 数字形象舞台：画像驱动的 Canvas 抽象形态（原型 .digital-human-stage）
    private var digitalHumanStage: some View {
        PersonaStageView(model: model.personaModel, userName: model.userName, paused: animationPaused)
            .padding(.horizontal, -20)   // 贴卡横向出血（原型 margin:0 -20px）
            .padding(.top, -22)
    }

    private var progressBar: some View {
        HStack(spacing: 10) {
            GeometryReader { geo in
                Capsule().fill(Theme.raised)
                    .overlay(alignment: .leading) {
                        Capsule().fill(Theme.aurora)
                            .frame(width: geo.size.width * CGFloat(model.completionPct) / 100)
                            .animation(.spring(response: 0.5, dampingFraction: 0.8), value: model.completionPct)
                    }
            }
            .frame(height: 5)
            Text("\(model.completionPct)%")
                .font(.system(size: 11)).monospacedDigit().foregroundStyle(Theme.sub)
                .contentTransition(.numericText())
        }
        .frame(maxWidth: 250)
    }

    private func dimRow(_ dim: HomeModel.PortraitDim) -> some View {
        Button { onTapDim(dim) } label: {
            HStack(spacing: 12) {
                Text(dim.icon).font(.system(size: 15))
                    .frame(width: 34, height: 34)
                    .background(Color(hex: dim.iconTint, alpha: 0.15), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(dim.label).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink)
                    Text(dim.value ?? "尚未填写").font(.system(size: 11.5))
                        .foregroundStyle(dim.isTodo ? Theme.blue : Theme.sub)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                Text("›").font(.system(size: 14)).foregroundStyle(Theme.faint)
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
            .background(dim.isTodo ? Color(hex: 0x5E96FF, alpha: 0.06) : Theme.raised,
                        in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(dim.isTodo ? Color(hex: 0x5E96FF, alpha: 0.4) : Theme.line,
                                  style: StrokeStyle(lineWidth: 1, dash: dim.isTodo ? [4, 4] : []))
            )
        }
        .buttonStyle(PressScaleStyle())
    }

    // 人生卡牌入口
    private var lifeEntry: some View {
        Button(action: onTapLifeGame) {
            HStack(spacing: 12) {
                miniDeck
                VStack(alignment: .leading, spacing: 3) {
                    Text("画像深潜 · 5–8 分钟").font(.system(size: 10)).tracking(1).foregroundStyle(Color(hex: 0x9DBCFF))
                    Text("人生卡牌：你最后会留下什么？").font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("经历五段人生取舍，生成你的私密深层画像").font(.system(size: 11)).foregroundStyle(Theme.sub)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                Text("›").font(.system(size: 15)).foregroundStyle(Theme.faint)
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
            .background(
                LinearGradient(colors: [Color(hex: 0x1A2350, alpha: 0.6), Color(hex: 0x2B1B2D, alpha: 0.4)], startPoint: .topLeading, endPoint: .bottomTrailing),
                in: RoundedRectangle(cornerRadius: 16, style: .continuous)
            )
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color(hex: 0x8F7BFF, alpha: 0.3), lineWidth: 1))
        }
        .buttonStyle(PressScaleStyle())
    }

    private var miniDeck: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 5).fill(Theme.hue(4).gradient).frame(width: 22, height: 30).rotationEffect(.degrees(-10)).offset(x: -3)
            RoundedRectangle(cornerRadius: 5).fill(Theme.hue(1).gradient).frame(width: 22, height: 30).rotationEffect(.degrees(8)).offset(x: 3)
        }
        .frame(width: 34)
    }

    // 人生底牌签名
    private var lifeSignature: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("我的人生底牌").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.ink)
                Spacer()
                Text("来自人生卡牌").font(.system(size: 10.5)).foregroundStyle(Theme.faint)
            }
            HStack(spacing: 8) {
                ForEach(model.lifeSignature, id: \.self) { card in
                    Text(card).font(.system(size: 12, weight: .medium)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(Theme.hue(0).gradient, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
        .padding(14)
        .background(Theme.raised, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }
}
