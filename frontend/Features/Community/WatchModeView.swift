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
    // 拖拽簿记放引用类型:手势 tick 高频写入不触发视图失效
    @State private var drag = DragBookkeeping()
    @State private var motionTask: Task<Void, Never>?

    private final class DragBookkeeping {
        var start: CGSize = .zero
        var last: (point: CGPoint, time: Date)?
        var velocity: CGVector = .zero
    }

    private static let dx: Double = 160
    private static let dy: Double = 184
    // 渐隐 mask 半径 340pt,超出的气泡不可见:7×5 已完整覆盖可视圆 + 边缘渐隐带
    private static let cols = 7
    private static let rows = 5

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
                stageBackground
                kaleidoBackdrop(center: center)
                centerRing(center: center)
                bubbles(center: center)
                VStack {
                    Spacer()
                    Text("无限滑动浏览 · 点击卡片查看主页")
                        .font(.system(size: 9.5)).foregroundStyle(Color(hex: 0x9AA4BC, alpha: 0.62))
                        .padding(.bottom, 9)
                }
            }
            .contentShape(Rectangle())
            .gesture(dragGesture)
        }
        .frame(height: 548)
        // 原型 .masonry.watch-mode 的 mask-image：椭圆渐隐 vignette
        .mask(
            RadialGradient(stops: [
                .init(color: .black, location: 0),
                .init(color: .black, location: 0.64),
                .init(color: .black.opacity(0.76), location: 0.78),
                .init(color: .clear, location: 1),
            ], center: UnitPoint(x: 0.5, y: 0.48), startRadius: 0, endRadius: 340)
        )
        .onChange(of: searchQuery) { _, query in
            recenterOnSearch(query)
        }
        .onDisappear { motionTask?.cancel() }
    }

    /// 原型 watch-mode 舞台背景：三个弱径向光斑
    private var stageBackground: some View {
        ZStack {
            RadialGradient(colors: [Color(hex: 0x5E96FF, alpha: 0.11), .clear],
                           center: UnitPoint(x: 0.5, y: 0.47), startRadius: 0, endRadius: 210)
            RadialGradient(colors: [Color(hex: 0xE35CC1, alpha: 0.06), .clear],
                           center: UnitPoint(x: 0.14, y: 0.18), startRadius: 0, endRadius: 180)
            RadialGradient(colors: [Color(hex: 0x3ED9A4, alpha: 0.04), .clear],
                           center: UnitPoint(x: 0.9, y: 0.8), startRadius: 0, endRadius: 165)
        }
        .allowsHitTesting(false)
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
            BubbleCard(user: u, isFocus: u.key == focusKey).equatable()
        }
        .scaleEffect(0.62 + focus * 0.58)
        .opacity(hidden ? 0.06 : 0.28 + focus * 0.72)
        .position(x: center.x + x, y: center.y + y)
        // 64pt 分桶:拖动中 z 序基本稳定,避免每帧重排 ZStack
        .zIndex(Double(100 - Int(dist / 64)))
        .allowsHitTesting(!hidden)
    }

    private func distance(_ u: WatchUser) -> Double {
        let x = u.wx + offset.width, y = u.wy + offset.height
        return (x * x + y * y).squareRoot()
    }

    /// 圆形毛玻璃气泡（原型 .watch-user：154×154 · 玻璃渐变 + 高光 + 色相辉光 + 流光 + 星点）
    /// Equatable:拖动时 key/isFocus 不变则跳过整棵重型子树的 diff,
    /// 外层只动 scale/opacity/position 三个廉价可动画修饰符。
    private struct BubbleCard: View, Equatable {
        let user: WatchUser
        let isFocus: Bool

        static func == (l: Self, r: Self) -> Bool {
            l.user.key == r.user.key && l.isFocus == r.isFocus
        }

        var body: some View {
            let glow = Theme.hue(user.hue).accent
            VStack(spacing: 0) {
                TravelerAvatar(initial: user.name.prefix(1).description, hue: user.hue, size: 43,
                               imageName: MockAvatar.name(hashing: user.name))
                    .overlay(Circle().strokeBorder(.white.opacity(0.82), lineWidth: 1.5))
                    .compositingGroup()
                    .shadow(color: .black.opacity(0.4), radius: 5, y: 3)
                Text(user.name)
                    .font(.system(size: 12.5, weight: .bold)).foregroundStyle(.white)
                    .lineLimit(1)
                    .shadow(color: .black.opacity(0.65), radius: 4, y: 2)
                    .padding(.top, 4)
                Text(user.base.bio)
                    .font(.system(size: 9)).foregroundStyle(Color(hex: 0xEEF3FF, alpha: 0.82))
                    .lineLimit(2).multilineTextAlignment(.center).lineSpacing(1.5)
                    .frame(width: 112)
                    .padding(.top, 3)
                HStack(spacing: 4) {
                    ForEach(user.base.tags.prefix(2), id: \.self) { tag in
                        Text(tag)
                            .font(.system(size: 7.5)).foregroundStyle(Color(hex: 0xE1E9FF))
                            .lineLimit(1)
                            .padding(.horizontal, 5).padding(.vertical, 2.5)
                            .background(Color(hex: 0xD6E2FF, alpha: 0.12), in: Capsule())
                            .overlay(Capsule().strokeBorder(Color(hex: 0xDFE9FF, alpha: 0.1), lineWidth: 1))
                    }
                }
                .frame(maxWidth: 114)
                .padding(.top, 5)
            }
            .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 10)
            .frame(width: 154, height: 154)
            .background {
                ZStack {
                    // 玻璃底 + 左上白高光 + 右下色相辉光
                    LinearGradient(colors: [Color(hex: 0x1D2640, alpha: 0.58), Color(hex: 0x080B18, alpha: 0.38)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                    RadialGradient(colors: [Color.white.opacity(0.16), .clear],
                                   center: UnitPoint(x: 0.25, y: 0.16), startRadius: 0, endRadius: 42)
                    RadialGradient(colors: [glow.opacity(0.24), .clear],
                                   center: UnitPoint(x: 0.78, y: 0.76), startRadius: 0, endRadius: 80)
                }
            }
            .clipShape(Circle())
            // 内圈流光（原型 ::before conic 渐变 + 1px 内描边）
            .overlay {
                Circle()
                    .strokeBorder(
                        AngularGradient(stops: [
                            .init(color: .white.opacity(0.16), location: 0),
                            .init(color: .clear, location: 0.18),
                            .init(color: .white.opacity(0.06), location: 0.35),
                            .init(color: .clear, location: 0.58),
                            .init(color: glow.opacity(0.22), location: 0.78),
                            .init(color: .clear, location: 1),
                        ], center: .center, angle: .degrees(30)),
                        lineWidth: 1.2)
                    .padding(3)
            }
            // 星点（原型 ::after 四个 radial 亮点）
            .overlay {
                GeometryReader { geo in
                    let w = geo.size.width, h = geo.size.height
                    Circle().fill(.white.opacity(0.86)).frame(width: 2, height: 2).position(x: w * 0.23, y: h * 0.35)
                    Circle().fill(.white.opacity(0.55)).frame(width: 1.6, height: 1.6).position(x: w * 0.76, y: h * 0.27)
                    Circle().fill(.white.opacity(0.62)).frame(width: 1.4, height: 1.4).position(x: w * 0.68, y: h * 0.68)
                    Circle().fill(glow.opacity(0.9)).frame(width: 1.6, height: 1.6).position(x: w * 0.35, y: h * 0.78)
                }
                .allowsHitTesting(false)
            }
            .overlay(Circle().strokeBorder(
                isFocus ? Color(hex: 0xDEE9FF, alpha: 0.78) : Color(hex: 0xCFE0FF, alpha: 0.23), lineWidth: 1))
            // 先压成单层再打阴影:否则 shadow 会对气泡内每个绘制原语各模糊一次,
            // 63 个气泡 × 数十个原语的离屏模糊正是真机拖动掉帧的主因
            .compositingGroup()
            .brightness(isFocus ? 0.09 : 0)
            .saturation(isFocus ? 1.14 : 1)
            .shadow(color: .black.opacity(0.8), radius: 14, y: 10)
            .shadow(color: glow.opacity(isFocus ? 0.42 : 0.18), radius: isFocus ? 22 : 13)
        }
    }

    // MARK: 背景（原型 .watch-kaleido：双细环上的彩色弧段 · 32s 旋转 · opacity .16）

    private static let arcSegments: [(from: Double, to: Double, color: Color)] = [
        (0.09, 0.12, Color(hex: 0x5E96FF, alpha: 0.4)),
        (0.27, 0.30, Color(hex: 0xE35CC1, alpha: 0.32)),
        (0.46, 0.49, Color(hex: 0xFF7A4D, alpha: 0.28)),
        (0.68, 0.71, Color(hex: 0x8F7BFF, alpha: 0.35)),
    ]

    private func kaleidoBackdrop(center: CGPoint) -> some View {
        TimelineView(.animation(minimumInterval: 1.0 / 20, paused: reduceMotion)) { timeline in
            let angle = reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 32) / 32 * 360
            ZStack {
                // conic-gradient 弧段裁到 46% 与 67% 两个细环半径（470 盘面）
                ForEach([218.0, 316.0], id: \.self) { diameter in
                    ForEach(Array(Self.arcSegments.enumerated()), id: \.offset) { _, seg in
                        Circle()
                            .trim(from: seg.from, to: seg.to)
                            .stroke(seg.color, style: StrokeStyle(lineWidth: 4.5, lineCap: .round))
                            .frame(width: diameter, height: diameter)
                    }
                }
            }
            .rotationEffect(.degrees(angle - 90))
            .opacity(0.16)
            .position(center)
        }
        .allowsHitTesting(false)
    }

    /// 原型 .watch-center-ring：190pt 虚线环 + 内外辉光 + 上/左两个刻度
    private func centerRing(center: CGPoint) -> some View {
        ZStack {
            Circle()
                .strokeBorder(Color(hex: 0x9DBCFF, alpha: 0.34), style: StrokeStyle(lineWidth: 1, dash: [4, 6]))
                .frame(width: 190, height: 190)
                .shadow(color: Color(hex: 0x5E96FF, alpha: 0.16), radius: 17)
                .background(
                    Circle().fill(
                        RadialGradient(colors: [.clear, Color(hex: 0x5E96FF, alpha: 0.08)],
                                       center: .center, startRadius: 62, endRadius: 95))
                        .frame(width: 190, height: 190)
                )
            Rectangle().fill(Color(hex: 0x9DBCFF, alpha: 0.3)).frame(width: 1, height: 7).offset(y: -98.5)
            Rectangle().fill(Color(hex: 0x9DBCFF, alpha: 0.3)).frame(width: 7, height: 1).offset(x: -98.5)
        }
        .position(center)
        .allowsHitTesting(false)
    }

    // MARK: 拖拽 + 惯性 + 吸附

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 4)
            .onChanged { value in
                motionTask?.cancel()
                if drag.last == nil {
                    drag.start = offset
                }
                let now = Date()
                if let last = drag.last {
                    let dt = max(0.004, now.timeIntervalSince(last.time))
                    drag.velocity = CGVector(dx: (value.location.x - last.point.x) / dt,
                                             dy: (value.location.y - last.point.y) / dt)
                }
                drag.last = (value.location, now)
                offset = CGSize(width: drag.start.width + value.translation.width,
                                height: drag.start.height + value.translation.height)
            }
            .onEnded { _ in
                drag.last = nil
                runInertia()
            }
    }

    private func runInertia() {
        motionTask?.cancel()
        // 原型 runWatchInertia:速度按 0.88/16ms 衰减,随后就近吸附。
        // 步进 8ms(等效衰减 √0.88≈0.94)以贴合 ProMotion 120Hz,总位移不变。
        var mx = drag.velocity.dx * 0.008
        var my = drag.velocity.dy * 0.008
        drag.velocity = .zero
        motionTask = Task { @MainActor in
            while !Task.isCancelled, abs(mx) + abs(my) > 0.3 {
                offset.width += mx
                offset.height += my
                mx *= 0.94
                my *= 0.94
                try? await Task.sleep(for: .milliseconds(8))
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
            offset.width += (tx - offset.width) * 0.095
            offset.height += (ty - offset.height) * 0.095
            try? await Task.sleep(for: .milliseconds(8))
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
