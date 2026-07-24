import Foundation

/// 全局配置：无硬编码散落 —— URL/Key 走 Info.plist（Config.xcconfig 注入），
/// 价格/阈值集中在此维护（对应技术设计文档 §11.1）。
enum AppConfig {

    // MARK: - Supabase（App 侧可公开，受 RLS 约束）

    /// 从 Info.plist 读取（由 Config.xcconfig 注入），本地缺省用 supabase start 的默认地址。
    static var supabaseURL: URL {
        if let s = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
           let url = URL(string: s), !s.isEmpty {
            return url
        }
        return URL(string: "http://127.0.0.1:54321")!
    }

    static var supabaseAnonKey: String {
        (Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String) ?? ""
    }

    /// Edge Function 直连 URL（SSE 流式不走 functions.invoke）
    static func functionURL(_ name: String) -> URL {
        supabaseURL.appendingPathComponent("functions/v1/\(name)")
    }

    // MARK: - 价格（demo mock 支付；生产切 StoreKit 2）

    enum Price {
        /// 解锁完整经验（付费漏斗主线）
        static let unlockProfile: Decimal = 9.9
        /// 1 对 1 咨询 / 小时
        static let consult: Decimal = 29
        /// 阶段陪跑 / 期
        static let companion: Decimal = 599
    }

    // MARK: - 阈值

    enum Threshold {
        /// 画像初始完成度
        static let portraitInitialPct = 60
        /// 消息输入最大长度
        static let maxMessageLength = 2_000
        /// 首页提问最大长度
        static let maxAskLength = 200
        /// 实验室推演年限范围
        static let simYearRange: ClosedRange<Int> = 1...10
        static let simDefaultYears = 5
    }

    // MARK: - 文案常量

    enum Copy {
        static let appName = "万花筒"
        static let appNameEN = "KALEIDO"
        static let simDisclaimer = "推演不是预言，是一面镜子"
    }
}
