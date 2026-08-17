/**
 * 探索对话状态机 —— 对应 iOS `Features/Chat/ChatModel.swift`（656 行）。
 *
 * 付费漏斗主线（技术设计文档 §9.1）：
 *   首页发问 → 流式承接迷茫/澄清 → AI 给出「暂时的理解」→ 验证反馈
 *   （嗯，比较接近 / 还不太对，可循环纠正）→ 信息足够 → 下一步面板
 *
 * 与 iOS 保持一致的几处关键行为（改动要四端一起改）：
 * - 首页四条示例问题的首轮走本地 mock，保证产品主线确定可达；用户在此之后的任何
 *   反馈都会把完整上下文交给 /chat（`startedWithMock` 分支）
 * - 验证按钮的出现条件是「服务端 ready」**且**「回复文本里确实有确认邀请」，
 *   缺一不可 —— 只看 ready 会在 AI 还在追问时就冒出按钮
 * - match 永远先铺两张本地兜底卡，再用服务端结果覆盖；服务端只解析出一位时
 *   保留已筛过的兜底卡，不从素材池头部随便补人
 *
 * 这个文件只管状态，不碰视图；页面通过 `onChange` 回调拿到快照去 setData。
 * 这样拆是因为小程序的 Page 实例把数据和视图搅在一起，逻辑一旦长过百行就很难读。
 */

import { streamChat, type ChatStreamDone, type ChatTurn } from '../../../core/net/chat-stream'
import { listConversations, loadMessages, loadTravelers, match } from '../../../core/net/api'
import { track } from '../../../core/analytics'
import {
  DEMO_TRAVELERS,
  EXPLORE_TOPICS,
  isSampleQuestion,
  type Crossroads,
  type MatchQuery,
  type RemoteChatMessage,
  type RemoteConversation,
  type TrajectoryNode,
  type Traveler,
} from '../../../core/models'

/** 对话入口来源（chat_started.entry_point · 埋点方案 §3.1）。没有默认值：
 *  新增入口时必须显式声明自己是谁，避免全部被记成首页。 */
export type ChatEntryPoint = 'home' | 'tab' | 'card'

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  text: string
}

/** 对话阶段（对照原型 chatState.stage） */
export type Stage = 'clarify' | 'review' | 'correction' | 'ready'

type RequestContext = 'clarify' | 'correctionFollowUp' | 'confirm' | 'rejection'

export interface ChatLaunch {
  /** 职业 / 家庭 / 升学 / 情感；null = 无话题自由提问 */
  topic: string | null
  question: string
}

/** 页面渲染需要的全部状态快照 */
export interface ChatSnapshot {
  messages: ChatMessage[]
  stage: Stage
  isStreaming: boolean
  showActionChips: boolean
  showNextPanel: boolean
  showSummary: boolean
  hadCorrection: boolean
  canRetry: boolean
  confirmLabel: string
  correctLabel: string
  recommendedNextStep: 'match' | 'lab' | null
  matchedTravelers: Traveler[]
  matchReasons: Record<number, string>
  displayTopic: string | null
  displayQuestion: string
  shareText: string
  /** 用户在澄清/纠正中的原话，按时间序；总结页按下标取前两条做插值 */
  answers: string[]
  historyEntries: RemoteConversation[]
  showHistory: boolean
}

const CONFIRM_PHRASE = '嗯，这个理解比较接近我。'
const CONFIRM_AFTER_CORRECTION_PHRASE = '这次准确了。'
const CORRECTION_PHRASE = '还不太对。'
const VERIFICATION_PHRASES = new Set([
  CONFIRM_PHRASE,
  CONFIRM_AFTER_CORRECTION_PHRASE,
  CORRECTION_PHRASE,
])
const API_FAILURE_MESSAGE = '我好像在接你的路上迷路了，请重试一下。'

/** AI 本轮确实把「暂时的理解」交给用户验证的语言线索 */
const VERIFICATION_CUES = [
  '这个理解接近你吗',
  '这个理解准确吗',
  '这个理解对吗',
  '这样的理解接近你吗',
  '这份理解接近你吗',
  '你可以纠正我',
]

let messageSeq = 0
function nextId(): string {
  messageSeq += 1
  return `m${messageSeq}`
}

