/**
 * 放映模式的无限网格 —— 对应 iOS `Features/Community/WatchModeView.swift`。
 *
 * 「无限」不存数据：格点坐标 (q, r) 过一遍确定性哈希映射回旅人池，同一个格子
 * 永远是同一个人 —— 所以往回滑还能看见刚才那张，也不必预生成或记住位置。
 * 哈希与原型 `watchHash` 逐位一致（`Math.imul` 就是原型那套 32 位截断乘法，
 * iOS 那边用 Int32 溢出乘法手工还原了同一个式子）。三端要长得一样，改要一起改。
 *
 * 为什么整片用 canvas 画，而不是 35 个 WXML 节点：
 * 气泡的缩放与透明度跟「离屏心多远」挂钩，拖动时每一帧 35 个节点都要变 ——
 * 那就是 35 份数据 × 每帧一次 setData，真机必掉帧。canvas 一帧一次绘制，
 * 拖动全程零 setData。
 *
 * 单位直接就是 iOS 的点：canvas 的绘制单位是 CSS px，而本仓的换算基准正是
 * 「CSS px == iOS pt」（只有 rpx 要 ×1.923）。所以下面每个数字都是 iOS 原值。
 *
 * 一处刻意的实现差异：iOS 用 `.compositingGroup()` 把气泡压成一层再打阴影，
 * 免得 shadow 对内部每个图元各模糊一次；canvas 这边的等价做法是把气泡（连阴影）
 * 一次性画进离屏画布、按旅人缓存，每帧只 drawImage —— 同一个意图，顺带把渐变
 * 与文字排版也从「每帧 35 次」降到「每人一次」。
 */

import { reduceMotion } from '../../../core/design/motion'
import type { Traveler } from '../../../core/models'

/** 错位网格：横向步距 / 纵向步距 / 可见列 / 可见行（iOS dx / dy / cols / rows） */
const DX = 160
const DY = 184
const COLS = 7
const ROWS = 5

/** 气泡直径，与离屏贴图给阴影留的边（iOS shadow radius 14 + y 10，28 够用） */
const BUBBLE = 154
const PAD = 28
const TILE = BUBBLE + PAD * 2

/** 贴图缓存的条数上限，见 tileFor */
const TILE_CACHE_MAX = 48

/** 距屏心多远算完全失焦（iOS `focus = max(0, 1 - dist / 460)`） */
const FOCUS_RANGE = 460

/**
 * 惯性与吸附。iOS 走 8ms 一步（0.94 衰减 / 0.095 插值），这里跑在 ~16ms 的
 * RAF 上，所以换成等效的每帧值：0.94² ≈ 0.88，1 - (1 - 0.095)² ≈ 0.18。
 */
const FRICTION = 0.88
const SETTLE = 0.18
/** 惯性收尾阈值：iOS 的 0.3 是 8ms 位移，16ms 位移的等价值是 0.6 */
const INERTIA_STOP = 0.6
const SETTLE_STOP = 0.7

/** 静止时按 iOS 的 `TimelineView(.animation(minimumInterval: 1/20))` 重画：
    背景万花筒还在转，但没必要 60fps */
const IDLE_MS = 50

/** 搜索重定位的最大扫描环数（iOS `for radius in 0...10`） */
const SEARCH_RINGS = 10

/** 背景万花筒转一圈的秒数（iOS 32） */
const SPIN_SECONDS = 32

/**
 * canvas 取不到 CSS 变量，所以配色在这里落一份字面值 —— 与 `orb` 组件的画布
 * 配色同样处理。右侧标注它在 `core/design/tokens.wxss` 里的对应变量，改色两边一起改。
 */
const HUES: { grad: [string, string, string]; accent: string }[] = [
  { grad: ['#0f1f52', '#2e5edb', '#6fa5ff'], accent: '#3d6ef0' }, // --hue0-g / --hue0-accent
  { grad: ['#3a1035', '#b03390', '#f06acd'], accent: '#c445a4' }, // --hue1-g / --hue1-accent
  { grad: ['#0e2a22', '#1f8a66', '#8fd84b'], accent: '#2fa98c' }, // --hue2-g / --hue2-accent
  { grad: ['#3a140c', '#d14a24', '#ff8a54'], accent: '#e85a34' }, // --hue3-g / --hue3-accent
  { grad: ['#171243', '#4a3bd1', '#8f7bff'], accent: '#6e58e8' }, // --hue4-g / --hue4-accent
]

