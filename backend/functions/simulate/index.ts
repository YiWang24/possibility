import { structuredOutput } from "../_shared/anthropic.ts";
import { requireUser } from "../_shared/auth.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { insertSimulation } from "../_shared/db.ts";
import { errorResponse, jsonResponse, readJson } from "../_shared/errors.ts";
import { simulationPrompt } from "../_shared/prompts.ts";
import { type SimulationOutput, simulationSchema } from "../_shared/schemas.ts";
import { validateSimulateInput } from "../_shared/validate.ts";

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const input = validateSimulateInput(await readJson(req));
    const { user, db } = await requireUser(req);
    const result = await structuredOutput<SimulationOutput>({
      model: runtimeConfig.structuredModel,
      maxTokens: 3_000,
      system: simulationPrompt,
      prompt:
        `问题：${input.question}\n选择：${input.choice}\n推演年限：${input.years} 年`,
      schema: simulationSchema,
    });
    await insertSimulation(db, user.id, input, result);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});
