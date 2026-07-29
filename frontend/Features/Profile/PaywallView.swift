import SwiftUI
import Foundation

// MARK: - 结账弹层（原型 prof-modal · §10 demo mock 支付）
// 解锁完整经验 ¥9.9 / 咨询 ¥29 / 资料包 / 陪跑 ¥599 —— demo 直接写 unlocks，不接真 IAP。

struct PaywallView: View {
    @Bindable var model: ProfileModel
    let checkout: ProfileModel.Checkout

    @Environment(SupabaseService.self) private var supabase
    @State private var processing = false
    @State private var succeeded = false
    /// 付费解锁是关键动作：游客先登录（AuthGate 就地弹 LoginSheet）
    @State private var authGate = AuthGateCenter()
    /// 弹层出现的时刻 —— 未支付关闭时算 dwell_ms（付费漏斗流失分析）
    @State private var viewedAt: Date?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if succeeded { successView } else { form }
            }
            .padding(.horizontal, 22).padding(.top, 12).padding(.bottom, 34)
        }
        .scrollIndicators(.hidden)
        .authGate(authGate)
        .onAppear { trackViewed() }
        // 关闭路径有三条（× / 下滑 / 成功后「好的」），onDisappear 是唯一都覆盖到的收口
        .onDisappear { trackDismissedIfUnpaid() }
    }

    // MARK: 结账表单

    private var form: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(headTitle).font(.system(size: 18, weight: .semibold)).foregroundStyle(Theme.ink)
                Spacer()
                Button { model.checkout = nil } label: {
                    Image(systemName: "xmark").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.sub)
                        .frame(width: 32, height: 32).background(Theme.raised, in: Circle())
                }
                .buttonStyle(.plain)
            }

            orderCard.padding(.top, 18)

            Text(payNote).font(.system(size: 11)).foregroundStyle(Theme.faint).lineSpacing(5).padding(.top, 13)

            Button(action: pay) {
                Group {
                    if processing {
                        ProgressView().tint(.white)
                    } else {
                        Text(actionTitle).font(.system(size: 14, weight: .semibold))
                    }
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 15)
                .background(Theme.buttonGradient, in: Capsule())
            }
            .buttonStyle(PressScaleStyle())
            .disabled(processing)
            .padding(.top, 20)
        }
    }

    private var orderCard: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(itemTitle).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink)
                Text(itemSub).font(.system(size: 11)).foregroundStyle(Theme.sub)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            Text("¥\(priceText)").font(.system(size: 22, weight: .bold)).foregroundStyle(Theme.ink)
                .fixedSize()
        }
        .padding(16)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }

    // MARK: 成功态

    private var successView: some View {
        VStack(spacing: 0) {
            Image(systemName: "checkmark").font(.system(size: 28, weight: .bold)).foregroundStyle(Theme.teal)
                .frame(width: 62, height: 62).background(Color(hex: 0x3ED9A4, alpha: 0.14), in: Circle())
            Text(successTitle).font(.system(size: 18, weight: .semibold)).foregroundStyle(Theme.ink).padding(.top, 16)
            Text(successSub).font(.system(size: 12)).foregroundStyle(Theme.sub).lineSpacing(5)
                .multilineTextAlignment(.center).padding(.top, 8)
            PrimaryButton(title: "好的") { model.checkout = nil }.padding(.top, 24)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 20)
    }

    // MARK: 动作

    private func pay() {
        // 打在点击处而非支付结果处：游客会先被登录门控拦下，这一步记录的是付费意图
        if let sku = analyticsSKU {
            Analytics.shared.track(.purchaseStarted(sku: sku, price: analyticsPrice))
        }
        authGate.require(supabase, trigger: .paywall) { confirmPay() }
    }

    private func confirmPay() {
        processing = true
        Task {
            if case .unlock = checkout {
                // 只读返回值用于埋点，不改变原有「无论成败都进成功态」的 demo 行为
                let ok = await model.confirmUnlock(supabase: supabase)
                trackPurchaseResult(ok: ok, failureReason: "unlock_write_failed")
            } else {
                try? await Task.sleep(for: .milliseconds(600))   // demo：模拟下单
                trackPurchaseResult(ok: true)
            }
            processing = false
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { succeeded = true }
        }
    }

    // MARK: - 埋点（付费漏斗北极星 · docs/埋点方案.md §3.1）

    /// 本次结账对应的 SKU。资料包（materials）在事件清单里没有登记的 sku，
    /// 宁可不上报也不错报到别的商品上 —— 少一条事件可补，脏数据会污染转化率。
    private var analyticsSKU: AnalyticsSKU? {
        switch checkout {
        case .unlock: .unlockProfile
        case .service(let s):
            switch s.kind {
            case "consult": .consult
            case "companion": .companion
            default: nil
            }
        }
    }

    /// 上报用户实际看到的订单金额（unlock 即 AppConfig.Price.unlockProfile）
    private var analyticsPrice: Double {
        NSDecimalNumber(decimal: priceValue).doubleValue
    }

    /// 付费墙目前只从旅人主页进入；context 记录的是入口界面，商品由 sku 表达
    private let analyticsContext = "profile"

    private func trackViewed() {
        viewedAt = Date()
        guard let sku = analyticsSKU else { return }
        Analytics.shared.track(.paywallViewed(sku: sku, price: analyticsPrice, context: analyticsContext))
    }

    /// 只有「没付款就离开」才算流失；成功态的关闭由 purchase_completed 承接
    private func trackDismissedIfUnpaid() {
        guard !succeeded, let sku = analyticsSKU, let viewedAt else { return }
        let dwellMs = Int(Date().timeIntervalSince(viewedAt) * 1000)
        Analytics.shared.track(.paywallDismissed(sku: sku, dwellMs: dwellMs))
    }

    /// 打在支付真正有结果的回调里，不是点击时
    private func trackPurchaseResult(ok: Bool, failureReason: String = "") {
        guard let sku = analyticsSKU else { return }
        if ok {
            Analytics.shared.track(.purchaseCompleted(sku: sku, price: analyticsPrice))
        } else {
            Analytics.shared.track(.purchaseFailed(sku: sku, reason: failureReason))
        }
    }

    // MARK: 文案

    private var headTitle: String {
        switch checkout {
        case .unlock: "解锁完整经验"
        case .service(let s): s.kind == "consult" ? "预约咨询" : "确认订单"
        }
    }
    private var actionTitle: String {
        switch checkout {
        case .unlock: "确认解锁 · ¥\(priceText)"
        case .service(let s): s.kind == "consult" ? "确认预约 · ¥\(priceText)" : "确认购买 · ¥\(priceText)"
        }
    }
    private var itemTitle: String {
        switch checkout {
        case .unlock: "\(model.traveler?.name ?? "TA") · 完整转型经验"
        case .service(let s): s.title
        }
    }
    private var itemSub: String {
        switch checkout {
        case .unlock: "完整故事 + 全部踩坑建议 + 完整轨迹"
        case .service(let s): s.description
        }
    }
    /// 订单金额单一来源：unlock 取 AppConfig.Price，服务取该服务自己的定价。
    /// 展示与埋点共用它，避免「界面价」和「上报价」两套口径。
    private var priceValue: Decimal {
        switch checkout {
        case .unlock: AppConfig.Price.unlockProfile
        case .service(let s): s.price
        }
    }
    private var priceText: String { NSDecimalNumber(decimal: priceValue).stringValue }
    private let payNote = "演示环境：点击即模拟完成，不产生真实扣款。正式版将通过 App 内购（StoreKit 2）安全支付。"

    private var successTitle: String {
        switch checkout {
        case .unlock: "已解锁完整经验"
        case .service(let s): s.kind == "consult" ? "预约成功" : "购买成功"
        }
    }
    private var successSub: String {
        switch checkout {
        case .unlock: "完整故事、踩坑建议与轨迹已全部展开，回到主页查看。"
        case .service: "TA 会尽快与你确认。可在消息中追问具体细节。"
        }
    }
}
