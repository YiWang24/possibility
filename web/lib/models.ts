/* 领域模型 —— 对齐 iOS ContentModels / UserModels，字段名保持后端 snake_case wire 形状 */
import type { Tables } from "@possibility/shared-types";

/* ============ 内容侧（travelers / traveler_details / traveler_services / bounties） ============ */

/** 人生轨迹节点（travelers.trajectory jsonb 元素：{age,t,d}） */
export interface TrajectoryNode {
  /** 如 "28 岁" */
  age: string;
  /** 节点标题 */
  t: string;
  /** 节点详情 */
  d: string;
}

/** 旅人（经验贡献者）—— 对应表 `travelers` */
export interface Traveler {
  id: number;
  name: string;
  /** 头像单字 */
  initial: string;
  /** 配色索引 0..4（theme HUES） */
  hue: number;
  is_similar: boolean;
  quote: string;
  bio: string;
  tags: string[];
  /** 画像维度 [["我擅长","..."], ...] */
  dims: string[][];
  trajectory: TrajectoryNode[];
}

/** travelers 表行 → 领域模型（dims/trajectory jsonb 收窄） */
export function travelerFromRow(row: Tables<"travelers">): Traveler {
  return {
    id: row.id,
    name: row.name,
    initial: row.initial,
    hue: row.hue,
    is_similar: row.is_similar,
    quote: row.quote,
    bio: row.bio,
    tags: row.tags ?? [],
    dims: Array.isArray(row.dims) ? (row.dims as string[][]) : [],
    trajectory: Array.isArray(row.trajectory) ? (row.trajectory as unknown as TrajectoryNode[]) : [],
  };
}

/** 经验与建议（traveler_details.advice jsonb：{decision:[],ability:[],interview:[]}） */
export interface TravelerAdvice {
  decision: string[];
  ability: string[];
  interview: string[];
}

/** 建议分类（原型 advice-chips：转型决策 / 能力迁移 / 求职面试） */
export type AdviceKind = "decision" | "ability" | "interview";

export const ADVICE_KINDS: { kind: AdviceKind; label: string }[] = [
  { kind: "decision", label: "转型决策" },
  { kind: "ability", label: "能力迁移" },
  { kind: "interview", label: "求职面试" },
];

export function adviceTips(advice: TravelerAdvice, kind: AdviceKind): string[] {
  return advice[kind] ?? [];
}

/** 旅人详情 —— 对应表 `traveler_details`（full_text/advice 付费解锁） */
export interface TravelerDetail {
  traveler_id: number;
  age: number | null;
  city: string | null;
  from_role: string | null;
  to_role: string | null;
  years: string | null;
  /** 免费可见 */
  intro: string;
  /** 付费解锁 */
  full_text: string;
  advice: TravelerAdvice;
  result: string | null;
  consulted: number | null;
  response_time: string | null;
}

/** traveler_details 表行 → 领域模型（advice jsonb 收窄，缺失字段兜空） */
export function travelerDetailFromRow(row: Tables<"traveler_details">): TravelerDetail {
  const advice = (row.advice ?? {}) as Partial<TravelerAdvice>;
  return {
    traveler_id: row.traveler_id,
    age: row.age,
    city: row.city,
    from_role: row.from_role,
    to_role: row.to_role,
    years: row.years,
    intro: row.intro,
    full_text: row.full_text,
    advice: {
      decision: advice.decision ?? [],
      ability: advice.ability ?? [],
      interview: advice.interview ?? [],
    },
    result: row.result,
    consulted: row.consulted,
    response_time: row.response_time,
  };
}

/** 增值服务 —— 对应表 `traveler_services` */
export interface TravelerServiceItem {
  /** consult / materials / companion（表内为 "consult-1" 等） */
  id: string;
  traveler_id: number | null;
  kind: string;
  title: string;
  price: number;
  unit: string;
  description: string;
  tags: string[];
}

/** 悬赏 —— 对应表 `bounties`（community list_bounties / get_bounty 返回全字段） */
export interface Bounty {
  id: number;
  question: string;
  reward: string;
  responses: string;
  tags?: string[] | null;
  detail?: string | null;
  status?: string | null;
  created_at?: string | null;
}

/**
 * 列表金额展示。兼容线上旧数据：
 * - 新数据/已修复数据直接从「¥29 悬赏」「29 元」提取；
 * - 三条内置种子按详情 mock 的既有金额兜底；
 * - 测试帖或未填写金额显示 ¥0。
 */
