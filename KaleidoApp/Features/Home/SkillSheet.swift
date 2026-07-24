import SwiftUI

// MARK: - 「我擅长」补全弹层（原型 #skillSheet）

struct SkillSheet: View {
    var currentSkill: String = ""

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastCenter.self) private var toast
    @State private var selected: Set<String> = ["结构化表达", "共情别人的想法"]

    private let options = ["还不清楚", "结构化表达", "沟通", "共情别人的想法", "文字表达"]
    private let tests: [TestCard] = [
        .init(title: "霍兰德职业测评", subtitle: "你的兴趣更接近哪种职业性格", duration: "约 8 分钟", tint: 0x6FA5FF, base: 0x161A28, wide: false),
        .init(title: "MBTI 测评", subtitle: "你与世界相处的惯用方式", duration: "约 12 分钟", tint: 0xF06ACD, base: 0x1D1424, wide: false),
        .init(title: "选择卡排序", subtitle: "把 30 张价值卡排出顺序，看看你把什么放在最前面", duration: "约 5 分钟", tint: 0xFF7A4D, base: 0x221310, wide: true),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("我擅长").font(.system(size: 19, weight: .bold)).foregroundStyle(Theme.ink)

                question("01", "你是否清楚自己擅长什么？").padding(.top, 20)
                FlowLayout(spacing: 8) {
                    ForEach(options, id: \.self) { opt in
                        ChipToggle(label: opt, isOn: selected.contains(opt)) { toggle(opt) }
                    }
                }
                .padding(.top, 12)

                question("02", "或者，用科学工具测一测").padding(.top, 20)
                testGrid.padding(.top, 12)

                PrimaryButton(title: "保存到我的画像") {
                    toast.show("已保存到你的画像")
                    dismiss()
                }
                .padding(.top, 22)
            }
            .padding(.horizontal, 24).padding(.top, 8).padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
    }

    private func toggle(_ opt: String) {
        if selected.contains(opt) { selected.remove(opt) } else { selected.insert(opt) }
    }

    private func question(_ num: String, _ text: String) -> some View {
        HStack(spacing: 6) {
            Text(num).foregroundStyle(Theme.blue)
            Text(text).foregroundStyle(Theme.ink)
        }
        .font(.system(size: 14, weight: .semibold))
    }

    private var testGrid: some View {
        let columns = [GridItem(.flexible(), spacing: 11), GridItem(.flexible(), spacing: 11)]
        return LazyVGrid(columns: columns, spacing: 11) {
            ForEach(tests) { card in
                testButton(card)
                    .gridCellColumns(card.wide ? 2 : 1)
            }
        }
    }

    private func testButton(_ card: TestCard) -> some View {
        Button { toast.show("\(card.title) · 已开始") } label: {
            VStack(alignment: .leading, spacing: 5) {
                Text(card.title).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink)
                Text(card.subtitle).font(.system(size: 11)).foregroundStyle(Theme.sub)
                    .frame(maxWidth: .infinity, alignment: .leading).lineSpacing(2)
                Text(card.duration).font(.system(size: 10.5)).foregroundStyle(Color(hex: 0x9DBCFF))
                    .padding(.horizontal, 9).padding(.vertical, 3)
                    .background(Color.white.opacity(0.08), in: Capsule())
                    .padding(.top, 6)
            }
            .padding(.horizontal, 14).padding(.vertical, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(testBackground(card))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.white.opacity(0.1), lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(PressScaleStyle())
    }

    private func testBackground(_ card: TestCard) -> some View {
        ZStack(alignment: .topTrailing) {
            Color(hex: card.base)
            RadialGradient(colors: [Color(hex: card.tint, alpha: 0.4), .clear],
                           center: .topTrailing, startRadius: 0, endRadius: 150)
        }
    }

    struct TestCard: Identifiable {
        let id = UUID()
        let title: String
        let subtitle: String
        let duration: String
        let tint: UInt32
        let base: UInt32
        let wide: Bool
    }
}

#Preview {
    Color.black.sheet(isPresented: .constant(true)) {
        SkillSheet()
            .environment(ToastCenter())
            .presentationBackground(Color(hex: 0x10131C))
            .preferredColorScheme(.dark)
    }
}
