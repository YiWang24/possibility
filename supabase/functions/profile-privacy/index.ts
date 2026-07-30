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
      permission_revision: Number(props.permission_revision ?? 0),
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
      const [
        profileResult,
        factResult,
        proposalResult,
        permissionResult,
        receipts,
      ] = await Promise
        .all([
          db.from("profiles")
            .select("profile_revision,permission_revision,portrait_pct")
            .eq("id", user.id)
            .maybeSingle(),
          db.from("profile_facts")
            .select(
              "id,dimension,fact_kind,value,source,source_ref,confidence,user_confirmed,status,sensitivity,support_count,observed_at,last_supported_at,updated_at",
            )
            .eq("user_id", user.id)
            .eq("status", "active")
            .order("dimension")
            .order("updated_at", { ascending: false }),
          db.from("memory_proposals")
            .select(
              "id,dimension,fact_kind,value,source_type,source_id,confidence,sensitivity,status,created_at,expires_at",
            )
            .eq("user_id", user.id)
            .eq("status", "pending")
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false }),
          db.from("profile_ai_permissions")
            .select("dimension,purpose,allowed,updated_at")
            .eq("user_id", user.id),
          accessReceipts(user.id),
        ]);
      if (profileResult.error) {
        databaseFailure(profileResult.error, "读取画像版本失败。");
      }
      if (factResult.error) {
        databaseFailure(factResult.error, "读取画像事实失败。");
      }
      if (proposalResult.error) {
        databaseFailure(proposalResult.error, "读取待确认画像失败。");
      }
      if (permissionResult.error) {
        databaseFailure(permissionResult.error, "读取 AI 授权失败。");
      }
      const permissionMatrix: Record<string, Record<string, boolean>> = {};
      for (const row of permissionResult.data ?? []) {
        (permissionMatrix[row.dimension] ??= {})[row.purpose] = row.allowed;
      }
      const permissionUpdatedAt = (permissionResult.data ?? [])
        .map((row) => row.updated_at)
        .filter((value): value is string => typeof value === "string")
        .sort()
        .at(-1) ?? null;
      return jsonResponse({
        profile_revision: Number(profileResult.data?.profile_revision ?? 0),
        permission_revision: Number(
          profileResult.data?.permission_revision ?? 0,
        ),
        portrait_pct: Number(profileResult.data?.portrait_pct ?? 0),
        facts: factResult.data ?? [],
        proposals: proposalResult.data ?? [],
        permissions: permissionMatrix,
        permission_updated_at: permissionUpdatedAt,
        access_receipts: receipts,
      });
    }

    if (action === "export") {
      const [
        profileResult,
        factResult,
        evidenceResult,
        proposalResult,
        assessmentResult,
        cardResult,
        permissionResult,
        draftResult,
        publicationResult,
        personaResult,
        receipts,
      ] = await Promise.all([
        db.from("profiles")
          .select(
            "portrait_pct,profile_revision,permission_revision,created_at,updated_at",
          )
          .eq("id", user.id)
          .maybeSingle(),
        db.from("profile_facts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at"),
        db.from("profile_fact_evidence")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at"),
        db.from("memory_proposals")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at"),
        db.from("assessment_runs")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at"),
        db.from("card_game_results")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at"),
        db.from("profile_ai_permissions")
          .select("dimension,purpose,allowed,created_at,updated_at")
          .eq("user_id", user.id),
        db.from("profile_public_drafts")
          .select("*")
          .eq("id", user.id)
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
        evidenceResult.error,
        proposalResult.error,
        assessmentResult.error,
        cardResult.error,
        permissionResult.error,
        draftResult.error,
        publicationResult.error,
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
          fact_evidence: evidenceResult.data ?? [],
          memory_proposals: proposalResult.data ?? [],
          assessment_runs: assessmentResult.data ?? [],
          card_games: cardResult.data ?? [],
          ai_permissions: permissionResult.data ?? [],
          profile_public_draft: draftResult.data,
          public_profile: publicationResult.data,
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

    if (action === "review_proposal") {
      const proposalId = uuidOf(body.proposal_id, "proposal_id");
      if (typeof body.accept !== "boolean") {
        throw new HttpError(400, "INVALID_INPUT", "accept 必须是布尔值。");
      }
      const expectedRevision = revisionOf(body.profile_revision);
      const { data, error } = await db.rpc("review_profile_proposal", {
        p_proposal_id: proposalId,
        p_accept: body.accept,
        p_expected_revision: expectedRevision ?? null,
      });
      if (error) databaseFailure(error, "处理待确认画像失败。");
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
      const expectedRevision = revisionOf(body.permission_revision);
      const { data, error } = await db.rpc(
        "replace_profile_ai_permissions",
        {
          p_permissions: {},
          p_expected_revision: expectedRevision ?? null,
        },
      );
      if (error) databaseFailure(error, "撤回 AI 授权失败。");
      return jsonResponse({
        ok: true,
        permission_revision: Number(data ?? 0),
      });
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
      "action 必须是 get/export/confirm_fact/review_proposal/delete_dimension/revoke_all/clear_private 之一。",
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
