// JSON Schema（output_config.format）——严格模式：对象 additionalProperties:false + required。
const strArr = { type: "array", items: { type: "string" } } as const;

export const CROSSROADS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["profile_signals", "crossroads"],
  properties: {
    profile_signals: {
      type: "object",
      additionalProperties: false,
      required: ["life_stage", "constraints", "tension"],
      properties: {
        life_stage: { type: "string" },
        constraints: strArr,
        tension: { type: "string" },
      },
    },
    crossroads: {
      type: "object",
      additionalProperties: false,
      required: ["ready", "summary", "match_query"],
      properties: {
        ready: { type: "boolean" },
        summary: { type: "string" },
        match_query: { type: "string" },
      },
    },
  },
} as const;

export const MATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["matches"],
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["traveler_id", "reason", "not_applicable"],
        properties: {
          traveler_id: { type: "integer" },
          reason: { type: "string" },
          not_applicable: { type: "string" },
        },
      },
    },
  },
} as const;

const SCENE = {
  type: "object",
  additionalProperties: false,
  required: ["title", "points"],
  properties: { title: { type: "string" }, points: strArr },
} as const;

export const SIMULATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scenarios"],
  properties: {
    scenarios: {
      type: "object",
      additionalProperties: false,
      required: ["general", "optimistic", "cautionary"],
      properties: { general: SCENE, optimistic: SCENE, cautionary: SCENE },
    },
  },
} as const;

export const DIARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["emotions", "keywords", "dim_updates"],
  properties: {
    emotions: strArr,
    keywords: strArr,
    dim_updates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dim", "value"],
        properties: { dim: { type: "string" }, value: { type: "string" } },
      },
    },
  },
} as const;
