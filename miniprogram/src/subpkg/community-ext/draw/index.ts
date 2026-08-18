/**
 * 万花筒抽取 —— 对应 iOS `Features/Community/KaleidoscopeDrawView.swift`。
 *
 * iOS 那边是社区页上的 `.sheet`，小程序里独立成分包页（同放映模式的理由：
 * 浮层里要跑一整套 canvas 动画，做成页面才能拿到独立的生命周期去停帧循环）。
 * 视觉上仍是浮层：`navigationStyle: custom` + 右上角「关闭 ✕」= navigateBack。
 *
 * 三段式：choose（选类似/相反）→ spinning（转盘）→ result（抽中的旅人卡）。
 *
 * 抽取的关键是**动画与请求并行**：转盘一定转满一个周期，接口在这段时间里
 * 赛跑，赢了用远端结果（带 AI 给的匹配理由），超时就回落本地候选 —— 否则
 * 网络一慢，转盘就停在中间态。这条与 iOS 的 taskGroup 竞速是同一个语义，
 * 只是 canvas 这边用 Promise.race 表达。
 */

import { kaleidoscopeDraw, loadTravelers } from '../../../core/net/api'
import { DEMO_TRAVELERS, type Traveler } from '../../../core/models'
import { track } from '../../../core/analytics'
import { reduceMotion } from '../../../core/design/motion'
import { BLEED, DIAL, Kaleidoscope, STAGE } from './kaleido'

type Phase = 'choose' | 'spinning' | 'result'
type Mode = 'similar' | 'opposite'

/** 转盘至少转这么久；关了动效就只等一下（iOS 1450 / 400 毫秒） */
const SPIN_DELAY = 1450
const STILL_DELAY = 400

const MODES: { mode: Mode; emoji: string; title: string; desc: string }[] = [
  { mode: 'similar', emoji: '🪞', title: '和我有类似经历', desc: '在同路人身上\n看见自己的下一步' },
  { mode: 'opposite', emoji: '🔭', title: '和我经历完全相反', desc: '在另一种人生里\n看见没走过的路' },
]

/** 标题/副标题逐段给（iOS 的 title / sub 计算属性） */
const TITLES: Record<Phase, Record<Mode, string>> = {
  choose: { similar: '你想看见哪一面的人生？', opposite: '你想看见哪一面的人生？' },
  spinning: { similar: '寻找和你同路的人', opposite: '寻找你没走过的路' },
  result: { similar: '与你的画像最相似的人', opposite: '与你的轨迹完全相反的人' },
}

interface PageData {
  phase: Phase
  mode: Mode
  modes: typeof MODES
  title: string
  /** result 段是 AI 的匹配理由，本地兜底时退回默认文案 */
  sub: string
  /** 转盘的版面尺寸（外层 .spin__dial 占的宽高） */
  dial: number
  /** canvas 的 CSS 尺寸，宽高按它 × dpr */
  stage: number
  /** 出血的负 margin：让这枚画布在版面上只占 DIAL（见 kaleido.ts 的 BLEED） */
  bleed: number
  drawn: Traveler | null
  ready: boolean
}

interface PageCustom {
  kaleido: Kaleidoscope | null
  /** 远端旅人池，拉到了就用它，否则用本地兜底那批 */
  pool: Traveler[]
  /** 转盘要转 1.45 秒，这中间足够按下「关闭」—— 页面没了就别再 setData */
  alive: boolean

  initCanvas(): void
  onPickMode(e: WechatMiniprogram.CustomEvent<never, never, { mode: Mode }>): void
  onSpin(): void
  settle(picked: { traveler_id: number; reason: string } | null): void
  onViewProfile(): void
  onAgain(): void
  onClose(): void
}

