import SwiftUI
import UIKit

// MARK: - 探索对话（原型 chatPage · 付费漏斗主线）

struct ChatView: View {
    let launch: ChatLaunch

    @Environment(SupabaseService.self) private var supabase
    @Environment(ToastCenter.self) private var toast
    @Environment(AppRouter.self) private var router
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
        .overlay(ToastHost(message: toast.message))
        .onChange(of: model.isStreaming) {
            // 发送后立即让输入框失焦，避免键盘遮住正在生成的回复。
            if model.isStreaming {
                inputFocused = false
            }
        }
        .task { await model.start(supabase: supabase) }
        .task { await model.loadHistory(supabase: supabase) }
        .sheet(isPresented: $model.showHistory) {
            ChatHistorySheet(model: model)
        }
        .sheet(isPresented: $model.showSummary) {
            ChatSummaryView(model: model, onGoLab: goLab, onGoSimilar: goSimilar) {
                // 完成本次探索：关总结 + 关对话
                model.showSummary = false
                dismiss()
                toast.show("本次探索已保存")
            }
        }
    }

    // MARK: 下一步路径（去实验室 / 看相似经历）

    private func goLab() {
        router.pendingLabQuestion = model.displayQuestion
        router.tab = .lab
        model.showSummary = false
        dismiss()
        toast.show("问题已带入人生实验室")
    }

    private func goSimilar() {
        router.tab = .community
        model.showSummary = false
        dismiss()
        toast.show("正在寻找走过这段路的人")
    }

    // MARK: 顶栏

    private var topBar: some View {
        HStack(spacing: 13) {
            BackButton { dismiss() }
            VStack(alignment: .leading, spacing: 2) {
                Text(model.displayTopic.map { "探索 · \($0)" } ?? "探索问题").font(.system(size: 16, weight: .semibold)).tracking(0.8)
                Text("和你的动态画像一起想清楚").font(.system(size: 11)).foregroundStyle(Theme.faint)
            }
            Spacer()
            if !model.historyEntries.isEmpty {
                Button {
                    inputFocused = false
                    model.showHistory = true
                } label: {
                    Image(systemName: "clock.arrow.circlepath").font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .frame(width: 36, height: 36)
                        .background(Theme.raised, in: Circle())
                        .overlay(Circle().strokeBorder(Theme.line, lineWidth: 1))
                }
                .buttonStyle(PressScaleStyle())
                .accessibilityLabel("历史探索")
            }
        }
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 22).padding(.top, 12).padding(.bottom, 12)
        .background(.ultraThinMaterial)
        .simultaneousGesture(TapGesture().onEnded { inputFocused = false })
    }

    // MARK: 消息流

    private var messagesScroll: some View {
        ScrollViewReader { proxy in
            ScrollView {
                // 注意用 VStack 而非 LazyVStack：对话消息量小，而 Lazy 布局缓存在
                // 键盘 inset 变化 + 逐帧滚动时会陷入无限重排（主线程卡死 30s+，
                // 见 XCUITest test03 采样栈 LazySubviewPlacements）。
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(model.messages) { msg in
                        // 流开始时模型会先插入一条空 AI 消息作为 token 容器。
                        // 在首个 token 到达前只显示「正在想」，不要渲染空气泡。
                        if !msg.text.isEmpty {
                            bubble(msg).id(msg.id)
                        }
                    }
                    if model.isStreaming, model.messages.last?.text.isEmpty == true {
                        thinking
                    }
                    if model.canRetry { retryButton }
                    if model.showActionChips { actionChips }
                    if model.showNextPanel {
                        ChatNextPanel(showSummaryLink: true,
                                      preferredPath: model.recommendedNextStep,
                                      matchedTravelers: model.matchedTravelers,
                                      matchReasons: model.matchReasons,
                                      onGoLab: goLab, onGoSimilar: goSimilar,
                                      shareText: model.shareText,
                                      onOpenSummary: { model.showSummary = true })
                            .padding(.top, 14)
                    }
                    Color.clear.frame(height: 8).id(bottomID)
                }
                .padding(.horizontal, 20).padding(.vertical, 12)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .contentShape(Rectangle())
            .simultaneousGesture(TapGesture().onEnded { inputFocused = false })
            .onChange(of: model.messages.last?.text) { scrollToBottom(proxy) }
            .onChange(of: model.showActionChips) { scrollToBottom(proxy) }
            .onChange(of: model.showNextPanel) { scrollToBottom(proxy) }
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
                .contextMenu {
                    Button {
                        UIPasteboard.general.string = msg.text
                        toast.show("已复制")
                    } label: {
                        Label("复制", systemImage: "doc.on.doc")
                    }
                }
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

    private var retryButton: some View {
        Button {
            inputFocused = false
            model.retry(supabase: supabase)
        } label: {
            Label("重新发送", systemImage: "arrow.clockwise")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Color(hex: 0xAFC7FF))
                .padding(.horizontal, 15)
                .padding(.vertical, 9)
                .background(Color(hex: 0x5E96FF, alpha: 0.1), in: Capsule())
                .overlay(Capsule().strokeBorder(Color(hex: 0x6FA5FF, alpha: 0.3), lineWidth: 1))
        }
        .buttonStyle(PressScaleStyle())
        .padding(.top, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .transition(.opacity)
    }

    // MARK: 验证反馈 chips（原型 .chat-actions）

    private var actionChips: some View {
        HStack(spacing: 9) {
            Button(model.confirmLabel) { inputFocused = false; model.confirmInsight(supabase: supabase) }
                .font(.system(size: 12.5, weight: .semibold)).foregroundStyle(.white)
                .padding(.horizontal, 16).padding(.vertical, 9)
                .background(Theme.buttonGradient, in: Capsule())
                .buttonStyle(PressScaleStyle())
            Button(model.correctLabel) {
                inputFocused = false
                model.requestCorrection(supabase: supabase)
            }
                .font(.system(size: 12.5)).foregroundStyle(Theme.sub)
                .padding(.horizontal, 16).padding(.vertical, 9)
                .background(Theme.raised, in: Capsule())
                .overlay(Capsule().strokeBorder(Theme.line, lineWidth: 1))
                .buttonStyle(PressScaleStyle())
        }
        .padding(.top, 14)
        .transition(.opacity)
    }

    // MARK: 输入栏

    @FocusState private var inputFocused: Bool

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField("想到什么，直接问…", text: $model.input)
                .font(.system(size: 13.5)).foregroundStyle(Theme.ink).tint(Theme.blue)
                .padding(.horizontal, 18).padding(.vertical, 12)
                .background(Theme.raised, in: Capsule())
                .overlay(Capsule().strokeBorder(Theme.line, lineWidth: 1))
                .submitLabel(.send)
                .focused($inputFocused)
                .onSubmit {
                    inputFocused = false
                    model.send(model.input, supabase: supabase)
                }
            Button {
                inputFocused = false
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

// MARK: - 历史探索列表（listConversations → loadMessages 恢复续聊）

private struct ChatHistorySheet: View {
    let model: ChatModel

    @Environment(SupabaseService.self) private var supabase
    @State private var restoringId: UUID?

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 10) {
                    ForEach(model.historyEntries) { convo in
                        Button {
                            guard restoringId == nil else { return }
                            restoringId = convo.id
                            Task {
                                await model.restore(convo, supabase: supabase)
                                restoringId = nil
                            }
                        } label: {
                            row(convo)
                        }
                        .buttonStyle(PressScaleStyle())
                    }
                }
                .padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 20)
            }
            .scrollIndicators(.hidden)
        }
        .background(Theme.paper.ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var header: some View {
        HStack(spacing: 13) {
            VStack(alignment: .leading, spacing: 2) {
                Text("历史探索").font(.system(size: 16, weight: .semibold)).tracking(0.8)
                Text("选一段继续想下去").font(.system(size: 11)).foregroundStyle(Theme.faint)
            }
            Spacer()
        }
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 22).padding(.top, 20).padding(.bottom, 12)
    }

    private func row(_ convo: RemoteConversation) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                TagPill(text: convo.topic)
                if convo.crossroads?.ready == true {
                    Text("岔路口已成形").font(.system(size: 9)).tracking(1)
                        .foregroundStyle(Color(hex: 0x3ED9A4))
                }
                Spacer()
                if restoringId == convo.id {
                    ProgressView().controlSize(.mini).tint(Theme.faint)
                } else if let date = SupabaseTimestamp.timeLabel(fromRaw: convo.createdAt) {
                    Text(date).font(.system(size: 10)).foregroundStyle(Theme.faint)
                }
            }
            Text(convo.crossroads?.summary ?? "还在澄清中的对话")
                .font(.system(size: 13.5, weight: .semibold)).lineSpacing(4)
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.leading)
                .lineLimit(2)
                .padding(.top, 9)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(15)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
            .strokeBorder(Theme.line, lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
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
