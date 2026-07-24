import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { errorResponse, HttpError, jsonResponse, readJson } from "../_shared/errors.ts";
import {
  validateSaveCardGameInput,
  validateSaveDimensionInput,
} from "../_shared/validate.ts";

/**
 * POST /save-profile
 * Unified endpoint for saving profile data:
 * - action: "save_dimension" → save a single profile dimension (tags)
 * - action: "save_card_game" → save card game result
 * - action: "save_public_profile" → save public profile data
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
        const { error } = await db.from("profile_dimensions")
          .upsert({
            user_id: user.id,
            dimension: input.dimension,
            tags: input.tags,
            source: input.source,
          }, { onConflict: "user_id,dimension" });
        if (error) {
          console.error("save dimension failed:", error.message);
          throw new HttpError(500, "DATABASE_ERROR", "保存维度失败。");
        }
        // Also update the profiles.dims jsonb for legacy compat
        const dimsUpdate: Record<string, string> = {};
        dimsUpdate[input.dimension] = input.tags.slice(0, 5).join(" · ");
        await db.rpc("apply_profile_update", {
          p_dims: dimsUpdate,
          p_portrait_delta: 2,
        });
        return jsonResponse({ ok: true, dimension: input.dimension });
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
        // Update the relevant dimension in profiles
        const tags = input.final_cards.map((c) => c.name);
        const dimKey = input.kind === "marriage" ? "love" : input.kind;
        const dimsUpdate: Record<string, string> = {};
        dimsUpdate[dimKey] = tags.join(" · ");
        await db.rpc("apply_profile_update", {
          p_dims: dimsUpdate,
          p_portrait_delta: 3,
        });
        return jsonResponse({ ok: true, kind: input.kind, tags });
      }

      case "save_public_profile": {
        const data = body as Record<string, unknown>;
        const profileData: Record<string, unknown> = { id: user.id };
        if (typeof data.name === "string") profileData.name = data.name.slice(0, 50);
        if (typeof data.quote === "string") profileData.quote = data.quote.slice(0, 200);
        if (typeof data.bio === "string") profileData.bio = data.bio.slice(0, 200);
        if (typeof data.avatar_url === "string") profileData.avatar_url = data.avatar_url.slice(0, 500);
        if (Array.isArray(data.tags)) profileData.tags = (data.tags as string[]).slice(0, 10);
        if (Array.isArray(data.trajectory)) profileData.trajectory = data.trajectory;
        if (Array.isArray(data.services)) profileData.services = data.services;
        if (Array.isArray(data.advice)) profileData.advice = data.advice;
        if (typeof data.visibility === "object" && data.visibility !== null) {
          profileData.visibility = data.visibility;
        }
        const { error } = await db.from("public_profiles")
          .upsert(profileData, { onConflict: "id" });
        if (error) {
          console.error("save public profile failed:", error.message);
          throw new HttpError(500, "DATABASE_ERROR", "保存公开资料失败。");
        }
        return jsonResponse({ ok: true });
      }

      default:
        throw new HttpError(
          400,
          "INVALID_ACTION",
          "action 必须是 save_dimension/save_card_game/save_public_profile 之一。",
        );
    }
  } catch (error) {
    return errorResponse(error);
  }
});
