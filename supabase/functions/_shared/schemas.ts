export const matchSchema = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      // 不用 minItems 硬约束恰好 3 个：部分网关的约束解码遇到精确计数
      // 会退化为长时间生成；条数由 match/index.ts 代码层校验（!=3 即 502）。
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          traveler_id: { type: "integer" },
          reason: { type: "string", minLength: 1 },
          not_applicable: { type: "string", minLength: 1 },
        },
        required: ["traveler_id", "reason", "not_applicable"],
        additionalProperties: false,
      },
    },
  },
  required: ["matches"],
  additionalProperties: false,
} as const;

export const scenarioSchema = {
  type: "object",
  properties: {
    headline: { type: "string", minLength: 1 },
    dimensions: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          label: { type: "string", minLength: 1 },
          text: { type: "string", minLength: 1 },
        },
        required: ["label", "text"],
        additionalProperties: false,
      },
    },
    gains: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { type: "string", minLength: 1 },
    },
    costs: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { type: "string", minLength: 1 },
    },
    key_condition: { type: "string" },
  },
  required: ["headline", "dimensions", "gains", "costs", "key_condition"],
  additionalProperties: false,
} as const;

export const simulationSchema = {
  type: "object",
  properties: {
    scenarios: {
      type: "object",
      properties: {
        general: scenarioSchema,
        optimistic: scenarioSchema,
        cautionary: scenarioSchema,
      },
      required: ["general", "optimistic", "cautionary"],
      additionalProperties: false,
    },
    bottom_line_analysis: {
      type: "object",
      properties: {
        is_acceptable: { type: "boolean" },
        risks: {
          type: "array",
          maxItems: 5,
          items: { type: "string", minLength: 1 },
        },
        protective_conditions: {
          type: "array",
          maxItems: 5,
          items: { type: "string", minLength: 1 },
        },
      },
      required: ["is_acceptable", "risks", "protective_conditions"],
      additionalProperties: false,
    },
    recommended_traveler_ids: {
      type: "array",
      maxItems: 3,
      items: { type: "integer" },
    },
  },
  required: ["scenarios", "bottom_line_analysis", "recommended_traveler_ids"],
  additionalProperties: false,
} as const;

export const labChoiceSchema = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          id: { type: "string", minLength: 1 },
          // 图标语义键（非 emoji），词表见 prompts.ts labChoicePrompt。
          // 这里刻意不写 enum：约束解码收紧后 DeepSeek 网关的失败率明显上升
          // （同 matchSchema 的计数问题），客户端 CardIcon.resolve 已按词表兜底。
          glyph: {
            type: "string",
            minLength: 1,
            description:
              "图标语义键，取值范围：stay|deepen|pivot|retreat|explore|experiment|learn|build|create|leap|connect|speak|relocate|rest|pause|observe|timing|hybrid|balance|secure|money|home|health",
          },
          title: { type: "string", minLength: 1 },
          description: { type: "string", minLength: 1 },
          color: { type: "string", minLength: 1 },
        },
        required: ["id", "glyph", "title", "description", "color"],
        additionalProperties: false,
      },
    },
    rationale: { type: "string" },
  },
  required: ["cards", "rationale"],
  additionalProperties: false,
} as const;

// 实时生成的旅人（写入 travelers + traveler_details，扩充社区）。
// 精确计数会拖垮部分网关的约束解码（见 matchSchema 注释），故用 2..3 区间，
// 实际条数由 simulate/index.ts 代码层容纳。
export const generatedTravelersSchema = {
  type: "object",
  properties: {
    travelers: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1 },
          initial: { type: "string", minLength: 1, maxLength: 2 },
          hue: { type: "integer", minimum: 0, maximum: 4 },
          quote: { type: "string", minLength: 1 },
          bio: { type: "string", minLength: 1 },
          tags: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: { type: "string", minLength: 1 },
          },
          dims: {
            type: "array",
            minItems: 2,
            maxItems: 3,
            items: {
              type: "array",
              minItems: 2,
              maxItems: 2,
              items: { type: "string", minLength: 1 },
            },
          },
          trajectory: {
            type: "array",
            minItems: 3,
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                age: { type: "string", minLength: 1 },
                t: { type: "string", minLength: 1 },
                d: { type: "string", minLength: 1 },
              },
              required: ["age", "t", "d"],
              additionalProperties: false,
            },
          },
          detail: {
            type: "object",
            properties: {
              age: { type: "integer", minimum: 16, maximum: 90 },
              city: { type: "string", minLength: 1 },
              from_role: { type: "string", minLength: 1 },
              to_role: { type: "string", minLength: 1 },
              years: { type: "string", minLength: 1 },
              intro: { type: "string", minLength: 1 },
              full_text: { type: "string", minLength: 1 },
              advice: {
                type: "object",
                properties: {
                  decision: {
                    type: "array",
                    minItems: 1,
                    maxItems: 5,
                    items: { type: "string", minLength: 1 },
                  },
                  ability: {
                    type: "array",
                    minItems: 1,
                    maxItems: 5,
                    items: { type: "string", minLength: 1 },
                  },
                  interview: {
                    type: "array",
                    minItems: 1,
                    maxItems: 5,
                    items: { type: "string", minLength: 1 },
                  },
                },
                required: ["decision", "ability", "interview"],
                additionalProperties: false,
              },
              result: { type: "string", minLength: 1 },
              consulted: { type: "integer", minimum: 0, maximum: 9999 },
              response_time: { type: "string", minLength: 1 },
            },
            required: [
              "age",
              "city",
              "from_role",
              "to_role",
              "years",
              "intro",
              "full_text",
              "advice",
              "result",
              "consulted",
              "response_time",
            ],
            additionalProperties: false,
          },
        },
        required: [
          "name",
          "initial",
          "hue",
          "quote",
          "bio",
          "tags",
          "dims",
          "trajectory",
          "detail",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["travelers"],
  additionalProperties: false,
} as const;

