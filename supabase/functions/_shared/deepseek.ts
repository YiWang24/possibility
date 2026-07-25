import { createDeepSeek } from "@ai-sdk/deepseek";
import { runtimeConfig } from "./config.ts";

// DeepSeek v4（flash/pro）默认开启思考模式（reasoning），会把 max_tokens 预算/时间
// 花在思维链上：流式 textStream 长时间无正文、结构化生成迟迟不返回 → 触发 45s 超时挂起。
//
// 本该用 providerOptions.deepseek.thinking={type:disabled} 关闭，但 @ai-sdk/deepseek@3.0.13
// 不认这个选项（版本过旧），关不掉。实测：raw fetch 带顶层 thinking:{type:disabled} 则
// <1s 正常返回。故在 HTTP 层用自定义 fetch 强制把该字段注入每个请求体，绕开 SDK 版本问题。
const noThinkFetch: typeof fetch = (input, init) => {
  if (init && typeof init.body === "string") {
    try {
      const body = JSON.parse(init.body);
      body.thinking = { type: "disabled" };
      init = { ...init, body: JSON.stringify(body) };
    } catch {
      // 非 JSON 请求体：原样透传
    }
  }
  return fetch(input, init);
};

let provider: ReturnType<typeof createDeepSeek> | undefined;

/** 关闭思考模式的 DeepSeek provider（HTTP 层强制注入 thinking:disabled）。 */
export function deepseekProvider(): ReturnType<typeof createDeepSeek> {
  provider ??= createDeepSeek({
    apiKey: runtimeConfig.deepseekApiKey,
    baseURL: runtimeConfig.deepseekBaseUrl,
    fetch: noThinkFetch,
  });
  return provider;
}