export function bountyDisplayAmount(bounty: Bounty): string {
  const normalized = bounty.reward.replaceAll("￥", "¥");
  const patterns = [/¥\s*\d+(?:\.\d{1,2})?/, /\d+(?:\.\d{1,2})?\s*元/];
  for (const pattern of patterns) {
    const m = normalized.match(pattern);
    if (m) {
      const digits = m[0].replace(/[^\d.]/g, "");
      if (digits) return `¥${digits}`;
    }
  }
  switch (bounty.id) {
    case 1:
      return "¥29";
    case 2:
      return "¥19.9";
    case 3:
      return "¥39";
    default:
      return "¥0";
  }
}

/** 金额已在卡片底栏单独呈现；这里仅保留旧数据中的征集目标 */
export function bountyRewardGoal(bounty: Bounty): string | null {
  const trimmed = bounty.reward.trim();
  if (!trimmed || trimmed === "无") return null;
  if (trimmed.includes("¥") || trimmed.includes("￥") || trimmed.includes("元")) return null;
  return trimmed;
}

/** bounty_responses 行：{id, user_id, message, created_at} */
export interface BountyReply {
  id: number;
  user_id: string;
  message: string;
  created_at?: string | null;
}

/** POST /community action=get_bounty 出参：悬赏详情 + 回应列表 */
export interface BountyDetailResponse {
  bounty: Bounty;
  responses: BountyReply[];
}

/* ============ 用户侧（RLS 锁 auth.uid()） ============ */

/** 当前用户动态画像 —— 对应表 `profiles` */
export interface UserProfile {
  id: string;
  portrait_pct: number;
  /** 我擅长 / 我喜欢 / …（维度名 → 内容） */
  dims: Record<string, string>;
}

/** 匹配条件（岔路口成形后，用于 POST /match 的 user_state） */
export interface MatchQuery {
  life_stage?: string | null;
  constraints?: string[] | null;
  tension?: string | null;
  decision_stage?: string | null;
  support_need?: string | null;
}

/** 岔路口信号（conversations.crossroads jsonb：{ready,summary,match_query}） */
export interface Crossroads {
  /** true 时前端解锁「看看走过这条路的人」 */
  ready: boolean;
  /** 如 "留学 vs 保研" */
  summary?: string | null;
  match_query?: MatchQuery | null;
}

/** 对话（一次迷茫 → 一个岔路口）—— 对应表 `conversations` */
export interface Conversation {
  id: string;
  user_id: string;
  /** 职业 / 家庭 / 升学 / 情感 */
  topic: string;
  /** open | crossroads | paid | closed */
  status: string;
  crossroads?: Crossroads | null;
}

/** 消息 —— 对应表 `messages` */
export interface ChatMessageRow {
  id: number;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
}

/** 解锁记录 —— 对应表 `unlocks`（demo mock 支付） */
export interface Unlock {
  user_id: string;
  /** profile | service */
  kind: "profile" | "service";
  /** traveler_id / service id */
  target_id: string;
  amount: number;
}

/** POST /match 出参：3 位结局不同的旅人 + 可解释理由 */
export interface AIContextDisclosure {
  purpose: "persona" | "chat" | "match" | "lab" | "community";
  dimensions: string[];
  /** 本次 AI 上下文对应的画像版本；用于向用户解释和排查跨设备更新。 */
  profile_revision?: number;
  /** 本次 AI 上下文对应的用途授权版本。 */
  permission_revision?: number;
}

export interface MatchResponse {
  matches: {
    traveler_id: number;
    /** 为什么推荐给你（可解释） */
    reason: string;
    /** 不适用条件（避免确认偏误） */
    not_applicable: string;
  }[];
  ai_context?: AIContextDisclosure;
}

/** POST /list-conversations 出参条目 */
export interface RemoteConversation {
  id: string;
  topic: string;
  /** open | crossroads | paid | closed */
  status: string;
  crossroads?: Crossroads | null;
  created_at?: string | null;
}

/* ============ 公开主页（public_profiles jsonb 子结构，MyProfile 复用） ============ */

/** 建议模块外链 */
export interface AdviceModuleLink {
  label: string;
  url: string;
}

