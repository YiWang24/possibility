/**
 * 数字形象舞台 —— 对应 iOS `PersonaCanvasView` + `PersonaStageView`。
 *
 * 单位用 px 而不是 rpx：`persona.ts` 的几何常量是从 iOS 照抄的「点」，
 * 而小程序的 CSS px 与 iOS 的点是同一套逻辑像素。舞台若按 rpx 随屏宽缩放，
 * 画布里的形体不会跟着缩，两者就会脱节（大屏上形象缩在中间一小块）。
 * iOS 的 `.frame(height: 216)` 也是固定值，这里跟着走。
 *
 * 绘制状态挂实例字段而不进 data：它们不参与渲染，setData 是纯浪费
 * （与 `core/design/components/orb` 同一套写法）。
 */

import { drawPersona, personaMeta, type PersonaModel } from '../../persona'
import { reduceMotion } from '../../../../core/design/motion'

type Ctx2D = WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D

/** iOS `TimelineView(.animation(minimumInterval: 1.0 / 30))`。
 *  粒子最多 ~380 个，逐帧 60fps 在中低端机上会明显掉帧，30fps 足够呈现呼吸与公转。 */
const FRAME_MS = 1000 / 30

interface StageData {
  canvasId: string
  meta: string
  hasLifeCards: boolean
  /** 关掉动效时 LIVE 小圆点也停下来，而不是继续呼吸 */
  still: boolean
}

interface StageInstance {
  canvas?: WechatMiniprogram.Canvas
  ctx?: Ctx2D
  rafId?: number
  cssWidth?: number
  cssHeight?: number
  startedAt?: number
  lastDrawAt?: number
  current?: PersonaModel
}

Component<
  StageData,
  {
    model: ObjectConstructor
    userName: StringConstructor
    summary: StringConstructor
    paused: BooleanConstructor
  },
  {
    setupCanvas(): void
    loop(): void
    stop(): void
    render(): void
    syncModel(): void
  },
  [],
  StageInstance
>({
  properties: {
    /** `buildPersona()` 的产物 */
    model: Object,
    userName: String,
    /** 云端 persona 的一句话说明；空串时展示本地推导的 meta 文案 */
    summary: String,
    /** 页面被浮层覆盖时暂停重绘 */
    paused: Boolean,
  },

  data: {
    // 同页只会有一个舞台，但保持与 orb 一致的唯一 id 习惯，避免将来同页多实例串号
    canvasId: `persona-${Math.floor(Math.random() * 1e9).toString(36)}`,
    meta: '',
    hasLifeCards: false,
    still: false,
  },

  observers: {
    'model, summary': function observeModel() {
      this.syncModel()
    },
    paused: function observePaused(paused: boolean) {
      if (paused) this.stop()
      else if (this.canvas) this.loop()
    },
  },

  lifetimes: {
    attached() {
      this.startedAt = Date.now()
      this.setData({ still: reduceMotion() })
      this.syncModel()
    },
    ready() {
      this.setupCanvas()
    },
    detached() {
      this.stop()
    },
  },

  pageLifetimes: {
    hide() {
      this.stop()
    },
    show() {
      if (this.canvas && !this.properties.paused) this.loop()
    },
  },

  methods: {
    syncModel() {
      const model = this.properties.model as PersonaModel | undefined
      if (!model || typeof model.seed !== 'number') return
      this.current = model
      this.setData({
        meta: personaMeta(model, this.properties.summary),
        hasLifeCards: model.signature.length >= 3,
      })
      // 画像变了要立刻重画一帧：静置模式下没有 RAF 会把它带上来
      this.render()
    },

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
            // 拿不到节点时舞台退化成纯背景 + caption，首页不会白屏
            console.warn('[persona-stage] canvas 节点取不到，数字形象降级为静态背景')
            return
          }

          const dpr = wx.getWindowInfo().pixelRatio
          canvas.width = item.width * dpr
          canvas.height = item.height * dpr

          this.canvas = canvas
          this.ctx = canvas.getContext('2d')
          this.ctx.scale(dpr, dpr)
          this.cssWidth = item.width
          this.cssHeight = item.height

          this.loop()
        })
    },

    loop() {
      if (!this.canvas || !this.ctx) return
      this.stop()

      const still = reduceMotion()
      this.render()

      // reduceMotion 时画一帧静置定格就停 —— 与 iOS 的 `paused: reduceMotion` 同语义，
      // 形体仍然成形，只是不呼吸
      if (still || this.properties.paused) return

      this.rafId = this.canvas.requestAnimationFrame(() => this.loop())
    },

    render() {
      const ctx = this.ctx
      const w = this.cssWidth
      const h = this.cssHeight
      const model = this.current
      if (!ctx || !w || !h || !model) return

      const now = Date.now()
      // 30fps 节流：RAF 按屏幕刷新率回调（可能 60/90/120Hz），不掐就是白烧电
      if (this.lastDrawAt !== undefined && now - this.lastDrawAt < FRAME_MS) return
      this.lastDrawAt = now

      const t = reduceMotion() ? 0 : now - (this.startedAt ?? now)
      drawPersona(ctx, w, h, model, t)
    },

    stop() {
      if (this.rafId !== undefined && this.canvas) {
        this.canvas.cancelAnimationFrame(this.rafId)
        this.rafId = undefined
      }
    },
  },
})
