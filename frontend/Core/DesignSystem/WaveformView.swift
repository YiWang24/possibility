import SwiftUI

// MARK: - 录音波形（签名动效）
//
// 原型 `.wave i`：一排 lime 色 bar，height 在 22%↔95% 之间跳动（wv 1s），
// 每根错开 animation-delay 形成流动感。reduceMotion 时静置为中间高度。

struct WaveformView: View {
    var barCount: Int = 12
    var color: Color = Theme.lime
    /// 每根相对 1s 周期的相位偏移（对应原型 animation-delay）
    private static let delays: [Double] = [0, 0.12, 0.24, 0.06, 0.30, 0.18, 0.02, 0.26, 0.10, 0.20, 0.05, 0.28]

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            GeometryReader { geo in
                HStack(alignment: .center, spacing: 3) {
                    ForEach(0..<barCount, id: \.self) { i in
                        Capsule()
                            .fill(color)
                            .frame(height: geo.size.height * fraction(t, index: i))
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                .opacity(0.75)
            }
        }
        .frame(height: 26)
        .accessibilityLabel("正在录音")
    }

    /// 第 i 根 bar 的高度占比（0.22..0.95）
    private func fraction(_ t: TimeInterval, index: Int) -> CGFloat {
        guard !reduceMotion else { return 0.4 }
        let delay = Self.delays[index % Self.delays.count]
        // 周期 1s，正弦驱动 22%↔95%
        let phase = ((t - delay) / 1.0) * 2 * .pi
        let unit = (sin(phase) + 1) / 2            // 0..1
        return 0.22 + 0.73 * unit
    }
}

#Preview {
    ZStack {
        Theme.stage.ignoresSafeArea()
        WaveformView()
            .padding(.horizontal, 40)
    }
    .preferredColorScheme(.dark)
}
