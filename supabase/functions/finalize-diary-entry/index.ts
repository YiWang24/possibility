import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  DIARY_AUDIO_BUCKET,
  DIARY_MAX_AUDIO_BYTES,
  requireLinkedAccount,
  validateFinalizeDiaryEntryInput,
} from "../_shared/diary.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";
import {
  enqueueDiaryJob,
  entryJobKey,
  kickDiaryWorker,
} from "../_shared/diary-queue.ts";

function objectLocation(path: string): { folder: string; name: string } {
  const index = path.lastIndexOf("/");
  if (index <= 0 || index === path.length - 1) {
    throw new HttpError(500, "AUDIO_PATH_INVALID", "音频路径无效。");
  }
  return { folder: path.slice(0, index), name: path.slice(index + 1) };
}

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const input = validateFinalizeDiaryEntryInput(await readJson(req));
    const { user, db } = await requireUser(req);
    requireLinkedAccount(user.is_anonymous);

    const entryRes = await db
      .from("diary_entries")
      .select(
        "entry_uuid,status,audio_path,audio_mime,audio_bytes,content_version",
      )
      .eq("user_id", user.id)
      .eq("entry_uuid", input.entryId)
      .is("deleted_at", null)
      .maybeSingle();
    if (entryRes.error) {
      throw new HttpError(500, "DATABASE_ERROR", "读取语音日记失败。");
    }
    if (!entryRes.data) {
      throw new HttpError(404, "ENTRY_NOT_FOUND", "没有找到这条语音日记。");
    }
    if (entryRes.data.status !== "draft") {
      if (entryRes.data.status === "uploaded") {
        await enqueueDiaryJob({
          job_key: entryJobKey(
            "transcribe_entry",
            entryRes.data.entry_uuid,
            entryRes.data.content_version,
          ),
          task_type: "transcribe_entry",
          user_id: user.id,
          entry_id: entryRes.data.entry_uuid,
          period_start: null,
        });
        kickDiaryWorker();
      }
      return jsonResponse({
        entry_id: entryRes.data.entry_uuid,
        status: entryRes.data.status,
        audio_bytes: entryRes.data.audio_bytes,
      });
    }
    const path = entryRes.data.audio_path;
    if (!path) {
      throw new HttpError(409, "AUDIO_NOT_UPLOADED", "这条日记还没有音频。");
    }

    const location = objectLocation(path);
    const listed = await db.storage
      .from(DIARY_AUDIO_BUCKET)
      .list(location.folder, { limit: 10, search: location.name });
    if (listed.error) {
      console.error("list diary audio failed:", listed.error.name);
      throw new HttpError(500, "STORAGE_ERROR", "暂时无法确认音频上传状态。");
    }
    const object = listed.data.find((item) => item.name === location.name);
    if (!object) {
      throw new HttpError(409, "AUDIO_NOT_UPLOADED", "音频还没有上传完成。");
    }
    const metadata = (object.metadata ?? {}) as Record<string, unknown>;
    const rawSize = metadata.size;
    const audioBytes = typeof rawSize === "number" ? rawSize : null;
    if (audioBytes !== null && audioBytes > DIARY_MAX_AUDIO_BYTES) {
      throw new HttpError(413, "AUDIO_TOO_LARGE", "单条录音不能超过 20 MB。");
    }

    const updated = await db
      .from("diary_entries")
      .update({
        status: "uploaded",
        duration_ms: input.durationMs,
        audio_bytes: audioBytes,
        uploaded_at: new Date().toISOString(),
        error_code: null,
      })
      .eq("user_id", user.id)
      .eq("entry_uuid", input.entryId)
      .eq("status", "draft")
      .select("entry_uuid,status,audio_bytes,duration_ms,content_version")
      .maybeSingle();
    if (updated.error || !updated.data) {
      throw new HttpError(409, "ENTRY_STATE_CHANGED", "日记状态已经发生变化。");
    }

    await enqueueDiaryJob({
      job_key: entryJobKey(
        "transcribe_entry",
        updated.data.entry_uuid,
        updated.data.content_version,
      ),
      task_type: "transcribe_entry",
      user_id: user.id,
      entry_id: updated.data.entry_uuid,
      period_start: null,
    });
    kickDiaryWorker();

    return jsonResponse({
      entry_id: updated.data.entry_uuid,
      status: updated.data.status,
      audio_bytes: updated.data.audio_bytes,
      duration_ms: updated.data.duration_ms,
    }, 202);
  } catch (error) {
    return errorResponse(error, req);
  }
});