export class ChatModel {
  private messages: ChatMessage[] = []
  private stage: Stage = 'clarify'
  private isStreaming = false
  private showActionChips = false
  private hadCorrection = false
  private showNextPanel = false
  private showSummary = false
  private recommendedNextStep: 'match' | 'lab' | null = null
  /** 用户在澄清/纠正中的原话（结论、总结与分享文案插值） */
  private answers: string[] = []

  /** 服务端会话 ID：首轮 done 事件返回，后续追问带回以延续历史 */
  private conversationId?: string
  /** 四条示例问题从本地 mock 开场；第一次转真实 API 时需要显式补齐这段上下文 */
  private startedWithMock = false
  private crossroads?: Crossroads

  private retryRequest?: { userText: string; context: RequestContext }

  private matchedTravelers: Traveler[] = []
  private matchReasons: Record<number, string> = {}
  /** 每个岔路口只请求一次；请求期间或失败时保留本地兜底卡片 */
  private matchAttempted = false
  private travelerPool: Traveler[] = []

  private history: RemoteConversation[] = []
  private showHistory = false
  private restoredTopic?: string
  private restoredQuestion?: string

  private cancelCurrentStream?: () => void

  constructor(
    private readonly launch: ChatLaunch,
    private readonly entryPoint: ChatEntryPoint,
    private readonly onChange: (snapshot: ChatSnapshot) => void,
  ) {}

  /* ── 快照 ── */

  get displayTopic(): string | null {
    return this.restoredTopic ?? this.launch.topic
  }

  get displayQuestion(): string {
    return this.restoredQuestion ?? this.launch.question
  }

  get shareText(): string {
    const a0 = this.answers[0] ?? '真正想要的生活'
    const a1 = this.answers[1] ?? '暂时不能失去的东西'
    return `我刚在万花筒探索了一个问题：${this.displayQuestion}\n\n我现在更清楚的是：我既想靠近${a0}，也在保护${a1}。`
  }

  snapshot(): ChatSnapshot {
    return {
      messages: this.messages,
      stage: this.stage,
      isStreaming: this.isStreaming,
      showActionChips: this.showActionChips,
      showNextPanel: this.showNextPanel,
      showSummary: this.showSummary,
      hadCorrection: this.hadCorrection,
      canRetry: this.retryRequest !== undefined && !this.isStreaming,
      confirmLabel: this.hadCorrection ? '这次准确了' : '嗯，比较接近',
      correctLabel: this.hadCorrection ? '我再补充一点' : '还不太对',
      recommendedNextStep: this.recommendedNextStep,
      matchedTravelers: this.matchedTravelers,
      matchReasons: this.matchReasons,
      displayTopic: this.displayTopic,
      displayQuestion: this.displayQuestion,
      shareText: this.shareText,
      answers: this.answers,
      // 历史入口条目排除当前会话自身
      historyEntries: this.history.filter((h) => h.id !== this.conversationId),
      showHistory: this.showHistory,
    }
  }

  private emit(): void {
    this.onChange(this.snapshot())
  }

  /* ── 启动 ── */

  async start(): Promise<void> {
    if (this.messages.length > 0) return
    this.messages.push({ id: nextId(), role: 'user', text: this.launch.question })
    // 首条已发出才算一次对话开始；问题正文不上报，只报入口
    track('chat_started', { entry_point: this.entryPoint })
    this.emit()

    if (isSampleQuestion(this.launch.question)) {
      this.startedWithMock = true
      const startedAt = Date.now()
      await this.appendLocalReply(goldenReply(this.launch))
      // 本地示例没有服务端事实，必须由客户端写入 app_events
      this.trackTurnCompleted(startedAt, this.messages[this.messages.length - 1]?.text.length ?? 0)
      this.stage = 'review'
      this.showActionChips = true
      this.emit()
    } else {
      await this.performAssistant(this.launch.question, 'clarify')
    }
  }

  /* ── 继续追问 ── */

