import SwiftUI

// MARK: - 免费 1v1 聊天（付费服务在会话内按需选择）

struct ConsultChatView: View {
    @Bindable var model: ProfileModel
    let traveler: Traveler

    @Environment(ToastCenter.self) private var toast
    @Environment(\.dismiss) private var dismiss
    @State private var input = ""
    @State private var messages: [PeerMessage]
    @State private var selectedService: TravelerServiceItem?
    @State private var purchasedServiceIDs: Set<String> = []

    init(model: ProfileModel, traveler: Traveler) {
        self.model = model
        self.traveler = traveler
        _messages = State(initialValue: [
            PeerMessage(role: .traveler, text: "你好，我是\(traveler.name)。可以先免费聊聊你现在的处境；如果需要更深入的支持，再从下面选择服务。")
        ])
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            messagesView
            inputBar
        }
        .background(Theme.paper.ignoresSafeArea())
        .sheet(item: $selectedService) { service in
            ConsultServiceCheckout(service: service) { completePurchase(service) }
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
                .presentationBackground(Color(hex: 0x11141D))
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            TravelerAvatar(initial: traveler.initial, hue: traveler.hue, size: 42,
                           imageName: MockAvatar.name(for: traveler.id))
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 7) {
                    Text("与\(traveler.name)聊天").font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                    Text("免费 1v1").font(.system(size: 9.5, weight: .semibold)).foregroundStyle(Theme.teal)
                        .padding(.horizontal, 7).padding(.vertical, 4)
                        .background(Color(hex: 0x3ED9A4, alpha: 0.12), in: Capsule())
                }
                Text("先聊清楚，再按需选择付费服务").font(.system(size: 10.5)).foregroundStyle(Theme.faint)
            }
            Spacer(minLength: 0)
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.sub)
                    .frame(width: 34, height: 34).background(Theme.raised, in: Circle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 18).padding(.vertical, 13)
        .background(Color(hex: 0x0A0C12, alpha: 0.95))
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    private var messagesView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if let first = messages.first { peerBubble(first) }
                    servicesCard.padding(.vertical, 14)
                    ForEach(messages.dropFirst()) { peerBubble($0) }
                    Color.clear.frame(height: 2).id("consult-bottom")
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
            }
            .scrollIndicators(.hidden)
            .onChange(of: messages.count) {
                withAnimation(.easeOut(duration: 0.22)) { proxy.scrollTo("consult-bottom", anchor: .bottom) }
            }
        }
    }

    private var servicesCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("TA 可以提供的服务").font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink)
                    Text("免费聊天无需选择服务，需要时再付费").font(.system(size: 10)).foregroundStyle(Theme.faint)
                }
                Spacer()
                Text("\(model.services.count) 项").font(.system(size: 10)).foregroundStyle(Color(hex: 0x91B1FF))
            }

            if model.services.isEmpty {
                Text("TA 暂未发布付费服务，你仍然可以继续免费聊天。")
                    .font(.system(size: 11.5)).foregroundStyle(Theme.sub)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 9) {
                        ForEach(model.services) { service in
                            Button { selectedService = service } label: {
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(serviceKind(service.kind)).font(.system(size: 9)).tracking(1.2)
                                        .foregroundStyle(Color(hex: 0x91B1FF))
                                    Text(personalized(service.title)).font(.system(size: 11.5, weight: .semibold))
                                        .lineLimit(2).lineSpacing(3).foregroundStyle(Theme.ink).padding(.top, 8)
                                    Spacer()
                                    Text(purchasedServiceIDs.contains(service.id)
                                         ? "已选择" : "¥\(price(service.price)) / \(service.unit)")
                                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(.white)
                                }
                                .padding(12).frame(width: 142, height: 132, alignment: .topLeading)
                                .background(Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .strokeBorder(Theme.line, lineWidth: 1))
                            }
                            .buttonStyle(PressScaleStyle())
                        }
                    }
                }
            }
        }
        .padding(15)
        .background(Color(hex: 0x5E96FF, alpha: 0.08), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous)
            .strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.25), lineWidth: 1))
    }

    private var inputBar: some View {
        HStack(alignment: .bottom, spacing: 9) {
            TextField("免费聊聊你的问题…", text: $input, axis: .vertical)
                .lineLimit(1...4).font(.system(size: 13.5)).foregroundStyle(Theme.ink)
                .padding(.horizontal, 15).padding(.vertical, 12)
                .background(Theme.raised, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
            Button("发送", action: send)
                .font(.system(size: 12.5, weight: .semibold)).foregroundStyle(.white)
                .padding(.horizontal, 18).padding(.vertical, 12)
                .background(Theme.buttonGradient, in: Capsule())
                .buttonStyle(PressScaleStyle()).disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.horizontal, 14).padding(.top, 10).padding(.bottom, 8)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    private func peerBubble(_ message: PeerMessage) -> some View {
        HStack {
            if message.role == .me { Spacer(minLength: 42) }
            Text(message.text).font(.system(size: 13)).lineSpacing(5)
                .foregroundStyle(message.role == .me ? Color.white : Theme.ink)
                .padding(.horizontal, 15).padding(.vertical, 12)
                .background(message.role == .me ? AnyShapeStyle(Theme.buttonGradient) : AnyShapeStyle(Theme.card),
                            in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay {
                    if message.role == .traveler {
                        RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line, lineWidth: 1)
                    }
                }
            if message.role == .traveler { Spacer(minLength: 42) }
        }
        .padding(.vertical, 4)
    }

    private func send() {
        let clean = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        input = ""
        messages.append(PeerMessage(role: .me, text: clean))
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(550))
            messages.append(PeerMessage(role: .traveler,
                                        text: "我看到了。你可以先说说：在这个问题里，最希望我用亲身经历帮你判断的是什么？"))
        }
    }

    private func completePurchase(_ service: TravelerServiceItem) {
        purchasedServiceIDs.insert(service.id)
        selectedService = nil
        messages.append(PeerMessage(role: .traveler,
                                    text: "你已选择「\(personalized(service.title))」。我会在聊天中和你确认目标、时间与交付方式。"))
        toast.show("演示环境：已模拟支付成功，不会产生真实扣款")
    }

    private func personalized(_ title: String) -> String {
        title.replacingOccurrences(of: "与TA", with: "与\(traveler.name)")
    }

    private func serviceKind(_ kind: String) -> String {
        switch kind {
        case "materials": "资料工具包"
        case "companion": "阶段陪跑"
        default: "1 对 1 咨询"
        }
    }

    private func price(_ value: Decimal) -> String { NSDecimalNumber(decimal: value).stringValue }
}

