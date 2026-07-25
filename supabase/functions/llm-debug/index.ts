import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/errors.ts";

// 临时诊断：从 Edge Function 内部直连 DeepSeek，测连通性/鉴权/生成耗时。
// 定位「调用不了 llm」根因后删除本函数。

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  const base = runtimeConfig.deepseekBaseUrl;
  let key: string | null = null;
  try {
    key = runtimeConfig.deepseekApiKey;
  } catch {
    key = null;
  }

  async function probe(
    label: string,
    body: Record<string, unknown>,
    timeoutMs = 30_000,
  ) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      return {
        label,
        ms: Date.now() - started,
        status: res.status,
        bodyHead: text.slice(0, 400),
      };
    } catch (e) {
      return {
        label,
        ms: Date.now() - started,
        error: `${(e as Error).name}: ${(e as Error).message}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  const results = [];
  // 1) chat 模型 + 关思考 + 短 prompt（应最快）
  results.push(await probe("chat-model / no-think", {
    model: runtimeConfig.chatModel,
    messages: [{ role: "user", content: "回复一个字：好" }],
    max_tokens: 20,
    thinking: { type: "disabled" },
  }));
  // 2) 结构化模型（pro）+ 关思考
  results.push(await probe("structured-model / no-think", {
    model: runtimeConfig.structuredModel,
    messages: [{ role: "user", content: "回复一个字：好" }],
    max_tokens: 20,
    thinking: { type: "disabled" },
  }));
  // 3) chat 模型 + 不带 thinking 参数（默认开思考，对比耗时）
  results.push(await probe("chat-model / default-think", {
    model: runtimeConfig.chatModel,
    messages: [{ role: "user", content: "回复一个字：好" }],
    max_tokens: 20,
  }));

  return jsonResponse({
    base,
    hasKey: !!key,
    keyPrefix: key ? key.slice(0, 7) : null,
    chatModel: runtimeConfig.chatModel,
    structuredModel: runtimeConfig.structuredModel,
    diaryModel: runtimeConfig.diaryModel,
    results,
  });
});
