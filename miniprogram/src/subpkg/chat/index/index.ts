/**
 * 探索对话 —— 对应 iOS `Features/Chat/ChatView.swift`。
 *
 * 状态全在 `model.ts`（`ChatModel`），这里只做三件事：把快照翻译成可渲染的 data、
 * 把用户操作转发回模型、处理小程序特有的滚动与键盘。
 *
 * 两处小程序特有的处理，都在下面各自的注释里说明原因：
 * - 打字机的 setData 合流（`scheduleFlush`）
 * - scroll-view 滚到底的双锚点（`ANCHORS`）
 */

import { ChatModel, type ChatSnapshot, type ChatEntryPoint } from './model'
import { parseInlineMarkdown, type MarkdownSegment } from '../../../core/design/markdown'
import { timeLabel } from '../../../core/timestamp'
import { stageSummary, clearSummary } from '../handoff'

/** 一条消息的渲染态：加粗切段在这里算好，WXML 只负责铺 */
interface RenderMessage {
  id: string
  isUser: boolean
  segs: MarkdownSegment[]
  /** 长按复制用的原文 */
  text: string
}

interface RenderHistory {
  id: string
  topic: string
  ready: boolean
  summary: string
  time: string
}

/**
 * 滚到底的两个锚点。
 *
 * `scroll-into-view` 只在**值发生变化**时才滚 —— 同一个 id 连续 setData 两次，
 * 第二次不会有任何反应。而打字机是同一条消息不断变长，锚点 id 并不变。
 * 所以准备两个零高锚点交替使用，每次都是一个「新值」。
 */
const ANCHORS = ['anchor-a', 'anchor-b']

/**
 * 打字机 setData 的合流窗口（毫秒）。
 *
 * token 的到达频率远高于屏幕刷新，每个 token 都 setData 会把渲染层的通信塞满
 * （小程序的 setData 是跨线程序列化，不是 SwiftUI 那种本地 diff）。
 * 60ms ≈ 16fps 的更新率，肉眼看仍是连续吐字，通信量降一个数量级。
 */
const FLUSH_INTERVAL = 60

