import Foundation
import Observation

// MARK: - 旅人主页视图模型（原型 profilePage · 付费墙 §10）

@Observable
@MainActor
final class ProfileModel {

    enum Tab: String, CaseIterable, Identifiable {
        case story, timeline, advice, service
        var id: String { rawValue }
        var label: String {
            switch self {
            case .story: "她的故事"
            case .timeline: "时间线"
            case .advice: "经验与建议"
            case .service: "可提供服务"
            }
        }
    }

    /// 结账类型
    enum Checkout: Identifiable {
        case unlock                          // ¥9.9 解锁完整经验
        case service(TravelerServiceItem)    // 咨询 / 资料包 / 陪跑
        var id: String {
            switch self {
            case .unlock: "unlock"
            case .service(let s): s.id
            }
        }
    }

    let travelerId: Int
    var traveler: Traveler?
    var detail: TravelerDetail?
    var services: [TravelerServiceItem] = []

    var tab: Tab = .story
    var adviceKind: AdviceKind = .decision
    var unlocked = false
    var checkout: Checkout?

    private(set) var loading = true

    init(travelerId: Int) {
        self.travelerId = travelerId
    }

    // 建议标题（对应原型 ADVICE_TITLES 首选）
    private static let adviceTitles: [AdviceKind: String] = [
        .decision: "转型前，先做一次低成本验证",
        .ability: "把旧能力翻译成新岗位的优势",
        .interview: "让面试官看见真实的行动证据",
    ]

    var adviceTitle: String { Self.adviceTitles[adviceKind] ?? "" }

    var adviceTips: [String] { detail?.advice.tips(for: adviceKind) ?? [] }

    /// 咨询价格入口（paybar 主按钮）
    var consultPrice: Decimal {
        services.first { $0.kind == "consult" }?.price ?? AppConfig.Price.consult
    }

    func load(supabase: SupabaseService) async {
        let pool = supabase.travelers.isEmpty ? DemoData.travelers : supabase.travelers
        traveler = pool.first { $0.id == travelerId } ?? DemoData.travelers.first { $0.id == travelerId }
        unlocked = supabase.isUnlocked(travelerId: travelerId)
        // 先用缓存/兜底数据立即渲染，页面秒开；网络返回后静默刷新（本地无后端时不阻塞）
        detail = supabase.travelerDetails[travelerId] ?? DemoData.details[travelerId]
        services = DemoData.services(for: travelerId)
        loading = false
        async let d = supabase.loadTravelerDetail(id: travelerId)
        async let s = supabase.loadServices(travelerId: travelerId)
        if let fresh = await d { detail = fresh }
        let freshServices = await s
        if !freshServices.isEmpty { services = freshServices }
    }

    /// mock 解锁完整经验（¥9.9）→ 写 unlocks（§10 demo 支付）。
    /// 关闭 sheet 由结账页在成功态展示后触发（清空 checkout）。
    @discardableResult
    func confirmUnlock(supabase: SupabaseService) async -> Bool {
        let ok = await supabase.unlockProfile(travelerId: travelerId)
        if ok {
            unlocked = true
            // 打在写库成功处：此刻付费经验才真的可见（重新进页面读缓存不再重复上报）
            Analytics.shared.track(.experiencesUnlocked(count: unlockedExperienceCount))
        }
        return ok
    }

    /// 解锁后可见的经验条数（三类建议合计）—— 只报条数，正文绝不进属性
    private var unlockedExperienceCount: Int {
        guard let advice = detail?.advice else { return 0 }
        return AdviceKind.allCases.reduce(0) { $0 + advice.tips(for: $1).count }
    }
}
