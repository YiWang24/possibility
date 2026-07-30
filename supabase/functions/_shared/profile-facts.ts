export const PROFILE_DIMENSIONS = [
  "personality",
  "skill",
  "like",
  "love",
  "family",
  "social",
  "life",
] as const;

export const PROFILE_CONTEXT_PURPOSES = [
  "persona",
  "chat",
  "match",
  "lab",
  "community",
] as const;

export type ProfileDimension = typeof PROFILE_DIMENSIONS[number];
export type ProfileContextPurpose = typeof PROFILE_CONTEXT_PURPOSES[number];

const DIMENSION_LABELS: Record<ProfileDimension, string> = {
  personality: "人格底色",
  skill: "我擅长",
  like: "我喜欢",
  love: "恋爱关系中在意",
  family: "家庭关系中在意",
  social: "人际交往中在意",
  life: "人生底牌",
};

export type ProfileContext = {
  purpose: ProfileContextPurpose;
  dimensions: ProfileDimension[];
  text: string;
  profileRevision: number;
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
  visibility: "public" | "private";
  sensitivity?: "low" | "medium" | "high";
  support_count?: number;
};

/**
 * profile_facts 是画像上下文的唯一权威来源。当前调用始终服务于事实
 * 所有者，因此 public/private 都可使用；跨用户场景只能读取
 * public_profiles.published_facts，不能调用本函数读取他人的私密事实。
 */
export function profileFactsContext(
  facts: ProfileFactForContext[],
  purpose: ProfileContextPurpose,
  profileRevision: number,
): ProfileContext {
  const allowed = facts
    .filter((fact) => {
      if (
        !PROFILE_DIMENSIONS.includes(fact.dimension as ProfileDimension) ||
        fact.value.trim().length === 0
      ) {
        return false;
      }
      return fact.user_confirmed || Number(fact.confidence) >= 0.7;
    })
    .sort((a, b) =>
      Number(b.user_confirmed) - Number(a.user_confirmed) ||
      Number(b.confidence) - Number(a.confidence) ||
      Number(b.support_count ?? 1) - Number(a.support_count ?? 1)
    )
    .slice(0, 20);
  const dimensions = PROFILE_DIMENSIONS.filter((dimension) =>
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
    factIds: allowed.map(({ id }) => id),
    facts: allowed,
  };
}
