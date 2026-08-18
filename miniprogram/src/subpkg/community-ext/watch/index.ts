/**
 * 放映模式 —— 对应 iOS `Features/Community/WatchModeView.swift`。
 *
 * iOS 那边它是社区页里的一个视图状态（`@AppStorage("possibility-watch")`），
 * 小程序里独立成分包页：冷启动就 navigateTo 会打乱 tabBar 选中态和返回栈，
 * 还得先等分包下载。所以「卡片 / 放映」在这里是两个页面之间的往返，
 * 顶栏那枚「卡片」胶囊 = 返回。
 *
 * 两个模式共用一个搜索词：去程写在 URL 的 `q` 上，改动后回程用 eventChannel
 * 的 `queryChange` 送回列表页（列表页在 navigateTo 的 events 里已经接好）。
 * 不用 getApp() 挂全局：这条状态只有这两页在意。
 *
 * 视野里的一切都由 `field.ts` 画在一张 canvas 上（原因见那个文件的文件头），
 * 本文件只负责：拿数据、接手势、把点击换成跳转、以及页面进出时开关帧循环。
 */

import { loadTravelers } from '../../../core/net/api'
import { DEMO_TRAVELERS, type Traveler } from '../../../core/models'
import { WatchField } from './field'

interface PageData {
  query: string
  /** canvas 撑满剩余空间，尺寸得先量出来才能建 field */
  ready: boolean
}

interface PageCustom {
  field: WatchField | null
  /** 拖动过就不算点击：touchend 时用它决定要不要 hitTest */
  dragged: boolean

  initCanvas(): void
  onQueryInput(e: WechatMiniprogram.CustomEvent<{ value: string }>): void
  onQueryClear(): void
  onTouchStart(e: WechatMiniprogram.TouchCanvas): void
  onTouchMove(e: WechatMiniprogram.TouchCanvas): void
  onTouchEnd(e: WechatMiniprogram.TouchCanvas): void
  onBack(): void
}

Page<PageData, PageCustom>({
  data: {
    query: '',
    ready: false,
  },

  field: null,
  dragged: false,

  onLoad(query) {
    // 列表页把当前搜索词带过来，两边看到的是同一片人
    const q = query.q ? decodeURIComponent(query.q) : ''
    this.setData({ query: q })
    this.initCanvas()
  },

  /**
   * 建画布。尺寸靠 selectorQuery 量（同 orb 组件），旅人先用本地兜底那批，
   * 远端回来再换池子 —— 这一页是分享/冷启动可直达的，不能等网络才有东西看。
   */
  initCanvas() {
    wx.createSelectorQuery()
      .in(this)
      .select('#watch-canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const item = res[0] as { node: WechatMiniprogram.Canvas; width: number; height: number }
        if (!item?.node) return
        const canvas = item.node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getWindowInfo().pixelRatio
        canvas.width = item.width * dpr
        canvas.height = item.height * dpr
        ctx.scale(dpr, dpr)

        this.field = new WatchField(canvas, ctx, dpr, item.width, item.height, DEMO_TRAVELERS)
        this.setData({ ready: true })
        if (this.data.query) this.field.setQuery(this.data.query)
        this.field.wake()

        loadTravelers()
          .then((rows: Traveler[]) => {
            if (rows.length > 0) this.field?.setTravelers(rows)
          })
          .catch(() => {
            /* 拉不到就一直用兜底那批，页面照常能滑（通用约束：不让页面白屏） */
          })
      })
  },

  // 分包页可能被下一层（旅人主页）盖住，那时候没必要继续烧帧
  onHide() {
    this.field?.stop()
  },

  onShow() {
    this.field?.wake()
  },

  onUnload() {
    this.field?.stop()
  },

  // ── 搜索 ──

  onQueryInput(e) {
    const value = e.detail.value
    this.setData({ query: value })
    this.field?.setQuery(value)
    // 回程同步：返回列表页时它已经筛好了，不用再搜一次
    this.getOpenerEventChannel?.()?.emit?.('queryChange', value)
  },

  onQueryClear() {
    this.setData({ query: '' })
    this.field?.setQuery('')
    this.getOpenerEventChannel?.()?.emit?.('queryChange', '')
  },

  // ── 手势 ──
  //
  // 用 touch 事件而不是 bindtap：拖动与点击落在同一块 canvas 上，
  // tap 会在每次拖完也触发一次。由 field.dragEnd() 判定这一下是拖还是点。

  onTouchStart(e) {
    const touch = e.touches[0]
    if (!touch) return
    this.dragged = false
    this.field?.dragStart(touch.x, touch.y)
  },

  onTouchMove(e) {
    const touch = e.touches[0]
    if (!touch) return
    this.field?.dragMove(touch.x, touch.y)
  },

  onTouchEnd(e) {
    this.dragged = this.field?.dragEnd() ?? false
    if (this.dragged) return
    const touch = e.changedTouches[0]
    if (!touch) return
    const traveler = this.field?.hitTest(touch.x, touch.y)
    if (traveler) wx.navigateTo({ url: `/subpkg/profile/index/index?id=${traveler.id}` })
  },

  onBack() {
    wx.navigateBack()
  },
})
