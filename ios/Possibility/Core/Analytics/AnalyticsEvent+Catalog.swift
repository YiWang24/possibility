import Foundation

// MARK: - 事件清单（契约层 · docs/engineering/埋点方案.md §3 的 Swift 镜像）
//
// 改动纪律：先改 docs/engineering/埋点方案.md，再同步本文件与 supabase/functions/_shared/events.ts。
// 调用点一律用这里的工厂方法，不手写事件名字符串。

/// 付费商品标识（对应 AppConfig.Price）
enum AnalyticsSKU: String, Sendable {
    case unlockProfile = "unlock_profile"
    case consult
    case companion
}

/// 触发登录门控的动作 —— 分布能直接回答「什么动作最值得让用户登录」
enum AuthTrigger: String, Sendable {
    case paywall
    case bountyPost = "bounty_post"
    case bountyRespond = "bounty_respond"
    case profileEdit = "profile_edit"
}

// MARK: - 核心付费漏斗

extension AnalyticsEvent {

    /// - Parameter isAuthenticated: 冷启动时是否已有有效会话。false 即用户落在登录墙上，
    ///   「打开 App → 真正进到主界面」这一段流失只有靠它才看得见。
    static func appOpened(isFirstOpen: Bool, isAuthenticated: Bool) -> Self {
        .init("app_opened", [
            "is_first_open": .bool(isFirstOpen),
            "is_authenticated": .bool(isAuthenticated),
        ])
    }

    static func chatStarted(entryPoint: String) -> Self {
        .init("chat_started", ["entry_point": .string(entryPoint)])
    }

    static func chatTurnCompleted(turnIndex: Int, latencyMs: Int, responseChars: Int) -> Self {
        .init("chat_turn_completed", [
            "turn_index": .int(turnIndex),
            "latency_ms": .int(latencyMs),
            "response_chars": .int(responseChars),
        ])
    }

    static func paywallViewed(sku: AnalyticsSKU, price: Double, context: String) -> Self {
        .init("paywall_viewed", [
            "sku": .string(sku.rawValue),
            "price": .double(price),
            "context": .string(context),
        ])
    }

    static func paywallDismissed(sku: AnalyticsSKU, dwellMs: Int) -> Self {
        .init("paywall_dismissed", [
            "sku": .string(sku.rawValue),
            "dwell_ms": .int(dwellMs),
        ])
    }

    static func purchaseStarted(sku: AnalyticsSKU, price: Double) -> Self {
        .init("purchase_started", [
            "sku": .string(sku.rawValue),
            "price": .double(price),
        ])
    }

    static func purchaseCompleted(sku: AnalyticsSKU, price: Double, currency: String = "CNY") -> Self {
        .init("purchase_completed", [
            "sku": .string(sku.rawValue),
            "price": .double(price),
            "currency": .string(currency),
        ])
    }

    static func purchaseFailed(sku: AnalyticsSKU, reason: String) -> Self {
        .init("purchase_failed", [
            "sku": .string(sku.rawValue),
            "reason": .string(reason),
        ])
    }

    static func experiencesUnlocked(count: Int) -> Self {
        .init("experiences_unlocked", ["count": .int(count)])
    }

    static func experienceExpanded(travelerId: Int, rank: Int) -> Self {
        .init("experience_expanded", [
            "traveler_id": .int(travelerId),
            "rank": .int(rank),
        ])
    }

    static func actionSelected(actionId: String) -> Self {
        .init("action_selected", ["action_id": .string(actionId)])
    }

    static func actionFeedbackSubmitted(sentiment: String) -> Self {
        .init("action_feedback_submitted", ["sentiment": .string(sentiment)])
    }
}

// MARK: - 认证漏斗

extension AnalyticsEvent {

    static func authPrompted(trigger: AuthTrigger) -> Self {
        .init("auth_prompted", ["trigger": .string(trigger.rawValue)])
    }

    static var authAppleStarted: Self { .init("auth_apple_started") }

    /// - Parameter method: "email"（邮箱密码注册/登录）| "apple"
    static func authCompleted(method: String) -> Self {
        .init("auth_completed", ["method": .string(method)])
    }

    static func authAbandoned(trigger: AuthTrigger) -> Self {
        .init("auth_abandoned", ["trigger": .string(trigger.rawValue)])
    }
}

// MARK: - 免费层功能（影响留存）

extension AnalyticsEvent {

    static func labChoicesRequested(topic: String) -> Self {
        .init("lab_choices_requested", ["topic": .string(topic)])
    }

    static func labResultViewed(cardCount: Int) -> Self {
        .init("lab_result_viewed", ["card_count": .int(cardCount)])
    }

    static func simulationRequested(years: Int) -> Self {
        .init("simulation_requested", ["years": .int(years)])
    }

    /// content_chars 是派生值 —— 禁止上报日记正文本身（docs/engineering/埋点方案.md §1）
    static func diaryCreated(inputMethod: String, contentChars: Int) -> Self {
        .init("diary_created", [
            "input_method": .string(inputMethod),
            "content_chars": .int(contentChars),
        ])
    }

    static func diarySummaryViewed(dayCount: Int) -> Self {
        .init("diary_summary_viewed", ["day_count": .int(dayCount)])
    }

    static func assessmentStarted(assessmentId: String) -> Self {
        .init("assessment_started", ["assessment_id": .string(assessmentId)])
    }

    static func assessmentCompleted(assessmentId: String, durationMs: Int) -> Self {
        .init("assessment_completed", [
            "assessment_id": .string(assessmentId),
            "duration_ms": .int(durationMs),
        ])
    }

    static var cardGameStarted: Self { .init("card_game_started") }

    static func cardGameCompleted(roundCount: Int) -> Self {
        .init("card_game_completed", ["round_count": .int(roundCount)])
    }

    static var kaleidoscopeDrawn: Self { .init("kaleidoscope_drawn") }

    static var communityBountyPosted: Self { .init("community_bounty_posted") }

    static func communityBountyResponded(bountyId: Int) -> Self {
        .init("community_bounty_responded", ["bounty_id": .int(bountyId)])
    }
}
