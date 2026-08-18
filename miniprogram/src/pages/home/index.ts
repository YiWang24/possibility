/**
 * 01 认识你自己（首页）—— 对应 iOS `Features/Home/HomeView.swift`。
 *
 * 自上而下：问候 · 语音日记 · AI 发问 · 人生卡牌入口 · 动态画像。
 *
 * 与 iOS 的平台差异：
 * - iOS 用 `fullScreenCover` / `sheet` 就地弹出对话、日记、卡牌、测评；小程序没有
 *   这些呈现方式，一律 `wx.navigateTo` 到对应分包页面。只有维度浮层留在本页，
 *   因为它编辑的就是本页画像卡的内容，跳走再回来会打断「选词 → 看画像长出来」。
 * - 录音相关的一切（计时 / 波形 / 转写 / analyze-diary）不在这里：开发方案 §7 把
 *   「录音（mp3）+ 隐私授权 + 波形」整体划给波次 2 · F。首页日记卡只呈现真实状态，
 *   「记录今日」跳进日记模块，不在首页复制一份录音实现。
 *
 * 状态在 `model.ts`，这里只负责把快照铺进 setData 和处理跳转。
 */

import { EXPLORE_TOPICS, type ExploreTopic } from '../../core/models'
import { greetDateLabel } from '../../core/timestamp'
import { reduceMotion } from '../../core/design/motion'
import { HomeModel, type HomeSnapshot } from './model'

/** 尼采《道德的系谱》引文 —— 与 iOS `portraitSection` 逐字一致 */
const QUOTE =
  '我们无可避免跟自己保持陌生，我们不明白自己，我们搞不清楚自己，我们的永恒判词是：“离每个人最远的，就是他自己。”——对于我们自己，我们不是“知者”……'

interface PageData extends HomeSnapshot {
  greetDate: string
  greeting: string
  userName: string
  topics: ExploreTopic[]
  quote: string
  /** 维度浮层 */
  sheetShow: boolean
  sheetDimKey: string
  sheetSelected: string[]
  /** 浮层打开时暂停数字形象动画（对齐 iOS 的 animationPaused） */
  paused: boolean
  /** 关掉熔岩光斑的动画（无障碍设置） */
  still: boolean
}

interface PageCustom {
  model: HomeModel | null
  onSnapshot(s: HomeSnapshot): void
  onQuestionInput(e: WechatMiniprogram.CustomEvent<{ value: string }>): void
  onClearQuestion(): void
  onTopicTap(e: WechatMiniprogram.BaseEvent<Record<string, never>, { index: number }>): void
  onSend(): void
  onOpenDiary(): void
  onRecordToday(): void
  onDayTap(e: WechatMiniprogram.BaseEvent<Record<string, never>, { date: string }>): void
  onOpenCardHub(): void
  onOpenStudio(): void
  onDimTap(e: WechatMiniprogram.BaseEvent<Record<string, never>, { index: number }>): void
  onSheetClose(): void
  onSheetSave(e: WechatMiniprogram.CustomEvent<{ dimension: string; keywords: string[] }>): void
}

