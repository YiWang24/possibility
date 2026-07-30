// 业务逻辑单元测试：覆盖纯业务算法（persona 兜底、旅人推荐过滤）、
// 结构化输出 schema 的自洽性，以及 SSE 事件编码契约。
// 这些逻辑一旦出错会直接破坏 AI 集成的真实业务表现，故独立于校验器单测。

import { fallbackPersona, FORM_DEFS, hashSeed } from "../_shared/persona.ts";
import { authorizedFactsContext } from "../_shared/profile-permissions.ts";
import { frontDoorPrompt } from "../_shared/prompts.ts";
import { filterRecommendedTravelerIds } from "../_shared/recommend.ts";
import { sseEvent } from "../_shared/sse.ts";
import {
  chatSignalSchema,
  diarySchema,
  diarySummarySchema,
  labChoiceSchema,
  matchSchema,
  personaSchema,
  simulationSchema,
} from "../_shared/schemas.ts";

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

// ==================== Chatbot 回答契约 ====================

Deno.test("front-door prompt requires an answer before product routing", () => {
  const prompt = frontDoorPrompt("职业");
  assert(
    prompt.includes("必须先真正回答用户的问题"),
    "must provide a real answer",
  );
  assert(prompt.includes("低成本、可撤回"), "must give a reversible next step");
  assert(
    prompt.includes("功能引导只能放在解答之后"),
    "routing must follow the answer",
  );
  assert(prompt.includes("不要替用户拍板"), "advice must remain tentative");
  assert(
    prompt.includes("250 个中文字符以内"),
    "visible chat reply must fit within one mobile screen",
  );
  assert(
    prompt.includes("这个理解接近你吗？"),
    "verification state needs an explicit cue",
  );
  assert(
    prompt.includes("仍在收集事实"),
    "clarifying replies must not request verification",
  );
});

Deno.test("front-door prompt distinguishes authorized history from current facts", () => {
  const prompt = frontDoorPrompt("职业", "我擅长（skill）：拆解复杂问题");
  assert(prompt.includes("拆解复杂问题"));
  assert(prompt.includes("当前对话原文与用户纠正始终优先"));
  assert(prompt.includes("不要把旧资料说成用户此刻仍然如此"));
});

// ==================== Persona 离线兜底 ====================

Deno.test("persona fallback is deterministic for the same input", () => {
  const a = fallbackPersona("我擅长结构与计划，喜欢分析");
  const b = fallbackPersona("我擅长结构与计划，喜欢分析");
  assert(a.seed === b.seed, "seed should be stable");
  assert(a.shape === b.shape, "shape should be stable");
  assert(a.hue === b.hue && a.lobes === b.lobes, "hue/lobes should be stable");
});

Deno.test("persona fallback always returns schema-valid ranges", () => {
  const samples = [
    "",
    "结构 有序 计划 理性 分析",
    "共情 陪伴 关系 家庭 亲情",
    "视觉 手绘 创造 审美 表达",
    "独处 探索 学习 尝试 成长",
    "完全无关的文本 xyz 123",
  ];
  for (const text of samples) {
    const p = fallbackPersona(text);
    assert(p.hue >= 0 && p.hue < 360, `hue out of range for "${text}"`);
    assert(p.lobes >= 3 && p.lobes <= 9, `lobes out of range for "${text}"`);
    assert(p.seed >= 0 && p.seed <= 99_999, `seed out of range for "${text}"`);
    assert(p.shape.length > 0, "shape must be non-empty");
    assert(p.summary.includes(p.shape), "summary should mention the shape");
  }
});

Deno.test("persona fallback picks form by dominant keyword signal", () => {
  const relation = fallbackPersona("共情 陪伴 关系 家庭 亲情 朋友 信任");
  assert(
    relation.shape === FORM_DEFS.bloom.name,
    `relation-heavy text should map to bloom, got ${relation.shape}`,
  );
  const structure = fallbackPersona("结构 有序 计划 理性 分析 原则 边界");
  assert(
    structure.shape === FORM_DEFS.crystal.name,
    `structure-heavy text should map to crystal, got ${structure.shape}`,
  );
});

Deno.test("persona empty input still yields a valid persona", () => {
  const p = fallbackPersona("");
  assert(p.seed === hashSeed("屿岸·持续探索"), "empty input uses default seed");
  assert(Object.values(FORM_DEFS).some((d) => d.name === p.shape));
});