export const personaSchema = {
  type: "object",
  properties: {
    shape: { type: "string", minLength: 1 },
    hue: { type: "integer", minimum: 0, maximum: 360 },
    lobes: { type: "integer", minimum: 3, maximum: 9 },
    seed: { type: "integer", minimum: 0, maximum: 99_999 },
    summary: { type: "string", minLength: 1 },
  },
  required: ["shape", "hue", "lobes", "seed", "summary"],
  additionalProperties: false,
} as const;

export const diarySchema = {
  type: "object",
  properties: {
    emotions: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      uniqueItems: true,
      items: {
        type: "string",
        enum: [
          "开心",
          "平静",
          "期待",
          "好奇",
          "成就感",
          "感动",
          "满足",
          "焦虑",
          "纠结",
          "压力",
          "疲惫",
          "失落",
          "愤怒",
          "孤独",
        ],
      },
    },
    keywords: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      uniqueItems: true,
      items: { type: "string", minLength: 2, maxLength: 20 },
    },
    dim_updates: {
      type: "array",
      maxItems: 5,
      uniqueItems: true,
      items: {
        type: "object",
        properties: {
          dimension: {
            type: "string",
            enum: ["skill", "like", "love", "family", "social"],
          },
          value: { type: "string", minLength: 1 },
        },
        required: ["dimension", "value"],
        additionalProperties: false,
      },
    },
  },
  required: ["emotions", "keywords", "dim_updates"],
  additionalProperties: false,
} as const;

export const diarySummarySchema = {
  type: "object",
  properties: {
    insight: { type: "string", minLength: 1 },
    highlights: {
      type: "array",
      maxItems: 5,
      items: { type: "string", minLength: 1 },
    },
  },
  required: ["insight", "highlights"],
  additionalProperties: false,
} as const;

export const chatSignalSchema = {
  type: "object",
  properties: {
    crossroads: {
      type: "object",
      properties: {
        ready: { type: "boolean" },
        summary: { type: "string" },
        match_query: {
          type: "object",
          properties: {
            life_stage: { type: "string" },
            constraints: {
              type: "array",
              maxItems: 10,
              items: { type: "string" },
            },
            tension: { type: "string" },
            decision_stage: { type: "string" },
            support_need: { type: "string" },
          },
          required: [
            "life_stage",
            "constraints",
            "tension",
            "decision_stage",
            "support_need",
          ],
          additionalProperties: false,
        },
      },
      required: ["ready", "summary", "match_query"],
      additionalProperties: false,
    },
    conclusion: {
      type: "object",
      properties: {
        ready: { type: "boolean" },
        next_step: { type: "string", enum: ["match", "lab"] },
        reason: { type: "string" },
      },
      required: ["ready", "next_step", "reason"],
      additionalProperties: false,
    },
    profile_updates: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          dimension: { type: "string", minLength: 1 },
          value: { type: "string", minLength: 1 },
        },
        required: ["dimension", "value"],
        additionalProperties: false,
      },
    },
    portrait_delta: { type: "integer", minimum: 0, maximum: 10 },
    high_risk: { type: "boolean" },
  },
  required: [
    "crossroads",
    "conclusion",
    "profile_updates",
    "portrait_delta",
    "high_risk",
  ],
  additionalProperties: false,
} as const;

export type MatchOutput = {
  matches: Array<{
    traveler_id: number;
    reason: string;
    not_applicable: string;
  }>;
};

export type ScenarioOutput = {
  headline: string;
  dimensions: Array<{ label: string; text: string }>;
  gains: string[];
  costs: string[];
  key_condition: string;
};

export type SimulationOutput = {
  scenarios: Record<"general" | "optimistic" | "cautionary", ScenarioOutput>;
  bottom_line_analysis: {
    is_acceptable: boolean;
    risks: string[];
    protective_conditions: string[];
  };
  recommended_traveler_ids: number[];
};

export type LabChoiceOutput = {
  cards: Array<{
    id: string;
    glyph: string;
    title: string;
    description: string;
    color: string;
  }>;
  rationale: string;
};

export type GeneratedTravelerDetail = {
  age: number;
  city: string;
  from_role: string;
  to_role: string;
  years: string;
  intro: string;
  full_text: string;
  advice: { decision: string[]; ability: string[]; interview: string[] };
  result: string;
  consulted: number;
  response_time: string;
};

export type GeneratedTraveler = {
  name: string;
  initial: string;
  hue: number;
  quote: string;
  bio: string;
  tags: string[];
  dims: string[][];
  trajectory: Array<{ age: string; t: string; d: string }>;
  detail: GeneratedTravelerDetail;
};

export type GeneratedTravelersOutput = {
  travelers: GeneratedTraveler[];
};

export type PersonaOutput = {
  shape: string;
  hue: number;
  lobes: number;
  seed: number;
  summary: string;
};

export type DiaryOutput = {
  emotions: string[];
  keywords: string[];
  dim_updates: Array<{ dimension: string; value: string }>;
};

export type DiarySummaryOutput = {
  insight: string;
  highlights: string[];
};

export type ChatSignal = {
  crossroads: {
    ready: boolean;
    summary: string;
    match_query: {
      life_stage: string;
      constraints: string[];
      tension: string;
      decision_stage: string;
      support_need: string;
    };
  };
  conclusion: {
    ready: boolean;
    next_step: "match" | "lab";
    reason: string;
  };
  profile_updates: Array<{ dimension: string; value: string }>;
  portrait_delta: number;
  high_risk: boolean;
};
