import Foundation
import Observation

// MARK: - 我的主页 Store

@Observable
@MainActor
final class MyProfileStore {
    var profile: MyProfile
    /// 当前主页 tab：persona / story / advice / service
    var tab = "persona"

    private var profileFacts: [ProfileFact] = []
    private var personaRevision = 0
    private let store = UserDefaults.standard
    // v2 intentionally ignores the prototype's prefilled v1 cache.
    static let storeKey = "kaleido_my_profile_v2"
    private static let pendingProfileSyncKey = "kaleido_my_profile_pending_sync_v2"

    @ObservationIgnored private weak var supabase: SupabaseService?
    @ObservationIgnored private var remoteSaveTask: Task<Void, Never>?

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.storeKey),
           let saved = try? JSONDecoder().decode(MyProfile.self, from: data) {
            profile = saved
        } else {
            profile = MyProfile.defaultProfile
        }
    }

    func save(_ updated: MyProfile) {
        profile = updated
        persistLocally(updated)
        store.set(true, forKey: Self.pendingProfileSyncKey)
        scheduleRemoteSave(updated)
    }

    /// 隐私中心完成清空后同步清理设备上的画像镜像；主页基础资料不受影响。
    func clearProfileCache() {
        for key in ["personality", "skill", "like", "love", "family", "social", "life"] {
            store.removeObject(forKey: "kaleido_dim_" + key)
        }
        store.removeObject(forKey: HomeModel.lifeSignatureKey)
        profileFacts = []
        personaRevision += 1
    }

    func clearDimensionCache(_ dimension: String) {
        store.removeObject(forKey: "kaleido_dim_" + dimension)
        if dimension == "life" {
            store.removeObject(forKey: HomeModel.lifeSignatureKey)
        }
        profileFacts.removeAll { $0.dimension == dimension }
        personaRevision += 1
    }

    private func persistLocally(_ updated: MyProfile) {
        if let data = try? JSONEncoder().encode(updated) {
            store.set(data, forKey: Self.storeKey)
        }
    }

    // MARK: 云端同步（真实数据优先）

    func syncFromRemote(using service: SupabaseService) async {
        supabase = service
        if store.bool(forKey: Self.pendingProfileSyncKey) {
            do {
                try await service.savePublicProfileRemote(profile)
                store.set(false, forKey: Self.pendingProfileSyncKey)
            } catch {
                return
            }
        }

        guard let remote = try? await service.fetchRemoteProfile() else { return }
        if let publicProfile = remote.publicProfile {
            let merged = profile.merging(remote: publicProfile)
            if merged != profile {
                profile = merged
                persistLocally(merged)
            }
        }
        applyFacts(remote.facts)
        hydratePersonaCache(from: remote)
    }

    func refreshFacts(using service: SupabaseService) async {
        guard let remote = try? await service.fetchRemoteProfile(force: true) else { return }
        applyFacts(remote.facts)
        hydratePersonaCache(from: remote)
    }

    private func applyFacts(_ facts: [ProfileFact]) {
        profileFacts = facts
        personaRevision += 1
    }

    private func scheduleRemoteSave(_ updated: MyProfile) {
        guard let service = supabase else { return }
        remoteSaveTask?.cancel()
        remoteSaveTask = Task { [weak service] in
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            guard !Task.isCancelled, let service else { return }
            do {
                try await service.savePublicProfileRemote(updated)
                UserDefaults.standard.set(false, forKey: Self.pendingProfileSyncKey)
            } catch {
                // 保留 pending 标记，下次进入主页自动补传。
            }
        }
    }

    /// 本地画像镜像供首页复用；公开主页自身只读取 profileFacts.visibility。
    private func hydratePersonaCache(from remote: SupabaseService.RemoteProfile) {
        var changed = false
        let knownKeys = ["personality", "skill", "like", "love", "family", "social"]
        let grouped = Dictionary(grouping: remote.facts, by: \.dimension)
        for key in knownKeys {
            let value = (grouped[key] ?? [])
                .map(\.value)
                .filter { !$0.isEmpty }
                .joined(separator: " · ")
            if value.isEmpty {
                store.removeObject(forKey: "kaleido_dim_" + key)
            } else {
                store.set(value, forKey: "kaleido_dim_" + key)
            }
            changed = true
        }
        if let life = remote.cardGames.first(where: { $0.kind == "life" }),
           !life.finalCards.isEmpty {
            let cards = life.finalCards.prefix(3).map {
                HomeModel.LifeSignatureCard(glyph: $0.glyph ?? "✦", name: $0.name)
            }
            if let data = try? JSONEncoder().encode(cards) {
                store.set(data, forKey: HomeModel.lifeSignatureKey)
                changed = true
            }
        } else {
            store.removeObject(forKey: HomeModel.lifeSignatureKey)
        }
        if changed { personaRevision += 1 }
    }

    struct PersonaItem: Identifiable {
        var id: String { key }
        let key: String
        let label: String
        let value: String
        let glyph: String
        let tint: UInt32
        var cards: [HomeModel.LifeSignatureCard] = []
        var hasResult: Bool {
            !value.isEmpty && !value.contains("尚未")
        }
    }

    /// 我的公开主页只展示逐条标记为 public 的事实。
    var allPersonaItems: [PersonaItem] {
        _ = personaRevision
        let publicFacts = profileFacts.filter { $0.visibility == "public" }
        let grouped = Dictionary(grouping: publicFacts, by: \.dimension)
        func value(_ dimension: String) -> String {
            grouped[dimension]?.map(\.value).joined(separator: " · ") ?? "尚未公开"
        }
        let lifeCards = (grouped["life"] ?? []).prefix(3).map {
            HomeModel.LifeSignatureCard(glyph: "◆", name: $0.value)
        }
        return [
            PersonaItem(key: "personality", label: "人格底色", value: value("personality"), glyph: "◎", tint: 0x5968D9),
            PersonaItem(key: "skill", label: "我擅长", value: value("skill"), glyph: "✦", tint: 0x5E96FF),
            PersonaItem(key: "like", label: "我喜欢", value: value("like"), glyph: "♡", tint: 0xE35CC1),
            PersonaItem(key: "love", label: "我在恋爱关系中在意", value: value("love"), glyph: "✿", tint: 0xFF7A4D),
            PersonaItem(key: "family", label: "我在家庭关系中在意", value: value("family"), glyph: "⌂", tint: 0x3ED9A4),
            PersonaItem(key: "social", label: "我在人际交往中在意", value: value("social"), glyph: "◎", tint: 0x5E96FF),
            PersonaItem(key: "life", label: "我的人生底牌", value: value("life"),
                        glyph: "◇", tint: 0x8F7BFF, cards: Array(lifeCards)),
        ]
    }

    var visibleItems: [PersonaItem] {
        allPersonaItems.filter(\.hasResult)
    }

    var personaModel: PersonaModel {
        let items = visibleItems
        let values = items.filter { $0.key != "life" }.map(\.value)
        let signature = items.first { $0.key == "life" }?.cards.map(\.name) ?? []
        return PersonaModel.build(values: values, signature: signature)
    }
}
