// POST /delete-account — 注销当前账号（App Store 审核 5.1.1(v) 强制要求）。
//
// requireUser 确认身份后用 service role 删除 auth.users 行；
// 全部业务表均 on delete cascade（bounties 为 set null），无需逐表清理。
// 客户端收到成功响应后本地 signOut 并回落匿名。

import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/service.ts";
import { errorResponse, HttpError, jsonResponse } from "../_shared/errors.ts";

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "仅支持 POST 请求。");
    }
    const { user } = await requireUser(req);
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
