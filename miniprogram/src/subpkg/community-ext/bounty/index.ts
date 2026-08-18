/**
 * 悬赏详情 —— 对应 iOS `Features/Community/BountyDetailView.swift`。
 *
 * 自上而下：标签 · 问题 · 发布者 · 悬赏卡 · 具体情况 · 亲历者回应 · 已发送提示，
 * 底部一条动作栏，名片弹层挂在页面尾部（iOS 是 `.sheet` + medium detent）。
 *
 * 状态都在 `model.ts`；这里只铺快照、开合弹层、发一次名片。
 * 权限：回应悬赏在 iOS 上要过 AuthGate，小程序的未登录用户在冷启动就被
 * `app.ts` 重定向到登录页，进不到这里，所以不再重复拦一次（同付费墙页）。
 */

import type { Bounty } from '../../../core/models'
import { ANON_CARD, BountyModel, type BountySnapshot, type MyCard } from './model'

interface PageData extends BountySnapshot {
  showCard: boolean
  /** 名片还在读（本地缓存没有、正在拉 /get-profile） */
  cardLoading: boolean
  card: MyCard
  message: string
  sending: boolean
}

interface PageCustom {
  model: BountyModel | null
  onSnapshot(s: BountySnapshot): void
  onBack(): void
  onRetry(): void
  onSendTap(): void
  onCardClose(): void
  onMessageInput(e: WechatMiniprogram.CustomEvent<{ value: string }>): void
  onConfirmSend(): void
}

Page<PageData, PageCustom>({
  data: {
    loading: true,
    failed: false,
    statusText: '征集中',
    responseCountText: '回应加载中',
    tags: [],
    question: '',
    detail: '',
    publisherName: '匿名旅人',
    publisherInitial: '匿',
    publisherMeta: '已发布',
    publisherHue: 0,
    prizeText: '',
    prizeBig: false,
    replies: [],
    repliesState: 'loading',
    sent: false,

    showCard: false,
    cardLoading: true,
    card: ANON_CARD,
    message: '',
    sending: false,
  },

  model: null,

  onLoad(query) {
    const id = Number(query.id)
    if (!Number.isInteger(id) || id <= 0) {
      this.setData({ loading: false, failed: true })
      return
    }
    this.model = new BountyModel(id, query.demo === '1', (s) => this.onSnapshot(s))

    // 列表页在 navigateTo 的 success 里 emit；那一下发生在本页 onLoad 之后，
    // eventChannel 会把先到的事件排队，所以这里注册不会漏
    this.getOpenerEventChannel?.()?.on?.('bounty', (bounty: Bounty) => {
      this.model?.setBounty(bounty)
    })

    void this.model.load()
  },

  onSnapshot(s) {
    this.setData({ ...s })
  },

  onBack() {
    wx.navigateBack()
  },

  onRetry() {
    void this.model?.retry()
  },

  // ── 名片 ──

  onSendTap() {
    // 已发送的按钮是不可点的（iOS `.disabled(sent)`），这里同样直接返回
    if (this.data.sent || !this.model) return
    this.setData({ showCard: true, cardLoading: true })
    void this.model.loadCard().then((card) => this.setData({ card, cardLoading: false }))
  },

  onCardClose() {
    if (this.data.sending) return
    this.setData({ showCard: false })
  },

  onMessageInput(e) {
    this.setData({ message: e.detail.value })
  },

  onConfirmSend() {
    const model = this.model
    if (!model || this.data.sending) return

    const payload = model.payloadFor(this.data.message)
    // 画像没填、补充说明也空着：留在弹层里让人补一句，别发一条空名片出去
    if (!payload) {
      wx.showToast({ title: '先补充一句话，让发帖人知道你为什么能回答', icon: 'none' })
      return
    }

    this.setData({ sending: true })
    void model.send(payload).then((res) => {
      // 成功与失败都收起弹层（同 iOS）：失败后动作栏还在，可以再来一次
      this.setData({ sending: false, showCard: false })
      wx.showToast({ title: res.message, icon: 'none' })
    })
  },
})
