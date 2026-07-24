import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { errorResponse, HttpError, jsonResponse } from "../_shared/errors.ts";

/**
 * GET /get-profile
 * Returns the user's full profile data including dimensions, card game results,
 * and public profile.
 */
Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const { user, db } = await requireUser(req);

    // Fetch core profile (portrait_pct + dims)
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("portrait_pct,dims")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("get profile failed:", profileError.message);
      throw new HttpError(500, "DATABASE_ERROR", "读取画像失败。");
    }

    // Fetch dimension details
    const { data: dimensions, error: dimError } = await db
      .from("profile_dimensions")
      .select("dimension,tags,source,updated_at")
      .eq("user_id", user.id);
    if (dimError) {
      console.error("get dimensions failed:", dimError.message);
    }

    // Fetch card game results
    const { data: cardGames, error: cgError } = await db
      .from("card_game_results")
      .select("kind,final_cards,rounds,accepted,traded,created_at")
      .eq("user_id", user.id);
    if (cgError) {
      console.error("get card games failed:", cgError.message);
    }

    // Fetch public profile
    const { data: publicProfile, error: ppError } = await db
      .from("public_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (ppError) {
      console.error("get public profile failed:", ppError.message);
    }

    return jsonResponse({
      portrait_pct: profile?.portrait_pct ?? 0,
      dims: profile?.dims ?? {},
      dimensions: dimensions ?? [],
      card_games: cardGames ?? [],
      public_profile: publicProfile ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
