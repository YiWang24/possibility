// EF-SIMULATE —— 人生实验室推演：3 种未来结局（技术设计文档 §6.3）
import { preflight } from "../_shared/cors.ts";
import { json, fail } from "../_shared/errors.ts";
import { userClient, requireUser } from "../_shared/auth.ts";
import { str, intIn, LIMITS } from "../_shared/validate.ts";
import { MODELS } from "../_shared/anthropic.ts";
import { SYSTEM_SIMULATE } from "../_shared/prompts.ts";
import { SIMULATE_SCHEMA } from "../_shared/schemas.ts";
import { structured } from "../_shared/llm.ts";

interface Scene { title: string; points: string[] }
interface SimResult { scenarios: { general: Scene; optimistic: Scene; cautionary: Scene } }

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== "POST") return fail("method not allowed", 405);

  const supabase = userClient(req);
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized", 401);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("invalid json");
  }
  const question = str(body.question, LIMITS.question);
  const choice = str(body.choice, LIMITS.choice);
  const years = intIn(body.years, 1, 10);
  if (!question || !choice || years === null) {
    return fail("question / choice / years(1-10) required");
  }

  const result = await structured<SimResult>({
    model: MODELS.simulate,
    system: SYSTEM_SIMULATE,
    user: `问题：${question}\n所选路径：${choice}\n推演年限：${years} 年`,
    schema: SIMULATE_SCHEMA,
    effort: "medium",
    max_tokens: 2048,
  });

  const { data, error } = await supabase
    .from("simulations")
    .insert({ user_id: user.id, question, choice, years, scenarios: result.scenarios })
    .select("id")
    .single();
  if (error) return fail("db: " + error.message, 500);

  return json({ id: data.id, scenarios: result.scenarios });
});