Deno.test("match and community only use confirmed profile facts", () => {
  const facts = [
    {
      id: "confirmed",
      dimension: "skill",
      value: "理清复杂需求",
      source: "manual",
      confidence: 1,
      user_confirmed: true,
    },
    {
      id: "inferred",
      dimension: "like",
      value: "可能喜欢徒步",
      source: "diary",
      confidence: 0.95,
      user_confirmed: false,
      support_count: 4,
    },
  ];
  for (const purpose of ["match", "community"] as const) {
    const context = authorizedFactsContext(
      facts,
      { skill: { [purpose]: true }, like: { [purpose]: true } },
      purpose,
      8,
      3,
    );
    assert(context.factIds.join(",") === "confirmed");
    assert(context.permissionRevision === 3);
  }
});

Deno.test("lab only uses strong repeated unconfirmed profile facts", () => {
  const context = authorizedFactsContext(
    [
      {
        id: "strong",
        dimension: "skill",
        value: "反复表现出拆解能力",
        source: "diary",
        confidence: 0.84,
        user_confirmed: false,
        support_count: 2,
      },
      {
        id: "single",
        dimension: "like",
        value: "单次提到徒步",
        source: "chat",
        confidence: 0.95,
        user_confirmed: false,
        support_count: 1,
      },
    ],
    { skill: { lab: true }, like: { lab: true } },
    "lab",
    4,
  );
  assert(context.factIds.join(",") === "strong");
  assert(!context.text.includes("单次提到徒步"));
});

Deno.test("fact context distinguishes confirmed facts from AI inferences", () => {
  const facts = [
    {
      id: "fact-confirmed",
      dimension: "skill",
      value: "拆解复杂问题",
      source: "manual",
      confidence: 1,
      user_confirmed: true,
    },
    {
      id: "fact-inferred",
      dimension: "like",
      value: "可能喜欢徒步",
      source: "chat",
      confidence: 0.72,
      user_confirmed: false,
    },
    {
      id: "fact-private",
      dimension: "family",
      value: "不能泄露",
      source: "diary",
      confidence: 0.9,
      user_confirmed: false,
    },
  ];
  const context = authorizedFactsContext(
    facts,
    {
      skill: { chat: true },
      like: { chat: true },
      family: { chat: false },
    },
    "chat",
    17,
  );

  assert(context.profileRevision === 17);
  assert(context.dimensions.join(",") === "skill,like");
  assert(context.factIds.join(",") === "fact-confirmed,fact-inferred");
  assert(context.text.includes("用户已确认"));
  assert(context.text.includes("待用户确认，来源 chat，置信度 72%"));
  assert(!context.text.includes("不能泄露"));
});

Deno.test("fact context is default-deny and excludes unknown dimensions", () => {
  const facts = [{
    id: "unknown",
    dimension: "private_note",
    value: "secret",
    source: "manual",
    confidence: 1,
    user_confirmed: true,
  }];
  const context = authorizedFactsContext(
    facts,
    { private_note: { persona: true } },
    "persona",
    3,
  );
  assert(context.text === "");
  assert(context.dimensions.length === 0);
  assert(context.factIds.length === 0);
});

// ==================== 旅人推荐过滤 ====================

Deno.test("filterRecommendedTravelerIds dedups, filters and caps", () => {
  const valid = new Set([1, 2, 3, 4, 5]);
  const out = filterRecommendedTravelerIds([2, 2, 99, 3, 1, 4], valid);
  assert(out.length === 3, "should cap at 3");
  assert(out.join(",") === "2,3,1", `unexpected order/content: ${out}`);
  assert(!out.includes(99), "should drop ids not in valid set");
});

Deno.test("filterRecommendedTravelerIds returns empty when nothing matches", () => {
  const out = filterRecommendedTravelerIds([7, 8, 9], new Set([1, 2]));
  assert(out.length === 0);
});

Deno.test("filterRecommendedTravelerIds respects custom maxItems", () => {
  const out = filterRecommendedTravelerIds([1, 2, 3], new Set([1, 2, 3]), 2);
  assert(out.length === 2 && out[0] === 1 && out[1] === 2);
});

// ==================== Schema 自洽性 ====================
// 结构化输出要求：每个 object 节点必须 additionalProperties:false，
// 且 required 中的键必须都在 properties 内声明，否则模型输出会被拒绝或漂移。

type JsonSchemaNode = {
  type?: string;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchemaNode;
};

function assertSchemaConsistent(node: JsonSchemaNode, path: string): void {
  if (node.type === "object") {
    assert(
      node.additionalProperties === false,
      `${path} object must set additionalProperties:false`,
    );
    const props = node.properties ?? {};
    for (const key of node.required ?? []) {
      assert(
        Object.prototype.hasOwnProperty.call(props, key),
        `${path}.required "${key}" missing from properties`,
      );
    }
    for (const [key, child] of Object.entries(props)) {
      assertSchemaConsistent(child, `${path}.${key}`);
    }
  }
  if (node.type === "array" && node.items) {
    assertSchemaConsistent(node.items, `${path}[]`);
  }
}

