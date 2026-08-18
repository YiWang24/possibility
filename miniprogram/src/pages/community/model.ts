/**
 * 万花筒社区状态 —— 对应 iOS `Features/Community/CommunityView.swift` 的数据层。
 *
 * 兜底链与 iOS 同序：**远端 → 本地演示数据**，任一环失败都保持上一层已渲染的内容，
 * 不让页面白屏（方案文档通用约束「真实调用优先 + 本地兜底」）。
 * 与 iOS 的一处差异：iOS 的旅人/悬赏中间还有一层「直连表缓存」，小程序的 api.ts
 * 只对悬赏暴露了 Edge Function（没有 loadBounties），所以悬赏是两层、旅人是三层。
 *
 * `usesDemoBounties` 不是调试开关：演示列表与远端列表必须成套使用，否则详情页会
 * 先按同一个 id 显示演示详情、再被远端内容盖掉（iOS 同名注释）。它随列表一起
 * 带进详情页的 URL。
 *
 * WXML 表达式做不到、必须在这里算好的三件事：
 * - 瀑布流按 `i % 2` 分两列（iOS `distribute`）—— WXML 里没有条件 push；
 * - 悬赏卡的金额与征集目标要过 `bountyDisplayAmount` / `bountyRewardGoal` ——
 *   WXML 不能调函数；
 * - 搜索要把 name/quote/bio/tags 拼成一条 haystack 再 includes，同理。
 */

import { track } from '../../core/analytics'
import { createBounty, listBounties, loadTravelers } from '../../core/net/api'
import {
  bountyDisplayAmount,
  bountyRewardGoal,
  DEMO_BOUNTIES,
  DEMO_TRAVELERS,
  type Bounty,
  type Traveler,
} from '../../core/models'

/** 悬赏列表一次拉多少条（iOS `listBountiesRemote(limit: 50)`） */
const BOUNTY_LIMIT = 50

/** 卡片上最多显示几个标签（iOS `tags.prefix(3)`） */
const CARD_TAG_LIMIT = 3

/** 发布悬赏的字数上限（iOS `BountyComposeView`） */
export const COMPOSE_LIMITS = {
  question: 200,
  tagCount: 5,
  /** 提交时截断，不在输入框上拦 —— 与 iOS 的 `prefix()` 同位 */
  tagChars: 30,
  detail: 2000,
  reward: 50,
} as const

/** 推荐流里的一张旅人卡 */
export interface TravelerCard {
  id: number
  name: string
  initial: string
  hue: number
  quote: string
  tags: string[]
}

/** 悬赏贴里的一张悬赏卡 */
export interface BountyCard {
  id: number
  question: string
  tags: string[]
  /** 旧数据里的「征集 3 个真实故事」；新数据金额已单列，这里为空串则不渲染 */
  rewardGoal: string
  /** 「¥29」——三端同一套提取规则，同一条悬赏不能显示成四个价 */
  amount: string
  responses: string
}

export interface CommunitySnapshot {
  /** 0 为你推荐 · 1 悬赏贴 */
  tab: number
  query: string
  travelerLeft: TravelerCard[]
  travelerRight: TravelerCard[]
  /** 搜索把人筛没了 —— 空列表和「还没加载」要分开提示 */
  travelerEmpty: boolean
  bountyLeft: BountyCard[]
  bountyRight: BountyCard[]
  /** 详情页要跟着列表走同一套数据源 */
  usesDemoBounties: boolean
}

/** 按序分入两列，近似瀑布流（iOS `distribute` / `distributeBounties`） */
function split<T>(items: T[]): [T[], T[]] {
  const left: T[] = []
  const right: T[] = []
  items.forEach((item, i) => (i % 2 === 0 ? left : right).push(item))
  return [left, right]
}

function toTravelerCard(t: Traveler): TravelerCard {
  return {
    id: t.id,
    name: t.name,
    initial: t.initial,
    hue: t.hue,
    quote: t.quote,
    tags: t.tags.slice(0, CARD_TAG_LIMIT),
  }
}

function toBountyCard(b: Bounty): BountyCard {
  return {
    id: b.id,
    question: b.question,
    tags: (b.tags ?? []).slice(0, CARD_TAG_LIMIT),
    rewardGoal: bountyRewardGoal(b) ?? '',
    amount: bountyDisplayAmount(b),
    responses: b.responses,
  }
}

