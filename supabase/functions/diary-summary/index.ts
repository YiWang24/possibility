import { structuredOutput } from "../_shared/anthropic.ts";
import { requireUser } from "../_shared/auth.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, readJson } from "../_shared/errors.ts";
import { diarySummaryPrompt } from "../_shared/prompts.ts";
import {
  type DiarySummaryOutput,
  diarySummarySchema,
} from "../_shared/schemas.ts";
import { validateDiarySummaryInput } from "../_shared/validate.ts";

const MAX_TRANSCRIPT_CHARS = 12_000;

function periodRange(period: "month" | "year", ref: string): {
  start: string;
  end: string;
} {
  if (period === "month") {
    const [year, month] = ref.split("-").map(Number);
    return {
      start: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
      end: new Date(Date.UTC(year, month, 1)).toISOString(),
    };
  }
  const year = Number(ref);
  return {
    start: new Date(Date.UTC(year, 0, 1)).toISOString(),
    end: new Date(Date.UTC(year + 1, 0, 1)).toISOString(),
  };
}

function topFrequent(values: string[], max: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([value]) => value);
}

/**
 * POST /diary-summary
 * 按月/年聚合日记：统计在代码中完成，洞察与高光由 LLM 生成（失败降级）。
 * Body: { period: "month" | "year", ref: "2026-07" | "2026" }
 * Resp: { period, ref, entry_count, top_emotions, top_keywords, insight, highlights }
 */
Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const input = validateDiarySummaryInput(await readJson(req));
    const { user, db } = await requireUser(req);

    const range = periodRange(input.period, input.ref);
    const { data, error, count } = await db
      .from("diary_entries")
      .select("transcript,emotions,keywords", { count: "exact" })
      .eq("user_id", user.id)
      .gte("created_at", range.start)
      .lt("created_at", range.end)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) {
      console.error("diary summary query failed:", error.message);
    }

    const entries = data ?? [];
    const entryCount = count ?? entries.length;
    const periodLabel = input.period === "month" ? "本月" : "今年";

    if (entryCount === 0) {
      return jsonResponse({
        period: input.period,
        ref: input.ref,
        entry_count: 0,
        top_emotions: [],
        top_keywords: [],
        insight:
          `${periodLabel}还没有日记记录。想到什么就随手记一段，回顾时会看见自己的变化。`,
        highlights: [],
      });
    }

    const topEmotions = topFrequent(
      entries.flatMap((e) => e.emotions ?? []),
      5,
    );
    const topKeywords = topFrequent(
      entries.flatMap((e) => e.keywords ?? []),
      8,
    );

    let insight = `${periodLabel}你记录了 ${entryCount} 篇日记` +
      (topEmotions.length > 0 ? `，情绪多与「${topEmotions[0]}」相关` : "") +
      (topKeywords.length > 0
        ? `，常出现的主题有${
          topKeywords.slice(0, 3).map((k) => `「${k}」`).join("、")
        }`
        : "") +
      "。坚持记录本身就是在认真对待自己的生活。";
    let highlights: string[] = [];

    try {
      const transcripts = entries
        .map((e) => (e.transcript ?? "").trim())
        .filter((t) => t.length > 0)
        .join("\n---\n")
        .slice(0, MAX_TRANSCRIPT_CHARS);
      const result = await structuredOutput<DiarySummaryOutput>({
        model: runtimeConfig.structuredModel,
        maxTokens: 1_024,
        system: diarySummaryPrompt,
        prompt: `时间段：${input.ref}（${
          input.period === "month" ? "月度" : "年度"
        }回顾）\n日记数量：${entryCount}\n高频情绪：${
          topEmotions.join("、") || "无"
        }\n高频关键词：${
          topKeywords.join("、") || "无"
        }\n日记原文（可能被截断）：\n${transcripts}`,
        schema: diarySummarySchema,
      });
      insight = result.insight;
      highlights = result.highlights.slice(0, 5);
    } catch (llmError) {
      console.error("diary summary llm failed:", llmError);
    }

    return jsonResponse({
      period: input.period,
      ref: input.ref,
      entry_count: entryCount,
      top_emotions: topEmotions,
      top_keywords: topKeywords,
      insight,
      highlights,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