  send(text: string): void {
    const clean = text.trim()
    if (!clean || this.isStreaming) return

    const previousStage = this.stage
    this.showActionChips = false
    // 用户直接输入就是在继续补充或修正；旧的确认按钮不应与新回复并存
    if (previousStage === 'review' || previousStage === 'ready') {
      this.stage = 'clarify'
      this.showNextPanel = false
      this.recommendedNextStep = null
    }
    // 任意新补充都可能改变匹配条件，不能沿用上一版理解预取的用户卡
    this.resetMatch()
    this.messages.push({ id: nextId(), role: 'user', text: clean })
    this.answers.push(clean)
    this.emit()

    const context: RequestContext =
      previousStage === 'correction' ? 'correctionFollowUp' : 'clarify'
    void this.performAssistant(clean, context)
  }

  /* ── 验证反馈（chips）—— 每一步都续接真实 API ── */

  /** 「嗯，比较接近 / 这次准确了」→ API 基于完整历史生成分析与建议 */
  confirmInsight(): void {
    if (this.isStreaming) return
    this.showActionChips = false
    const userText = this.hadCorrection ? CONFIRM_AFTER_CORRECTION_PHRASE : CONFIRM_PHRASE
    this.messages.push({ id: nextId(), role: 'user', text: userText })
    this.emit()
    void this.performAssistant(userText, 'confirm')
  }

  /** 「还不太对 / 我再补充一点」→ API 根据被否定的上下文生成下一句追问 */
  requestCorrection(): void {
    if (this.isStreaming) return
    this.showActionChips = false
    this.resetMatch()
    this.messages.push({ id: nextId(), role: 'user', text: CORRECTION_PHRASE })
    this.stage = 'correction'
    this.emit()
    void this.performAssistant(CORRECTION_PHRASE, 'rejection')
  }

  /** 失败气泡下的「重新发送」：移除失败占位，原样重放，不重复用户消息 */
  retry(): void {
    const request = this.retryRequest
    if (!request || this.isStreaming) return
    this.retryRequest = undefined

    const last = this.messages[this.messages.length - 1]
    if (last?.role === 'ai' && last.text === API_FAILURE_MESSAGE) {
      this.messages.pop()
    }
    this.emit()
    void this.performAssistant(request.userText, request.context)
  }

  /* ── UI 开关 ── */

  toggleSummary(show: boolean): void {
    this.showSummary = show
    this.emit()
  }

  toggleHistory(show: boolean): void {
    this.showHistory = show
    this.emit()
  }

  /** 页面卸载：断开在途流，避免回调打到已销毁的页面上 */
  dispose(): void {
    this.cancelCurrentStream?.()
    this.cancelCurrentStream = undefined
  }

  /* ── 岔路口 → /match ── */

  private resetMatch(): void {
    this.matchedTravelers = []
    this.matchReasons = {}
    this.matchAttempted = false
  }

  /**
   * 信息足够后请求匹配，并始终为对话面板准备 2 位旅人。
   * 服务端岔路口缺失时（例如本地示例链路），用当前问题和用户补充生成保守条件。
   */
  private async requestMatch(): Promise<void> {
    if (this.matchAttempted) return
    this.matchAttempted = true

    if (this.travelerPool.length === 0) {
      try {
        this.travelerPool = await loadTravelers()
      } catch {
        this.travelerPool = []
      }
    }
    const pool = this.travelerPool.length > 0 ? this.travelerPool : DEMO_TRAVELERS
    this.applyMatchFallback(pool)
    this.emit()

    try {
      const response = await match(this.effectiveMatchQuery())
      const travelers: Traveler[] = []
      const reasons: Record<number, string> = {}

      for (const m of response.matches) {
        const t = pool.find((x) => x.id === m.traveler_id)
        if (!t || travelers.some((x) => x.id === t.id)) continue
        travelers.push(t)
        reasons[t.id] = m.reason
        if (travelers.length === 2) break
      }

      // 服务端只解析出一位时，沿用已经按当前对话精准筛过的本地/模拟卡，
      // 不从素材池头部随便补一个无关人物
      for (const t of this.matchedTravelers) {
        if (travelers.length >= 2) break
        if (travelers.some((x) => x.id === t.id)) continue
        travelers.push(t)
        const reason = this.matchReasons[t.id]
        if (reason) reasons[t.id] = reason
      }

      if (travelers.length === 2) {
        this.matchedTravelers = travelers
        this.matchReasons = reasons
        this.emit()
      }
    } catch {
      // 保留已经展示的两张兜底卡，不让网络失败打断主线
    }
  }