Page({
  data: {
    topBarTitle: '探索问题',
    subtitle: '和你的动态画像一起想清楚',
    messages: [] as RenderMessage[],
    /** 首个 token 到达前只显示「正在想」，不渲染空气泡 */
    thinking: false,
    canRetry: false,
    showActionChips: false,
    confirmLabel: '嗯，比较接近',
    correctLabel: '还不太对',
    showNextPanel: false,
    recommendedNextStep: '',
    matchedTravelers: [] as ChatSnapshot['matchedTravelers'],
    matchReasons: {} as Record<number, string>,
    shareText: '',
    input: '',
    isStreaming: false,
    scrollAnchor: '',
    showHistory: false,
    historyEntries: [] as RenderHistory[],
    restoringId: '',
  },

  model: undefined as unknown as ChatModel,
  /** 待落地的快照；由 scheduleFlush 合流后一次性 setData */
  pendingSnapshot: undefined as ChatSnapshot | undefined,
  flushTimer: 0 as number,
  anchorIndex: 0,

  onLoad(query: Record<string, string | undefined>) {
    // 首页/tab/卡片三个入口都会带 entry；缺省按 home 记，不影响主线但埋点会失真，
    // 所以新入口一定要自报家门（对应 iOS ChatEntryPoint 不给默认值的约束）
    const entry = (query.entry ?? 'home') as ChatEntryPoint
    const topic = query.topic ? decodeURIComponent(query.topic) : null
    const question = query.question ? decodeURIComponent(query.question) : ''

    this.model = new ChatModel({ topic, question }, entry, (s) => this.onSnapshot(s))

    void this.model.start()
    void this.model.loadHistory()
  },

  onUnload() {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.model?.dispose()
    clearSummary()
  },

  /** 分享这次探索：next-panel 里的 `open-type="share"` 冒泡到这里。
   *  iOS 用 ShareLink 发整段文案；微信卡片只有一行标题，取 shareText 的首句
   *  （「我刚在万花筒探索了一个问题：…」），后半段的自述留在小程序里。 */
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    const snapshot = this.model.snapshot()
    return {
      title: snapshot.shareText.split('\n')[0],
      path: '/pages/home/index',
    }
  },

  /* ── 快照 → data ── */

  onSnapshot(s: ChatSnapshot) {
    this.pendingSnapshot = s
    this.scheduleFlush()
  },

  scheduleFlush() {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = 0
      const s = this.pendingSnapshot
      this.pendingSnapshot = undefined
      if (s) this.applySnapshot(s)
    }, FLUSH_INTERVAL) as unknown as number
  },

  applySnapshot(s: ChatSnapshot) {
    const next: RenderMessage[] = s.messages.map((m) => ({
      id: m.id,
      isUser: m.role === 'user',
      segs: parseInlineMarkdown(m.text),
      text: m.text,
    }))
    const prev = this.data.messages

    // 打字机期间只有最后一条在变长。整条数组重传是纯浪费，逐下标比对后
    // 只推变化的那几条；长度变了（新消息 / retry 弹掉失败气泡）才整条重传。
    const patch: Record<string, unknown> = {}
    if (prev.length === next.length) {
      // forEach 而不是索引 for：tsconfig 开了 noUncheckedIndexedAccess，
      // next[i] 会是 `T | undefined`，回调参数才拿得到确定类型
      next.forEach((item, i) => {
        if (prev[i]?.id !== item.id || prev[i]?.text !== item.text) {
          patch[`messages[${i}]`] = item
        }
      })
    } else {
      patch.messages = next
    }

    const last = s.messages[s.messages.length - 1]
    patch.thinking = s.isStreaming && last?.text === ''
    patch.canRetry = s.canRetry
    patch.showActionChips = s.showActionChips
    patch.confirmLabel = s.confirmLabel
    patch.correctLabel = s.correctLabel
    patch.showNextPanel = s.showNextPanel
    patch.recommendedNextStep = s.recommendedNextStep ?? ''
    patch.matchedTravelers = s.matchedTravelers
    patch.matchReasons = s.matchReasons
    patch.shareText = s.shareText
    patch.isStreaming = s.isStreaming
    patch.showHistory = s.showHistory
    patch.topBarTitle = s.displayTopic ? `探索 · ${s.displayTopic}` : '探索问题'
    patch.historyEntries = s.historyEntries.map((h) => ({
      id: h.id,
      topic: h.topic,
      ready: h.crossroads?.ready === true,
      summary: h.crossroads?.summary ?? '还在澄清中的对话',
      time: timeLabel(h.created_at) ?? '',
    }))

    this.setData(patch, () => this.scrollToBottom())

    // 总结页是独立页面，拿不到模型实例；每次快照都把它要用的部分留一份
    stageSummary({
      displayTopic: s.displayTopic,
      displayQuestion: s.displayQuestion,
      answers: s.answers,
      shareText: s.shareText,
      recommendedNextStep: s.recommendedNextStep,
      matchedTravelers: s.matchedTravelers,
      matchReasons: s.matchReasons,
    })
  },

  scrollToBottom() {
    this.anchorIndex = (this.anchorIndex + 1) % ANCHORS.length
    this.setData({ scrollAnchor: ANCHORS[this.anchorIndex] })
  },

  /* ── 顶栏 ── */

  onBack() {
    wx.navigateBack()
  },

  /* ── 输入栏 ── */

  /**
   * 输入框是受控的，每次按键都要把值同步回 data。
   *
   * 看着多余，但不同步就清不掉：发送后 `setData({ input: '' })` 只有在 data.input
   * 确实不为空时才算一次变更，否则框架判定「值没变」而不下发，用户发完消息
   * 输入框里还留着原文。
   */
  onInput(e: WechatMiniprogram.CustomEvent<Record<string, never>, { value: string }>) {
    this.setData({ input: e.detail.value })
  },

  onSend() {
    const text = this.data.input
    if (!text.trim() || this.data.isStreaming) return
    this.setData({ input: '' })
    this.model.send(text)
  },

  /* ── 验证反馈 chips ── */

  onConfirm() {
    this.model.confirmInsight()
  },

  onCorrect() {
    this.model.requestCorrection()
  },

  onRetry() {
    this.model.retry()
  },

  /* ── 长按复制 ── */

  onCopyMessage(e: WechatMiniprogram.BaseEvent<Record<string, never>, { text: string }>) {
    const { text } = e.currentTarget.dataset
    if (!text) return
    wx.setClipboardData({ data: text })
  },

  /* ── 下一步 ── */

  onGoLab() {
    // 对应 iOS AppRouter.pendingLabQuestion：Lab 页出现时消费
    const app = getApp<{ globalData: { pendingLabQuestion?: string } }>()
    app.globalData.pendingLabQuestion = this.model.snapshot().displayQuestion
    wx.switchTab({ url: '/pages/lab/index' })
    wx.showToast({ title: '问题已带入人生实验室', icon: 'none' })
  },

  onGoSimilar() {
    wx.switchTab({ url: '/pages/community/index' })
    wx.showToast({ title: '正在寻找走过这段路的人', icon: 'none' })
  },

  onTravelerTap(e: WechatMiniprogram.CustomEvent<{ id: number }>) {
    wx.navigateTo({ url: `/subpkg/profile/index/index?id=${e.detail.id}` })
  },

  onOpenSummary() {
    wx.navigateTo({ url: '/subpkg/chat/summary/index' })
  },

  /* ── 历史探索 ── */

  onOpenHistory() {
    this.model.toggleHistory(true)
  },

  onCloseHistory() {
    this.model.toggleHistory(false)
  },

  async onRestore(e: WechatMiniprogram.BaseEvent<Record<string, never>, { id: string }>) {
    const { id } = e.currentTarget.dataset
    if (this.data.restoringId) return
    this.setData({ restoringId: id })
    await this.model.restore(id)
    this.setData({ restoringId: '' })
  },
})
