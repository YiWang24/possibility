/**
 * 卡面图标 —— 对应 iOS `CardIconChip` / `CardIconMark`。
 *
 * 语义键在 `core/models/card-icon.ts`，这里只管「这个键长什么样」。
 *
 * ## 为什么是文字字形而不是 SVG / iconfont
 *
 * iOS 用 SF Symbols：单色、可着色、字重可调。小程序没有等价物，三条路都试过：
 *
 * - **iconfont**：得往仓库里塞二进制字体文件，还要另立一套构建/分发；
 *   而这份表将来还要被人生牌局（波次 2 · G）复用，改一个图标就要重新生成字体。
 * - **内联 SVG**：`<image>` 里的 SVG 不继承 currentColor，颜色只能烤死在 data URI 里。
 *   选择卡的点缀色有 5 档，等于 25 键 × 5 档 = 125 份 data URI。用 `mask-image` +
 *   `background-color` 能省掉这一层，但 Skyline 下是否支持没验证过，
 *   为一个图标位赌上整页渲染不值得。
 * - **文字字形**：`color` 直接吃 `var(--accent-N)`，两种渲染器表现一致，
 *   字号字重全在 WXSS 里 —— 恰好就是 iOS 那句「端上统一决定用多大、什么字重、着什么色」。
 *
 * 所以选文字字形。代价是**没法逐个还原 SF Symbol 的象形**：Unicode 里没有
 * 「锤子」「试管」的文本态字形（有的都是彩色 emoji，正是要躲开的东西）。
 * 因此这套字形按「可区分的几何标记」来选，而不是按象形来选 —— 图标位始终和卡名
 * 上下相邻，真正表意的是文字，字形负责的是让相邻卡一眼能分开。
 *
 * 选字形的硬约束：只取默认**文本呈现**的码位（几何图形、箭头、数学/技术符号区），
 * 避开任何有 emoji 变体的码位，否则安卓微信会把它渲染成彩色 emoji，
 * 那就绕了一圈又回到「模型生成感」。
 *
 * 波次 3 真机走查要逐个确认字形在 iOS / 安卓微信下都不掉字（掉字会显示成豆腐块）。
 * 真要换成 iconfont 或 SVG，改下面这一张表即可，调用方不受影响。
 */

import type { CardIconKey } from '../../../models/card-icon'

/** 语义键 → 字形。改动要连同上面的选型约束一起看。 */
const GLYPHS: Record<CardIconKey, string> = {
  stay: '⊡',
  deepen: '⇊',
  pivot: '↳',
  retreat: '↺',
  explore: '⌖',
  experiment: '⌬',
  learn: '▤',
  build: '⊞',
  create: '◈',
  leap: '↟',
  connect: '⋈',
  speak: '❝',
  relocate: '↦',
  rest: '☾',
  pause: '‖',
  observe: '◉',
  timing: '⧖',
  hybrid: '◧',
  balance: '⋚',
  secure: '⬡',
  money: '¥',
  home: '⌂',
  health: '♡',
  custom: '✎',
  /** 与 iOS 的 `circle.dashed` 兜底同义：认不出来就给一个空圈 */
  unknown: '○',
}

Component({
  properties: {
    /** `CardIconKey`；给了表里没有的值按 unknown 处理 */
    icon: { type: String, value: 'unknown' },
    /** 点缀色档位 0..4，对应 --accent-0..4；-1 = 跟随父级 color */
    accent: { type: Number, value: -1 },
    /** chip = 圆角方底衬（扇形卡）；mark = 裸字形（正文行内、底线卡） */
    variant: { type: String, value: 'chip' },
    /** 选中态：底色与描边同时加重，字形不换色，避免出现第二种强调语言 */
    emphasized: { type: Boolean, value: false },
  },

  data: {
    glyph: GLYPHS.unknown,
  },

  observers: {
    icon(key: string) {
      this.setData({ glyph: GLYPHS[key as CardIconKey] ?? GLYPHS.unknown })
    },
  },

  options: { addGlobalClass: true },
})
