import { structuredOutput } from "../_shared/anthropic.ts";
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
    const { db } = await requireUser(req);
    const { data, error } = await db.from("travelers")
      .select("id,name,quote,bio,tags,dims,trajectory")
      .order("id");
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
      // 3 条精炼匹配理由用不到 1k token；上限过大时网关的约束解码
      // 曾出现生成到超时（实测 150s 被平台击杀），压小上限规避。
      maxTokens: 1_024,
      system: matchPrompt,
      prompt: `用户当前状态：\n${
        JSON.stringify(userState)
      }\n\n候选旅人（只能使用这些 ID）：\n${JSON.stringify(travelers)}`,
      schema: matchSchema,
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
        // TODO(debug): 区分「代码层计数校验失败」与「structuredOutput 解析失败」，定位后移除
        {
          stage: "match_count_validation",
          returnedCount: result.matches.length,
          selectedIds,
          validIdSample: [...validIds].slice(0, 8),
        },
      );
    }
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});
