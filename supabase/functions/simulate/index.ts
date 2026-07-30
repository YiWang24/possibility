import { structuredOutput } from "../_shared/llm.ts";
import { requireUser } from "../_shared/auth.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { insertGeneratedTravelers, insertSimulation } from "../_shared/db.ts";
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

// Supabase Edge Functions 的后台任务 API：响应返回后仍保持 isolate 存活，
// 直到传入的 promise 结束（受 150s 墙钟约束）。类型未随 Deno 内置，故此处声明。
declare const EdgeRuntime:
  | { waitUntil(promise: Promise<unknown>): void }
  | undefined;

// 非关键任务放到响应之后跑：优先用 EdgeRuntime.waitUntil 保活；
// 运行时不支持时退化为 fire-and-forget（尽力而为，不阻塞、不抛错）。
function runInBackground(task: Promise<unknown>): void {
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(task);
  } else {
    void task;
  }
}

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

    // 关键路径只等情景推演本身。原先旅人生成与推演并行 await（Promise.all），
    // 墙钟 = max(两者)，次要的社区扩容生成会拖慢用户拿到结果的时间；实测整体
    // 40~48s。现改为：推演用低延迟的 chat(flash) 模型单独 await，旅人生成移到
    // 响应之后的后台任务（见下），不再 gate 结果。
    const result = await structuredOutput<SimulationOutput>({
      model: runtimeConfig.chatModel,
      maxTokens: 3_000,
      system: simulationPrompt,
      prompt,
      schema: simulationSchema,
      trace: {
        name: "simulate",
        userId: user.id,
        metadata: { time_horizon: input.time_horizon },
      },
    });

    // 过滤模型可能返回的无效/重复 id，保证前端拿到的都是真实旅人。
    result.recommended_traveler_ids = filterRecommendedTravelerIds(
      result.recommended_traveler_ids,
      validIds,
    );

    await insertSimulation(db, user.id, input, result);

    // 社区人不够多时，实时按「问题+选择」生成 2～3 位贴合的旅人扩充社区池。
    // 这属于次要内容，且不影响本次推演结果（前端在 recommended_travelers 为空时
    // 会用 recommended_traveler_ids 从已有池回退展示），故整段移到响应之后的
    // 后台任务：生成 + 写库全部失败静默兜底，绝不拖慢或拖垮主推演。
    if (candidates.length < TRAVELER_CEILING) {
      let genPrompt =
        `问题：${input.question}\n选择：${input.choice}\n推演时间跨度：${input.time_horizon}`;
      if (input.carry_cards && input.carry_cards.length > 0) {
        genPrompt += `\n底线卡（最不能失去的）：${
          input.carry_cards.join("、")
        }`;
      }
      runInBackground(
        structuredOutput<GeneratedTravelersOutput>({
          model: runtimeConfig.structuredModel,
          maxTokens: 4_000,
          system: travelerGenPrompt,
          prompt: genPrompt,
          schema: generatedTravelersSchema,
          trace: { name: "simulate-traveler-gen", userId: user.id },
        })
          .then((generated) =>
            generated && generated.travelers.length > 0
              ? insertGeneratedTravelers(serviceClient(), generated.travelers)
              : null
          )
          .catch((error) => {
            console.error(
              "background traveler generation/insert failed:",
              (error as Error).message,
            );
          }),
      );
    }

    // recommended_travelers 现固定为空（旅人生成已后台化）：前端据此回退到用
    // recommended_traveler_ids 从池内解析。保留该字段以兼容旧前端解码。
    return jsonResponse({
      ...result,
      recommended_travelers: [],
    });
  } catch (error) {
    return errorResponse(error);
  }
});
