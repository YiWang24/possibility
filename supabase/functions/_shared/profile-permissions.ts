export const AI_DIMENSIONS = [
  "personality",
  "skill",
  "like",
  "love",
  "family",
  "social",
  "life",
] as const;

export const AI_PURPOSES = ["persona", "chat", "match", "lab"] as const;

export type AIDimension = typeof AI_DIMENSIONS[number];
export type AIPurpose = typeof AI_PURPOSES[number];
export type AIPermissions = Record<string, Record<string, boolean>>;

const DIMENSION_LABELS: Record<AIDimension, string> = {
  personality: "人格底色",
  skill: "我擅长",
  like: "我喜欢",
  love: "恋爱关系中在意",
  family: "家庭关系中在意",
  social: "人际交往中在意",
  life: "人生底牌",
};

export type AuthorizedProfileContext = {
  purpose: AIPurpose;
  dimensions: AIDimension[];
  text: string;
  profileRevision: number;
  factIds: string[];
};

export type ProfileFactForContext = {
  id: string;
  dimension: string;
  value: string;
  source: string;
  confidence: number;
  user_confirmed: boolean;
};

/**
 * 从私有画像中只挑出当前用途明确授权的维度。
 * 维度、用途或授权行缺失时一律拒绝；未知键永远不会进入模型上下文。
 */
export function authorizedProfileContext(
  dims: Record<string, unknown>,
  permissions: AIPermissions,
  purpose: AIPurpose,
): AuthorizedProfileContext {
  const entries = AI_DIMENSIONS.flatMap((dimension) => {
    const value = dims[dimension];
    if (
      permissions[dimension]?.[purpose] !== true ||
      typeof value !== "string" ||
      value.trim().length === 0
    ) {
      return [];
    }
    return [{
      dimension,
      text: `${DIMENSION_LABELS[dimension]}（${dimension}）：${value.trim()}`,
    }];
  });

  return {
    purpose,
    dimensions: entries.map(({ dimension }) => dimension),
    text: entries.map(({ text }) => text).join("\n"),
    profileRevision: 0,
    factIds: [],
  };
}

/**
 * 事实表是 AI 上下文的权威来源。用户确认状态与来源会进入提示词，
 * 让模型能区分“本人确认”和“系统从对话/日记推断”，避免把推断说成事实。
 */
export function authorizedFactsContext(
  facts: ProfileFactForContext[],
  permissions: AIPermissions,
  purpose: AIPurpose,
  profileRevision: number,
): AuthorizedProfileContext {
  const allowed = facts.filter((fact) =>
    AI_DIMENSIONS.includes(fact.dimension as AIDimension) &&
    permissions[fact.dimension]?.[purpose] === true &&
    fact.value.trim().length > 0
  );
  const dimensions = AI_DIMENSIONS.filter((dimension) =>
    allowed.some((fact) => fact.dimension === dimension)
  );
  const lines = dimensions.map((dimension) => {
    const values = allowed
      .filter((fact) => fact.dimension === dimension)
      .slice(0, 20)
      .map((fact) => {
        const reliability = fact.user_confirmed
          ? "用户已确认"
          : `待用户确认，来源 ${fact.source}，置信度 ${
            Math.round(Number(fact.confidence) * 100)
          }%`;
        return `${fact.value.trim()}（${reliability}）`;
      });
    return `${DIMENSION_LABELS[dimension]}（${dimension}）：${
      values.join("；")
    }`;
  });

  return {
    purpose,
    dimensions,
    text: lines.join("\n"),
    profileRevision,
    factIds: allowed.map(({ id }) => id),
  };
}
