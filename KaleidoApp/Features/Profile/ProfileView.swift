import SwiftUI

// MARK: - 旅人主页（原型 profilePage）

struct ProfileView: View {
    let travelerId: Int

    @Environment(SupabaseService.self) private var supabase
    @Environment(ToastCenter.self) private var toast
    @Environment(\.dismiss) private var dismiss
    @State private var model: ProfileModel

    init(travelerId: Int) {
        self.travelerId = travelerId
        _model = State(initialValue: ProfileModel(travelerId: travelerId))
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            if model.loading {
                loadingState
            } else {
                content
                PayBar(model: model, toast: toast)
            }
        }
        .background(Color(hex: 0x090B12).ignoresSafeArea())
        .task { await model.load(supabase: supabase) }
        .sheet(item: Bindable(model).checkout) { checkout in
            PaywallView(model: model, checkout: checkout)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground(Color(hex: 0x11141D))
        }
    }

    private var loadingState: some View {
        VStack { Spacer(); OrbView(size: 80, showHalo: false); Spacer() }
            .frame(maxWidth: .infinity)
    }

    // MARK: 顶栏

    private var topBar: some View {
        HStack(spacing: 13) {
            BackButton { dismiss() }
            VStack(alignment: .leading, spacing: 2) {
                Text(model.traveler?.name ?? "旅人主页").font(.system(size: 16, weight: .semibold)).tracking(0.6)
                Text("真实经历 · 已验证").font(.system(size: 11)).foregroundStyle(Theme.faint)
            }
            Spacer()
            Button { toast.show("更多操作：分享主页 · 举报 · 屏蔽") } label: {
                Text("···").font(.system(size: 18)).tracking(1).foregroundStyle(Theme.sub)
                    .frame(width: 36, height: 36).background(Theme.raised, in: Circle())
                    .overlay(Circle().strokeBorder(Theme.line, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 22).padding(.top, 12).padding(.bottom, 11)
        .background(Color(hex: 0x0A0C12, alpha: 0.9))
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    // MARK: 内容

    private var content: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0, pinnedViews: [.sectionHeaders]) {
                if let t = model.traveler { hero(t) }
                Section {
                    panel.padding(.horizontal, 20).padding(.top, 20).padding(.bottom, 8)
                } header: {
                    tabsBar
                }
            }
        }
        .scrollIndicators(.hidden)
    }

    // MARK: Hero

    private func hero(_ t: Traveler) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 16) {
                TravelerAvatar(initial: t.initial, hue: t.hue, size: 74, cornerRadius: 26)
                    .overlay(alignment: .bottomTrailing) {
                        Circle().fill(Theme.teal).frame(width: 17, height: 17)
                            .overlay(Circle().strokeBorder(Color(hex: 0x10131D), lineWidth: 3)).offset(x: 2, y: 2)
                    }
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 8) {
                        Text(t.name).font(.system(size: 21, weight: .bold)).tracking(0.6).foregroundStyle(Theme.ink)
                        Text("经历已验证").font(.system(size: 10)).foregroundStyle(Color(hex: 0xAFC8FF))
                            .padding(.horizontal, 7).padding(.vertical, 3)
                            .background(Color(hex: 0x5E96FF, alpha: 0.13), in: Capsule())
                            .overlay(Capsule().strokeBorder(Color(hex: 0x5E96FF, alpha: 0.26), lineWidth: 1))
                    }
                    if let d = model.detail {
                        Text("\(d.age.map { "\($0) 岁 · " } ?? "")\(d.city ?? "")").font(.system(size: 12)).foregroundStyle(Theme.sub)
                    }
                }
                Spacer(minLength: 0)
            }
            if let d = model.detail {
                (Text(d.fromRole ?? "").foregroundColor(Theme.ink) + Text("  →  ").foregroundColor(Theme.blue) + Text(d.toRole ?? "").foregroundColor(Theme.ink))
                    .font(.system(size: 15, weight: .semibold)).padding(.top, 18)
                Text("\(d.years ?? "") · \(d.result ?? "")").font(.system(size: 12)).foregroundStyle(Theme.sub).padding(.top, 7)
            }
            FlowLayout(spacing: 7) {
                ForEach(t.tags, id: \.self) { tag in
                    Text(tag).font(.system(size: 11)).foregroundStyle(Color(hex: 0xC6D7FF))
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(Color(hex: 0x5E96FF, alpha: 0.11), in: Capsule())
                        .overlay(Capsule().strokeBorder(Color(hex: 0x5E96FF, alpha: 0.2), lineWidth: 1))
                }
            }
            .padding(.top, 16)
        }
        .padding(.horizontal, 22).padding(.top, 22).padding(.bottom, 20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(heroBackground)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    private var heroBackground: some View {
        ZStack {
            LinearGradient(colors: [Color(hex: 0x111625), Color(hex: 0x0B0E17)], startPoint: .topLeading, endPoint: .bottomTrailing)
            RadialGradient(colors: [Color(hex: 0x5E96FF, alpha: 0.28), .clear], center: .topTrailing, startRadius: 0, endRadius: 220)
        }
    }

    // MARK: Tabs

    private var tabsBar: some View {
        HStack(spacing: 0) {
            ForEach(ProfileModel.Tab.allCases) { t in
                Button {
                    withAnimation(.easeOut(duration: 0.22)) { model.tab = t }
                } label: {
                    VStack(spacing: 8) {
                        Text(t.label).font(.system(size: 11.5, weight: model.tab == t ? .semibold : .regular))
                            .foregroundStyle(model.tab == t ? Theme.ink : Theme.faint)
                        Rectangle().fill(Theme.blue).frame(height: 2).opacity(model.tab == t ? 1 : 0)
                            .padding(.horizontal, 20)
                    }
                    .frame(maxWidth: .infinity).padding(.top, 15).padding(.bottom, 0)
                }
                .buttonStyle(.plain)
            }
        }
        .background(Color(hex: 0x0A0C12, alpha: 0.94))
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    // MARK: Panel 分发

    @ViewBuilder
    private var panel: some View {
        switch model.tab {
        case .story: storyPanel
        case .timeline: TimelinePanel(model: model)
        case .advice: AdvicePanel(model: model)
        case .service: ServicePanel(model: model, toast: toast)
        }
    }

    // MARK: 她的故事

    private var storyPanel: some View {
        VStack(alignment: .leading, spacing: 18) {
            if let t = model.traveler {
                Text(t.quote).font(.system(size: 15, weight: .medium)).lineSpacing(6).foregroundStyle(Theme.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(22)
                    .background(LinearGradient(colors: [Color(hex: 0x5E96FF, alpha: 0.15), Color(hex: 0x8F7BFF, alpha: 0.08)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.25), lineWidth: 1))
            }
            if let d = model.detail {
                VStack(alignment: .leading, spacing: 10) {
                    Text("我的转型故事").font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                    Text(d.intro).font(.system(size: 13.5)).lineSpacing(7).foregroundStyle(Color(hex: 0xC8CDDA))
                }
                storyFacts(d)
                completeStory(d)
            }
        }
    }

    private func storyFacts(_ d: TravelerDetail) -> some View {
        HStack(spacing: 8) {
            fact("\(d.years?.filter(\.isNumber) ?? "\(model.traveler?.trajectory.count ?? 0)") 年", "真实实践")
            fact("\(model.traveler?.trajectory.count ?? 0)", "关键节点")
            fact("\(d.consulted ?? 0)", "已帮助人数")
        }
    }

    private func fact(_ value: String, _ label: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
            Text(label).font(.system(size: 10)).foregroundStyle(Theme.faint)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 13)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }

    @ViewBuilder
    private func completeStory(_ d: TravelerDetail) -> some View {
        if model.unlocked {
            VStack(alignment: .leading, spacing: 9) {
                Text("完整故事 · 最难的一关").font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Color(hex: 0xB9CCFF))
                Text(d.fullText).font(.system(size: 13)).lineSpacing(7).foregroundStyle(Theme.sub)
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
        } else {
            LockedBlock(title: "完整故事 · 最难的一关", hint: "解锁后可见 TA 亲述的关键一关") {
                model.checkout = .unlock
            }
        }
    }
}

#Preview {
    ProfileView(travelerId: 1)
        .environment(SupabaseService())
        .environment(ToastCenter())
        .preferredColorScheme(.dark)
}
