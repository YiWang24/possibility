// EF-DIARY —— 语音日记分析：情绪 + 关键词（+画像线索）（技术设计文档 §6.3）
import { preflight } from "../_shared/cors.ts";
import { json, fail } from "../_shared/errors.ts";
import { userClient, requireUser } from "../_shared/auth.ts";
import { str, LIMITS } from "../_shared/validate.ts";
import { MODELS } from "../_shared/anthropic.ts";
import { SYSTEM_DIARY } from "../_shared/prompts.ts";
import { DIARY_SCHEMA } from "../_shared/schemas.ts";
import { structured } from "../_shared/llm.ts";

interface DiaryResult {
  emotions: string[];
  keywords: string[];
  dim_updates: Array<{ dim: string; value: string }>;
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
  const transcript = str(body.transcript, LIMITS.transcript);
  if (!transcript) return fail("transcript required or too long");
  const audioPath = typeof body.audio_path === "string" ? body.audio_path : null;

  const result = await structured<DiaryResult>({
    model: MODELS.diary, // Haiku 4.5：便宜、高频
    system: SYSTEM_DIARY,
    user: transcript,
    schema: DIARY_SCHEMA,
    max_tokens: 512,
  });

  const { data, error } = await supabase
    .from("diary_entries")
    .insert({
      user_id: user.id,
      audio_path: audioPath,
      transcript,
      emotions: result.emotions,
      keywords: result.keywords,
    })
    .select("id")
    .single();
  if (error) return fail("db: " + error.message, 500);

  return json({ id: data.id, ...result });
});
