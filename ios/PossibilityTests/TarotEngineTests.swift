import Testing
@testable import Possibility

@Suite("三张牌象征分析")
struct TarotEngineTests {
    @Test("候选区固定为 12 张且不重复")
    func candidateCountAndUniqueness() {
        let candidates = TarotEngine.candidates()
        #expect(candidates.count == 12)
        #expect(Set(candidates.map(\.id)).count == 12)
    }

    @Test("只使用三张牌生成普通对话答案")
    func threeCardReading() {
        let cards = Array(TarotEngine.candidates().prefix(3))
        let reading = TarotEngine.reading(question: "我是否应该创业？", cards: cards)
        #expect(reading.cards.count == 3)
        #expect(reading.answer.contains("先说结论"))
        #expect(reading.answer.contains("不是对未来的保证"))
    }

    @Test("极短问题进入澄清")
    func unclearQuestionDetection() {
        #expect(TarotEngine.isUnclearQuestion("怎么办？"))
        #expect(!TarotEngine.isUnclearQuestion("我是否应该从设计转做产品经理？"))
    }
}
