/**
 * 万花筒抽取盘 —— 对应 iOS `Core/DesignSystem/KaleidoscopeView.swift`。
 *
 * 结构与 iOS 同构：**一片母纹样 × 十二面镜筒**。只画一次晶体花瓣，靠镜面
 * 变换（旋转 + 偶数片沿 x 轴翻转）折射成完整花型 —— 这既是真万花筒的成像
 * 原理，也是这段代码只有一份图案数据的原因。改花瓣只改 `FACETS`。
 *
 * 抽取时「圆框不动、内部纹样拧转」：iOS 用 `.rotationEffect` 转 Canvas、
 * 母图另外再转 `innerTwist`；canvas 这边同样分两层 —— `discRotation` 转整个
 * 裁切圆内的坐标系，`twist` 只作用在母图上。两者反向叠加才有「拧动」感。
 *
 * 单位是 iOS 点（canvas 绘制单位 = CSS px = iOS pt），所以下面的数字与 iOS 一致。
 *
 * 三处刻意的实现差异：
 * - 外圈 halo：iOS 是 `blur(13)` 的实心圆环，canvas 没有 filter，改用同色标的
 *   径向渐变直接画软边 —— 观感等价，且省掉一次全画布模糊。
 * - 镜框流光：iOS 用 `AngularGradient` 描边，canvas 2d 没有 conic 渐变，
 *   按色标切 5 段圆弧描边（方案文档第 2 项给的就是这个画法）。
 * - `drawingGroup(colorMode: .linear)` 无对应物，直接省掉：这层只影响混色精度。
 */

import { reduceMotion } from '../../../core/design/motion'

/** 盘面直径（iOS `size: CGFloat = 230`），也是这枚转盘占的版面宽度 */
export const DIAL = 230

/**
 * 画布比盘面大一圈：外圈 halo 是**溢出盘外**的辉光，iOS 靠 SwiftUI 不裁子视图
 * 直接漫出 frame，canvas 画不出画布之外，只能预留出血。
 * 页面用等量的负 margin 抵掉，版面上这枚转盘仍然只占 DIAL。
 */
export const BLEED = 58
export const STAGE = DIAL + BLEED * 2

/** 十二面镜筒（iOS sectorCount） */
const SECTORS = 12

/** 一次抽取的转动时长，与取样时间的加速时长（iOS 1.35 / 1.2 秒） */
const SPIN_SECONDS = 1.35
const TIME_RAMP_SECONDS = 1.2

/** 静置时母图的自转速度，与抽取时额外推进的相位（iOS 0.12 / 2.7） */
const IDLE_RATE = 0.12
const SPIN_ADVANCE = 2.7

/** 呼吸：只改核心半径与线位，不改整盘透明度（iOS `sin(t * 0.72) * 0.014`） */
const BREATH_RATE = 0.72
const BREATH_DEPTH = 0.014

/** 三种主色（iOS cyan / blue / violet）—— 万花筒是青蓝为绝对主色，紫只在少数折射面 */
const CYAN = '50,230,255'
const BLUE = '22,119,255'
const VIOLET = '125,77,255'

/** 盘底四段径向渐变（iOS drawtag 的 radialGradient stops） */
const BASE_STOPS: [number, string][] = [
  [0, '#0e58a8'],
  [0.36, '#063b88'],
  [0.7, '#0b245b'],
  [1, '#050c22'],
]

/**
 * 外圈 halo 的四段色标（iOS outerHalo）。
 *
 * iOS 写的是 `startRadius: size * 0.37, endRadius: size * 0.65` —— 注意是
 * **直径** size 的倍数，换成盘面半径就是 0.74R 到 1.30R，再乘 `scaleEffect(1.12)`。
 * 也就是说这圈光起于盘沿之内一点、主要漫在盘外，不是压在花纹上的一层蓝雾。
 */
const HALO_INNER = 0.74 * 1.12
const HALO_OUTER = 1.3 * 1.12
const HALO_STOPS: [string, number][] = [
  ['50,230,255', 0.18],
  ['22,119,255', 0.13],
  ['100,91,255', 0.035],
  ['100,91,255', 0],
]

/** 镜框流光的取色（iOS rim 的 AngularGradient 色序） */
const RIM_COLORS = ['#32e6ff', '#1677ff', '#33b8ff', '#6c5cff', '#1677ff', '#32e6ff']

