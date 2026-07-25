import SwiftUI

@main
struct KaleidoApp: App {
    @State private var supabase = SupabaseService()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(supabase)
                .preferredColorScheme(.dark) // 暗色是贴合内省气质的有意选择
                .task {
                    await supabase.bootstrap() // 冷启动匿名登录
                }
        }
    }
}

// MARK: - 根导航：底部四 Tab（认识自己 / 人生实验室 / 万花筒社区 / 我的主页）

enum AppTab: Hashable {
    case home, lab, community, me
}

struct RootView: View {
    @State private var router = AppRouter()
    @State private var toast = ToastCenter()

    var body: some View {
        @Bindable var router = router
        return TabView(selection: $router.tab) {
            HomeView()
                .tabItem { Label("认识自己", systemImage: "person.crop.circle") }
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
