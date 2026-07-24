import SwiftUI

// MARK: - 此刻的处境扫描（原型 #contextPage · openContextScan / saveContextScan）
//
// 4 组单选：精力 / 现实压力 / 支持 / 选择空间。全部作答后可保存，
// 生成两条「观察」写入本地（状态不是人格），并 toast 提示。

struct ContextScanView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(ToastCenter.self) private var toast

    @State private var answers: [String: String] = [:]

    static let questions: [(key: String, num: String, title: String, options: [String])] = [
        ("energy", "01 · 精力", "除去必须完成的事情，你还有多少精力留给自己？", ["几乎没有", "偶尔有", "还算充足"]),
        ("pressure", "02 · 现实压力", "最近最不能忽略的压力来自哪里？", ["收入与支出", "工作环境", "家庭责任", "暂时没有"]),
        ("support", "03 · 支持", "遇到问题时，你现实中有人可以商量或搭把手吗？", ["很难找到", "有一两个人", "支持比较充分"]),
        ("choice", "04 · 选择空间", "你现在更接近“我不想改变”，还是“我暂时承担不起改变”？", ["不想改变", "想，但承担不起", "还分不清"]),
    ]

    struct Observation: Codable {
        var nowTitle: String
        var nowText: String
        var worldTitle: String
        var worldText: String
        var answers: [String: String]
        var savedAt: Date
    }
    static let storeKey = "kaleido_context_scan_v1"

    private var canSave: Bool { answers.count == Self.questions.count }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    intro
                    ForEach(Self.questions, id: \.key) { q in
                        questionCard(q)
                    }
                    Button("更新我的动态数字人") { save() }
                        .font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 15)
                        .background(Theme.buttonGradient, in: Capsule())
                        .buttonStyle(PressScaleStyle())
                        .disabled(!canSave)
                        .opacity(canSave ? 1 : 0.4)
                        .padding(.top, 8).padding(.bottom, 30)
                }
                .padding(.horizontal, 22).padding(.top, 16)
            }
            .scrollIndicators(.hidden)
        }
        .background(Theme.paper.ignoresSafeArea())
        .onAppear(perform: restore)
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
                Text("此刻的处境").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink)
                Text("状态、条件与支持 · 都可以修改").font(.system(size: 10.5)).foregroundStyle(Theme.faint)
            }
            Spacer()
        }
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 12)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.line).frame(height: 1) }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("CONTEXT, NOT CHARACTER")
                .font(.system(size: 9.5, weight: .semibold)).tracking(2.4)
                .foregroundStyle(Color(hex: 0x8EE7C8))
            Text("先不急着解释你是谁，\n看看最近发生了什么。")
                .font(.system(size: 21, weight: .bold)).lineSpacing(6).foregroundStyle(Theme.ink)
            Text("这些答案只描述当下，不会被写成永久人格。数字人会把它们与稳定倾向分开保存。")
                .font(.system(size: 12.5)).lineSpacing(5).foregroundStyle(Theme.sub)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background {
            ZStack(alignment: .topTrailing) {
                LinearGradient(colors: [Color(hex: 0x11241F), Color(hex: 0x122031), Color(hex: 0x0E1420)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                RadialGradient(colors: [Color(hex: 0x3ED9A4, alpha: 0.2), .clear],
                               center: .topTrailing, startRadius: 0, endRadius: 170)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Color(hex: 0x3ED9A4, alpha: 0.24), lineWidth: 1))
    }

    private func questionCard(_ q: (key: String, num: String, title: String, options: [String])) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            Text(q.num).font(.system(size: 10, weight: .semibold)).tracking(1.6).foregroundStyle(Theme.faint)
            Text(q.title).font(.system(size: 14.5, weight: .semibold)).lineSpacing(4).foregroundStyle(Theme.ink)
            FlowLayout(spacing: 8) {
                ForEach(q.options, id: \.self) { option in
                    let on = answers[q.key] == option
                    Button {
                        answers[q.key] = option
                    } label: {
                        Text(option)
                            .font(.system(size: 12.5, weight: on ? .medium : .regular))
                            .foregroundStyle(on ? .white : Theme.sub)
                            .padding(.horizontal, 15).padding(.vertical, 9)
                            .background(on ? AnyShapeStyle(Theme.buttonGradient) : AnyShapeStyle(Theme.raised), in: Capsule())
                            .overlay(Capsule().strokeBorder(on ? Color(hex: 0x6FA5FF, alpha: 0.7) : Theme.line, lineWidth: 1))
                    }
                    .buttonStyle(PressScaleStyle())
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }

    // MARK: 保存（原型 saveContextScan 的观察生成逻辑）

    private func restore() {
        guard let data = UserDefaults.standard.data(forKey: Self.storeKey),
              let saved = try? JSONDecoder().decode(Observation.self, from: data) else { return }
        answers = saved.answers
    }

    private func save() {
        let energy = answers["energy"] ?? "", pressure = answers["pressure"] ?? ""
        let support = answers["support"] ?? "", choice = answers["choice"] ?? ""
        let lowEnergy = energy == "几乎没有" || energy == "偶尔有"
        let constrained = choice == "想，但承担不起"
        let obs = Observation(
            nowTitle: lowEnergy ? "不是缺乏动力，而是留给自己的精力正在变少" : "你目前仍保有一些探索和恢复的余量",
            nowText: "你报告的当前精力是“\(energy)”，主要现实压力来自“\(pressure)”，支持状态是“\(support)”。这些只描述最近，不会被写成永久人格。",
            worldTitle: constrained ? "你想改变，但目前承担改变的空间有限" : "你对改变的态度，需要和当前条件一起理解",
            worldText: constrained
                ? "这次迟疑更接近现实承受力，而不是意愿不足。当前最不能忽略的是“\(pressure)”。"
                : "你选择了“\(choice)”。数字人会继续区分这是稳定倾向、近期状态，还是环境造成的反应。",
            answers: answers,
            savedAt: Date())
        if let data = try? JSONEncoder().encode(obs) {
            UserDefaults.standard.set(data, forKey: Self.storeKey)
        }
        toast.show("已更新数字人 · 状态没有被写成人格")
        dismiss()
    }
}

#Preview {
    ContextScanView()
        .environment(ToastCenter())
        .preferredColorScheme(.dark)
}
