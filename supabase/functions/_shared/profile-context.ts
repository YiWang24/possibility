import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.0";
import { ServerEvent } from "./events.ts";
import {
  type ProfileContext,
  type ProfileContextPurpose,
  type ProfileFactForContext,
  profileFactsContext,
} from "./profile-facts.ts";
import { trackEvent } from "./track.ts";
import { cardGameRunsContext } from "./card-game-context.ts";

/**
 * 用请求用户的 RLS 客户端读取其本人画像。任一查询失败都 fail closed，
 * 不因个性化上下文故障阻断用户当前主动发起的 AI 请求。
 *
 * 审计只记录用途和维度键，不记录画像值、prompt 或用户原文。
 */
export async function loadProfileContext(
  db: SupabaseClient,
  userId: string,
  purpose: ProfileContextPurpose,
): Promise<ProfileContext> {
  const [profileResult, factResult, cardRunResult] = await Promise.all([
    db.from("profiles")
      .select("profile_revision")
      .eq("id", userId)
      .maybeSingle(),
    db.from("profile_facts")
      .select(
        "id,dimension,value,source,confidence,user_confirmed,visibility,sensitivity,support_count",
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .order("user_confirmed", { ascending: false })
      .order("confidence", { ascending: false })
      .order("last_supported_at", { ascending: false }),
    db.from("card_game_runs")
      .select("ai_snapshot,completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(20),
  ]);

  if (profileResult.error || factResult.error) {
    console.error(JSON.stringify({
      level: "error",
      event: "profile_ai_context_load_failed",
      purpose,
      profile_error: profileResult.error?.code ?? null,
      fact_error: factResult.error?.code ?? null,
    }));
    return {
      purpose,
      dimensions: [],
      text: "",
      profileRevision: 0,
      factIds: [],
      facts: [],
    };
  }

  const context = profileFactsContext(
    (factResult.data ?? []) as ProfileFactForContext[],
    purpose,
    Number(profileResult.data?.profile_revision ?? 0),
  );
  const cardContext = cardRunResult.error
    ? { text: "", gameKeys: [] as string[] }
    : cardGameRunsContext(cardRunResult.data ?? []);
  if (cardRunResult.error) {
    console.error(JSON.stringify({
      level: "error",
      event: "card_game_ai_context_load_failed",
      purpose,
      card_game_error: cardRunResult.error.code ?? null,
    }));
  } else if (cardContext.text) {
    context.text = [context.text, cardContext.text].filter(Boolean).join("\n");
  }
  if (context.dimensions.length > 0 || cardContext.gameKeys.length > 0) {
    trackEvent(userId, ServerEvent.PROFILE_AI_CONTEXT_USED, {
      purpose,
      dimensions: context.dimensions.join(","),
      dimension_count: context.dimensions.length,
      fact_count: context.factIds.length,
      profile_revision: context.profileRevision,
      public_fact_count: context.facts.filter((fact) =>
        fact.visibility === "public"
      ).length,
      private_fact_count: context.facts.filter((fact) =>
        fact.visibility === "private"
      ).length,
      card_game_count: cardContext.gameKeys.length,
    });
  }
  return context;
}
