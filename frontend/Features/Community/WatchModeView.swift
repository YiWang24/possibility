import SwiftUI

// MARK: - 社区放映模式（原型 watch-mode：无限平铺 · 拖拽惯性 · 就近吸附）
//
// 错位网格（DX=160, DY=184，奇数列下移 DY/2），确定性哈希生成旅人昵称/色相，
// 点击气泡打开对应 demo 旅人的主页；搜索命中后重定位到最近匹配。

struct WatchModeView: View {
    let travelers: [Traveler]
    var searchQuery: String = ""

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // 世界偏移（原型 st.x / st.y）
    @State private var offset: CGSize = .zero
    @State private var dragStart: CGSize = .zero
    @State private var lastDrag: (point: CGPoint, time: Date)?
    @State private var velocity: CGVector = .zero
    @State private var motionTask: Task<Void, Never>?

    private static let dx: Double = 160
    private static let dy: Double = 184
    private static let cols = 9
    private static let rows = 7

    private static let nameHeads = ["云间", "南岸", "北辰", "晚晴", "松野", "青屿", "白露", "橙湾", "星河", "木槿", "晴川", "远帆", "林深", "小满", "月桥", "山止", "海盐", "春序", "微光", "野渡", "风眠", "竹影", "晨雾", "栖迟"]
    private static let nameTails = ["拾光", "行舟", "折页", "听风", "慢跑", "看海", "造梦", "写信", "观星", "种树", "漫游", "读城", "寻路", "开花", "向晚", "未央", "煮茶", "登山", "停云", "问路", "放映", "织网", "点灯", "候鸟"]

    struct WatchUser {
        let key: String
        let name: String
        let hue: Int
        let base: Traveler
        let wx: Double
        let wy: Double
    }

    var body: some View {
        GeometryReader { geo in
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
            ZStack {
                kaleidoBackdrop(center: center)
                centerRing(center: center)
                bubbles(center: center)
                    .mask(
                        RadialGradient(stops: [
                            .init(color: .black, location: 0),
                            .init(color: .black, location: 0.62),
                            .init(color: .black.opacity(0.08), location: 1),
                        ], center: .center, startRadius: 0, endRadius: max(geo.size.width, geo.size.height) * 0.62)
                    )
                VStack {
                    Spacer()
                    Text("无限滑动浏览 · 点击卡片查看主页")
                        .font(.system(size: 10.5)).foregroundStyle(Theme.faint)
                        .padding(.bottom, 10)
                }
            }
            .contentShape(Rectangle())
            .gesture(dragGesture)
        }
        .frame(height: 470)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
        .onChange(of: searchQuery) { _, query in
            recenterOnSearch(query)
        }
        .onDisappear { motionTask?.cancel() }
    }

    // MARK: 确定性用户（原型 watchHash / watchUserAt）

    private static func hash(_ q: Int, _ r: Int) -> UInt32 {
        func imul(_ a: Int32, _ b: Int32) -> Int32 { Int32(truncatingIfNeeded: Int64(a) &* Int64(b)) }
        var h = imul(Int32(truncatingIfNeeded: q), 73856093)
            ^ imul(Int32(truncatingIfNeeded: r), 19349663)
            ^ imul(1, 83492791)
        h = imul(h ^ Int32(bitPattern: UInt32(bitPattern: h) >> 16), Int32(bitPattern: 2246822507))
        h = imul(h ^ Int32(bitPattern: UInt32(bitPattern: h) >> 13), Int32(bitPattern: 3266489909))
        let u = UInt32(bitPattern: h)
        return u ^ (u >> 16)
    }

    private func user(q: Int, r: Int) -> WatchUser {
        let seed = Self.hash(q, r)
        let base = travelers[Int(seed) % max(travelers.count, 1)]
        let name = Self.nameHeads[Int(seed) % Self.nameHeads.count]
            + Self.nameTails[Int(seed >> 8) % Self.nameTails.count]
        let qOffset = Double(abs(q) % 2) * Self.dy / 2
        return WatchUser(key: "\(q):\(r)", name: name, hue: Int(seed >> 12) % 5, base: base,
                         wx: Double(q) * Self.dx, wy: Double(r) * Self.dy + qOffset)
    }