/**
 * 母纹样的五片晶体：点集是相对半径的比例，`colors` 是三段渐变，
 * `shift` 是呼吸时沿棱线的位移系数（iOS drawPrismaticMotif 逐片给的 breatheShift 倍率）。
 */
const FACETS: { pts: [number, number][]; colors: [string, string, string]; shift: number }[] = [
  {
    pts: [
      [0.07, 0],
      [0.24, -0.045],
      [0.36, 0],
      [0.24, 0.045],
    ],
    colors: ['#b9fcff', '#32e6ff', '#1677ff'],
    shift: 0.25,
  },
  {
    pts: [
      [0.28, 0.045],
      [0.43, -0.062],
      [0.58, -0.012],
      [0.46, 0.092],
    ],
    colors: ['#32e6ff', '#33b8ff', '#1677ff'],
    shift: 0.48,
  },
  {
    pts: [
      [0.45, -0.105],
      [0.63, -0.145],
      [0.79, -0.052],
      [0.61, 0.012],
    ],
    colors: ['#31dfff', '#1677ff', '#7d4dff'],
    shift: 0.72,
  },
  {
    pts: [
      [0.65, 0.045],
      [0.82, 0.015],
      [0.98, 0.12],
      [0.82, 0.19],
    ],
    colors: ['#1677ff', '#22b8ff', '#32e6ff'],
    shift: 1,
  },
  {
    pts: [
      [0.76, -0.19],
      [0.88, -0.22],
      [0.98, -0.13],
      [0.86, -0.085],
    ],
    colors: ['#49f4ff', '#1677ff', '#6c5cff'],
    shift: 1,
  },
]

/** 两条数据轨道（iOS tracks：终点偏移 / 起点偏移），每条 6 颗粒子 */
const TRACKS: { to: number; from: number; speed: number }[] = [
  { to: 0.082, from: 0.015, speed: 0.24 },
  { to: -0.17, from: -0.012, speed: 0.19 },
]
const PARTICLES = 6

/** 外缘 24 颗小方块的配色循环（iOS drawOuterNodes） */
const NODE_COLORS = ['#32e6ff', '#1677ff', '#32e6ff', '#7d4dff']

const TAU = Math.PI * 2

type Ctx2D = WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D

