/**
 * 内容侧模型（公开只读）—— 对应 `travelers` / `traveler_details` / `traveler_services` / `bounties`。
 *
 * 字段名保持后端 snake_case 的 wire 形状，与 `web/lib/models.ts` 逐字段对齐 ——
 * 不做 camelCase 转换层。四端里只有 iOS 需要 CodingKeys 映射（Swift 的语言约束），
 * TS 侧没有这个必要，多一层映射只会多一处对不齐的可能。
 *
 * Web 里的 `travelerFromRow` / `travelerDetailFromRow` 这里不需要：那两个是给
 * supabase-js 直读表行用的，小程序只经 Edge Function 取数，拿到的已经是收窄过的形状。
 */

/** 人生轨迹节点（travelers.trajectory jsonb 元素：{age,t,d}） */
export interface TrajectoryNode {
  /** 如 "28 岁" */
  age: string
  /** 节点标题 */
  t: string
  /** 节点详情 */
  d: string
}

/** 旅人（经验贡献者）—— 对应表 `travelers` */
export interface Traveler {
  id: number
  name: string
  /** 头像单字 */
  initial: string
  /** 配色索引 0..4（tokens.wxss 的 --hue0..4） */
  hue: number
  is_similar: boolean
  quote: string
  bio: string
  tags: string[]
  /** 画像维度 [["我擅长","..."], ...] */
  dims: string[][]
  trajectory: TrajectoryNode[]
}

/** 经验与建议（traveler_details.advice jsonb） */
export interface TravelerAdvice {
  decision: string[]
  ability: string[]
  interview: string[]
}

/** 建议分类（原型 advice-chips） */
export type AdviceKind = 'decision' | 'ability' | 'interview'

export const ADVICE_KINDS: { kind: AdviceKind; label: string }[] = [
  { kind: 'decision', label: '转型决策' },
  { kind: 'ability', label: '能力迁移' },
  { kind: 'interview', label: '求职面试' },
]

export function adviceTips(advice: TravelerAdvice, kind: AdviceKind): string[] {
  return advice[kind] ?? []
}

/** 旅人详情 —— 对应表 `traveler_details`（full_text / advice 付费解锁） */
export interface TravelerDetail {
  traveler_id: number
  age: number | null
  city: string | null
  from_role: string | null
  to_role: string | null
  years: string | null
  /** 免费可见 */
  intro: string
  /** 付费解锁 */
  full_text: string
  advice: TravelerAdvice
  result: string | null
  consulted: number | null
  response_time: string | null
}

/** 增值服务 —— 对应表 `traveler_services` */
export interface TravelerServiceItem {
  /** consult / materials / companion（表内为 "consult-1" 等） */
  id: string
  traveler_id: number | null
  kind: string
  title: string
  price: number
  unit: string
  description: string
  tags: string[]
}

/** 悬赏 —— 对应表 `bounties` */
export interface Bounty {
  id: number
  question: string
  reward: string
  responses: string
  tags?: string[] | null
  detail?: string | null
  status?: string | null
  created_at?: string | null
}

/**
 * 列表金额展示。兼容线上旧数据：
 * - 新数据直接从「¥29 悬赏」「29 元」提取；
 * - 三条内置种子按详情 mock 的既有金额兜底；
 * - 测试帖或未填写金额显示 ¥0。
 *
 * 三端逻辑必须一致（iOS `Bounty.displayAmount` / web `bountyDisplayAmount`）——
 * 同一条悬赏在四个端上不能显示成四个价。
 */
export function bountyDisplayAmount(bounty: Bounty): string {
  const normalized = bounty.reward.replace(/￥/g, '¥')
  const patterns = [/¥\s*\d+(?:\.\d{1,2})?/, /\d+(?:\.\d{1,2})?\s*元/]
  for (const pattern of patterns) {
    const m = normalized.match(pattern)
    if (m) {
      const digits = m[0].replace(/[^\d.]/g, '')
      if (digits) return `¥${digits}`
    }
  }
  switch (bounty.id) {
    case 1:
      return '¥29'
    case 2:
      return '¥19.9'
    case 3:
      return '¥39'
    default:
      return '¥0'
  }
}

/** 金额已在卡片底栏单独呈现；这里仅保留旧数据中的征集目标 */
export function bountyRewardGoal(bounty: Bounty): string | null {
  const trimmed = bounty.reward.trim()
  if (!trimmed || trimmed === '无') return null
  if (trimmed.includes('¥') || trimmed.includes('￥') || trimmed.includes('元')) return null
  return trimmed
}

/** bounty_responses 行 */
export interface BountyReply {
  id: number
  user_id: string
  message: string
  created_at?: string | null
}

/** community action=get_bounty 出参 */
export interface BountyDetailResponse {
  bounty: Bounty
  responses: BountyReply[]
}

/* ============ 探索话题（对应原型 topicChips） ============ */

export interface ExploreTopic {
  /** 职业 / 家庭 / 升学 / 情感 */
  topic: string
  /** 原型 TOPIC_SAMPLES 的占位问题 */
  sampleQuestion: string
}

export const EXPLORE_TOPICS: ExploreTopic[] = [
  { topic: '职业', sampleQuestion: '我是否要从交互设计师转为产品经理？' },
  { topic: '家庭', sampleQuestion: '要不要搬回父母所在的城市生活？' },
  { topic: '升学', sampleQuestion: '26 岁了，还要不要辞职去读研？' },
  { topic: '情感', sampleQuestion: '异地三年，要不要为 TA 换一座城市？' },
]

/** 仅四条预置问题使用本地 mock 对话；用户自行输入的任何其他内容都走 API */
export function isSampleQuestion(question: string): boolean {
  const clean = question.trim()
  return EXPLORE_TOPICS.some((t) => t.sampleQuestion === clean)
}

/** mock 解锁完整经验价格（¥9.9）—— 小程序维持 demo mock，不接真实支付 */
export const PRICE_UNLOCK_PROFILE = 9.9
