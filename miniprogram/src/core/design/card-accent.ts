/**
 * 卡面点缀色吸附 —— 对应 iOS `Theme.cardAccent(near:index:)`。
 *
 * lab-choices 的卡片自带一个 CSS 颜色，但那是模型自由发挥的结果：直接上卡面会
 * 出现和品牌色板无关的脏色，相邻两张还可能撞成一模一样。所以只把它当**色相提示**，
 * 吸附到 `--accent-0..4` 这五枚品牌点缀色之一；解析不出色相（空值、中性灰）时
 * 按卡片位次轮转，保证相邻卡不撞色。
 *
 * 返回的是档位序号而不是色值：WXSS 拿不到「变量名拼接」，`card-icon` 组件用
 * `.ci--a0..4` 这样的每档一个类来着色，页面同理。
 */

/** `--accent-0..4` 的档数，与 tokens.wxss 一致 */
const ACCENT_COUNT = 5

/**
 * 五枚品牌点缀色的色相（0..1）—— 与 tokens.wxss 的
 * `--accent-0..4`（#5e96ff / #8f7bff / #e35cc1 / #ffb067 / #3ed9a4）逐项对应。
 * 改色板要连这里一起改。
 */
const ACCENT_HUES = [0.6087, 0.6919, 0.8753, 0.08, 0.443]

interface Hsb {
  hue: number
  saturation: number
  brightness: number
}

/** 色相是环形的：0.98 与 0.02 只差 0.04，不是 0.96 */
function hueDistance(a: number, b: number): number {
  const delta = Math.abs(a - b)
  return Math.min(delta, 1 - delta)
}

/** 解析 LLM 给的 CSS 颜色：#RGB / #RRGGBB / #RRGGBBAA / rgb() / rgba() */
function parseCss(raw: string | undefined): { r: number; g: number; b: number } | null {
  const s = (raw ?? '').trim().toLowerCase()
  if (!s) return null

  if (s.startsWith('#')) {
    let hex = s.slice(1)
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
    if (hex.length !== 6 && hex.length !== 8) return null
    const v = Number.parseInt(hex.slice(0, 6), 16)
    if (Number.isNaN(v)) return null
    return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff }
  }

  if (!s.startsWith('rgb')) return null
  const open = s.indexOf('(')
  const close = s.lastIndexOf(')')
  if (open < 0 || close < 0 || open > close) return null
  const numbers = s
    .slice(open + 1, close)
    .split(/[^0-9.]+/)
    .filter((x) => x.length > 0)
    .map(Number)
  const [r, g, b] = numbers
  if (r === undefined || g === undefined || b === undefined) return null
  return { r: Math.min(r, 255), g: Math.min(g, 255), b: Math.min(b, 255) }
}

function toHsb(rgb: { r: number; g: number; b: number }): Hsb {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  let hue = 0
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6
    else if (max === g) hue = (b - r) / d + 2
    else hue = (r - g) / d + 4
    hue /= 6
    if (hue < 0) hue += 1
  }
  return { hue, saturation: max === 0 ? 0 : d / max, brightness: max }
}

/**
 * 把任意 CSS 颜色吸附到最近的品牌点缀色档位（0..4）。
 * `index` 是卡片在牌堆里的位次，解析失败时按它轮转取色。
 */
export function cardAccentIndex(color: string | undefined, index: number): number {
  const rotated = ((index % ACCENT_COUNT) + ACCENT_COUNT) % ACCENT_COUNT
  const rgb = parseCss(color)
  if (!rgb) return rotated

  const hsb = toHsb(rgb)
  // 接近中性灰时没有可用色相，硬吸附只会得到一个随机档
  if (hsb.saturation <= 0.15 || hsb.brightness <= 0.12) return rotated

  let best = rotated
  let bestDistance = Number.POSITIVE_INFINITY
  ACCENT_HUES.forEach((hue, i) => {
    const distance = hueDistance(hue, hsb.hue)
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  })
  return best
}
