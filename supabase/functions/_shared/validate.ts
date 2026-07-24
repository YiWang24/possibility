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
