import SwiftUI

// MARK: - 探索对话（原型 chatPage · 付费漏斗主线）

struct ChatView: View {
    let launch: ChatLaunch

    @Environment(SupabaseService.self) private var supabase
    @Environment(\.dismiss) private var dismiss
    @State private var model: ChatModel

    init(launch: ChatLaunch) {
        self.launch = launch
        _model = State(initialValue: ChatModel(launch: launch))
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            messagesScroll
            inputBar
        }
        .background(Theme.paper.ignoresSafeArea())
        .task { await model.start(supabase: supabase) }
    }

    // MARK: 顶栏

    private var topBar: some View {
        HStack(spacing: 13) {
            BackButton { dismiss() }
            VStack(alignment: .leading, spacing: 2) {
                Text("探索 · \(launch.topic.rawValue)").font(.system(size: 16, weight: .semibold)).tracking(0.8)
                Text("和你的动态画像一起想清楚").font(.system(size: 11)).foregroundStyle(Theme.faint)
            }
            Spacer()
        }
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 22).padding(.top, 12).padding(.bottom, 12)
        .background(.ultraThinMaterial)
    }

    // MARK: 消息流

    private var messagesScroll: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(model.messages) { msg in
                        bubble(msg).id(msg.id)
                    }
                    if model.isStreaming, model.messages.last?.text.isEmpty == true {
                        thinking
                    }
                    if model.loadingMatch { thinking }
                    if model.showCrossroadsCTA { crossroadsCTA }
                    if model.matchReady { matchSection }
                    Color.clear.frame(height: 8).id(bottomID)
                }
                .padding(.horizontal, 20).padding(.vertical, 12)
            }
            .scrollIndicators(.hidden)
            .onChange(of: model.messages.last?.text) { scrollToBottom(proxy) }
            .onChange(of: model.matchReady) { scrollToBottom(proxy) }
            .onChange(of: model.crossroadsReady) { scrollToBottom(proxy) }
        }
    }

    private let bottomID = "chat-bottom"

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo(bottomID, anchor: .bottom) }
    }

    private func bubble(_ msg: ChatModel.Message) -> some View {
        HStack {
            if msg.role == .user { Spacer(minLength: 40) }
            markdownText(msg.text)
                .font(.system(size: msg.role == .user ? 14.5 : 14))
                .foregroundStyle(msg.role == .user ? .white : Theme.ink)
                .lineSpacing(5)
                .padding(.horizontal, 16).padding(.vertical, 13)
                .background(bubbleBackground(msg.role))
                .clipShape(Self.bubbleShape(isUser: msg.role == .user))
                .overlay {
                    if msg.role == .ai {
                        Self.bubbleShape(isUser: false).strokeBorder(Theme.line, lineWidth: 1)
                    }
                }
                .frame(maxWidth: 300, alignment: msg.role == .user ? .trailing : .leading)
            if msg.role == .ai { Spacer(minLength: 40) }
        }
        .padding(.top, 14)
        .transition(.opacity.combined(with: .move(edge: .bottom)))
    }

    @ViewBuilder
    private func bubbleBackground(_ role: ChatModel.Message.Role) -> some View {
        if role == .user {
            LinearGradient(colors: [Color(hex: 0x3E77F2), Color(hex: 0x2A50D6)], startPoint: .topLeading, endPoint: .bottomTrailing)
        } else {
            Theme.card
        }
    }

    private var thinking: some View {
        HStack(spacing: 10) {
            MiniOrb(size: 18)
            Text("正在想…").font(.system(size: 12)).foregroundStyle(Theme.faint)
        }
        .padding(.top, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: 岔路口 CTA

    private var crossroadsCTA: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let summary = model.crossroadsSummary {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.triangle.branch").font(.system(size: 12))
                    Text("岔路口 · \(summary)").font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(Color(hex: 0x9DBCFF))
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(Color(hex: 0x5E96FF, alpha: 0.12), in: Capsule())
            }
            PrimaryButton(title: "看看走过这条路的人") {
                Task { await model.showMatch(supabase: supabase) }
            }
            HStack(spacing: 8) {
                ForEach(model.followups, id: \.self) { q in
                    Button(q) { model.send(q, supabase: supabase) }
                        .font(.system(size: 12)).foregroundStyle(Theme.sub)
                        .padding(.horizontal, 13).padding(.vertical, 7)
                        .background(Theme.raised, in: Capsule())
                        .overlay(Capsule().strokeBorder(Theme.line, lineWidth: 1))
                        .buttonStyle(PressScaleStyle())
                }
            }
            .padding(.top, 2)
        }
        .padding(.top, 18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .transition(.opacity)
    }

    // MARK: match 结果

    private var matchSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "走过这条路的 3 个人", trailing: "左右滑动 ›")
            TravelerSimRow(travelers: model.matches, reasons: model.matchReasons)
                .padding(.horizontal, -20)
            Text("结局各不相同——有人顺利，有人反复。点开看看他们怎么面对同一个岔路口。")
                .font(.system(size: 11.5)).foregroundStyle(Theme.faint).lineSpacing(3)
                .padding(.top, 2)
        }
        .padding(.top, 20)
        .transition(.opacity)
    }

    // MARK: 输入栏

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField("想到什么，直接问…", text: $model.input)
                .font(.system(size: 13.5)).foregroundStyle(Theme.ink).tint(Theme.blue)
                .padding(.horizontal, 18).padding(.vertical, 12)
                .background(Theme.raised, in: Capsule())
                .overlay(Capsule().strokeBorder(Theme.line, lineWidth: 1))
                .submitLabel(.send)
                .onSubmit { model.send(model.input, supabase: supabase) }
            Button {
                model.send(model.input, supabase: supabase)
            } label: {
                Text("发送").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 22).padding(.vertical, 12)
                    .background(Theme.buttonGradient, in: Capsule())
            }
            .buttonStyle(PressScaleStyle())
            .disabled(model.isStreaming)
        }
        .padding(.horizontal, 18).padding(.top, 12).padding(.bottom, 8)
        .background(.ultraThinMaterial)
    }

    // MARK: markdown 渲染（保留换行 + **加粗**）

    private func markdownText(_ raw: String) -> Text {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        if let attributed = try? AttributedString(markdown: raw, options: options) {
            return Text(attributed)
        }
        return Text(raw)
    }

    /// 对话气泡形状：尖角朝发送方（iOS 16+ UnevenRoundedRectangle）
    static func bubbleShape(isUser: Bool) -> UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: 20,
            bottomLeadingRadius: isUser ? 20 : 6,
            bottomTrailingRadius: isUser ? 6 : 20,
            topTrailingRadius: 20,
            style: .continuous
        )
    }
}

// MARK: - 返回按钮（push 顶栏复用）

struct BackButton: View {
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: "chevron.left").font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .frame(width: 36, height: 36)
                .background(Theme.raised, in: Circle())
                .overlay(Circle().strokeBorder(Theme.line, lineWidth: 1))
        }
        .buttonStyle(PressScaleStyle())
    }
}

// MARK: - 气泡形状（尖角朝发送方）

struct BubbleShape: InsettableShape {
    var isUser: Bool
    var inset: CGFloat = 0

    func path(in rect: CGRect) -> Path {
        let r = rect.insetBy(dx: inset, dy: inset)
        let big: CGFloat = 20, small: CGFloat = 6
        return Path(roundedRect: r, cornerRadii: RectangleCornerRadii(
            topLeading: big, bottomLeading: isUser ? big : small,
            bottomTrailing: isUser ? small : big, topTrailing: big
        ))
    }

    func inset(by amount: CGFloat) -> some InsettableShape {
        var copy = self; copy.inset += amount; return copy
    }
}

#Preview {
    ChatView(launch: ChatLaunch(topic: .career, question: "我是否要从交互设计师转为产品经理？"))
        .environment(SupabaseService())
        .preferredColorScheme(.dark)
}
