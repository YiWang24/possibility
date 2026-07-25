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

    /// 等待两个标签中先出现的一个（避免为等某一个白白耗满 timeout）；都没出现返回 nil
    private func waitForEither(_ a: String, _ b: String, timeout: TimeInterval) -> String? {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if app.buttons[a].exists || app.staticTexts[a].exists { return a }
            if app.buttons[b].exists || app.staticTexts[b].exists { return b }
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        } while Date() < deadline
        return nil
    }

    /// 首次录音会弹出语音识别 / 麦克风权限系统弹窗（springboard）；点「允许」放行，
    /// 否则弹窗会盖住录音条导致点不到「完成」。授权后同一 sim 后续录音不再弹。
    private func allowPermissionAlerts() {
        let sb = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let allowLabels = ["允许", "好", "允许使用", "确定", "OK", "Allow", "Allow While Using App"]
        let deadline = Date().addingTimeInterval(6)
        repeat {
            let alert = sb.alerts.firstMatch
            if alert.exists {
                for label in allowLabels where alert.buttons[label].exists {
                    alert.buttons[label].tap()
                    break
                }
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.4))
        } while Date() < deadline && sb.alerts.firstMatch.exists
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

    func test00VoiceDiaryResilient() throws {
        assertExists("我的语音日记")

        // 录音 → 完成 → 有限时间内必出「结果」或「重试」，绝不无限卡在转圈
        //（修复「输入完识别不了」：网关偶发挂起时不再无限等待，50s 内必给结论）
        waitTap("◉ 记录今日")
        allowPermissionAlerts()   // 首次录音的语音/麦克风权限弹窗
        assertExists("完成", timeout: 5)
        waitTap("完成")
        let r1 = waitForEither("这次记录里，我听见了", "重试", timeout: 55)
        XCTAssertNotNil(r1, "55s 内既无结果也无重试——语音分析卡死了")
        snap("v01-resolved")

        // 分析失败 → 点「重试」应再次触发分析并再次给出结果/重试
        //（修复「无法重试点击没反应」）
        if r1 == "重试" {
            waitTap("重试")
            let r2 = waitForEither("这次记录里，我听见了", "重试", timeout: 55)
            XCTAssertNotNil(r2, "点「重试」后毫无响应——重试按钮没生效")
            snap("v02-retry-responsive")
        }
    }

    func test01HomeDiaryRecording() throws {
        assertExists("晚上好，老己")
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
        XCTAssertTrue(containing("最不准确的是哪一部分", timeout: 4).exists, "固定纠正追问未出现")
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
        assertExists("晚上好，老己", timeout: 6)
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

        // 短期预设 + 选择卡
        assertExists("7天", timeout: 4)
        assertExists("30天", timeout: 4)
        waitTap("3个月", timeout: 4)
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

// MARK: - 卡牌抽牌扇形命中区域检查
//
// 复现：抽牌页扇形背面牌在真机上点不中。
// 用坐标点击模拟真实手指落点（元素 .tap() 走可访问性中心，不能复现手指位置）。

final class CardGameFanCheck: XCTestCase {

    func testFanCardTapAtVisualPosition() throws {
        let app = XCUIApplication()
        app.launch()

        func waitFind(_ label: String, _ timeout: TimeInterval = 8) -> XCUIElement? {
            let deadline = Date().addingTimeInterval(timeout)
            repeat {
                if app.buttons[label].exists { return app.buttons[label] }
                if app.staticTexts[label].exists { return app.staticTexts[label] }
                RunLoop.current.run(until: Date().addingTimeInterval(0.3))
            } while Date() < deadline
            return nil
        }
        func tapContaining(_ text: String, _ timeout: TimeInterval = 8) {
            let p = NSPredicate(format: "label CONTAINS %@", text)
            let b = app.buttons.matching(p).firstMatch
            XCTAssertTrue(b.waitForExistence(timeout: timeout), "找不到含「\(text)」的按钮")
            b.tap()
        }
        func snap(_ name: String) {
            let dir = URL(fileURLWithPath: "/tmp/kaleido_snaps")
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try? XCUIScreen.main.screenshot().pngRepresentation
                .write(to: dir.appendingPathComponent("\(name).png"))
        }

        // 首页 → 卡牌大厅 → 人生卡牌 intro
        tapContaining("人生卡牌：你最后会留下什么？")
        XCTAssertNotNil(waitFind("有关于你的注解，或许可以在这里通过取舍现形。"), "卡牌大厅未出现")
        tapContaining("从 18 张底牌带走 9 张")
        XCTAssertNotNil(waitFind("开始这一局"), "intro 未出现")
        app.buttons["开始这一局"].tap()

        // 选 9 张（LazyVGrid 懒加载，边点边上滑）
        let cardQuery = app.buttons.matching(NSPredicate(format: "label CONTAINS 'LIFE · '"))
        var rounds = 0
        while rounds < 10, !app.buttons["带着这 9 张牌出发"].exists {
            rounds += 1
            var tappedThisPass = false
            for el in cardQuery.allElementsBoundByIndex
            where el.isHittable && !el.label.contains("✓") {
                el.tap()
                tappedThisPass = true
                if app.buttons["带着这 9 张牌出发"].exists { break }
            }
            if !app.buttons["带着这 9 张牌出发"].exists, !tappedThisPass || rounds % 2 == 0 {
                app.swipeUp()
            }
        }
        XCTAssertTrue(app.buttons["带着这 9 张牌出发"].waitForExistence(timeout: 3), "未能选满 9 张")
        app.buttons["带着这 9 张牌出发"].tap()

        // 抽牌页
        XCTAssertNotNil(waitFind("左右滑动牌弧 · 点击其中一张"), "抽牌页未出现")
        RunLoop.current.run(until: Date().addingTimeInterval(1))
        snap("fan-before")

        // 诊断：5 个牌按钮的可访问性 frame
        for i in 1...5 {
            let b = app.buttons["抽第 \(i) 张牌"]
            print("FANCHECK frame \(i): exists=\(b.exists) frame=\(b.exists ? "\(b.frame)" : "-")")
        }

        // 坐标点击最右侧牌的视觉中心（模拟真实手指落点）：
        // 提示文本上方 16pt 间距 + 214pt 牌弧；右侧牌中心约在文本上方 103pt、右偏 146pt。
        let hint = app.staticTexts["左右滑动牌弧 · 点击其中一张"]
        let base = hint.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0))
        let decision = app.buttons["接受它"]

        base.withOffset(CGVector(dx: 146, dy: -103)).tap()
        let rightHit = decision.waitForExistence(timeout: 2.5)
        print("FANCHECK right-card tap responded=\(rightHit)")
        snap("fan-after-right-tap")

        if !rightHit {
            base.withOffset(CGVector(dx: 0, dy: -141)).tap()
            let centerHit = decision.waitForExistence(timeout: 2.5)
            print("FANCHECK center-card tap responded=\(centerHit)")
            snap("fan-after-center-tap")
            XCTAssertTrue(centerHit, "扇形牌视觉位置点击无响应（右侧与中间均未触发翻牌）")
        }

        // 返回抽牌页（多层全屏页都有「返回」，取当前可点的那个），
        // 滑动牌弧后由可访问性点击最左侧牌，验证滑动与命中区域
        XCTAssertTrue(app.buttons.matching(identifier: "返回").allElementsBoundByIndex
            .last(where: { $0.isHittable })
            .map { $0.tap(); return true } ?? false, "找不到可点的「返回」")
        XCTAssertNotNil(waitFind("左右滑动牌弧 · 点击其中一张"), "返回抽牌页失败")
        base.withOffset(CGVector(dx: 100, dy: -123))
            .press(forDuration: 0.05,
                   thenDragTo: base.withOffset(CGVector(dx: -60, dy: -123)),
                   withVelocity: .default, thenHoldForDuration: 0.1)
        RunLoop.current.run(until: Date().addingTimeInterval(0.8))
        snap("fan-after-swipe")
        let leftCard = app.buttons["抽第 1 张牌"]
        XCTAssertTrue(leftCard.waitForExistence(timeout: 3), "最左侧牌不存在")
        leftCard.tap()
        XCTAssertTrue(decision.waitForExistence(timeout: 2.5), "滑动后点击最左侧牌无响应")
        print("FANCHECK left-card tap after swipe responded=true")
        snap("fan-after-left-tap")
    }
}