/** 背景三团光（iOS stageBackground 的三个 RadialGradient）：中心用相对坐标，
    半径按 iOS 那块 390×548 的取景框等比放大到实际画布 */
const GLOWS: { ux: number; uy: number; r: number; color: string }[] = [
  { ux: 0.5, uy: 0.47, r: 210, color: '94,150,255' }, // --blue
  { ux: 0.14, uy: 0.18, r: 180, color: '227,92,193' }, // --magenta
  { ux: 0.9, uy: 0.8, r: 165, color: '62,217,164' }, // --teal
]
const GLOW_ALPHA = [0.11, 0.06, 0.04]

/** 背景万花筒的两圈弧段（iOS kaleidoBackdrop 的 trim 区间与配色） */
const RING_D = [218, 316]
const ARCS: { from: number; to: number; color: string }[] = [
  { from: 0.09, to: 0.12, color: 'rgba(94,150,255,0.4)' },
  { from: 0.27, to: 0.3, color: 'rgba(227,92,193,0.32)' },
  { from: 0.46, to: 0.49, color: 'rgba(255,122,77,0.28)' },
  { from: 0.68, to: 0.71, color: 'rgba(143,123,255,0.35)' },
]

/** 气泡内壁那圈流光（iOS 的 AngularGradient）。canvas 2d 没有 conic 渐变，
    用三段定透明度的弧近似 —— 这一层本来就很淡，逐段渐隐看不出差别，
    而按角度插值要几十次描边 × 35 颗。 */
const RIM: { from: number; to: number; color: string }[] = [
  { from: 0.0, to: 0.18, color: 'rgba(255,255,255,0.1)' },
  { from: 0.35, to: 0.58, color: 'rgba(255,255,255,0.04)' },
  { from: 0.78, to: 1.0, color: '' }, // 空 = 用色相辉光，见 paintTile
]

/** 气泡里的四颗小星点（iOS sparkles：相对 154 方框的位置、半径、是否用色相色） */
const SPARKS: { ux: number; uy: number; r: number; hue: boolean }[] = [
  { ux: 0.23, uy: 0.35, r: 1, hue: false },
  { ux: 0.76, uy: 0.27, r: 0.8, hue: false },
  { ux: 0.68, uy: 0.68, r: 0.7, hue: false },
  { ux: 0.35, uy: 0.78, r: 0.8, hue: true },
]

const TAU = Math.PI * 2

export interface WatchUser {
  key: string
  traveler: Traveler
  /** 世界坐标（pt） */
  wx: number
  wy: number
}

type Ctx2D = WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D

/**
 * 格点 → 旅人池下标。与原型 `watchHash` / iOS `hash(q:r:)` 逐位一致：
 * `Math.imul` 保证 32 位截断乘法，`>>> ` 保证逻辑右移（不带符号位）。
 */
function hash(q: number, r: number): number {
  let h = Math.imul(q, 73856093) ^ Math.imul(r, 19349663) ^ Math.imul(1, 83492791)
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  const u = h >>> 0
  return (u ^ (u >>> 16)) >>> 0
}

/** `#rrggbb` → `"r,g,b"`，方便拼各种 alpha 的 rgba() */
function channels(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

function rgba(hex: string, alpha: number): string {
  return `rgba(${channels(hex)},${alpha})`
}

/**
 * 一团径向辉光。两端必须是同一个 rgb 只改 alpha —— 收尾写 `transparent`
 * 在部分实现里会插值到透明黑，中段发灰。
 */
function paintRadial(c: Ctx2D, x: number, y: number, r: number, rgb: string, alpha: number): void {
  const grad = c.createRadialGradient(x, y, 0, x, y, r)
  grad.addColorStop(0, `rgba(${rgb},${alpha})`)
  grad.addColorStop(1, `rgba(${rgb},0)`)
  c.fillStyle = grad
  c.beginPath()
  c.arc(x, y, r, 0, TAU)
  c.fill()
}

/** 按字断行（中文没有词边界），最多 maxLines 行，末行超出补省略号 */
function wrapText(ctx: Ctx2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    if (ctx.measureText(line + ch).width <= maxWidth) {
      line += ch
      continue
    }
    if (lines.length === maxLines - 1) {
      // 末行放不下了：退一个字换省略号，避免把「…」也挤出去
      while (line && ctx.measureText(`${line}…`).width > maxWidth) line = line.slice(0, -1)
      lines.push(`${line}…`)
      return lines
    }
    lines.push(line)
    line = ch
  }
  if (line) lines.push(line)
  return lines
}