/** `#rrggbb` → `"r,g,b"` */
function channels(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

function rgba(hex: string, alpha: number): string {
  return `rgba(${channels(hex)},${alpha})`
}

/** 多边形路径（母纹样的晶体片都是四点凸多边形） */
function polygon(ctx: Ctx2D, pts: [number, number][], radius: number, shift: number): void {
  ctx.beginPath()
  pts.forEach(([px, py], i) => {
    const x = px * radius + shift
    const y = py * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
}

/** 抽取时的运动状态（iOS `MotionState`） */
interface Motion {
  /** 整个镜盘的转角（度）*/
  disc: number
  /** 母图自身的扭转（弧度）*/
  twist: number
  /** 母图缩放，对应 CC Kaleida Size */
  scale: number
  /** 母图采样中心的二维偏移，对应 CC Kaleida Center */
  dx: number
  dy: number
}

const STILL: Motion = { disc: 0, twist: 0, scale: 1, dx: 0, dy: 0 }

export class Kaleidoscope {
  private rafId?: number
  /** 本次抽取的起点（ms）；未在抽取时为 undefined */
  private spinAt?: number
  private readonly startedAt = Date.now()

  /** 母图的离屏画布：每帧画一次，十二面镜筒各 drawImage 一次（见文件头） */
  private readonly motif: WechatMiniprogram.OffscreenCanvas
  private readonly motifCtx: Ctx2D
  /** 母图画布的 CSS 尺寸（离屏的像素尺寸是它 × ss） */
  private readonly motifW: number
  private readonly motifH: number
  /** 母图画布里的原点位置（母图向 +x 伸展 1.2r，上下各 0.78r） */
  private readonly motifOx: number
  private readonly motifOy: number
  /**
   * 贴图的像素倍率。母图会被放大到 1.2 倍（motion.scale）再贴，所以不能只按
   * CSS px 画 —— 那样在 3 倍屏上是先降采样再放大，晶体的高光细边会糊掉。
   * 上限取 2：与放映页同一个取舍（够 1.2 倍放大不虚，又不至于占满内存）。
   */
  private readonly ss: number

  constructor(
    private readonly canvas: WechatMiniprogram.Canvas,
    private readonly ctx: Ctx2D,
    dpr: number,
  ) {
    const radius = DIAL / 2
    this.ss = Math.min(dpr, 2)
    this.motifW = Math.ceil(radius * 1.24)
    this.motifH = Math.ceil(radius * 1.6)
    this.motif = wx.createOffscreenCanvas({
      type: '2d',
      width: this.motifW * this.ss,
      height: this.motifH * this.ss,
    })
    this.motifCtx = this.motif.getContext('2d') as Ctx2D
    this.motifCtx.scale(this.ss, this.ss)
    this.motifOx = 0
    this.motifOy = this.motifH / 2
  }

  /** 转一次。抽取动画与网络请求是并行的，所以这里只管转 */
  spin(): void {
    this.spinAt = Date.now()
    this.wake()
  }

  wake(): void {
    if (this.rafId !== undefined) return
    this.rafId = this.canvas.requestAnimationFrame(() => this.tick())
  }

  stop(): void {
    if (this.rafId === undefined) return
    this.canvas.cancelAnimationFrame(this.rafId)
    this.rafId = undefined
  }

  /** 关了动效就只画一帧静态盘面（iOS 的 `paused: reduceMotion`） */
  drawStill(): void {
    this.draw(this.startedAt)
  }

  private tick(): void {
    this.rafId = undefined
    const now = Date.now()
    this.draw(now)
    // 抽完就停：静置时盘面还在极慢自转，但那点位移 30fps 与 20fps 看不出差别，
    // 这里索引 iOS 的 minimumInterval 1/30 交给 RAF 自己的节流
    if (!reduceMotion()) this.wake()
  }

  private motionAt(now: number): Motion {
    if (this.spinAt === undefined) return STILL
    const elapsed = Math.max(0, (now - this.spinAt) / 1000)
    const progress = Math.min(1, elapsed / SPIN_SECONDS)
    const turn = 1 - (1 - progress) ** 4
    const envelope = Math.sin(progress * Math.PI)
    const sizeKf = Math.sin(progress * Math.PI * 2) * envelope
    const cxKf = Math.sin(progress * Math.PI * 2) * envelope
    const cyKf = Math.sin(progress * Math.PI * 3 + 0.35) * envelope
    return {
      disc: 150 * turn,
      // 扭转在结束时回正，彩色晶体才不会停在镜面裁切区外
      twist: 0.18 * envelope + 0.035 * cyKf,
      scale: 1 + 0.2 * sizeKf,
      dx: 0.145 * cxKf,
      dy: 0.105 * cyKf,
    }
  }

  /** 母图相位：静置匀速推进，抽取时额外快进 2.7（iOS `effectiveTime`） */
  private phaseAt(now: number): number {
    const idle = ((now - this.startedAt) / 1000) * IDLE_RATE
    if (this.spinAt === undefined) return idle
    const elapsed = Math.max(0, (now - this.spinAt) / 1000)
    const progress = Math.min(1, elapsed / TIME_RAMP_SECONDS)
    return idle + (1 - (1 - progress) ** 4) * SPIN_ADVANCE
  }

  /**
   * 一帧。层次照抄 iOS 的 ZStack：halo 在最底且不参与旋转（它是漫出盘外的辉光），
   * 盘面裁在圆里跟着 `discRotation` 转，镜框最后画在旋转之外 ——
   * 这正是「圆框不动、内部纹样拧转」的那个「不动」。
   */
  private draw(now: number): void {
    const { ctx } = this
    const radius = DIAL / 2
    const still = reduceMotion()
    const motion = still ? STILL : this.motionAt(now)
    const time = still ? 0 : this.phaseAt(now)
    const breath = still ? 1 : 1 + Math.sin(time * BREATH_RATE) * BREATH_DEPTH

    ctx.clearRect(0, 0, STAGE, STAGE)
    this.paintMotifTile(radius, time, breath)

    ctx.save()
    // 出血整体右下移，下面所有画法都以「圆心 = (radius, radius)」为准
    ctx.translate(BLEED, BLEED)
    this.paintHalo(radius, breath)

    ctx.save()
    // iOS 的 .clipShape(Circle())：镜筒裁到 1.04r，多出来的那 4% 由这里收掉
    ctx.beginPath()
    ctx.arc(radius, radius, radius, 0, TAU)
    ctx.clip()
    ctx.translate(radius, radius)
    ctx.rotate((motion.disc * Math.PI) / 180)
    ctx.translate(-radius, -radius)
    this.paintBase(radius)
    this.paintSectors(radius, motion)
    this.paintCore(radius, time, breath)
    this.paintOuterNodes(radius, time)
    ctx.restore()

    this.paintRim(radius)
    ctx.restore()
  }

  private paintBase(radius: number): void {
    const { ctx } = this
    const g = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius)
    BASE_STOPS.forEach(([stop, color]) => g.addColorStop(stop, color))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(radius, radius, radius, 0, TAU)
    ctx.fill()
  }

  /**
   * 外圈辉光。iOS 那层 `blur(13)` 在这里由渐变本身的软边代替（见文件头）。
   * 内圈之内是纯色 —— 但那一段整个被盘面盖住，只有漫到盘外的部分看得见。
   * 尾标必须与前一标同色只改 alpha：写 `transparent` 会朝透明黑插值，把中段压灰。
   */
  private paintHalo(radius: number, breath: number): void {
    const { ctx } = this
    const inner = radius * HALO_INNER * breath
    const outer = radius * HALO_OUTER * breath
    const g = ctx.createRadialGradient(radius, radius, inner, radius, radius, outer)
    HALO_STOPS.forEach(([rgb, alpha], i) => {
      g.addColorStop(i / (HALO_STOPS.length - 1), `rgba(${rgb},${alpha})`)
    })
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(radius, radius, outer, 0, TAU)
    ctx.fill()
  }

  /**
   * 镜框流光。canvas 2d 没有 conic 渐变，按 `RIM_COLORS` 切 5 段圆弧，
   * 每段用两端点之间的线性渐变过渡 —— 弧长只有 72°，弦向渐变与角向渐变
   * 在 1.15 的线宽上看不出差别。每段多描 0.01 弧度盖住接缝。
   */
  private paintRim(radius: number): void {
    const { ctx } = this
    const r = radius - 0.6
    const segments = RIM_COLORS.length - 1
    ctx.save()
    ctx.shadowColor = `rgba(${CYAN},0.28)`
    ctx.shadowBlur = 4
    ctx.lineWidth = 1.15
    for (let i = 0; i < segments; i++) {
      const a0 = -Math.PI / 2 + (i / segments) * TAU
      const a1 = a0 + TAU / segments + 0.01
      const g = ctx.createLinearGradient(
        radius + Math.cos(a0) * r,
        radius + Math.sin(a0) * r,
        radius + Math.cos(a1) * r,
        radius + Math.sin(a1) * r,
      )
      g.addColorStop(0, RIM_COLORS[i]!)
      g.addColorStop(1, RIM_COLORS[i + 1]!)
      ctx.strokeStyle = g
      ctx.beginPath()
      ctx.arc(radius, radius, r, a0, a1)
      ctx.stroke()
    }
    ctx.restore()

    ctx.lineWidth = 0.55
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'
    ctx.beginPath()
    ctx.arc(radius, radius, radius - 5, 0, TAU)
    ctx.stroke()
  }

  /**
   * 十二面镜筒。每片：转到自己的方位、偶数片沿 x 轴翻转（相邻两片互为镜像，
   * 这样花瓣在棱线上才是对着接的）、裁一个 30° 楔形、再把母图按 `motion`
   * 拧一下贴进去。裁切留到 1.04r 是 iOS 的余量：贴图边缘的描边不会被切齐。
   */
  private paintSectors(radius: number, motion: Motion): void {
    const { ctx } = this
    const half = Math.PI / SECTORS
    for (let i = 0; i < SECTORS; i++) {
      ctx.save()
      ctx.translate(radius, radius)
      ctx.rotate((i * TAU) / SECTORS)
      if (i % 2 === 0) ctx.scale(1, -1)

      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, radius * 1.04, -half, half)
      ctx.closePath()
      ctx.clip()

      ctx.rotate(motion.twist)
      ctx.translate(radius * motion.dx, radius * motion.dy)
      // y 只跟 60% 的缩放：母图上下只有 0.78r 的余量，等比放大会把花瓣顶出楔形
      ctx.scale(motion.scale, 1 + (motion.scale - 1) * 0.62)
      // 目标尺寸要显式给：离屏画布的像素尺寸是 CSS 尺寸的 ss 倍
      ctx.drawImage(this.motif, -this.motifOx, -this.motifOy, this.motifW, this.motifH)
      ctx.restore()
    }
  }

  /**
   * 母纹样：一层三角形氛围光 + 五片晶体 + 两条数据轨道。画进离屏画布，
   * 十二面镜筒共用（同一帧里每片的参数完全一样，只有镜面变换不同）。
   */
  private paintMotifTile(radius: number, time: number, breath: number): void {
    const ctx = this.motifCtx
    ctx.clearRect(0, 0, this.motifW, this.motifH)
    ctx.save()
    ctx.translate(this.motifOx, this.motifOy)

    const atmosphere = ctx.createLinearGradient(0, 0, radius, 0)
    atmosphere.addColorStop(0, `rgba(${CYAN},0.18)`)
    atmosphere.addColorStop(0.55, `rgba(${BLUE},0.14)`)
    atmosphere.addColorStop(1, `rgba(${VIOLET},0.055)`)
    ctx.fillStyle = atmosphere
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(radius * 1.2, -radius * 0.78)
    ctx.lineTo(radius * 1.2, radius * 0.78)
    ctx.closePath()
    ctx.fill()

    // 呼吸把晶体沿棱线往外推，越靠外的片推得越多（FACETS[i].shift）
    const breatheShift = (breath - 1) * radius * 0.7
    FACETS.forEach((facet) => this.paintFacet(ctx, facet, radius, breatheShift * facet.shift))
    this.paintStreams(ctx, radius, time)

    ctx.restore()
  }

  /** 一片晶体：渐变填充 + 一道宽的青色辉光描边 + 一道细的高光描边 */
  private paintFacet(
    ctx: Ctx2D,
    facet: { pts: [number, number][]; colors: [string, string, string] },
    radius: number,
    shift: number,
  ): void {
    const xs = facet.pts.map(([px]) => px)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const [c0, c1, c2] = facet.colors

    const fill = ctx.createLinearGradient(
      minX * radius + shift,
      -radius * 0.12,
      maxX * radius + shift,
      radius * 0.12,
    )
    fill.addColorStop(0, rgba(c0, 0.88))
    fill.addColorStop(0.54, rgba(c1, 0.72))
    fill.addColorStop(1, rgba(c2, 0.56))

    polygon(ctx, facet.pts, radius, shift)
    ctx.fillStyle = fill
    ctx.fill()

    ctx.lineJoin = 'round'
    ctx.lineWidth = 4
    ctx.strokeStyle = `rgba(${CYAN},0.2)`
    ctx.stroke()

    const edge = ctx.createLinearGradient(
      minX * radius + shift,
      -radius * 0.12,
      maxX * radius + shift,
      radius * 0.12,
    )
    edge.addColorStop(0, 'rgba(255,255,255,0.78)')
    edge.addColorStop(0.5, `rgba(${CYAN},0.9)`)
    edge.addColorStop(1, `rgba(${BLUE},0.76)`)
    ctx.lineWidth = 0.7
    ctx.strokeStyle = edge
    ctx.stroke()
  }

  /**
   * 两条数据轨道：先描一条四段折线的轨，再让 6 颗粒子沿轨匀速跑。
   * 粒子是「圆角长条」，这里用 lineCap round 的短描边代替 —— 长条只有
   * 1 px 高，画 roundRect 与画一段圆头线的结果在这个尺度上是同一张图。
   */
  private paintStreams(ctx: Ctx2D, radius: number, time: number): void {
    TRACKS.forEach((track) => {
      const rail = ctx.createLinearGradient(radius * 0.19, 0, radius * 0.98, 0)
      rail.addColorStop(0, `rgba(${CYAN},0.12)`)
      rail.addColorStop(0.5, `rgba(${CYAN},0.55)`)
      rail.addColorStop(1, `rgba(${BLUE},0.32)`)
      ctx.lineCap = 'round'
      ctx.lineWidth = 0.55
      ctx.strokeStyle = rail
      ctx.beginPath()
      ctx.moveTo(radius * 0.19, track.from * radius)
      ctx.lineTo(radius * 0.48, track.to * 0.42 * radius)
      ctx.lineTo(radius * 0.72, track.to * 0.74 * radius)
      ctx.lineTo(radius * 0.98, track.to * radius)
      ctx.stroke()

      for (let i = 0; i < PARTICLES; i++) {
        const progress = (time * track.speed + i / PARTICLES) % 1
        const x = radius * (0.18 + progress * 0.8)
        const y = radius * (track.from + (track.to - track.from) * (x / radius))
        const len = radius * (i % 3 === 0 ? 0.045 : 0.024)
        const thickness = radius * (i % 2 === 0 ? 0.009 : 0.006)
        const rgb = i === 4 ? VIOLET : i % 2 === 0 ? CYAN : BLUE
        ctx.lineWidth = thickness
        ctx.strokeStyle = `rgba(${rgb},0.94)`
        ctx.beginPath()
        ctx.moveTo(x - len / 2, y)
        ctx.lineTo(x + len / 2, y)
        ctx.stroke()
        if (i % 3 === 0) this.paintNode(ctx, x, y, thickness * 1.1, rgb)
      }
    })
  }

  /** 轨道上的节点：外发光 + 白心球 + 一圈细环 */
  private paintNode(ctx: Ctx2D, x: number, y: number, r: number, rgb: string): void {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6)
    glow.addColorStop(0, `rgba(${rgb},0.42)`)
    glow.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, r * 2.6, 0, TAU)
    ctx.fill()

    const ball = ctx.createRadialGradient(x, y, 0, x, y, r)
    ball.addColorStop(0, 'rgba(255,255,255,0.95)')
    ball.addColorStop(1, `rgba(${rgb},1)`)
    ctx.fillStyle = ball
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()

    ctx.lineWidth = 0.7
    ctx.strokeStyle = `rgba(${rgb},0.72)`
    ctx.beginPath()
    ctx.arc(x, y, r * 1.55, 0, TAU)
    ctx.stroke()
  }

  /**
   * 盘心：辉光 + 三圈环 + 白心球。呼吸只改这里的半径（文件头说的「不改整盘透明度」）。
   * 中间那圈压成 0.62 的椭圆 —— 正圆转起来是看不出来的，压扁了才有转的感觉。
   */
  private paintCore(radius: number, time: number, breath: number): void {
    const { ctx } = this
    const core = radius * 0.105 * breath

    const glow = ctx.createRadialGradient(radius, radius, 0, radius, radius, core * 2.9)
    glow.addColorStop(0, `rgba(${CYAN},0.44)`)
    glow.addColorStop(0.42, `rgba(${BLUE},0.2)`)
    glow.addColorStop(1, `rgba(${BLUE},0)`)
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(radius, radius, core * 2.9, 0, TAU)
    ctx.fill()

    for (let i = 0; i < 3; i++) {
      ctx.save()
      ctx.translate(radius, radius)
      ctx.rotate(time * (i % 2 === 0 ? 0.08 : -0.06))
      if (i === 1) ctx.scale(1, 0.62)
      ctx.lineWidth = i === 0 ? 1.2 : 0.65
      ctx.strokeStyle = i === 2 ? `rgba(${VIOLET},0.58)` : `rgba(${CYAN},0.74)`
      ctx.beginPath()
      ctx.arc(0, 0, core * (1.25 + i * 0.58), 0, TAU)
      ctx.stroke()
      ctx.restore()
    }

    const ball = ctx.createRadialGradient(radius, radius, 0, radius, radius, core)
    ball.addColorStop(0, 'rgba(255,255,255,1)')
    ball.addColorStop(0.36, `rgba(${CYAN},1)`)
    ball.addColorStop(0.72, `rgba(${BLUE},1)`)
    ball.addColorStop(1, `rgba(${VIOLET},1)`)
    ctx.fillStyle = ball
    ctx.beginPath()
    ctx.arc(radius, radius, core, 0, TAU)
    ctx.fill()
  }

  /**
   * 外缘 24 颗小方块，两条轨道交替、每第 5 颗放大一点。
   * iOS 给了 0.2 边长的圆角，边长最大 2.9 px，圆角 0.6 px 画不出来，直接 fillRect。
   */
  private paintOuterNodes(radius: number, time: number): void {
    const { ctx } = this
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * TAU + time * 0.018
      const orbit = radius * (i % 2 === 0 ? 0.88 : 0.81)
      const side = i % 5 === 0 ? 2.9 : 1.55
      ctx.fillStyle = rgba(NODE_COLORS[i % 4]!, 0.92)
      ctx.fillRect(
        radius + Math.cos(angle) * orbit - side / 2,
        radius + Math.sin(angle) * orbit - side / 2,
        side,
        side,
      )
    }
  }



}

