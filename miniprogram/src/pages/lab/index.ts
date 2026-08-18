/**
 * 02 人生实验室 —— 对应 iOS `Features/Lab/LabView.swift`。
 *
 * 自上而下：问题卡 · 时间旋钮 · 档位速选 · 选择卡牌堆 · 底线卡 · 开始推演。
 *
 * 与 iOS 的平台差异：
 * - iOS 用 `fullScreenCover` 就地弹出结果页；小程序没有这种呈现方式，结果页做成
 *   本页内的全屏浮层（`result-sheet` 组件），返回键与手势都还能用，也不必把
 *   一份不小的结果数据序列化进 URL 再在另一个页面反序列化回来。
 * - iOS 的拖拽用 `DragGesture` + 坐标空间；小程序里选择卡与转盘是两棵独立的
 *   节点树，拖拽靠页面级 touch 事件 + 一次性量好的转盘外接圆做命中判定。
 * - `router.pendingLabQuestion` 对应 `app.globalData.pendingLabQuestion`，
 *   在 `onShow` 消费（switchTab 进来不会触发 onLoad）。
 *
 * 状态在 `model.ts`，这里只负责铺快照、手势与跳转。
 */

import { cardAccentIndex } from '../../core/design/card-accent'
import { SIMULATION_HORIZONS, type SimulationHorizon } from '../../core/models'
import { LabModel, CARRY_CARDS, type CarryCard, type LabChoice, type LabSnapshot } from './model'

/** 转盘直径（rpx）—— iOS 260pt × 1.923 */
const DIAL_SIZE = 500

/** 档位速选：8 个常用档，不是全部 14 个（iOS presets 同款） */
const PRESET_KEYS = ['day7', 'day30', 'month3', 'month6', 'year1', 'year3', 'year5', 'year10']

/** 牌堆里那张「写一张自己的卡」的固定位 */
const CREATE_ID = '__create__'

/** 扇形展开的几何：与 iOS `choiceDeck` 逐项一致（原型 layoutChoiceDeck） */
const FAN_MAX_SPREAD = 310
const FAN_MIN_SPREAD = 224
const FAN_PER_CARD = 52
const FAN_ROTATE = 16
const FAN_LIFT = 23
const FAN_LIFT_POW = 1.35

/** 牌堆里一张卡的渲染数据（几何在这里算好，wxml 只贴 style） */
interface DeckCard {
  id: string
  /** create 卡没有 name */
  name: string
  desc: string
  icon: string
  accent: number
  isCustom: boolean
  isCreate: boolean
  on: boolean
  /** transform 的三个分量 */
  x: number
  y: number
  rotate: number
  scale: number
  z: number
}

interface PageData {
  question: string
  /** 问题编辑态 */
  editing: boolean
  draft: string

  dialSize: number
  horizonIndex: number
  horizonLabel: string
  pick: string
  /** 拖拽悬停在转盘上 */
  hot: boolean

  presets: SimulationHorizon[]
  presetKey: string

  deck: DeckCard[]
  deckHeight: number
  choicesLoading: boolean
  /** 服务端一张卡都没生成出来时露出「重新生成」 */
  choicesEmpty: boolean

  /** 自定义卡编辑器 */
  showEditor: boolean
  customName: string
  customDesc: string

  /** 底线卡 + 当前是否选中（WXML 表达式里做不了数组查找） */
  carryCards: (CarryCard & { on: boolean })[]
  carryCount: number
  /** 恰好露出 2.5 张卡的卡宽（rpx），首帧用回退值 */
  carryCardWidth: number

  canSim: boolean
  loading: boolean
  loadStep: string

  /** 拖拽浮标 */
  ghostShow: boolean
  ghostName: string
  ghostIcon: string
  ghostX: number
  ghostY: number

  resultShow: boolean
  result: LabSnapshot['result']
}

interface PageCustom {
  model: LabModel | null
  /** 转盘外接圆（页面坐标），拖拽命中判定用 */
  dialHit: { cx: number; cy: number; r: number } | null
  /** 当前正被拖的卡；null = 没在拖 */
  dragging: LabChoice | null
  /** 最近点过的那张卡；扇形里它压在最上层（对应 iOS `frontCard`） */
  frontCard: string | null
  /** 上一条已弹过的错误；用于错误 toast 的边沿判断 */
  lastError: string | null
  /** 结果页是否已展示过；用于埋点的边沿判断 */
  resultShown: boolean

  onSnapshot(s: LabSnapshot): void
  buildDeck(s: LabSnapshot): DeckCard[]
  measureDial(): void
  measureCarry(): void
  consumePendingQuestion(): void

