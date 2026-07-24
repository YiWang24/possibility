import SwiftUI

// MARK: - 语音日记详情页（原型 diaryPage）
//
// 顶栏 + 固定三 tab（每日记录 / 月度总结 / 年度总结）+ 滚动内容。
// tabs 固定在滚动区外（等效原型 sticky，且避免 pinned header 背景穿透）。

struct DiaryDetailView: View {
    let launch: DiaryLaunch
    let hasRecordedToday: Bool
    /// 空态「记录今天」→ 关闭本页并触发首页录音
    var onStartRecording: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastCenter.self) private var toast
    @Environment(SupabaseService.self) private var supabase
    @State private var model: DiaryModel

    init(launch: DiaryLaunch, hasRecordedToday: Bool, onStartRecording: @escaping () -> Void) {
        self.launch = launch
        self.hasRecordedToday = hasRecordedToday
        self.onStartRecording = onStartRecording
        _model = State(initialValue: DiaryModel(launch: launch, hasRecordedToday: hasRecordedToday))
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            tabs
                .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 4)
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        Color.clear.frame(height: 1).id(topID)
                        switch model.view {
                        case .day:
                            DiaryDayView(model: model, onStartRecording: {
                                dismiss()
                                onStartRecording()
                            })
                        case .month:
                            DiarySummaryView(model: model, isMonth: true)
                        case .year:
                            DiarySummaryView(model: model, isMonth: false)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 40)
                }
                .scrollIndicators(.hidden)
                .onChange(of: model.view) { scrollTop(proxy) }
                .onChange(of: model.selectedDate) { scrollTop(proxy) }
            }
        }
        .background(Theme.paper.ignoresSafeArea())
        .overlay(ToastHost(message: toast.message))
        .task { await model.loadRemote(using: supabase) }
    }

    private let topID = "diary-top"

    private func scrollTop(_ proxy: ScrollViewProxy) {
        withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo(topID, anchor: .top) }
    }

    private var topBar: some View {
        HStack(spacing: 13) {
            BackButton { dismiss() }
            VStack(alignment: .leading, spacing: 2) {
                Text("语音日记").font(.system(size: 16, weight: .semibold)).tracking(0.8)
                Text("听见每天的自己，也看见长期变化").font(.system(size: 11)).foregroundStyle(Theme.faint)
            }
            Spacer()
        }
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 22).padding(.top, 12).padding(.bottom, 10)
        .background(.ultraThinMaterial)
    }

    private var tabs: some View {
        HStack(spacing: 5) {
            ForEach(DiaryModel.ViewKind.allCases, id: \.self) { kind in
                let on = model.view == kind
                Button {
                    withAnimation(.easeOut(duration: 0.2)) { model.view = kind }
                } label: {
                    Text(kind.label)
                        .font(.system(size: 11.5))
                        .foregroundStyle(on ? .white : Theme.faint)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background {
                            if on {
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(LinearGradient(
                                        colors: [Color(hex: 0x3E77F2, alpha: 0.82), Color(hex: 0x664CCE, alpha: 0.82)],
                                        startPoint: .topLeading, endPoint: .bottomTrailing))
                                    .shadow(color: Color(hex: 0x5E96FF, alpha: 0.55), radius: 7, y: 5)
                            }
                        }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }
}

// MARK: - 共用小件

/// 视图头（原型 .diary-view-head）
struct DiaryViewHead: View {
    let eyebrow: String
    let title: String
    let subtitle: String
    var trailing: (() -> AnyView)? = nil

    var body: some View {
        HStack(alignment: .bottom, spacing: 14) {
            VStack(alignment: .leading, spacing: 0) {
                Text(eyebrow).font(.system(size: 9)).tracking(2.6).foregroundStyle(Color(hex: 0x99B8FF))
                Text(title).font(.system(size: 22, weight: .bold)).foregroundStyle(Theme.ink).padding(.top, 5)
                Text(subtitle).font(.system(size: 10.5)).foregroundStyle(Theme.faint).padding(.top, 4)
            }
            Spacer()
            if let trailing { trailing() }
        }
        .padding(.top, 16)
    }
}

/// 卡片块头（原型 .diary-block-head）
struct DiaryBlockHead: View {
    let title: String
    let note: String
    var body: some View {
        HStack(spacing: 12) {
            Text(title).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Theme.ink)
            Spacer()
            Text(note).font(.system(size: 9.5)).foregroundStyle(Theme.faint)
        }
    }
}

/// 关键词胶囊行（原型 .diary-keywords）
struct DiaryKeywordFlow: View {
    let items: [String]
    var body: some View {
        FlowLayout(spacing: 7) {
            ForEach(items, id: \.self) { kw in
                Text(kw)
                    .font(.system(size: 11)).foregroundStyle(Color(hex: 0xBFD2FF))
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Color(hex: 0x5E96FF, alpha: 0.1), in: Capsule())
                    .overlay(Capsule().strokeBorder(Color(hex: 0x5E96FF, alpha: 0.2), lineWidth: 1))
            }
        }
    }
}

#Preview {
    DiaryDetailView(launch: DiaryLaunch(date: nil), hasRecordedToday: false, onStartRecording: {})
        .environment(ToastCenter())
        .environment(SupabaseService())
        .preferredColorScheme(.dark)
}
