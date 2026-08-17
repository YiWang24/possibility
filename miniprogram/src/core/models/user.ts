/**
 * 用户侧模型（RLS 锁 `auth.uid()`）—— 对应 `profiles` / `conversations` / `messages` /
 * `diary_entries` / `simulations` / `unlocks` / 卡牌 session。
 *
 * 与 `web/lib/models.ts` 逐字段对齐；LLM 出参部分对齐
 * `supabase/functions/_shared/schemas.ts` 的 10 套 JSON Schema。
 */

import type { TrajectoryNode } from './content'

/** 当前用户动态画像 —— 对应表 `profiles` */
export interface UserProfile {
  id: string
  portrait_pct: number
  /** 我擅长 / 我喜欢 / …（维度名 → 内容） */
  dims: Record<string, string>
}

/** 匹配条件（岔路口成形后，用于 POST /match 的 user_state） */
export interface MatchQuery {
  life_stage?: string | null
  constraints?: string[] | null
  tension?: string | null
  decision_stage?: string | null
  support_need?: string | null
}

/** 岔路口信号（conversations.crossroads jsonb） */
export interface Crossroads {
  /** true 时前端解锁「看看走过这条路的人」 */
  ready: boolean
  /** 如 "留学 vs 保研" */
  summary?: string | null
  match_query?: MatchQuery | null
}

/** 对话（一次迷茫 → 一个岔路口）—— 对应表 `conversations` */
export interface Conversation {
  id: string
  user_id: string
  /** 职业 / 家庭 / 升学 / 情感 */
  topic: string
  /** open | crossroads | paid | closed */
  status: string
  crossroads?: Crossroads | null
}

/** 消息 —— 对应表 `messages` */
export interface ChatMessageRow {
  id: number
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
}

/** POST /list-conversations 出参条目 */
export interface RemoteConversation {
  id: string
  topic: string
  status: string
  crossroads?: Crossroads | null
  created_at?: string | null
}

/** 一条落库的对话消息 —— 对应表 `messages`（iOS `ChatMessage`）。
 *  注意 role 用的是后端的 `assistant`，不是端上渲染用的 `ai`。 */
export interface RemoteChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
}

/** 解锁记录 —— 对应表 `unlocks`（demo mock 支付） */
export interface Unlock {
  user_id: string
  kind: 'profile' | 'service'
  /** traveler_id / service id */
  target_id: string
  amount: number
}

/** AI 上下文披露：本轮实际用了哪些画像维度，不含画像原文 */
export interface AIContextDisclosure {
  purpose: 'persona' | 'chat' | 'match' | 'lab' | 'community'
  dimensions: string[]
  /** 本次 AI 上下文对应的画像版本；用于向用户解释和排查跨设备更新 */
  profile_revision?: number
  /** 本次 AI 上下文对应的用途授权版本 */
  permission_revision?: number
}

/* ============ LLM 出参（对齐 _shared/schemas.ts） ============ */

/** POST /match 出参：3 位结局不同的旅人 + 可解释理由 */
export interface MatchResponse {
  matches: {
    traveler_id: number
    /** 为什么推荐给你（可解释） */
    reason: string
    /** 不适用条件（避免确认偏误） */
    not_applicable: string
  }[]
  ai_context?: AIContextDisclosure
}

/** 单个推演结局（schemas.ts ScenarioOutput） */
export interface Scenario {
  headline: string
  dimensions: { label: string; text: string }[]
  gains: string[]
  costs: string[]
  key_condition: string
}

/** POST /simulate 出参（schemas.ts SimulationOutput） */
export interface SimulationResult {
  scenarios: {
    general: Scenario
    optimistic: Scenario
    cautionary: Scenario
  }
  bottom_line_analysis: {
    is_acceptable: boolean
    risks: string[]
    protective_conditions: string[]
  }
  recommended_traveler_ids: number[]
  ai_context?: AIContextDisclosure
}

/**
 * 人生实验室的离散时间跨度。
 * 短期档位用 `apiYears = 1` 兼容旧接口，`label` 作为 time_horizon 传给新版接口，
 * 确保实际按天/月推演 —— 与 iOS `SimulationHorizon` 一致。
 */
export interface SimulationHorizon {
  key: string
  label: string
  apiYears: number
}

export const SIMULATION_HORIZONS: SimulationHorizon[] = [
  { key: 'day7', label: '7 天后', apiYears: 1 },
  { key: 'day30', label: '30 天后', apiYears: 1 },
  { key: 'month3', label: '3 个月后', apiYears: 1 },
  { key: 'month6', label: '6 个月后', apiYears: 1 },
  { key: 'year1', label: '1 年后', apiYears: 1 },
  { key: 'year2', label: '2 年后', apiYears: 2 },
  { key: 'year3', label: '3 年后', apiYears: 3 },
  { key: 'year4', label: '4 年后', apiYears: 4 },
  { key: 'year5', label: '5 年后', apiYears: 5 },
  { key: 'year6', label: '6 年后', apiYears: 6 },
]