    private func matches(_ user: WatchUser, query: String) -> Bool {
        guard !query.isEmpty else { return true }
        let haystack = ([user.name, user.base.bio, user.base.quote] + user.base.tags)
            .joined(separator: " ").lowercased()
        return haystack.contains(query.lowercased())
    }

    // MARK: 可见气泡

    private var visibleUsers: [WatchUser] {
        let centerQ = Int((-offset.width / Self.dx).rounded())
        var users: [WatchUser] = []
        for dq in -(Self.cols / 2)...(Self.cols / 2) {
            let q = centerQ + dq
            let qOffset = Double(abs(q) % 2) * Self.dy / 2
            let centerR = Int(((-offset.height - qOffset) / Self.dy).rounded())
            for dr in -(Self.rows / 2)...(Self.rows / 2) {
                users.append(user(q: q, r: centerR + dr))
            }
        }
        return users
    }

    private func bubbles(center: CGPoint) -> some View {
        let query = searchQuery.trimmingCharacters(in: .whitespaces)
        let users = visibleUsers
        // 焦点：距中心最近的匹配气泡
        let focusKey = users
            .filter { matches($0, query: query) }
            .min { distance($0) < distance($1) }?.key
        return ZStack {
            ForEach(users, id: \.key) { u in
                bubbleItem(u, center: center, query: query, focusKey: focusKey)
            }
        }
    }

    private func bubbleItem(_ u: WatchUser, center: CGPoint, query: String, focusKey: String?) -> some View {
        let x = u.wx + offset.width
        let y = u.wy + offset.height
        let dist = (x * x + y * y).squareRoot()
        let focus = max(0, 1 - dist / 460)
        let hidden = !matches(u, query: query)
        return TravelerProfileLink(travelerId: u.base.id) {
            bubble(u, isFocus: u.key == focusKey)
        }
        .scaleEffect(0.62 + focus * 0.58)
        .opacity(hidden ? 0.06 : 0.28 + focus * 0.72)
        .position(x: center.x + x, y: center.y + y)
        .zIndex(Double(100 - Int(dist / 10)))
        .allowsHitTesting(!hidden)
    }

    private func distance(_ u: WatchUser) -> Double {
        let x = u.wx + offset.width, y = u.wy + offset.height
        return (x * x + y * y).squareRoot()
    }

