/**
 * 通用卡片 —— 对应 iOS 的 `.kaleidoCard()` modifier（`Theme.swift` 的 `CardBackground`）。
 *
 * 卡面 + 1px 描边 + 阴影 + 圆角裁切。内容一并裁进圆角，保证顶部渐变色带的四角一致
 * （iOS 的 `CardBackground` 特意加了 clipShape 就是为了这个）。
 */
Component({
  properties: {
    /** 圆角（rpx）。默认对应 Theme.Radius.card = 22 */
    radius: { type: Number, value: 22 },
    /** 关掉阴影：嵌套在另一张卡里时用 */
    flat: { type: Boolean, value: false },
  },
  options: {
    // 允许外部页面用 class 覆盖内部样式（如调整内边距）
    addGlobalClass: true,
    multipleSlots: false,
  },
})
