// POST /merge-anonymous — 匿名账号数据迁移到当前正式账号。
//
// 场景：匿名用户走 Apple 登录（signInWithIdToken 产生/命中另一个正式账号），
// 客户端在切换 session 前保留旧匿名 access token，登录成功后携带来调本函数。
// 手机号转正（updateUser 链接 phone identity）user_id 不变，无需调用。
//
// 安全：requireUser 确认调用者是正式用户；旧 token 必须属于 is_anonymous 用户
// 且与当前用户不同 —— 防止拿任意用户 token 吸走别人数据。

import { createClient } from "@supabase/supabase-js";
import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/service.ts";
import { runtimeConfig } from "../_shared/config.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";
import { ServerEvent } from "../_shared/events.ts";
import { trackEvent } from "../_shared/track.ts";

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const { user } = await requireUser(req);
    if (user.is_anonymous) {
      throw new HttpError(403, "FORBIDDEN", "请先完成正式登录再迁移数据。");
    }

    const body = await readJson(req) as Record<string, unknown>;
    const anonToken = typeof body.anonymous_access_token === "string"
      ? body.anonymous_access_token.trim()
      : "";
    if (!anonToken) {
      throw new HttpError(
        400,
        "INVALID_INPUT",
        "缺少 anonymous_access_token。",
      );
    }

    // 校验旧 token：必须是有效会话、匿名用户、且不是当前用户自己
    const probe = createClient(
      runtimeConfig.supabaseUrl,
      runtimeConfig.supabaseAnonKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await probe.auth.getUser(anonToken);
    if (error || !data.user) {
      throw new HttpError(401, "INVALID_TOKEN", "匿名会话凭证无效或已过期。");
    }
    if (!data.user.is_anonymous) {
      throw new HttpError(403, "NOT_ANONYMOUS", "凭证不属于匿名账号。");
    }
    if (data.user.id === user.id) {
      return jsonResponse({ ok: true, merged: false }); // 同一账号无需迁移
    }

    const svc = serviceClient();
    const { error: mergeError } = await svc.rpc("merge_anonymous_user", {
      p_old: data.user.id,
      p_new: user.id,
    });
    if (mergeError) {
      console.error("merge_anonymous_user failed:", mergeError.message);
      throw new HttpError(500, "MERGE_FAILED", "数据迁移失败，请稍后重试。");
    }

    // 必须在 deleteUser 之前上报：0017 已把旧账号的 app_events 一并迁到新 user_id，
    // 这条事件本身也要落在新账号名下，才能把匿名期行为接回完整漏斗（§2）。
    trackEvent(user.id, ServerEvent.IDENTITY_MERGED, {
      anonymous_id: data.user.id,
    });

    // 数据已迁移，删除匿名用户（级联清掉残留行）
    const { error: deleteError } = await svc.auth.admin.deleteUser(
      data.user.id,
    );
    if (deleteError) {
      // 迁移已成功，删除失败只记录：孤儿匿名用户无数据可泄露
      console.error("delete anonymous user failed:", deleteError.message);
    }

    return jsonResponse({ ok: true, merged: true });
  } catch (error) {
    return errorResponse(error, req);
  }
});
