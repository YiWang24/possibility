/**
 * 底部弹层 —— 对应 iOS 的 `.sheet` 呈现（`Theme.Radius.sheet = 30`）。
 *
 * iOS 用 `.fullScreenCover` / `.sheet` 承载对话、旅人主页、付费墙；小程序里
 * 整页级的用 `wx.navigateTo` 到分包页面，这个组件只承载页内的浮层
 * （维度编辑、筛选、确认框）。
 */
Component({
  properties: {
    show: { type: Boolean, value: false },
    title: { type: String, value: '' },
    /** 点遮罩是否关闭。破坏性操作的确认框应传 false，避免误触 */
    maskClosable: { type: Boolean, value: true },
  },

  options: { addGlobalClass: true },

  methods: {
    onMaskTap() {
      if (!this.data.maskClosable) return
      this.triggerEvent('close')
    },
    onCloseTap() {
      this.triggerEvent('close')
    },
    /** 吃掉面板内的点击，别让它冒泡到遮罩把弹层关了 */
    onPanelTap() {},
  },
})
