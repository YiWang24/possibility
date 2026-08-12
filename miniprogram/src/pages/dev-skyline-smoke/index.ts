/**
 * Skyline 冒烟验证（波次 0 · W0-0）
 *
 * 为什么需要这一页：Skyline 为性能砍掉了大量 CSS 特性（`mix-blend-mode` 已确认不支持），
 * 而设计基准 `Theme.swift` 里全是极光渐变、conic 色环、发光与毛玻璃 —— 正是最容易踩
 * Skyline 空白区的一类样式。这一页把有风险的特性并排铺开，跑一次就能得出结论：
 *
 *   全量 Skyline？还是「动画页 Skyline + 其余 WebView」的混合渲染？
 *
 * 用法：开发者工具编译模式选「Skyline 冒烟验证（W0-0）」，或真机扫码进这一页，
 * 逐项对照下面的清单打勾，结论写回 docs/engineering/小程序端开发方案.md §2。
 *
 * ⚠️ 这一页不进生产：sitemap.json 已 disallow，提审前从 app.json 的 pages 里删掉。
 */

interface CheckItem {
  key: string
  label: string
  /** 这个特性在设计系统里被谁用 */
  usedBy: string
}

const CHECKS: CheckItem[] = [
  { key: 'linear', label: 'linear-gradient 极光渐变', usedBy: '按钮 / 卡片色带 / tabBar 选中条' },
  { key: 'conic', label: 'conic-gradient 色环', usedBy: 'OrbView 光球 · KaleidoscopeView 万花筒' },
  { key: 'blur', label: 'backdrop-filter 毛玻璃', usedBy: 'Sheet 蒙层 · 付费墙遮罩' },
  { key: 'shadow', label: 'box-shadow 发光', usedBy: 'kaleidoCard · 光球辉光' },
  { key: 'blend', label: 'mix-blend-mode（已知不支持）', usedBy: '万花筒六瓣折光叠加' },
  { key: 'canvas', label: 'canvas 2d + RAF 动画', usedBy: '万花筒 · 波形 · 转盘的兜底实现' },
  { key: 'transform', label: 'transform 旋转/缩放动画', usedBy: '转盘 DialView · 卡牌翻转' },
]

Page({
  data: {
    renderer: 'unknown' as string,
    libVersion: '' as string,
    checks: CHECKS,
  },

  onLoad() {
    const info = wx.getAppBaseInfo()
    // 页面实例上的 `renderer` 在 Skyline 下为 'skyline'，回落 WebView 时为 'webview'。
    // 老基础库上这个属性不存在，所以取值走可选链而不是直接读。
    const page = this as unknown as { renderer?: string }
    this.setData({
      libVersion: info.SDKVersion,
      renderer: page.renderer ?? 'unknown（基础库过低，未回填）',
    })
  },

  onReady() {
    this.drawCanvas()
  },

  /** canvas 2d：画一圈 conic 近似色环，验证 Skyline 下 canvas 是否可用 */
  drawCanvas() {
    wx.createSelectorQuery()
      .in(this)
      .select('#smoke-canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const item = res[0] as { node?: WechatMiniprogram.Canvas; width: number; height: number }
        const canvas = item?.node
        if (!canvas) {
          console.warn('[W0-0] canvas 节点取不到 —— Skyline 下 canvas 2d 不可用')
          return
        }
        const ctx = canvas.getContext('2d')
        const dpr = wx.getWindowInfo().pixelRatio
        canvas.width = item.width * dpr
        canvas.height = item.height * dpr
        ctx.scale(dpr, dpr)

        const cx = item.width / 2
        const cy = item.height / 2
        const r = Math.min(cx, cy) - 4
        const stops = ['#5e96ff', '#8f7bff', '#e35cc1', '#ff7a4d', '#5e96ff']

        // 用细扇形逼近 conic-gradient，这也是 conic 不被支持时 OrbView 的兜底画法
        const steps = 180
        for (let i = 0; i < steps; i++) {
          const t = i / steps
          const seg = t * (stops.length - 1)
          const from = stops[Math.floor(seg)] ?? '#5e96ff'
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.arc(cx, cy, r, (t * 2 - 0.5) * Math.PI, ((i + 1) / steps * 2 - 0.5) * Math.PI)
          ctx.closePath()
          ctx.fillStyle = from
          ctx.fill()
        }
        console.info('[W0-0] canvas 2d 绘制完成')
      })
  },
})