  private effectiveMatchQuery(): MatchQuery {
    if (this.crossroads?.ready && this.crossroads.match_query) {
      return this.crossroads.match_query
    }
    const userContext = this.answers.length === 0 ? this.displayQuestion : this.answers.join('；')
    return {
      life_stage: null,
      constraints: this.answers.length > 1 ? this.answers.slice(1, 3) : [],
      tension: `${this.displayQuestion}；${userContext}`,
      decision_stage: '正在澄清选择与代价',
      support_need: '需要不同路径的真实经验与可验证的下一步',
    }
  }

  private applyMatchFallback(pool: Traveler[]): void {
    const context = [this.displayQuestion, ...this.answers].join('；')
    const scored = pool
      .map((t) => ({ t, score: localMatchScore(t, context) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => (a.score === b.score ? a.t.id - b.t.id : b.score - a.score))
      .slice(0, 2)
      .map((x) => x.t)

    const selected = [...scored]
    while (selected.length < 2) {
      selected.push(this.makeSyntheticTraveler(selected.length))
    }

    this.matchedTravelers = selected
    this.matchReasons = {}
    for (const t of selected) {
      this.matchReasons[t.id] = fallbackReason(t)
    }
  }

  /**
   * 素材库覆盖不到当前处境时，用用户自己的两股拉力生成一张明确标注的模拟路径卡。
   * 两张卡分别代表「先靠近」与「先守底线」，避免只给单一方向造成确认偏误。
   */
  private makeSyntheticTraveler(index: number): Traveler {
    const approaching = this.answers[0] ?? this.displayQuestion
    const protecting = this.answers[1] ?? '当前不能轻易失去的部分'
    const moveFirst = index % 2 === 0
    const quote = moveFirst
      ? `先用一次可撤回的小尝试验证「${approaching}」，同时为「${protecting}」设好停止条件。`
      : `先补足能保护「${protecting}」的现实条件，再给「${approaching}」设一个明确复盘日。`
    const trajectory: TrajectoryNode[] = [
      {
        age: '下一步',
        t: moveFirst ? '做一次最小现实接触' : '先补齐关键保护条件',
        d: quote,
      },
    ]
    return {
      id: -9101 - index,
      name: moveFirst ? '模拟路径 · 先试一步' : '模拟路径 · 先守底线',
      initial: moveFirst ? '试' : '守',
      hue: moveFirst ? 0 : 4,
      is_similar: true,
      quote,
      bio: '基于本轮回答生成的对照经历样本',
      tags: moveFirst ? ['可撤回尝试', '主动验证'] : ['先补缓冲', '定期复盘'],
      dims: [],
      trajectory,
    }
  }

  /* ── 历史会话 ── */

  async loadHistory(): Promise<void> {
    try {
      const res = await listConversations(20, 0)
      this.history = res.conversations
    } catch {
      this.history = [] // 静默：入口不显示
    }
    this.emit()
  }

  /**
   * 恢复一段历史会话续聊 —— 对应 iOS `ChatModel.restore`。
   * 拉取失败静默返回，保持当前对话不动（宁可不恢复，也不要清空用户正在写的这一段）。
   */
  async restore(conversationId: string): Promise<void> {
    if (this.isStreaming) return
    const convo = this.history.find((h) => h.id === conversationId)
    if (!convo) return

    let remote: RemoteChatMessage[]
    try {
      remote = await loadMessages(conversationId)
    } catch {
      return
    }
    if (remote.length === 0) return

    this.conversationId = convo.id
    this.restoredTopic = convo.topic
    this.restoredQuestion = remote.find((m) => m.role === 'user')?.content
    this.crossroads = convo.crossroads ?? undefined
    this.messages = remote.map((m) => ({
      id: nextId(),
      role: m.role === 'user' ? 'user' : 'ai',
      text: m.content,
    }))
    // answers = 首条问题之后的用户原话；过滤掉 chips 的固定验证短语，
    // 避免「嗯，这个理解比较接近我。」之类混进结论与分享文案的插值
    this.answers = remote
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .slice(1)
      .filter((c) => !VERIFICATION_PHRASES.has(c))
    this.hadCorrection = false
    this.showNextPanel = false
    this.recommendedNextStep = null
    this.showSummary = false
    this.resetMatch()
    this.retryRequest = undefined
    // 恢复的会话已有 conversation_id，服务端能自取历史，不需要再补 mock 上下文
    this.startedWithMock = false

    if (this.shouldOfferVerification(convo.crossroads?.ready === true)) {
      // 历史会话同样要求「结构已成形 + 最后一轮明确邀请确认」，缺一不展示按钮
      this.stage = 'review'
      this.showActionChips = true
      void this.requestMatch()
    } else {
      this.stage = 'clarify'
      this.showActionChips = false
    }
    this.showHistory = false
    this.emit()
  }

  /* ── 流式请求 + 打字机 ── */

  /**
   * 统一执行 API 请求，并在成功后恢复原本所属的状态分支。
   * 失败只记录可重放请求，不再恢复一组可能与失败气泡冲突的旧按钮。
   */
  private async performAssistant(userText: string, context: RequestContext): Promise<void> {
    const result = await this.streamAssistant(userText)

    if (!result.delivered) {
      this.retryRequest = { userText, context }
      this.showActionChips = false
      this.emit()
      return
    }
    this.retryRequest = undefined

    if (result.conclusion?.ready && context !== 'rejection') {
      this.stage = 'ready'
      this.showActionChips = false
      this.showNextPanel = true
      this.recommendedNextStep = result.conclusion.next_step
      this.emit()
      if (this.recommendedNextStep === 'match') void this.requestMatch()
      return
    }

    switch (context) {
      case 'clarify':
        // 只有「结构已清晰 + 本轮明确邀请确认」才进入验证态
        if (this.shouldOfferVerification(result.ready)) {
          await sleep(850)
          this.stage = 'review'
          this.showActionChips = true
        } else {
          this.stage = 'clarify'
          this.showActionChips = false
        }
        break
      case 'correctionFollowUp':
        this.hadCorrection = true
        if (this.shouldOfferVerification(result.ready)) {
          this.stage = 'review'
          this.showActionChips = true
        } else {
          this.stage = 'correction'
          this.showActionChips = false
        }
        break
      case 'confirm':
        this.stage = 'ready'
        this.showNextPanel = true
        this.recommendedNextStep = result.conclusion?.next_step ?? 'match'
        if (this.recommendedNextStep === 'match') void this.requestMatch()
        break
      case 'rejection':
        this.hadCorrection = true
        this.stage = 'correction'
        this.showActionChips = false
        break
    }
    this.emit()
  }

  /**
   * 服务端的 ready 表示问题结构已成形；回复文本中的确认邀请表示 AI 本轮确实已经把
   * 暂时理解交给用户验证。**二者缺一都不展示按钮** —— 只看 ready 会在 AI 还在追问时
   * 就冒出「嗯，比较接近」，那是答非所问。
   */
  private shouldOfferVerification(resultReady: boolean): boolean {
    if (!resultReady) return false
    const reply = [...this.messages].reverse().find((m) => m.role === 'ai' && m.text)?.text
    if (!reply) return false
    return VERIFICATION_CUES.some((cue) => reply.includes(cue))
  }

  /**
   * 通用续轮：把 userText 经 /chat 流式发送（带 conversation_id）。
   *
   * @returns delivered = 是否完整拿到真实回复（收到 done 事件）；
   *          false 表示半途中断或 API 失败，调用方不推进状态
   */
  private streamAssistant(
    userText: string,
  ): Promise<{ delivered: boolean; ready: boolean; conclusion?: ChatStreamDone['conclusion'] }> {
    return new Promise((resolve) => {
      this.isStreaming = true
      const requestStartedAt = Date.now()

      // 服务端按 conversation_id 自取库内历史（validateChatInput 忽略 history）。
      // mock 首轮尚无 conversation_id，因此第一次调用 API 时把原问题、mock 理解和
      // 用户最新反馈合并进 message，确保模型知道用户正在认同或否定什么。
      const history: ChatTurn[] =
        this.conversationId !== undefined
          ? []
          : this.messages.slice(0, -1).map((m) => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.text,
            }))

      this.messages.push({ id: nextId(), role: 'ai', text: '' })
      const aiIndex = this.messages.length - 1
      this.emit()

      const apiMessage =
        this.startedWithMock && this.conversationId === undefined
          ? buildMockContinuation(this.launch, userText)
          : userText

      let ready = false
      let receivedDone = false
      let conclusion: ChatStreamDone['conclusion']
      let settled = false

      const finish = (delivered: boolean) => {
        if (settled) return
        settled = true
        this.isStreaming = false
        this.cancelCurrentStream = undefined
        this.emit()
        resolve({ delivered, ready, conclusion })
      }

      const failWith = (message: string) => {
        const target = this.messages[aiIndex]
        if (target) target.text = message
        finish(false)
      }

      this.cancelCurrentStream = streamChat(
        {
          conversation_id: this.conversationId,
          topic: this.displayTopic ?? '综合',
          message: apiMessage,
          history,
        },
        {
          onToken: (t) => {
            const target = this.messages[aiIndex]
            if (!target) return
            target.text += t
            this.emit()
          },
          onDone: (done) => {
            receivedDone = true
            if (done.conversation_id) this.conversationId = done.conversation_id
            if (done.crossroads) {
              // 后端每轮 done 都带 crossroads，持续刷新
              this.crossroads = done.crossroads
              if (done.crossroads.ready) ready = true
            }
            conclusion = done.conclusion

            const text = this.messages[aiIndex]?.text ?? ''
            if (!text) {
              failWith(API_FAILURE_MESSAGE)
              return
            }
            // 真实 API 轮次由 chat Edge Function 权威写入 app_events；
            // 端上不重复上报，避免事实表双计数（埋点方案 §0）
            this.trackTurnCompleted(requestStartedAt, text.length, false)
            if (ready || conclusion?.next_step === 'match') void this.requestMatch()
            finish(true)
          },
          onError: () => {
            failWith(API_FAILURE_MESSAGE)
          },
        },
      )

      // 流正常结束但从未收到 done：视为 API 失败，不展示不完整的模型输出。
      // 小程序的 success 回调在 chunk 收完后触发，这里用一个宽松的兜底计时器
      // 覆盖「连接断了但没触发 fail」的情况。
      setTimeout(() => {
        if (settled || receivedDone) return
        failWith(API_FAILURE_MESSAGE)
      }, 125_000)
    })
  }

