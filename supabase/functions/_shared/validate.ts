import { LIMITS } from "./config.ts";
import { HttpError } from "./errors.ts";

type JsonObject = Record<string, unknown>;

function object(value: unknown, field = "body"): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_INPUT", `${field} 必须是对象。`);
  }
  return value as JsonObject;
}

function string(
  value: unknown,
  field: string,
  maxLength: number,
  required = true,
): string | undefined {
  if (value === undefined || value === null) {
    if (!required) return undefined;
    throw new HttpError(400, "INVALID_INPUT", `${field} 不能为空。`);
  }
  if (typeof value !== "string") {
    throw new HttpError(400, "INVALID_INPUT", `${field} 必须是字符串。`);
  }
  const normalized = value.trim();
  if (!normalized && required) {
    throw new HttpError(400, "INVALID_INPUT", `${field} 不能为空。`);
  }
  if (normalized.length > maxLength) {
    throw new HttpError(
      400,
      "INPUT_TOO_LONG",
      `${field} 最多 ${maxLength} 个字符。`,
    );
  }
  return normalized;
}

function uuid(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const result = string(value, field, 64);
  if (
    !result ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(result)
  ) {
    throw new HttpError(400, "INVALID_INPUT", `${field} 不是有效 UUID。`);
  }
  return result;
}

export type ChatInput = {
  conversationId?: string;
  topic: string;
  message: string;
};

export function validateChatInput(value: unknown): ChatInput {
  const body = object(value);
  return {
    conversationId: uuid(body.conversation_id, "conversation_id"),
    topic: string(body.topic, "topic", LIMITS.topic)!,
    message: string(body.message, "message", LIMITS.message)!,
  };
}

export type MatchState = {
  life_stage?: string;
  constraints?: string[];
  tension?: string;
  decision_stage?: string;
  support_need?: string;
};

function optionalStringArray(
  value: unknown,
  field: string,
  maxItems: number,
  itemMaxLength: number,
): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      `${field} 必须是长度不超过 ${maxItems} 的数组。`,
    );
  }
  return value.map((item, index) =>
    string(item, `${field}[${index}]`, itemMaxLength)!
  );
}

export function validateMatchInput(value: unknown): MatchState {
  const body = object(value);
  const state = object(body.user_state, "user_state");
  const result: MatchState = {
    life_stage: string(state.life_stage, "user_state.life_stage", 200, false),
    constraints: optionalStringArray(
      state.constraints,
      "user_state.constraints",
      10,
      200,
    ),
    tension: string(state.tension, "user_state.tension", 500, false),
    decision_stage: string(
      state.decision_stage,
      "user_state.decision_stage",
      200,
      false,
    ),
    support_need: string(
      state.support_need,
      "user_state.support_need",
      300,
      false,
    ),
  };
  if (!Object.values(result).some((item) => item !== undefined)) {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      "user_state 至少需要一个有效字段。",
    );
  }
  return result;
}

export type SimulateInput = {
  question: string;
  choice: string;
  years: number;
};

export function validateSimulateInput(value: unknown): SimulateInput {
  const body = object(value);
  const years = body.years;
  if (
    !Number.isInteger(years) || (years as number) < 1 || (years as number) > 10
  ) {
    throw new HttpError(400, "INVALID_INPUT", "years 必须是 1 到 10 的整数。");
  }
  return {
    question: string(body.question, "question", LIMITS.question)!,
    choice: string(body.choice, "choice", LIMITS.choice)!,
    years: years as number,
  };
}

export function validateDiaryInput(value: unknown): { transcript: string } {
  const body = object(value);
  return {
    transcript: string(body.transcript, "transcript", LIMITS.transcript)!,
  };
}

export type SaveDimensionInput = {
  dimension: string;
  tags: string[];
  source?: string;
};

export function validateSaveDimensionInput(value: unknown): SaveDimensionInput {
  const body = object(value);
  const dimension = string(body.dimension, "dimension", 50)!;
  const validDimensions = [
    "skill",
    "like",
    "love",
    "family",
    "social",
    "personality",
  ];
  if (!validDimensions.includes(dimension)) {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      `dimension 必须是 ${validDimensions.join("/")} 之一。`,
    );
  }
  const tags = body.tags;
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > 20) {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      "tags 必须是 1-20 项的数组。",
    );
  }
  const validatedTags = tags.map((t, i) => string(t, `tags[${i}]`, 50)!);
  const source = string(body.source, "source", 30, false) ?? "manual";
  return { dimension, tags: validatedTags, source };
}

