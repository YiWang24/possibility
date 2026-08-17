import SwiftUI
import UIKit

struct TarotPanel: View {
    @Bindable var model: ChatModel

    @Environment(SupabaseService.self) private var supabase
    @Environment(ToastCenter.self) private var toast
    @State private var selectedIDs: [String] = []

    var body: some View {
        if model.tarotPhase != .none {
            VStack(alignment: .leading, spacing: 14) {
                switch model.tarotPhase {
                case .none:
                    EmptyView()
                case .offer:
                    offer
                case .drawing:
                    drawing
                case .confirm:
                    confirmation
                case .result:
                    result
                case .locked:
                    locked
                }
            }
            .padding(15)
            .background(
                LinearGradient(colors: [Color(hex: 0x5E96FF, alpha: 0.12), Color(hex: 0x8F7BFF, alpha: 0.06)],
                               startPoint: .topLeading, endPoint: .bottomTrailing),
                in: RoundedRectangle(cornerRadius: 22, style: .continuous)
            )
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.28), lineWidth: 1))
            .padding(.top, 14)
            .onChange(of: model.tarotPhase) { _, phase in
                if phase == .drawing { selectedIDs = [] }
            }
        }
    }

    private var heading: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("三张牌 · 象征分析")
                .font(.system(size: 9)).tracking(1.6).foregroundStyle(Color(hex: 0x91B1FF))
            Text(model.tarotDisplayQuestion)
                .font(.system(size: 14, weight: .semibold)).lineSpacing(4).foregroundStyle(Theme.ink)
        }
    }

    private var offer: some View {
        VStack(alignment: .leading, spacing: 14) {
            heading
            Text("从 12 张候选牌中亲手选出 3 张，分别代表现状、核心阻力与行动走向。它不会替你决定未来，而是提供一个新的观察角度。")
                .font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub)
            Button("开始抽取 3 张牌") { model.beginTarotDraw() }
                .font(.system(size: 13.5, weight: .semibold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(Theme.buttonGradient, in: Capsule())
                .buttonStyle(PressScaleStyle())
            if !model.tarotRequired {
                Button("暂时不抽牌") { model.answerWithoutTarot(supabase: supabase) }
                    .font(.system(size: 11.5)).foregroundStyle(Theme.sub)
                    .frame(maxWidth: .infinity).buttonStyle(.plain)
            }
            quotaFooter
        }
    }

    private var drawing: some View {
        VStack(alignment: .leading, spacing: 12) {
            heading
            Text("请选择 3 张 · 已选 \(selectedIDs.count)/3")
                .font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Theme.sub)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
                ForEach(Array(model.tarotCandidates.enumerated()), id: \.element.id) { index, card in
                    let selected = selectedIDs.contains(card.id)
                    Button {
                        toggle(card.id)
                    } label: {
                        VStack(spacing: 7) {
                            Text(selected ? "✦" : "◌").font(.system(size: 18, weight: .semibold))
                            Text("候选 \(index + 1)").font(.system(size: 9, weight: .medium))
                        }
                        .foregroundStyle(selected ? Color.white : Theme.sub)
                        .frame(maxWidth: .infinity).frame(height: 72)
                        .background(selected ? Color(hex: 0x446FE2, alpha: 0.58) : Color.white.opacity(0.045),
                                    in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .strokeBorder(selected ? Color(hex: 0x91B1FF) : Theme.line, lineWidth: 1))
                    }
                    .buttonStyle(PressScaleStyle())
                }
            }
            Button("确认这 3 张牌") { model.prepareTarotConfirmation(cardIDs: selectedIDs) }
                .font(.system(size: 13.5, weight: .semibold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(selectedIDs.count == 3 ? Theme.buttonGradient : LinearGradient(colors: [Theme.faint, Theme.faint], startPoint: .leading, endPoint: .trailing), in: Capsule())
                .buttonStyle(PressScaleStyle())
                .disabled(selectedIDs.count != 3)
        }
    }

    private var confirmation: some View {
        VStack(alignment: .leading, spacing: 13) {
            heading
            Text("确认你的三张牌")
                .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.sub)
            cardRow(model.tarotSelection, revealMeaning: false)
            Button(model.isTarotSubmitting ? "正在生成答案…" : "确认并查看分析") {
                model.confirmTarotDraw(supabase: supabase)
            }
            .font(.system(size: 13.5, weight: .semibold)).foregroundStyle(.white)
            .frame(maxWidth: .infinity).padding(.vertical, 14)
            .background(Theme.buttonGradient, in: Capsule())
            .buttonStyle(PressScaleStyle()).disabled(model.isTarotSubmitting)
            Button("重新选择") {
                model.beginTarotDraw()
            }
            .font(.system(size: 11.5)).foregroundStyle(Theme.sub)
            .frame(maxWidth: .infinity).buttonStyle(.plain)
        }
    }

    private var result: some View {
        VStack(alignment: .leading, spacing: 13) {
            Text("你的三张牌")
                .font(.system(size: 12, weight: .semibold)).foregroundStyle(Color(hex: 0x91B1FF))
            cardRow(model.tarotReading?.cards ?? model.tarotSelection, revealMeaning: true)
            quotaFooter
        }
    }

    private var locked: some View {
        VStack(alignment: .leading, spacing: 13) {
            Text("今天的基础次数已用完")
                .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
            Text("每天有 3 次基础机会。你可以免费分享领取次数、开通连续包月，或购买加量包。")
                .font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub)
            unlockCard(title: "分享免费领取次数", note: "每次完成分享 +1 次，不限次数", action: "立即分享") {
                model.showTarotShare = true
            }
            unlockCard(title: "¥9.9 连续包月", note: "首月优惠；第 2 个月起 ¥25/月，可随时关闭", action: "立即开通", primary: true) {
                model.purchaseTarotAccess(.subscription)
                toast.show("演示环境：已开通包月不限次")
            }
            unlockCard(title: "¥19 15次加量包", note: "15 次 ¥19；也可选择 100 次 ¥99", action: "购买次数") {
                model.purchaseTarotAccess(.credits15)
                toast.show("演示环境：已增加 15 次")
            }
            Button("购买 100 次 · ¥99") {
                model.purchaseTarotAccess(.credits100)
                toast.show("演示环境：已增加 100 次")
            }
            .font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Color(hex: 0xAFC7FF))
            .frame(maxWidth: .infinity).buttonStyle(.plain)
        }
    }

    private func unlockCard(title: String, note: String, action: String, primary: Bool = false,
                            perform: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink)
            Text(note).font(.system(size: 11)).lineSpacing(4).foregroundStyle(Theme.sub)
            Spacer(minLength: 0)
            Button(action, action: perform)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(primary ? Color.white : Color(hex: 0xAFC7FF))
                .frame(maxWidth: .infinity).padding(.vertical, 11)
                .background(primary ? AnyShapeStyle(Theme.buttonGradient) : AnyShapeStyle(Color(hex: 0x5E96FF, alpha: 0.1)), in: Capsule())
                .buttonStyle(PressScaleStyle())
        }
        .padding(15).frame(maxWidth: .infinity).frame(height: 132, alignment: .topLeading)
        .background(Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }

    private func cardRow(_ cards: [DrawnTarotCard], revealMeaning: Bool) -> some View {
        HStack(alignment: .top, spacing: 8) {
            ForEach(Array(cards.prefix(3).enumerated()), id: \.element.id) { index, drawn in
                VStack(spacing: 5) {
                    Text(TarotEngine.positions[index]).font(.system(size: 8.5)).foregroundStyle(Color(hex: 0x91B1FF))
                    Text(drawn.card.symbol).font(.system(size: 22, weight: .medium)).foregroundStyle(Theme.ink)
                    Text(drawn.card.name).font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Theme.ink)
                    Text(drawn.orientation).font(.system(size: 9)).foregroundStyle(Theme.faint)
                    if revealMeaning {
                        Text(drawn.meaning).font(.system(size: 8.5)).lineLimit(2).multilineTextAlignment(.center)
                            .foregroundStyle(Theme.sub).padding(.top, 2)
                    }
                }
                .frame(maxWidth: .infinity).frame(minHeight: revealMeaning ? 128 : 96, alignment: .top)
                .padding(.vertical, 10).padding(.horizontal, 5)
                .background(Color(hex: 0x315AA8, alpha: 0.22), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.42), lineWidth: 1))
            }
        }
    }

    private var quotaFooter: some View {
        HStack {
            Text("可用额度：\(model.tarotRemainingLabel)")
            Spacer()
            Button("解锁更多次数 ↗") { model.showTarotShare = true }
                .fontWeight(.semibold).buttonStyle(.plain)
        }
        .font(.system(size: 10.5)).foregroundStyle(Theme.faint)
        .padding(.top, 2)
    }

    private func toggle(_ id: String) {
        if let index = selectedIDs.firstIndex(of: id) {
            selectedIDs.remove(at: index)
        } else if selectedIDs.count < 3 {
            selectedIDs.append(id)
        }
    }
}

