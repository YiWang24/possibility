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
}