private struct PeerMessage: Identifiable {
    enum Role { case me, traveler }
    let id = UUID()
    let role: Role
    let text: String
}

private struct ConsultServiceCheckout: View {
    let service: TravelerServiceItem
    let onPaid: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var processing = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 7) {
                    Text("选择付费服务").font(.system(size: 10)).tracking(1.5).foregroundStyle(Color(hex: 0x91B1FF))
                    Text(service.title).font(.system(size: 18, weight: .semibold)).foregroundStyle(Theme.ink)
                }
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.sub)
                        .frame(width: 32, height: 32).background(Theme.raised, in: Circle())
                }.buttonStyle(.plain)
            }
            Text(service.description).font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub).padding(.top, 14)
            Spacer(minLength: 18)
            HStack(alignment: .bottom) {
                Text("确认后在聊天中沟通服务细节").font(.system(size: 10.5)).foregroundStyle(Theme.faint)
                Spacer()
                Text("¥\(NSDecimalNumber(decimal: service.price).stringValue)")
                    .font(.system(size: 22, weight: .bold)).foregroundStyle(.white)
            }
            Button(processing ? "处理中…" : "确认支付 ¥\(NSDecimalNumber(decimal: service.price).stringValue)") {
                processing = true
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(650))
                    onPaid()
                    dismiss()
                }
            }
            .font(.system(size: 13.5, weight: .semibold)).foregroundStyle(.white)
            .frame(maxWidth: .infinity).padding(.vertical, 14)
            .background(Theme.buttonGradient, in: Capsule())
            .buttonStyle(PressScaleStyle()).disabled(processing).padding(.top, 18)
            Text("演示环境：模拟支付，不会产生真实扣款")
                .font(.system(size: 9.5)).foregroundStyle(Theme.faint).frame(maxWidth: .infinity).padding(.top, 10)
        }
        .padding(22)
    }
}
