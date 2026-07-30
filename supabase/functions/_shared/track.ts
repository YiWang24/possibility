// 服务端埋点落库（docs/埋点方案.md Layer 1 · 事件清单见 events.ts）。
//
// 铁律：埋点绝不能影响主流程。
// 本模块所有导出都返回 void 且不抛错——调用点写一行就走，失败只留 console.error。
// 之所以做得这么绝对：埋点是「观测」，它坏掉的代价是少一条数据；主流程坏掉的
// 代价是用户看不到 AI 回复。任何让前者拖垮后者的写法都是本末倒置。
//
// 写入用 service_role（见 service.ts）：app_events 对 authenticated 只开 insert
// 且强制 user_id = auth.uid()（0017），服务端事件的 user_id 来自已验签的 JWT，
// 但 Edge Function 手里的用户态 db 客户端在流式响应结束后可能已不可用，统一走
// service_role 更稳，也顺带避免 RLS 回退把埋点写失败。

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.0";
import { errorText, runInBackground } from "./background.ts";
import { serviceClient } from "./service.ts";
import type { EventProps, ServerEventName } from "./events.ts";
import { ServerEvent } from "./events.ts";

const EVENTS_TABLE = "app_events";
/// 服务端写入固定标记来源，便于和 iOS 上报的同名事件副本区分（§4 source 列）。
const EVENT_SOURCE = "server";

/// 字符串属性长度上限。日记/对话正文必然远超此值，超长即视为误传正文并丢弃。
/// 正常的派生属性（sku、entry_point、model 名、error_code）都是短标识符。
const MAX_STRING_CHARS = 120;
/// 单事件属性数量上限：正常事件最多 7 个属性，超出说明调用点在倾倒对象。
const MAX_PROPS = 16;

/// 明确禁用的属性名：这些键名在本项目里一定装的是正文或身份信息（§1）。
/// 需要它们的特征时改上报派生值，例如 content_chars 而不是 content。
const DENIED_KEYS = new Set([
  "message",
  "content",
  "transcript",
  "text",
  "prompt",
  "reply",
  "answer",
  "summary",
  "question",
  "choice",
  "phone",
  "name",
  "email",
  "token",
  "access_token",
]);

/// 话题分类的合法取值，镜像 iOS 的 ExploreTopic
/// （ios/Possibility/Core/Models/UserModels.swift）。
///
/// 为什么埋点属性也需要一张白名单：键名黑名单只挡得住「叫 content 的字段装正文」，
/// 挡不住「叫 topic 的合法字段装了用户原话」。lab-choices 的 topic 在 validate.ts
/// 里只校验「字符串且 ≤40 字」，是自由文本——直接上报等于开了一条 40 字的 PII 通道。
/// 值域收敛成有限集之后，这个属性从结构上就不可能装下用户内容。
const ANALYTICS_TOPICS = new Set(["职业", "家庭", "升学", "情感"]);

/// 不在白名单内一律归到这里。与 iOS 的 LabModel.analyticsTopic 取同一个字面量，
/// 否则同一个事件在 source='ios' 与 source='server' 两侧的取值对不上账。
export const TOPIC_OTHER = "custom";

/**
 * 把自由文本话题收敛到 ExploreTopic 的固定取值集合。
 *
 * 注意口径：iOS 侧能拿用户问题去匹配首页四条预置问题从而还原出准确话题，
 * 服务端只拿得到 topic 字段本身（客户端当前根本不传），因此服务端这一列
 * 绝大多数会是 custom。**话题分布请以 source='ios' 的事件为准**，服务端这份
 * 是防上报丢失的兜底事实，主要用于把「请求次数」数准。
 */
export function normalizeTopic(topic: string | null | undefined): string {
  const clean = (topic ?? "").trim();
  return ANALYTICS_TOPICS.has(clean) ? clean : TOPIC_OTHER;
}

/** LLM 调用的埋点上下文：调用方是谁、算在哪个功能头上。 */
export type LLMTrackContext = {
  userId: string | null;
  /// 对应 llm_request.function（match / chat / simulate / ...）
  feature: string;
};

/** 属性值是否为可入库的标量（对齐 events.ts 的 EventProps 与 §1 的类型约束）。 */
function isAllowedScalar(
  value: unknown,
): value is string | number | boolean | null {
  if (value === null) return true;
  const type = typeof value;
  if (type === "boolean") return true;
  // NaN / Infinity 会被 JSON.stringify 写成 null，指标里看不出是坏数据，直接拒。
  if (type === "number") return Number.isFinite(value as number);
  if (type === "string") return (value as string).length <= MAX_STRING_CHARS;
  return false;
}

