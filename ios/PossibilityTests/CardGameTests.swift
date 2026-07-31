import XCTest
@testable import Possibility

@MainActor
final class CardGameTests: XCTestCase {
    private var store: UserDefaults!
    private var suiteName: String!

    override func setUp() {
        super.setUp()
        suiteName = "CardGameTests.\(UUID().uuidString)"
        store = UserDefaults(suiteName: suiteName)
        store.removePersistentDomain(forName: suiteName)
    }

    override func tearDown() {
        store.removePersistentDomain(forName: suiteName)
        store = nil
        suiteName = nil
        super.tearDown()
    }

    func testRelationshipDecksAreIndependentAndValid() {
        let kinds: [CardGameKind] = [.marriage, .family, .social]
        let configs = kinds.map(CardGameData.config)

        for config in configs {
            XCTAssertEqual(config.cards.count, 18, "\(config.title) 应提供 18 张可选底牌")
            XCTAssertEqual(Set(config.cards.map(\.id)).count, config.cards.count, "\(config.title) 卡牌 id 必须唯一")
            XCTAssertEqual(Set(config.cards.map(\.name)).count, config.cards.count, "\(config.title) 卡牌名称必须唯一")
            XCTAssertGreaterThanOrEqual(config.scenarioRounds.flatMap { $0 }.count, 12)
            XCTAssertEqual(config.severityMeta.count, 4)
            XCTAssertFalse(config.introTitle.isEmpty)
            XCTAssertFalse(config.introCopy.isEmpty)
            XCTAssertEqual(config.rules.count, 3)
        }

        for left in configs.indices {
            for right in configs.indices where left < right {
                XCTAssertNotEqual(
                    Set(configs[left].cards.map(\.name)),
                    Set(configs[right].cards.map(\.name)),
                    "关系专题不能只换标题或复用同一套牌")
                XCTAssertNotEqual(
                    Set(configs[left].scenarioRounds.flatMap { $0 }.map(\.title)),
                    Set(configs[right].scenarioRounds.flatMap { $0 }.map(\.title)),
                    "关系专题必须有独立情境池")
            }
        }

        XCTAssertEqual(CardGameKind.marriage.targetDimension, .love)
        XCTAssertEqual(CardGameKind.family.targetDimension, .family)
        XCTAssertEqual(CardGameKind.social.targetDimension, .social)
    }

    func testEveryGameReachesResultWithoutRegressingLifeCards() {
        for kind in CardGameKind.allCases {
            let engine = CardGameEngine(kind: kind, store: store)
            engine.start()
            for card in engine.config.cards.prefix(9) {
                XCTAssertNil(engine.toggleSelect(card.id))
            }
            engine.confirmSelection()

            for _ in 0..<3 {
                guard let scenario = engine.scenarioOptions.first else {
                    return XCTFail("\(kind.rawValue) 没有可抽取情境")
                }
                engine.draw(scenario)
                engine.beginTrade()
                for card in engine.heldCards.prefix(2) {
                    XCTAssertNil(engine.toggleTrade(card.id))
                }
                engine.confirmTrade()
            }

            XCTAssertEqual(engine.phase, .result)
            XCTAssertEqual(engine.held.count, 3)
            XCTAssertEqual(engine.traded.count, 3)
            CardGameLocalRecord.clearProgress(kind, store: store)
        }
    }

    func testProgressRestoresPerTopicIncludingPressureAndChoices() {
        for kind in CardGameKind.allCases {
            let original = CardGameEngine(kind: kind, store: store)
            original.start()
            original.config.cards.prefix(9).forEach { _ = original.toggleSelect($0.id) }
            original.confirmSelection()
            let scenario = try! XCTUnwrap(original.scenarioOptions.first)
            original.draw(scenario)
            original.accept()

            let restored = CardGameEngine(kind: kind, store: store)
            XCTAssertEqual(restored.phase, .draw)
            XCTAssertEqual(restored.selected, original.selected)
            XCTAssertEqual(restored.held, original.held)
            XCTAssertEqual(restored.round, 1)
            XCTAssertEqual(restored.pressure, 2)
            XCTAssertEqual(restored.accepted.count, 1)
            XCTAssertTrue(CardGameLocalRecord.hasProgress(kind, store: store))
        }
    }