/** 单行截断（iOS `.lineLimit(1)` + 默认尾部省略） */
function clampLine(ctx: Ctx2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let out = text
  while (out && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1)
  return `${out}…`
}

/** 胶囊路径（canvas 2d 的 roundRect 不保证可用，手画两个半圆） */
function capsule(ctx: Ctx2D, x: number, y: number, w: number, h: number): void {
  const r = h / 2
  ctx.beginPath()
  ctx.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5)
  ctx.arc(x + w - r, y + r, r, Math.PI * 1.5, Math.PI / 2)
  ctx.closePath()
}

export class WatchField {
  private travelers: Traveler[]
  private query = ''

  /** 世界偏移（pt）：所有气泡一起动的那个量（iOS `offset`） */
  private ox = 0
  private oy = 0
  /** 惯性的每帧位移（iOS `momentum`） */
  private mx = 0
  private my = 0
  private mode: 'idle' | 'drag' | 'inertia' | 'settle' = 'idle'
  private targetX = 0
  private targetY = 0

  /** 拖拽起点：手指位置与当时的偏移，加上算速度用的上一帧采样 */
  private grabX = 0
  private grabY = 0
  private baseX = 0
  private baseY = 0
  private lastX = 0
  private lastY = 0
  private lastAt = 0
  private vx = 0
  private vy = 0
  private travel = 0

  private rafId?: number
  private lastDraw = 0
  private readonly startedAt = Date.now()
  /** 按旅人缓存的气泡贴图（含阴影），见文件头 */
  private readonly tiles = new Map<number, WechatMiniprogram.OffscreenCanvas>()

  constructor(
    private readonly canvas: WechatMiniprogram.Canvas,
    private readonly ctx: Ctx2D,
    private readonly dpr: number,
    private width: number,
    private height: number,
    travelers: Traveler[],
  ) {
    this.travelers = travelers
  }

  // ── 外部输入 ──

  /** 远端旅人回来了就换池子；空数组不换（宁可继续放本地兜底的那批） */
  setTravelers(list: Traveler[]): void {
    if (list.length === 0) return
    this.travelers = list
    this.tiles.clear()
    this.wake()
  }

  /** 搜索词变了：把最近的一个匹配挪到屏心（iOS `recenterOnSearch`） */
  setQuery(query: string): void {
    this.query = query.trim()
    const target = this.searchTarget()
    if (target) {
      this.targetX = target.x
      this.targetY = target.y
      this.mode = 'settle'
    }
    this.wake()
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.wake()
  }

  // ── 手势 ──

  dragStart(x: number, y: number): void {
    this.mode = 'drag'
    this.grabX = x
    this.grabY = y
    this.baseX = this.ox
    this.baseY = this.oy
    this.lastX = x
    this.lastY = y
    this.lastAt = Date.now()
    this.vx = 0
    this.vy = 0
    this.travel = 0
    this.wake()
  }

  dragMove(x: number, y: number): void {
    if (this.mode !== 'drag') return
    this.ox = this.baseX + (x - this.grabX)
    this.oy = this.baseY + (y - this.grabY)
    this.travel = Math.max(this.travel, Math.hypot(x - this.grabX, y - this.grabY))

    // 速度取最近一段的平均：单帧差分在低帧率下会算出离谱的初速
    const now = Date.now()
    const dt = now - this.lastAt
    if (dt >= 12) {
      this.vx = ((x - this.lastX) / dt) * 1000
      this.vy = ((y - this.lastY) / dt) * 1000
      this.lastX = x
      this.lastY = y
      this.lastAt = now
    }
  }

