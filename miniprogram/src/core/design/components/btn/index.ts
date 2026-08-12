/**
 * 按钮 —— 对应 iOS `Components.swift` 的主按钮与 `PressScaleStyle`。
 *
 * 用 view 而非原生 `<button>`：原生按钮自带的边框/背景/hover 态很难完全抹掉
 * （`::after` 边框、微信自己的按压色），而设计基准要的是渐变底 + 按压缩放。
 * 代价是拿不到 `open-type`（分享、获取手机号等）—— 那些场景直接用原生 button，
 * 不要往这个组件里塞 open-type，两种行为混在一起会很难维护。
 */
Component({
  properties: {
    /** primary（极光渐变底）| ghost（描边）| plain（无底） */
    variant: { type: String, value: 'primary' },
    disabled: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
    /** 撑满容器宽度 */
    block: { type: Boolean, value: false },
  },

  data: {
    pressed: false,
  },

  options: { addGlobalClass: true },

  methods: {
    onTouchStart() {
      if (this.data.disabled || this.data.loading) return
      this.setData({ pressed: true })
    },
    onTouchEnd() {
      if (this.data.pressed) this.setData({ pressed: false })
    },
    onTap() {
      // 禁用/加载中不冒泡：调用方就不必在每个 handler 里再判一次
      if (this.data.disabled || this.data.loading) return
      this.triggerEvent('tap')
    },
  },
})
