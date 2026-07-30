import SwiftUI

// MARK: - 测评结果页（原型 #assessmentResultPage · renderHollandResult / renderDemoAssessmentResult）

struct AssessmentResultView: View {
    let model: AssessmentModel
    var onSave: () -> Void
    var onBack: () -> Void

    @State private var barsAppeared = false

    private var cfg: AssessmentConfig { model.config }
    private var isHolland: Bool { cfg.kind == .holland }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    hero
                    bars
                    if cfg.kind == .bigfive { facetSummary }
                    insight
                    Text(methodNote)
                        .font(.system(size: 10.5)).lineSpacing(4).foregroundStyle(Theme.faint)
                    Button(cfg.saveLabel, action: onSave)
                        .font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 15)
                        .background(Theme.buttonGradient, in: Capsule())
                        .shadow(color: Color(hex: 0x4F7DFF, alpha: 0.5), radius: 12, y: 6)
                        .buttonStyle(PressScaleStyle())
                        .padding(.bottom, 26)
                }
                .padding(.horizontal, 22).padding(.top, 18)
            }
            .scrollIndicators(.hidden)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8).delay(0.15)) { barsAppeared = true }
        }
    }

    private var topBar: some View {
        HStack(spacing: 12) {
            Button(action: onBack) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                    .frame(width: 34, height: 34)
                    .background(Theme.raised, in: Circle())
            }
            .buttonStyle(PressScaleStyle())
            .accessibilityLabel("返回画像工作室")
            VStack(alignment: .leading, spacing: 2) {
                Text(cfg.resultTitle).font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink)
                Text(cfg.resultSub).font(.system(size: 10.5)).foregroundStyle(Theme.faint)
            }
            Spacer()
        }
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 12)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    // MARK: 结果 hero

    private var heroCode: String {
        if isHolland { return model.result?.displayCode ?? model.result?.code ?? "" }
        return model.resultTags.prefix(2).joined(separator: " · ")
    }

    private var heroTitle: String {
        if isHolland {
            let top = model.result?.selected ?? Array(model.result?.ordered.prefix(3) ?? [])
            let names = top.map { cfg.dim($0).name.replacingOccurrences(of: "型", with: "") }.joined(separator: "、")
            return "你的兴趣更靠近\n\(names)"
        }
        return "这不是给你定型，\n而是留下当前可修正的证据。"
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(isHolland ? "YOUR INTEREST CONSTELLATION" : "YOUR CURRENT PROFILE SIGNAL")
                .font(.system(size: 9.5, weight: .semibold)).tracking(2.4)
                .foregroundStyle(Color(hex: 0xC9D8FF, alpha: 0.85))
            Text(heroCode)
                .font(.system(size: heroCode.count > 5 ? 24 : 30, weight: .heavy)).tracking(1.5)
                .foregroundStyle(Theme.aurora)
            Text(heroTitle)
                .font(.system(size: 19, weight: .bold)).lineSpacing(6).foregroundStyle(Theme.ink)
            Text(model.resultNarrative)
                .font(.system(size: 12.5)).lineSpacing(5).foregroundStyle(Theme.sub)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background {
            ZStack(alignment: .topTrailing) {
                LinearGradient(colors: [Color(hex: 0x141A34), Color(hex: 0x1B2148), Color(hex: 0x10132A)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                RadialGradient(colors: [Color(hex: 0x6FA5FF, alpha: 0.3), .clear],
                               center: .topTrailing, startRadius: 0, endRadius: 190)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Color(hex: 0x7A9EFF, alpha: 0.26), lineWidth: 1))
    }

    // MARK: 维度条（原型 .riasec-bars，进入时动画展开）

    private var bars: some View {
        VStack(spacing: 11) {
            ForEach(cfg.dims, id: \.key) { dim in
                let score = model.result?.scores[dim.key] ?? 0
                let ratio = isHolland ? Double(score) / Double(AssessmentData.hollandMax) : Double(score) / 100
                HStack(spacing: 11) {
                    Text(isHolland ? dim.key : String(dim.name.prefix(2)))
                        .font(.system(size: 11.5, weight: .bold)).foregroundStyle(Theme.sub)
                        .frame(width: isHolland ? 16 : 30, alignment: .leading)
                    GeometryReader { geo in
                        Capsule().fill(Theme.raised)
                            .overlay(alignment: .leading) {
                                Capsule().fill(Color(hex: dim.color))
                                    .frame(width: max(4, geo.size.width * (barsAppeared ? ratio : 0)))
                            }
                    }
                    .frame(height: 7)
                    Text(isHolland ? "\(score)/\(AssessmentData.hollandMax)" : "\(score)")
                        .font(.system(size: 10.5)).monospacedDigit().foregroundStyle(Theme.faint)
                        .frame(width: 38, alignment: .trailing)
                }
            }
        }
        .padding(16)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }

    // MARK: 大五细分面向

    private var facetSummary: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("更突出的细分面向").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.ink)
            Text("完整版同时计算30个细分面向。这里先展示当前得分较高的6项。")
                .font(.system(size: 11)).lineSpacing(3).foregroundStyle(Theme.faint)
            VStack(spacing: 8) {
                ForEach(model.topFacets, id: \.facet.f) { item in
                    HStack(spacing: 10) {
                        Text(item.facet.name).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.ink)
                            .frame(width: 66, alignment: .leading)
                        Text("\(cfg.dim(item.facet.d).name) · \(item.score)")
                            .font(.system(size: 10.5)).monospacedDigit().foregroundStyle(Theme.faint)
                            .frame(width: 70, alignment: .leading)
                        GeometryReader { geo in
                            Capsule().fill(Theme.raised)
                                .overlay(alignment: .leading) {
                                    Capsule().fill(Theme.aurora)
                                        .frame(width: max(3, geo.size.width * (barsAppeared ? Double(item.score) / 100 : 0)))
                                }
                        }
                        .frame(height: 5)
                    }
                }
            }
        }
        .padding(16)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }

    // MARK: 可写入画像的洞察

    private var insightDesc: String {
        guard let result = model.result else { return "" }
        if isHolland {
            let top = result.selected ?? Array(result.ordered.prefix(3))
            guard top.count >= 2 else { return "" }
            return cfg.dim(top[0]).desc + cfg.dim(top[1]).desc
        }
        let top = Array(result.ordered.prefix(2))
        return top.map { cfg.dim($0).desc }.joined(separator: "；") + "。这些信号可以被后续经历、日记和你的主动修改继续校正。"
    }

    private var insight: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("PROFILE SIGNAL · 可写入画像")
                .font(.system(size: 9.5, weight: .semibold)).tracking(2)
                .foregroundStyle(Color(hex: 0x9DBCFF))
            Text(model.resultTags.joined(separator: " · "))
                .font(.system(size: 15.5, weight: .bold)).foregroundStyle(Theme.ink)
            Text(insightDesc)
                .font(.system(size: 12)).lineSpacing(5).foregroundStyle(Theme.sub)
            FlowLayout(spacing: 7) {
                ForEach(model.resultTags, id: \.self) { tag in
                    Text(tag).font(.system(size: 11.5)).foregroundStyle(Color(hex: 0x9DBCFF))
                        .padding(.horizontal, 11).padding(.vertical, 5)
                        .background(Color(hex: 0x5E96FF, alpha: 0.13), in: Capsule())
                        .overlay(Capsule().strokeBorder(Color(hex: 0x5E96FF, alpha: 0.3), lineWidth: 1))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }

    private var methodNote: String {
        switch cfg.kind {
        case .holland:
            return "兴趣不等于能力、人格或资格。本结果来自O*NET Mini Interest Profiler的中文验证中版本，用于扩展探索，不替你决定职业。"
        case .bigfive:
            return "人格分数描述的是连续倾向，不是固定类型，也不用于临床诊断、招聘筛选或替你做重要决定。"
        default:
            return "本测试为产品 Demo 构念改写版，不等同于对应量表的官方中文版，也不用于临床诊断、招聘筛选或替你做重要决定。"
        }
    }
}
