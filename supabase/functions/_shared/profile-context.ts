import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.0";
import { ServerEvent } from "./events.ts";
import {
  type AIPermissions,
  type AIPurpose,
  authorizedFactsContext,
  type AuthorizedProfileContext,
  type ProfileFactForContext,
} from "./profile-permissions.ts";
import { trackEvent } from "./track.ts";

/**
 * 用请求用户的 RLS 客户端读取画像和授权。任一查询失败都 fail closed，
 * 不因个性化上下文故障阻断用户当前主动发起的 AI 请求。
 *
 * 审计只记录用途和维度键，不记录画像值、prompt 或用户原文。
 */
export async function loadAuthorizedProfileContext(
  db: SupabaseClient,
  userId: string,
  purpose: AIPurpose,
): Promise<AuthorizedProfileContext> {
  const [profileResult, factResult, permissionResult] = await Promise.all([
    db.from("profiles")
      .select("profile_revision,permission_revision")
      .eq("id", userId)
      .maybeSingle(),
    db.from("profile_facts")
      .select(
        "id,dimension,value,source,confidence,user_confirmed,sensitivity,support_count",
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .order("user_confirmed", { ascending: false })
      .order("confidence", { ascending: false })
      .order("last_supported_at", { ascending: false }),
    db.from("profile_ai_permissions")
      .select("dimension,purpose,allowed")
      .eq("user_id", userId),
  ]);

  if (profileResult.error || factResult.error || permissionResult.error) {
    console.error(JSON.stringify({
      level: "error",
      event: "profile_ai_context_load_failed",
      purpose,
      profile_error: profileResult.error?.code ?? null,
      fact_error: factResult.error?.code ?? null,
      permission_error: permissionResult.error?.code ?? null,
    }));
    return {
      purpose,
      dimensions: [],
      text: "",
      profileRevision: 0,
      permissionRevision: 0,
      factIds: [],
      facts: [],
    };
  }

  const permissions: AIPermissions = {};
  for (const row of permissionResult.data ?? []) {
    (permissions[row.dimension] ??= {})[row.purpose] = row.allowed;
  }
  const context = authorizedFactsContext(
    (factResult.data ?? []) as ProfileFactForContext[],
    permissions,
    purpose,
    Number(profileResult.data?.profile_revision ?? 0),
    Number(profileResult.data?.permission_revision ?? 0),
  );
  if (context.dimensions.length > 0) {
    trackEvent(userId, ServerEvent.PROFILE_AI_CONTEXT_USED, {
      purpose,
      dimensions: context.dimensions.join(","),
      dimension_count: context.dimensions.length,
      fact_count: context.factIds.length,
      profile_revision: context.profileRevision,
      permission_revision: context.permissionRevision,
    });
  }
  return context;
}
