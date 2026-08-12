/**
 * 付费墙
 *
 * iOS 对照：Features/Profile/PaywallView.swift（维持 demo mock 解锁，不接真实支付）
 * 承接：波次 1 · C
 *
 * 骨架占位 —— 复刻时请先读 iOS 对照文件，保持交互逻辑一致（README 设计原则：
 * 「三端对齐优先于单端最优」，交互差异要有平台惯例上的理由）。
 */
Page({
  data: {
    title: '付费墙',
  },

  onLoad() {
    // TODO(波次 1 · C): 接 core/net/functions.ts，真实优先 + 失败静默回退 DemoData
  },
})
