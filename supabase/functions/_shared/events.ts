// 事件清单（契约层 · docs/埋点方案.md §3 的 TypeScript 镜像）
//
// 改动纪律：先改 docs/埋点方案.md，再同步本文件与
// frontend/Core/Analytics/AnalyticsEvent+Catalog.swift。
// 落库实现见 track.ts —— 本文件只定义「有哪些事件、带什么属性」。

/// 埋点属性值：与 Swift 侧 AnalyticsValue 对齐，只允许标量。
/// 禁止写入手机号 / 姓名 / 日记正文 / 对话正文（docs/埋点方案.md §1）。
export type EventProps = Record<string, string | number | boolean | null>;

/// 服务端会上报的事件名。客户端专属事件（paywall_viewed 等）不在此列。
export const ServerEvent = {
  // —— 核心付费漏斗 ——
  /// 对话澄清出具体岔路口：整个产品最关键的中间态指标，
  /// 它决定付费墙能不能被看到。
  CROSSROAD_FORMED: "crossroad_formed",
  CHAT_TURN_COMPLETED: "chat_turn_completed",
  MATCH_REQUESTED: "match_requested",
  MATCH_CONDITIONS_READY: "match_conditions_ready",
  PURCHASE_COMPLETED: "purchase_completed",

  // —— 认证 ——
  IDENTITY_MERGED: "identity_merged",

  // —— 免费层 ——
  LAB_CHOICES_REQUESTED: "lab_choices_requested",
  SIMULATION_REQUESTED: "simulation_requested",
  DIARY_CREATED: "diary_created",

  // —— 成本 ——
  /// 每次 LLM 调用的用量与延迟。第三方埋点工具不管这件事，
  /// 但它直接决定单位经济模型（单用户成本 / 付费用户毛利）。
  LLM_REQUEST: "llm_request",
} as const;

export type ServerEventName = typeof ServerEvent[keyof typeof ServerEvent];

/// llm_request 的属性形状（各字段含义见 docs/埋点方案.md §3.4）
export type LLMRequestProps = {
  function: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  ok: boolean;
  error_code: string | null;
};
