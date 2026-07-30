import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  requireLinkedAccount,
  validateUpdateDiaryTranscriptInput,
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

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const input = validateUpdateDiaryTranscriptInput(await readJson(req));
    const { user, db } = await requireUser(req);
    requireLinkedAccount(user.is_anonymous);

    const existing = await db
      .from("diary_entries")
      .select("entry_uuid,status,content_version")
      .eq("user_id", user.id)
      .eq("entry_uuid", input.entryId)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing.error) {
      throw new HttpError(500, "DATABASE_ERROR", "读取语音日记失败。");
    }
    if (!existing.data) {
      throw new HttpError(404, "ENTRY_NOT_FOUND", "没有找到这条语音日记。");
    }
    if (
      !["transcribed", "analyzing", "ready", "failed"].includes(
        existing.data.status,
      )
    ) {
      throw new HttpError(409, "TRANSCRIPT_NOT_READY", "转写完成后才能修订。");
    }

    const nextVersion = existing.data.content_version + 1;
    const updated = await db
      .from("diary_entries")
      .update({
        transcript: input.transcript,
        transcript_edited: input.transcript,
        content_version: nextVersion,
        status: "transcribed",
        error_code: null,
      })
      .eq("user_id", user.id)
      .eq("entry_uuid", input.entryId)
      .eq("content_version", existing.data.content_version)
      .select("entry_uuid,status,content_version")
      .maybeSingle();
    if (updated.error || !updated.data) {
      throw new HttpError(409, "ENTRY_STATE_CHANGED", "日记内容已经发生变化。");
    }

    await enqueueDiaryJob({
      job_key: entryJobKey("analyze_entry", input.entryId, nextVersion),
      task_type: "analyze_entry",
      user_id: user.id,
      entry_id: input.entryId,
      period_start: null,
    });
    kickDiaryWorker();
    return jsonResponse({
      entry_id: updated.data.entry_uuid,
      status: updated.data.status,
      content_version: updated.data.content_version,
    }, 202);
  } catch (error) {
    return errorResponse(error, req);
  }
});