Page<PageData, PageCustom>({
  data: {
    greetDate: '',
    // iOS 这句问候是写死的「晚上好」，不随时间变。这里照搬保持三端一致：
    // 要改就三端一起改，不在小程序单方面「顺手修好」，否则截图对不上。
    greeting: '晚上好',
    userName: '老己',
    topics: EXPLORE_TOPICS,
    quote: QUOTE,
    question: '',
    topic: null,
    canSend: false,
    portraitDims: [],
    completed: 0,
    total: 6,
    percent: 0,
    lifeSignatureCards: [],
    persona: {
      seed: 0,
      filled: 0,
      signature: [],
      form: 'crystal',
      hue: 216,
      lobes: 6,
      shapeName: '折光晶灵',
    },
    personaSummary: '',
    week: [],
    hasRecordedToday: false,
    exploredDays: 47,
    sheetShow: false,
    sheetDimKey: '',
    sheetSelected: [],
    paused: false,
    still: false,
  },

  model: null,

  onLoad() {
    this.model = new HomeModel((s) => this.onSnapshot(s))
    this.setData({
      greetDate: greetDateLabel(new Date()),
      userName: this.model.userName,
    })
    void this.model.loadDiaryOverview()
  },

  onShow() {
    // 自定义 tabBar 不会自己知道当前是第几个 tab，每个 tab 页都得自报
    const tabBar = this.getTabBar?.() as WechatMiniprogram.Component.TrivialInstance | undefined
    tabBar?.setData({ selected: 0 })

    // 每次回到首页都重读画像：从测评 / 卡牌结算回来时要立刻看见新长出来的维度
    this.model?.loadPortrait()
    // reduceMotion 是应用内设置（小程序拿不到系统无障碍状态），
    // 用户可能刚在「我的」里改完就回来，所以每次显示都重读一次
    this.setData({ paused: false, still: reduceMotion() })
  },

  onHide() {
    // 页面不可见时停掉数字形象的逐帧绘制，别在后台白烧电
    this.setData({ paused: true })
  },

  onUnload() {
    this.setData({ paused: true })
  },

  onSnapshot(s: HomeSnapshot) {
    this.setData(s as Partial<PageData>)
  },

  // ── 探索发问 ──

  onQuestionInput(e) {
    this.model?.setQuestion(e.detail.value)
  },

  onClearQuestion() {
    this.model?.clearQuestion()
  },

  onTopicTap(e) {
    const t = EXPLORE_TOPICS[e.currentTarget.dataset.index]
    if (!t) return
    this.model?.selectTopic(t.topic, t.sampleQuestion)
  },

  onSend() {
    const model = this.model
    if (!model?.canSend) return
    const topic = model.topic ? `&topic=${encodeURIComponent(model.topic)}` : ''
    wx.navigateTo({
      url: `/subpkg/chat/index/index?entry=home&question=${encodeURIComponent(model.trimmedQuestion)}${topic}`,
    })
  },

  // ── 语音日记 ──

  onOpenDiary() {
    wx.navigateTo({ url: '/subpkg/diary/day/index' })
  },

  /** 「记录今日」：录音在波次 2 · F 的日记模块里，这里只负责把人送过去 */
  onRecordToday() {
    wx.navigateTo({ url: '/subpkg/diary/day/index?record=1' })
  },

  onDayTap(e) {
    wx.navigateTo({ url: `/subpkg/diary/day/index?date=${e.currentTarget.dataset.date}` })
  },

  // ── 人生卡牌 / 画像工作室 ──

  onOpenCardHub() {
    wx.navigateTo({ url: '/subpkg/card-game/hub/index' })
  },

  onOpenStudio() {
    wx.navigateTo({ url: '/subpkg/studio/index/index' })
  },

  // ── 动态画像 ──

  onDimTap(e) {
    const dim = this.data.portraitDims[e.currentTarget.dataset.index]
    if (!dim) return
    // 人格底色没有关键词可选，直接进大五人格测评（对齐 iOS `handleDimTap`）
    if (!dim.dimensionKey) {
      wx.navigateTo({ url: '/subpkg/studio/assessment/index?kind=bigfive&dim=personality' })
      return
    }
    this.setData({
      sheetShow: true,
      sheetDimKey: dim.dimensionKey,
      sheetSelected: this.model?.selectedKeywords(dim.dimensionKey) ?? [],
      paused: true,
    })
  },

  onSheetClose() {
    this.setData({ sheetShow: false, paused: false })
  },

  onSheetSave(e) {
    const { dimension, keywords } = e.detail
    this.model?.saveDimensionKeywords(dimension, keywords)
    this.setData({ sheetShow: false, paused: false })
    wx.showToast({ title: '已保存到你的画像', icon: 'none' })
  },
})