  /**
   * 一轮流式回复真正结束（收到 done 且有内容）时上报。
   * turn_index 直接数已成立的 AI 回复：含本地示例首轮与历史恢复的轮次，
   * 排除失败占位气泡；回复只报字数，正文绝不进属性（埋点方案 §1）。
   */
  private trackTurnCompleted(startedAt: number, replyChars: number, persist = true): void {
    if (!persist) return
    const turnIndex = this.messages.filter(
      (m) => m.role === 'ai' && m.text && m.text !== API_FAILURE_MESSAGE,
    ).length
    track('chat_turn_completed', {
      turn_index: turnIndex,
      latency_ms: Date.now() - startedAt,
      response_chars: replyChars,
    })
  }

  /** 四条首页示例问题首轮使用的本地 mock 回复 */
  private async appendLocalReply(text: string): Promise<void> {
    this.isStreaming = true
    this.messages.push({ id: nextId(), role: 'ai', text: '' })
    const aiIndex = this.messages.length - 1
    this.emit()

    await sleep(700)
    const target = this.messages[aiIndex]
    if (target) target.text = text
    this.isStreaming = false
    this.emit()
  }
}

/* ── 纯函数辅助 ── */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 只把与当前原话存在明确语义交集的本地素材放上去；零分不硬凑 */
function localMatchScore(traveler: Traveler, context: string): number {
  const profile = [traveler.bio, traveler.quote, ...traveler.tags].join(' ')
  const semanticSignals: [string[], string[]][] = [
    [['转行', '转型', '换赛道', '职业', '工作', '产品', '设计'], ['转型', '转行', '产品', '设计']],
    [['读研', '考研', '读书', '留学', '本科', '学习'], ['本科', '硕士', '在读', '学习']],
    [['裸辞', '休息', '间隔年', 'gap', '倦怠'], ['裸辞', 'gap', '休息', '环岛']],
    [['独立开发', '创业', '自由职业', '副业', '做产品'], ['独立开发', '创业', '产品', '一个人']],
    [['心理', '咨询', '倾听', '助人'], ['心理', '咨询', '倾听']],
  ]

  let score = 0
  for (const [queryWords, profileWords] of semanticSignals) {
    const hitQuery = queryWords.some((w) => context.toLowerCase().includes(w.toLowerCase()))
    const hitProfile = profileWords.some((w) => profile.toLowerCase().includes(w.toLowerCase()))
    if (hitQuery && hitProfile) score += 3
  }
  for (const tag of traveler.tags) {
    if (tag.length >= 3 && context.toLowerCase().includes(tag.toLowerCase())) score += 2
  }
  return score
}

