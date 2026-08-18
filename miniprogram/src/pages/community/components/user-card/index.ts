/**
 * 推荐流里的旅人卡 —— 对应 iOS `Features/Community/CommunityView.swift` 的 `UserCard`。
 *
 * 卡片自己不跳转，只把点击冒泡出去：两列瀑布流是页面在分，`data-id` 也挂在页面那边，
 * 组件里再存一份 id 只会多一处能对不齐的地方。
 *
 * 标签在 `model.ts` 里已经截到 3 个（iOS `tags.prefix(3)`）—— WXML 切不了数组。
 */
Component<
  Record<string, never>,
  {
    name: { type: StringConstructor; value: string }
    initial: { type: StringConstructor; value: string }
    /** 配色索引 0..4（tokens.wxss 的 --hue0..4） */
    hue: { type: NumberConstructor; value: number }
    quote: { type: StringConstructor; value: string }
    tags: { type: ArrayConstructor; value: string[] }
  },
  { onTap(): void },
  []
>({
  properties: {
    name: { type: String, value: '' },
    initial: { type: String, value: '' },
    hue: { type: Number, value: 0 },
    quote: { type: String, value: '' },
    tags: { type: Array, value: [] },
  },

  options: { addGlobalClass: true },

  methods: {
    onTap() {
      this.triggerEvent('tap')
    },
  },
})
