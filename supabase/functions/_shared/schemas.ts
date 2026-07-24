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
  },
  required: ["scenarios"],
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
};

export type DiaryOutput = {
  emotions: string[];
  keywords: string[];
  dim_updates: Array<{ dimension: string; value: string }>;
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