  /** 松手：甩出去接惯性。返回 true 表示这一下是「拖」而不是「点」 */
  dragEnd(): boolean {
    if (this.mode !== 'drag') return false
    const dragged = this.travel > 6
    if (dragged) {
      this.mx = this.vx * 0.016
      this.my = this.vy * 0.016
      this.mode = 'inertia'
    } else {
      this.mode = 'idle'
    }
    this.wake()
    return dragged
  }

  /** 点到了哪颗气泡：取命中里离屏心最近的那颗（就是画在最上面的那颗） */
  hitTest(x: number, y: number): Traveler | null {
    const cx = this.width / 2
    const cy = this.height / 2
    let best: { traveler: Traveler; dist: number } | null = null
    for (const user of this.visible()) {
      const bx = cx + user.wx + this.ox
      const by = cy + user.wy + this.oy
      const dist = Math.hypot(bx - cx, by - cy)
      const scale = 0.62 + Math.max(0, 1 - dist / FOCUS_RANGE) * 0.58
      if (Math.hypot(x - bx, y - by) > (BUBBLE / 2) * scale) continue
      if (!best || dist < best.dist) best = { traveler: user.traveler, dist }
    }
    return best?.traveler ?? null
  }

  // ── 帧循环 ──

  /** 有事发生就把循环叫醒（静置状态下循环是停着的） */
  wake(): void {
    if (this.rafId !== undefined) return
    this.rafId = this.canvas.requestAnimationFrame(() => this.tick())
  }

  stop(): void {
    if (this.rafId === undefined) return
    this.canvas.cancelAnimationFrame(this.rafId)
    this.rafId = undefined
  }

  private tick(): void {
    this.rafId = undefined
    this.step()

    const now = Date.now()
    const busy = this.mode !== 'idle'
    if (busy || now - this.lastDraw >= IDLE_MS) {
      this.lastDraw = now
      this.draw(now)
    }

    // 静置且关了动效就真的停下来：背景不转，再画也是同一帧
    if (busy || !reduceMotion()) this.wake()
  }

  private step(): void {
    if (this.mode === 'inertia') {
      this.ox += this.mx
      this.oy += this.my
      this.mx *= FRICTION
      this.my *= FRICTION
      if (Math.abs(this.mx) + Math.abs(this.my) <= INERTIA_STOP) this.startSettle()
      return
    }
    if (this.mode === 'settle') {
      this.ox += (this.targetX - this.ox) * SETTLE
      this.oy += (this.targetY - this.oy) * SETTLE
      if (Math.hypot(this.targetX - this.ox, this.targetY - this.oy) <= SETTLE_STOP) {
        this.ox = this.targetX
        this.oy = this.targetY
        this.mode = 'idle'
      }
    }
  }

  /** 惯性停下后吸附到最近的格点，让总有一颗气泡正对屏心（iOS `snapToNearest`） */
  private startSettle(): void {
    this.mx = 0
    this.my = 0
    let nearest: WatchUser | null = null
    let best = Number.POSITIVE_INFINITY
    for (const user of this.visible()) {
      const dist = Math.hypot(user.wx + this.ox, user.wy + this.oy)
      if (dist < best) {
        best = dist
        nearest = user
      }
    }
    if (!nearest) {
      this.mode = 'idle'
      return
    }
    this.targetX = -nearest.wx
    this.targetY = -nearest.wy
    this.mode = 'settle'
  }

  // ── 网格 ──

  private userAt(q: number, r: number): WatchUser {
    const list = this.travelers
    // 池子非空由构造与 setTravelers 保证（本地兜底那批就有 20 人）
    const traveler = list[hash(q, r) % list.length]!
    // 奇数列往下错半格，横滑时才不是一条条直线（iOS qOffset）
    const stagger = (Math.abs(q) % 2) * (DY / 2)
    return { key: `${q}:${r}`, traveler, wx: q * DX, wy: r * DY + stagger }
  }

