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

    // Fetch core profile snapshot + monotonic revision.
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("portrait_pct,dims,profile_revision")
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

    const { data: facts, error: factError } = await db
      .from("profile_facts")
      .select(
        "id,dimension,value,source,source_ref,confidence,user_confirmed,observed_at,updated_at",
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false });
    if (factError) {
      console.error("get profile facts failed:", factError.message);
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

    // Fetch private AI permissions separately from the publicly readable row.
    const { data: aiPermissions, error: permissionError } = await db
      .from("profile_ai_permissions")
      .select("permissions,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (permissionError) {
      console.error("get AI permissions failed:", permissionError.message);
    }

    return jsonResponse({
      portrait_pct: profile?.portrait_pct ?? 0,
      dims: profile?.dims ?? {},
      profile_revision: Number(profile?.profile_revision ?? 0),
      dimensions: dimensions ?? [],
      facts: facts ?? [],
      card_games: cardGames ?? [],
      public_profile: publicProfile ?? null,
      ai_permissions: aiPermissions ?? null,
    });
  } catch (error) {
    return errorResponse(error, req);
  }
});
