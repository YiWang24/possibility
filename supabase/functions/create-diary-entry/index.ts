import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  DIARY_MAX_AUDIO_BYTES,
  diaryAudioPath,
  requireLinkedAccount,
  validateCreateDiaryEntryInput,
} from "../_shared/diary.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";
import { runtimeConfig } from "../_shared/config.ts";

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const input = validateCreateDiaryEntryInput(await readJson(req));
    const { user, db } = await requireUser(req);
    requireLinkedAccount(user.is_anonymous);

    const audioPath = diaryAudioPath(user.id, input);
    const existing = await db
      .from("diary_entries")
      .select("entry_uuid,status,audio_path,audio_mime")
      .eq("user_id", user.id)
      .eq("entry_uuid", input.entryId)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing.error) {
      throw new HttpError(500, "DATABASE_ERROR", "读取语音日记失败。");
    }
    if (existing.data) {
      return jsonResponse({
        entry_id: existing.data.entry_uuid,
        status: existing.data.status,
        upload_path: existing.data.audio_path,
        mime_type: existing.data.audio_mime,
        max_bytes: DIARY_MAX_AUDIO_BYTES,
      });
    }

    const dailyUsage = await db
      .from("diary_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("source", "voice")
      .eq("local_date", input.localDate)
      .is("deleted_at", null);
    if (dailyUsage.error) {
      throw new HttpError(500, "DATABASE_ERROR", "读取今日录音用量失败。");
    }
    if ((dailyUsage.count ?? 0) >= runtimeConfig.diaryDailyEntryLimit) {
      throw new HttpError(
        429,
        "DIARY_DAILY_ENTRY_LIMIT",
        "今天的语音日记条数已达到上限，请明天再继续记录。",
      );
    }

    const row = {
      entry_uuid: input.entryId,
      user_id: user.id,
      source: input.source,
      status: "draft",
      recorded_at: input.recordedAt,
      local_date: input.localDate,
      timezone: input.timezone,
      audio_path: audioPath,
      audio_mime: input.mime,
    };

    const { data, error } = await db
      .from("diary_entries")
      .insert(row)
      .select("entry_uuid,status,audio_path,audio_mime")
      .single();

    if (error?.code === "23505") {
      const existing = await db
        .from("diary_entries")
        .select("entry_uuid,status,audio_path,audio_mime")
        .eq("user_id", user.id)
        .eq("entry_uuid", input.entryId)
        .maybeSingle();
      if (existing.error || !existing.data) {
        throw new HttpError(409, "ENTRY_CONFLICT", "日记标识已经存在。");
      }
      return jsonResponse({
        entry_id: existing.data.entry_uuid,
        status: existing.data.status,
        upload_path: existing.data.audio_path,
        mime_type: existing.data.audio_mime,
        max_bytes: DIARY_MAX_AUDIO_BYTES,
      });
    }
    if (error || !data) {
      console.error("create diary entry failed:", error?.code ?? "NO_DATA");
      throw new HttpError(500, "DATABASE_ERROR", "创建语音日记失败。");
    }

    return jsonResponse({
      entry_id: data.entry_uuid,
      status: data.status,
      upload_path: data.audio_path,
      mime_type: data.audio_mime,
      max_bytes: DIARY_MAX_AUDIO_BYTES,
    }, 201);
  } catch (error) {
    return errorResponse(error, req);
  }
});
