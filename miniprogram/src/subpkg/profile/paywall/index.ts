/**
 * 结账页 —— 对应 iOS `Features/Profile/PaywallView.swift`（§10 demo mock 支付）。
 *
 * 与 iOS 的三点差异，都是平台惯例而非行为改动：
 *
 * 1. iOS 是 `.sheet` 弹层，这里是分包页面。sheet 组件的用法说明写了整页级呈现
 *    （对话 / 旅人主页 / 付费墙）一律 navigateTo —— 返回手势、物理返回键、
 *    dwell 时长都按页面语义走，不用自己模拟。因此 iOS 的 `checkout` 绑定在这里
 *    换成 query 参数（kind / travelerId / serviceId），页面自己重新取一遍商品。
 * 2. iOS 在支付前用 `AuthGateCenter` 就地弹登录；小程序在 app.ts 启动时就把未登录的人
 *    重定向到登录页，到这一步必然已登录。所以**不发 `auth_prompted`** ——
 *    这里没有登录门控可言，补一条只会让认证漏斗多出无对应弹窗的噪声。
 * 3. iOS 关闭有三条路（× / 下滑 / 成功后「好的」），用 `onDisappear` 收口；
 *    小程序对应 `onUnload`，同样是三条路（× / 系统返回 / 「好的」）唯一都覆盖到的地方。
 *
 * 「无论写库成败都进成功态」是 iOS demo 的既有行为，照搬 —— 埋点如实分成
 * purchase_completed / purchase_failed，界面不因此变化。
 *
 * `kind=unlock` 分支在 iOS 里目前没有入口（`checkout = .unlock` 从未被赋值），
 * 但它是付费墙自身的契约，也是 `unlockProfile` 唯一的意义所在，照搬不砍。
 */

import { track, type AnalyticsSKU } from '../../../core/analytics'
import { loadTravelerServices, loadTravelers, unlockProfile } from '../../../core/net/api'
import {
  ADVICE_KINDS,
  adviceTips,
  DEMO_TRAVELER_DETAILS,
  DEMO_TRAVELERS,
  demoServices,
  PRICE_UNLOCK_PROFILE,
  type Traveler,
  type TravelerServiceItem,
} from '../../../core/models'
import { priceText } from '../index/model'

const PAY_NOTE = '演示环境：点击即模拟完成，不产生真实扣款。正式版将通过微信支付安全支付。'

/** demo 下单的模拟耗时（iOS `Task.sleep(600ms)`）：没有真实支付，也不能点完就跳成功 */
const MOCK_ORDER_MS = 600

interface PageData {
  /** 商品是否已确定 —— 未确定前不渲染金额，见 render() */
  ready: boolean
  headTitle: string
  itemTitle: string
  itemSub: string
  priceText: string
  actionTitle: string
  payNote: string
  processing: boolean
  succeeded: boolean
  successTitle: string
  successSub: string
}

interface PageCustom {
  /** unlock：解锁完整经验 ¥9.9；service：咨询 / 资料包 / 陪跑 */
  kind: 'unlock' | 'service'
  travelerId: number
  serviceId: string
  service: TravelerServiceItem | null
  traveler: Traveler | null
  /** 付费墙出现的时刻 —— 未支付离开时算 dwell_ms（付费漏斗流失分析） */
  viewedAt: number
  sku: AnalyticsSKU | null
  /** 订单金额的单一来源：展示与埋点共用，避免「界面价」「上报价」两套口径 */
  price: number

  refresh(): Promise<void>
  onClose(): void
  onPay(): void
  confirmPay(): Promise<void>
  trackViewed(): void
  trackDismissedIfUnpaid(): void
  trackPurchaseResult(ok: boolean, failureReason?: string): void
  trackUnlockedCount(): void
  render(): void
  resolveSKU(): AnalyticsSKU | null
}

