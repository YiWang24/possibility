// POST /delete-account — 注销当前账号（App Store 审核 5.1.1(v) 强制要求）。
//
// requireUser 确认身份后用 service role 删除 auth.users 行；
// 全部业务表均 on delete cascade（bounties 为 set null），无需逐表清理。
// 客户端收到成功响应后本地 signOut 并回落匿名。

import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/service.ts";
import { errorResponse, HttpError, jsonResponse } from "../_shared/errors.ts";
import { DIARY_AUDIO_BUCKET } from "../_shared/diary.ts";

async function listDiaryAudioPaths(userId: string): Promise<string[]> {
  const storage = serviceClient().storage.from(DIARY_AUDIO_BUCKET);
  const folders = [userId];
  const files: string[] = [];
  while (folders.length > 0) {
    const folder = folders.pop()!;
    for (let offset = 0;; offset += 100) {
      const listed = await storage.list(folder, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (listed.error) throw new Error("DIARY_STORAGE_LIST_FAILED");
      for (const item of listed.data) {
        const path = `${folder}/${item.name}`;
        if (item.id) files.push(path);
        else folders.push(path);
      }
      if (listed.data.length < 100) break;
    }
  }
  return files;
}

async function deleteDiaryAudio(userId: string): Promise<void> {
  const paths = await listDiaryAudioPaths(userId);
  const storage = serviceClient().storage.from(DIARY_AUDIO_BUCKET);
  for (let offset = 0; offset < paths.length; offset += 100) {
    const removed = await storage.remove(paths.slice(offset, offset + 100));
    if (removed.error) throw new Error("DIARY_STORAGE_DELETE_FAILED");
  }
}

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "仅支持 POST 请求。");
    }
    const { user } = await requireUser(req);
    try {
      await deleteDiaryAudio(user.id);
      const purged = await serviceClient().rpc("purge_diary_jobs", {
        p_user_id: user.id,
      });
      if (purged.error) throw new Error("DIARY_QUEUE_PURGE_FAILED");
    } catch (cleanupError) {
      console.error(
        "delete account diary cleanup failed:",
        cleanupError instanceof Error ? cleanupError.message : "UNKNOWN",
      );
      throw new HttpError(
        500,
        "DELETE_CLEANUP_FAILED",
        "注销前的数据清理失败，请稍后重试。",
      );
    }
    const { error } = await serviceClient().auth.admin.deleteUser(user.id);
    if (error) {
      console.error("delete account failed:", error.message);
      throw new HttpError(500, "DELETE_FAILED", "注销失败，请稍后重试。");
    }
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error, req);
  }
});
