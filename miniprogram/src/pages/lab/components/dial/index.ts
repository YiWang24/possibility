/**
 * 时间旋钮（签名交互）—— 对应 iOS `Core/DesignSystem/DialView.swift`。
 *
 * 拖拽在 240° 扇区（钟表 8 点 → 4 点）里设定 7 天–10 年：
 * 拖拽角 = clamp(atan2(dx, -dy), -120, 120)，就近吸附到 14 个档位。
 *
 * ## 分层实现的取舍
 *
 * iOS 是 8 层 SwiftUI 视图叠加，这里按「谁便宜谁上」拆到两种渲染方式：
 * - **刻度环走 canvas 2d**：40 根刻度线，每根都要按角度算两个端点。用 40 个
 *   WXML 节点各自 `transform: rotate()` 能画出来，但 setData 要搬 40 份数据，
 *   拖拽时每帧都搬 —— canvas 一次 `stroke` 就完事，且与 `orb` 同一套模式。
 * - **底盘 / 光环 / 指针 / 圆心文字走 WXML + WXSS**：它们是静态背景加一个
 *   旋转角，交给合成器比逐帧重绘便宜；文字更是必须用节点（canvas 里的中文
 *   字重和字距控不住）。
 *
 * 色环用 `--orb-conic`（conic-gradient）。Skyline 对 conic 的支持要等 W0-0
 * 真机冒烟确认；不支持时退化成一圈纯 `--blue`，形状与旋转都还在，只丢渐变。
 *
 * 手势没走 Skyline worklet：worklet 里改不了 `data`，而档位变化要同时驱动
 * 圆心文案、刻度高亮和外部页面（推演按钮的可用态）。240° / 13 档意味着
 * 一次拖拽最多 13 次 setData，都发生在手指移动的量级上，实测足够跟手。
 * 真机若发现掉帧，再把「指针跟手」这一层单独下沉到 worklet。
 */

import { SIMULATION_HORIZONS } from '../../../../core/models'
import { reduceMotion } from '../../../../core/design/motion'

/** 表盘扫角：±120°（钟表 8 点 → 4 点） */
const SWEEP = 120
const COUNT = SIMULATION_HORIZONS.length
/** 相邻档位的角距：240 / 13 */
const STEP = (2 * SWEEP) / (COUNT - 1)
/** 每档均分 3 段，14 个主刻度之间各插 2 根副刻度 */
const MINOR_STEP = STEP / 3

/** 档位序号 → 角度（0 = 正上，顺时针为正） */
function indexToAngle(index: number): number {
  return -SWEEP + index * STEP
}

/** 角度 → 就近档位序号 */
function angleToIndex(angle: number): number {
  const raw = (angle + SWEEP) * ((COUNT - 1) / (2 * SWEEP))
  return Math.min(COUNT - 1, Math.max(0, Math.round(raw)))
}

interface TickLabel {
  key: string
  text: string
  /** 相对表盘左上角的 rpx 坐标（已换算成 left/top） */
  x: number
  y: number
  small: boolean
  on: boolean
}

type Ctx2D = WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D

interface DialInstance {
  canvas?: WechatMiniprogram.Canvas
  ctx?: Ctx2D
  /** canvas 的 CSS 像素边长（= size rpx 换算后的实际值） */
  cssSize?: number
  /** 触点换算用：表盘在页面里的位置与实际边长 */
  rect?: { left: number; top: number; size: number }
  dragging?: boolean
}

Component<
  {
    canvasId: string
    armAngle: number
    labels: TickLabel[]
    horizonLabel: string
    still: boolean
  },
  {
    size: { type: NumberConstructor; value: number }
    index: { type: NumberConstructor; value: number }
    pick: { type: StringConstructor; value: string }
    hot: { type: BooleanConstructor; value: boolean }
  },
  {
    setupCanvas(): void
    measure(): void
    drawTicks(): void
    syncFromIndex(): void
    buildLabels(): void
    onTouchStart(e: WechatMiniprogram.TouchEvent): void
    onTouchMove(e: WechatMiniprogram.TouchEvent): void
    onTouchEnd(): void
    applyTouch(e: WechatMiniprogram.TouchEvent): void
  },
  [],
  DialInstance