export type SaveCardGameInput = {
  kind: string;
  final_cards: Array<
    { id: string; name: string; glyph?: string; group?: string }
  >;
  rounds: number;
  accepted: unknown[];
  traded: unknown[];
};

export function validateSaveCardGameInput(value: unknown): SaveCardGameInput {
  const body = object(value);
  const kind = string(body.kind, "kind", 20)!;
  const validKinds = ["life", "marriage", "family", "social"];
  if (!validKinds.includes(kind)) {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      `kind 必须是 ${validKinds.join("/")} 之一。`,
    );
  }
  const finalCards = body.final_cards;
  if (
    !Array.isArray(finalCards) || finalCards.length < 1 || finalCards.length > 9
  ) {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      "final_cards 必须是 1-9 项的数组。",
    );
  }
  const validatedCards = finalCards.map((card, i) => {
    const c = object(card, `final_cards[${i}]`);
    return {
      id: string(c.id, `final_cards[${i}].id`, 50)!,
      name: string(c.name, `final_cards[${i}].name`, 50)!,
      glyph: string(c.glyph, `final_cards[${i}].glyph`, 10, false),
      group: string(c.group, `final_cards[${i}].group`, 50, false),
    };
  });
  const rounds = body.rounds;
  if (
    !Number.isInteger(rounds) || (rounds as number) < 0 ||
    (rounds as number) > 100
  ) {
    throw new HttpError(400, "INVALID_INPUT", "rounds 必须是 0-100 的整数。");
  }
  const accepted = Array.isArray(body.accepted) ? body.accepted : [];
  const traded = Array.isArray(body.traded) ? body.traded : [];
  return {
    kind,
    final_cards: validatedCards,
    rounds: rounds as number,
    accepted,
    traded,
  };
}

export type SimulateInputV2 = {
  question: string;
  choice: string;
  years: number;
  time_horizon: string;
  carry_cards?: string[];
};

export function validateSimulateInputV2(value: unknown): SimulateInputV2 {
  const body = object(value);
  const years = body.years;
  if (
    !Number.isInteger(years) || (years as number) < 1 || (years as number) > 10
  ) {
    throw new HttpError(400, "INVALID_INPUT", "years 必须是 1 到 10 的整数。");
  }
  const carryCards = optionalStringArray(
    body.carry_cards,
    "carry_cards",
    6,
    50,
  );
  const allowedHorizons = new Set([
    "7天",
    "30天",
    "3个月",
    "6个月",
    ...Array.from({ length: 10 }, (_, index) => `${index + 1}年`),
  ]);
  const timeHorizon = body.time_horizon === undefined
    ? `${years}年`
    : string(body.time_horizon, "time_horizon", 8)!;
  if (!allowedHorizons.has(timeHorizon)) {
    throw new HttpError(400, "INVALID_INPUT", "time_horizon 不是支持的时间跨度。");
  }
  return {
    question: string(body.question, "question", LIMITS.question)!,
    choice: string(body.choice, "choice", LIMITS.choice)!,
    years: years as number,
    time_horizon: timeHorizon,
    carry_cards: carryCards,
  };
}

export type ListInput = {
  limit: number;
  offset: number;
};

export function validateListInput(value: unknown): ListInput {
  const body = object(value);
  let limit = body.limit ?? 20;
  let offset = body.offset ?? 0;
  if (!Number.isInteger(limit) || (limit as number) < 1) limit = 20;
  if ((limit as number) > 50) limit = 50;
  if (!Number.isInteger(offset) || (offset as number) < 0) offset = 0;
  return { limit: limit as number, offset: offset as number };
}

export type BountyInput = {
  question: string;
  tags: string[];
  detail: string;
  reward: string;
};

export function validateBountyInput(value: unknown): BountyInput {
  const body = object(value);
  const tags = body.tags;
  if (!Array.isArray(tags) || tags.length > 5) {
    throw new HttpError(400, "INVALID_INPUT", "tags 最多 5 项。");
  }
  const validatedTags = (tags as unknown[]).map((t, i) =>
    string(t, `tags[${i}]`, 30)!
  );
  return {
    question: string(body.question, "question", 200)!,
    tags: validatedTags,
    detail: string(body.detail, "detail", 2000)!,
    reward: string(body.reward, "reward", 50)!,
  };
}