// MARK: - 分享宣传海报

struct TarotSharePosterSheet: View {
    @Bindable var model: ChatModel

    @Environment(ToastCenter.self) private var toast
    @Environment(\.dismiss) private var dismiss
    @State private var poster: UIImage?
    @State private var sharingChannel: TarotShareChannel?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("分享免费领取次数")
                        .font(.system(size: 20, weight: .bold)).foregroundStyle(Theme.ink)
                    Text("每完成一次分享即可领取 1 次，没有每日上限。海报不包含你的画像、日记或对话内容。")
                        .font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub)

                    Group {
                        if let poster {
                            Image(uiImage: poster).resizable().scaledToFit()
                        } else {
                            TarotPoster().aspectRatio(3 / 4, contentMode: .fit)
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.3), lineWidth: 1))
                    .shadow(color: .black.opacity(0.28), radius: 20, y: 10)

                    Text("选择分享渠道")
                        .font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink)
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 9) {
                        ForEach(TarotShareChannel.allCases) { channel in
                            Button {
                                sharingChannel = channel
                            } label: {
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(channel.label).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.ink)
                                    Text(channel.note).font(.system(size: 10.5)).foregroundStyle(Theme.faint)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading).padding(14)
                                .background(Theme.raised, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous)
                                    .strokeBorder(Theme.line, lineWidth: 1))
                            }
                            .buttonStyle(PressScaleStyle())
                        }
                    }
                }
                .padding(20)
            }
            .background(Theme.paper.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { dismiss() }.foregroundStyle(Color(hex: 0xAFC7FF))
                }
            }
        }
        .onAppear { renderPoster() }
        .sheet(item: $sharingChannel) { channel in
            let caption = "万花筒 · 认识你自己，推演人生的可能性"
            let items: [Any] = poster.map { [$0, caption] } ?? [caption]
            ActivityShareSheet(items: items) { completed in
                sharingChannel = nil
                guard completed else { return }
                model.claimTarotShareReward()
                toast.show("分享完成，已领取 1 次")
            }
        }
    }

    private func renderPoster() {
        let renderer = ImageRenderer(content: TarotPoster().frame(width: 360, height: 480))
        renderer.scale = 3
        poster = renderer.uiImage
    }
}

