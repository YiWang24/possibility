// EF-MATCH —— 经验匹配：3 位结局不同旅人 + 可解释理由（技术设计文档 §6.2）
import { preflight } from "../_shared/cors.ts";
import { json, fail } from "../_shared/errors.ts";
import { userClient, requireUser } from "../_shared/auth.ts";
import { MODELS } from "../_shared/anthropic.ts";
import { SYSTEM_MATCH } from "../_shared/prompts.ts";
import { MATCH_SCHEMA } from "../_shared/schemas.ts";
import { structured } from "../_shared/llm.ts";

interface MatchResult {
  matches: Array<{ traveler_id: number; reason: string; not_applicable: string }>;
}

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
  const userState = body.user_state ?? body.crossroads ?? {};

  // 旅人语料（公开只读；黑客松阶段全量拼进 prompt，语料变大再上 pgvector）
  const { data: travelers, error } = await supabase
    .from("travelers")
    .select("id,name,bio,quote,tags,dims,trajectory,is_similar");
  if (error) return fail("db: " + error.message, 500);

  const prompt =
    `用户当前状态（岔路口 + 画像信号）：\n${JSON.stringify(userState)}\n\n` +
    `可选真实旅人语料：\n${JSON.stringify(travelers)}\n\n` +
    `请精选 3 位结局不同的旅人并解释匹配。traveler_id 必须来自语料。`;

  const result = await structured<MatchResult>({
    model: MODELS.match,
    system: SYSTEM_MATCH,
    user: prompt,
    schema: MATCH_SCHEMA,
    effort: "high",
    max_tokens: 2048,
  });

  return json(result);
});
