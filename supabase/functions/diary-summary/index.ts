import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  type DiaryTaskType,
  enqueueDiaryJob,
  kickDiaryWorker,
  summaryJobKey,
} from "../_shared/diary-queue.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";
import { validateDiarySummaryInput } from "../_shared/validate.ts";

type SummaryData = {
  insight?: unknown;
  top_emotions?: unknown;
  top_keywords?: unknown;
  highlights?: unknown;
  highlight_refs?: unknown;
};

type SummaryRow = {
  status: "pending" | "generating" | "ready" | "stale" | "failed";
  entry_count: number;
  active_day_count: number;
  total_duration_ms: number;
  summary: SummaryData;
  generated_at: string | null;
  data_cutoff_at: string | null;
  error_code: string | null;
};

function periodStart(period: "day" | "month" | "year", ref: string): string {
  if (period === "day") return ref;
  if (period === "month") return `${ref}-01`;
  return `${ref}-01-01`;
}

function summaryTask(
  period: "day" | "month" | "year",
): Extract<DiaryTaskType, `generate_${string}_summary`> {
  return `generate_${period}_summary`;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const input = validateDiarySummaryInput(await readJson(req));
    const { user, db } = await requireUser(req);
    const start = periodStart(input.period, input.ref);
    const result = await db
      .from("diary_summaries")
      .select(
        "status,entry_count,active_day_count,total_duration_ms,summary," +
          "generated_at,data_cutoff_at,error_code",
      )
      .eq("user_id", user.id)
      .eq("period_type", input.period)
      .eq("period_start", start)
      .maybeSingle();
    if (result.error) {
      throw new HttpError(500, "DATABASE_ERROR", "读取日记总结失败。");
    }

    const row = result.data as unknown as SummaryRow | null;
    const status = row?.status ?? "pending";
    if (["pending", "stale", "failed"].includes(status)) {
      const task = summaryTask(input.period);
      await enqueueDiaryJob({
        job_key: summaryJobKey(task, user.id, start),
        task_type: task,
        user_id: user.id,
        entry_id: null,
        period_start: start,
      });
      kickDiaryWorker();
    }

    const summary = row?.summary ?? {};
    return jsonResponse({
      period: input.period,
      ref: input.ref,
      status,
      stale: status === "stale",
      entry_count: row?.entry_count ?? 0,
      active_day_count: row?.active_day_count ?? 0,
      total_duration_ms: row?.total_duration_ms ?? 0,
      top_emotions: strings(summary.top_emotions),
      top_keywords: strings(summary.top_keywords),
      insight: typeof summary.insight === "string" ? summary.insight : "",
      highlights: strings(summary.highlights),
      highlight_refs: Array.isArray(summary.highlight_refs)
        ? summary.highlight_refs
        : [],
      generated_at: row?.generated_at ?? null,
      data_cutoff_at: row?.data_cutoff_at ?? null,
      error_code: row?.error_code ?? null,
    });
  } catch (error) {
    return errorResponse(error, req);
  }
});