  onEditQuestion(): void
  onDraftInput(e: WechatMiniprogram.CustomEvent<{ value: string }>): void
  onDraftCancel(): void
  onDraftSave(): void

  onDialChange(e: WechatMiniprogram.CustomEvent<{ index: number }>): void
  onPresetTap(e: WechatMiniprogram.BaseEvent<Record<string, never>, { key: string }>): void

  onCardTap(e: WechatMiniprogram.BaseEvent<Record<string, never>, { id: string }>): void
  onCardLongPress(e: WechatMiniprogram.BaseEvent<Record<string, never>, { id: string }>): void
  onCardTouchStart(e: WechatMiniprogram.TouchEvent<Record<string, never>, { id: string }>): void
  onCardTouchMove(e: WechatMiniprogram.TouchEvent): void
  onCardTouchEnd(e: WechatMiniprogram.TouchEvent): void

  onNameInput(e: WechatMiniprogram.CustomEvent<{ value: string }>): void
  onDescInput(e: WechatMiniprogram.CustomEvent<{ value: string }>): void
  onEditorCancel(): void
  onEditorSubmit(): void

  onCarryTap(e: WechatMiniprogram.BaseEvent<Record<string, never>, { id: string }>): void
  onRetryChoices(): void
  onRunSim(): void
  onResultClose(): void
  noop(): void
}

