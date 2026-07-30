import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { validateListDiaryInput } from "../_shared/diary.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";

type DiaryEntryRow = {
  id: number;
  entry_uuid: string;
  source: string;
  status: string;
  recorded_at: string;
  local_date: string;
  timezone: string;
  audio_path: string | null;
  audio_mime: string | null;
  audio_bytes: number | null;
  duration_ms: number | null;
  transcript: string | null;
  transcript_raw: string | null;
  transcript_edited: string | null;
  transcript_language: string | null;
  title: string | null;
  entry_summary: string | null;
  emotions: string[] | null;
  keywords: string[] | null;
  content_version: number;
  error_code: string | null;
  uploaded_at: string | null;
  transcribed_at: string | null;
  analyzed_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * POST /list-diary
 * Returns real diary entries only. The legacy numeric id remains in the
 * response for older native clients; Web uses entry_id (entry_uuid).
 * Body: { limit?: number, offset?: number, from?: "yyyy-MM-dd", to?: "yyyy-MM-dd" }
 */
Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    let input = { limit: 50, offset: 0 } as ReturnType<
      typeof validateListDiaryInput
    >;
    if (req.method === "POST") {
      const body = await readJson(req);
      input = validateListDiaryInput(body);
    }
    const { user, db } = await requireUser(req);

    let query = db
      .from("diary_entries")
      .select(
        "id,entry_uuid,source,status,recorded_at,local_date,timezone," +
          "audio_path,audio_mime,audio_bytes,duration_ms," +
          "transcript,transcript_raw,transcript_edited,transcript_language," +
          "title,entry_summary,emotions,keywords,content_version,error_code," +
          "uploaded_at,transcribed_at,analyzed_at,created_at,updated_at",
        { count: "exact" },
      )
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (input.from) query = query.gte("local_date", input.from);
    if (input.to) query = query.lt("local_date", input.to);

    const { data, error, count } = await query
      .order("recorded_at", { ascending: false })
      .order("entry_uuid", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    if (error) {
      console.error("list diary failed:", error.message);
      throw new HttpError(500, "DATABASE_ERROR", "读取日记失败。");
    }

    const rows = (data ?? []) as unknown as DiaryEntryRow[];
    return jsonResponse({
      entries: rows.map((row) => ({
        id: row.id,
        entry_id: row.entry_uuid,
        source: row.source,
        status: row.status,
        recorded_at: row.recorded_at,
        local_date: row.local_date,
        timezone: row.timezone,
        has_audio: Boolean(row.audio_path),
        audio_mime: row.audio_mime,
        audio_bytes: row.audio_bytes,
        duration_ms: row.duration_ms,
        transcript: row.transcript_edited ?? row.transcript_raw ??
          row.transcript,
        transcript_language: row.transcript_language,
        title: row.title,
        entry_summary: row.entry_summary,
        emotions: row.emotions ?? [],
        keywords: row.keywords ?? [],
        content_version: row.content_version,
        error_code: row.error_code,
        uploaded_at: row.uploaded_at,
        transcribed_at: row.transcribed_at,
        analyzed_at: row.analyzed_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
      total: count ?? 0,
    });
  } catch (error) {
    return errorResponse(error, req);
  }
});
