import { structuredOutput } from "../_shared/llm.ts";
import { requireUser } from "../_shared/auth.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  insertGeneratedTravelers,
  type InsertedTraveler,
  insertSimulation,
} from "../_shared/db.ts";
import { serviceClient } from "../_shared/service.ts";
import { errorResponse, jsonResponse, readJson } from "../_shared/errors.ts";
import { simulationPrompt, travelerGenPrompt } from "../_shared/prompts.ts";
import {
  type GeneratedTravelersOutput,
  generatedTravelersSchema,
  type SimulationOutput,
  simulationSchema,
} from "../_shared/schemas.ts";
import { filterRecommendedTravelerIds } from "../_shared/recommend.ts";
import { validateSimulateInputV2 } from "../_shared/validate.ts";

type TravelerCandidate = {
  id: number;
  name: string;
  quote: string;
  tags: string[];
};

// 社区旅人总数上限：低于此值时每次推演都实时生成新旅人扩充社区，
// 达到后停止生成、仅从现有池推荐（避免无限增长）。
const TRAVELER_CEILING = 300;

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

    // 社区人不够多时，实时按「问题+选择」生成 2～3 位贴合的旅人。生成与情景推演
    // 都只依赖 question/choice，互不依赖，故并行发起：墙钟 ≈ max(两者) 而非之和，
    // 不显著拖慢推演。生成失败静默兜底（.catch → null），绝不拖垮主推演结果。
    const shouldGenerate = candidates.length < TRAVELER_CEILING;
    let genPrompt =
      `问题：${input.question}\n选择：${input.choice}\n推演时间跨度：${input.time_horizon}`;
    if (input.carry_cards && input.carry_cards.length > 0) {
      genPrompt += `\n底线卡（最不能失去的）：${input.carry_cards.join("、")}`;
    }

    const [result, generated] = await Promise.all([
      structuredOutput<SimulationOutput>({
        model: runtimeConfig.structuredModel,
        maxTokens: 3_000,
        system: simulationPrompt,
        prompt,
        schema: simulationSchema,
      }),
      shouldGenerate
        ? structuredOutput<GeneratedTravelersOutput>({
          model: runtimeConfig.structuredModel,
          maxTokens: 4_000,
          system: travelerGenPrompt,
          prompt: genPrompt,
          schema: generatedTravelersSchema,
        }).catch((error) => {
          console.error("traveler generation failed:", (error as Error).message);
          return null;
        })
        : Promise.resolve(null),
    ]);

    // 生成成功 → 用 service-role 客户端写入共享表（travelers 无面向用户 insert 策略），
    // 拿回完整对象直接作为「类似经验的人」返回前端。写库失败同样静默兜底。
    let recommendedTravelers: InsertedTraveler[] = [];
    if (generated && generated.travelers.length > 0) {
      try {
        recommendedTravelers = await insertGeneratedTravelers(
          serviceClient(),
          generated.travelers,
        );
      } catch (error) {
        console.error(
          "insert generated travelers failed:",
          (error as Error).message,
        );
      }
    }

    // 过滤模型可能返回的无效/重复 id，保证前端拿到的都是真实旅人。
    result.recommended_traveler_ids = filterRecommendedTravelerIds(
      result.recommended_traveler_ids,
      validIds,
    );

    await insertSimulation(db, user.id, input, result);
    // recommended_travelers：本次实时生成并入库的完整旅人对象（前端优先展示）；
    // recommended_traveler_ids 保留做向后兼容与生成失败时的池内兜底。
    return jsonResponse({
      ...result,
      recommended_travelers: recommendedTravelers,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