Page<PageData, PageCustom>({
  data: {
    question: '',
    editing: false,
    draft: '',

    dialSize: DIAL_SIZE,
    horizonIndex: 8,
    horizonLabel: '5年',
    pick: '',
    hot: false,

    presets: SIMULATION_HORIZONS.filter((h) => PRESET_KEYS.includes(h.key)),
    presetKey: 'year5',

    deck: [],
    deckHeight: 342,
    choicesLoading: false,
    choicesEmpty: false,

    showEditor: false,
    customName: '',
    customDesc: '',

    carryCards: CARRY_CARDS.map((c) => ({ ...c, on: false })),
    carryCount: 0,
    carryCardWidth: 240,

    canSim: false,
    loading: false,
    loadStep: '',

    ghostShow: false,
    ghostName: '',
    ghostIcon: '',
    ghostX: 0,
    ghostY: 0,

    resultShow: false,
    result: null,
  },

  model: null,
  dialHit: null,
  dragging: null,
  frontCard: null,
  lastError: null,
  resultShown: false,

  onLoad() {
    this.model = new LabModel((s) => this.onSnapshot(s))
    this.model.loadCustomChoices()
  },

  onReady() {
    this.measureDial()
    this.measureCarry()
  },

  onShow() {
    const tabBar = this.getTabBar?.() as WechatMiniprogram.Component.TrivialInstance | undefined
    tabBar?.setData({ selected: 1 })

    // 带入的问题会顺带触发一次 loadChoices；没带问题才自己拉一次，
    // 否则冷启动会对同一个问题打两次 lab-choices
    const consumed = (() => {
      const before = this.model?.question
      this.consumePendingQuestion()
      return before !== this.model?.question
    })()
    if (!consumed && this.data.deck.length === 0) void this.model?.loadChoices()
  },

  /** 消费对话「去人生实验室」带来的问题（对应 iOS consumePendingQuestion） */
  consumePendingQuestion() {
    const app = getApp<{ globalData: { pendingLabQuestion?: string } }>()
    const q = app.globalData.pendingLabQuestion
    if (!q) return
    app.globalData.pendingLabQuestion = undefined
    this.model?.setQuestion(q)
    void this.model?.loadChoices()
  },

  onSnapshot(s: LabSnapshot) {
    this.setData({
      question: s.question,
      horizonIndex: this.model?.horizonIndex ?? 0,
      horizonLabel: s.horizon.label,
      presetKey: s.horizon.key,
      pick: s.pick ?? '',
      deck: this.buildDeck(s),
      // 张数多了扇形更陡，容器要跟着抬高，否则最外侧两张会被裁掉
      deckHeight: s.choices.length + 1 > 7 ? 373 : 342,
      choicesLoading: s.choicesLoading,
      choicesEmpty: !s.choicesLoading && s.choices.length === 0,
      carryCards: CARRY_CARDS.map((c) => ({ ...c, on: s.carryIds.includes(c.id) })),
      carryCount: s.carryCount,
      canSim: s.canSim,
      loading: s.loading,
      loadStep: s.loadStep,
      resultShow: s.result !== null,
      result: s.result,
    })

    // errorMessage 会一直挂到下一次请求才清；不做边沿判断的话，之后每次
    // emit（选卡、调时长）都会把同一条错误重弹一遍
    if (s.errorMessage && s.errorMessage !== this.lastError) {
      wx.showToast({ title: s.errorMessage, icon: 'none' })
    }
    this.lastError = s.errorMessage

    // 同理：结果页开着时改选底线卡也会 emit，埋点只认「打开」那一次
    if (s.result && !this.resultShown) this.model?.trackResultViewed()
    this.resultShown = s.result !== null
  },

  /**
   * 扇形几何：spread = min(310, max(224, (n-1)*52))，
   * 旋转 norm*16°，抬升 -5 + |norm|^1.35 * 23，选中卡再上浮 9 并放大 1.035。
   * 数值与 iOS 一致，单位从 pt 换成 rpx（×1.923）。
   */
  buildDeck(s: LabSnapshot): DeckCard[] {
    const cards = s.choices
    const total = cards.length + 1 // 末尾那张「写一张自己的卡」
    const spread = Math.min(FAN_MAX_SPREAD, Math.max(FAN_MIN_SPREAD, (total - 1) * FAN_PER_CARD))
    const step = total > 1 ? spread / (total - 1) : 0
    const center = (total - 1) / 2

    const build = (id: string, index: number, on: boolean): Pick<DeckCard, 'x' | 'y' | 'rotate' | 'scale' | 'z'> => {
      const distance = index - center
      const normalized = center > 0 ? distance / center : 0
      const lift = -5 + Math.pow(Math.abs(normalized), FAN_LIFT_POW) * FAN_LIFT
      return {
        x: distance * step * 1.923,
        y: (lift + (on ? -9 : 0)) * 1.923,
        rotate: normalized * FAN_ROTATE,
        scale: on ? 1.035 : 1,
        // 与 iOS deckZ 同序：拖拽中 30 > 最近点过 28 > 已选中 24 > 越靠中间越上
        z:
          this.dragging?.id === id
            ? 30
            : this.frontCard === id
              ? 28
              : on
                ? 24
                : Math.round(20 - Math.abs(distance) * 2),
      }
    }

    const deck: DeckCard[] = cards.map((c, i) => {
      const on = s.pick === c.name
      return {
        id: c.id,
        name: c.name,
        desc: c.desc,
        icon: c.icon,
        // 自定义卡固定用品红档（--accent-2），与 iOS 的 Theme.magenta 同位
        accent: c.isCustom ? 2 : cardAccentIndex(c.color, i),
        isCustom: c.isCustom,
        isCreate: false,
        on,
        ...build(c.id, i, on),
      }
    })

    const createOn = this.data.showEditor && this.frontCard === CREATE_ID
    deck.push({
      id: CREATE_ID,
      name: '自定义选择',
      desc: '写下真正在考虑的那条路',
      icon: 'custom',
      accent: 2,
      isCustom: false,
      isCreate: true,
      on: createOn,
      ...build(CREATE_ID, total - 1, createOn),
    })
    return deck
  },

  /** 转盘外接圆：拖拽命中用。iOS 的判定半径是 width/2 + 30pt */
  measureDial() {
    wx.createSelectorQuery()
      .in(this)
      .select('.dial-area')
      .boundingClientRect((rect) => {
        if (!rect) return
        this.dialHit = {
          cx: rect.left + rect.width / 2,
          cy: rect.top + rect.height / 2,
          r: rect.width / 2 + 30,
        }
      })
      .exec()
  },

  /**
   * 底线卡横排恰好露出 2.5 张：卡宽 = (可视宽 - 2 个间距) / 2.5。
   * 末尾那半张就是「还能往右滑」的提示，比加一个箭头更省地方。
   *
   * 量的是 `.carry`（内容安全区宽）而不是横滑容器 —— 后者做了左右各 42rpx 的
   * 出血，宽度是整屏，按它算会让卡片一律偏宽、末尾那半张露不出来。
   */
  measureCarry() {
    wx.createSelectorQuery()
      .in(this)
      .select('.carry')
      .boundingClientRect((rect) => {
        if (!rect) return
        const px2rpx = 750 / wx.getWindowInfo().windowWidth
        const spacing = 17 // 9pt
        const width = (rect.width * px2rpx - spacing * 2) / 2.5
        this.setData({ carryCardWidth: Math.round(width) })
      })
      .exec()
  },

  // ── 问题 ──

  onEditQuestion() {
    this.setData({ editing: true, draft: this.data.question })
  },

  onDraftInput(e) {
    this.setData({ draft: e.detail.value })
  },

  onDraftCancel() {
    this.setData({ editing: false })
  },

  onDraftSave() {
    const draft = this.data.draft.trim()
    this.setData({ editing: false })
    if (!draft || draft === this.data.question) return
    this.model?.setQuestion(draft)
    // 问题变了，选择卡整批作废，重新生成
    void this.model?.loadChoices()
  },

  // ── 时长 ──

  onDialChange(e) {
    this.model?.setHorizonIndex(e.detail.index)
  },

  onPresetTap(e) {
    this.model?.setHorizon(e.currentTarget.dataset.key)
  },

  // ── 选择卡 ──

  onCardTap(e) {
    const id = e.currentTarget.dataset.id
    this.frontCard = id

    if (id === CREATE_ID) {
      // 那张卡还没写完，旧的选择不该继续留着（iOS 同步 clearChoice）
      this.setData({ showEditor: true })
      this.model?.clearPick()
      this.model?.emit()
      return
    }

    const card = this.data.deck.find((c) => c.id === id)
    if (!card) return
    this.setData({ showEditor: false })
    const message = this.model?.togglePick(card.name)
    if (message) wx.showToast({ title: message, icon: 'none' })
  },

  /** 长按删除自定义卡（iOS 是 contextMenu） */
  onCardLongPress(e) {
    const id = e.currentTarget.dataset.id
    const card = this.data.deck.find((c) => c.id === id)
    if (!card?.isCustom) return
    wx.showModal({
      title: '删除这张卡',
      content: `「${card.name}」会从牌堆里移除。`,
      confirmText: '删除',
      confirmColor: '#ff7a4d',
      success: (res) => {
        if (res.confirm) this.model?.removeCustomChoice(card.name)
      },
    })
  },

  // ── 拖卡进转盘 ──

  onCardTouchStart(e) {
    const id = e.currentTarget.dataset.id
    if (id === CREATE_ID) return
    const card = this.model?.choices.find((c) => c.id === id)
    if (!card) return
    this.dragging = card
    const touch = e.touches[0]
    if (touch) this.setData({ ghostX: touch.clientX, ghostY: touch.clientY })
  },

  onCardTouchMove(e) {
    const card = this.dragging
    const touch = e.touches[0]
    if (!card || !touch) return

    // 浮标要等手指真的走起来才出现，否则点选也会闪一下
    const hit = this.dialHit
    const over = hit
      ? Math.hypot(touch.clientX - hit.cx, touch.clientY - hit.cy) < hit.r
      : false
    this.setData({
      ghostShow: true,
      ghostName: card.name,
      ghostIcon: card.icon,
      ghostX: touch.clientX,
      ghostY: touch.clientY,
      hot: over,
    })
  },

  onCardTouchEnd(e) {
    const card = this.dragging
    this.dragging = null
    const wasShown = this.data.ghostShow
    this.setData({ ghostShow: false, hot: false })
    if (!card || !wasShown) return

    const touch = e.changedTouches[0]
    const hit = this.dialHit
    if (!touch || !hit) return
    if (Math.hypot(touch.clientX - hit.cx, touch.clientY - hit.cy) >= hit.r) return

    this.frontCard = card.id
    this.setData({ showEditor: false })
    const message = this.model?.dropOnDial(card.name)
    if (message) wx.showToast({ title: message, icon: 'none' })
  },

  // ── 自定义卡编辑器 ──

  onNameInput(e) {
    this.setData({ customName: e.detail.value })
  },

  onDescInput(e) {
    this.setData({ customDesc: e.detail.value })
  },

  onEditorCancel() {
    if (this.frontCard === CREATE_ID) this.frontCard = null
    this.setData({ showEditor: false, customName: '', customDesc: '' })
    this.model?.emit()
  },

  onEditorSubmit() {
    const result = this.model?.addCustomChoice(this.data.customName, this.data.customDesc)
    if (!result) return
    wx.showToast({ title: result.message, icon: 'none' })
    if (!result.ok) return
    // 新卡进牌堆后自动置顶，和 iOS 一样让人看清刚写的是哪张
    this.frontCard = `custom_${this.data.customName.trim().slice(0, 18)}`
    this.setData({ showEditor: false, customName: '', customDesc: '' })
  },

  // ── 底线卡与推演 ──

  onCarryTap(e) {
    const message = this.model?.toggleCarry(e.currentTarget.dataset.id)
    if (message) wx.showToast({ title: message, icon: 'none' })
  },

  onRetryChoices() {
    void this.model?.loadChoices()
  },

  onRunSim() {
    void this.model?.runSim()
  },

  onResultClose() {
    this.model?.closeResult()
  },

  /** 浮层吞掉滚动，别让底下的页面跟着动 */
  noop() {},
})
