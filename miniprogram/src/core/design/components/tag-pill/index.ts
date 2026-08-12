/**
 * 标签胶囊 —— 对应 iOS `Components.swift` 的 `TagPill`。
 *
 * `accent` 传 0..4 时用对应的品牌点缀色描边（--accent-0..4）。
 * 为什么只给五档而不接任意色：LLM 返回的颜色一律吸附到这五档，否则一屏卡片会出现
 * 互不相干的随机彩虹色 —— 那正是「模型生成感」的来源之一（Theme.cardAccent 的注释）。
 */
Component({
  properties: {
    text: { type: String, value: '' },
    /** 点缀色档位 0..4；-1 = 中性 */
    accent: { type: Number, value: -1 },
  },
  options: { addGlobalClass: true },
})