/** POST /lab-choices 出参（schemas.ts LabChoiceOutput） */
export interface LabChoiceResponse {
  cards: {
    id: string
    glyph: string
    title: string
    description: string
    /** 模型返回的 CSS 颜色只当色相提示，前端吸附到 --accent-0..4 */
    color: string
  }[]
  rationale: string
  ai_context?: AIContextDisclosure
}

/** POST /persona 出参（schemas.ts PersonaOutput）；异步任务形态 */
export interface PersonaJob {
  status: 'pending' | 'ready' | 'failed' | string
  persona?: {
    shape: string
    hue: number
    lobes: number
    seed: number
    summary: string
  } | null
  ai_context?: AIContextDisclosure
}

/** POST /analyze-diary 出参（schemas.ts DiaryOutput） */
export interface DiaryAnalysis {
  title: string
  entry_summary: string
  emotions: string[]
  keywords: string[]
  dim_updates: { dimension: string; value: string }[]
}

/** POST /list-diary 出参条目 */
export interface RemoteDiaryEntry {
  entry_uuid: string
  /** created | uploaded | transcribing | transcribed | analyzing | ready | failed */
  status: string
  transcript?: string | null
  title?: string | null
  entry_summary?: string | null
  emotions?: string[] | null
  keywords?: string[] | null
  audio_path?: string | null
  audio_mime?: string | null
  duration_ms?: number | null
  created_at?: string | null
  error_code?: string | null
}

/** POST /diary-summary 出参（schemas.ts LayeredDiarySummaryOutput） */
export interface DiarySummaryResponse {
  status: 'pending' | 'ready' | 'failed' | string
  insight?: string | null
  highlights?: { text: string; entry_ids: string[] }[] | null
}

/* ============ 画像与公开主页 ============ */

/** 画像中的原子事实；公开事实可发布，私人事实只服务于本人 */
export interface RemoteProfileFact {
  id: string
  dimension: string
  value: string
  source: string
  source_ref?: string | null
  confidence: number
  user_confirmed: boolean
  visibility: 'public' | 'private'
  fact_kind?: string
  sensitivity?: 'low' | 'medium' | 'high' | string
  support_count?: number
  valid_from?: string | null
  valid_to?: string | null
  last_supported_at?: string | null
  status?: 'active' | 'superseded' | string
  observed_at?: string | null
  updated_at?: string | null
}

/** 建议模块外链 */
export interface AdviceModuleLink {
  label: string
  url: string
}

/** 建议模块（public_profiles.advice jsonb 元素） */
export interface AdviceModule {
  id: string
  title: string
  content: string
  links: AdviceModuleLink[]
}

/** 服务开关（public_profiles.services jsonb 元素） */
export interface ServiceOffer {
  id: string
  enabled: boolean
  type: string
  title: string
  price: string
  desc: string
}

/** public_profiles 行的 wire 模型 */
export interface RemotePublicProfile {
  profile_version?: number | null
  name?: string | null
  quote?: string | null
  bio?: string | null
  avatar_url?: string | null
  tags?: string[] | null
  trajectory?: TrajectoryNode[] | null
  services?: ServiceOffer[] | null
  advice?: AdviceModule[] | null
  hue?: number | null
  age?: number | null
  city?: string | null
  from_role?: string | null
  to_role?: string | null
  stage?: string | null
  result?: string | null
  story_intro?: string | null
  story_full?: string | null
}

/** final_cards 元素 */
export interface CardGameCardPayload {
  id: string
  name: string
  glyph?: string | null
  group?: string | null
}

/** get-profile card_games 条目 */
export interface RemoteCardGame {
  /** life | marriage | family | social */
  kind: string
  final_cards: CardGameCardPayload[]
  rounds: number
  accepted?: { round?: number; scenario?: string; severity?: number }[] | null
  traded?: { round?: number; scenario?: string; ids?: string[]; reasons?: string[] }[] | null
  created_at?: string | null
}

/** POST /get-profile 云端画像全量出参 */
export interface RemoteProfile {
  portrait_pct: number
  /** 乐观并发控制版本：任何画像事实变更都会递增 */
  profile_revision: number
  verification: {
    status: 'unverified' | 'pending' | 'verified' | 'rejected'
    provider: string | null
    verified_at: string | null
  }
  facts: RemoteProfileFact[]
  card_games: RemoteCardGame[]
  /** public_profiles 行（未建档为 null） */
  public_profile: RemotePublicProfile | null
}
