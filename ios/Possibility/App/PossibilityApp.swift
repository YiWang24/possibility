import Supabase
import SwiftUI

@main
struct PossibilityApp: App {
    @State private var supabase: SupabaseService
    @Environment(\.scenePhase) private var scenePhase

    /// 埋点必须在 bootstrap 之前装好：bootstrap 恢复到会话后会立刻 identify，
    /// 后端没注册的话那次 identify 就丢了，冷启动 cohort 直接缺一块。
    /// 同理 Sentry 越早启动越好——启动期崩溃只有这个时机抓得到。
    init() {
        let service = SupabaseService()
        AnalyticsBootstrap.register(client: service.client)
        _supabase = State(initialValue: service)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(supabase)
                .preferredColorScheme(.dark) // 暗色是贴合内省气质的有意选择
                .task {
                    await supabase.bootstrap() // 冷启动恢复会话（有会话则 identify + 预取）
                    Analytics.shared.track(.appOpened(
                        isFirstOpen: AnalyticsBootstrap.consumeFirstOpenFlag(),
                        isAuthenticated: supabase.isAuthenticated
                    ))
                }
                .onChange(of: scenePhase) { _, phase in
                    // 退到后台时进程随时可能被回收，缓冲里的事件必须先落地
                    if phase != .active { AnalyticsBootstrap.flushBeforeSuspend() }
                }
        }
    }
}

// MARK: - 埋点装配（docs/埋点方案.md §0 三层）

/// 注册三个上报后端 + 维护「是否首次打开」。
///
/// **降级契约**：PostHog / Sentry 的密钥由 Config.xcconfig 注入，仓库里只有空模板。
/// 密钥缺失时 `make()` 返回 nil，对应 backend 直接不注册 —— App 正常启动、
/// 埋点调用点静默 no-op、不崩不弹错。埋点绝不能成为启动依赖。
/// Layer 1（app_events）不依赖任何外部密钥，所以永远在，最坏情况也保得住事实表。
@MainActor
enum AnalyticsBootstrap {

    private static let firstOpenKey = "analytics_has_opened_v1"
    private static var supabaseBackend: SupabaseEventBackend?

    static func register(client: SupabaseClient) {
        // Layer 3：Sentry 放最前 —— 它要尽早接管崩溃处理器，才抓得到启动期崩溃
        if let sentry = SentryBackend.make() { Analytics.shared.register(sentry) }
        // Layer 2：PostHog（现成漏斗/留存看板）
        if let posthog = PostHogBackend.make() { Analytics.shared.register(posthog) }
        // Layer 1：app_events 事实表 —— 无外部密钥依赖，永远注册
        let events = SupabaseEventBackend(client: client)
        events.start()
        supabaseBackend = events
        Analytics.shared.register(events)
    }

    /// 首次打开只报一次：读完立刻落 UserDefaults，重装 App 才会重新为 true。
    /// 放在 UserDefaults 而非 Keychain 是有意的——「新装机」本就该算新用户。
    static func consumeFirstOpenFlag() -> Bool {
        let store = UserDefaults.standard
        guard !store.bool(forKey: firstOpenKey) else { return false }
        store.set(true, forKey: firstOpenKey)
        return true
    }

    /// 强制冲刷缓冲（退到后台，进程随时可能被回收）
    static func flushBeforeSuspend() {
        supabaseBackend?.flushBeforeSuspend()
    }
}

// MARK: - 根导航：登录墙 → 底部四 Tab（认识你自己 / 人生实验室 / 万花筒社区 / 我的主页）

enum AppTab: Hashable {
    case home, lab, community, me
}

/// 冷启动分流。匿名模式已停用，未登录时全部 Edge Function 都会 401，
/// 所以在这里就把用户拦在登录墙上，而不是放进去看一屏加载失败。
struct RootView: View {
    @Environment(SupabaseService.self) private var supabase

    var body: some View {
        Group {
            if !supabase.isReady {
                SplashView()
            } else if !supabase.isAuthenticated {
                AuthWallView()
            } else {
                MainTabView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: supabase.isAuthenticated)
    }
}

/// 会话恢复期的过场：只有一枚呼吸的极光环，避免闪一下登录墙再跳走
struct SplashView: View {
    @State private var pulsing = false

    var body: some View {
        Circle()
            .fill(Theme.aurora)
            .frame(width: 48, height: 48)
            .opacity(pulsing ? 0.35 : 0.85)
            .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: pulsing)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .screenBackground()
            .onAppear { pulsing = true }
            .accessibilityLabel("正在恢复会话")
    }
}

struct MainTabView: View {
    @State private var router = AppRouter()
    @State private var toast = ToastCenter()

    var body: some View {
        @Bindable var router = router
        return TabView(selection: $router.tab) {
            HomeView()
                .tabItem { Label("认识你自己", systemImage: "person.crop.circle") }
                .tag(AppTab.home)

            LabView()
                .tabItem { Label("人生实验室", systemImage: "testtube.2") }
                .tag(AppTab.lab)

            CommunityView()
                .tabItem { Label("万花筒社区", systemImage: "circle.hexagongrid") }
                .tag(AppTab.community)

            MeView()
                .tabItem { Label("我的主页", systemImage: "person.text.rectangle") }
                .tag(AppTab.me)
        }
        .tint(Theme.blue)
        .background(Theme.stage.ignoresSafeArea())
        .environment(toast)
        .environment(router)
        .overlay(ToastHost(message: toast.message))
    }
}

#Preview {
    RootView()
        .environment(SupabaseService())
        .preferredColorScheme(.dark)
}
