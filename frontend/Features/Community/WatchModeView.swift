import SwiftUI

// MARK: - 社区放映模式（原型 watch-mode：无限平铺 · 拖拽惯性 · 就近吸附）
//
// 错位网格（DX=160, DY=184，奇数列下移 DY/2），确定性哈希生成旅人昵称/色相，
// 点击气泡打开对应 demo 旅人的主页；搜索命中后重定位到最近匹配。

struct WatchModeView: View {
    let travelers: [Traveler]
    var searchQuery: String = ""

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // 已提交的世界偏移（原型 st.x / st.y）；手指按住期间的瞬时位移由
    // GestureState 单独承载，避免 position 同时被手势和动画 transaction 驱动。
    @State private var offset: CGSize = .zero
    @GestureState private var liveDrag = LiveDrag()
    // 拖拽簿记放引用类型：手势 tick 高频写入不触发额外的视图失效。
    @State private var drag = DragBookkeeping()
    @State private var motion: WatchMotion?
    @State private var motionTask: Task<Void, Never>?
    @State private var activeProfile: ProfileSelection?
    @State private var suppressProfileOpenUntil = Date.distantPast

    private struct LiveDrag {
        var translation: CGSize = .zero
        var isActive = false
    }

    private final class DragBookkeeping {
        var last: (translation: CGSize, time: Date)?
        var velocity: CGVector = .zero
    }

    private struct ProfileSelection: Identifiable {
        let id: Int
    }

    /// 惯性和吸附只保存运动参数；实际位置由 TimelineView 在同一显示帧中采样。
    /// 这避免 8ms Task 写 @State 与 SwiftUI 的渲染 transaction 不同相。
    private enum WatchMotion {
        case inertia(start: CGSize, velocity: CGVector, startedAt: Date, duration: TimeInterval)
        case snap(start: CGSize, target: CGSize, startedAt: Date, duration: TimeInterval)

        var duration: TimeInterval {
            switch self {
            case let .inertia(_, _, _, duration), let .snap(_, _, _, duration):
                return duration
            }
        }

        var startedAt: Date {
            switch self {
            case let .inertia(_, _, startedAt, _), let .snap(_, _, startedAt, _):
                return startedAt
            }
        }