function fallbackReason(traveler: Traveler): string {
  if (traveler.id < 0) return traveler.quote
  const clue = traveler.tags[0] ?? traveler.bio
  return `本地经历中，TA 的「${clue}」与你现在要验证的选择和代价最接近。`
}

/** 四条首页示例问题的本地 mock 收敛句 */
function goldenSummary(launch: ChatLaunch): string {
  switch (launch.topic) {
    case '家庭':
      return '不想放弃在大城市继续拼搏、证明自己能站稳脚跟的可能 vs 对父母的感恩与牵挂，让你越来越想回家陪伴他们'
    case '升学':
      return '想用读研突破学历与职业发展的天花板 vs 害怕放下已经拥有的工作节奏，承担收入、时间和机会成本'
    case '情感':
      return '想守住这段感情，把彼此带向真正共同的生活 vs 害怕为爱换城后失去自己的事业根基与生活主动权'
    default:
      return '想赌一次更高薪、拥有更大影响力的可能 vs 舍不得放下多年深耕的积累，走进一个全新而未知的领域'
  }
}

export function goldenReply(launch: ChatLaunch): string {
  return `我先试着说一个**暂时的理解**：你卡住的可能不只是「该选哪一个」，而是既想保护「真正重视的东西」，又不想放弃「现实里已经出现的信号」。\n\n我们把它收敛成一个更清楚的岔路口：\n\n**${goldenSummary(launch)}**。\n\n所以你需要的也许不是别人替你判断，而是把**真实意愿**和**害怕付出的代价**拆开来看。这个理解接近你吗？`
}

