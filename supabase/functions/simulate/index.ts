import { structuredOutput } from "../_shared/anthropic.ts";
import { requireUser } from "../_shared/auth.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { insertSimulation } from "../_shared/db.ts";
import { errorResponse, jsonResponse, readJson } from "../_shared/errors.ts";
import {
  bottomLinePrompt,
  scenarioPrompt,
  type ScenarioTone,
} from "../_shared/prompts.ts";
import {
  type BottomLineOutput,
  bottomLineSchema,
  type ScenarioOutput,
  scenarioSchema,
  type SimulationOutput,
} from "../_shared/schemas.ts";
import { filterRecommendedTravelerIds } from "../_shared/recommend.ts";
import { validateSimulateInputV2 } from "../_shared/validate.ts";

type TravelerCandidate = {
  id: number;
  name: string;
  quote: string;
  tags: string[];
};

const tones: ScenarioTone[] = ["general", "optimistic", "cautionary"];

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

    let base =
      `问题：${input.question}\n选择：${input.choice}\n推演时间跨度：${input.time_horizon}`;
    if (input.carry_cards && input.carry_cards.length > 0) {
      base += `\n底线卡（最不能失去的）：${input.carry_cards.join("、")}`;
    }

    // 拆为三个并行的单情景生成，各自输出小、易稳定返回；底线分析串行第二段。
    // （根因是网关模型的 thinking 吃预算导致超时，已在 anthropic.ts 关闭；
    // 拆分同时降低单请求体量，作为纵深冗余保留。）
    const [general, optimistic, cautionary] = await Promise.all(
      tones.map((tone) =>
        structuredOutput<ScenarioOutput>({
          model: runtimeConfig.structuredModel,
          maxTokens: 1_200,
          system: scenarioPrompt(tone),
          prompt: base,
          schema: scenarioSchema,
        })
      ),
    );
    const scenarios = { general, optimistic, cautionary };

    // 底线分析要综合三种情景，串行第二段：只带情景摘要，保持小请求。
    const digest = tones
      .map((tone) => {
        const s = scenarios[tone];
        return `【${tone}】${s.headline}｜代价：${
          s.costs.join("；")
        }｜前提：${s.key_condition}`;
      })
      .join("\n");
    const bottom = await structuredOutput<BottomLineOutput>({
      model: runtimeConfig.structuredModel,
      maxTokens: 800,
      system: bottomLinePrompt,
      prompt:
        `${base}\n\n三种情景摘要：\n${digest}\n\n候选旅人（recommended_traveler_ids 只能取这些 id）：\n${
          JSON.stringify(candidates)
        }`,
      schema: bottomLineSchema,
    });

    const result: SimulationOutput = {
      scenarios,
      bottom_line_analysis: bottom.bottom_line_analysis,
      // 过滤模型可能返回的无效/重复 id，保证前端拿到的都是真实旅人。
      recommended_traveler_ids: filterRecommendedTravelerIds(
        bottom.recommended_traveler_ids,
        validIds,
      ),
    };

    await insertSimulation(db, user.id, input, result);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});
