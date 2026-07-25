import Anthropic from "npm:@anthropic-ai/sdk@0.113.0";
import { runtimeConfig } from "./config.ts";
import { HttpError } from "./errors.ts";

let instance: Anthropic | undefined;

export function anthropic(): Anthropic {
  instance ??= new Anthropic({
    apiKey: runtimeConfig.anthropicApiKey,
    baseURL: runtimeConfig.anthropicBaseUrl,
    maxRetries: 2,
    // match 的候选旅人提示词较长、simulate 需生成三套完整情景，
    // 经网关的单次结构化生成常超过 45s，须给足余量。
    timeout: 150_000,
  });
  return instance;
}

/**
 * 结构化输出：用「纯文本生成 + 解析 JSON」，而非网关不支持的 output_config.format / 工具调用。
 *
 * 诊断实测（ModelBest 网关 llm-center.modelbest.cn 的 claude-sonnet-5）：这是一个不完整的
 * Anthropic 兼容层——
 *   - output_config.format：稍复杂请求返回全 placeholder/空串的壳，或挂到 100s 超时
 *   - tool_choice 强制调用：不生效，模型直接 end_turn 不调用被强制的工具
 *   - thinking:{type:disabled}：被忽略，响应里仍带 thinking 块
 *   - 整数类工具入参：返回 null
 * 唯一可靠的是纯文本生成（chat 走此路径，一直稳定）。因此把 JSON Schema 放进提示词，
 * 让模型直接产出 JSON 文本，再解析——经典的「原生结构化输出出现前」的做法。
 */
export async function structuredOutput<T>(
  options: {
    model: string;
    maxTokens: number;
    system: string;
    prompt: string;
    schema: { type: "object"; [key: string]: unknown };
  },
): Promise<T> {
  const system = `${options.system}

【严格输出要求】
只输出一个 JSON 对象，且必须匹配下面这份 JSON Schema（字段名、层级、类型都要对齐）：
${JSON.stringify(options.schema)}

不要输出 markdown 代码块标记，不要输出任何解释、前言或结尾文字。直接以 { 开头、以 } 结尾。`;

  // 网关存在间歇性 ~100s 超时（单请求偶发；simulate 的多次调用会放大失败率）。
  // 重试可覆盖这类偶发超时：每次 60s，两次共 120s，留在 Edge Function 150s 墙钟内。
  const maxAttempts = 2;
  const perAttemptTimeout = 60_000;
  let lastDebug: Record<string, unknown> | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let message;
    try {
      message = await anthropic().messages.create({
        model: options.model,
        max_tokens: options.maxTokens,
        thinking: { type: "disabled" }, // 网关会忽略，但按契约传递
        system,
        messages: [{ role: "user", content: options.prompt }],
        // 关键：不带 tools、不带 output_config —— 走网关唯一可靠的纯文本生成路径。
      }, { timeout: perAttemptTimeout, maxRetries: 0 });
    } catch (error) {
      // 带 status 的上游 4xx/5xx 不重试，交给 errorResponse 统一映射（429/502）
      if (typeof error === "object" && error !== null && "status" in error) {
        throw error;
      }
      // 无 status（超时/连接中断）：记录后重试
      console.error(`structuredOutput attempt ${attempt} failed:`, error);
      lastDebug = {
        stage: "create_throw",
        attempt,
        model: options.model,
        errName: error instanceof Error ? error.name : typeof error,
        errMessage: error instanceof Error ? error.message : String(error),
      };
      continue;
    }

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const parsed = extractJson<T>(text);
    if (parsed !== null) return parsed;

    // 解析失败：记录后重试
    lastDebug = {
      stage: "json_parse_failed",
      attempt,
      model: options.model,
      stopReason: message.stop_reason ?? null,
      textHead: text.slice(0, 400),
    };
  }

  throw new HttpError(
    502,
    "MODEL_OUTPUT_INVALID",
    "AI 多次生成均超时或返回了无法解析的结构，请稍后重试。",
    lastDebug, // TODO(debug): 定位后移除
  );
}

/** 从模型文本里稳健提取 JSON：去掉 markdown 围栏，取第一个 { 到最后一个 } 解析。 */
function extractJson<T>(text: string): T | null {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
