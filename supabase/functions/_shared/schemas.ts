export const matchSchema = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      minItems: 3,
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

const scenarioSchema = {
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
          glyph: { type: "string", minLength: 1 },
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
      maxItems: 5,
      items: { type: "string", minLength: 1 },
    },
    keywords: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: { type: "string", minLength: 1 },
    },
    dim_updates: {
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
  required: ["crossroads", "profile_updates", "portrait_delta", "high_risk"],
  additionalProperties: false,
} as const;

export type MatchOutput = {
  matches: Array<{
    traveler_id: number;
    reason: string;
    not_applicable: string;
  }>;
};

export type SimulationOutput = {
  scenarios: Record<"general" | "optimistic" | "cautionary", {
    headline: string;
    dimensions: Array<{ label: string; text: string }>;
    gains: string[];
    costs: string[];
    key_condition: string;
  }>;
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
  profile_updates: Array<{ dimension: string; value: string }>;
  portrait_delta: number;
  high_risk: boolean;
};
