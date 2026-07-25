import SwiftUI

// MARK: - 03 万花筒社区（原型 scr-comm）

struct CommunityView: View {
    @Environment(SupabaseService.self) private var supabase
    @Environment(ToastCenter.self) private var toast
    @State private var tab = 0            // 0 为你推荐 · 1 悬赏贴
    @State private var showDraw = false
    /// 为你推荐布局：false 卡片瀑布流 / true 放映模式（原型 watch-mode）
    /// 调试便利：`simctl launch ... -kaleido-watch 1` 直接进入放映模式
    @State private var watchMode = UserDefaults.standard.bool(forKey: "kaleido-watch")
    @State private var searchText = ""
    @State private var activeBounty: Bounty?
    /// community Edge Function 返回的真实悬赏（成功后优先展示）
    @State private var remoteBounties: [Bounty]?
    @State private var showCompose = false

    private var travelers: [Traveler] {
        supabase.travelers.isEmpty ? DemoData.travelers : supabase.travelers
    }
    /// 兜底链：remote（Edge Function）→ 直连表缓存 → DemoData
    private var bounties: [Bounty] {
        if let remoteBounties, !remoteBounties.isEmpty { return remoteBounties }
        return supabase.bounties.isEmpty ? DemoData.bounties : supabase.bounties
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                PageHeader(eyebrow: "KALEIDOSCOPE", title: "万花筒社区")
                tabs.padding(.top, 16)
                Group {
                    if tab == 0 {
                        VStack(alignment: .leading, spacing: 12) {
                            searchBar
                            if watchMode {
                                // 原型 watch-mode 全出血（margin: 4px -22px）
                                WatchModeView(travelers: travelers, searchQuery: searchText)
                                    .padding(.horizontal, -22)
                            } else {
                                recommendFeed
                            }
                        }
                    } else {
                        bountyFeed
                    }
                }
                .padding(.top, 16)
            }
            .padding(.horizontal, 22).padding(.top, 20).padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
        .scrollDisabled(watchMode && tab == 0)
        .screenBackground()
        .overlay(alignment: .bottomTrailing) { tab == 0 ? AnyView(drawFab) : AnyView(composeFab) }
        .task { await refreshBounties() }
        .fullScreenCover(isPresented: $showDraw) { KaleidoscopeDrawView() }
        .fullScreenCover(item: $activeBounty) { bounty in
            BountyDetailView(bounty: bounty)
                .environment(supabase)
                .environment(toast)
        }
        .sheet(isPresented: $showCompose) {
            BountyComposeView { Task { await refreshBounties() } }
                .environment(supabase)
                .environment(toast)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationBackground(Color(hex: 0x10131C))
        }
    }

    /// 真实优先：Edge Function 列表拉取成功才覆盖，失败静默走兜底链
    private func refreshBounties() async {
        if let res = try? await supabase.listBountiesRemote(limit: 50), !res.bounties.isEmpty {
            remoteBounties = res.bounties
        }
    }

    private var tabs: some View {
        HStack(alignment: .firstTextBaseline, spacing: 20) {
            tabButton("为你推荐", index: 0)
            tabButton("悬赏贴", index: 1)
            Spacer()
            if tab == 0 { watchToggle }
        }
    }

    /// 卡片 / 放映 切换（原型 watch-mode 入口）
    private var watchToggle: some View {
        Button {
            withAnimation(.easeOut(duration: 0.25)) { watchMode.toggle() }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: watchMode ? "square.grid.2x2" : "circle.hexagongrid")
                    .font(.system(size: 11))
                Text(watchMode ? "卡片" : "放映")
                    .font(.system(size: 11.5, weight: .medium))
            }
            .foregroundStyle(watchMode ? Color(hex: 0x9DBCFF) : Theme.sub)
            .padding(.horizontal, 12).padding(.vertical, 7)
            .background(watchMode ? Color(hex: 0x5E96FF, alpha: 0.14) : Theme.raised, in: Capsule())
            .overlay(Capsule().strokeBorder(watchMode ? Color(hex: 0x5E96FF, alpha: 0.45) : Theme.line, lineWidth: 1))
        }
        .buttonStyle(PressScaleStyle())
    }

    /// 玻璃搜索条（原型 .comm-search）
    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12)).foregroundStyle(Theme.faint)
            TextField("", text: $searchText,
                      prompt: Text("搜索旅人、介绍或标签").foregroundColor(Theme.faint))
                .font(.system(size: 13)).foregroundStyle(Theme.ink).tint(Theme.blue)
            if !searchText.isEmpty {
                Button {
                    searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 13)).foregroundStyle(Theme.faint)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(Color.white.opacity(0.05), in: Capsule())
        .overlay(Capsule().strokeBorder(Theme.line, lineWidth: 1))
    }

    private func tabButton(_ title: String, index: Int) -> some View {
        let on = tab == index
        return Button {
            withAnimation(.easeOut(duration: 0.2)) { tab = index }
        } label: {
            VStack(spacing: 6) {
                Text(title)
                    .font(.system(size: on ? 17 : 15, weight: on ? .bold : .regular))
                    .foregroundStyle(on ? Theme.ink : Theme.faint)
                Capsule().fill(Theme.aurora).frame(width: 18, height: 3).opacity(on ? 1 : 0)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: 为你推荐 · 双列瀑布流

    private var recommendFeed: some View {
        let cols = distribute(filteredTravelers)
        return HStack(alignment: .top, spacing: 11) {
            column(cols.0)
            column(cols.1)
        }
    }

    private var filteredTravelers: [Traveler] {
        let query = searchText.trimmingCharacters(in: .whitespaces).lowercased()
        guard !query.isEmpty else { return travelers }
        return travelers.filter { t in
            ([t.name, t.quote, t.bio] + t.tags).joined(separator: " ").lowercased().contains(query)
        }
    }

    private func column(_ items: [Traveler]) -> some View {
        VStack(spacing: 11) {
            ForEach(items) { t in
                TravelerProfileLink(travelerId: t.id) { UserCard(traveler: t) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .top)
    }

    /// 按序分入两列（近似 masonry）
    private func distribute(_ items: [Traveler]) -> ([Traveler], [Traveler]) {
        var left: [Traveler] = [], right: [Traveler] = []
        for (i, t) in items.enumerated() {
            if i % 2 == 0 { left.append(t) } else { right.append(t) }
        }
        return (left, right)
    }

    // MARK: 悬赏贴

    private var bountyFeed: some View {
        VStack(spacing: 11) {
            ForEach(bounties) { b in
                BountyCard(bounty: b) { activeBounty = b }
            }
        }
    }

    // MARK: 抽取 FAB

    private var drawFab: some View {
        Button { showDraw = true } label: {
            HStack(spacing: 8) {
                MiniOrb(size: 20)
                Text("万花筒抽一位旅人").font(.system(size: 13.5, weight: .semibold)).tracking(0.5)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 20).padding(.vertical, 13)
            .background(Theme.buttonGradient, in: Capsule())
            .shadow(color: Color(hex: 0x4F7DFF, alpha: 0.65), radius: 18, y: 10)
        }
        .buttonStyle(PressScaleStyle())
        .padding(.trailing, 22).padding(.bottom, 28)
    }

    // MARK: 发悬赏 FAB（悬赏贴 tab，风格同抽取 FAB）

    private var composeFab: some View {
        Button { showCompose = true } label: {
            HStack(spacing: 8) {
                Image(systemName: "plus.circle.fill").font(.system(size: 15, weight: .semibold))
                Text("发布悬赏").font(.system(size: 13.5, weight: .semibold)).tracking(0.5)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 20).padding(.vertical, 13)
            .background(Theme.buttonGradient, in: Capsule())
            .shadow(color: Color(hex: 0x4F7DFF, alpha: 0.65), radius: 18, y: 10)
        }
        .buttonStyle(PressScaleStyle())
        .padding(.trailing, 22).padding(.bottom, 28)
    }
}

// MARK: - 用户卡（原型 .ucard）

struct UserCard: View {
    let traveler: Traveler

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HueBandHeader(initial: traveler.initial, hue: traveler.hue,
                          imageName: MockAvatar.name(for: traveler.id))
            VStack(alignment: .leading, spacing: 6) {
                Text(traveler.name).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink)
                Text(traveler.quote).font(.system(size: 11.5)).foregroundStyle(Theme.sub).lineSpacing(3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if !traveler.tags.isEmpty {
                    FlowLayout(spacing: 5) {
                        ForEach(traveler.tags.prefix(3), id: \.self) { TagPill(text: $0) }
                    }
                    .padding(.top, 2)
                }
                Text("查看详情 ›").font(.system(size: 11.5, weight: .medium)).foregroundStyle(Theme.blue).padding(.top, 5)
            }
            .padding(.horizontal, 14).padding(.top, 22).padding(.bottom, 14)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .kaleidoCard(radius: 20)
    }
}

// MARK: - 悬赏卡（原型 .bounty）

struct BountyCard: View {
    let bounty: Bounty
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 5) {
                    Text("✦").font(.system(size: 10.5))
                    Text(bounty.reward).font(.system(size: 10.5, weight: .semibold))
                }
                .foregroundStyle(Theme.apricot)
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(Color(hex: 0xFFB067, alpha: 0.14), in: Capsule())

                Text(bounty.question).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink).lineSpacing(4)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(bounty.responses).font(.system(size: 11)).foregroundStyle(Theme.faint)
            }
            .padding(.horizontal, 15).padding(.vertical, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .kaleidoCard(radius: 20)
        }
        .buttonStyle(PressScaleStyle())
    }
}

