import SwiftUI

// MARK: - 卡牌游戏大厅（原型 #cardGameHub）

struct CardGameHubView: View {
    /// 结果保存需要写入首页画像
    let home: HomeModel

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastCenter.self) private var toast
    @Environment(SupabaseService.self) private var supabase
    @State private var activeGame: CardGameKind?

    var body: some View {
        VStack(spacing: 0) {
            topBar
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    hero
                    lifePrimary
                    Text("关系专题 · 各约 3 分钟")
                        .font(.system(size: 11)).tracking(1).foregroundStyle(Theme.faint)
                        .padding(.top, 4)
                    gameOption(.marriage, sub: "婚姻中，你最后会守住什么？")
                    gameOption(.family, sub: "家庭里，你最想守住的三点")
                    gameOption(.social, sub: "人际交往中，你的真实优先级")
                }
                .padding(.horizontal, 22).padding(.top, 16).padding(.bottom, 34)
            }
            .scrollIndicators(.hidden)
        }
        .background(Theme.paper.ignoresSafeArea())
        .fullScreenCover(item: $activeGame) { kind in
            CardGameView(kind: kind, home: home)
                .environment(toast)
                .environment(supabase)
        }
    }

    private var topBar: some View {
        HStack(spacing: 12) {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                    .frame(width: 34, height: 34)
                    .background(Theme.raised, in: Circle())
            }
            .buttonStyle(PressScaleStyle())
            .accessibilityLabel("返回")
            VStack(alignment: .leading, spacing: 2) {
                Text("卡牌探索").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink)
                Text("四套卡牌 · 在取舍中看见优先级").font(.system(size: 10.5)).foregroundStyle(Theme.faint)
            }
            Spacer()
        }
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 12)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("CARD ATELIER · 私密探索")
                .font(.system(size: 9.5, weight: .semibold)).tracking(2.4)
                .foregroundStyle(Color(hex: 0x9DBCFF))
            Text("答案不靠想出来，\n靠一次次取舍显形。")
                .font(.system(size: 21, weight: .bold)).lineSpacing(6).foregroundStyle(Theme.ink)
            Text("每套卡牌都会让你在有限的底牌里做选择。留下的三张，会成为画像的一部分。")
                .font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background {
            ZStack(alignment: .topTrailing) {
                LinearGradient(colors: [Color(hex: 0x141A34), Color(hex: 0x241A3E), Color(hex: 0x10132A)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                RadialGradient(colors: [Color(hex: 0x8F7BFF, alpha: 0.28), .clear],
                               center: .topTrailing, startRadius: 0, endRadius: 190)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Color(hex: 0x8F7BFF, alpha: 0.28), lineWidth: 1))
    }

    // MARK: 人生卡牌主卡（含规则条）

    private var lifePrimary: some View {
        Button {
            activeGame = .life
        } label: {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 14) {
                    miniDeck
                    VStack(alignment: .leading, spacing: 4) {
                        Text("LIFE CARDS · 5–8 分钟").font(.system(size: 9.5, weight: .semibold)).tracking(1.8)
                            .foregroundStyle(Color(hex: 0xB6A8FF))
                        Text("人生卡牌：你最后会留下什么？")
                            .font(.system(size: 15.5, weight: .bold)).foregroundStyle(Theme.ink)
                        Text("从 18 张底牌带走 9 张，在命运加码中留下最后 3 张")
                            .font(.system(size: 11)).foregroundStyle(Theme.sub)
                    }
                    Spacer()
                    Text("›").font(.system(size: 16)).foregroundStyle(Theme.faint)
                }
                HStack(spacing: 8) {
                    rule("01", "选择")
                    rule("02", "加码")
                    rule("03", "交换")
                }
            }
            .padding(16)
            .background {
                ZStack(alignment: .topTrailing) {
                    LinearGradient(colors: [Color(hex: 0x1B1A38), Color(hex: 0x241A45), Color(hex: 0x141329)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                    RadialGradient(colors: [Color(hex: 0x8F7BFF, alpha: 0.3), .clear],
                                   center: .topTrailing, startRadius: 0, endRadius: 150)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color(hex: 0x8F7BFF, alpha: 0.32), lineWidth: 1))
        }
        .buttonStyle(PressScaleStyle())
    }

    private func rule(_ no: String, _ label: String) -> some View {
        HStack(spacing: 6) {
            Text(no).font(.system(size: 9.5, weight: .bold)).foregroundStyle(Color(hex: 0xB6A8FF))
            Text(label).font(.system(size: 10.5)).foregroundStyle(Theme.sub)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 7)
        .background(Color.white.opacity(0.06), in: Capsule())
    }

    private var miniDeck: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 6).fill(Theme.hue(4).gradient).frame(width: 26, height: 36).rotationEffect(.degrees(-10)).offset(x: -4)
            RoundedRectangle(cornerRadius: 6).fill(Theme.hue(1).gradient).frame(width: 26, height: 36).rotationEffect(.degrees(9)).offset(x: 4)
        }
        .frame(width: 44)
    }

    // MARK: 关系卡牌选项

    private func gameOption(_ kind: CardGameKind, sub: String) -> some View {
        let cfg = CardGameData.config(kind)
        return Button {
            activeGame = kind
        } label: {
            HStack(spacing: 13) {
                Text(cfg.glyph).font(.system(size: 17))
                    .foregroundStyle(Color(hex: cfg.accent))
                    .frame(width: 40, height: 40)
                    .background(Color(hex: cfg.accent, alpha: 0.13), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(cfg.title).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.ink)
                    Text(sub).font(.system(size: 11)).foregroundStyle(Theme.sub)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                Text("›").font(.system(size: 15)).foregroundStyle(Theme.faint)
            }
            .padding(.horizontal, 15).padding(.vertical, 14)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color(hex: cfg.accent, alpha: 0.24), lineWidth: 1))
        }
        .buttonStyle(PressScaleStyle())
    }
}

#Preview {
    CardGameHubView(home: HomeModel())
        .environment(ToastCenter())
        .environment(SupabaseService())
        .preferredColorScheme(.dark)
}
