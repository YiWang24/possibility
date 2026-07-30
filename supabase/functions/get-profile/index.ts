import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { errorResponse, HttpError, jsonResponse } from "../_shared/errors.ts";

/**
 * GET /get-profile
 * Returns authoritative facts, card-game records, the user's private public-page
 * draft, and purpose-scoped AI permissions.
 */
Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const { user, db } = await requireUser(req);

    // Fetch core profile snapshot + monotonic revision.
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("portrait_pct,profile_revision,permission_revision")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("get profile failed:", profileError.message);
      throw new HttpError(500, "DATABASE_ERROR", "读取画像失败。");
    }

    const { data: facts, error: factError } = await db
      .from("profile_facts")
      .select(
        "id,dimension,fact_kind,value,source,source_ref,confidence,user_confirmed,sensitivity,valid_from,valid_to,support_count,observed_at,last_supported_at,updated_at",
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false });
    if (factError) {
      console.error("get profile facts failed:", factError.message);
      throw new HttpError(500, "DATABASE_ERROR", "读取画像事实失败。");
    }

    // Fetch card game results
    const { data: cardGames, error: cgError } = await db
      .from("card_game_results")
      .select("kind,final_cards,rounds,accepted,traded,created_at")
      .eq("user_id", user.id);
    if (cgError) {
      console.error("get card games failed:", cgError.message);
      throw new HttpError(500, "DATABASE_ERROR", "读取卡牌结果失败。");
    }

    // Fetch public profile
    const { data: publicProfile, error: ppError } = await db
      .from("profile_public_drafts")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (ppError) {
      console.error("get public profile failed:", ppError.message);
      throw new HttpError(500, "DATABASE_ERROR", "读取主页草稿失败。");
    }

    // Fetch private AI permissions separately from the publicly readable row.
    const { data: aiPermissions, error: permissionError } = await db
      .from("profile_ai_permissions")
      .select("dimension,purpose,allowed,updated_at")
      .eq("user_id", user.id);
    if (permissionError) {
      console.error("get AI permissions failed:", permissionError.message);
      throw new HttpError(500, "DATABASE_ERROR", "读取 AI 授权失败。");
    }
    const permissionMatrix: Record<string, Record<string, boolean>> = {};
    for (const row of aiPermissions ?? []) {
      (permissionMatrix[row.dimension] ??= {})[row.purpose] = row.allowed;
    }
    const permissionUpdatedAt = (aiPermissions ?? [])
      .map((row) => row.updated_at)
      .filter((value): value is string => typeof value === "string")
      .sort()
      .at(-1) ?? null;

    return jsonResponse({
      portrait_pct: profile?.portrait_pct ?? 0,
      profile_revision: Number(profile?.profile_revision ?? 0),
      facts: facts ?? [],
      card_games: cardGames ?? [],
      public_profile: publicProfile ?? null,
      ai_permissions: {
        permissions: permissionMatrix,
        permission_revision: Number(profile?.permission_revision ?? 0),
        updated_at: permissionUpdatedAt,
      },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
});
