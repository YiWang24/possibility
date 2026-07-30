import SwiftUI

// MARK: - 悬赏详情页（原型 #bountyPage · renderBountyDetail）
//
// 标签 / 标题 / 发布者 / 悬赏卡 / 问题详情 / 亲历者回应 / 发送名片（medium sheet 预览 → 已发送态）。

struct BountyDetailView: View {
    let bounty: Bounty
    /// 列表是否来自本地演示数据。演示列表使用配套演示详情，不再按相同 ID
    /// 请求并混入另一套远端内容。
    let usesDemoData: Bool

    @Environment(\.dismiss) private var dismiss
    @Environment(SupabaseService.self) private var supabase
    @Environment(ToastCenter.self) private var toast

    @State private var showCardModal = false
    @State private var message = ""
    @State private var sent = false
    /// 回应悬赏是关键动作：游客先登录（AuthGate 就地弹 LoginSheet）
    @State private var authGate = AuthGateCenter()
    /// get_bounty 拉到的远端详情；帖子主体在列表数据中已经可用，这里主要补充回应。
    @State private var remote: BountyDetailResponse?
    @State private var didFinishRemoteLoad = false
    @State private var sending = false

    private static let sentKey = "kaleido_bounty_sent_v1"
    private var detail: DemoData.BountyDetail { DemoData.bountyDetail(bounty.id) }

    // MARK: 真实优先的展示字段

    private var displayTags: [String] {
        if let tags = remote?.bounty.tags, !tags.isEmpty { return tags }
        if let tags = bounty.tags, !tags.isEmpty { return tags }
        return usesDemoData ? detail.tags : []
    }
    private var displayDetail: String {
        if let text = remote?.bounty.detail, !text.isEmpty { return text }
        if let text = bounty.detail, !text.isEmpty { return text }
        return usesDemoData ? detail.detail : "详情暂未填写。"
    }
    private var displayQuestion: String { remote?.bounty.question ?? bounty.question }
    private var responseCountText: String {
        if usesDemoData { return "\(detail.replies.count) 人回应" }
        if let remote { return "\(remote.responses.count) 人回应" }
        return didFinishRemoteLoad ? "回应加载失败" : "回应加载中"
    }
    private var statusText: String {
        if let status = remote?.bounty.status ?? bounty.status {
            return status == "closed" ? "已结束" : "征集中"
        }
        return usesDemoData ? detail.goal : "征集中"
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    FlowLayout(spacing: 7) {
                        ForEach(displayTags, id: \.self) { TagPill(text: $0) }
                    }
                    Text(displayQuestion)
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
        .task { await loadRemote() }
        .sheet(isPresented: $showCardModal) {
            cardModal
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground(Color(hex: 0x10131C))
        }
        .authGate(authGate)
    }

    /// 远端列表只补拉回应；本地演示列表保持使用同一套演示详情。
    private func loadRemote() async {
        guard !usesDemoData else { return }
        defer { didFinishRemoteLoad = true }
        remote = try? await supabase.getBounty(bountyId: bounty.id)
    }

    /// 匿名展示：用户 id 截短为「旅人 #xxxx」
    private func anonymousName(_ userId: UUID) -> String {
        "旅人 #\(userId.uuidString.prefix(4).uppercased())"
    }

