/**
 * 本次探索总结 —— 对应 iOS `Features/Chat/ChatSummaryView.swift` 的 `ChatSummaryView`。
 *
 * iOS 是盖在对话上的 sheet，直接读 `ChatModel`；小程序是独立页面，数据由对话页
 * 通过 `../handoff` 交接（原因见那个文件）。
 *
 * 「完成本次探索」要同时关掉总结和对话（iOS 是 `showSummary = false` + `dismiss()`），
 * 所以是 `navigateBack({ delta: 2 })`。
 */

import { readSummary, type ChatSummaryPayload } from '../handoff'

interface SummaryCard {
  eyebrow: string
  title: string
  body: string
  /** '' | 'violet' | 'teal'，对应 iOS 的 accent 描边 */
  accent: string
}

function buildCards(payload: ChatSummaryPayload): SummaryCard[] {
  const answer = (i: number, fallback: string) => payload.answers[i] ?? fallback
  const last = payload.answers[payload.answers.length - 1]

  return [
    {
      eyebrow: '你真正想解决的',
      title: '不是选出标准答案，而是确认什么值得你承担代价',
      body: '你的犹豫并不等于没有方向。它提醒你：愿望与代价需要被分开看见。',
      accent: '',
    },
    {
      eyebrow: '此刻的两股拉力',
      title: '想靠近的，和想保护的',
      body: `一边是「${answer(0, '你真正想靠近的生活')}」；另一边是「${answer(
        1,
        '你暂时还不能轻易放下的部分',
      )}」。两边都是真的，不必把其中一边解释成软弱。`,
      accent: 'violet',
    },
    {
      eyebrow: '已经比较清楚的',
      title: '你的原话比标签更重要',
      body: last ?? '你愿意先理解自己的真实需要，再做决定。',
      accent: '',
    },
    {
      eyebrow: '下一步的小验证',
      title: '先收集一个真实证据',
      body: '未来 7 天，做一次成本很低、可以撤回的小尝试。记录行动前后的期待、精力和抗拒，再判断你是“不想要”，还是“暂时承担不起”。',
      accent: 'teal',
    },
  ]
}

Page({
  data: {
    eyebrow: '此刻的选择 · EXPLORATION NOTE',
    question: '',
    cards: [] as SummaryCard[],
    recommendedNextStep: '',
    matchedTravelers: [] as ChatSummaryPayload['matchedTravelers'],
    matchReasons: {} as Record<number, string>,
    shareText: '',
  },

  onLoad() {
    const payload = readSummary()
    // 交接数据缺失（例如小程序被回收后从后台恢复到这一页）时静默退回对话页，
    // 不要用一屏空白的总结骗用户
    if (!payload) {
      wx.navigateBack()
      return
    }

    this.setData({
      eyebrow: `${payload.displayTopic ?? '此刻的选择'} · EXPLORATION NOTE`,
      question: payload.displayQuestion,
      cards: buildCards(payload),
      recommendedNextStep: payload.recommendedNextStep ?? '',
      matchedTravelers: payload.matchedTravelers,
      matchReasons: payload.matchReasons,
      shareText: payload.shareText,
    })
  },

  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    return {
      title: this.data.shareText.split('\n')[0],
      path: '/pages/home/index',
    }
  },

  onBack() {
    wx.navigateBack()
  },

  /** 完成本次探索：关总结 + 关对话（iOS 是 showSummary = false + dismiss()）*/
  onFinish() {
    wx.navigateBack({ delta: 2 })
  },

  onGoLab() {
    const app = getApp<{ globalData: { pendingLabQuestion?: string } }>()
    app.globalData.pendingLabQuestion = this.data.question
    wx.switchTab({ url: '/pages/lab/index' })
    wx.showToast({ title: '问题已带入人生实验室', icon: 'none' })
  },

  onGoSimilar() {
    wx.switchTab({ url: '/pages/community/index' })
    wx.showToast({ title: '正在寻找走过这段路的人', icon: 'none' })
  },

  onTravelerTap(e: WechatMiniprogram.CustomEvent<{ id: number }>) {
    wx.navigateTo({ url: `/subpkg/profile/index/index?id=${e.detail.id}` })
  },
})
