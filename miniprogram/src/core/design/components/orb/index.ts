/**
 * 万花筒光球 · 熔岩灯（签名元素）—— 对应 iOS `Core/DesignSystem/OrbView.swift`。
 *
 * 原型 `.orb` 熔岩灯版：深蓝「灯瓶」内四团彩色蜡团（蓝 → 品红）以不同周期的利萨如
 * 轨迹游走、胀缩，相遇时颜色融合发光；外圈 6s 呼吸光晕。
 *
 * 为什么用 canvas 2d 而不是 WXSS：
 * iOS 靠 SwiftUI 的 metaball（阈值场 + softness）做蜡团融合，WXSS 没有等价能力
 * （`mix-blend-mode` 在 Skyline 下已确认不支持，radial-gradient 叠加也做不出融合）。
 * canvas 的 `globalCompositeOperation='lighter'` + 软边径向渐变能得到很接近的融合观感，
 * 且两种渲染器下表现一致。真正的逐像素阈值场太贵，这里用加色融合近似。
 *
 * 蜡团参数（baseX/baseY/ampX/ampY/periodX/periodY/phase/radius）与 OrbView.swift
 * 的 `LavaBlobSpec` 逐项一致 —— 改动要两边一起改，否则四端的签名元素会长得不一样。
 */

import { reduceMotion } from '../../motion'

interface BlobSpec {
  baseX: number
  baseY: number
  ampX: number
  ampY: number
  periodX: number
  periodY: number
  phase: number
  radius: number
}

/** 与 OrbView.swift 的 specs 数组逐项对齐 */
const BLOBS: BlobSpec[] = [
  { baseX: 0.38, baseY: 0.32, ampX: 0.12, ampY: 0.26, periodX: 9, periodY: 13, phase: 0.8, radius: 0.24 },
  { baseX: 0.66, baseY: 0.66, ampX: 0.14, ampY: 0.24, periodX: 11, periodY: 8, phase: 2.4, radius: 0.21 },
  { baseX: 0.30, baseY: 0.74, ampX: 0.10, ampY: 0.22, periodX: 7, periodY: 15, phase: 4.2, radius: 0.16 },
  { baseX: 0.68, baseY: 0.26, ampX: 0.12, ampY: 0.20, periodX: 13, periodY: 10, phase: 5.5, radius: 0.13 },
]

/** 蜡团配色：顶蓝 → 底品红（OrbView 的 color1 / color2） */
const BLOB_TOP = { r: 0x6f, g: 0xa5, b: 0xff }
const BLOB_BOTTOM = { r: 0xf0, g: 0x6a, b: 0xcd }

/** 呼吸波（0..1），与 OrbView.wave 同式 */
function wave(t: number, period: number, phase = 0): number {
  return (Math.sin((t / period) * 2 * Math.PI + phase) + 1) / 2
}

function mix(a: number, b: number, ratio: number): number {
  return Math.round(a + (b - a) * ratio)
}

type Ctx2D = WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D

/** 挂在组件实例上的绘制状态（不进 data —— 它们不参与渲染，setData 是纯浪费） */
interface OrbInstance {
  canvas?: WechatMiniprogram.Canvas
  ctx?: Ctx2D
  rafId?: number
  cssSize?: number
  startedAt?: number
}

Component<
  { canvasId: string },
  {
    size: { type: NumberConstructor; value: number }
    halo: { type: BooleanConstructor; value: boolean }
  },
  {
    setupCanvas(): void
    loop(): void
    stop(): void
    draw(t: number): void
  },
  // 第 4 个泛型是 behaviors，实例字段是第 5 个 —— 顺序搞反会得到一串
  // 「Property 'canvas' does not exist」的报错
  [],
  OrbInstance
