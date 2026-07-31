import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  requireLinkedAccount,
  validateDiaryEntryIdInput,
} from "../_shared/diary.ts";
import {
  enqueueDiaryJob,
  entryJobKey,
  kickDiaryWorker,
} from "../_shared/diary-queue.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";

type RetryableEntry = {
  entry_uuid: string;
  status: string;
  transcript: string | null;
  transcript_raw: string | null;
  transcript_edited: string | null;
  audio_path: string | null;
  content_version: number;
};

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const input = validateDiaryEntryIdInput(await readJson(req));
    const { user, db } = await requireUser(req);
    requireLinkedAccount(user.is_anonymous);

    const result = await db
      .from("diary_entries")
      .select(
        "entry_uuid,status,transcript,transcript_raw,transcript_edited," +
          "audio_path,content_version",
      )
      .eq("user_id", user.id)
      .eq("entry_uuid", input.entryId)
      .is("deleted_at", null)
      .maybeSingle();
    if (result.error) {
      throw new HttpError(500, "DATABASE_ERROR", "读取语音日记失败。");
    }
    if (!result.data) {
      throw new HttpError(404, "ENTRY_NOT_FOUND", "没有找到这条语音日记。");
    }
    const entry = result.data as unknown as RetryableEntry;
    if (entry.status !== "failed") {
      return jsonResponse({
        entry_id: entry.entry_uuid,
        status: entry.status,
      });
    }

    const hasTranscript = Boolean(
      (
        entry.transcript_edited ??
          entry.transcript_raw ??
          entry.transcript ??
          ""
      ).trim(),
    );
    if (!hasTranscript && !entry.audio_path) {
      throw new HttpError(
        409,
        "ENTRY_NOT_RETRYABLE",
        "这条日记没有可重试的录音或文字。",
      );
    }
    const task = hasTranscript ? "analyze_entry" : "transcribe_entry";
    const status = hasTranscript ? "transcribed" : "uploaded";
    const updated = await db
      .from("diary_entries")
      .update({ status, error_code: null })
      .eq("user_id", user.id)
      .eq("entry_uuid", input.entryId)
      .eq("status", "failed")
      .select("entry_uuid,status")
      .maybeSingle();
    if (updated.error || !updated.data) {
      throw new HttpError(409, "ENTRY_STATE_CHANGED", "日记状态已经发生变化。");
    }

    await enqueueDiaryJob({
      job_key: entryJobKey(
        task,
        entry.entry_uuid,
        entry.content_version,
      ),
      task_type: task,
      user_id: user.id,
      entry_id: entry.entry_uuid,
      period_start: null,
    });
    kickDiaryWorker();
    return jsonResponse({
      entry_id: updated.data.entry_uuid,
      status: updated.data.status,
    }, 202);
  } catch (error) {
    return errorResponse(error, req);
  }
});