/** 建议模块（public_profiles.advice jsonb 元素） */
export interface AdviceModule {
  id: string;
  title: string;
  content: string;
  links: AdviceModuleLink[];
}

/** 服务开关（public_profiles.services jsonb 元素） */
export interface ServiceOffer {
  id: string;
  enabled: boolean;
  type: string;
  title: string;
  price: string;
  desc: string;
}

/** public_profiles 行的 wire 模型（snake_case 仅 avatar_url，jsonb 复用 MyProfile 嵌套形状） */
export interface RemotePublicProfile {
  profile_version?: number | null;
  name?: string | null;
  quote?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  tags?: string[] | null;
  trajectory?: TrajectoryNode[] | null;
  services?: ServiceOffer[] | null;
  advice?: AdviceModule[] | null;
  visibility?: Record<string, boolean> | null;
  hue?: number | null;
  age?: number | null;
  city?: string | null;
  from_role?: string | null;
  to_role?: string | null;
  stage?: string | null;
  result?: string | null;
  story_intro?: string | null;
  story_full?: string | null;
}

/** 与公开 visibility 分离的私有 AI 用途授权。 */
export interface RemoteAIPermissions {
  permissions: Record<string, Record<string, boolean>>;
  permission_revision: number;
  updated_at?: string | null;
}

/* ============ GET /get-profile 出参 ============ */

/** 私密画像中的原子事实；AI 只会读取当前用途明确授权的 active 事实。 */
export interface RemoteProfileFact {
  id: string;
  dimension: string;
  value: string;
  source: string;
  source_ref?: string | null;
  confidence: number;
  user_confirmed: boolean;
  fact_kind?: string;
  sensitivity?: "low" | "medium" | "high" | string;
  support_count?: number;
  valid_from?: string | null;
  valid_to?: string | null;
  last_supported_at?: string | null;
  status?: "active" | "superseded" | string;
  observed_at?: string | null;
  updated_at?: string | null;
}

/** final_cards 元素（id/name 必填，glyph/group 可选） */
export interface CardGameCardPayload {
  id: string;
  name: string;
  glyph?: string | null;
  group?: string | null;
}

/** GET /get-profile card_games 条目 */
export interface RemoteCardGame {
  /** life | marriage | family | social */
  kind: string;
  final_cards: CardGameCardPayload[];
  rounds: number;
  accepted?: { round?: number; scenario?: string; severity?: number }[] | null;
  traded?: { round?: number; scenario?: string; ids?: string[]; reasons?: string[] }[] | null;
  created_at?: string | null;
}

/** GET /get-profile 云端画像全量出参 */
export interface RemoteProfile {
  portrait_pct: number;
  /** 乐观并发控制版本：任何私密画像变更都会递增。 */
  profile_revision: number;
  facts: RemoteProfileFact[];
  card_games: RemoteCardGame[];
  /** public_profiles 行（未建档为 null） */
  public_profile: RemotePublicProfile | null;
  /** profile_ai_permissions 私有行（未设置为 null） */
  ai_permissions: RemoteAIPermissions | null;
}

/* ============ 常量（对齐 iOS AppConfig） ============ */

/** mock 解锁完整经验价格（¥9.9） */
export const PRICE_UNLOCK_PROFILE = 9.9;
/** 首次进入没有 profile 行时的本地兜底画像完成度 */
export const PORTRAIT_INITIAL_PCT = 60;

/* ============ 探索话题（对应原型 topicChips） ============ */

export interface ExploreTopic {
  /** 职业 / 家庭 / 升学 / 情感 */
  topic: string;
  /** 原型 TOPIC_SAMPLES 的占位问题 */
  sampleQuestion: string;
}

export const EXPLORE_TOPICS: ExploreTopic[] = [
  { topic: "职业", sampleQuestion: "我是否要从交互设计师转为产品经理？" },
  { topic: "家庭", sampleQuestion: "要不要搬回父母所在的城市生活？" },
  { topic: "升学", sampleQuestion: "26 岁了，还要不要辞职去读研？" },
  { topic: "情感", sampleQuestion: "异地三年，要不要为 TA 换一座城市？" },
];

/** 仅四条预置问题使用本地 mock 对话；用户自行输入的任何其他内容都走 API */
export function isSampleQuestion(question: string): boolean {
  const clean = question.trim();
  return EXPLORE_TOPICS.some((t) => t.sampleQuestion === clean);
}
