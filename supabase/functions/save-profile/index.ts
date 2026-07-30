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
        const confirmed = input.source === "manual" ||
          input.source === "assessment";
        const snapshot = await replaceProfileDimension(db, {
          dimension: input.dimension,
          values: input.tags,
          source: input.source,
          confidence: confirmed ? 1 : 0.7,
          userConfirmed: confirmed,
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
        const { error } = await db.from("card_game_results")
          .upsert({
            user_id: user.id,
            kind: input.kind,
            final_cards: input.final_cards,
            rounds: input.rounds,
            accepted: input.accepted,
            traded: input.traded,
          }, { onConflict: "user_id,kind" });
        if (error) {
          console.error("save card game failed:", error.message);
          throw new HttpError(500, "DATABASE_ERROR", "保存卡牌结果失败。");
        }
        // 卡牌结果与画像事实分开保存；画像 RPC 同步快照、事实来源与 revision。
        const tags = input.final_cards.map((c) => c.name);
        const dimKey = input.kind === "marriage" ? "love" : input.kind;
        const snapshot = await replaceProfileDimension(db, {
          dimension: dimKey,
          values: tags,
          source: "card_game",
          sourceRef: input.kind,
          confidence: 1,
          userConfirmed: true,
          portraitDelta: 3,
        });
        return jsonResponse({
          ok: true,
          kind: input.kind,
          tags,
          profile_revision: snapshot.profile_revision,
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
        const { error } = await db.from("public_profiles")
          .upsert(profileData, { onConflict: "id" });
        if (error) {
          console.error("save public profile failed:", error.message);
          throw new HttpError(500, "DATABASE_ERROR", "保存公开资料失败。");
        }
        return jsonResponse({ ok: true });
      }

      case "save_ai_permissions": {
        const permissions = validateAIPermissionsInput(body);
        const { error } = await db.from("profile_ai_permissions")
          .upsert({
            user_id: user.id,
            permissions,
          }, { onConflict: "user_id" });
        if (error) {
          console.error("save AI permissions failed:", error.message);
          throw new HttpError(500, "DATABASE_ERROR", "保存 AI 授权失败。");
        }
        return jsonResponse({ ok: true });
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