Deno.test("all structured-output schemas are internally consistent", () => {
  const schemas: Array<[string, JsonSchemaNode]> = [
    ["matchSchema", matchSchema as unknown as JsonSchemaNode],
    ["simulationSchema", simulationSchema as unknown as JsonSchemaNode],
    ["labChoiceSchema", labChoiceSchema as unknown as JsonSchemaNode],
    ["personaSchema", personaSchema as unknown as JsonSchemaNode],
    ["diarySchema", diarySchema as unknown as JsonSchemaNode],
    ["diarySummarySchema", diarySummarySchema as unknown as JsonSchemaNode],
    ["chatSignalSchema", chatSignalSchema as unknown as JsonSchemaNode],
  ];
  for (const [name, schema] of schemas) {
    assertSchemaConsistent(schema, name);
  }
});

Deno.test("simulation schema exposes bottom_line + recommendations contract", () => {
  const props = simulationSchema.properties;
  assert("scenarios" in props, "scenarios required");
  assert("bottom_line_analysis" in props, "bottom_line_analysis required");
  assert(
    "recommended_traveler_ids" in props,
    "recommended_traveler_ids required",
  );
  const bottom = simulationSchema.properties.bottom_line_analysis;
  assert(bottom.required.includes("is_acceptable"));
  assert(bottom.required.includes("risks"));
  assert(bottom.required.includes("protective_conditions"));
});

Deno.test("chat signal exposes an explicit AI conclusion recommendation", () => {
  const conclusion = chatSignalSchema.properties.conclusion;
  assert(chatSignalSchema.required.includes("conclusion"));
  assert(conclusion.required.includes("ready"));
  assert(conclusion.required.includes("next_step"));
  assert(conclusion.required.includes("reason"));
  assert(conclusion.properties.next_step.enum.includes("match"));
  assert(conclusion.properties.next_step.enum.includes("lab"));
  const dimension =
    chatSignalSchema.properties.profile_updates.items.properties.dimension;
  assert(dimension.enum.join(",") === "skill,like,love,family,social");
});

Deno.test("persona schema bounds match fallback output contract", () => {
  const p = personaSchema.properties;
  assert(p.hue.minimum === 0 && p.hue.maximum === 360);
  assert(p.lobes.minimum === 3 && p.lobes.maximum === 9);
  assert(p.seed.minimum === 0 && p.seed.maximum === 99_999);
});

Deno.test("diary summary schema caps highlights at 5", () => {
  const p = diarySummarySchema.properties;
  assert(p.highlights.maxItems === 5);
  assert(diarySummarySchema.required.includes("insight"));
  assert(diarySummarySchema.required.includes("highlights"));
});

// ==================== SSE 事件编码契约 ====================

const decoder = new TextDecoder();

Deno.test("sseEvent encodes named events for the client contract", () => {
  const text = decoder.decode(sseEvent({ done: true }, "done"));
  assert(text.startsWith("event: done\n"), "named event needs event line");
  assert(text.includes('data: {"done":true}'), "payload should be JSON data");
  assert(text.endsWith("\n\n"), "SSE frame must end with blank line");
});

Deno.test("sseEvent encodes anonymous token deltas without event line", () => {
  const text = decoder.decode(sseEvent({ t: "你好" }));
  assert(!text.startsWith("event:"), "token delta has no event line");
  assert(text === 'data: {"t":"你好"}\n\n', `unexpected frame: ${text}`);
});

Deno.test("chat done payload carries alignment fields", () => {
  // 复刻 chat/index.ts done 事件契约：is_enough 反映岔路口是否清晰，
  // next_actions 在就绪时给出 match 入口。此处校验编码后的帧结构。
  const ready = {
    done: true,
    is_enough: true,
    conclusion: {
      ready: true,
      next_step: "match",
      reason: "需要不同路径的现实证据",
    },
    next_actions: [{
      type: "match",
      label: "看看走过类似岔路口、结局不同的人",
    }],
  };
  const frame = decoder.decode(sseEvent(ready, "done"));
  const parsed = JSON.parse(
    frame.slice(frame.indexOf("{"), frame.indexOf("}\n\n") + 1),
  );
  assert(parsed.is_enough === true);
  assert(parsed.conclusion.ready === true);
  assert(parsed.conclusion.next_step === "match");
  assert(
    Array.isArray(parsed.next_actions) &&
      parsed.next_actions[0].type === "match",
  );
});
