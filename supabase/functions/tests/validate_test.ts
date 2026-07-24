import { HttpError } from "../_shared/errors.ts";
import {
  validateChatInput,
  validateDiaryInput,
  validateMatchInput,
  validateSimulateInput,
} from "../_shared/validate.ts";

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertHttpError(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error(`expected HttpError ${code}`);
  } catch (error) {
    assert(error instanceof HttpError, "expected HttpError");
    assert(error.code === code, `expected ${code}, got ${error.code}`);
  }
}

Deno.test("chat input normalizes valid payload", () => {
  const input = validateChatInput({
    conversation_id: "01901234-5678-7abc-8def-0123456789ab",
    topic: " 职业 ",
    message: " 要不要转行？ ",
  });
  assert(input.topic === "职业");
  assert(input.message === "要不要转行？");
  assert(input.conversationId === "01901234-5678-7abc-8def-0123456789ab");
});

Deno.test("chat rejects empty and oversized messages", () => {
  assertHttpError(
    () => validateChatInput({ topic: "职业", message: " " }),
    "INVALID_INPUT",
  );
  assertHttpError(
    () => validateChatInput({ topic: "职业", message: "x".repeat(4_001) }),
    "INPUT_TOO_LONG",
  );
});

Deno.test("match requires a non-empty state", () => {
  assertHttpError(
    () => validateMatchInput({ user_state: {} }),
    "INVALID_INPUT",
  );
  const state = validateMatchInput({
    user_state: { tension: "稳定与成长", constraints: ["预算"] },
  });
  assert(state.tension === "稳定与成长");
  assert(state.constraints?.[0] === "预算");
});

Deno.test("simulate validates year range", () => {
  assertHttpError(
    () => validateSimulateInput({ question: "q", choice: "c", years: 0 }),
    "INVALID_INPUT",
  );
  const input = validateSimulateInput({
    question: "是否读研",
    choice: "辞职读研",
    years: 3,
  });
  assert(input.years === 3);
});

Deno.test("diary enforces transcript size", () => {
  assert(
    validateDiaryInput({ transcript: "今天有些焦虑" }).transcript.length > 0,
  );
  assertHttpError(
    () => validateDiaryInput({ transcript: "x".repeat(20_001) }),
    "INPUT_TOO_LONG",
  );
});