/**
 * mock 首轮之后第一次调用真实 API：把原问题、mock 理解和用户最新反馈合并成一条
 * message，否则模型不知道用户正在认同或否定什么（此时还没有 conversation_id，
 * 服务端取不到历史）。
 */
function buildMockContinuation(launch: ChatLaunch, userText: string): string {
  let instruction: string
  if (userText === CONFIRM_PHRASE || userText === CONFIRM_AFTER_CORRECTION_PHRASE) {
    instruction =
      '用户已经确认你的理解准确。不要继续索取信息，也不要复述“我看见了你的困惑”。请基于上述完整上下文，直接给出有依据但不说死的暂时分析、贴合这个用户的低成本建议；先完成回答，再自然承接人生实验室与相似经历。'
  } else if (userText === CORRECTION_PHRASE) {
    instruction =
      '用户明确认为刚才的理解不准确。请真正重新阅读上下文，不要使用固定道歉模板，也不要为原判断辩护；指出你需要修正的具体假设，并只追问一个最能降低不确定性的问题。'
  } else {
    instruction =
      '请承接这段上下文继续倾听。如果用户不认同初步理解，不要为原判断辩护，也不要立即换一组新的二者对立。先区分：是对两股拉力的具体理解不准确，还是用户的问题本身就不适合二元框架。如果不适合，停止使用 vs 结构，转而探索多重方向、信息缺口、行动阻力或尚未命名的感受。'
  }

  return `此前的本地示例对话上下文：\n用户最初的问题：${launch.question}\n助手给出的初步理解：${goldenReply(launch)}\n\n用户现在的反馈或补充：${userText}\n\n${instruction}`
}

/** 供页面回填话题 chip 用 */
export { EXPLORE_TOPICS, VERIFICATION_PHRASES }
