import SwiftUI

// MARK: - 每日记录视图（原型 renderDiaryDay）

struct DiaryDayView: View {
    @Bindable var model: DiaryModel
    @Environment(ToastCenter.self) private var toast
    /// 空态「记录今天」
    var onStartRecording: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            DiaryViewHead(eyebrow: "ALL VOICE NOTES", title: "全部日记",
                          subtitle: "2026年7月 · 已记录 \(model.entries.count) 天")
            dateRail
                .padding(.horizontal, -20)
                .padding(.top, 16)

            if let entry = model.selectedEntry {
                dayHero(entry).padding(.top, 10)
                keywordBlock(entry).padding(.top, 14)
                transcriptBlock(entry).padding(.top, 14)
            } else {
                emptyState.padding(.top, 20)
            }

            archive.padding(.top, 18)
        }
    }

    // MARK: 日期滑动轨（.diary-date-rail）

    private var dateRail: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(model.railDates, id: \.date) { item in
                        dateChip(item)
                            .id(item.date)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 2)
            }
            .onAppear { proxy.scrollTo(model.selectedDate, anchor: .center) }
            .onChange(of: model.selectedDate) {
                withAnimation(.easeOut(duration: 0.25)) {
                    proxy.scrollTo(model.selectedDate, anchor: .center)
                }
            }
        }
    }

    private func dateChip(_ item: (date: String, day: Int, week: String, emoji: String?)) -> some View {
        let on = item.date == model.selectedDate
        return Button {
            model.select(item.date)
        } label: {
            VStack(spacing: 0) {
                Text(item.week).font(.system(size: 9.5))
                    .foregroundStyle(on ? Color(hex: 0xEEF3FF) : Theme.faint)
                Text(item.emoji ?? "·").font(.system(size: 19)).padding(.vertical, 5)
                Text("7/\(item.day)").font(.system(size: 10))
                    .foregroundStyle(on ? Color(hex: 0xEEF3FF) : Theme.sub)
            }
            .frame(width: 62)
            .padding(.vertical, 10)
            .background {
                if on {
                    RoundedRectangle(cornerRadius: 17, style: .continuous)
                        .fill(LinearGradient(
                            colors: [Color(hex: 0x3052A4, alpha: 0.75), Color(hex: 0x523787, alpha: 0.78)],
                            startPoint: .topLeading, endPoint: .bottomTrailing))
                        .shadow(color: Color(hex: 0x5E96FF, alpha: 0.5), radius: 10, y: 8)
                } else {
                    RoundedRectangle(cornerRadius: 17, style: .continuous).fill(Theme.card)
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: 17, style: .continuous)
                    .strokeBorder(on ? Color(hex: 0x9DBCFF, alpha: 0.55) : Theme.line, lineWidth: 1)
            )
        }
        .buttonStyle(PressScaleStyle())
        .accessibilityLabel("查看\(item.week)\(item.day)日的日记")
    }

    // MARK: day hero（.diary-day-hero）

    private func dayHero(_ entry: DiaryNote) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("\(entry.label) · VOICE NOTE")
                .font(.system(size: 10)).tracking(1.4).foregroundStyle(Color(hex: 0x9DBCFF))
            Text(entry.title)
                .font(.system(size: 18, weight: .bold)).lineSpacing(6).foregroundStyle(Theme.ink)
                .padding(.top, 7)
            HStack(spacing: 8) {
                Text(entry.emoji).font(.system(size: 20))
                Text(entry.emotion).font(.system(size: 11.5)).foregroundStyle(Theme.sub)
            }
            .padding(.top, 8)
            audioBar(entry).padding(.top, 17)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(19)
        .background {
            ZStack(alignment: .topTrailing) {
                LinearGradient(colors: [Color(hex: 0x171D31), Color(hex: 0x11141F)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                RadialGradient(colors: [Color(hex: 0x6FA5FF, alpha: 0.22), .clear],
                               center: .topTrailing, startRadius: 0, endRadius: 190)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 23, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 23, style: .continuous)
            .strokeBorder(Color(hex: 0x7D9EE8, alpha: 0.24), lineWidth: 1))
    }

    private func audioBar(_ entry: DiaryNote) -> some View {
        HStack(spacing: 11) {
            Button {
                model.isPlaying.toggle()
                toast.show(model.isPlaying ? "正在播放这篇语音日记" : "语音已暂停")
            } label: {
                Text(model.isPlaying ? "Ⅱ" : "▶")
                    .font(.system(size: 11)).foregroundStyle(.white)
                    .frame(width: 32, height: 32)
                    .background(Theme.buttonGradient, in: Circle())
            }
            .buttonStyle(PressScaleStyle())
            .accessibilityLabel(model.isPlaying ? "暂停这篇语音日记" : "播放这篇语音日记")

            staticWave(seed: model.selectedIndex + 1)
                .frame(height: 28)

            Text(entry.duration)
                .font(.system(size: 9.5)).monospacedDigit().foregroundStyle(Theme.faint)
        }
        .padding(.horizontal, 12).padding(.vertical, 11)
        .background(Color(hex: 0x050812, alpha: 0.48), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).strokeBorder(.white.opacity(0.07), lineWidth: 1))
    }

    /// 静态波形：高度公式对照原型 diaryWaveHTML
    private func staticWave(seed: Int) -> some View {
        Canvas { ctx, size in
            let count = 24
            let gap: CGFloat = 2
            let bw = max(1, (size.width - gap * CGFloat(count - 1)) / CGFloat(count))
            for i in 0..<count {
                let frac = CGFloat(18 + ((i * 17 + seed * 11) % 72)) / 100
                let h = size.height * frac
                let rect = CGRect(x: CGFloat(i) * (bw + gap), y: (size.height - h) / 2, width: bw, height: h)
                ctx.fill(Path(roundedRect: rect, cornerRadius: 2),
                         with: .linearGradient(
                            Gradient(colors: [Color(hex: 0x7CABFF), Color(hex: 0x8F7BFF)]),
                            startPoint: CGPoint(x: rect.midX, y: rect.minY),
                            endPoint: CGPoint(x: rect.midX, y: rect.maxY)))
            }
        }
        .opacity(0.66)
        .frame(maxWidth: .infinity)
    }

    // MARK: 关键词 / 转写

    private func keywordBlock(_ entry: DiaryNote) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            DiaryBlockHead(title: "每日关键词", note: "由语音内容自动提取")
            DiaryKeywordFlow(items: entry.keywords.map { "# \($0)" })
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(17)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }

    private func transcriptBlock(_ entry: DiaryNote) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            DiaryBlockHead(title: "详细语音内容", note: "\(entry.duration) · 已转写")
            ForEach(entry.transcript, id: \.self) { paragraph in
                Text(paragraph)
                    .font(.system(size: 12.5)).lineSpacing(9).foregroundStyle(Color(hex: 0xC8CEDA))
                    .padding(.top, 11)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(17)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }

    // MARK: 空态（.diary-empty）

    private var emptyState: some View {
        VStack(spacing: 0) {
            Text("◌").font(.system(size: 32)).foregroundStyle(Theme.sub)
            Text("今天还没有留下声音")
                .font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink).padding(.top, 12)
            Text("不需要组织好语言，从此刻最真实的感受开始就好。")
                .font(.system(size: 11.5)).lineSpacing(5).foregroundStyle(Theme.sub)
                .multilineTextAlignment(.center).padding(.top, 7)
            Button("记录今天", action: onStartRecording)
                .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                .padding(.horizontal, 20).padding(.vertical, 11)
                .background(Theme.buttonGradient, in: Capsule())
                .buttonStyle(PressScaleStyle())
                .padding(.top, 18)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 22).padding(.vertical, 38)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 23, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 23, style: .continuous)
                .strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.28), style: StrokeStyle(lineWidth: 1, dash: [5, 5]))
        )
    }

    // MARK: 归档（.diary-archive）

    private var archive: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .bottom, spacing: 12) {
                Text("全部日期记录").font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.ink)
                Spacer()
                Text("\(model.entries.count) 篇 · 按时间倒序").font(.system(size: 9.5)).foregroundStyle(Theme.faint)
            }
            VStack(spacing: 8) {
                ForEach(model.entries.sorted { $0.date > $1.date }) { entry in
                    archiveItem(entry)
                }
            }
        }
    }

    private func archiveItem(_ entry: DiaryNote) -> some View {
        let on = entry.date == model.selectedDate
        return Button {
            model.select(entry.date)
        } label: {
            HStack(spacing: 11) {
                VStack(spacing: 2) {
                    Text("\(entry.dayNumber)").font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.ink)
                    Text("7月").font(.system(size: 8.5)).foregroundStyle(Theme.faint)
                }
                .frame(width: 42)
                VStack(alignment: .leading, spacing: 5) {
                    Text(entry.title)
                        .font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    Text("\(entry.emoji) \(entry.keywords.map { "#\($0)" }.joined(separator: " · "))")
                        .font(.system(size: 9.5)).foregroundStyle(Theme.faint)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text("›").font(.system(size: 16)).foregroundStyle(Color(hex: 0x70809E))
            }
            .padding(.horizontal, 12).padding(.vertical, 13)
            .background(on ? Color(hex: 0x5E96FF, alpha: 0.08) : Theme.card,
                        in: RoundedRectangle(cornerRadius: 17, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 17, style: .continuous)
                    .strokeBorder(on ? Color(hex: 0x6FA5FF, alpha: 0.32) : Theme.line, lineWidth: 1)
            )
        }
        .buttonStyle(PressScaleStyle())
    }
}
