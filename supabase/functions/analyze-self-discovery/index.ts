import { structuredOutput } from "../_shared/llm-lazy.ts";
import { requireUser } from "../_shared/auth.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";

type Axis = "like" | "skill" | "value";

type DiscoveryResponse = {
  id: string;
  axis: Axis;
  question: string;
  selected: string[];
  custom: string[];
};

type DiscoveryInput = {
  responses: DiscoveryResponse[];
  evidence: {
    likes: Array<{ tag: string; count: number }>;
    strengths: Array<{ tag: string; count: number }>;
    values: Array<{ tag: string; count: number }>;
  };
};

type DiscoveryInsight = {
  label: string;
  evidence: string;
  reason: string;
};

type DiscoveryOutput = {
  summary: string;
  likes: DiscoveryInsight[];
  strengths: DiscoveryInsight[];
  directions: Array<{
    title: string;
    why: string;
    first_step: string;
  }>;
  confidence_note: string;
};

const insightSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "evidence", "reason"],
  properties: {
    label: { type: "string", minLength: 2, maxLength: 24 },
    evidence: { type: "string", minLength: 8, maxLength: 120 },
    reason: { type: "string", minLength: 12, maxLength: 180 },
  },
} as const;

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "likes",
    "strengths",
    "directions",
    "confidence_note",
  ],
  properties: {
    summary: { type: "string", minLength: 20, maxLength: 240 },
    likes: {
      type: "array",
      maxItems: 3,
      items: insightSchema,
    },
    strengths: {
      type: "array",
      maxItems: 3,
      items: insightSchema,
    },
    directions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "why", "first_step"],
        properties: {
          title: { type: "string", minLength: 4, maxLength: 60 },
          why: { type: "string", minLength: 12, maxLength: 180 },
          first_step: { type: "string", minLength: 8, maxLength: 180 },
        },
      },
    },
    confidence_note: { type: "string", minLength: 12, maxLength: 200 },
  },
} as const;

const systemPrompt = `你是一名严谨、温和的自我理解分析助手。你的工作是根据用户对原创探索题的回答，区分“喜欢的事”和“擅长的事”，并提出可验证的行动假设。

分析原则：
1. 喜欢的事是用户反复被吸引、愿意投入和主动了解的“内容领域”，不要把行为能力误写成兴趣。
2. 擅长的事是用户自然重复使用、较低耗能且能产生好结果的“行为模式”，不要写成职业或知识领域。
3. 价值观只用于判断组合方向是否对用户有意义，不要混入喜欢或擅长的三个标签。
4. 多选答案是结构化证据；自由回答信息量更高，应优先理解其中的具体对象、动作和情境。
5. 每条结论必须指出来自哪些回答模式，不能凭空补充经历，也不能做心理诊断。
6. 输出 3 个喜欢、3 个擅长、3 个“用擅长的方式投入喜欢领域”的低成本验证方向。
7. 使用简洁自然的中文，面向用户本人表达。结论是可验证假设，不是职业判决。

题目是基于“喜欢 × 擅长 × 价值观”方法结构的产品化原创表达。不要声称复述或逐字执行任何书籍原题。`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, max: number): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "INVALID_INPUT", "回答内容格式不正确。");
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    throw new HttpError(400, "INVALID_INPUT", "回答内容为空或过长。");
  }
  return cleaned;
}

function cleanStrings(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new HttpError(400, "INVALID_INPUT", "回答选项数量不正确。");
  }
  return value.map((item) => cleanString(item, maxLength));
}

function cleanEvidence(value: unknown): Array<{ tag: string; count: number }> {
  if (!Array.isArray(value) || value.length > 6) {
    throw new HttpError(400, "INVALID_INPUT", "证据摘要格式不正确。");
  }
  return value.map((item) => {
    if (!isRecord(item)) {
      throw new HttpError(400, "INVALID_INPUT", "证据摘要格式不正确。");
    }
    const count = Number(item.count);
    if (!Number.isInteger(count) || count < 1 || count > 12) {
      throw new HttpError(400, "INVALID_INPUT", "证据计数不正确。");
    }
    return { tag: cleanString(item.tag, 30), count };
  });
}

function validateInput(value: unknown): DiscoveryInput {
  if (!isRecord(value) || !Array.isArray(value.responses) || !isRecord(value.evidence)) {
    throw new HttpError(400, "INVALID_INPUT", "缺少完整的探索回答。");
  }
  if (value.responses.length !== 12) {
    throw new HttpError(400, "INVALID_INPUT", "请完成全部 12 个探索问题。");
  }

  const ids = new Set<string>();
  const responses = value.responses.map((item): DiscoveryResponse => {
    if (!isRecord(item)) {
      throw new HttpError(400, "INVALID_INPUT", "回答格式不正确。");
    }
    const id = cleanString(item.id, 40);
    const axis = item.axis;
    if (axis !== "like" && axis !== "skill" && axis !== "value") {
      throw new HttpError(400, "INVALID_INPUT", "回答维度不正确。");
    }
    if (ids.has(id)) {
      throw new HttpError(400, "INVALID_INPUT", "回答中存在重复题目。");
    }
    ids.add(id);
    const selected = cleanStrings(item.selected, 3, 100);
    const custom = cleanStrings(item.custom, 2, 100);
    if (selected.length + custom.length === 0) {
      throw new HttpError(400, "INVALID_INPUT", "每个问题至少需要一条回答。");
    }
    return {
      id,
      axis,
      question: cleanString(item.question, 160),
      selected,
      custom,
    };
  });

  return {
    responses,
    evidence: {
      likes: cleanEvidence(value.evidence.likes),
      strengths: cleanEvidence(value.evidence.strengths),
      values: cleanEvidence(value.evidence.values),
    },
  };
}

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const input = validateInput(await readJson(req));
    const { user } = await requireUser(req);
    const result = await structuredOutput<DiscoveryOutput>({
      model: runtimeConfig.structuredModel,
      maxTokens: 2_048,
      system: systemPrompt,
      prompt: `以下是用户完成的自我探索回答与客户端证据计数。只能依据这些内容分析：\n${JSON.stringify(input)}`,
      schema: outputSchema,
      track: { userId: user.id, feature: "analyze_self_discovery" },
      trace: { name: "analyze-self-discovery", userId: user.id },
    });
    if (
      result.likes.length !== 3 ||
      result.strengths.length !== 3 ||
      result.directions.length !== 3 ||
      new Set(result.likes.map((item) => item.label)).size !== 3 ||
      new Set(result.strengths.map((item) => item.label)).size !== 3
    ) {
      throw new HttpError(
        502,
        "MODEL_OUTPUT_INVALID",
        "AI 返回的自我探索结果不完整。",
      );
    }
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error, req);
  }
});
