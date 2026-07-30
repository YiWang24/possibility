import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { errorResponse, HttpError, jsonResponse } from "../_shared/errors.ts";

/**
 * GET /get-profile
 * Returns authoritative facts, card-game records, and the user's private
 * public-page draft.
 */
Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const { user, db } = await requireUser(req);

    // Fetch core profile snapshot + monotonic revision.
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select(
        "portrait_pct,profile_revision,verification_status,verification_provider,verified_at",
      )
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("get profile failed:", profileError.message);
      throw new HttpError(500, "DATABASE_ERROR", "读取画像失败。");
    }

    const { data: facts, error: factError } = await db
      .from("profile_facts")
      .select(
        "id,dimension,fact_kind,value,source,source_ref,confidence,user_confirmed,visibility,sensitivity,valid_from,valid_to,support_count,observed_at,last_supported_at,updated_at",
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

    return jsonResponse({
      portrait_pct: profile?.portrait_pct ?? 0,
      profile_revision: Number(profile?.profile_revision ?? 0),
      verification: {
        status: profile?.verification_status ?? "unverified",
        provider: profile?.verification_provider ?? null,
        verified_at: profile?.verified_at ?? null,
      },
      facts: facts ?? [],
      card_games: cardGames ?? [],
      public_profile: publicProfile ?? null,
    });
  } catch (error) {
    return errorResponse(error, req);
  }
});