  /** 屏心附近 7×5 个格点（iOS `visibleUsers`） */
  private visible(): WatchUser[] {
    const out: WatchUser[] = []
    const centerQ = Math.round(-this.ox / DX)
    const halfCols = (COLS - 1) / 2
    const halfRows = (ROWS - 1) / 2
    for (let dq = -halfCols; dq <= halfCols; dq += 1) {
      const q = centerQ + dq
      const stagger = (Math.abs(q) % 2) * (DY / 2)
      const centerR = Math.round((-this.oy - stagger) / DY)
      for (let dr = -halfRows; dr <= halfRows; dr += 1) out.push(this.userAt(q, centerR + dr))
    }
    return out
  }

  private matches(user: WatchUser): boolean {
    if (!this.query) return false
    const t = user.traveler
    const hay = [t.name, t.bio, t.quote, ...t.tags].join(' ').toLowerCase()
    return hay.includes(this.query.toLowerCase())
  }

  /**
   * 一圈圈往外找最近的匹配格点，返回把它挪到屏心所需的偏移。
   * 找不到就返回 null（iOS 同样是「找不到就不动」，而不是清空视野）。
   */
  private searchTarget(): { x: number; y: number } | null {
    if (!this.query) return null
    const centerQ = Math.round(-this.ox / DX)
    const centerR = Math.round(-this.oy / DY)
    for (let radius = 0; radius <= SEARCH_RINGS; radius += 1) {
      for (let dq = -radius; dq <= radius; dq += 1) {
        for (let dr = -radius; dr <= radius; dr += 1) {
          // 只看这一环的边（内圈上一轮已经找过了）
          if (Math.max(Math.abs(dq), Math.abs(dr)) !== radius) continue
          const user = this.userAt(centerQ + dq, centerR + dr)
          if (this.matches(user)) return { x: -user.wx, y: -user.wy }
        }
      }
    }
    return null
  }

  // ── 绘制 ──

  /**
   * 一帧。层序与 iOS 的 ZStack 自下而上一致：
   * 三团光 → 万花筒双环 → 中心微光与刻度 → 气泡（远→近）→ 边缘渐隐。
   */
  private draw(now: number): void {
    const { ctx, width: w, height: h } = this
    const cx = w / 2
    const cy = h / 2

    ctx.clearRect(0, 0, w, h)
    this.paintGlows(w, h)
    this.paintKaleido(cx, cy, now)
    this.paintCenterRing(cx, cy)

    const users = this.visible()
    const focusKey = this.focusKey(users)
    // 远的先画，近的压在上面 —— 等价于 iOS 按 dist 分桶的 zIndex
    const ordered = users
      .map((user) => ({ user, dist: Math.hypot(user.wx + this.ox, user.wy + this.oy) }))
      .sort((a, b) => b.dist - a.dist)

    for (const { user, dist } of ordered) {
      const focus = Math.max(0, 1 - dist / FOCUS_RANGE)
      // 搜索中不匹配的人压到 0.06，与 iOS 一致（不隐藏，留出「它还在那」的暗示）
      const dim = this.query.length > 0 && !this.matches(user)
      ctx.globalAlpha = dim ? 0.06 : 0.28 + focus * 0.72
      const scale = 0.62 + focus * 0.58
      const size = TILE * scale
      const bx = cx + user.wx + this.ox
      const by = cy + user.wy + this.oy
      ctx.drawImage(this.tileFor(user.traveler), bx - size / 2, by - size / 2, size, size)
      if (user.key === focusKey && !dim) this.paintFocus(bx, by, (BUBBLE / 2) * scale, user.traveler)
    }
    ctx.globalAlpha = 1

    this.paintVignette(cx, cy, w, h)
  }

  /** 焦点是「离屏心最近的匹配气泡」；没搜索时就是最近的那颗（iOS focusKey） */
  private focusKey(users: WatchUser[]): string | null {
    let key: string | null = null
    let best = Number.POSITIVE_INFINITY
    for (const user of users) {
      if (this.query.length > 0 && !this.matches(user)) continue
      const dist = Math.hypot(user.wx + this.ox, user.wy + this.oy)
      if (dist < best) {
        best = dist
        key = user.key
      }
    }
    return key
  }