        func value(at date: Date) -> CGSize {
            let elapsed = max(0, min(duration, date.timeIntervalSince(startedAt)))
            switch self {
            case let .inertia(start, velocity, _, _):
                // 等价于原型每 1/60 秒乘 0.88 的连续衰减。
                let decay = -log(0.88) * 60
                let travel = (1 - exp(-decay * elapsed)) / decay
                return CGSize(
                    width: start.width + velocity.dx * travel,
                    height: start.height + velocity.dy * travel
                )
            case let .snap(start, target, _, duration):
                let progress = duration > 0 ? elapsed / duration : 1
                // 原型逐帧靠近目标的平滑、无过冲版本。
                let eased = 1 - pow(1 - progress, 3)
                return CGSize(
                    width: start.width + (target.width - start.width) * eased,
                    height: start.height + (target.height - start.height) * eased
                )
            }
        }
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
        TimelineView(.animation(minimumInterval: 1.0 / 120, paused: motion == nil)) { timeline in
            GeometryReader { geo in
                let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
                let displayedOffset = displayedOffset(at: timeline.date)
                ZStack {
                    stageBackground
                    kaleidoBackdrop(center: center)
                    centerRing(center: center)
                    bubbles(center: center, offset: displayedOffset)
                    VStack {
                        Spacer()
                        Text("无限滑动浏览 · 点击卡片查看主页")
                            .font(.system(size: 9.5)).foregroundStyle(Color(hex: 0x9AA4BC, alpha: 0.62))
                            .padding(.bottom, 9)
                    }
                }
                .contentShape(Rectangle())
                .coordinateSpace(name: "watch-stage")
                // 圆圈本身是 Button；舞台拖动必须先于子按钮识别，否则从圆圈
                // 起手的拖动会被 Button 吞掉并在松手时误开主页。
                .highPriorityGesture(dragGesture, including: .all)
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("community-watch-stage")
            }
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
        .onChange(of: liveDrag.isActive) { wasActive, isActive in
            // 系统手势取消没有 onEnded 回调；避免点击抑制永久停在 distantFuture。
            if wasActive, !isActive, suppressProfileOpenUntil == .distantFuture {
                drag.last = nil
                drag.velocity = .zero
                suppressProfileOpenUntil = Date().addingTimeInterval(0.12)
            }
        }
        .onDisappear { stopMotion() }
        .fullScreenCover(item: $activeProfile) { selection in
            ProfileView(travelerId: selection.id)
        }
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

    private func visibleUsers(at offset: CGSize) -> [WatchUser] {
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

    private func bubbles(center: CGPoint, offset: CGSize) -> some View {
        let query = searchQuery.trimmingCharacters(in: .whitespaces)
        let users = visibleUsers(at: offset)
        // 焦点：距中心最近的匹配气泡
        let focusKey = users
            .filter { matches($0, query: query) }
            .min { distance($0, at: offset) < distance($1, at: offset) }?.key
        return ZStack {
            ForEach(users, id: \.key) { u in
                bubbleItem(u, center: center, offset: offset, query: query, focusKey: focusKey)
            }
        }
        // 手势位移永远是无动画的直接呈现；按压反馈的 transaction 不得把世界
        // position、边框/阴影/光效分别插值。
        .transaction { transaction in
            if liveDrag.isActive {
                transaction.animation = nil
                transaction.disablesAnimations = true
            }
        }
    }

    private func bubbleItem(
        _ u: WatchUser,
        center: CGPoint,
        offset: CGSize,
        query: String,
        focusKey: String?
    ) -> some View {
        let x = u.wx + offset.width
        let y = u.wy + offset.height
        let dist = (x * x + y * y).squareRoot()
        let focus = max(0, 1 - dist / 460)
        let hidden = !matches(u, query: query)
        return Button {
            guard Date() >= suppressProfileOpenUntil else { return }
            activeProfile = ProfileSelection(id: u.base.id)
        } label: {
            BubbleCard(user: u, isFocus: u.key == focusKey).equatable()
        }
        .buttonStyle(WatchBubbleButtonStyle(isDragging: liveDrag.isActive))
        .scaleEffect(0.62 + focus * 0.58)
        .opacity(hidden ? 0.06 : 0.28 + focus * 0.72)
        .position(x: center.x + x, y: center.y + y)
        // 64pt 分桶:拖动中 z 序基本稳定,避免每帧重排 ZStack
        .zIndex(Double(100 - Int(dist / 64)))
        .allowsHitTesting(!hidden)
        .accessibilityIdentifier("community-watch-bubble-\(u.key)")
    }

    private func distance(_ u: WatchUser, at offset: CGSize) -> Double {
        let x = u.wx + offset.width, y = u.wy + offset.height
        return (x * x + y * y).squareRoot()
    }

    /// 圆圈保留点击反馈，但拖动一旦成立就立即回到 1×，不让 Button 的 150ms
    /// 按压动画叠加到世界位移上。
    private struct WatchBubbleButtonStyle: ButtonStyle {
        let isDragging: Bool

        func makeBody(configuration: Configuration) -> some View {
            let isPressed = configuration.isPressed && !isDragging
            configuration.label
                .scaleEffect(isPressed ? 0.97 : 1)
                .brightness(isPressed ? 0.12 : 0)
                .animation(
                    isDragging ? nil : .easeOut(duration: 0.15),
                    value: isPressed
                )
        }
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

    /// 原型 .watch-center-ring：保留中心微光和刻度，不绘制虚线环
    private func centerRing(center: CGPoint) -> some View {
        ZStack {
            Circle()
                .strokeBorder(Color(hex: 0x5E96FF, alpha: 0.12), lineWidth: 2)
                .blur(radius: 17)
                .frame(width: 190, height: 190)
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
        DragGesture(minimumDistance: 4, coordinateSpace: .named("watch-stage"))
            .updating($liveDrag) { value, state, transaction in
                transaction.animation = nil
                transaction.disablesAnimations = true
                state = LiveDrag(translation: value.translation, isActive: true)
            }
            .onChanged { value in
                let now = Date()
                if drag.last == nil {
                    stopMotion(at: now)
                    drag.velocity = .zero
                    // SwiftUI 的子 Button 可能在父 DragGesture 结束后仍发送 action；
                    // 拖动一成立就关闭主页 action，onEnded 后再留一帧安全窗口。
                    suppressProfileOpenUntil = .distantFuture
                }
                if let last = drag.last {
                    let dt = max(0.004, now.timeIntervalSince(last.time))
                    let instantaneous = CGVector(
                        dx: (value.translation.width - last.translation.width) / dt,
                        dy: (value.translation.height - last.translation.height) / dt
                    )
                    // 轻度低通抑制最后一个触摸采样的速度尖峰。
                    drag.velocity = CGVector(
                        dx: drag.velocity.dx * 0.25 + instantaneous.dx * 0.75,
                        dy: drag.velocity.dy * 0.25 + instantaneous.dy * 0.75
                    )
                }
                drag.last = (value.translation, now)
            }
            .onEnded { value in
                var transaction = Transaction(animation: nil)
                transaction.disablesAnimations = true
                withTransaction(transaction) {
                    offset.width += value.translation.width
                    offset.height += value.translation.height
                }
                drag.last = nil
                suppressProfileOpenUntil = Date().addingTimeInterval(0.12)
                runInertia()
            }
    }

    private func displayedOffset(at date: Date) -> CGSize {
        let base = motion?.value(at: date) ?? offset
        return CGSize(
            width: base.width + liveDrag.translation.width,
            height: base.height + liveDrag.translation.height
        )
    }

    private func stopMotion(at date: Date = Date()) {
        motionTask?.cancel()
        guard let motion else { return }
        var transaction = Transaction(animation: nil)
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            offset = motion.value(at: date)
            self.motion = nil
        }
    }

    private func runInertia() {
        motionTask?.cancel()
        let velocity = drag.velocity
        drag.velocity = .zero
        if reduceMotion || abs(velocity.dx) + abs(velocity.dy) < 30 {
            beginSnap(from: offset)
            return
        }

        // 原型 0.88/帧衰减到 0.55pt/帧；这里只安排阶段结束，
        // 中间每一帧都由 TimelineView 直接从解析曲线采样。
        let speed = max(abs(velocity.dx), abs(velocity.dy))
        let decay = -log(0.88) * 60
        let duration = min(1.1, max(0.18, log(max(speed / 34, 1)) / decay))
        let start = offset
        let startedAt = Date()
        motion = .inertia(start: start, velocity: velocity, startedAt: startedAt, duration: duration)
        motionTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(duration))
            guard !Task.isCancelled else { return }
            let end = self.motion?.value(at: Date()) ?? self.offset
            self.offset = end
            self.motion = nil
            self.beginSnap(from: end)
        }
    }

    private func beginSnap(from start: CGSize) {
        let query = searchQuery.trimmingCharacters(in: .whitespaces)
        guard let nearest = visibleUsers(at: start)
            .filter({ matches($0, query: query) })
            .min(by: { distance($0, at: start) < distance($1, at: start) }) else { return }
        let tx = -nearest.wx, ty = -nearest.wy
        let target = CGSize(width: tx, height: ty)
        if reduceMotion {
            offset = target
            motion = nil
            return
        }
        let duration = 0.42
        let startedAt = Date()
        offset = start
        motion = .snap(start: start, target: target, startedAt: startedAt, duration: duration)
        motionTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(duration))
            guard !Task.isCancelled else { return }
            self.offset = target
            self.motion = nil
        }
    }

    /// 搜索命中后重定位（原型 centerCommunitySearchResult 的近邻扫描）
    private func recenterOnSearch(_ rawQuery: String) {
        let query = rawQuery.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return }
        stopMotion()
        let centerQ = Int((-offset.width / Self.dx).rounded())
        let centerR = Int((-offset.height / Self.dy).rounded())
        for radius in 0...10 {
            for q in (centerQ - radius)...(centerQ + radius) {
                for r in (centerR - radius)...(centerR + radius) {
                    if radius > 0 && abs(q - centerQ) != radius && abs(r - centerR) != radius { continue }
                    let candidate = user(q: q, r: r)
                    if matches(candidate, query: query) {
                        let target = CGSize(width: -candidate.wx, height: -candidate.wy)
                        if reduceMotion {
                            offset = target
                        } else {
                            let duration = 0.55
                            let startedAt = Date()
                            motion = .snap(start: offset, target: target, startedAt: startedAt, duration: duration)
                            motionTask = Task { @MainActor in
                                try? await Task.sleep(for: .seconds(duration))
                                guard !Task.isCancelled else { return }
                                self.offset = target
                                self.motion = nil
                            }
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
