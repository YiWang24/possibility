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

const URL_TTL_SECONDS = 5 * 60;

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const input = validateDiaryEntryIdInput(await readJson(req));
    const { user, db } = await requireUser(req);
    requireLinkedAccount(user.is_anonymous);

    const entry = await db
      .from("diary_entries")
      .select("audio_path")
      .eq("user_id", user.id)
      .eq("entry_uuid", input.entryId)
      .is("deleted_at", null)
      .maybeSingle();
    if (entry.error) {
      throw new HttpError(500, "DATABASE_ERROR", "读取语音日记失败。");
    }
    if (!entry.data?.audio_path) {
      throw new HttpError(404, "AUDIO_NOT_FOUND", "这条日记没有可播放的音频。");
    }

    const signed = await db.storage
      .from(DIARY_AUDIO_BUCKET)
      .createSignedUrl(entry.data.audio_path, URL_TTL_SECONDS);
    if (signed.error || !signed.data?.signedUrl) {
      throw new HttpError(500, "STORAGE_ERROR", "暂时无法播放这段录音。");
    }

    return jsonResponse({
      signed_url: signed.data.signedUrl,
      expires_in: URL_TTL_SECONDS,
    });
  } catch (error) {
    return errorResponse(error, req);
  }
});