  /**
   * 焦点气泡的两笔现画：更浓的色相辉光 + 更亮的外描边（iOS 的第二道 shadow
   * 与 isFocus 描边）。只有一颗，不值得为它多缓存一整套贴图 —— 见 tileFor。
   */
  private paintFocus(bx: number, by: number, r: number, traveler: Traveler): void {
    const { ctx } = this
    const hue = HUES[((traveler.hue % HUES.length) + HUES.length) % HUES.length]!
    paintRadial(ctx, bx, by, r + 22, channels(hue.accent), 0.42)
    ctx.strokeStyle = 'rgba(222,233,255,0.78)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(bx, by, r - 0.5, 0, TAU)
    ctx.stroke()
  }

  private paintGlows(w: number, h: number): void {
    const { ctx } = this
    const scale = Math.max(w / 390, h / 548)
    GLOWS.forEach((glow, i) => {
      const x = w * glow.ux
      const y = h * glow.uy
      const r = glow.r * scale
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, `rgba(${glow.color},${GLOW_ALPHA[i]})`)
      grad.addColorStop(1, `rgba(${glow.color},0)`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    })
  }

  /** 双细环上的四段彩弧，32 秒一圈（iOS kaleidoBackdrop，整组 opacity 0.16） */
  private paintKaleido(cx: number, cy: number, now: number): void {
    const { ctx } = this
    const spin = reduceMotion()
      ? 0
      : (((now - this.startedAt) / 1000) % SPIN_SECONDS) / SPIN_SECONDS
    // iOS 的 trim 从 12 点起算，canvas 的 0 弧度在 3 点 —— 差的这 90° 要补回来
    const base = spin * TAU - Math.PI / 2
    ctx.save()
    ctx.globalAlpha = 0.16
    ctx.lineWidth = 4.5
    ctx.lineCap = 'round'
    for (const diameter of RING_D) {
      for (const seg of ARCS) {
        ctx.strokeStyle = seg.color
        ctx.beginPath()
        ctx.arc(cx, cy, diameter / 2, base + seg.from * TAU, base + seg.to * TAU)
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  /**
   * 中心微光 + 两根刻度。iOS 那圈描边是 blur(17) 出来的，canvas 没有 filter，
   * 改用一条「由内向外淡出」的宽径向渐变环 —— 同样是一圈看不出边界的蓝雾。
   */
  private paintCenterRing(cx: number, cy: number): void {
    const { ctx } = this
    const grad = ctx.createRadialGradient(cx, cy, 62, cx, cy, 112)
    grad.addColorStop(0, 'rgba(94,150,255,0)')
    grad.addColorStop(0.55, 'rgba(94,150,255,0.1)')
    grad.addColorStop(1, 'rgba(94,150,255,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, 112, 0, TAU)
    ctx.fill()

    ctx.fillStyle = 'rgba(157,188,255,0.3)'
    ctx.fillRect(cx - 0.5, cy - 102, 1, 7)
    ctx.fillRect(cx - 102, cy - 0.5, 7, 1)
  }

  /**
   * 边缘渐隐（iOS 那层 RadialGradient mask / 原型的 mask-image）。
   * `destination-in` 用渐变的 alpha 去乘已画好的整帧，等价于蒙版。
   */
  private paintVignette(cx: number, cy: number, w: number, h: number): void {
    const { ctx } = this
    const r = Math.max(w, h) * (340 / 548)
    const grad = ctx.createRadialGradient(cx, h * 0.48, 0, cx, h * 0.48, r)
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(0.64, 'rgba(0,0,0,1)')
    grad.addColorStop(0.78, 'rgba(0,0,0,0.76)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.save()
    ctx.globalCompositeOperation = 'destination-in'
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  // ── 气泡贴图 ──

  /**
   * 取某个旅人的气泡贴图，没有就画一张缓存起来（见文件头）。
   *
   * 焦点态没有单独缓存：焦点气泡永远只有一颗，为它多存一整套贴图不值当，
   * 而且焦点的可见差别就是外圈那道亮描边与更浓的辉光 —— 那两笔现画很便宜，
   * 由 `paintFocus` 每帧叠在贴图上。iOS 的 brightness/saturation 提亮没有跟：
   * canvas 2d 没有等价滤镜，而在已经压深的玻璃底上，肉眼分辨不出那 9%。
   */
  private tileFor(traveler: Traveler): WechatMiniprogram.OffscreenCanvas {
    const cached = this.tiles.get(traveler.id)
    if (cached) return cached
    // 池子大小由内容运营定，理论上无上限；缓存超过这个数就整体丢掉重建 ——
    // 一屏最多 35 张，48 够覆盖一屏加余量，比逐条 LRU 简单且够用。
    if (this.tiles.size >= TILE_CACHE_MAX) this.tiles.clear()
    const tile = this.paintTile(traveler)
    this.tiles.set(traveler.id, tile)
    return tile
  }

  /** 贴图的像素倍率：够 1.2 倍放大不虚，又不至于在 3 倍屏上占满内存 */
  private get ss(): number {
    return Math.min(this.dpr, 2)
  }

  private paintTile(traveler: Traveler): WechatMiniprogram.OffscreenCanvas {
    const ss = this.ss
    const off = wx.createOffscreenCanvas({ type: '2d', width: TILE * ss, height: TILE * ss })
    const c = off.getContext('2d') as Ctx2D
    c.scale(ss, ss)

    const hue = HUES[((traveler.hue % HUES.length) + HUES.length) % HUES.length]!
    const mid = TILE / 2
    const radius = BUBBLE / 2

    // 落影：iOS 那两道 shadow 里的黑色那道，先烘进贴图（彩色那道随焦点态现画）
    c.save()
    c.shadowColor = 'rgba(0,0,0,0.8)'
    c.shadowBlur = 14
    c.shadowOffsetY = 10
    c.fillStyle = 'rgba(0,0,0,1)'
    c.beginPath()
    c.arc(mid, mid, radius, 0, TAU)
    c.fill()
    c.restore()

    // 以下都裁在圆里（iOS `.clipShape(Circle())`）
    c.save()
    c.beginPath()
    c.arc(mid, mid, radius, 0, TAU)
    c.clip()

    const glass = c.createLinearGradient(mid - radius, mid - radius, mid + radius, mid + radius)
    glass.addColorStop(0, 'rgba(29,38,64,0.58)')
    glass.addColorStop(1, 'rgba(8,11,24,0.38)')
    c.fillStyle = glass
    c.fillRect(mid - radius, mid - radius, BUBBLE, BUBBLE)

    // 左上白高光 + 右下色相辉光（iOS 的两层 RadialGradient）
    paintRadial(c, mid - radius + BUBBLE * 0.25, mid - radius + BUBBLE * 0.16, 42, '255,255,255', 0.16)
    const accent = channels(hue.accent)
    paintRadial(c, mid - radius + BUBBLE * 0.78, mid - radius + BUBBLE * 0.76, 80, accent, 0.24)

    this.paintContent(c, traveler, mid)
    c.restore()

    // 内圈流光与星点在裁剪之外画（都在圆内，且描边要压在内容之上）
    c.save()
    c.lineWidth = 1.2
    // iOS AngularGradient 的起始角是 30°，canvas 的 0 在 3 点，再补 -90°
    const rimBase = (30 - 90) * (Math.PI / 180)
    for (const seg of RIM) {
      c.strokeStyle = seg.color || rgba(hue.accent, 0.22)
      c.beginPath()
      c.arc(mid, mid, radius - 3.6, rimBase + seg.from * TAU, rimBase + seg.to * TAU)
      c.stroke()
    }
    c.restore()

    const sparkAlpha = [0.86, 0.55, 0.62, 0.9]
    SPARKS.forEach((spark, i) => {
      c.fillStyle = spark.hue ? rgba(hue.accent, sparkAlpha[i]!) : `rgba(255,255,255,${sparkAlpha[i]})`
      c.beginPath()
      c.arc(mid - radius + BUBBLE * spark.ux, mid - radius + BUBBLE * spark.uy, spark.r, 0, TAU)
      c.fill()
    })

    // 常态外描边（焦点那道更亮的由 paintFocus 现画）
    c.strokeStyle = 'rgba(207,224,255,0.23)'
    c.lineWidth = 1
    c.beginPath()
    c.arc(mid, mid, radius - 0.5, 0, TAU)
    c.stroke()

    return off
  }

  /**
   * 气泡里的内容：头像 · 名字 · 一句介绍 · 最多两个标签。
   *
   * iOS 那边是 VStack 自然堆叠、整块居中；canvas 要自己排版，所以先按各行高度
   * 算出总高再定顶边 —— 只有这样「介绍一行」和「介绍两行」的气泡看起来才都是居中的。
   */
  private paintContent(c: Ctx2D, traveler: Traveler, mid: number): void {
    const AVATAR = 43
    const NAME_H = 15
    const BIO_LINE = 12
    const TAG_H = 15

    c.textAlign = 'center'
    c.textBaseline = 'middle'

    c.font = '9px sans-serif'
    const bio = wrapText(c, traveler.bio, 112, 2)
    const tags = traveler.tags.slice(0, 2)

    let total = AVATAR + 4 + NAME_H + 3 + bio.length * BIO_LINE
    if (tags.length > 0) total += 5 + TAG_H
    let y = mid - total / 2

    // 头像：色相渐变底 + 白圈 + 首字。iOS 有真人照片兜底到首字，小程序端
    // 没有打包这批 mock 图（也不该为放映模式单独引 16 张图进包），一律画首字。
    const hue = HUES[((traveler.hue % HUES.length) + HUES.length) % HUES.length]!
    const ax = mid
    const ay = y + AVATAR / 2
    const avatarGrad = c.createLinearGradient(
      ax - AVATAR / 2,
      ay - AVATAR / 2,
      ax + AVATAR / 2,
      ay + AVATAR / 2,
    )
    avatarGrad.addColorStop(0, hue.grad[0])
    avatarGrad.addColorStop(0.55, hue.grad[1])
    avatarGrad.addColorStop(1, hue.grad[2])
    c.save()
    c.shadowColor = 'rgba(0,0,0,0.4)'
    c.shadowBlur = 5
    c.shadowOffsetY = 3
    c.fillStyle = avatarGrad
    c.beginPath()
    c.arc(ax, ay, AVATAR / 2, 0, TAU)
    c.fill()
    c.restore()
    c.strokeStyle = 'rgba(255,255,255,0.82)'
    c.lineWidth = 1.5
    c.beginPath()
    c.arc(ax, ay, AVATAR / 2 - 0.75, 0, TAU)
    c.stroke()
    c.fillStyle = '#ffffff'
    c.font = '600 15.5px sans-serif'
    c.fillText(traveler.initial, ax, ay)
    y += AVATAR + 4

    // 名字：iOS 给了一道黑色投影把字从玻璃底上拎出来
    c.save()
    c.shadowColor = 'rgba(0,0,0,0.65)'
    c.shadowBlur = 4
    c.shadowOffsetY = 2
    c.fillStyle = '#ffffff'
    c.font = 'bold 12.5px sans-serif'
    c.fillText(clampLine(c, traveler.name, 114), mid, y + NAME_H / 2)
    c.restore()
    y += NAME_H + 3

    c.fillStyle = 'rgba(238,243,255,0.82)'
    c.font = '9px sans-serif'
    for (const line of bio) {
      c.fillText(line, mid, y + BIO_LINE / 2)
      y += BIO_LINE
    }

    if (tags.length === 0) return
    y += 5
    c.font = '7.5px sans-serif'
    const widths = tags.map((tag) => Math.min(c.measureText(tag).width + 10, 54))
    const totalW = widths.reduce((a, b) => a + b, 0) + (tags.length - 1) * 4
    let tx = mid - totalW / 2
    tags.forEach((tag, i) => {
      const w = widths[i]!
      capsule(c, tx, y, w, TAG_H)
      c.fillStyle = 'rgba(214,226,255,0.12)'
      c.fill()
      c.strokeStyle = 'rgba(223,233,255,0.1)'
      c.lineWidth = 1
      c.stroke()
      c.fillStyle = '#e1e9ff'
      c.fillText(clampLine(c, tag, w - 10), tx + w / 2, y + TAG_H / 2)
      tx += w + 4
    })
  }
}
