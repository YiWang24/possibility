import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";
import {
  validateAIPermissionsInput,
  validateSaveCardGameInput,
  validateSaveDimensionInput,
} from "../_shared/validate.ts";
import { replaceProfileDimension } from "../_shared/db.ts";

/**
 * POST /save-profile
 * Unified endpoint for saving profile data:
 * - action: "save_dimension" → save a single profile dimension (tags)
 * - action: "save_card_game" → save card game result
 * - action: "save_public_profile" → save public profile data
 * - action: "save_ai_permissions" → save private, purpose-scoped AI consent
 */
Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const body = await readJson(req);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new HttpError(400, "INVALID_INPUT", "请求体必须是对象。");
    }
    const action = (body as Record<string, unknown>).action;
    const { user, db } = await requireUser(req);

    switch (action) {
      case "save_dimension": {
        const input = validateSaveDimensionInput(body);
        if (input.source === "assessment") {
          const raw = body as Record<string, unknown>;
          const assessmentKind = typeof raw.assessment_kind === "string"
            ? raw.assessment_kind.trim()
            : input.dimension;
          const answers = raw.assessment_answers ?? [];
          const scores = raw.assessment_scores ?? {};
          if (
            assessmentKind.length < 1 ||
            assessmentKind.length > 50 ||
            !Array.isArray(answers) ||
            answers.length > 200 ||
            typeof scores !== "object" ||
            scores === null ||
            Array.isArray(scores) ||
            JSON.stringify(scores).length > 20_000
          ) {
            throw new HttpError(400, "INVALID_INPUT", "测评结果格式无效。");
          }
          const { data, error } = await db.rpc(
            "save_assessment_and_profile",
            {
              p_dimension: input.dimension,
              p_values: input.tags,
              p_assessment_kind: assessmentKind,
              p_answers: answers,
              p_scores: scores,
              p_schema_version: 1,
              p_expected_revision: null,
            },
          );
          if (error) {
            console.error("save assessment failed:", error.message);
            throw new HttpError(500, "DATABASE_ERROR", "保存测评结果失败。");
          }
          return jsonResponse({
            ok: true,
            dimension: input.dimension,
            profile_revision: Number(data?.[0]?.profile_revision ?? 0),
            assessment_run_id: data?.[0]?.assessment_run_id ?? null,
          });
        }
        const snapshot = await replaceProfileDimension(db, {
          dimension: input.dimension,
          values: input.tags,
          source: input.source,
          confidence: 1,
          userConfirmed: true,
          portraitDelta: 2,
        });
        return jsonResponse({
          ok: true,
          dimension: input.dimension,
          profile_revision: snapshot.profile_revision,
        });
      }

      case "save_card_game": {
        const input = validateSaveCardGameInput(body);
        const { data: snapshot, error } = await db.rpc(
          "save_card_game_and_profile",
          {
            p_kind: input.kind,
            p_final_cards: input.final_cards,
            p_rounds: input.rounds,
            p_accepted: input.accepted,
            p_traded: input.traded,
            p_expected_revision: null,
          },
        );
        if (error) {
          console.error("save card game failed:", error.message);
          throw new HttpError(500, "DATABASE_ERROR", "保存卡牌结果失败。");
        }
        const tags = input.final_cards.map((c) => c.name);
        return jsonResponse({
          ok: true,
          kind: input.kind,
          tags,
          profile_revision: Number(snapshot?.[0]?.profile_revision ?? 0),
        });
      }

      case "save_public_profile": {
        const data = body as Record<string, unknown>;
        const profileData: Record<string, unknown> = { id: user.id };
        const isV2 = data.profile_version === 2;
        if (isV2) profileData.profile_version = 2;
        if (typeof data.name === "string") {
          profileData.name = data.name.slice(0, 50);
        }
        if (typeof data.quote === "string") {
          profileData.quote = data.quote.slice(0, 200);
        }
        if (typeof data.bio === "string") {
          profileData.bio = data.bio.slice(0, 200);
        }
        if (typeof data.avatar_url === "string") {
          profileData.avatar_url = data.avatar_url.slice(0, 500);
        }
        if (Array.isArray(data.tags)) {
          profileData.tags = (data.tags as string[]).slice(0, 10);
        }
        if (Array.isArray(data.trajectory)) {
          profileData.trajectory = data.trajectory;
        }
        if (Array.isArray(data.services)) profileData.services = data.services;
        if (Array.isArray(data.advice)) profileData.advice = data.advice;
        if (typeof data.visibility === "object" && data.visibility !== null) {
          profileData.visibility = data.visibility;
        }
        if (
          isV2 &&
          Number.isInteger(data.hue) &&
          (data.hue as number) >= 0 &&
          (data.hue as number) <= 4
        ) {
          profileData.hue = data.hue;
        }
        if (
          isV2 &&
          Number.isInteger(data.age) &&
          (data.age as number) >= 0 &&
          (data.age as number) <= 150
        ) {
          profileData.age = data.age;
        }
        if (isV2 && typeof data.city === "string") {
          profileData.city = data.city.trim().slice(0, 100);
        }
        if (isV2 && typeof data.from_role === "string") {
          profileData.from_role = data.from_role.trim().slice(0, 100);
        }
        if (isV2 && typeof data.to_role === "string") {
          profileData.to_role = data.to_role.trim().slice(0, 100);
        }
        if (isV2 && typeof data.stage === "string") {
          profileData.stage = data.stage.trim().slice(0, 100);
        }
        if (isV2 && typeof data.result === "string") {
          profileData.result = data.result.trim().slice(0, 200);
        }
        if (isV2 && typeof data.story_intro === "string") {
          profileData.story_intro = data.story_intro.trim().slice(0, 2_000);
        }
        if (isV2 && typeof data.story_full === "string") {
          profileData.story_full = data.story_full.trim().slice(0, 12_000);
        }
        delete profileData.id;
        const { error } = await db.rpc("save_public_profile", {
          p_profile: profileData,
        });
        if (error) {
          console.error("save public profile failed:", error.message);
          throw new HttpError(500, "DATABASE_ERROR", "保存公开资料失败。");
        }
        return jsonResponse({ ok: true });
      }

      case "save_ai_permissions": {
        const permissions = validateAIPermissionsInput(body);
        const expectedRevision = (body as Record<string, unknown>)
          .permission_revision;
        if (
          expectedRevision !== undefined &&
          (!Number.isSafeInteger(expectedRevision) ||
            Number(expectedRevision) < 0)
        ) {
          throw new HttpError(
            400,
            "INVALID_INPUT",
            "permission_revision 无效。",
          );
        }
        const { data: permissionRevision, error } = await db.rpc(
          "replace_profile_ai_permissions",
          {
            p_permissions: permissions,
            p_expected_revision: expectedRevision === undefined
              ? null
              : Number(expectedRevision),
          },
        );
        if (error) {
          if (error.code === "40001") {
            throw new HttpError(
              409,
              "PERMISSION_REVISION_CONFLICT",
              "AI 授权已在其他设备更新，请刷新后重试。",
            );
          }
          console.error("save AI permissions failed:", error.message);
          throw new HttpError(500, "DATABASE_ERROR", "保存 AI 授权失败。");
        }
        return jsonResponse({
          ok: true,
          permission_revision: Number(permissionRevision ?? 0),
        });
      }

      default:
        throw new HttpError(
          400,
          "INVALID_ACTION",
          "action 必须是 save_dimension/save_card_game/save_public_profile/save_ai_permissions 之一。",
        );
    }
  } catch (error) {
    return errorResponse(error, req);
  }
});
