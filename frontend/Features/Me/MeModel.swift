import Foundation
import Observation

// MARK: - 我的主页 Store（原型 myProfile / myPersonaSource / profilePersonaItems）

@Observable
@MainActor
final class MyProfileStore {
    var profile: MyProfile
    /// 当前主页 tab：persona / story / advice / service
    var tab = "persona"

    private let store = UserDefaults.standard
    static let storeKey = "kaleido_my_profile_v1"

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.storeKey),
           let saved = try? JSONDecoder().decode(MyProfile.self, from: data) {
            var merged = saved
            // visibility 与默认合并（新 key 补默认）
            for (key, value) in MyProfile.defaultProfile.visibility where merged.visibility[key] == nil {
                merged.visibility[key] = value
            }
            profile = merged
        } else {
            profile = MyProfile.defaultProfile
        }
    }

    func save(_ updated: MyProfile) {
        profile = updated
        if let data = try? JSONEncoder().encode(updated) {
            store.set(data, forKey: Self.storeKey)
        }
    }

    // MARK: 画像内容（原型 myPersonaSource：读「认识自己」维度 + 人生底牌）

    struct PersonaItem: Identifiable {
        var id: String { key }
        let key: String
        let label: String
        let value: String
        let glyph: String
        let tint: UInt32
        /// 人生底牌卡（仅 life）
        var cards: [HomeModel.LifeSignatureCard] = []
        var hasResult: Bool {
            !value.isEmpty && !value.contains("尚未") && !value.contains("待探索") && !value.contains("未生成")
        }
    }

    /// 全量画像内容（含未公开项，供「设置展示」列表使用）
    var allPersonaItems: [PersonaItem] {
        let dims = Self.loadDims()
        let lifeCards = Self.loadLifeCards()
        return [
            PersonaItem(key: "personality", label: "人格底色", value: dims["personality"] ?? "尚未填写", glyph: "◎", tint: 0x5968D9),
            PersonaItem(key: "skill", label: "我擅长", value: dims["skill"] ?? "尚未填写", glyph: "✦", tint: 0x5E96FF),
            PersonaItem(key: "like", label: "我喜欢", value: dims["like"] ?? "尚未填写", glyph: "♡", tint: 0xE35CC1),
            PersonaItem(key: "love", label: "我在恋爱关系中在意", value: dims["love"] ?? "尚未填写", glyph: "✿", tint: 0xFF7A4D),
            PersonaItem(key: "family", label: "我在家庭关系中在意", value: dims["family"] ?? "尚未填写", glyph: "⌂", tint: 0x3ED9A4),
            PersonaItem(key: "social", label: "我在人际交往中在意", value: dims["social"] ?? "尚未填写", glyph: "◎", tint: 0x5E96FF),
            PersonaItem(key: "life", label: "我的人生底牌",
                        value: lifeCards.isEmpty ? "尚未生成" : lifeCards.map(\.name).joined(separator: " · "),
                        glyph: "◇", tint: 0x8F7BFF, cards: lifeCards),
        ]
    }

    /// 主页展示的画像内容（visibility 过滤）
    var visibleItems: [PersonaItem] {
        allPersonaItems.filter { profile.visibility[$0.key] ?? false }
    }

    /// 公开画像驱动的数字形象（原型 publicPersonaModel）
    var personaModel: PersonaModel {
        let items = visibleItems
        let values = items.filter { $0.key != "life" }.map(\.value)
        let signature = items.first { $0.key == "life" }?.cards.map(\.name) ?? []
        return PersonaModel.build(values: values, signature: signature)
    }

    // MARK: 与「认识自己」同一份本地存储

    private static func loadDims() -> [String: String] {
        var out: [String: String] = [:]
        for key in ["personality", "skill", "like", "love", "family", "social"] {
            if let v = UserDefaults.standard.string(forKey: "kaleido_dim_" + key), !v.isEmpty {
                out[key] = v
            }
        }
        return out
    }

    private static func loadLifeCards() -> [HomeModel.LifeSignatureCard] {
        guard let data = UserDefaults.standard.data(forKey: HomeModel.lifeSignatureKey),
              let cards = try? JSONDecoder().decode([HomeModel.LifeSignatureCard].self, from: data) else { return [] }
        return Array(cards.prefix(3))
    }
}
