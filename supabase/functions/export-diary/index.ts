import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { errorResponse, HttpError, jsonResponse } from "../_shared/errors.ts";

const PAGE_SIZE = 500;
const MAX_ENTRIES = 10_000;

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "仅支持 POST 请求。");
    }
    const { user, db } = await requireUser(req);
    const entries: unknown[] = [];
    for (let offset = 0; offset < MAX_ENTRIES; offset += PAGE_SIZE) {
      const page = await db
        .from("diary_entries")
        .select(
          "entry_uuid,source,status,recorded_at,local_date,timezone," +
            "duration_ms,transcript,transcript_raw,transcript_edited," +
            "transcript_language,title,entry_summary,emotions,keywords," +
            "content_version,created_at,updated_at,audio_path",
        )
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("recorded_at", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (page.error) {
        throw new HttpError(500, "DATABASE_ERROR", "导出日记失败。");
      }
      const rows = (page.data ?? []) as unknown as Array<
        Record<string, unknown>
      >;
      entries.push(...rows.map((row) => ({
        ...row,
        transcript: row.transcript_edited ?? row.transcript_raw ??
          row.transcript,
        transcript_raw: undefined,
        transcript_edited: undefined,
        audio_retained: Boolean(row.audio_path),
        audio_path: undefined,
      })));
      if (rows.length < PAGE_SIZE) break;
    }

    const summaries = await db
      .from("diary_summaries")
      .select(
        "period_type,period_start,status,entry_count,active_day_count," +
          "total_duration_ms,summary,data_cutoff_at,generated_at",
      )
      .eq("user_id", user.id)
      .order("period_start", { ascending: true })
      .limit(1000);
    if (summaries.error) {
      throw new HttpError(500, "DATABASE_ERROR", "导出日记总结失败。");
    }

    return jsonResponse({
      schema_version: 1,
      exported_at: new Date().toISOString(),
      entry_count: entries.length,
      truncated: entries.length >= MAX_ENTRIES,
      entries,
      summaries: summaries.data ?? [],
    });
  } catch (error) {
    return errorResponse(error, req);
  }
});
