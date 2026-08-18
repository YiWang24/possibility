/**
 * 03 万花筒社区 —— 对应 iOS `Features/Community/CommunityView.swift`。
 *
 * 自上而下：标题 · 为你推荐 / 悬赏贴 · 搜索 · 双列瀑布流 · 右下浮动主按钮。
 *
 * 与 iOS 的平台差异：
 * - iOS 的放映模式是页内状态，还带 `@AppStorage("possibility-watch")` 默认开；
 *   小程序里它是分包页（`subpkg/community-ext/watch/`）。冷启动就 navigateTo 过去
 *   会打乱 tabBar 的选中态和返回栈，还得先等分包下载 —— 所以默认停在卡片模式，
 *   放映由标题栏那枚开关跳过去。两边共用一个搜索词：去程写在 URL 上，
 *   回程由放映页通过 eventChannel 送回来。
 * - 发布悬赏是页内浮层（`compose-sheet`）而不是第四个分包页：iOS 用的就是 `.sheet`，
 *   页内浮层最接近；也不必为一个表单去改 app.json 的页面表。
 * - iOS 在发帖前有 `authGate.require(..., trigger: .bountyPost)`；这里是空操作，
 *   app.ts 冷启动就把未登录的人重定向到登录页，走到这个 tab 的人一定已登录
 *   （同付费墙页的处理，不补发 auth_prompted）。
 *
 * 状态在 `model.ts`，这里只负责铺快照、跳转与浮层。
 */

import { reduceMotion } from '../../core/design/motion'
import { CommunityModel, type BountyCard, type CommunitySnapshot, type TravelerCard } from './model'

interface PageData {
  tabs: string[]
  tab: number
  query: string

  travelerLeft: TravelerCard[]
  travelerRight: TravelerCard[]
  travelerEmpty: boolean
  bountyLeft: BountyCard[]
  bountyRight: BountyCard[]
  /** 详情页要跟着列表走同一套数据源，随 URL 带过去 */
  usesDemoBounties: boolean

  refreshing: boolean
  showCompose: boolean
  composing: boolean
  composeError: string

  /** FAB 上那枚小光球要不要转 */
  reduceMotion: boolean
}

interface PageCustom {
  model: CommunityModel | null
  /** 冷启动那次 onShow 紧跟着 onLoad，别对同一批悬赏打两次请求 */
  didFirstShow: boolean

  onSnapshot(s: CommunitySnapshot): void
  onTabTap(e: WechatMiniprogram.BaseEvent<Record<string, never>, { index: string }>): void
  onQueryInput(e: WechatMiniprogram.CustomEvent<{ value: string }>): void
  onQueryClear(): void
  onWatchTap(): void
  onTravelerTap(e: WechatMiniprogram.BaseEvent<Record<string, never>, { id: string }>): void
  onBountyTap(e: WechatMiniprogram.BaseEvent<Record<string, never>, { id: string }>): void
  onFabTap(): void
  onComposeClose(): void
  onComposeSubmit(
    e: WechatMiniprogram.CustomEvent<{
      question: string
      detail: string
      tagText: string
      reward: string
    }>,
  ): void
  onRefresh(): void
}

Page<PageData, PageCustom>({
  data: {
    tabs: ['为你推荐', '悬赏贴'],
    tab: 0,
    query: '',

    travelerLeft: [],
    travelerRight: [],
    travelerEmpty: false,
    bountyLeft: [],
    bountyRight: [],
    usesDemoBounties: true,

    refreshing: false,
    showCompose: false,
    composing: false,
    composeError: '',

    reduceMotion: false,
  },

  model: null,
  didFirstShow: false,

  onLoad() {
    this.setData({ reduceMotion: reduceMotion() })
    this.model = new CommunityModel((s) => this.onSnapshot(s))
    void this.model.load()
  },

  onShow() {
    const tabBar = this.getTabBar?.() as WechatMiniprogram.Component.TrivialInstance | undefined
    tabBar?.setData({ selected: 2 })

    // Me 页可以中途改「减少动效」，回到这个 tab 要跟着变
    this.setData({ reduceMotion: reduceMotion() })

    // iOS 的 .task 与 .onAppear 都会拉一次悬赏；这里把冷启动那次让给 onLoad
    if (this.didFirstShow) void this.model?.refreshBounties()
    this.didFirstShow = true
  },

  onSnapshot(s) {
    this.setData({
      tab: s.tab,
      query: s.query,
      travelerLeft: s.travelerLeft,
      travelerRight: s.travelerRight,
      travelerEmpty: s.travelerEmpty,
      bountyLeft: s.bountyLeft,
      bountyRight: s.bountyRight,
      usesDemoBounties: s.usesDemoBounties,
    })
  },

  // ── tab 与搜索 ──

  onTabTap(e) {
    this.model?.setTab(Number(e.currentTarget.dataset.index))
  },

  onQueryInput(e) {
    this.model?.setQuery(e.detail.value)
  },

  onQueryClear() {
    this.model?.setQuery('')
  },

  /**
   * 去放映模式。搜索词去程写 URL、回程走 eventChannel —— iOS 那边两种模式共用
   * 同一个 `searchText`，跨页之后得手动把它接起来，不然切一次模式就白搜一次。
   */
  onWatchTap() {
    const query = this.data.query
    wx.navigateTo({
      url: `/subpkg/community-ext/watch/index?q=${encodeURIComponent(query)}`,
      events: {
        queryChange: (value: string) => this.model?.setQuery(value),
      },
    })
  },

  // ── 跳转 ──

  onTravelerTap(e) {
    wx.navigateTo({ url: `/subpkg/profile/index/index?id=${e.currentTarget.dataset.id}` })
  },

  onBountyTap(e) {
    const id = Number(e.currentTarget.dataset.id)
    const demo = this.data.usesDemoBounties ? 1 : 0
    const bounty = this.model?.bountyById(id)
    wx.navigateTo({
      url: `/subpkg/community-ext/bounty/index?id=${id}&demo=${demo}`,
      // 详情页要的是整条帖子（问题 / 标签 / 赏金 / 发布时间），URL 只放得下 id。
      // 官方的跨页传对象方式就是 eventChannel（放映页的 queryChange 是它的反向）。
      // 详情页拿不到这一下也能自己 get_bounty 补，所以这里不做失败处理。
      success: (res) => {
        if (bounty) res.eventChannel.emit('bounty', bounty)
      },
    })
  },

  onFabTap() {
    if (this.data.tab === 0) {
      wx.navigateTo({ url: '/subpkg/community-ext/draw/index' })
      return
    }
    this.setData({ showCompose: true, composeError: '' })
  },

  // ── 发布悬赏 ──

  onComposeClose() {
    if (this.data.composing) return
    this.setData({ showCompose: false })
  },

  onComposeSubmit(e) {
    if (this.data.composing || !this.model) return
    this.setData({ composing: true, composeError: '' })
    void this.model.publish(e.detail).then((res) => {
      this.setData({ composing: false })
      if (!res.ok) {
        this.setData({ composeError: res.message })
        return
      }
      this.setData({ showCompose: false })
      wx.showToast({ title: res.message, icon: 'none' })
    })
  },

  /** 下拉刷新：旅人与悬赏一起重来（iOS 的 .refreshable 只刷悬赏，但这里下拉
      在两个 tab 上都可用，只刷一半会让人觉得没刷到） */
  onRefresh() {
    this.setData({ refreshing: true })
    const done = () => this.setData({ refreshing: false })
    const model = this.model
    if (!model) {
      done()
      return
    }
    void model.load().then(done, done)
  },
})
