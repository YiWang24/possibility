export const AI_DIMENSIONS = [
  "personality",
  "skill",
  "like",
  "love",
  "family",
  "social",
  "life",
] as const;

export const AI_PURPOSES = [
  "persona",
  "chat",
  "match",
  "lab",
  "community",
] as const;

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
  permissionRevision: number;
  factIds: string[];
  facts: ProfileFactForContext[];
};

export type ProfileFactForContext = {
  id: string;
  dimension: string;
  value: string;
  source: string;
  confidence: number;
  user_confirmed: boolean;
  sensitivity?: "low" | "medium" | "high";
  support_count?: number;
};

/**
 * 事实表是 AI 上下文的权威来源。用户确认状态与来源会进入提示词，
 * 让模型能区分“本人确认”和“系统从对话/日记推断”，避免把推断说成事实。
 */
export function authorizedFactsContext(
  facts: ProfileFactForContext[],
  permissions: AIPermissions,
  purpose: AIPurpose,
  profileRevision: number,
  permissionRevision = 0,
): AuthorizedProfileContext {
  const allowed = facts
    .filter((fact) => {
      if (
        !AI_DIMENSIONS.includes(fact.dimension as AIDimension) ||
        permissions[fact.dimension]?.[purpose] !== true ||
        fact.value.trim().length === 0
      ) {
        return false;
      }
      if (fact.user_confirmed) return true;
      if (purpose === "match" || purpose === "community") return false;
      if (purpose === "lab") {
        return Number(fact.support_count ?? 1) >= 2 &&
          Number(fact.confidence) >= 0.8;
      }
      return Number(fact.confidence) >= 0.7;
    })
    .sort((a, b) =>
      Number(b.user_confirmed) - Number(a.user_confirmed) ||
      Number(b.confidence) - Number(a.confidence) ||
      Number(b.support_count ?? 1) - Number(a.support_count ?? 1)
    )
    .slice(0, 12);
  const dimensions = AI_DIMENSIONS.filter((dimension) =>
    allowed.some((fact) => fact.dimension === dimension)
  );
  const lines = dimensions.map((dimension) => {
    const values = allowed
      .filter((fact) => fact.dimension === dimension)
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
    permissionRevision,
    factIds: allowed.map(({ id }) => id),
    facts: allowed,
  };
}