    private func bubble(_ u: WatchUser, isFocus: Bool) -> some View {
        VStack(spacing: 5) {
            TravelerAvatar(initial: u.name.prefix(1).description, hue: u.hue, size: 40)
            Text(u.name).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.ink)
            Text(u.base.bio).font(.system(size: 8.5)).foregroundStyle(Theme.sub)
                .lineLimit(2).multilineTextAlignment(.center)
                .frame(width: 96)
            HStack(spacing: 4) {
                ForEach(u.base.tags.prefix(2), id: \.self) { tag in
                    Text(tag).font(.system(size: 7.5)).foregroundStyle(Color(hex: 0x9DBCFF))
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color(hex: 0x5E96FF, alpha: 0.14), in: Capsule())
                }
            }
        }
        .frame(width: 132, height: 132)
        .background(
            RadialGradient(colors: [Color.white.opacity(0.1), Color.white.opacity(0.03), .clear],
                           center: UnitPoint(x: 0.5, y: 0.35), startRadius: 4, endRadius: 78),
            in: Circle()
        )
        .background(Color(hex: 0x0D1120, alpha: 0.72), in: Circle())
        .overlay(
            Circle().strokeBorder(
                AngularGradient(colors: [
                    Theme.hue(u.hue).accent.opacity(isFocus ? 0.9 : 0.42),
                    .white.opacity(0.1),
                    Theme.hue(u.hue).accent.opacity(isFocus ? 0.65 : 0.28),
                    .white.opacity(0.08),
                    Theme.hue(u.hue).accent.opacity(isFocus ? 0.9 : 0.42),
                ], center: .center),
                lineWidth: isFocus ? 1.6 : 1)
        )
        .shadow(color: Theme.hue(u.hue).accent.opacity(isFocus ? 0.4 : 0.12), radius: isFocus ? 18 : 9, y: 5)
    }

    // MARK: 背景（32s conic 旋转环 + 虚线中心环）

    private func kaleidoBackdrop(center: CGPoint) -> some View {
        TimelineView(.animation(minimumInterval: 1.0 / 20, paused: reduceMotion)) { timeline in
            let angle = reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 32) / 32 * 360
            ZStack {
                Circle()
                    .strokeBorder(AngularGradient(colors: Theme.orbConicColors, center: .center), lineWidth: 60)
                    .frame(width: 430, height: 430)
                    .rotationEffect(.degrees(angle))
                    .opacity(0.16)
                    .blur(radius: 18)
            }
            .position(center)
        }
        .allowsHitTesting(false)
    }

    private func centerRing(center: CGPoint) -> some View {
        ZStack {
            Circle()
                .strokeBorder(Color.white.opacity(0.18), style: StrokeStyle(lineWidth: 1, dash: [5, 7]))
                .frame(width: 190, height: 190)
            ForEach(0..<4, id: \.self) { i in
                Rectangle().fill(Color.white.opacity(0.25))
                    .frame(width: i % 2 == 0 ? 1 : 10, height: i % 2 == 0 ? 10 : 1)
                    .offset(x: i == 1 ? -95 : i == 3 ? 95 : 0,
                            y: i == 0 ? -95 : i == 2 ? 95 : 0)
            }
        }
        .position(center)
        .allowsHitTesting(false)
    }

    // MARK: 拖拽 + 惯性 + 吸附

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 4)
            .onChanged { value in
                motionTask?.cancel()
                if lastDrag == nil {
                    dragStart = offset
                }
                let now = Date()
                if let last = lastDrag {
                    let dt = max(0.008, now.timeIntervalSince(last.time))
                    velocity = CGVector(dx: (value.location.x - last.point.x) / dt,
                                        dy: (value.location.y - last.point.y) / dt)
                }
                lastDrag = (value.location, now)
                offset = CGSize(width: dragStart.width + value.translation.width,
                                height: dragStart.height + value.translation.height)
            }
            .onEnded { _ in
                lastDrag = nil
                runInertia()
            }
    }

    private func runInertia() {
        motionTask?.cancel()
        // 原型 runWatchInertia：速度衰减 0.88/帧，随后就近吸附
        var mx = velocity.dx * 0.016
        var my = velocity.dy * 0.016
        velocity = .zero
        motionTask = Task { @MainActor in
            while !Task.isCancelled, abs(mx) + abs(my) > 0.55 {
                offset.width += mx
                offset.height += my
                mx *= 0.88
                my *= 0.88
                try? await Task.sleep(for: .milliseconds(16))
            }
            guard !Task.isCancelled else { return }
            await snapToNearest()
        }
    }

    private func snapToNearest() async {
        let query = searchQuery.trimmingCharacters(in: .whitespaces)
        guard let nearest = visibleUsers
            .filter({ matches($0, query: query) })
            .min(by: { distance($0) < distance($1) }) else { return }
        let tx = -nearest.wx, ty = -nearest.wy
        while !Task.isCancelled,
              abs(tx - offset.width) + abs(ty - offset.height) > 0.7 {
            offset.width += (tx - offset.width) * 0.18
            offset.height += (ty - offset.height) * 0.18
            try? await Task.sleep(for: .milliseconds(16))
        }
        if !Task.isCancelled {
            offset = CGSize(width: tx, height: ty)
        }
    }

    /// 搜索命中后重定位（原型 centerCommunitySearchResult 的近邻扫描）
    private func recenterOnSearch(_ rawQuery: String) {
        let query = rawQuery.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return }
        motionTask?.cancel()
        let centerQ = Int((-offset.width / Self.dx).rounded())
        let centerR = Int((-offset.height / Self.dy).rounded())
        for radius in 0...10 {
            for q in (centerQ - radius)...(centerQ + radius) {
                for r in (centerR - radius)...(centerR + radius) {
                    if radius > 0 && abs(q - centerQ) != radius && abs(r - centerR) != radius { continue }
                    let candidate = user(q: q, r: r)
                    if matches(candidate, query: query) {
                        withAnimation(.spring(response: 0.55, dampingFraction: 0.85)) {
                            offset = CGSize(width: -candidate.wx, height: -candidate.wy)
                        }
                        return
                    }
                }
            }
        }
    }
}

#Preview {
    WatchModeView(travelers: DemoData.travelers)
        .environment(SupabaseService())
        .environment(ToastCenter())
        .padding()
        .preferredColorScheme(.dark)
}
