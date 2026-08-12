/**
 * 自定义 tabBar —— 对应 iOS `App/PossibilityApp.swift` 的 `AppTab`（home / lab / community / me）。
 *
 * 用自定义而非原生 tabBar 的原因有两个：
 * 1. 设计基准是深色 + 极光渐变选中态，原生 tabBar 只能配纯色和图片；
 * 2. Skyline 下原生 tabBar 的表现与 WebView 有差异，自定义件两种渲染器下一致。
 */

interface TabItem {
  key: string
  path: string
  text: string
}

const TABS: TabItem[] = [
  { key: 'home', path: '/pages/home/index', text: '认识自己' },
  { key: 'lab', path: '/pages/lab/index', text: '实验室' },
  { key: 'community', path: '/pages/community/index', text: '万花筒' },
  { key: 'me', path: '/pages/me/index', text: '我的' },
]

Component({
  data: {
    selected: 0,
    tabs: TABS,
  },

  methods: {
    onTap(e: WechatMiniprogram.TouchEvent) {
      const index = Number(e.currentTarget.dataset.index)
      const tab = TABS[index]
      if (!tab || index === this.data.selected) return
      wx.switchTab({ url: tab.path })
    },
  },
})
