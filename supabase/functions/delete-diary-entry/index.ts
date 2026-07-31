import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  DIARY_AUDIO_BUCKET,
  diaryPeriodStart,
  requireLinkedAccount,
  validateDiaryEntryIdInput,
} from "../_shared/diary.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";
import {
  enqueueDiaryJob,
  kickDiaryWorker,
  summaryJobKey,
} from "../_shared/diary-queue.ts";

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const input = validateDiaryEntryIdInput(await readJson(req));
    const { user, db } = await requireUser(req);
    requireLinkedAccount(user.is_anonymous);

    const entry = await db
      .from("diary_entries")
      .select("audio_path,local_date")
      .eq("user_id", user.id)
      .eq("entry_uuid", input.entryId)
      .is("deleted_at", null)
      .maybeSingle();
    if (entry.error) {
      throw new HttpError(500, "DATABASE_ERROR", "读取语音日记失败。");
    }
    if (!entry.data) {
      return jsonResponse({ deleted: true });
    }

    const periods = [
      {
        task: "generate_day_summary" as const,
        start: entry.data.local_date,
      },
      {
        task: "generate_month_summary" as const,
        start: diaryPeriodStart("month", entry.data.local_date),
      },
      {
        task: "generate_year_summary" as const,
        start: diaryPeriodStart("year", entry.data.local_date),
      },
    ];
    for (const period of periods) {
      await enqueueDiaryJob({
        job_key: summaryJobKey(period.task, user.id, period.start),
        task_type: period.task,
        user_id: user.id,
        entry_id: null,
        period_start: period.start,
      });
    }

    if (entry.data.audio_path) {
      const removed = await db.storage
        .from(DIARY_AUDIO_BUCKET)
        .remove([entry.data.audio_path]);
      if (removed.error) {
        console.error("delete diary audio failed:", removed.error.name);
        throw new HttpError(500, "STORAGE_ERROR", "删除录音失败，请稍后重试。");
      }
    }

    const deleted = await db
      .from("diary_entries")
      .delete()
      .eq("user_id", user.id)
      .eq("entry_uuid", input.entryId);
    if (deleted.error) {
      throw new HttpError(500, "DATABASE_ERROR", "删除语音日记失败。");
    }
    kickDiaryWorker();
    return jsonResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error, req);
  }
});
