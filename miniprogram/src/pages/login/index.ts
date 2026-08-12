/**
 * 登录墙 —— 对应 iOS `Features/Auth/`（AuthGate + LoginSheet）。
 *
 * 三端登录方式各不相同：iOS 是邮箱密码 + Apple，Web 是邮箱密码，小程序走微信一键登录。
 * 这是唯一允许的端间差异（README 设计原则：交互差异要有平台惯例上的理由）——
 * 在小程序里让用户敲邮箱密码，注册转化会很难看。
 *
 * 链路细节见 core/net/auth.ts。
 */

import { signInWithWeixin } from '../../core/net/auth'
import { identify, track } from '../../core/analytics'

Page({
  data: {
    loading: false,
    error: '',
  },

  onLoad() {
    track('auth_prompted', { trigger: 'cold_start' })
  },

  async onTapLogin() {
    if (this.data.loading) return
    this.setData({ loading: true, error: '' })
    track('auth_wechat_started')

    try {
      const session = await signInWithWeixin()
      const app = getApp<{ globalData: { signedIn: boolean } }>()
      app.globalData.signedIn = true

      identify(session.user_id)
      track('auth_completed', { method: 'wechat', was_anonymous: false })

      wx.reLaunch({ url: '/pages/home/index' })
    } catch (err) {
      // 不静默失败：登录失败必须给出可读原因，否则用户只会看到一个没反应的按钮
      const message = err instanceof Error ? err.message : '登录失败，请稍后重试'
      this.setData({ error: message })
      wx.showToast({ title: message, icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onUnload() {
    // 没登录就离开登录页 = 放弃。这条是认证漏斗的分母侧，不能漏报。
    if (!this.data.loading && !getApp<{ globalData: { signedIn: boolean } }>().globalData.signedIn) {
      track('auth_abandoned', { trigger: 'cold_start' })
    }
  },
})