/** 标签分隔符：空格 / 逗号 / 顿号 / # / 换行（iOS `" ,，、#\n"`） */
const TAG_SEPARATORS = /[\s,，、#]+/

export function parseTags(text: string): string[] {
  return text.split(TAG_SEPARATORS).filter((t) => t.length > 0)
}

/**
 * 赏金规范化（iOS `normalizedReward`）：留空记 0，纯数字补上「¥…悬赏」，
 * 其它写法原样保留 —— 用户写「悬赏 3 个真实故事」时不该被改成一个价。
 */
export function normalizeReward(raw: string): string {
  const value = raw.trim()
  if (!value) return '¥0 悬赏'
  return /^\d+(?:\.\d{1,2})?$/.test(value) ? `¥${value} 悬赏` : value
}

export class CommunityModel {
  tab = 0
  query = ''
  private travelers: Traveler[] = DEMO_TRAVELERS
  private bounties: Bounty[] = DEMO_BOUNTIES
  private usesDemoBounties = true

  constructor(private readonly onChange: (snapshot: CommunitySnapshot) => void) {}

  /** 先用演示数据铺满（秒开），远端回来再静默覆盖 —— 同 profile/model.ts */
  async load(): Promise<void> {
    this.emit()
    await Promise.all([this.refreshTravelers(), this.refreshBounties()])
  }

  private async refreshTravelers(): Promise<void> {
    // travelers 表是内容运营维护的少量行，整表当池子用（同 iOS `supabase.travelers`）
    const rows = await loadTravelers().catch(() => [] as Traveler[])
    if (rows.length === 0) return
    this.travelers = rows
    this.emit()
  }

  /** 真实优先：拉到非空才覆盖，失败或空列表静默保持兜底数据（iOS `refreshBounties`） */
  async refreshBounties(): Promise<void> {
    const res = await listBounties(BOUNTY_LIMIT).catch(() => null)
    if (!res || res.bounties.length === 0) return
    this.bounties = res.bounties
    this.usesDemoBounties = false
    this.emit()
  }

  setTab(tab: number): void {
    if (this.tab === tab) return
    this.tab = tab
    this.emit()
  }

  setQuery(query: string): void {
    if (this.query === query) return
    this.query = query
    this.emit()
  }

  /**
   * 发布悬赏。写入成功才算发布 —— 埋点、刷新列表、提示都挂在成功分支上，
   * 失败只回错误文案由页面显示，不动列表（iOS `submit()` 同构）。
   *
   * 悬赏正文 / 标签 / 赏金都不进埋点属性（埋点方案：禁止写入个人身份信息与正文）。
   */
  async publish(input: {
    question: string
    detail: string
    tagText: string
    reward: string
  }): Promise<{ ok: boolean; message: string }> {
    const question = input.question.trim()
    const tags = parseTags(input.tagText)
    if (!question || question.length > COMPOSE_LIMITS.question) {
      return { ok: false, message: '请先填写问题（不超过 200 字）' }
    }
    if (tags.length > COMPOSE_LIMITS.tagCount) {
      return { ok: false, message: `标签最多 ${COMPOSE_LIMITS.tagCount} 个` }
    }

    try {
      await createBounty({
        question,
        tags: tags.map((t) => t.slice(0, COMPOSE_LIMITS.tagChars)),
        detail: input.detail.trim().slice(0, COMPOSE_LIMITS.detail),
        reward: normalizeReward(input.reward).slice(0, COMPOSE_LIMITS.reward),
      })
    } catch {
      return { ok: false, message: '发布失败，请检查网络后重试' }
    }

    track('community_bounty_posted')
    await this.refreshBounties()
    return { ok: true, message: '悬赏已发布' }
  }

  private get filteredTravelers(): Traveler[] {
    const query = this.query.trim().toLowerCase()
    if (!query) return this.travelers
    return this.travelers.filter((t) =>
      [t.name, t.quote, t.bio, ...t.tags].join(' ').toLowerCase().includes(query),
    )
  }

  /** 详情页要整条帖子；列表页从这里取出原始数据用 eventChannel 递过去 */
  bountyById(id: number): Bounty | undefined {
    return this.bounties.find((b) => b.id === id)
  }

  snapshot(): CommunitySnapshot {
    const travelers = this.filteredTravelers
    const [travelerLeft, travelerRight] = split(travelers.map(toTravelerCard))
    const [bountyLeft, bountyRight] = split(this.bounties.map(toBountyCard))
    return {
      tab: this.tab,
      query: this.query,
      travelerLeft,
      travelerRight,
      travelerEmpty: travelers.length === 0,
      bountyLeft,
      bountyRight,
      usesDemoBounties: this.usesDemoBounties,
    }
  }

  emit(): void {
    this.onChange(this.snapshot())
  }
}
