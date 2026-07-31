const DIARY_PROFILE_DIMENSIONS = new Set([
  "skill",
  "like",
  "love",
  "family",
  "social",
]);

export type DiaryProfileUpdate = { dimension: string; value: string };

export type DiaryProfileProposalRow = {
  user_id: string;
  operation: "add";
  dimension: string;
  fact_kind: "self_description";
  value: string;
  normalized_value: string;
  source_type: "diary";
  source_id: string;
  source_version: number;
  confidence: number;
  sensitivity: "low";
  rationale_code: "explicit_statement";
  status: "pending";
  model_name: string;
  prompt_version: string;
  schema_version: number;
  dedupe_key: string;
};

export function profileUpdatesFromAnalysis(
  analysis: Record<string, unknown>,
): DiaryProfileUpdate[] {
  const updates = analysis.dim_updates;
  if (!Array.isArray(updates)) return [];
  return updates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const dimension = Reflect.get(candidate, "dimension");
    const value = Reflect.get(candidate, "value");
    if (
      typeof dimension !== "string" ||
      !DIARY_PROFILE_DIMENSIONS.has(dimension) ||
      typeof value !== "string"
    ) return [];
    return [{ dimension, value }];
  });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildDiaryProfileProposalRows(
  userId: string,
  entryId: string,
  sourceVersion: number,
  updates: DiaryProfileUpdate[],
  metadata: { modelName: string; promptVersion: string },
): Promise<DiaryProfileProposalRow[]> {
  const unique = new Map<string, DiaryProfileUpdate>();
  for (const update of updates) {
    if (!DIARY_PROFILE_DIMENSIONS.has(update.dimension)) continue;
    const value = update.value.trim().replace(/\s+/g, " ").slice(0, 500);
    if (!value) continue;
    const normalized = value.toLowerCase();
    unique.set(`${update.dimension}:${normalized}`, {
      dimension: update.dimension,
      value,
    });
  }

  return await Promise.all(
    [...unique.values()].map(async ({ dimension, value }) => {
      const normalized = value.toLowerCase();
      return {
        user_id: userId,
        operation: "add" as const,
        dimension,
        fact_kind: "self_description" as const,
        value,
        normalized_value: normalized,
        source_type: "diary" as const,
        source_id: entryId,
        source_version: sourceVersion,
        confidence: 0.7,
        sensitivity: "low" as const,
        rationale_code: "explicit_statement" as const,
        status: "pending" as const,
        model_name: metadata.modelName,
        prompt_version: metadata.promptVersion,
        schema_version: 1,
        dedupe_key: await sha256(
          `diary:${entryId}:${sourceVersion}:${dimension}:${normalized}`,
        ),
      };
    }),
  );
}
