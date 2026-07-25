import Anthropic from "npm:@anthropic-ai/sdk@0.113.0";
import { jsonSchemaOutputFormat } from "npm:@anthropic-ai/sdk@0.113.0/helpers/json-schema";
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

export async function structuredOutput<T>(
  options: {
    model: string;
    maxTokens: number;
    system: string;
    prompt: string;
    schema: { type: "object"; [key: string]: unknown };
  },
): Promise<T> {
  let message;
  try {
    // 超时须明显小于 Edge Function 150s 墙钟：SDK 在墙钟内先超时，
    // 才能返回干净的 JSON 错误；否则 worker 被平台击杀（546 WORKER_RESOURCE_LIMIT）。
    // 同理不重试：一次 100s 超时后已无重试余量。
    message = await anthropic().messages.parse({
      model: options.model,
      max_tokens: options.maxTokens,
      system: options.system,
      messages: [{ role: "user", content: options.prompt }],
      output_config: {
        format: jsonSchemaOutputFormat(options.schema),
      },
    }, { timeout: 100_000, maxRetries: 0 });
  } catch (error) {
    // 带 status 的上游 4xx/5xx 交给 errorResponse 统一映射（429/502）
    if (typeof error === "object" && error !== null && "status" in error) {
      throw error;
    }
    // 无 status 的失败（max_tokens 截断导致 JSON 解析失败、超时等）
    // 落到通用 500 INTERNAL_ERROR 会掩盖真实原因，这里显式归类为上游输出问题。
    console.error("structuredOutput failed:", error);
    throw new HttpError(
      502,
      "MODEL_OUTPUT_INVALID",
      "AI 生成超时或返回了无法解析的结构，请稍后重试。",
    );
  }
  if (!message.parsed_output) {
    throw new HttpError(
      502,
      "MODEL_OUTPUT_INVALID",
      "AI 返回了无法解析的结构。",
    );
  }
  return message.parsed_output as T;
}
