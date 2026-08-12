/**
 * 小程序入口 —— 对应 iOS `App/PossibilityApp.swift`。
 *
 * 冷启动分流与 iOS 同策略：匿名模式已停用，未登录时所有 Edge Function 都会 401，
 * 所以在入口就把用户拦在登录墙上，而不是放进去看一屏加载失败。
 */

import { currentSession, isSignedIn } from './core/net/auth'
import { bindAppLifecycle, identify, track } from './core/analytics'

interface GlobalData {
  /** 冷启动时是否已有可用会话；登录页与各 tab 的 AuthGate 读它决定首屏 */
  signedIn: boolean
  /** 对话「去人生实验室」携带的问题，Lab 页出现时消费（对应 iOS AppRouter.pendingLabQuestion） */
  pendingLabQuestion?: string
  /** 系统信息，避免各页面重复取 */
  safeAreaTop: number
  safeAreaBottom: number
}

App<{ globalData: GlobalData }>({
  globalData: {
    signedIn: false,
    safeAreaTop: 0,
    safeAreaBottom: 0,
  },

  onLaunch() {
    const windowInfo = wx.getWindowInfo()
    this.globalData.safeAreaTop = windowInfo.safeArea?.top ?? 0
    this.globalData.safeAreaBottom =
      windowInfo.screenHeight - (windowInfo.safeArea?.bottom ?? windowInfo.screenHeight)

    // 先挂生命周期再上报：切后台要能立刻 flush，否则小程序被杀掉时最后一批会丢。
    // 小程序端 app_events 是唯一事实来源，没有 PostHog 兜底（埋点方案 §0.1）。
    bindAppLifecycle()

    const session = currentSession()
    this.globalData.signedIn = isSignedIn()

    // identify 要在 track 之前：没有 user_id 的事件会滞留在队列里等补齐，
    // 顺序反了并不丢数，但会让冷启动那一批多绕一圈。
    if (session) identify(session.user_id)
    track('app_opened', { is_signed_in: this.globalData.signedIn })

    if (!this.globalData.signedIn) {
      wx.redirectTo({ url: '/pages/login/index' })
    }
  },
})
