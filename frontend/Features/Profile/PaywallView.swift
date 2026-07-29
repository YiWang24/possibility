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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if succeeded { successView } else { form }
            }
            .padding(.horizontal, 22).padding(.top, 12).padding(.bottom, 34)
        }
        .scrollIndicators(.hidden)
        .authGate(authGate)
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
        authGate.require(supabase) { confirmPay() }
    }

    private func confirmPay() {
        processing = true
        Task {
            if case .unlock = checkout {
                await model.confirmUnlock(supabase: supabase)
            } else {
                try? await Task.sleep(for: .milliseconds(600))   // demo：模拟下单
            }
            processing = false
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { succeeded = true }
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
    private var priceText: String {
        switch checkout {
        case .unlock: NSDecimalNumber(decimal: AppConfig.Price.unlockProfile).stringValue
        case .service(let s): NSDecimalNumber(decimal: s.price).stringValue
        }
    }
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
