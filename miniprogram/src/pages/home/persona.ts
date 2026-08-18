/**
 * 画像驱动的抽象数字形象 —— 对应 iOS `Features/Home/PersonaCanvasView.swift`。
 *
 * 由画像快照文本 FNV-1a 哈希 + 关键词计分选出 4 种形态之一：
 * 折光晶灵（crystal）/ 共生花灵（bloom）/ 流光翼影（wing）/ 星轨旅者（orbit）。
 * mulberry32 种子随机保证同一画像稳定复现。
 *
 * 几何数值全部照抄 iOS（它又照抄原型 `drawDynamicPersona`）—— 单位是「点」，
 * 而小程序 canvas 的 CSS px 与 iOS 的点是同一套逻辑像素，所以数字可以直接搬，
 * 前提是舞台高度也用 px 而不是 rpx（见 components/persona-stage/index.wxss）。
 *
 * ⚠️ 改这里的任何常量都要同步改 iOS 与原型：同一个人在三端应该长得一模一样，
 * 形态不一致会直接破坏「这是我的形象」这件事。
 */

export type PersonaForm = 'crystal' | 'bloom' | 'wing' | 'orbit'

export interface PersonaModel {
  seed: number
  filled: number
  signature: string[]
  form: PersonaForm
  hue: number
  lobes: number
  shapeName: string
}

/** FNV-1a 32 位哈希（对照原型 dynamicPersonaHash，逐 UTF-16 码元）。
 *  `charCodeAt` 给的就是 UTF-16 码元，与 Swift 的 `String.utf16` 同源。 */
function fnv1a(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash ^ text.charCodeAt(i)) >>> 0
    // 32 位截断乘法：直接 `*` 会进入双精度，高位丢失后与 iOS/原型对不上
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}

/** 形态信号表：关键词 → (色相, 波瓣数, 形态名)，与 iOS `signals` 逐项一致 */
const SIGNALS: { form: PersonaForm; words: string[]; hue: number; lobes: number; name: string }[] = [
  {
    form: 'crystal',
    words: ['结构', '有序', '计划', '理性', '思考', '分析', '原则', '边界', '才华', '智商'],
    hue: 216,
    lobes: 6,
    name: '折光晶灵',
  },
  {
    form: 'bloom',
    words: ['共情', '陪伴', '关系', '家庭', '亲情', '朋友', '人际', '真诚', '尊重', '回应', '交流', '支持', '爱', '善良', '信任'],
    hue: 286,
    lobes: 7,
    name: '共生花灵',
  },
  {
    form: 'wing',
    words: ['视觉', '手绘', '创造', '审美', '表达', '自由', '好奇', '喜欢'],
    hue: 190,
    lobes: 4,
    name: '流光翼影',
  },
  {
    form: 'orbit',
    words: ['独处', '探索', '学习', '尝试', '成长', '行动', '勇气', '坚强'],
    hue: 248,
    lobes: 5,
    name: '星轨旅者',
  },
]

/** 由画像内容构建（对照 iOS `PersonaModel.build`） */
export function buildPersona(values: string[], signature: string[]): PersonaModel {
  const all = values.concat(signature)
  const text = all.join('|')
  const seed = fnv1a(text === '' ? '老己·持续探索' : text)
  const content = all.join(' ')

  const scored = SIGNALS.map((s) => ({
    ...s,
    score: s.words.reduce((sum, w) => sum + content.split(w).length - 1, 0),
  }))
  const top = scored.reduce((m, s) => Math.max(m, s.score), 0)
  const candidates = scored.filter((s) => s.score === top)
  // 平票时用种子挑，而不是取第一个 —— 否则空画像的所有人都会拿到同一个形态
  const pick = candidates[seed % candidates.length] ?? scored[0]!

  return {
    seed,
    filled: values.length,
    signature,
    form: pick.form,
    hue: pick.hue + ((seed % 23) - 11),
    lobes: pick.lobes,
    shapeName: pick.name,
  }
}

/** meta 文案（对照 iOS `PersonaStageView.metaText`） */
export function personaMeta(model: PersonaModel, summary?: string | null): string {
  if (summary) return `${model.shapeName} · ${summary}`
  const count = model.filled + model.signature.length
  return count > 0
    ? `${model.shapeName} · 根据下方 ${count} 组画像内容生成`
    : '由当前画像维度生成 · 持续生长'
}

/* ============ 绘制 ============ */

/** mulberry32 种子随机（对照原型 dynamicPersonaRandom）。
 *  每帧都要从同一个种子重新起随机流，微尘与粒子的位置才不会逐帧乱跳。 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1) >>> 0
    t = (((t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0) ^ t) >>> 0
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** hsla 字符串（原型全程用 hsl 色域；s/l 传 0..1，这里换算成百分号） */
function hsla(h: number, s: number, l: number, a: number): string {
  const hue = ((h % 360) + 360) % 360
  return `hsla(${hue.toFixed(2)}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%, ${a.toFixed(3)})`
}

type Ctx2D = WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D
/* 小程序类型里没有全局 CanvasGradient，从方法返回值反推 */
type Gradient = ReturnType<Ctx2D["createRadialGradient"]>

