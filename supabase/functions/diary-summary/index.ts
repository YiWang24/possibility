import { structuredOutput } from "../_shared/llm.ts";
import { requireUser } from "../_shared/auth.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";
import { diarySummaryPrompt } from "../_shared/prompts.ts";
import {
  type DiarySummaryOutput,
  diarySummarySchema,
} from "../_shared/schemas.ts";
import { validateDiarySummaryInput } from "../_shared/validate.ts";

const MAX_TRANSCRIPT_CHARS = 12_000;
// 送入 LLM 的原文只取最近 N 条：年度场景不再全量拉取数百条完整转写。
const MAX_TRANSCRIPT_ENTRIES = 60;
// 统计聚合（情绪/关键词）最多参与的条数，与原实现保持一致。
const MAX_STATS_ENTRIES = 500;

type CachedSummary = {
  top_emotions: string[];
  top_keywords: string[];
  insight: string;
  highlights: string[];
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/** 校验缓存 jsonb 形状；不符合契约的脏数据按缓存未命中处理。 */
function asCachedSummary(value: unknown): CachedSummary | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.insight !== "string" ||
    !isStringArray(v.top_emotions) ||
    !isStringArray(v.top_keywords) ||
    !isStringArray(v.highlights)
  ) {
    return null;
  }
  return {
    top_emotions: v.top_emotions,
    top_keywords: v.top_keywords,
    insight: v.insight,
    highlights: v.highlights,
  };
}

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
 * 结果按 (user_id, period, ref) 缓存；entry_count 未变化时直接命中缓存，
 * 不重复调用 LLM。降级结果不写缓存，避免把兜底文案固化。
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

    // 条数统计（head 不传数据）与缓存查询并行，命中即免去后续查询与 LLM 调用。
    const [countRes, cacheRes] = await Promise.all([
      db
        .from("diary_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", range.start)
        .lt("created_at", range.end),
      db
        .from("diary_summary_cache")
        .select("entry_count,summary")
        .eq("user_id", user.id)
        .eq("period", input.period)
        .eq("ref", input.ref)
        .maybeSingle(),
    ]);
    if (countRes.error) {
      console.error("diary summary count failed:", countRes.error.message);
      throw new HttpError(500, "DATABASE_ERROR", "读取日记失败。");
    }

    const entryCount = countRes.count ?? 0;
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

    // 缓存不可用只记录日志，不影响主流程。
    if (cacheRes.error) {
      console.error("diary summary cache read failed:", cacheRes.error.message);
    } else if (cacheRes.data?.entry_count === entryCount) {
      const cached = asCachedSummary(cacheRes.data.summary);
      if (cached) {
        return jsonResponse({
          period: input.period,
          ref: input.ref,
          entry_count: entryCount,
          ...cached,
        });
      }
    }

    // 未命中：统计聚合不拉 transcript；LLM 原文单独取最近 N 条，避免全量传输。
    const [statsRes, transcriptRes] = await Promise.all([
      db
        .from("diary_entries")
        .select("emotions,keywords,created_at")
        .eq("user_id", user.id)
        .gte("created_at", range.start)
        .lt("created_at", range.end)
        .order("created_at", { ascending: true })
        .limit(MAX_STATS_ENTRIES),
      db
        .from("diary_entries")
        .select("transcript")
        .eq("user_id", user.id)
        .gte("created_at", range.start)
        .lt("created_at", range.end)
        .order("created_at", { ascending: false })
        .limit(MAX_TRANSCRIPT_ENTRIES),
    ]);
    if (statsRes.error || transcriptRes.error) {
      console.error(
        "diary summary query failed:",
        (statsRes.error ?? transcriptRes.error)?.message,
      );
      throw new HttpError(500, "DATABASE_ERROR", "读取日记失败。");
    }

    const entries = statsRes.data ?? [];
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
    let llmOk = false;

    try {
      // 查询按时间倒序取最近 N 条，此处还原为时间正序后拼接、再截断。
      const transcripts = (transcriptRes.data ?? [])
        .map((e) => (e.transcript ?? "").trim())
        .filter((t) => t.length > 0)
        .reverse()
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
        track: { userId: user.id, feature: "diary_summary" },
        trace: {
          name: "diary-summary",
          userId: user.id,
          metadata: { period: input.period, ref: input.ref },
        },
      });
      insight = result.insight;
      highlights = result.highlights.slice(0, 5);
      llmOk = true;
    } catch (llmError) {
      console.error("diary summary llm failed:", llmError);
    }

    // 仅缓存 LLM 成功的结果；写入失败不影响响应。
    if (llmOk) {
      const { error: cacheWriteError } = await db
        .from("diary_summary_cache")
        .upsert({
          user_id: user.id,
          period: input.period,
          ref: input.ref,
          entry_count: entryCount,
          summary: {
            top_emotions: topEmotions,
            top_keywords: topKeywords,
            insight,
            highlights,
          },
        });
      if (cacheWriteError) {
        console.error(
          "diary summary cache write failed:",
          cacheWriteError.message,
        );
      }
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
    return errorResponse(error, req);
  }
});
