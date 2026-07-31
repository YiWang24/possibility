import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  DIARY_AUDIO_BUCKET,
  requireLinkedAccount,
  validateDiaryEntryIdInput,
} from "../_shared/diary.ts";
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
    const input = validateDiaryEntryIdInput(await readJson(req));
    const { user, db } = await requireUser(req);
    requireLinkedAccount(user.is_anonymous);

    const entry = await db
      .from("diary_entries")
      .select("entry_uuid,audio_path,status,transcript")
      .eq("user_id", user.id)
      .eq("entry_uuid", input.entryId)
      .is("deleted_at", null)
      .maybeSingle();
    if (entry.error) {
      throw new HttpError(500, "DATABASE_ERROR", "读取语音日记失败。");
    }
    if (!entry.data) {
      throw new HttpError(404, "ENTRY_NOT_FOUND", "没有找到这条语音日记。");
    }
    if (!entry.data.transcript || entry.data.status !== "ready") {
      throw new HttpError(
        409,
        "TRANSCRIPT_NOT_READY",
        "请在转写和分析完成后再删除原始录音。",
      );
    }
    if (!entry.data.audio_path) {
      return jsonResponse({ entry_id: input.entryId, audio_deleted: true });
    }

    const removed = await db.storage
      .from(DIARY_AUDIO_BUCKET)
      .remove([entry.data.audio_path]);
    if (removed.error) {
      console.error("delete diary source audio failed:", removed.error.name);
      throw new HttpError(
        500,
        "STORAGE_ERROR",
        "删除原始录音失败，请稍后重试。",
      );
    }
    const updated = await db
      .from("diary_entries")
      .update({
        audio_path: null,
        audio_bytes: null,
        audio_deleted_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("entry_uuid", input.entryId)
      .eq("audio_path", entry.data.audio_path);
    if (updated.error) {
      throw new HttpError(500, "DATABASE_ERROR", "更新日记录音状态失败。");
    }
    return jsonResponse({ entry_id: input.entryId, audio_deleted: true });
  } catch (error) {
    return errorResponse(error, req);
  }
});
