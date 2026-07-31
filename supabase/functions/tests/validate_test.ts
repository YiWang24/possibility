import { HttpError } from "../_shared/errors.ts";
import {
  validateBountyInput,
  validateBountyResponseInput,
  validateChatInput,
  validateDiaryInput,
  validateDiarySummaryInput,
  validateGetBountyInput,
  validateKaleidoscopeInput,
  validateLabChoiceInput,
  validateListInput,
  validateMatchInput,
  validatePersonaInput,
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
    validateDiaryInput({
      transcript: "今天有些焦虑",
      input_method: "voice",
    }).transcript.length > 0,
  );
  assertHttpError(
    () =>
      validateDiaryInput({
        transcript: "x".repeat(20_001),
        input_method: "text",
      }),
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
  assert(input.time_horizon === "5年");
});

Deno.test("simulateV2 accepts short time horizons", () => {
  const input = validateSimulateInputV2({
    question: "要不要转行",
    choice: "先做一个副业项目",
    years: 1,
    time_horizon: "7天",
  });
  assert(input.time_horizon === "7天");
});

Deno.test("simulateV2 rejects unsupported time horizons", () => {
  assertHttpError(
    () =>
      validateSimulateInputV2({
        question: "q",
        choice: "c",
        years: 1,
        time_horizon: "2个月",
      }),
    "INVALID_INPUT",
  );
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

Deno.test("saveDimension only accepts user-authored sources", () => {
  const assessment = validateSaveDimensionInput({
    dimension: "personality",
    tags: ["审慎"],
    source: "assessment",
  });
  assert(assessment.source === "assessment");
  assertHttpError(
    () =>
      validateSaveDimensionInput({
        dimension: "skill",
        tags: ["推断内容"],
        source: "chat",
      }),
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

Deno.test("getBountyInput accepts a positive integer id", () => {
  const input = validateGetBountyInput({ bounty_id: 3 });
  assert(input.bounty_id === 3);
});

Deno.test("getBountyInput rejects missing or invalid bounty_id", () => {
  assertHttpError(() => validateGetBountyInput({}), "INVALID_INPUT");
  assertHttpError(
    () => validateGetBountyInput({ bounty_id: 0 }),
    "INVALID_INPUT",
  );
  assertHttpError(
    () => validateGetBountyInput({ bounty_id: 1.5 }),
    "INVALID_INPUT",
  );
  assertHttpError(
    () => validateGetBountyInput({ bounty_id: "1" }),
    "INVALID_INPUT",
  );
});

Deno.test("diarySummaryInput accepts month and year refs", () => {
  const month = validateDiarySummaryInput({ period: "month", ref: "2026-07" });
  assert(month.period === "month" && month.ref === "2026-07");
  const year = validateDiarySummaryInput({ period: "year", ref: "2026" });
  assert(year.period === "year" && year.ref === "2026");
});

Deno.test("diarySummaryInput rejects invalid period and ref formats", () => {
  assertHttpError(
    () => validateDiarySummaryInput({ period: "week", ref: "2026-07" }),
    "INVALID_INPUT",
  );
  assertHttpError(
    () => validateDiarySummaryInput({ period: "month", ref: "2026-7" }),
    "INVALID_INPUT",
  );
  assertHttpError(
    () => validateDiarySummaryInput({ period: "month", ref: "2026-13" }),
    "INVALID_INPUT",
  );
  assertHttpError(
    () => validateDiarySummaryInput({ period: "month", ref: "2026" }),
    "INVALID_INPUT",
  );
  assertHttpError(
    () => validateDiarySummaryInput({ period: "year", ref: "2026-07" }),
    "INVALID_INPUT",
  );
  assertHttpError(
    () => validateDiarySummaryInput({ period: "year" }),
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

Deno.test("kaleidoscopeInput parses recently_viewed_ids", () => {
  const input = validateKaleidoscopeInput({
    mode: "similar",
    recently_viewed_ids: [1, 2, 3],
  });
  assert(input.recentlyViewedIds.length === 3);
  const empty = validateKaleidoscopeInput({ mode: "different" });
  assert(empty.recentlyViewedIds.length === 0);
});

Deno.test("kaleidoscopeInput rejects non-integer recently_viewed_ids", () => {
  assertHttpError(
    () =>
      validateKaleidoscopeInput({
        mode: "similar",
        recently_viewed_ids: [1.5],
      }),
    "INVALID_INPUT",
  );
});

Deno.test("labChoiceInput accepts minimal and full input", () => {
  const minimal = validateLabChoiceInput({ question: "要不要转行？" });
  assert(minimal.question.includes("转行"));
  assert(minimal.constraints === undefined);
  const full = validateLabChoiceInput({
    question: "要不要转行？",
    topic: "职业",
    constraints: ["不降薪"],
    previous_choices: ["继续现职"],
  });
  assert(full.topic === "职业");
  assert(full.constraints?.[0] === "不降薪");
  assert(full.previousChoices?.[0] === "继续现职");
});

Deno.test("labChoiceInput rejects empty question", () => {
  assertHttpError(
    () => validateLabChoiceInput({ question: " " }),
    "INVALID_INPUT",
  );
});

Deno.test("personaInput defaults to generate", () => {
  const input = validatePersonaInput({});
  assert(input.action === "generate");
  assert(input.jobId === undefined);
});

Deno.test("personaInput status requires job_id", () => {
  assertHttpError(
    () => validatePersonaInput({ action: "status" }),
    "INVALID_INPUT",
  );
  const input = validatePersonaInput({
    action: "status",
    job_id: "01901234-5678-7abc-8def-0123456789ab",
  });
  assert(input.action === "status");
  assert(input.jobId === "01901234-5678-7abc-8def-0123456789ab");
});

Deno.test("personaInput rejects invalid action", () => {
  assertHttpError(
    () => validatePersonaInput({ action: "delete" }),
    "INVALID_INPUT",
  );
});

// ==================== Edge-case Coverage ====================

Deno.test("chat rejects malformed conversation_id", () => {
  assertHttpError(
    () =>
      validateChatInput({
        conversation_id: "not-a-uuid",
        topic: "职业",
        message: "你好",
      }),
    "INVALID_INPUT",
  );
});

Deno.test("match rejects non-object user_state and accepts full state", () => {
  assertHttpError(
    () => validateMatchInput({ user_state: "oops" }),
    "INVALID_INPUT",
  );
  const full = validateMatchInput({
    user_state: {
      life_stage: "职业中期",
      constraints: ["预算", "家庭"],
      tension: "稳定与成长",
      decision_stage: "权衡中",
      support_need: "过来人经验",
    },
  });
  assert(full.life_stage === "职业中期");
  assert(full.constraints?.length === 2);
  assert(full.support_need === "过来人经验");
});

Deno.test("simulate enforces the 1..10 year boundary", () => {
  assert(
    validateSimulateInput({ question: "q", choice: "c", years: 10 }).years ===
      10,
  );
  assertHttpError(
    () => validateSimulateInput({ question: "q", choice: "c", years: 11 }),
    "INVALID_INPUT",
  );
  assertHttpError(
    () => validateSimulateInput({ question: "q", choice: "c", years: 2.5 }),
    "INVALID_INPUT",
  );
});

Deno.test("diary rejects empty transcript", () => {
  assertHttpError(
    () => validateDiaryInput({ transcript: "   ", input_method: "text" }),
    "INVALID_INPUT",
  );
});

Deno.test("diary requires a closed input_method value", () => {
  assert(
    validateDiaryInput({
      transcript: "今天有些焦虑",
      input_method: "text",
    }).inputMethod === "text",
  );
  assertHttpError(
    () => validateDiaryInput({ transcript: "内容", input_method: "keyboard" }),
    "INVALID_INPUT",
  );
  assertHttpError(
    () => validateDiaryInput({ transcript: "内容" }),
    "INVALID_INPUT",
  );
});

Deno.test("saveDimension honors assessment source and rejects >20 tags", () => {
  const input = validateSaveDimensionInput({
    dimension: "personality",
    tags: ["内向"],
    source: "assessment",
  });
  assert(input.source === "assessment");
  assertHttpError(
    () =>
      validateSaveDimensionInput({
        dimension: "skill",
        tags: Array.from({ length: 21 }, (_, i) => `t${i}`),
      }),
    "INVALID_INPUT",
  );
});

Deno.test("saveCardGame rejects >9 final_cards and out-of-range rounds", () => {
  assertHttpError(
    () =>
      validateSaveCardGameInput({
        kind: "life",
        final_cards: Array.from({ length: 10 }, (_, i) => ({
          id: `c${i}`,
          name: `卡${i}`,
        })),
        rounds: 1,
        accepted: [],
        traded: [],
      }),
    "INVALID_INPUT",
  );
  assertHttpError(
    () =>
      validateSaveCardGameInput({
        kind: "life",
        final_cards: [{ id: "c1", name: "稳定" }],
        rounds: 101,
        accepted: [],
        traded: [],
      }),
    "INVALID_INPUT",
  );
});

Deno.test("listInput floors invalid limit back to default", () => {
  const input = validateListInput({ limit: 0, offset: 5 });
  assert(input.limit === 20, "limit<1 should reset to default 20");
  assert(input.offset === 5);
});

Deno.test("bountyInput rejects oversized question", () => {
  assertHttpError(
    () =>
      validateBountyInput({
        question: "x".repeat(201),
        tags: ["职业"],
        detail: "d",
        reward: "r",
      }),
    "INPUT_TOO_LONG",
  );
});

Deno.test("kaleidoscopeInput rejects >20 recently_viewed_ids", () => {
  assertHttpError(
    () =>
      validateKaleidoscopeInput({
        mode: "similar",
        recently_viewed_ids: Array.from({ length: 21 }, (_, i) => i + 1),
      }),
    "INVALID_INPUT",
  );
});

Deno.test("labChoiceInput rejects >10 constraints", () => {
  assertHttpError(
    () =>
      validateLabChoiceInput({
        question: "要不要转行？",
        constraints: Array.from({ length: 11 }, (_, i) => `c${i}`),
      }),
    "INVALID_INPUT",
  );
});

Deno.test("personaInput generate accepts prompt_override and rejects oversize", () => {
  const input = validatePersonaInput({
    action: "generate",
    prompt_override: "更温柔一些",
  });
  assert(input.action === "generate");
  assert(input.promptOverride === "更温柔一些");
  assertHttpError(
    () => validatePersonaInput({ prompt_override: "x".repeat(501) }),
    "INPUT_TOO_LONG",
  );
});