Page<PageData, PageCustom>({
  data: {
    phase: 'choose',
    mode: 'similar',
    modes: MODES,
    title: TITLES.choose.similar,
    sub: '万花筒会为你转出一位真实的旅人',
    dial: DIAL,
    stage: STAGE,
    bleed: BLEED,
    drawn: null,
    ready: false,
  },

  kaleido: null,
  pool: DEMO_TRAVELERS,
  alive: true,

  onLoad() {
    // 旅人池先用兜底那批：这一页可被分享直达，不能等网络才能抽
    loadTravelers()
      .then((rows: Traveler[]) => {
        if (rows.length > 0) this.pool = rows
      })
      .catch(() => {
        /* 拉不到就一直用兜底那批（通用约束：不让页面白屏） */
      })
  },

  /**
   * 建转盘。canvas 只在 spinning 段挂载，所以这里由 wxml 的 `ready` 触发之后
   * 才量得到节点 —— 用 setData 的回调等一帧渲染完再查询。
   */
  initCanvas() {
    wx.createSelectorQuery()
      .in(this)
      .select('#kaleido-canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const item = res[0] as { node: WechatMiniprogram.Canvas } | undefined
        if (!item?.node) return
        const canvas = item.node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getWindowInfo().pixelRatio
        canvas.width = STAGE * dpr
        canvas.height = STAGE * dpr
        ctx.scale(dpr, dpr)

        this.kaleido = new Kaleidoscope(canvas, ctx, dpr)
        if (reduceMotion()) this.kaleido.drawStill()
        else this.kaleido.spin()
      })
  },

  // 分包页会被旅人主页盖住，那时候没必要继续烧帧
  onHide() {
    this.kaleido?.stop()
  },

  onShow() {
    if (this.data.phase === 'spinning' && !reduceMotion()) this.kaleido?.wake()
  },

  onUnload() {
    this.alive = false
    this.kaleido?.stop()
  },

  // ── 选择 ──

  onPickMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ mode })
  },

  /**
   * 转一次。先切到 spinning 让 canvas 挂上去，再并行发请求 —— 请求与
   * 「至少转满一圈」的定时器赛跑，谁先到用谁（超时那一路 resolve 成 null）。
   */
  onSpin() {
    const { mode } = this.data
    const delay = reduceMotion() ? STILL_DELAY : SPIN_DELAY

    this.setData({ phase: 'spinning', title: TITLES.spinning[mode], sub: '', ready: true }, () => {
      this.initCanvas()
    })

    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), delay))
    const remote = kaleidoscopeDraw(mode === 'similar' ? 'similar' : 'different').catch(() => null)
    // 两个都要等：请求赢了也得把转盘转满，不然停在中间态
    Promise.all([Promise.race([remote, timeout]), timeout]).then(([picked]) => {
      this.settle(picked)
    })
  },

  /** 结果落定：远端给的 id 能在池子里找到就用它，否则本地按 is_similar 挑一个 */
  settle(picked) {
    if (!this.alive) return
    const { mode } = this.data
    const remote = picked ? this.pool.find((t) => t.id === picked.traveler_id) : undefined

    let drawn = remote ?? null
    let sub = picked?.reason ?? ''
    if (!drawn) {
      const wantSimilar = mode === 'similar'
      const candidates = this.pool.filter((t) => t.is_similar === wantSimilar)
      const from = candidates.length > 0 ? candidates : this.pool
      drawn = from[Math.floor(Math.random() * from.length)] ?? null
      sub = ''
    }

    this.kaleido?.stop()
    this.setData({
      phase: 'result',
      title: TITLES.result[mode],
      sub: sub || '看看 TA 的人生轨迹',
      drawn,
      ready: false,
    })
    // 转盘停下、结果落定才算抽到一次（远程失败回落本地候选同样成立）
    track('kaleidoscope_drawn', { mode })
  },

  // ── 结果 ──

  onViewProfile() {
    const drawn = this.data.drawn
    if (!drawn) return
    wx.navigateTo({ url: `/subpkg/profile/index/index?id=${drawn.id}` })
  },

  onAgain() {
    this.kaleido?.stop()
    this.kaleido = null
    this.setData({
      phase: 'choose',
      title: TITLES.choose[this.data.mode],
      sub: '万花筒会为你转出一位真实的旅人',
      drawn: null,
      ready: false,
    })
  },

  onClose() {
    wx.navigateBack()
  },
})