    func testPressureCapBlocksAcceptUntilCardsAreTraded() throws {
        let engine = CardGameEngine(kind: .life, store: store)
        engine.start()
        engine.config.cards.prefix(engine.initialSelectCount).forEach {
            _ = engine.toggleSelect($0.id)
        }
        engine.confirmSelection()
        engine.draw(try XCTUnwrap(engine.scenarioOptions.first))
        engine.pressure = engine.pressureMax

        XCTAssertFalse(engine.canAccept)
        XCTAssertTrue(engine.isForcedTrade)
        let roundBeforeAccept = engine.round
        engine.accept()
        XCTAssertEqual(engine.round, roundBeforeAccept)
        XCTAssertEqual(engine.phase, .decision)

        engine.beginTrade()
        XCTAssertTrue(engine.isForcedTrade)
        engine.heldCards.prefix(engine.discardPerTrade).forEach {
            _ = engine.toggleTrade($0.id)
        }
        engine.confirmTrade()
        XCTAssertEqual(engine.pressure, engine.pressureMax - 1)
        XCTAssertEqual(engine.traded.count, 1)
    }

    func testTradeDraftAndFinalResultRestore() {
        let engine = CardGameEngine(kind: .family, store: store)
        engine.start()
        engine.config.cards.prefix(9).forEach { _ = engine.toggleSelect($0.id) }
        engine.confirmSelection()
        engine.draw(try! XCTUnwrap(engine.scenarioOptions.first))
        engine.beginTrade()
        engine.reasonCannotAccept = "这会越过我的家庭边界"
        engine.reasonAbandon = "这两点以后仍可重新协商"
        engine.heldCards.prefix(2).forEach { _ = engine.toggleTrade($0.id) }
        engine.saveProgress()

        let restoredDraft = CardGameEngine(kind: .family, store: store)
        XCTAssertEqual(restoredDraft.phase, .trade)
        XCTAssertEqual(restoredDraft.tradePick.count, 2)
        XCTAssertEqual(restoredDraft.reasonCannotAccept, "这会越过我的家庭边界")
        XCTAssertEqual(restoredDraft.reasonAbandon, "这两点以后仍可重新协商")

        restoredDraft.confirmTrade()
        for _ in 0..<2 {
            restoredDraft.draw(try! XCTUnwrap(restoredDraft.scenarioOptions.first))
            restoredDraft.beginTrade()
            restoredDraft.heldCards.prefix(2).forEach { _ = restoredDraft.toggleTrade($0.id) }
            restoredDraft.confirmTrade()
        }

        let restoredResult = CardGameEngine(kind: .family, store: store)
        XCTAssertEqual(restoredResult.phase, .result)
        XCTAssertEqual(restoredResult.heldCards.count, 3)
        XCTAssertEqual(restoredResult.traded.count, 3)
    }

    func testCorruptProgressIsDiscardedSafely() {
        store.set(Data("not-json".utf8), forKey: "kaleido_cardgame_progress_social_v1")
        let engine = CardGameEngine(kind: .social, store: store)
        XCTAssertEqual(engine.phase, .intro)
        XCTAssertFalse(CardGameLocalRecord.hasProgress(.social, store: store))
    }

    func testServerRulesDriveCountsWithoutChangingEngineCode() throws {
        let base = CardGameData.config(.life)
        let rules = CardGameCatalog.Rules(
            initialSelectCount: 5,
            finalCardCount: 3,
            discardPerTrade: 2,
            scenarioChoiceCount: 2,
            pressure: .init(
                initial: 1,
                min: 1,
                max: 4,
                acceptDelta: 1,
                tradeDelta: -1
            ),
            scenarioSelection: "nearest_pressure_unseen_v1",
            stageBasis: "trade_count",
            allowRedraw: true
        )
        let config = CardGameConfig(
            kind: .life,
            title: base.title,
            eyebrow: base.eyebrow,
            introTitle: base.introTitle,
            introCopy: base.introCopy,
            rules: base.rules,
            selectTitle: base.selectTitle,
            cardPrefix: base.cardPrefix,
            severityMeta: base.severityMeta,
            pressureLabel: base.pressureLabel,
            cards: Array(base.cards.prefix(6)),
            scenarioRounds: base.scenarioRounds,
            groupCopy: base.groupCopy,
            accent: base.accent,
            glyph: base.glyph,
            dynamicRules: rules
        )
        let engine = CardGameEngine(kind: .life, config: config, store: store)

        engine.start()
        config.cards.prefix(engine.initialSelectCount).forEach {
            _ = engine.toggleSelect($0.id)
        }
        engine.confirmSelection()
        XCTAssertEqual(engine.scenarioOptions.count, 2)
        engine.draw(try XCTUnwrap(engine.scenarioOptions.first))
        engine.beginTrade()
        engine.heldCards.prefix(engine.discardPerTrade).forEach {
            _ = engine.toggleTrade($0.id)
        }
        engine.confirmTrade()

        XCTAssertEqual(engine.phase, .result)
        XCTAssertEqual(engine.held.count, 3)
    }

