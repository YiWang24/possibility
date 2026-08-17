/**
 * 下一步面板 —— 对应 iOS `Features/Chat/ChatSummaryView.swift` 的 `ChatNextPanel`。
 *
 * 「信息已经足够 · 选择下一步」：去人生实验室 / 看走过这条路的人（/match 命中时固定
 * 两张方形旅人卡）/ 分享这次探索，外加可选的「先查看完整总结 →」。
 *
 * 对话页与总结页共用同一个面板，所以做成组件而不是各写一份 —— iOS 那边也是同一个
 * `ChatNextPanel` 被两处调用，行为分叉就会让两个页面推荐不同的下一步。
 *
 * 与 iOS 唯一的差异在分享：iOS 是 `ShareLink` 唤起系统分享面板，小程序没有等价能力，
 * 只能用原生 `<button open-type="share">` 转发给微信好友/群。这属于平台惯例差异，
 * 页面需要实现 `onShareAppMessage` 才能收到（见 index.ts）。
 */

import type { Traveler } from '../../../../core/models'

/** 旅人卡的渲染态：把 matchReasons 的动态取值提前拍平，WXML 里不做逻辑 */
interface TravelerCard {
  id: number
  name: string
  initial: string
  hue: number
  /** 推荐理由，缺失时退回旅人自己的一句话 */
  reason: string
  tag: string
  /** id < 0 是本地生成的模拟路径卡，点击去社区而不是进主页 */
  synthetic: boolean
}

Component({
  properties: {
    showSummaryLink: { type: Boolean, value: false },
    /** AI 收尾时只推荐一个路径；'' 兼容旧会话，继续展示完整选择面板 */
    preferredPath: { type: String, value: '' },
    matchedTravelers: { type: Array, value: [] as Traveler[] },
    /** traveler_id → 推荐理由 */
    matchReasons: { type: Object, value: {} as Record<number, string> },
    shareText: { type: String, value: '' },
  },

  options: { addGlobalClass: true },

  data: {
    cards: [] as TravelerCard[],
    eyebrow: '信息已经足够 · 选择下一步',
    title: '把刚才的理解带去哪里？',
  },

  observers: {
    'matchedTravelers, matchReasons'(travelers: Traveler[], reasons: Record<number, string>) {
      const cards: TravelerCard[] = (travelers ?? []).slice(0, 2).map((t) => ({
        id: t.id,
        name: t.name,
        initial: t.initial,
        hue: t.hue,
        reason: reasons?.[t.id] ?? t.quote,
        tag: t.tags[0] ?? '',
        synthetic: t.id < 0,
      }))
      this.setData({ cards })
    },

    preferredPath(path: string) {
      this.setData({
        eyebrow: path ? '这轮探索先到这里 · 为你推荐' : '信息已经足够 · 选择下一步',
        title:
          path === 'match'
            ? '看看走过相似处境的人'
            : path === 'lab'
              ? '把现在的判断放进现实里推演'
              : '把刚才的理解带去哪里？',
      })
    },
  },

  methods: {
    onGoLab() {
      this.triggerEvent('golab')
    },
    onGoSimilar() {
      this.triggerEvent('gosimilar')
    },
    onOpenSummary() {
      this.triggerEvent('opensummary')
    },
    onTravelerTap(e: WechatMiniprogram.BaseEvent<Record<string, never>, { id: number }>) {
      const { id } = e.currentTarget.dataset
      // 模拟路径卡没有真实主页，落到社区去找相似经历
      if (id < 0) this.triggerEvent('gosimilar')
      else this.triggerEvent('travelertap', { id })
    },
  },
})