/**
 * 属性白名单/标量校验：只放行短标量，拦掉正文与 PII（§1）。
 *
 * 拦到就丢该属性并 console.error（而不是丢整条事件）——漏一个属性只是指标少一维，
 * 丢整条事件会让漏斗分母直接错位。同时留日志，好在开发期就被发现。
 */
export function sanitizeProps(props: EventProps): EventProps {
  const clean: EventProps = {};
  let kept = 0;
  for (const [key, value] of Object.entries(props)) {
    if (DENIED_KEYS.has(key)) {
      console.error(`analytics: dropped PII-prone prop "${key}"`);
      continue;
    }
    if (!isAllowedScalar(value)) {
      console.error(`analytics: dropped non-scalar/oversized prop "${key}"`);
      continue;
    }
    if (kept >= MAX_PROPS) {
      console.error(`analytics: dropped prop "${key}" beyond ${MAX_PROPS} cap`);
      continue;
    }
    clean[key] = value;
    kept++;
  }
  return clean;
}

/**
 * 记录一个服务端事件。fire-and-forget：立即返回，永不抛错、永不阻塞响应。
 *
 * @param userId 为 null 时事件仍会落库（去标识化），便于统计未登录路径。
 * @param client 仅测试注入；生产走 service_role 单例。
 */
export function trackEvent(
  userId: string | null,
  event: ServerEventName,
  props: EventProps = {},
  client?: SupabaseClient,
): void {
  try {
    const db = client ?? serviceClient();
    runInBackground(
      Promise.resolve(
        db.from(EVENTS_TABLE).insert({
          event_id: crypto.randomUUID(),
          user_id: userId,
          event,
          props: sanitizeProps(props),
          source: EVENT_SOURCE,
        }),
      ).then((result) => {
        // supabase-js 不 reject，错误在返回值里；不检查就等于静默丢数。
        const error = (result as { error?: { message?: string } } | null)
          ?.error;
        if (error) {
          console.error(`analytics: insert ${event} failed:`, error.message);
        }
      }),
    );
  } catch (error) {
    // 连客户端都建不出来（缺环境变量等）——照样不能影响主流程。
    console.error(`analytics: track ${event} failed:`, errorText(error));
  }
}

/** AI SDK 的 usage 归一化结果（对齐 §3.4 的 llm_request 属性名）。 */
export type NormalizedUsage = {
  prompt_tokens: number;
  completion_tokens: number;
};

/**
 * 归一化 AI SDK 的 usage。
 *
 * ai@7 用 inputTokens / outputTokens，旧版（≤4）用 promptTokens / completionTokens；
 * 两种都认，取不到时记 0——成本报表宁可少算也不能因为字段改名整条链路崩掉。
 */
export function normalizeUsage(usage: unknown): NormalizedUsage {
  const u = (usage ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]): number => {
    for (const key of keys) {
      const value = u[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.max(0, Math.trunc(value));
      }
    }
    return 0;
  };
  return {
    prompt_tokens: pick("inputTokens", "promptTokens"),
    completion_tokens: pick("outputTokens", "completionTokens"),
  };
}

/** 一次 LLM 调用的结果快照（每次真实上游请求一条，含失败与重试）。 */
export type LLMOutcome = {
  model: string;
  usage?: unknown;
  latencyMs: number;
  ok: boolean;
  errorCode?: string | null;
};

/**
 * 记录一次 LLM 调用（§3.4 llm_request）。ctx 为空即无声跳过，方便调用点用可选参数。
 *
 * 为什么每次尝试都记一条而不是每个业务请求记一条：重试同样会打到 DeepSeek，
 * 同样烧钱。按尝试记账，成本报表才等于账单。
 */
export function trackLLMRequest(
  ctx: LLMTrackContext | undefined,
  outcome: LLMOutcome,
  client?: SupabaseClient,
): void {
  if (!ctx) return;
  const { prompt_tokens, completion_tokens } = normalizeUsage(outcome.usage);
  trackEvent(ctx.userId, ServerEvent.LLM_REQUEST, {
    function: ctx.feature,
    model: outcome.model,
    prompt_tokens,
    completion_tokens,
    latency_ms: Math.max(0, Math.trunc(outcome.latencyMs)),
    ok: outcome.ok,
    error_code: outcome.errorCode ?? null,
  }, client);
}
