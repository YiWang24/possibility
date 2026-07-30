import { structuredOutput } from "../_shared/llm.ts";
import { requireUser } from "../_shared/auth.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";
import { personaPrompt } from "../_shared/prompts.ts";
import { type PersonaOutput, personaSchema } from "../_shared/schemas.ts";
import { fallbackPersona } from "../_shared/persona.ts";
import { validatePersonaInput } from "../_shared/validate.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * POST /persona
 * 动态数字形象异步任务（对应原型 AI_INTEGRATION_PROMPTS.dynamicPersona）。
 * - action=generate：根据已授权画像生成 persona，落库并返回 { job_id, status, persona }
 * - action=status：按 job_id 查询 { job_id, status, persona }
 * 私密维度（public_profiles.visibility 中显式为 false）不会进入 prompt。
 * 离线兜底逻辑见 _shared/persona.ts（纯函数、可单测）。
 */

async function authorizedContext(
  db: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: profile } = await db
    .from("profiles")
    .select("dims")
    .eq("id", userId)
    .maybeSingle();
  const { data: pub } = await db
    .from("public_profiles")
    .select("tags,visibility")
    .eq("id", userId)
    .maybeSingle();

  const dims = (profile?.dims ?? {}) as Record<string, string>;
  const visibility = (pub?.visibility ?? {}) as Record<string, boolean>;
  // 私密维度：visibility 显式为 false 的键不参与生成。
  const authorized = Object.entries(dims)
    .filter(([key]) => visibility[key] !== false)
    .map(([key, value]) => `${key}：${value}`);
  const tags = Array.isArray(pub?.tags) ? (pub!.tags as string[]) : [];
  return [...authorized, ...tags].join(" ");
}

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const input = validatePersonaInput(await readJson(req));
    const { user, db } = await requireUser(req);

    if (input.action === "status") {
      const { data, error } = await db
        .from("persona_jobs")
        .select("id,status,persona,model_version")
        .eq("id", input.jobId!)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        throw new HttpError(500, "DATABASE_ERROR", "读取画像任务失败。");
      }
      if (!data) throw new HttpError(404, "JOB_NOT_FOUND", "画像任务不存在。");
      return jsonResponse({
        job_id: data.id,
        status: data.status,
        persona: data.persona,
        model_version: data.model_version,
      });
    }

    // action === "generate"
    const context = await authorizedContext(db, user.id);
    let persona: PersonaOutput;
    let modelVersion = runtimeConfig.structuredModel;
    try {
      persona = await structuredOutput<PersonaOutput>({
        model: runtimeConfig.structuredModel,
        maxTokens: 512,
        system: personaPrompt,
        prompt: input.promptOverride
          ? `${input.promptOverride}\n\n已授权画像内容：${
            context || "（暂无）"
          }`
          : `已授权画像内容：${context || "（暂无）"}`,
        schema: personaSchema,
        track: { userId: user.id, feature: "persona" },
      });
    } catch (llmError) {
      console.error("persona generation fell back to local:", llmError);
      persona = fallbackPersona(context);
      modelVersion = "fallback";
    }

    const { data, error } = await db
      .from("persona_jobs")
      .insert({
        user_id: user.id,
        status: "completed",
        persona,
        model_version: modelVersion,
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new HttpError(500, "DATABASE_ERROR", "保存画像任务失败。");
    }

    return jsonResponse({
      job_id: data.id,
      status: "completed",
      persona,
      model_version: modelVersion,
    });
  } catch (error) {
    return errorResponse(error, req);
  }
});
