import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";
import { AI_DIMENSIONS } from "../_shared/profile-permissions.ts";
import { serviceClient } from "../_shared/service.ts";

type JsonObject = Record<string, unknown>;

function bodyObject(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_INPUT", "请求体必须是对象。");
  }
  return value as JsonObject;
}

function dimensionOf(value: unknown): string {
  if (
    typeof value !== "string" ||
    !AI_DIMENSIONS.includes(value as typeof AI_DIMENSIONS[number])
  ) {
    throw new HttpError(400, "INVALID_INPUT", "画像维度无效。");
  }
  return value;
}

function revisionOf(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new HttpError(400, "INVALID_INPUT", "profile_revision 无效。");
  }
  return Number(value);
}

function uuidOf(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
  ) {
    throw new HttpError(400, "INVALID_INPUT", `${field} 无效。`);
  }
  return value;
}

function databaseFailure(
  error: { code?: string; message?: string } | null,
  fallback: string,
): never {
  if (error?.code === "40001") {
    throw new HttpError(
      409,
      "PROFILE_REVISION_CONFLICT",
      "画像已在其他设备更新，请刷新后重试。",
    );
  }
  console.error("profile privacy database error:", error?.code ?? "unknown");
  throw new HttpError(500, "DATABASE_ERROR", fallback);
}

async function accessReceipts(userId: string, limit = 50) {
  // app_events 不开放用户 SELECT；这里只用已经验签的 user.id 做精确过滤，
  // 且只读取不含画像值的 profile_ai_context_used 最小化事件。
  const { data, error } = await serviceClient()
    .from("app_events")
    .select("id,props,created_at")
    .eq("user_id", userId)
    .eq("event", "profile_ai_context_used")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) databaseFailure(error, "读取 AI 使用记录失败。");
  return (data ?? []).map((row) => {
    const props = (row.props ?? {}) as Record<string, unknown>;
    const dimensions = typeof props.dimensions === "string"
      ? props.dimensions.split(",").filter(Boolean)
      : [];
    return {
      id: row.id,
      purpose: typeof props.purpose === "string" ? props.purpose : "unknown",
      dimensions,
      dimension_count: Number(props.dimension_count ?? dimensions.length),
      fact_count: Number(props.fact_count ?? 0),
      profile_revision: Number(props.profile_revision ?? 0),
      created_at: row.created_at,
    };
  });
}

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const body = bodyObject(await readJson(req));
    const action = typeof body.action === "string" ? body.action : "get";
    const { user, db } = await requireUser(req);

    if (action === "get") {
      const [profileResult, factResult, permissionResult, receipts] =
        await Promise
          .all([
            db.from("profiles")
              .select("profile_revision,portrait_pct")
              .eq("id", user.id)
              .maybeSingle(),
            db.from("profile_facts")
              .select(
                "id,dimension,value,source,source_ref,confidence,user_confirmed,status,observed_at,updated_at",
              )
              .eq("user_id", user.id)
              .eq("status", "active")
              .order("dimension")
              .order("updated_at", { ascending: false }),
            db.from("profile_ai_permissions")
              .select("permissions,updated_at")
              .eq("user_id", user.id)
              .maybeSingle(),
            accessReceipts(user.id),
          ]);
      if (profileResult.error) {
        databaseFailure(profileResult.error, "读取画像版本失败。");
      }
      if (factResult.error) {
        databaseFailure(factResult.error, "读取画像事实失败。");
      }
      if (permissionResult.error) {
        databaseFailure(permissionResult.error, "读取 AI 授权失败。");
      }
      return jsonResponse({
        profile_revision: Number(profileResult.data?.profile_revision ?? 0),
        portrait_pct: Number(profileResult.data?.portrait_pct ?? 0),
        facts: factResult.data ?? [],
        permissions: permissionResult.data?.permissions ?? {},
        permission_updated_at: permissionResult.data?.updated_at ?? null,
        access_receipts: receipts,
      });
    }

    if (action === "export") {
      const [
        profileResult,
        factResult,
        dimensionResult,
        cardResult,
        permissionResult,
        publicResult,
        personaResult,
        receipts,
      ] = await Promise.all([
        db.from("profiles")
          .select("portrait_pct,dims,profile_revision,created_at,updated_at")
          .eq("id", user.id)
          .maybeSingle(),
        db.from("profile_facts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at"),
        db.from("profile_dimensions")
          .select("*")
          .eq("user_id", user.id)
          .order("dimension"),
        db.from("card_game_results")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at"),
        db.from("profile_ai_permissions")
          .select("permissions,created_at,updated_at")
          .eq("user_id", user.id)
          .maybeSingle(),
        db.from("public_profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle(),
        db.from("persona_jobs")
          .select("id,status,persona,model_version,created_at,updated_at")
          .eq("user_id", user.id)
          .order("created_at"),
        accessReceipts(user.id, 500),
      ]);
      const queryErrors = [
        profileResult.error,
        factResult.error,
        dimensionResult.error,
        cardResult.error,
        permissionResult.error,
        publicResult.error,
        personaResult.error,
      ].filter(Boolean);
      if (queryErrors.length > 0) {
        databaseFailure(queryErrors[0], "导出个人档案失败。");
      }
      return jsonResponse({
        schema: "possibility.profile-export",
        schema_version: 1,
        exported_at: new Date().toISOString(),
        data: {
          profile: profileResult.data,
          facts: factResult.data ?? [],
          dimensions: dimensionResult.data ?? [],
          card_games: cardResult.data ?? [],
          ai_permissions: permissionResult.data,
          public_profile: publicResult.data,
          persona_jobs: personaResult.data ?? [],
          ai_access_receipts: receipts,
        },
      });
    }

    if (action === "confirm_fact") {
      const factId = uuidOf(body.fact_id, "fact_id");
      const expectedRevision = revisionOf(body.profile_revision);
      const { data, error } = await db.rpc("confirm_profile_fact", {
        p_fact_id: factId,
        p_expected_revision: expectedRevision ?? null,
      });
      if (error) databaseFailure(error, "确认画像事实失败。");
      return jsonResponse({ ok: true, profile: data?.[0] ?? null });
    }

    if (action === "delete_dimension") {
      const dimension = dimensionOf(body.dimension);
      const expectedRevision = revisionOf(body.profile_revision);
      const { data, error } = await db.rpc("delete_profile_dimension", {
        p_dimension: dimension,
        p_expected_revision: expectedRevision ?? null,
      });
      if (error) databaseFailure(error, "删除画像维度失败。");
      return jsonResponse({ ok: true, profile: data?.[0] ?? null });
    }

    if (action === "revoke_all") {
      const { error } = await db.from("profile_ai_permissions").upsert({
        user_id: user.id,
        permissions: {},
      }, { onConflict: "user_id" });
      if (error) databaseFailure(error, "撤回 AI 授权失败。");
      return jsonResponse({ ok: true });
    }

    if (action === "clear_private") {
      const expectedRevision = revisionOf(body.profile_revision);
      const { data, error } = await db.rpc("clear_private_profile", {
        p_expected_revision: expectedRevision ?? null,
      });
      if (error) databaseFailure(error, "清空私密画像失败。");
      return jsonResponse({ ok: true, profile: data?.[0] ?? null });
    }

    throw new HttpError(
      400,
      "INVALID_ACTION",
      "action 必须是 get/export/confirm_fact/delete_dimension/revoke_all/clear_private 之一。",
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
