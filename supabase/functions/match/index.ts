import { structuredOutput } from "../_shared/llm-lazy.ts";
import { requireUser } from "../_shared/auth.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";
import { matchPrompt } from "../_shared/prompts.ts";
import { type MatchOutput, matchSchema } from "../_shared/schemas.ts";
import { validateMatchInput } from "../_shared/validate.ts";
import { insertMatchResult } from "../_shared/db.ts";
import { ServerEvent } from "../_shared/events.ts";
import { trackEvent } from "../_shared/track.ts";
import { loadProfileContext } from "../_shared/profile-context.ts";

type TravelerForMatch = {
  id: number;
  name: string;
  quote: string;
  bio: string;
  tags: string[];
  dims: unknown;
  trajectory: unknown;
};

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const userState = validateMatchInput(await readJson(req));
    const { user, db } = await requireUser(req);
    // 请求侧先打点：match_requested 是漏斗分母，失败的请求同样要计入，
    // 否则「有多少人走到匹配这一步」会被上游故障系统性低估。
    trackEvent(user.id, ServerEvent.MATCH_REQUESTED);
    const [travelerResult, aiContext] = await Promise.all([
      db.from("travelers")
        .select("id,name,quote,bio,tags,dims,trajectory")
        .order("id"),
      loadProfileContext(db, user.id, "match"),
    ]);
    const { data, error } = travelerResult;
    if (error) {
      console.error("load travelers failed:", error.message);
      throw new HttpError(500, "DATABASE_ERROR", "暂时无法读取旅人资料。");
    }
    const travelers = (data ?? []) as TravelerForMatch[];
    if (travelers.length < 3) {
      throw new HttpError(
        503,
        "INSUFFICIENT_TRAVELERS",
        "可匹配的旅人资料不足。",
      );
    }

    const result = await structuredOutput<MatchOutput>({
      model: runtimeConfig.structuredModel,
      // 关闭 thinking 后预算全部用于 JSON：3 条含中文理由/不适用说明的匹配
      // 约需 1.2k token，给 1536 留足余量（此前 1024 是被 thinking 吃光预算的
      // 错误应对，见 anthropic.ts）。
      maxTokens: 1_536,
      system: matchPrompt,
      prompt: `用户本次明确提交的当前状态：\n${JSON.stringify(userState)}${
        aiContext.text
          ? `\n\n用户另行授权用于本次匹配的长期画像：\n${aiContext.text}`
          : ""
      }\n\n候选旅人（只能使用这些 ID）：\n${JSON.stringify(travelers)}`,
      schema: matchSchema,
      track: { userId: user.id, feature: "match" },
      trace: { name: "match", userId: user.id },
    });

    const validIds = new Set(travelers.map(({ id }) => id));
    const selectedIds = result.matches.map(({ traveler_id }) => traveler_id);
    if (
      result.matches.length !== 3 ||
      new Set(selectedIds).size !== 3 ||
      selectedIds.some((id) => !validIds.has(id))
    ) {
      throw new HttpError(
        502,
        "MODEL_OUTPUT_INVALID",
        "AI 返回了无效的旅人匹配结果。",
      );
    }
    await insertMatchResult(db, user.id, userState, result);
    // 校验通过才算「返回了可用匹配」——上面那些 502 分支不该计入分子。
    trackEvent(user.id, ServerEvent.MATCH_CONDITIONS_READY, {
      candidate_count: result.matches.length,
    });
    return jsonResponse({
      ...result,
      ai_context: {
        purpose: aiContext.purpose,
        dimensions: aiContext.dimensions,
        profile_revision: aiContext.profileRevision,
      },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
});
