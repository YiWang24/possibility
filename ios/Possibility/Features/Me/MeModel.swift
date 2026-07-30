import Foundation
import Observation

// MARK: - 我的主页 Store（原型 myProfile / myPersonaSource / profilePersonaItems）

@Observable
@MainActor
final class MyProfileStore {
    var profile: MyProfile
    var aiPermissions: ProfileAIPermissions
    /// 画像本地缓存被云端补齐时，驱动依赖 UserDefaults 的 computed properties 刷新。
    private var personaRevision = 0
    /// 当前主页 tab：persona / story / advice / service
    var tab = "persona"

    private let store = UserDefaults.standard
    static let storeKey = "kaleido_my_profile_v1"
    static let aiPermissionsStoreKey = "kaleido_ai_permissions_v1"
    private static let pendingProfileSyncKey = "kaleido_my_profile_pending_sync_v1"
    private static let pendingAIPermissionsSyncKey = "kaleido_ai_permissions_pending_sync_v1"

    /// MeView 出现时注入（远端同步用）；init 保持轻量同步，供只读场景直接取本地 profile
    @ObservationIgnored private weak var supabase: SupabaseService?
    /// 远端保存防抖任务（避免连续保存造成请求风暴）
    @ObservationIgnored private var remoteSaveTask: Task<Void, Never>?
    @ObservationIgnored private var remotePermissionsSaveTask: Task<Void, Never>?

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.aiPermissionsStoreKey),
           let saved = try? JSONDecoder().decode(ProfileAIPermissions.self, from: data) {
            aiPermissions = saved
        } else {
            aiPermissions = .empty
        }
        if let data = UserDefaults.standard.data(forKey: Self.storeKey),
           let saved = try? JSONDecoder().decode(MyProfile.self, from: data) {
            var merged = saved
            let migratedLegacyName = merged.name == MyProfile.legacyDefaultName
            if migratedLegacyName {
                merged.name = MyProfile.defaultProfile.name
            }
            // visibility 与默认合并（新 key 补默认）
            for (key, value) in MyProfile.defaultProfile.visibility where merged.visibility[key] == nil {
                merged.visibility[key] = value
            }
            profile = merged
            if migratedLegacyName, let migrated = try? JSONEncoder().encode(merged) {
                UserDefaults.standard.set(migrated, forKey: Self.storeKey)
            }
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

    func saveAIPermissions(_ updated: ProfileAIPermissions) {
        aiPermissions = updated
        persistAIPermissionsLocally(updated)
        store.set(true, forKey: Self.pendingAIPermissionsSyncKey)
        scheduleRemotePermissionsSave(updated)
    }

    /// 隐私中心完成“清空私密画像”后同步清理设备缓存；公开主页资料不受影响。
    func clearPrivateProfileCache() {
        remotePermissionsSaveTask?.cancel()
        for key in ["personality", "skill", "like", "love", "family", "social", "life"] {
            store.removeObject(forKey: "kaleido_dim_" + key)
        }
        store.removeObject(forKey: HomeModel.lifeSignatureKey)
        aiPermissions = .empty
        persistAIPermissionsLocally(.empty)
        store.set(false, forKey: Self.pendingAIPermissionsSyncKey)
        personaRevision += 1
    }

    /// 删除单个维度后清理对应本地镜像，防止下次打开主页短暂显示已删除内容。
    func clearDimensionCache(_ dimension: String) {
        store.removeObject(forKey: "kaleido_dim_" + dimension)
        if dimension == "life" {
            store.removeObject(forKey: HomeModel.lifeSignatureKey)
        }
        personaRevision += 1
    }

    func applyRevokedAIPermissionsLocally() {
        remotePermissionsSaveTask?.cancel()
        aiPermissions = .empty
        persistAIPermissionsLocally(.empty)
        store.set(false, forKey: Self.pendingAIPermissionsSyncKey)
    }

    private func persistLocally(_ updated: MyProfile) {
        if let data = try? JSONEncoder().encode(updated) {
            store.set(data, forKey: Self.storeKey)
        }
    }

    private func persistAIPermissionsLocally(_ updated: ProfileAIPermissions) {
        if let data = try? JSONEncoder().encode(updated) {
            store.set(data, forKey: Self.aiPermissionsStoreKey)
        }
    }

    // MARK: 云端同步（真实优先 + 静默兜底：public_profiles ↔ MyProfile）

    /// 进入 Me 页时调用：先渲染本地缓存（init 已加载），再拉远端合并刷新并回写本地；失败静默用本地。
    func syncFromRemote(using service: SupabaseService) async {
        supabase = service
        // 上次离线/超时留下的本地修改必须先补传，不能被旧云端快照覆盖。
        if store.bool(forKey: Self.pendingProfileSyncKey) {
            do {
                try await service.savePublicProfileRemote(profile)
                store.set(false, forKey: Self.pendingProfileSyncKey)
            } catch {
                return
            }
        }
        if store.bool(forKey: Self.pendingAIPermissionsSyncKey) {
            do {
                try await service.saveAIPermissionsRemote(aiPermissions)
                store.set(false, forKey: Self.pendingAIPermissionsSyncKey)
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
            // v1 云端行没有扩展资料；用合并后的本地缓存一次性回填为 v2。
            if (publicProfile.profileVersion ?? 1) < 2 ||
                publicProfile.name == MyProfile.legacyDefaultName {
                do {
                    try await service.savePublicProfileRemote(merged)
                    store.set(false, forKey: Self.pendingProfileSyncKey)
                } catch {
                    store.set(true, forKey: Self.pendingProfileSyncKey)
                }
            }
        }
        if let remotePermissions = remote.aiPermissions {
            let updated = ProfileAIPermissions(permissions: remotePermissions.permissions)
            if updated != aiPermissions {
                aiPermissions = updated
                persistAIPermissionsLocally(updated)
            }
        } else if !aiPermissions.permissions.isEmpty {
            // 本地已有授权而远端尚无行时补建；空授权无需创建记录。
            do {
                try await service.saveAIPermissionsRemote(aiPermissions)
                store.set(false, forKey: Self.pendingAIPermissionsSyncKey)
            } catch {
                store.set(true, forKey: Self.pendingAIPermissionsSyncKey)
            }
        }
        hydratePersonaCache(from: remote)
    }

    /// 防抖 1.5s 后上云；失败静默（本地已保存，下次成功保存时自然同步）。
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

    private func scheduleRemotePermissionsSave(_ updated: ProfileAIPermissions) {
        guard let service = supabase else { return }
        remotePermissionsSaveTask?.cancel()
        remotePermissionsSaveTask = Task { [weak service] in
            try? await Task.sleep(for: .seconds(1.5))
            guard !Task.isCancelled, let service else { return }
            do {
                try await service.saveAIPermissionsRemote(updated)
                UserDefaults.standard.set(false, forKey: Self.pendingAIPermissionsSyncKey)
            } catch {
                // 保留 pending 标记，下次进入主页自动补传。
            }
        }
    }

    /// 让“我的主页”即使先于首页打开，也能从 get-profile 恢复画像与人生底牌。
    private func hydratePersonaCache(from remote: SupabaseService.RemoteProfile) {
        var changed = false
        let knownKeys = ["personality", "skill", "like", "love", "family", "social"]
        for key in knownKeys {
            guard store.string(forKey: "kaleido_dim_" + key) == nil,
                  let value = remote.dims[key],
                  !value.isEmpty else { continue }
            store.set(value, forKey: "kaleido_dim_" + key)
            changed = true
        }
        if store.data(forKey: HomeModel.lifeSignatureKey) == nil,
           let life = remote.cardGames.first(where: { $0.kind == "life" }),
           !life.finalCards.isEmpty {
            let cards = life.finalCards.prefix(3).map {
                HomeModel.LifeSignatureCard(glyph: $0.glyph ?? "✦", name: $0.name)
            }
            if let data = try? JSONEncoder().encode(cards) {
                store.set(data, forKey: HomeModel.lifeSignatureKey)
                changed = true
            }
        }
        if changed { personaRevision += 1 }
    }

    // MARK: 画像内容（原型 myPersonaSource：读「认识你自己」维度 + 人生底牌）

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
        _ = personaRevision
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

    // MARK: 与「认识你自己」同一份本地存储

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