export type BountyResponseInput = {
  bounty_id: number;
  message: string;
};

export function validateBountyResponseInput(
  value: unknown,
): BountyResponseInput {
  const body = object(value);
  const bountyId = body.bounty_id;
  if (!Number.isInteger(bountyId) || (bountyId as number) < 1) {
    throw new HttpError(400, "INVALID_INPUT", "bounty_id 必须是正整数。");
  }
  return {
    bounty_id: bountyId as number,
    message: string(body.message, "message", 500)!,
  };
}

export type GetBountyInput = {
  bounty_id: number;
};

export function validateGetBountyInput(value: unknown): GetBountyInput {
  const body = object(value);
  const bountyId = body.bounty_id;
  if (!Number.isInteger(bountyId) || (bountyId as number) < 1) {
    throw new HttpError(400, "INVALID_INPUT", "bounty_id 必须是正整数。");
  }
  return { bounty_id: bountyId as number };
}

export type DiarySummaryInput = {
  period: "month" | "year";
  ref: string;
};

export function validateDiarySummaryInput(value: unknown): DiarySummaryInput {
  const body = object(value);
  const period = string(body.period, "period", 10)!;
  if (period !== "month" && period !== "year") {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      "period 必须是 month 或 year。",
    );
  }
  const ref = string(body.ref, "ref", 10)!;
  if (period === "month") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ref)) {
      throw new HttpError(
        400,
        "INVALID_INPUT",
        "month 的 ref 必须形如 2026-07。",
      );
    }
  } else if (!/^\d{4}$/.test(ref)) {
    throw new HttpError(400, "INVALID_INPUT", "year 的 ref 必须形如 2026。");
  }
  return { period, ref };
}

export type KaleidoscopeInput = {
  mode: "similar" | "different";
  recentlyViewedIds: number[];
};

function optionalIntArray(
  value: unknown,
  field: string,
  maxItems: number,
): number[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      `${field} 必须是长度不超过 ${maxItems} 的整数数组。`,
    );
  }
  return value.map((item, index) => {
    if (!Number.isInteger(item)) {
      throw new HttpError(
        400,
        "INVALID_INPUT",
        `${field}[${index}] 必须是整数。`,
      );
    }
    return item as number;
  });
}

export function validateKaleidoscopeInput(value: unknown): KaleidoscopeInput {
  const body = object(value);
  const mode = string(body.mode, "mode", 20)!;
  if (mode !== "similar" && mode !== "different") {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      "mode 必须是 similar 或 different。",
    );
  }
  return {
    mode: mode as "similar" | "different",
    recentlyViewedIds: optionalIntArray(
      body.recently_viewed_ids,
      "recently_viewed_ids",
      20,
    ),
  };
}

export type LabChoiceInput = {
  question: string;
  topic?: string;
  constraints?: string[];
  previousChoices?: string[];
};

export function validateLabChoiceInput(value: unknown): LabChoiceInput {
  const body = object(value);
  return {
    question: string(body.question, "question", LIMITS.question)!,
    topic: string(body.topic, "topic", LIMITS.topic, false),
    constraints: optionalStringArray(
      body.constraints,
      "constraints",
      10,
      200,
    ),
    previousChoices: optionalStringArray(
      body.previous_choices,
      "previous_choices",
      10,
      100,
    ),
  };
}

export type PersonaInput = {
  action: "generate" | "status";
  jobId?: string;
  promptOverride?: string;
};

export function validatePersonaInput(value: unknown): PersonaInput {
  const body = object(value);
  const action = string(body.action, "action", 20, false) ?? "generate";
  if (action !== "generate" && action !== "status") {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      "action 必须是 generate 或 status。",
    );
  }
  if (action === "status") {
    const jobId = uuid(body.job_id, "job_id");
    if (!jobId) {
      throw new HttpError(400, "INVALID_INPUT", "status 需要有效的 job_id。");
    }
    return { action, jobId };
  }
  return {
    action,
    promptOverride: string(body.prompt_override, "prompt_override", 500, false),
  };
}