    /// 回应时间（created_at → 本地时区日期，避免 UTC 裸切在东八区晚间显示成前一天）
    private func replyMeta(_ createdAt: String?) -> String {
        SupabaseTimestamp.dayString(fromRaw: createdAt) ?? "亲历者"
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
                Text("\(statusText) · \(responseCountText)").font(.system(size: 10.5)).foregroundStyle(Theme.faint)
            }
            Spacer()
        }
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 12)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    private var publisher: some View {
        let name = usesDemoData ? detail.asker : "匿名旅人"
        let meta: String = {
            if !usesDemoData {
                let createdAt = remote?.bounty.createdAt ?? bounty.createdAt
                guard let day = SupabaseTimestamp.dayString(fromRaw: createdAt) else { return "已发布" }
                return "\(day) 发布"
            }
            return "\(detail.city) · \(detail.time)发布"
        }()
        return HStack(spacing: 11) {
            TravelerAvatar(initial: String(name.prefix(1)), hue: bounty.id % 5, size: 40,
                           imageName: MockAvatar.name(hashing: name))
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.ink)
                Text(meta).font(.system(size: 11)).foregroundStyle(Theme.faint)
            }
            Spacer()
        }
    }

    // 杏色悬赏卡（原型 .bounty-prize；真实数据展示 reward 文案，兜底展示 ¥金额）
    private var prize: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 3) {
                Text("本帖悬赏").font(.system(size: 10.5)).foregroundStyle(Color(hex: 0x2B1A08, alpha: 0.75))
                if usesDemoData {
                    Text("¥\(detail.amount)").font(.system(size: 24, weight: .heavy)).foregroundStyle(Color(hex: 0x2B1A08))
                } else {
                    Text(remote?.bounty.reward ?? bounty.reward)
                        .font(.system(size: 17, weight: .heavy)).foregroundStyle(Color(hex: 0x2B1A08))
                }
            }
            Spacer()
            Text(statusText).font(.system(size: 11.5, weight: .medium)).foregroundStyle(Color(hex: 0x2B1A08, alpha: 0.8))
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
            Text(displayDetail).font(.system(size: 12.5)).lineSpacing(6).foregroundStyle(Theme.sub)
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
                Text(responseCountText).font(.system(size: 11)).foregroundStyle(Theme.faint)
            }
            if let remote {
                if remote.responses.isEmpty {
                    emptyReplies
                } else {
                    ForEach(Array(remote.responses.enumerated()), id: \.element.id) { i, reply in
                        replyRow(name: anonymousName(reply.userId),
                                 role: replyMeta(reply.createdAt),
                                 text: reply.message,
                                 hue: (bounty.id + i + 2) % 5)
                    }
                }
            } else if usesDemoData {
                if detail.replies.isEmpty {
                    emptyReplies
                } else {
                    ForEach(Array(detail.replies.enumerated()), id: \.offset) { i, reply in
                        replyRow(name: reply.name, role: reply.role, text: reply.text,
                                 hue: (bounty.id + i + 2) % 5)
                    }
                }
            } else {
                HStack(spacing: 8) {
                    if !didFinishRemoteLoad {
                        ProgressView().controlSize(.small).tint(Theme.faint)
                    }
                    Text(didFinishRemoteLoad ? "回应暂时加载失败，请稍后再试。" : "正在加载回应…")
                        .font(.system(size: 12)).foregroundStyle(Theme.faint)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(13)
                .background(Theme.raised, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }

    private var emptyReplies: some View {
        Text("还没有旅人回应，成为第一个分享经历的人吧。")
            .font(.system(size: 12)).foregroundStyle(Theme.faint)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(13)
            .background(Theme.raised, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func replyRow(name: String, role: String, text: String, hue: Int) -> some View {
        HStack(alignment: .top, spacing: 11) {
            TravelerAvatar(initial: String(name.prefix(1)), hue: hue, size: 34,
                           imageName: MockAvatar.name(hashing: name))
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 7) {
                    Text(name).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Theme.ink)
                    Text(role).font(.system(size: 10)).foregroundStyle(Theme.blue)
                }
                Text(text).font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(13)
        .background(Theme.raised, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var actionBar: some View {
        Button(sent ? "名片已发送 ✓" : "发送我的名片") {
            if sent {
                toast.show("你的名片已经发送")
            } else {
                authGate.require(supabase) { showCardModal = true }
            }
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
                    .keyboardDismissToolbar()

                Text("发送后，你的回应会和公开画像一起展示在这条悬赏下，所有旅人可见；请不要在补充说明中留下联系方式。")
                    .font(.system(size: 10.5)).lineSpacing(4).foregroundStyle(Theme.faint)

                Button(sending ? "发送中…" : "确认发送名片") { confirmSend() }
                    .font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(sending ? AnyShapeStyle(Theme.raised) : AnyShapeStyle(Theme.buttonGradient), in: Capsule())
                    .buttonStyle(PressScaleStyle())
                    .disabled(sending)
            }
            .padding(.horizontal, 22).padding(.top, 24).padding(.bottom, 26)
        }
    }

    /// 真实回应：respond_bounty（同一用户同一悬赏 upsert，重复发送即更新）。
    /// 成功→保留原 UserDefaults 已发送标记 + 刷新回应列表；失败→轻提示不阻断，可重试。
    private func confirmSend() {
        guard !sending else { return }
        let profile = MyProfileStore().profile
        let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
        let payload = trimmed.isEmpty ? "我是\(profile.name)：\(profile.bio)" : trimmed
        sending = true
        Task {
            defer { sending = false }
            do {
                try await supabase.respondBounty(bountyId: bounty.id, message: String(payload.prefix(500)))
                var ids = Self.sentIds
                ids.insert(bounty.id)
                Self.sentIds = ids
                sent = true
                showCardModal = false
                toast.show("名片已发送给发帖人")
                await loadRemote()
            } catch {
                showCardModal = false
                toast.show("发送失败，请稍后重试")
            }
        }
    }
}

#Preview {
    BountyDetailView(bounty: DemoData.bounties[0], usesDemoData: true)
        .environment(SupabaseService())
        .environment(ToastCenter())
        .preferredColorScheme(.dark)
}
