import SwiftUI

// MARK: - 悬赏详情页（原型 #bountyPage · renderBountyDetail）
//
// 标签 / 标题 / 发布者 / 悬赏卡 / 问题详情 / 亲历者回应 / 发送名片（medium sheet 预览 → 已发送态）。

struct BountyDetailView: View {
    let bounty: Bounty

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastCenter.self) private var toast

    @State private var showCardModal = false
    @State private var message = ""
    @State private var sent = false

    private static let sentKey = "kaleido_bounty_sent_v1"
    private var detail: DemoData.BountyDetail { DemoData.bountyDetail(bounty.id) }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    FlowLayout(spacing: 7) {
                        ForEach(detail.tags, id: \.self) { TagPill(text: $0) }
                    }
                    Text(bounty.question)
                        .font(.system(size: 21, weight: .bold)).lineSpacing(6).foregroundStyle(Theme.ink)
                    publisher
                    prize
                    copyBlock
                    replies
                    if sent {
                        Text("你的名片与补充说明已发送，发帖人可以查看你的经历并与你联系。")
                            .font(.system(size: 11.5)).lineSpacing(4).foregroundStyle(Color(hex: 0x8EE7C8))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(13)
                            .background(Color(hex: 0x3ED9A4, alpha: 0.08), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous)
                                .strokeBorder(Color(hex: 0x3ED9A4, alpha: 0.3), lineWidth: 1))
                    }
                }
                .padding(.horizontal, 22).padding(.top, 16).padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
            actionBar
        }
        .background(Theme.paper.ignoresSafeArea())
        .onAppear { sent = Self.sentIds.contains(bounty.id) }
        .sheet(isPresented: $showCardModal) {
            cardModal
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground(Color(hex: 0x10131C))
        }
    }

    private static var sentIds: Set<Int> {
        get { Set(UserDefaults.standard.array(forKey: sentKey) as? [Int] ?? []) }
        set { UserDefaults.standard.set(Array(newValue), forKey: sentKey) }
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
            VStack(alignment: .leading, spacing: 2) {
                Text("悬赏详情").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink)
                Text("\(detail.goal) · \(bounty.responses)").font(.system(size: 10.5)).foregroundStyle(Theme.faint)
            }
            Spacer()
        }
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 12)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    private var publisher: some View {
        HStack(spacing: 11) {
            TravelerAvatar(initial: String(detail.asker.prefix(1)), hue: bounty.id % 5, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(detail.asker).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.ink)
                Text("\(detail.city) · \(detail.time)发布").font(.system(size: 11)).foregroundStyle(Theme.faint)
            }
            Spacer()
        }
    }

    // 杏色悬赏卡（原型 .bounty-prize）
    private var prize: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 3) {
                Text("本帖悬赏").font(.system(size: 10.5)).foregroundStyle(Color(hex: 0x2B1A08, alpha: 0.75))
                Text("¥\(detail.amount)").font(.system(size: 24, weight: .heavy)).foregroundStyle(Color(hex: 0x2B1A08))
            }
            Spacer()
            Text(detail.goal).font(.system(size: 11.5, weight: .medium)).foregroundStyle(Color(hex: 0x2B1A08, alpha: 0.8))
        }
        .padding(.horizontal, 17).padding(.vertical, 15)
        .background(
            LinearGradient(colors: [Color(hex: 0xFFC98A), Color(hex: 0xFFB067), Color(hex: 0xF08E4E)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 18, style: .continuous)
        )
        .shadow(color: Color(hex: 0xFFB067, alpha: 0.25), radius: 14, y: 8)
    }

    private var copyBlock: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("TA 想了解的具体情况").font(.system(size: 13.5, weight: .bold)).foregroundStyle(Theme.ink)
            Text(detail.detail).font(.system(size: 12.5)).lineSpacing(6).foregroundStyle(Theme.sub)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .kaleidoCard()
    }

    private var replies: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("亲历者回应").font(.system(size: 13.5, weight: .bold)).foregroundStyle(Theme.ink)
                Spacer()
                Text(bounty.responses).font(.system(size: 11)).foregroundStyle(Theme.faint)
            }
            ForEach(Array(detail.replies.enumerated()), id: \.offset) { i, reply in
                HStack(alignment: .top, spacing: 11) {
                    TravelerAvatar(initial: String(reply.name.prefix(1)), hue: (bounty.id + i + 2) % 5, size: 34)
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 7) {
                            Text(reply.name).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Theme.ink)
                            Text(reply.role).font(.system(size: 10)).foregroundStyle(Theme.blue)
                        }
                        Text(reply.text).font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(13)
                .background(Theme.raised, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }

    private var actionBar: some View {
        Button(sent ? "名片已发送 ✓" : "发送我的名片") {
            if sent { toast.show("你的名片已经发送") } else { showCardModal = true }
        }
        .font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
        .frame(maxWidth: .infinity).padding(.vertical, 15)
        .background(sent ? AnyShapeStyle(Theme.raised) : AnyShapeStyle(Theme.buttonGradient), in: Capsule())
        .buttonStyle(PressScaleStyle())
        .disabled(sent)
        .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 14)
        .overlay(alignment: .top) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    // MARK: 名片弹层（原型 openBountyCardModal）

    private var cardModal: some View {
        let profile = MyProfileStore().profile
        return ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("发送我的名片").font(.system(size: 17, weight: .bold)).foregroundStyle(Theme.ink)

                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 11) {
                        TravelerAvatar(initial: String(profile.name.prefix(1)), hue: profile.hue, size: 42)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(profile.name).font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.ink)
                            Text(profile.bio).font(.system(size: 11.5)).foregroundStyle(Theme.sub)
                        }
                    }
                    FlowLayout(spacing: 6) {
                        ForEach(profile.tags, id: \.self) { TagPill(text: $0) }
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))

                Text("补充一句话，让对方知道你为什么能回答")
                    .font(.system(size: 11.5)).foregroundStyle(Theme.sub)
                TextField("", text: $message,
                          prompt: Text("例如：我去年完成了相似转型，可以分享第一份工作的准备过程。").foregroundColor(Theme.faint),
                          axis: .vertical)
                    .font(.system(size: 12.5)).foregroundStyle(Theme.ink).tint(Theme.blue)
                    .lineLimit(3...5)
                    .padding(12)
                    .background(Theme.raised, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))

                Text("发送后，对方将看到你的公开画像和这段补充说明；你的联系方式不会直接公开。")
                    .font(.system(size: 10.5)).lineSpacing(4).foregroundStyle(Theme.faint)

                Button("确认发送名片") { confirmSend() }
                    .font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(Theme.buttonGradient, in: Capsule())
                    .buttonStyle(PressScaleStyle())
            }
            .padding(.horizontal, 22).padding(.top, 24).padding(.bottom, 26)
        }
    }

    private func confirmSend() {
        var ids = Self.sentIds
        ids.insert(bounty.id)
        Self.sentIds = ids
        sent = true
        showCardModal = false
        toast.show("名片已发送给发帖人")
    }
}

#Preview {
    BountyDetailView(bounty: DemoData.bounties[0])
        .environment(ToastCenter())
        .preferredColorScheme(.dark)
}
