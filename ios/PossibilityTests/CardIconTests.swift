import SwiftUI
import Testing
@testable import Possibility

@MainActor
struct CardIconTests {

    /// 拼错的 SF Symbol 名不会报错，只会渲染成空白——所以逐个 case 断言字形真实存在。
    @Test("每个语义键都映射到真实存在的 SF Symbol")
    func everySymbolExists() {
        for icon in CardIcon.allCases where icon != .unknown {
            #expect(icon.symbol != CardIcon.unknown.symbol,
                    "\(icon.rawValue) 的字形在当前系统上不存在，已回退到兜底图标")
        }
    }

    @Test("语义键不重复占用同一个字形")
    func symbolsAreDistinct() {
        let symbols = CardIcon.allCases.filter { $0 != .unknown }.map(\.symbol)
        #expect(Set(symbols).count == symbols.count, "存在两个语义键共用同一字形")
    }

    // MARK: 解析

    @Test("服务端给出合法语义键时直接采用")
    func exactKeyWins() {
        // 文案里含「深耕」关键词，但键是 pivot：以服务端的判断为准
        #expect(CardIcon.resolve(key: "pivot", title: "深耕交互", desc: "") == .pivot)
        #expect(CardIcon.resolve(key: " Experiment ", title: "", desc: "") == .experiment)
    }

    @Test("键是 emoji 或空值时按文案关键词兜底")
    func fallsBackToKeywords() {
        #expect(CardIcon.resolve(key: "🪐", title: "转岗体验", desc: "先去隔壁团队试三个月") == .pivot)
        #expect(CardIcon.resolve(key: nil, title: "小步试验", desc: "用业余时间做产品项目") == .experiment)
        #expect(CardIcon.resolve(key: "", title: "深耕交互", desc: "继续把交互做成专家能力") == .deepen)
        #expect(CardIcon.resolve(key: "🎨", title: "混合角色", desc: "寻找交互与产品的混合岗") == .hybrid)
    }

    @Test("关键词命中取最长的那个")
    func longestKeywordWins() {
        // 「换城市」(relocate) 比「换」类短词更具体，不应被更早遍历到的 case 抢走
        #expect(CardIcon.match("换城市重新找工作") == .relocate)
        // 「保留退路」(retreat) 优先于同句里的「稳定」(secure)
        #expect(CardIcon.match("保留退路，同时保障稳定") == .retreat)
    }

    @Test("完全无法归类时落到 unknown，而不是随机挑一个图标")
    func unknownWhenNothingMatches() {
        #expect(CardIcon.resolve(key: "✦", title: "以及其他", desc: "还有别的") == .unknown)
    }

    // MARK: 旧数据兼容

    @Test("旧版持久化的自定义卡（只有 emoji 字段）仍能解码")
    func legacyChoiceDecodes() throws {
        let legacy = #"""
        [{"emoji":"✍️","name":"回学校读书","desc":"先把学位补上再谈转行","isCustom":true}]
        """#
        let choices = try JSONDecoder().decode([LabModel.Choice].self, from: Data(legacy.utf8))

        #expect(choices.count == 1)
        #expect(choices[0].name == "回学校读书")
        #expect(choices[0].isCustom)
        // 老 payload 没有 icon，按文案重新匹配到「学习进修」
        #expect(choices[0].icon == .learn)
    }

    @Test("新版 Choice 编解码往返不丢图标")
    func choiceRoundTrips() throws {
        let original = LabModel.Choice(icon: .hybrid, name: "两边都做", desc: "白天上班晚上做副业",
                                       isCustom: true, color: "#8F7BFF")
        let decoded = try JSONDecoder().decode(LabModel.Choice.self,
                                               from: JSONEncoder().encode(original))
        #expect(decoded == original)
    }

    // MARK: 点缀色吸附

    @Test("LLM 给的任意颜色被吸附到最近的品牌点缀色")
    func accentSnapsToPalette() {
        // 偏蓝的脏色 → Theme.blue；偏青绿 → Theme.teal
        #expect(Theme.cardAccent(near: Color(hex: 0x3A6FD8), index: 0) == Theme.blue)
        #expect(Theme.cardAccent(near: Color(hex: 0x2FBE92), index: 0) == Theme.teal)
    }

    @Test("颜色缺失或接近中性灰时按位次轮转取色")
    func accentRotatesWithoutUsableHue() {
        #expect(Theme.cardAccent(near: nil, index: 0) == Theme.cardAccents[0])
        #expect(Theme.cardAccent(near: nil, index: 6) == Theme.cardAccents[1])
        #expect(Theme.cardAccent(near: Color(hex: 0x8A8A8A), index: 2) == Theme.cardAccents[2])
    }

    @Test("相邻卡片不会拿到同一枚点缀色")
    func adjacentCardsDiffer() {
        let colors = (0 ..< Theme.cardAccents.count).map { Theme.cardAccent(near: nil, index: $0) }
        #expect(Set(colors.map(String.init(describing:))).count == Theme.cardAccents.count)
    }
}