    func testLegacyLocalStateMigratesOnceIntoCurrentUserScope() {
        CardGameLocalRecord.markDone(.life, store: store)
        CardGameLocalRecord.saveProgress(
            Data("snapshot".utf8),
            for: .life,
            store: store
        )

        XCTAssertTrue(CardGameLocalRecord.isDone(.life, scope: "user-a", store: store))
        XCTAssertNotNil(CardGameLocalRecord.progressData(.life, scope: "user-a", store: store))
        XCTAssertFalse(CardGameLocalRecord.isDone(.life, scope: "user-b", store: store))
        XCTAssertNil(CardGameLocalRecord.progressData(.life, scope: "user-b", store: store))
        XCTAssertFalse(CardGameLocalRecord.isDone(.life, store: store))
        XCTAssertNil(CardGameLocalRecord.progressData(.life, store: store))
    }
}

@MainActor
final class HomeModelTests: XCTestCase {
    func testPortraitCompletionCountsOnlyDisplayedDimensions() {
        let progress = HomeModel.portraitCompletion(for: [
            "personality": "务实聚焦",
            "skill": "结构化表达",
            "like": "产品工作带来的成就感",
            "life": "创造实感",
            "marriage": "稳定陪伴",
            "unknown_remote_field": "不应计入",
        ])

        XCTAssertEqual(progress.completed, 3)
        XCTAssertEqual(progress.total, 6)
        XCTAssertEqual(progress.percent, 50)
    }

    func testPortraitCompletionIgnoresBlankValues() {
        let progress = HomeModel.portraitCompletion(for: [
            "personality": "务实聚焦",
            "skill": "   ",
        ])

        XCTAssertEqual(progress.completed, 1)
        XCTAssertEqual(progress.percent, 17)
    }
}

final class ChatFlowContractTests: XCTestCase {
    func testDoneEventDecodesAIConclusionRecommendation() throws {
        let payload = Data("""
        {
          "conversation_id": "6A60A8BB-C66A-4B7F-AC19-8D5CF86A1CC1",
          "conclusion": {
            "ready": true,
            "next_step": "match",
            "reason": "需要不同路径的现实证据"
          }
        }
        """.utf8)

        let done = try JSONDecoder().decode(ChatStreamDone.self, from: payload)
        XCTAssertEqual(done.conclusion?.ready, true)
        XCTAssertEqual(done.conclusion?.nextStep, .match)
        XCTAssertEqual(done.conclusion?.reason, "需要不同路径的现实证据")
    }
}

final class ProfilePrivacyTests: XCTestCase {
    func testRemoteProfileRestoresExtendedFields() {
        let remote = RemotePublicProfile(
            profileVersion: 2,
            name: "云端昵称",
            hue: 2,
            age: 31,
            city: "多伦多",
            fromRole: "设计师",
            toRole: "AI 产品经理",
            stage: "探索第 2 年",
            result: "完成三个真实项目",
            storyIntro: "新的故事摘要",
            storyFull: "新的完整故事"
        )

        let merged = MyProfile.defaultProfile.merging(remote: remote)
        XCTAssertEqual(merged.hue, 2)
        XCTAssertEqual(merged.meta.age, 31)
        XCTAssertEqual(merged.meta.city, "多伦多")
        XCTAssertEqual(merged.meta.to, "AI 产品经理")
        XCTAssertEqual(merged.meta.intro, "新的故事摘要")
        XCTAssertEqual(merged.meta.full, "新的完整故事")
    }

    func testRemoteProfileCanClearPublishedCollections() {
        let remote = RemotePublicProfile(
            profileVersion: 2,
            tags: [],
            trajectory: [],
            services: [],
            advice: []
        )

        let merged = MyProfile.defaultProfile.merging(remote: remote)
        XCTAssertTrue(merged.tags.isEmpty)
        XCTAssertTrue(merged.traj.isEmpty)
        XCTAssertTrue(merged.services.isEmpty)
        XCTAssertTrue(merged.adviceModules.isEmpty)
    }
}