>({
  properties: {
    /** 直径（rpx） */
    size: { type: Number, value: 500 },
    /** 当前档位序号（受控，由页面持有） */
    index: { type: Number, value: 8 },
    /** 已选择卡名称；空串显示占位「把选择卡拖进来」 */
    pick: { type: String, value: '' },
    /** 拖拽选择卡悬停高亮 */
    hot: { type: Boolean, value: false },
  },

  data: {
    canvasId: `dial-${Math.floor(Math.random() * 1e9).toString(36)}`,
    armAngle: 0,
    labels: [] as TickLabel[],
    horizonLabel: '5年',
    still: false,
  },

  observers: {
    index() {
      this.syncFromIndex()
      this.buildLabels()
      this.drawTicks()
    },
  },

  lifetimes: {
    attached() {
      this.setData({ still: reduceMotion() })
      this.syncFromIndex()
      this.buildLabels()
    },
    ready() {
      this.setupCanvas()
      this.measure()
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
            console.warn('[dial] canvas 节点取不到，刻度环缺失但拖拽仍可用')
            return
          }
          const dpr = wx.getWindowInfo().pixelRatio
          canvas.width = item.width * dpr
          canvas.height = item.height * dpr
          this.canvas = canvas
          this.ctx = canvas.getContext('2d')
          this.ctx.scale(dpr, dpr)
          this.cssSize = item.width
          this.drawTicks()
        })
    },

    /** 缓存表盘的页面坐标：拖拽每帧都要用，逐帧 query 会把手势拖垮 */
    measure() {
      wx.createSelectorQuery()
        .in(this)
        .select('.dial')
        .boundingClientRect((rect) => {
          if (!rect) return
          this.rect = { left: rect.left, top: rect.top, size: rect.width }
        })
        .exec()
    },

    syncFromIndex() {
      const i = this.properties.index
      const horizon = SIMULATION_HORIZONS[i] ?? SIMULATION_HORIZONS[0]
      // 拖拽中不回吸指针：这一帧的角度是手指给的，改了就会和手指打架，
      // 松手时 onTouchEnd 再吸附到档位角
      const patch: Partial<{ armAngle: number; horizonLabel: string }> = {
        horizonLabel: horizon?.label ?? '',
      }
      if (!this.dragging) patch.armAngle = indexToAngle(i)
      this.setData(patch)
    },

    /** 14 个主刻度的数字标签：位置固定，只有高亮档随 index 变 */
    buildLabels() {
      const size = this.properties.size
      const c = size / 2
      // iOS 标签落在 size/2 - 26pt，rpx 下同比例
      const r = c - 50
      const current = this.properties.index
      const labels: TickLabel[] = SIMULATION_HORIZONS.map((h, i) => {
        const rad = (indexToAngle(i) * Math.PI) / 180
        return {
          key: h.key,
          text: h.dialLabel,
          x: c + Math.sin(rad) * r,
          y: c - Math.cos(rad) * r,
          // 「30天」三个字最挤，单独降一档字号
          small: h.key === 'day30',
          on: i === current,
        }
      })
      this.setData({ labels })
    },

    drawTicks() {
      const ctx = this.ctx
      const s = this.cssSize
      if (!ctx || !s) return

      ctx.clearRect(0, 0, s, s)
      const c = s / 2
      // iOS 刻度外沿 size/2 - 8pt；这里按 canvas 的 CSS 像素同比例折算
      const rOuter = c - s * 0.031
      const current = this.properties.index

      let idx = 0
      for (let a = -SWEEP; a <= SWEEP + 0.01; a += MINOR_STEP) {
        const major = idx % 3 === 0
        const len = major ? s * 0.046 : s * 0.023
        const rad = (a * Math.PI) / 180
        const dx = Math.sin(rad)
        const dy = -Math.cos(rad)
        const on = major && idx / 3 === current

        ctx.beginPath()
        ctx.moveTo(c + dx * rOuter, c + dy * rOuter)
        ctx.lineTo(c + dx * (rOuter - len), c + dy * (rOuter - len))
        ctx.strokeStyle = on
          ? '#ffffff'
          : `rgba(157,188,255,${major ? 0.65 : 0.28})`
        ctx.lineWidth = major ? s * 0.0096 : s * 0.0058
        ctx.stroke()
        idx += 1
      }
    },

    onTouchStart(e: WechatMiniprogram.TouchEvent) {
      this.dragging = true
      // 页面可能滚动过，起手时重新量一次
      this.measure()
      this.applyTouch(e)
    },

    onTouchMove(e: WechatMiniprogram.TouchEvent) {
      if (!this.dragging) return
      this.applyTouch(e)
    },

    onTouchEnd() {
      this.dragging = false
      // 吸附到档位角，与 iOS 松手后的 snap 同一观感
      this.setData({ armAngle: indexToAngle(this.properties.index) })
    },

    /** 触点 → 角度 → 档位，变了才 setData 并抛给页面 */
    applyTouch(e: WechatMiniprogram.TouchEvent) {
      const rect = this.rect
      const touch = e.touches[0] ?? e.changedTouches[0]
      if (!rect || !touch) return

      const c = rect.size / 2
      const dx = touch.clientX - rect.left - c
      const dy = touch.clientY - rect.top - c
      const deg = (Math.atan2(dx, -dy) * 180) / Math.PI
      const clamped = Math.min(SWEEP, Math.max(-SWEEP, deg))
      const next = angleToIndex(clamped)

      // 指针跟手：拖拽中直接用触点角，松手后 observer 会吸附回档位角
      this.setData({ armAngle: clamped })
      if (next !== this.properties.index) {
        wx.vibrateShort({ type: 'light' })
        this.triggerEvent('change', { index: next })
      }
    },
  },

  options: { addGlobalClass: true },
})
