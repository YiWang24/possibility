import { structuredOutput } from "../_shared/llm.ts";
import { requireUser } from "../_shared/auth.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { insertSimulation } from "../_shared/db.ts";
import { errorResponse, jsonResponse, readJson } from "../_shared/errors.ts";
import { simulationPrompt } from "../_shared/prompts.ts";
import { type SimulationOutput, simulationSchema } from "../_shared/schemas.ts";
import { filterRecommendedTravelerIds } from "../_shared/recommend.ts";
import { validateSimulateInputV2 } from "../_shared/validate.ts";

type TravelerCandidate = {
  id: number;
  name: string;
  quote: string;
  tags: string[];
};

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const input = validateSimulateInputV2(await readJson(req));
    const { user, db } = await requireUser(req);

    // 候选旅人：用于生成「相似旅人推荐」，模型只能从这些 id 中挑选。
    const { data: travelerRows } = await db
      .from("travelers")
      .select("id,name,quote,tags")
      .order("id");
    const candidates = (travelerRows ?? []) as TravelerCandidate[];
    const validIds = new Set(candidates.map(({ id }) => id));

    // 单次生成三套情景 + 底线分析。此前误拆成多次并行调用是基于错误的
    // 「大生成超时」假设——真因是网关不支持 output_config.format（见 anthropic.ts）。
    // 改用纯文本生成后单次调用即可稳定返回，多次调用反而放大网关偶发超时的失败率，
    // 且并行+串行两段各自重试会超出 Edge Function 150s 墙钟。
    let prompt =
      `问题：${input.question}\n选择：${input.choice}\n推演时间跨度：${input.time_horizon}`;
    if (input.carry_cards && input.carry_cards.length > 0) {
      prompt += `\n底线卡（最不能失去的）：${input.carry_cards.join("、")}`;
    }
    prompt += `\n\n候选旅人（recommended_traveler_ids 只能取这些 id）：\n${
      JSON.stringify(candidates)
    }`;

    const result = await structuredOutput<SimulationOutput>({
      model: runtimeConfig.structuredModel,
      maxTokens: 3_000,
      system: simulationPrompt,
      prompt,
      schema: simulationSchema,
    });

    // 过滤模型可能返回的无效/重复 id，保证前端拿到的都是真实旅人。
    result.recommended_traveler_ids = filterRecommendedTravelerIds(
      result.recommended_traveler_ids,
      validIds,
    );

    await insertSimulation(db, user.id, input, result);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});
