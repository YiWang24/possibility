import XCTest

// MARK: - KALEIDO 全流程 UI 测试
//
// 覆盖：首页（录音 / 发问 / 画像维度）· 语音日记详情 · 探索对话（验证反馈 / 下一步 / 总结）·
// 人生实验室（预设 / 选择卡 / 推演结果）· 社区（tab / 悬赏 / 万花筒抽取）· 旅人主页（tab / 付费）。
// 每个断点截图到 /tmp/kaleido_snaps 供视觉检查。测试按方法名字典序执行。

final class KaleidoUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    // MARK: 工具

    /// 截图（写盘 + 附件）
    private func snap(_ name: String) {
        let shot = XCUIScreen.main.screenshot()
        let dir = URL(fileURLWithPath: "/tmp/kaleido_snaps")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try? shot.pngRepresentation.write(to: dir.appendingPathComponent("\(name).png"))
        let att = XCTAttachment(screenshot: shot)
        att.name = name
        att.lifetime = .keepAlways
        add(att)
    }

    /// 轮询等待按钮或文本出现（SwiftUI Button 文案可能落在 buttons 或 staticTexts，
    /// 且出现前无法判断归属 —— 必须两边同时轮询）
    private func find(_ label: String, timeout: TimeInterval = 8) -> XCUIElement? {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if app.buttons[label].exists { return app.buttons[label] }
            if app.staticTexts[label].exists { return app.staticTexts[label] }
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        } while Date() < deadline
        return nil
    }

    @discardableResult
    private func waitTap(_ label: String, timeout: TimeInterval = 8, file: StaticString = #filePath, line: UInt = #line) -> Bool {
        guard let el = find(label, timeout: timeout) else {
            XCTFail("找不到「\(label)」", file: file, line: line)
            return false
        }
        el.tap()
        return true
    }

    private func assertExists(_ label: String, timeout: TimeInterval = 8, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(find(label, timeout: timeout) != nil, "「\(label)」未出现", file: file, line: line)
    }

    private func containing(_ text: String, timeout: TimeInterval = 4) -> XCUIElement {
        let p = NSPredicate(format: "label CONTAINS %@", text)
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            let b = app.buttons.matching(p).firstMatch
            if b.exists { return b }
            let s = app.staticTexts.matching(p).firstMatch
            if s.exists { return s }
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        } while Date() < deadline
        return app.buttons.matching(p).firstMatch
    }

    /// 等待验证 chips；若 AI 还在澄清（真实 LLM 多轮），补答一轮再等
    private func waitForChips(file: StaticString = #filePath, line: UInt = #line) {
        if find("嗯，比较接近", timeout: 20) != nil { return }
        let input = app.textFields["想到什么，直接问…"]
        if input.waitForExistence(timeout: 3) {
            input.tap()
            input.typeText("geng pa shiqu jilei\n")   // 回车触发发送，避免与首页「发送」重名
            app.swipeDown()
        }
        XCTAssertTrue(find("嗯，比较接近", timeout: 25) != nil, "「嗯，比较接近」未出现", file: file, line: line)
    }

    // MARK: 01 · 首页：问候 + 语音日记录音 → 分析

    func test01HomeDiaryRecording() throws {
        assertExists("晚上好，屿岸")
        assertExists("我的语音日记")
        assertExists("说出那个\n在心里盘旋的问题", timeout: 3)
        snap("01-home")

        // 录音 → 完成 → 情绪 / 关键词分析（2.5s 超时走兜底）
        waitTap("◉ 记录今日")
        assertExists("完成", timeout: 4)
        snap("02-home-recording")
        waitTap("完成")
        assertExists("这次记录里，我听见了", timeout: 12)
        assertExists("查看详情 ›", timeout: 4)
        snap("03-home-diary-result")

        // 结果卡「查看详情」→ 日记详情页 7/23
        waitTap("查看详情 ›")
        assertExists("语音日记")
        assertExists("我开始相信，不需要今天就把整条路想清楚", timeout: 6)
        snap("04-diary-today-recorded")
    }

    // MARK: 02 · 首页：发问卡（话题切换 / 清空 / 无话题）

    func test02HomeAskBox() throws {
        // 选话题 → 样例问题填入 + 话题胶囊出现
        waitTap("职业")
        assertExists("职业", timeout: 3)
        let field = app.textViews.firstMatch.exists ? app.textViews.firstMatch : app.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 3))
        snap("05-ask-topic-on")

        // 清空按钮出现 → 点击清空
        let clear = app.buttons["清空输入"]
        XCTAssertTrue(clear.waitForExistence(timeout: 3), "清空按钮未出现")
        clear.tap()
        snap("06-ask-cleared")

        // 再点话题取消（无话题模式）
        waitTap("职业", timeout: 3)

        // 手动输入并发送 → 探索对话
        field.tap()
        field.typeText("我是否要从交互设计师转为产品经理？")
        waitTap("发送")
        assertExists("和你的动态画像一起想清楚", timeout: 5)
        snap("07-chat-open")
    }

    // MARK: 03 · 探索对话：验证反馈 → 下一步面板 → 总结页

    func test03ChatFlow() throws {
        waitTap("职业")
        waitTap("发送")

        // AI 回复（流式失败走黄金兜底；真实 LLM 澄清则补答一轮）→ 验证 chips
        waitForChips()
        assertExists("还不太对", timeout: 3)
        snap("08-chat-action-chips")

        // 纠正循环：还不太对 → 追问 → 输入原话 → 复述 → 这次准确了
        waitTap("还不太对")
        let input = app.textFields["想到什么，直接问…"]
        XCTAssertTrue(input.waitForExistence(timeout: 8))
        input.tap()
        // 用 ASCII 文本：中文 IME 候选条会拖垮 a11y 快照评估
        input.typeText("pa fangqi 6 nian design jilei\n")   // 回车触发发送
        app.swipeDown()                                      // 收起键盘
        assertExists("这次准确了", timeout: 15)
        snap("09-chat-correction-loop")

        // 确认 → 结论 → 下一步面板
        waitTap("这次准确了")
        assertExists("把刚才的理解带去哪里？", timeout: 15)
        assertExists("去人生实验室", timeout: 3)
        assertExists("看相似经历", timeout: 3)
        assertExists("分享这次探索", timeout: 3)
        snap("10-chat-next-panel")

        // 完整总结页
        waitTap("先查看完整总结 →")
        assertExists("本次探索总结", timeout: 6)
        assertExists("你真正想解决的", timeout: 3)
        assertExists("下一步的小验证", timeout: 3)
        snap("11-chat-summary")

        // 完成本次探索 → 回到首页 + toast
        waitTap("完成本次探索")
        assertExists("晚上好，屿岸", timeout: 6)
        snap("12-chat-finished")
    }

    // MARK: 04 · 对话「去人生实验室」跨 tab 带题

    func test04ChatToLab() throws {
        waitTap("职业")
        waitTap("发送")
        waitForChips()
        waitTap("嗯，比较接近")
        assertExists("去人生实验室", timeout: 15)
        waitTap("去人生实验室")
        // 应切到实验室 tab 且问题已带入
        assertExists("人生实验室", timeout: 6)
        assertExists("当前探索问题", timeout: 4)
        snap("13-lab-from-chat")
    }

    // MARK: 05 · 语音日记详情页：三 tab / 日期轨 / 归档 / 空态

    func test05DiaryDetail() throws {
        waitTap("我的语音日记")
        assertExists("全部日记", timeout: 6)
        assertExists("导师没有替我做决定，但让我看见真正担心的事", timeout: 4)
        snap("14-diary-day")

        // 今天（未录音，日期轨居中 7/22 时右侧可见）→ 空态
        let today = containing("今天23日")
        if today.exists, today.isHittable {
            today.tap()
            assertExists("今天还没有留下声音", timeout: 4)
            snap("16-diary-empty")

            // 空态「记录今天」→ 回首页开始录音
            waitTap("记录今天")
            assertExists("完成", timeout: 6)   // 首页录音条出现
            snap("19-diary-empty-to-record")
            waitTap("完成")
            // 重新进入日记详情继续测试
            waitTap("我的语音日记", timeout: 10)
            assertExists("全部日记", timeout: 6)
        }

        // 归档列表选择另一天
        let archiveItem = containing("终于把一直拖着的作品集重新打开了")
        if archiveItem.waitForExistence(timeout: 4) {
            archiveItem.tap()
            assertExists("轻松，也有一点期待", timeout: 4)
            snap("15-diary-archive-jump")
        }

        // 月度总结
        waitTap("月度总结")
        assertExists("记录天数", timeout: 4)
        assertExists("本月情绪流动", timeout: 3)
        waitTap("更新总结")
        snap("17-diary-month")

        // 年度总结
        waitTap("年度总结")
        assertExists("这一年的四个章节", timeout: 4)
        assertExists("写给年底的你", timeout: 3)
        snap("18-diary-year")
    }

    // MARK: 06 · 画像维度浮层 + 数字形象

    func test06PortraitDimension() throws {
        app.swipeUp(); app.swipeUp()
        assertExists("我的动态画像", timeout: 4)
        snap("20-portrait")

        // 打开「我擅长」软维度（人格底色是工作室占位，只弹 toast）
        let skillRow = containing("我擅长", timeout: 6)
        XCTAssertTrue(skillRow.waitForExistence(timeout: 4), "找不到「我擅长」维度行")
        skillRow.tap()

        // 浮层：选词 → 保存
        assertExists("保存到我的画像", timeout: 6)
        snap("21-dimension-sheet")
        // 选第一批的两个系统词（DimensionData.skill batch 1）
        waitTap("结构化表达", timeout: 4)
        waitTap("视觉表达", timeout: 4)
        waitTap("保存到我的画像")
        // 回填：维度行显示已选词，数字形象 meta 更新
        assertExists("结构化表达 · 视觉表达", timeout: 6)
        snap("22-dimension-saved")
    }

    // MARK: 07 · 人生实验室：编辑问题 / 预设 / 选择卡 / 推演结果

    func test07Lab() throws {
        app.tabBars.buttons["人生实验室"].tap()
        assertExists("当前探索问题", timeout: 4)
        snap("23-lab")

        // 编辑问题（展开后取消）
        waitTap("更换问题 ›")
        assertExists("取消", timeout: 4)
        waitTap("取消")

        // 预设年限 + 选择卡
        waitTap("3年", timeout: 4)
        waitTap("转 AI 产品")
        snap("24-lab-picked")

        // 推演 → 结果三 tab
        waitTap("开始推演")
        assertExists("最好的结果", timeout: 25)
        snap("25-result-best")
        waitTap("一般情况")
        snap("26-result-likely")
        waitTap("最坏的结果")
        snap("27-result-worst")
        assertExists("可能获得", timeout: 3)
        waitTap("重新选择")
        assertExists("当前探索问题", timeout: 6)
    }

    // MARK: 08 · 社区：tab / 悬赏 / 万花筒抽取 → 旅人主页 → 付费

    func test08CommunityAndProfile() throws {
        app.tabBars.buttons["万花筒社区"].tap()
        assertExists("为你推荐", timeout: 4)
        snap("28-community")

        waitTap("悬赏贴")
        snap("29-community-bounty")
        waitTap("为你推荐")

        // 万花筒抽取
        waitTap("万花筒抽一位旅人")
        assertExists("你想看见哪一面的人生？", timeout: 6)
        snap("30-kal-choose")
        waitTap("和我经历完全相反")
        waitTap("开始转动 · 抽一位旅人")
        assertExists("查看 TA 的主页", timeout: 12)
        snap("31-kal-result")

        // 旅人主页（顶栏标题为旅人姓名，用「真实经历 · 已验证」断言）
        waitTap("查看 TA 的主页")
        assertExists("真实经历 · 已验证", timeout: 8)
        snap("32-profile-story")
        waitTap("时间线")
        snap("33-profile-timeline")
        waitTap("经验与建议")
        snap("34-profile-advice")
        waitTap("可提供服务")
        snap("35-profile-service")

        // 付费漏斗：解锁完整经验（mock）
        let unlock = containing("解锁完整经验")
        XCTAssertTrue(unlock.waitForExistence(timeout: 4))
        unlock.tap()
        let confirm = containing("确认解锁")
        XCTAssertTrue(confirm.waitForExistence(timeout: 6), "未打开付费浮层")
        snap("36-paywall")
        confirm.tap()
        assertExists("已解锁完整经验", timeout: 12)
        snap("37-paywall-success")
        waitTap("好的")
        assertExists("真实经历 · 已验证", timeout: 4)
    }
}
