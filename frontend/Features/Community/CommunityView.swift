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

    private var travelers: [Traveler] {
        supabase.travelers.isEmpty ? DemoData.travelers : supabase.travelers
    }
    private var bounties: [Bounty] {
        supabase.bounties.isEmpty ? DemoData.bounties : supabase.bounties
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
        .overlay(alignment: .bottomTrailing) { if tab == 0 { drawFab } }
        .fullScreenCover(isPresented: $showDraw) { KaleidoscopeDrawView() }
        .fullScreenCover(item: $activeBounty) { bounty in
            BountyDetailView(bounty: bounty)
                .environment(toast)
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
}

// MARK: - 用户卡（原型 .ucard）

struct UserCard: View {
    let traveler: Traveler

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HueBandHeader(initial: traveler.initial, hue: traveler.hue)
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

#Preview {
    CommunityView()
        .environment(SupabaseService())
        .environment(ToastCenter())
        .preferredColorScheme(.dark)
}
