import { HttpError } from "../_shared/errors.ts";
import {
  validateBountyInput,
  validateBountyResponseInput,
  validateChatInput,
  validateDiaryInput,
  validateKaleidoscopeInput,
  validateListInput,
  validateMatchInput,
  validateSaveCardGameInput,
  validateSaveDimensionInput,
  validateSimulateInput,
  validateSimulateInputV2,
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

// ==================== New Validator Tests ====================

Deno.test("simulateV2 accepts valid input with carry_cards", () => {
  const input = validateSimulateInputV2({
    question: "是否读研",
    choice: "辞职读研",
    years: 3,
    carry_cards: ["稳定收入", "身体不透支"],
  });
  assert(input.years === 3);
  assert(input.carry_cards?.length === 2);
  assert(input.carry_cards[0] === "稳定收入");
});

Deno.test("simulateV2 works without carry_cards", () => {
  const input = validateSimulateInputV2({
    question: "要不要创业",
    choice: "全职创业",
    years: 5,
  });
  assert(input.carry_cards === undefined);
});

Deno.test("simulateV2 rejects too many carry_cards", () => {
  assertHttpError(
    () =>
      validateSimulateInputV2({
        question: "q",
        choice: "c",
        years: 2,
        carry_cards: ["a", "b", "c", "d", "e", "f", "g"],
      }),
    "INVALID_INPUT",
  );
});

Deno.test("saveDimension accepts valid input", () => {
  const input = validateSaveDimensionInput({
    dimension: "skill",
    tags: ["编程", "写作", "演讲"],
  });
  assert(input.dimension === "skill");
  assert(input.tags.length === 3);
  assert(input.source === "manual");
});

Deno.test("saveDimension rejects invalid dimension", () => {
  assertHttpError(
    () => validateSaveDimensionInput({ dimension: "invalid", tags: ["x"] }),
    "INVALID_INPUT",
  );
});

Deno.test("saveDimension rejects empty tags", () => {
  assertHttpError(
    () => validateSaveDimensionInput({ dimension: "skill", tags: [] }),
    "INVALID_INPUT",
  );
});

Deno.test("saveCardGame accepts valid input", () => {
  const input = validateSaveCardGameInput({
    kind: "life",
    final_cards: [
      { id: "c1", name: "稳定收入", glyph: "💰" },
      { id: "c2", name: "身体健康" },
    ],
    rounds: 5,
    accepted: [{ round: 1 }],
    traded: [],
  });
  assert(input.kind === "life");
  assert(input.final_cards.length === 2);
  assert(input.rounds === 5);
});

Deno.test("saveCardGame rejects invalid kind", () => {
  assertHttpError(
    () =>
      validateSaveCardGameInput({
        kind: "invalid",
        final_cards: [{ id: "c1", name: "x" }],
        rounds: 0,
        accepted: [],
        traded: [],
      }),
    "INVALID_INPUT",
  );
});

Deno.test("saveCardGame rejects empty final_cards", () => {
  assertHttpError(
    () =>
      validateSaveCardGameInput({
        kind: "marriage",
        final_cards: [],
        rounds: 0,
        accepted: [],
        traded: [],
      }),
    "INVALID_INPUT",
  );
});

Deno.test("listInput provides defaults", () => {
  const input = validateListInput({});
  assert(input.limit === 20);
  assert(input.offset === 0);
});

Deno.test("listInput caps limit at 50", () => {
  const input = validateListInput({ limit: 100, offset: 10 });
  assert(input.limit === 50);
  assert(input.offset === 10);
});

Deno.test("listInput rejects negative offset", () => {
  const input = validateListInput({ limit: 5, offset: -1 });
  assert(input.offset === 0);
});

Deno.test("bountyInput accepts valid input", () => {
  const input = validateBountyInput({
    question: "如何平衡工作和学习？",
    tags: ["职业", "学习"],
    detail: "我想转行但不知道如何平衡...",
    reward: "一杯咖啡",
  });
  assert(input.question.includes("平衡"));
  assert(input.tags.length === 2);
});

Deno.test("bountyInput rejects too many tags", () => {
  assertHttpError(
    () =>
      validateBountyInput({
        question: "q",
        tags: ["a", "b", "c", "d", "e", "f"],
        detail: "d",
        reward: "r",
      }),
    "INVALID_INPUT",
  );
});

Deno.test("bountyResponseInput accepts valid input", () => {
  const input = validateBountyResponseInput({
    bounty_id: 1,
    message: "我有类似经历，可以分享",
  });
  assert(input.bounty_id === 1);
  assert(input.message.includes("分享"));
});

Deno.test("bountyResponseInput rejects invalid bounty_id", () => {
  assertHttpError(
    () => validateBountyResponseInput({ bounty_id: 0, message: "hi" }),
    "INVALID_INPUT",
  );
  assertHttpError(
    () => validateBountyResponseInput({ bounty_id: -1, message: "hi" }),
    "INVALID_INPUT",
  );
});

Deno.test("kaleidoscopeInput accepts similar and different", () => {
  const s = validateKaleidoscopeInput({ mode: "similar" });
  assert(s.mode === "similar");
  const d = validateKaleidoscopeInput({ mode: "different" });
  assert(d.mode === "different");
});

Deno.test("kaleidoscopeInput rejects invalid mode", () => {
  assertHttpError(
    () => validateKaleidoscopeInput({ mode: "random" }),
    "INVALID_INPUT",
  );
  assertHttpError(
    () => validateKaleidoscopeInput({}),
    "INVALID_INPUT",
  );
});
