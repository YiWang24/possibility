import { structuredOutput } from "../_shared/llm.ts";
import { requireUser } from "../_shared/auth.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, readJson } from "../_shared/errors.ts";
import { labChoicePrompt } from "../_shared/prompts.ts";
import { type LabChoiceOutput, labChoiceSchema } from "../_shared/schemas.ts";
import { validateLabChoiceInput } from "../_shared/validate.ts";
import { insertLabChoiceSet } from "../_shared/db.ts";

/**
 * POST /lab-choices
 * 人生实验室选择卡生成（对应原型 AI_INTEGRATION_PROMPTS.labChoiceCards）。
 * Body: { question, topic?, constraints?, previous_choices? }
 * Resp: { cards: [{id,glyph,title,description,color}], rationale }
 */
Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const input = validateLabChoiceInput(await readJson(req));
    // 鉴权：选择卡基于用户上下文生成，需登录。
    // 读取用户已授权画像作为上下文（RLS 仅本人可见）。
    const { user, db } = await requireUser(req);
    const { data: profile } = await db
      .from("profiles")
      .select("dims")
      .eq("id", user.id)
      .maybeSingle();

    let prompt = `用户正在探索的问题：${input.question}`;
    if (input.topic) prompt += `\n话题：${input.topic}`;
    if (profile?.dims) {
      prompt += `\n已授权画像摘要：${JSON.stringify(profile.dims)}`;
    }
    if (input.constraints && input.constraints.length > 0) {
      prompt += `\n可承受条件/约束：${input.constraints.join("、")}`;
    }
    if (input.previousChoices && input.previousChoices.length > 0) {
      prompt += `\n此前已考虑过的选项：${input.previousChoices.join("、")}`;
    }

    const result = await structuredOutput<LabChoiceOutput>({
      model: runtimeConfig.structuredModel,
      maxTokens: 1_500,
      system: labChoicePrompt,
      prompt,
      schema: labChoiceSchema,
      trace: { name: "lab-choices", userId: user.id },
    });
    await insertLabChoiceSet(db, user.id, input, result);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});
