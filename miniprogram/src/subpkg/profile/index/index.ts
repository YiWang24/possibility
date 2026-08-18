/**
 * 旅人主页 —— 对应 iOS `Features/Profile/ProfileView.swift`（含 ProfilePanels 的四个面板）。
 *
 * 四个面板都内联在同一份 WXML 里用 `wx:if` 切换，不拆自定义组件：面板之间共享
 * 同一份快照数据，拆开后每个组件都要把整份 detail 传进去，properties 的 diff
 * 反而比现在这一次 setData 更贵。
 *
 * 展开态（openIndex）只在页面这一层，不进 model：它是纯 UI 状态，
 * 重新 load 不该把用户展开的节点收起来。
 *
 * iOS 的 `unlocked` 与 `LockedBlock` 在基准里是**死代码**（前者只写不读，后者定义了
 * 从未实例化），付费字段实际一直是展开的 —— 这里如实照搬「都可见」的行为，
 * 详见 model.ts 顶部说明。
 */

import { ADVICE_KINDS, type AdviceKind } from '../../../core/models'
import {
  PROFILE_TABS,
  ProfileModel,
  SERVICE_STEPS,
  type ProfileSnapshot,
  type ProfileTab,
} from './model'

interface PageData extends ProfileSnapshot {
  tab: ProfileTab
  tabs: typeof PROFILE_TABS
  adviceKind: AdviceKind
  adviceKinds: typeof ADVICE_KINDS
  /** 建议卡的眉标：iOS 用 `.uppercased()`，中文标签大写后不变，直接取 label */
  adviceEyebrow: string
  steps: typeof SERVICE_STEPS
  /** 当前展开的时间线节点；-1 = 全部收起（iOS 默认展开第 0 个） */
  openIndex: number
}

interface PageCustom {
  model: ProfileModel | null
  onBack(): void
  onMore(): void
  onTab(e: WechatMiniprogram.BaseEvent<Record<string, never>, { key: ProfileTab }>): void
  onToggleNode(e: WechatMiniprogram.BaseEvent<Record<string, never>, { index: number }>): void
  onAdviceKind(e: WechatMiniprogram.BaseEvent<Record<string, never>, { kind: AdviceKind }>): void
  onBuyService(e: WechatMiniprogram.BaseEvent<Record<string, never>, { id: string }>): void
  onConsult(): void
  openPaywall(params: string): void
}

Page<PageData, PageCustom>({
  data: {
    loading: true,
    name: '旅人主页',
    initial: '',
    hue: 0,
    tags: [],
    ageCity: '',
    fromRole: '',
    toRole: '',
    yearsResult: '',
    quote: '',
    intro: '',
    facts: [],
    fullText: '',
    nodes: [],
    adviceTitle: '',
    tips: [],
    services: [],
    consultPriceText: '',
    tab: 'story',
    tabs: PROFILE_TABS,
    adviceKind: 'decision',
    adviceKinds: ADVICE_KINDS,
    adviceEyebrow: '转型决策',
    steps: SERVICE_STEPS,
    openIndex: 0,
  },

  model: null,

  onLoad(query) {
    const travelerId = Number(query.id)
    // 主页只从「匹配结果」「对话总结」两处进入，都是带 id 跳的；
    // 没有 id 说明链路断了，退回去比停在一个空壳页面上更清楚
    if (!Number.isFinite(travelerId) || travelerId <= 0) {
      wx.showToast({ title: '旅人信息缺失', icon: 'none' })
      wx.navigateBack()
      return
    }
    this.model = new ProfileModel(travelerId, (s) => this.setData(s as Partial<PageData>))
    void this.model.load()
  },

  onBack() {
    wx.navigateBack()
  },

  onMore() {
    wx.showToast({ title: '更多操作：分享主页 · 举报 · 屏蔽', icon: 'none' })
  },

  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.key })
  },

  onToggleNode(e) {
    const index = e.currentTarget.dataset.index
    const expanding = this.data.openIndex !== index
    this.setData({ openIndex: expanding ? index : -1 })
    // 只在展开时上报，收起不算一次查看（对齐 iOS）
    if (expanding) this.model?.trackExpand(index)
  },

  onAdviceKind(e) {
    const kind = e.currentTarget.dataset.kind
    const label = ADVICE_KINDS.find((k) => k.kind === kind)?.label ?? ''
    this.setData({ adviceKind: kind, adviceEyebrow: label })
    this.model?.setAdviceKind(kind)
  },

  onBuyService(e) {
    const service = this.model?.serviceById(e.currentTarget.dataset.id)
    if (!service) return
    this.openPaywall(`kind=service&serviceId=${encodeURIComponent(service.id)}`)
  },

  onConsult() {
    const consult = this.model?.consultService()
    if (!consult) {
      wx.showToast({ title: '咨询服务加载中', icon: 'none' })
      return
    }
    this.openPaywall(`kind=service&serviceId=${encodeURIComponent(consult.id)}`)
  },

  /**
   * 结账走分包页面而非 sheet 组件：sheet 的用法说明里写了整页级呈现
   * （对话 / 旅人主页 / 付费墙）一律 navigateTo —— 返回手势、物理返回键
   * 与埋点的 dwell 时长都按页面语义走，不用自己模拟。
   */
  openPaywall(params) {
    const id = this.model?.travelerId
    if (id == null) return
    wx.navigateTo({ url: `/subpkg/profile/paywall/index?travelerId=${id}&${params}` })
  },
})
