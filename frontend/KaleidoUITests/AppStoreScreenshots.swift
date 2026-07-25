import XCTest

// MARK: - App Store 元数据截图
//
// 只做一件事：打开四个导航 tab，等内容加载完成后各截一张高清图。
// 运行前用 simctl status_bar override 统一状态栏（9:41 / 满电 / 满格）。
// 输出:/tmp/appstore_shots/*.png(模拟器原生分辨率,iPhone 17 Pro Max = 1320×2868,对应 App Store 6.9")。
//
// 注:appstore-03b-community-watch(社区放映模式)不在本测试内 —— 放映舞台的常驻动画
// 让 XCUITest 等待 app idle 超时。改用调试直达参数冷启动后直接截屏:
//   xcrun simctl launch <udid> com.adventurex.kaleido -kaleido-tab community -kaleido-watch 1
//   xcrun simctl io <udid> screenshot assets/appstore/appstore-03b-community-watch.png

final class AppStoreScreenshots: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    private func snap(_ name: String) {
        let shot = XCUIScreen.main.screenshot()
        let dir = URL(fileURLWithPath: "/tmp/appstore_shots")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try? shot.pngRepresentation.write(to: dir.appendingPathComponent("\(name).png"))
        let att = XCTAttachment(screenshot: shot)
        att.name = name
        att.lifetime = .keepAlways
        add(att)
    }

    private func waitFor(_ label: String, timeout: TimeInterval = 10) {
        let p = NSPredicate(format: "label CONTAINS %@", label)
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if app.staticTexts.matching(p).firstMatch.exists { return }
            if app.buttons.matching(p).firstMatch.exists { return }
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        } while Date() < deadline
    }

    /// 给远端数据/动画留出稳定时间再截图
    private func settle(_ seconds: TimeInterval = 2.5) {
        RunLoop.current.run(until: Date().addingTimeInterval(seconds))
    }

    func testAppStoreTabScreenshots() throws {
        // Tab 1 · 认识你自己
        waitFor("我的语音日记")
        settle(3.5)
        snap("appstore-01-home")

        // Tab 2 · 人生实验室
        app.tabBars.buttons["人生实验室"].tap()
        waitFor("当前探索问题")
        settle()
        snap("appstore-02-lab")

        // Tab 3 · 万花筒社区
        app.tabBars.buttons["万花筒社区"].tap()
        waitFor("为你推荐")
        settle(3)
        snap("appstore-03-community")

        // Tab 4 · 我的主页
        app.tabBars.buttons["我的主页"].tap()
        waitFor("动态画像")
        settle()
        snap("appstore-04-me")
    }
}