function ellipse(ctx: Ctx2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath()
  ctx.ellipse(x, y, Math.max(rx, 0.01), Math.max(ry, 0.01), 0, 0, Math.PI * 2)
}

/** 形体的填充渐变（iOS `formShading`）；wing 在镜像坐标系里复用，所以圆心可传 */
function formShading(ctx: Ctx2D, hue: number, ox: number, oy: number): Gradient {
  const g = ctx.createRadialGradient(ox, oy, 2, ox, oy, 76)
  g.addColorStop(0, 'rgba(247,250,255,0.9)')
  g.addColorStop(0.16, hsla(hue + 34, 1, 0.8, 0.72))
  g.addColorStop(0.55, hsla(hue, 0.95, 0.6, 0.28))
  g.addColorStop(1, hsla(hue - 24, 0.9, 0.42, 0.04))
  return g
}

/**
 * 画一帧（对照 iOS `PersonaCanvasView.draw`，8 层顺序不能改）。
 *
 * @param t 毫秒。`reduceMotion` 时传 0 —— 与 iOS 一样静置成形而不是不画。
 */
export function drawPersona(ctx: Ctx2D, w: number, h: number, model: PersonaModel, t: number): void {
  ctx.clearRect(0, 0, w, h)

  const rand = mulberry32(model.seed)
  const cx = w * 0.5
  const cy = h * 0.48
  const breathe = 1 + Math.sin(t * 0.00105) * 0.035
  const hue = model.hue

  // plusLighter：所有层加色叠加，粒子与光晕相交处自然发亮
  ctx.globalCompositeOperation = 'lighter'

  // ── 1. 背景微尘 ──
  for (let i = 0; i < 72; i += 1) {
    const x = rand() * w
    const y = rand() * h
    const s = 0.35 + rand() * 1.25
    const drift = Math.sin(t * 0.00035 + i) * 2.5
    ctx.fillStyle = hsla(hue + (rand() - 0.5) * 75, 0.9, 0.72, 0.1 + rand() * 0.34)
    ctx.fillRect(x + drift, y, s, s)
  }

  // ── 2. aura 呼吸光晕 ──
  const aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, 92)
  aura.addColorStop(0, hsla(hue + 28, 1, 0.76, 0.42))
  aura.addColorStop(0.42, hsla(hue, 0.95, 0.57, 0.16))
  aura.addColorStop(1, hsla(hue - 22, 0.9, 0.42, 0))
  ctx.fillStyle = aura
  ellipse(ctx, cx, cy, 92 * breathe, 70 * breathe)
  ctx.fill()

  const stroke = hsla(hue + 24, 1, 0.84, 0.66)

  // ── 3. 形体 ──
  ctx.lineWidth = 1.15
  switch (model.form) {
    case 'crystal': {
      ctx.beginPath()
      for (let i = 0; i < 16; i += 1) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 8
        const radius = (i % 2 === 1 ? 46 : 68) * (1 + (i % 4 === 0 ? 0.15 : 0)) * breathe
        const px = cx + Math.cos(angle) * radius
        const py = cy + Math.sin(angle) * radius * 0.86
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fillStyle = formShading(ctx, hue, cx - 18, cy - 24)
      ctx.fill()
      ctx.strokeStyle = stroke
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(cx, cy - 43)
      ctx.lineTo(cx + 34, cy)
      ctx.lineTo(cx, cy + 48)
      ctx.lineTo(cx - 34, cy)
      ctx.closePath()
      ctx.strokeStyle = hsla(hue + 54, 1, 0.9, 0.48)
      ctx.stroke()
      break
    }

    case 'bloom': {
      for (let i = 0; i < 7; i += 1) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate((i * Math.PI * 2) / 7 + t * 0.000035)
        ctx.beginPath()
        ctx.moveTo(0, -7)
        ctx.bezierCurveTo(20, -21, 27, -53, 0, -67 * breathe)
        ctx.bezierCurveTo(-27, -53, -20, -21, 0, -7)
        ctx.closePath()
        ctx.fillStyle = hsla(hue + i * 9, 1, (70 + (i % 2) * 8) / 100, 0.25)
        ctx.fill()
        ctx.strokeStyle = stroke
        ctx.stroke()
        ctx.restore()
      }
      break
    }

    case 'wing': {
      for (const side of [-1, 1]) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(side, 1)
        ctx.beginPath()
        ctx.moveTo(5, -28)
        ctx.bezierCurveTo(24, -66, 72, -66, 68, -20)
        ctx.bezierCurveTo(62, 8, 35, 10, 12, 22)
        ctx.bezierCurveTo(37, 18, 54, 38, 42, 58)
        ctx.bezierCurveTo(20, 48, 9, 23, 5, -28)
        ctx.closePath()
        // 镜像坐标系里用局部渐变（等效原型复用 formGradient 的观感）
        ctx.fillStyle = formShading(ctx, hue, -18, -24)
        ctx.fill()
        ctx.strokeStyle = stroke
        ctx.stroke()
        ctx.restore()
      }
      ctx.fillStyle = formShading(ctx, hue, cx - 18, cy - 24)
      ellipse(ctx, cx, cy, 10, 48 * breathe)
      ctx.fill()
      ctx.strokeStyle = stroke
      ellipse(ctx, cx, cy, 10, 48 * breathe)
      ctx.stroke()
      break
    }

    case 'orbit': {
      ctx.fillStyle = formShading(ctx, hue, cx - 18, cy - 24)
      ellipse(ctx, cx, cy, 38 * breathe, 38 * breathe)
      ctx.fill()
      ctx.strokeStyle = stroke
      ellipse(ctx, cx, cy, 38 * breathe, 38 * breathe)
      ctx.stroke()

      for (let i = 0; i < 3; i += 1) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(i * 0.72 + t * 0.00006)
        ctx.strokeStyle = hsla(hue + 18 + i * 18, 1, 0.82, 0.38 - i * 0.07)
        ellipse(ctx, 0, 0, 58 + i * 10, 23 + i * 7)
        ctx.stroke()
        ctx.restore()
      }
      break
    }
  }

  // ── 4. 淡椭圆轨道环 ──
  ctx.lineWidth = 0.7
  const orbitCount = 2 + Math.min(4, model.filled)
  for (let orbit = 0; orbit < orbitCount; orbit += 1) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((model.seed % 9) * 0.07 + orbit * 0.38)
    ctx.strokeStyle = hsla(hue + orbit * 18, 0.9, 0.7, 0.08 + orbit * 0.018)
    ellipse(ctx, 0, 0, 56 + orbit * 13, 31 + orbit * 8)
    ctx.stroke()
    ctx.restore()
  }

  // ── 5. 粒子云（沿波瓣边缘）──
  const particleCount = 190 + model.filled * 28 + model.signature.length * 18
  for (let i = 0; i < particleCount; i += 1) {
    const angle = (i / particleCount) * Math.PI * 2
    const layer = 0.32 + rand() * 0.78
    const edge =
      48 * (1 + 0.25 * Math.sin(model.lobes * angle + (model.seed % 17) * 0.11 + t * 0.00022)) * breathe
    const radius = edge * layer + (rand() - 0.5) * 9
    const x = cx + Math.cos(angle) * radius * (1.02 + 0.12 * Math.sin(t * 0.0003))
    const y = cy + Math.sin(angle) * radius * 0.78 + (rand() - 0.5) * 5
    const s = 0.65 + rand() * 2.15 * (0.55 + layer * 0.65)
    const pHue = hue + Math.sin(angle * 2) * 35 + (rand() - 0.5) * 18
    ctx.fillStyle = hsla(pHue, 0.95, 0.64 + rand() * 0.22, 0.24 + layer * 0.62)
    if (i % 4 === 0) {
      ctx.fillRect(x - s / 2, y - s / 2, s, s)
    } else {
      const r = s * 0.42
      ellipse(ctx, x, y, r, r)
      ctx.fill()
    }
  }

  // ── 6. 核心发光 ──
  const core = ctx.createRadialGradient(cx, cy, 1, cx, cy, 42)
  core.addColorStop(0, hsla(hue + 32, 1, 0.88, 0.82))
  core.addColorStop(0.26, hsla(hue, 0.95, 0.66, 0.3))
  core.addColorStop(1, hsla(hue - 18, 0.9, 0.42, 0))
  ctx.fillStyle = core
  ellipse(ctx, cx, cy, 42 * breathe, 42 * breathe)
  ctx.fill()

  // ── 7. 维度节点小方块 ──
  const nodes = Math.max(3, model.filled + model.signature.length)
  for (let i = 0; i < nodes; i += 1) {
    const angle =
      (i / nodes) * Math.PI * 2 + t * 0.00016 * (i % 2 === 1 ? 1 : -1) + (model.seed % 13)
    const radius = 70 + (i % 3) * 14
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius * 0.55
    ctx.fillStyle = hsla(hue + i * 17, 1, 0.78, 0.88)
    ctx.fillRect(x - 1.8, y - 1.8, 3.6, 3.6)
  }

  // ── 8. 底牌高光 + 连心线 ──
  ctx.lineWidth = 0.7
  for (let i = 0; i < Math.min(3, model.signature.length); i += 1) {
    const angle = -Math.PI * 0.9 + i * Math.PI * 0.9 + Math.sin(t * 0.00045 + i) * 0.08
    const radius = 64 + (i % 2) * 18
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius * 0.58
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 12)
    glow.addColorStop(0, hsla(hue + 42 + i * 24, 1, 0.88, 0.95))
    glow.addColorStop(0.28, hsla(hue + i * 24, 0.95, 0.67, 0.48))
    glow.addColorStop(1, hsla(hue + i * 24, 0.95, 0.55, 0))
    ctx.fillStyle = glow
    ellipse(ctx, x, y, 12, 12)
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(x, y)
    ctx.strokeStyle = hsla(hue + 20 + i * 24, 1, 0.82, 0.34)
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'source-over'
}