>({
  properties: {
    /** 直径（rpx） */
    size: { type: Number, value: 192 },
    /** 是否绘制外圈呼吸光晕 */
    halo: { type: Boolean, value: true },
  },

  data: {
    // 同页可能出现多个光球（首页 + 抽取 FAB），id 必须唯一，否则 selectorQuery 会串
    canvasId: `orb-${Math.floor(Math.random() * 1e9).toString(36)}`,
  },

  lifetimes: {
    attached() {
      this.startedAt = Date.now()
    },
    ready() {
      this.setupCanvas()
    },
    detached() {
      this.stop()
    },
  },

  pageLifetimes: {
    // 页面隐藏时停掉 RAF：后台空转会白白耗电，回来再续
    hide() {
      this.stop()
    },
    show() {
      if (this.canvas) this.loop()
    },
  },

  methods: {
    setupCanvas() {
      wx.createSelectorQuery()
        .in(this)
        .select(`#${this.data.canvasId}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          const item = res[0] as
            | { node?: WechatMiniprogram.Canvas; width: number; height: number }
            | undefined
          const canvas = item?.node
          if (!canvas || !item) {
            console.warn('[orb] canvas 节点取不到，光球降级为静态背景')
            return
          }

          const dpr = wx.getWindowInfo().pixelRatio
          canvas.width = item.width * dpr
          canvas.height = item.height * dpr

          this.canvas = canvas
          this.ctx = canvas.getContext('2d')
          this.ctx.scale(dpr, dpr)
          this.cssSize = item.width

          this.loop()
        })
    },

    loop() {
      if (!this.canvas || !this.ctx) return
      this.stop()

      const still = reduceMotion()
      this.draw(still ? 0 : (Date.now() - (this.startedAt ?? Date.now())) / 1000)

      // reduceMotion 时画一帧静置定格就停 —— 与 iOS 的 `t = 0` 分支同语义，
      // 蜡团仍然成形，只是不动
      if (still) return

      this.rafId = this.canvas.requestAnimationFrame(() => this.loop())
    },

    stop() {
      if (this.rafId !== undefined && this.canvas) {
        this.canvas.cancelAnimationFrame(this.rafId)
        this.rafId = undefined
      }
    },

    draw(t: number) {
      const ctx = this.ctx
      const s = this.cssSize
      if (!ctx || !s) return

      ctx.clearRect(0, 0, s, s)

      const cx = s / 2
      const cy = s / 2
      const r = s / 2
      const pulse = reduceMotion() ? 0.5 : wave(t, 6)

      // ── 外圈呼吸光晕 ──
      if (this.properties.halo) {
        const haloR = r * (1 + 0.12 * pulse)
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR)
        const alpha = 0.7 + 0.3 * pulse
        halo.addColorStop(0, `rgba(94,150,255,${0.5 * alpha})`)
        halo.addColorStop(0.55, `rgba(227,92,193,${0.25 * alpha})`)
        halo.addColorStop(1, 'rgba(227,92,193,0)')
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(cx, cy, haloR, 0, Math.PI * 2)
        ctx.fill()
      }

      // 灯瓶之内的内容全部裁进圆
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2)
      ctx.clip()

      // ── 深蓝灯瓶 ──
      const bottleR = r * 0.78
      const bottle = ctx.createRadialGradient(cx, cy + bottleR * 0.1, 0, cx, cy, bottleR)
      bottle.addColorStop(0, '#4A55D6')
      bottle.addColorStop(0.55, '#2A2F9E')
      bottle.addColorStop(1, '#1B1E5C')
      ctx.fillStyle = bottle
      ctx.fillRect(cx - bottleR, cy - bottleR, bottleR * 2, bottleR * 2)

      // ── 熔岩蜡团 ──
      // 'lighter' 是加色混合：两团重叠处自然变亮、颜色相融，近似 iOS 的 metaball 阈值场。
      // 软边（渐变到全透明）保证边界不出现硬圈。
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.92

      const left = cx - bottleR
      const top = cy - bottleR
      const span = bottleR * 2

      for (const blob of BLOBS) {
        const bx = left + span * (blob.baseX + blob.ampX * (wave(t, blob.periodX, blob.phase) - 0.5) * 2)
        const by = top + span * (blob.baseY + blob.ampY * (wave(t, blob.periodY, blob.phase) - 0.5) * 2)
        // 蜡团自身也随时间胀缩
        const br = span * blob.radius * (0.88 + 0.24 * wave(t, blob.periodX * 1.7, blob.phase))

        // 竖向位置决定颜色：顶蓝底品红，与 OrbView 的 color1/color2 渐变同意图
        const ratio = Math.min(1, Math.max(0, (by - top) / span))
        const cr = mix(BLOB_TOP.r, BLOB_BOTTOM.r, ratio)
        const cg = mix(BLOB_TOP.g, BLOB_BOTTOM.g, ratio)
        const cb = mix(BLOB_TOP.b, BLOB_BOTTOM.b, ratio)

        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br)
        g.addColorStop(0, `rgba(${cr},${cg},${cb},0.95)`)
        g.addColorStop(0.55, `rgba(${cr},${cg},${cb},0.45)`)
        g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(bx, by, br, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1

      // ── 顶部高光（轻薄，避免盖白熔岩）──
      const hx = cx - bottleR * 0.24
      const hy = cy - bottleR * 0.44
      const hl = ctx.createRadialGradient(hx, hy, 0, hx, hy, bottleR * 0.46)
      hl.addColorStop(0, 'rgba(255,255,255,0.22)')
      hl.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = hl
      ctx.fillRect(cx - bottleR, cy - bottleR, bottleR * 2, bottleR * 2)

      ctx.restore()
    },
  },
})