// MARK: - 发布悬赏浮层表单（问题 / 详情 / 标签 / 悬赏金额文案）

struct BountyComposeView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(SupabaseService.self) private var supabase
    @Environment(ToastCenter.self) private var toast

    /// 发布成功后回调（父视图刷新列表）
    var onPublished: () -> Void

    @State private var question = ""
    @State private var detail = ""
    @State private var tagText = ""
    @State private var reward = ""
    @State private var submitting = false
    @State private var errorText: String?

    private var trimmedQuestion: String { question.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var tags: [String] {
        tagText.split(whereSeparator: { " ,，、#\n".contains($0) }).map(String.init).filter { !$0.isEmpty }
    }
    private var questionValid: Bool { !trimmedQuestion.isEmpty && trimmedQuestion.count <= 200 }
    private var tagsValid: Bool { tags.count <= 5 }
    private var canSubmit: Bool { questionValid && tagsValid && !submitting }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("发布悬赏").font(.system(size: 17, weight: .bold)).foregroundStyle(Theme.ink)
                Text("向亲历者征集真实经历，而不是抽象建议。")
                    .font(.system(size: 11.5)).foregroundStyle(Theme.sub)

                field("你想问什么？（必填，≤200 字）") {
                    composeInput($question, prompt: "例如：有没有人从设计转数据分析？想听第一年最难的是什么", lines: 2...4)
                }
                if !trimmedQuestion.isEmpty && trimmedQuestion.count > 200 {
                    hint("问题最多 200 字，当前 \(trimmedQuestion.count) 字")
                }

                field("想了解的具体情况（选填）") {
                    composeInput($detail, prompt: "补充背景、真正的顾虑，让亲历者知道从哪里讲起。", lines: 3...6)
                }

                field("标签（选填，空格或逗号分隔，≤5 个）") {
                    composeInput($tagText, prompt: "例如：职业转型 数据分析 设计背景", lines: 1...2)
                }
                if !tags.isEmpty {
                    FlowLayout(spacing: 6) {
                        ForEach(tags, id: \.self) { TagPill(text: $0) }
                    }
                }
                if !tagsValid { hint("标签最多 5 个，当前 \(tags.count) 个") }

                field("悬赏文案（选填）") {
                    composeInput($reward, prompt: "例如：悬赏 3 个真实故事", lines: 1...2)
                }

                if let errorText {
                    hint(errorText)
                }

                Button(submitting ? "发布中…" : "发布悬赏") { submit() }
                    .font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(canSubmit ? AnyShapeStyle(Theme.buttonGradient) : AnyShapeStyle(Theme.raised), in: Capsule())
                    .buttonStyle(PressScaleStyle())
                    .disabled(!canSubmit)
                    .padding(.top, 4)
            }
            .padding(.horizontal, 22).padding(.top, 24).padding(.bottom, 26)
        }
        .scrollIndicators(.hidden)
    }

    private func field(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.system(size: 11.5)).foregroundStyle(Theme.sub)
            content()
        }
    }

    private func composeInput(_ text: Binding<String>, prompt: String, lines: ClosedRange<Int>) -> some View {
        TextField("", text: text,
                  prompt: Text(prompt).foregroundColor(Theme.faint),
                  axis: .vertical)
            .font(.system(size: 12.5)).foregroundStyle(Theme.ink).tint(Theme.blue)
            .lineLimit(lines)
            .padding(12)
            .background(Theme.raised, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }

    private func hint(_ text: String) -> some View {
        Text(text).font(.system(size: 11)).foregroundStyle(Theme.apricot)
    }

    private func submit() {
        guard canSubmit else { return }
        submitting = true
        errorText = nil
        let rewardText = reward.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            do {
                try await supabase.createBounty(
                    question: trimmedQuestion,
                    tags: tags.map { String($0.prefix(30)) },
                    detail: String(detail.trimmingCharacters(in: .whitespacesAndNewlines).prefix(2000)),
                    reward: String((rewardText.isEmpty ? "悬赏 3 个真实故事" : rewardText).prefix(50))
                )
                onPublished()
                dismiss()
                toast.show("悬赏已发布")
            } catch {
                errorText = "发布失败，请检查网络后重试"
            }
            submitting = false
        }
    }
}

#Preview {
    CommunityView()
        .environment(SupabaseService())
        .environment(ToastCenter())
        .preferredColorScheme(.dark)
}