private struct TarotPoster: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(hex: 0x090B12), Color(hex: 0x11172A), Color(hex: 0x19132B)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            Circle().fill(Color(hex: 0x5E96FF, alpha: 0.26)).frame(width: 220).blur(radius: 20).offset(x: 150, y: -170)
            Circle().fill(Color(hex: 0xE35CC1, alpha: 0.22)).frame(width: 240).blur(radius: 24).offset(x: -150, y: 210)
            VStack(alignment: .leading, spacing: 0) {
                Text("POSSIBILITY · 万花筒").font(.system(size: 10, weight: .semibold)).tracking(2.2)
                    .foregroundStyle(Color(hex: 0xAFC7FF))
                Text("认识你自己，\n推演人生的可能性")
                    .font(.system(size: 27, weight: .bold)).lineSpacing(5).foregroundStyle(.white).padding(.top, 24)
                Text("让动态画像、语音日记与真实经验，陪你找到更贴近自己的下一步。")
                    .font(.system(size: 12)).lineSpacing(5).foregroundStyle(.white.opacity(0.66)).padding(.top, 13)
                VStack(spacing: 10) {
                    posterFeature("◉", "动态画像", "在对话与日记中持续生长")
                    posterFeature("✦", "人生实验室", "推演选择、代价与可能结果")
                    posterFeature("⌁", "相似经验", "看见走过这段路的真实路径")
                }
                .padding(.top, 34)
                Spacer()
                Text("分享万花筒，一起看见更多人生可能")
                    .font(.system(size: 11, weight: .semibold)).foregroundStyle(Color(hex: 0xAFC7FF))
                Text("海报不包含你的画像、日记或对话内容")
                    .font(.system(size: 8.5)).foregroundStyle(.white.opacity(0.42)).padding(.top, 5)
            }
            .padding(28)
        }
    }

    private func posterFeature(_ symbol: String, _ title: String, _ note: String) -> some View {
        HStack(spacing: 14) {
            Text(symbol).font(.system(size: 19, weight: .bold)).foregroundStyle(Color(hex: 0xAFC7FF)).frame(width: 28)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(.white)
                Text(note).font(.system(size: 9)).foregroundStyle(.white.opacity(0.55))
            }
            Spacer()
        }
        .padding(13).background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
            .strokeBorder(Color(hex: 0x91B1FF, alpha: 0.28), lineWidth: 1))
    }
}

private struct ActivityShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    let completion: (Bool) -> Void

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        controller.completionWithItemsHandler = { _, completed, _, _ in completion(completed) }
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