Page<PageData, PageCustom>({
  data: {
    ready: false,
    headTitle: '确认订单',
    itemTitle: '',
    itemSub: '',
    priceText: '',
    actionTitle: '确认购买',
    payNote: PAY_NOTE,
    processing: false,
    succeeded: false,
    successTitle: '购买成功',
    successSub: '',
  },

  kind: 'service',
  travelerId: 0,
  serviceId: '',
  service: null,
  traveler: null,
  viewedAt: 0,
  sku: null,
  price: 0,

  onLoad(query) {
    const travelerId = Number(query.travelerId)
    if (!Number.isFinite(travelerId) || travelerId <= 0) {
      wx.showToast({ title: '订单信息缺失', icon: 'none' })
      wx.navigateBack()
      return
    }
    this.travelerId = travelerId
    this.kind = query.kind === 'unlock' ? 'unlock' : 'service'
    this.serviceId = query.serviceId ?? ''

    // 先拿兜底数据试一次：后端挂了也能照常下单（服务 id 形如 `consult-3`，
    // 与 demoServices 一致时必然命中）。命中不了就等 refresh —— **不能**先渲染 ¥0，
    // 结账页的金额在用户眼皮底下跳一次，比多等半秒严重得多。
    this.traveler = DEMO_TRAVELERS.find((t) => t.id === travelerId) ?? null
    this.service = demoServices(travelerId).find((s) => s.id === this.serviceId) ?? null
    this.render()

    void this.refresh()
  },

  /** 三条关闭路径（× / 系统返回 / 成功后「好的」）唯一都会经过的地方 */
  onUnload() {
    this.trackDismissedIfUnpaid()
  },

  async refresh() {
    const travelerId = this.travelerId
    if (travelerId <= 0) return
    const [travelers, services] = await Promise.all([
      loadTravelers().catch(() => [] as Traveler[]),
      loadTravelerServices(travelerId).catch(() => [] as TravelerServiceItem[]),
    ])
    const fresh = travelers.find((t) => t.id === travelerId)
    if (fresh) this.traveler = fresh
    const service = services.find((s) => s.id === this.serviceId)
    if (service) this.service = service
    this.render()

    // 兜底与真实数据都找不到这件商品：多半是旅人主页的列表已经变了。
    // 停在光球上转圈只会让人以为网卡了，直接退回去说清楚。
    if (this.kind === 'service' && !this.service) {
      wx.showToast({ title: '该服务已下架', icon: 'none' })
      wx.navigateBack()
    }
  },

  onClose() {
    wx.navigateBack()
  },

  onPay() {
    if (this.data.processing) return
    // 打在点击处而非支付结果处：这一步记录的是付费意图
    if (this.sku) track('purchase_started', { sku: this.sku, price: this.price })
    this.setData({ processing: true })
    void this.confirmPay()
  },

  async confirmPay() {
    if (this.kind === 'unlock') {
      let ok = true
      try {
        await unlockProfile(this.travelerId)
      } catch {
        ok = false
      }
      this.trackPurchaseResult(ok, 'unlock_write_failed')
      // 打在写库成功处：此刻付费经验才真的可见
      if (ok) this.trackUnlockedCount()
    } else {
      await new Promise((resolve) => setTimeout(resolve, MOCK_ORDER_MS))
      this.trackPurchaseResult(true)
    }
    this.setData({ processing: false, succeeded: true })
  },

  /* ── 埋点（付费漏斗北极星 · docs/engineering/埋点方案.md §3.1）── */

  trackViewed() {
    if (!this.sku) return
    track('paywall_viewed', {
      sku: this.sku,
      price: this.price,
      // 付费墙目前只从旅人主页进入；context 记录入口界面，商品由 sku 表达
      context: 'profile',
    })
  },

  /** 只有「没付款就离开」才算流失；成功态的关闭由 purchase_completed 承接 */
  trackDismissedIfUnpaid() {
    if (this.data.succeeded || !this.sku || this.viewedAt === 0) return
    track('paywall_dismissed', { sku: this.sku, dwell_ms: Date.now() - this.viewedAt })
  },

  trackPurchaseResult(ok, failureReason = '') {
    if (!this.sku) return
    if (ok) {
      track('purchase_completed', { sku: this.sku, price: this.price, currency: 'CNY' })
    } else {
      track('purchase_failed', { sku: this.sku, reason: failureReason })
    }
  },

  /** 解锁后可见的经验条数（三类建议合计）—— 只报条数，正文绝不进属性 */
  trackUnlockedCount() {
    const advice = DEMO_TRAVELER_DETAILS[this.travelerId]?.advice
    const count = advice
      ? ADVICE_KINDS.reduce((sum, k) => sum + adviceTips(advice, k.kind).length, 0)
      : 0
    track('experiences_unlocked', { count })
  },

  /**
   * 文案与金额一处算齐。iOS 把它们拆成十来个 computed property，
   * WXML 不能调函数，所以在这里一次算完塞进 data。
   */
  render() {
    const unlock = this.kind === 'unlock'
    const s = this.service
    const isConsult = s?.kind === 'consult'
    const price = unlock ? PRICE_UNLOCK_PROFILE : (s?.price ?? 0)
    const text = priceText(price)
    this.price = price
    this.sku = this.resolveSKU()

    // unlock 的价钱是常量，永远算已确定；service 要等真的拿到那件商品
    const ready = unlock || s !== null

    this.setData({
      ready,
      headTitle: unlock ? '解锁完整经验' : isConsult ? '预约咨询' : '确认订单',
      itemTitle: unlock ? `${this.traveler?.name ?? 'TA'} · 完整转型经验` : (s?.title ?? ''),
      itemSub: unlock ? '完整故事 + 全部踩坑建议 + 完整轨迹' : (s?.description ?? ''),
      priceText: text,
      actionTitle: unlock
        ? `确认解锁 · ¥${text}`
        : isConsult
          ? `确认预约 · ¥${text}`
          : `确认购买 · ¥${text}`,
      successTitle: unlock ? '已解锁完整经验' : isConsult ? '预约成功' : '购买成功',
      successSub: unlock
        ? '完整故事、踩坑建议与轨迹已全部展开，回到主页查看。'
        : 'TA 会尽快与你确认。可在消息中追问具体细节。',
    })

    // 「看到付费墙」记在商品确定的这一刻，而不是页面打开的那一刻：
    // 价格未知时上报会把 ¥0 写进付费漏斗，而漏斗正是这个页面存在的理由。
    // viewedAt 同时是 dwell 起点与「已上报」哨兵，所以只赋一次。
    if (ready && this.viewedAt === 0) {
      this.viewedAt = Date.now()
      this.trackViewed()
    }
  },

  /**
   * 本次结账对应的 SKU。资料包（materials）在事件清单里没有登记的 sku，
   * 宁可不上报也不错报到别的商品上 —— 少一条事件可补，脏数据会污染转化率。
   */
  resolveSKU() {
    if (this.kind === 'unlock') return 'unlock_profile'
    if (this.service?.kind === 'consult') return 'consult'
    if (this.service?.kind === 'companion') return 'companion'
    return null
  },
})
