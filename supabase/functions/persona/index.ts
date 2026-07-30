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
import { loadAuthorizedProfileContext } from "../_shared/profile-context.ts";

/**
 * POST /persona
 * 动态数字形象异步任务（对应原型 AI_INTEGRATION_PROMPTS.dynamicPersona）。
 * - action=generate：根据已授权画像生成 persona，落库并返回 { job_id, status, persona }
 * - action=status：按 job_id 查询 { job_id, status, persona }
 * 只有 profile_ai_permissions 中 persona=true 的维度会进入 prompt（默认拒绝）。
 * 离线兜底逻辑见 _shared/persona.ts（纯函数、可单测）。
 */

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
    const aiContext = await loadAuthorizedProfileContext(
      db,
      user.id,
      "persona",
    );
    let persona: PersonaOutput;
    let modelVersion = runtimeConfig.structuredModel;
    try {
      persona = await structuredOutput<PersonaOutput>({
        model: runtimeConfig.structuredModel,
        maxTokens: 512,
        system: personaPrompt,
        prompt: input.promptOverride
          ? `${input.promptOverride}\n\n已授权画像内容：${
            aiContext.text || "（暂无）"
          }`
          : `已授权画像内容：${aiContext.text || "（暂无）"}`,
        schema: personaSchema,
        track: { userId: user.id, feature: "persona" },
        trace: { name: "persona", userId: user.id },
      });
    } catch (llmError) {
      console.error("persona generation fell back to local:", llmError);
      persona = fallbackPersona(aiContext.text);
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
      ai_context: {
        purpose: aiContext.purpose,
        dimensions: aiContext.dimensions,
        profile_revision: aiContext.profileRevision,
        permission_revision: aiContext.permissionRevision,
      },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
});
