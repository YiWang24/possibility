import { structuredOutput } from "../_shared/llm.ts";
import { requireUser } from "../_shared/auth.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { insertDiaryAnalysis, mergeProfileDimensions } from "../_shared/db.ts";
import { errorResponse, jsonResponse, readJson } from "../_shared/errors.ts";
import { diaryPrompt } from "../_shared/prompts.ts";
import { type DiaryOutput, diarySchema } from "../_shared/schemas.ts";
import { validateDiaryInput } from "../_shared/validate.ts";
import { ServerEvent } from "../_shared/events.ts";
import { trackEvent } from "../_shared/track.ts";

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const input = validateDiaryInput(await readJson(req));
    const { user, db } = await requireUser(req);
    const result = await structuredOutput<DiaryOutput>({
      model: runtimeConfig.diaryModel,
      maxTokens: 1_024,
      system: diaryPrompt,
      prompt: input.transcript,
      schema: diarySchema,
      track: { userId: user.id, feature: "analyze_diary" },
      trace: { name: "analyze-diary", userId: user.id },
    });
    await insertDiaryAnalysis(db, user.id, input.transcript, result);
    await mergeProfileDimensions(db, result.dim_updates);
    // 服务端在日记写库成功后权威上报。iOS 仍发 PostHog / Sentry，但不重复写 app_events。
    // 只记录输入方式和正文长度这个派生值，正文绝不进埋点（§1）。
    trackEvent(user.id, ServerEvent.DIARY_CREATED, {
      input_method: input.inputMethod,
      content_chars: input.transcript.length,
    });

    return jsonResponse({
      emotions: result.emotions,
      keywords: result.keywords,
      dim_updates: Object.fromEntries(
        result.dim_updates.map(({ dimension, value }) => [dimension, value]),
      ),
    });
  } catch (error) {
    return errorResponse(error, req);
  }
});
