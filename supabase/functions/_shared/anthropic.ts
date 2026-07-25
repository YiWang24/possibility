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
      // 网关的 claude-sonnet-5 默认开启 extended thinking，且 thinking token
      // 计入 max_tokens。结构化 JSON 输出不需要思考链：thinking 会吃光预算导致
      // 截断（match 实测 stop_reason=max_tokens 只返回 thinking 块），并显著拉长
      // 生成时间（simulate 实测 100s 超时）。显式关闭，让预算全部用于 JSON。
      thinking: { type: "disabled" },
      // 网关（ModelBest）会向请求注入 agentic 工具（实测 simulate 返回体里
      // 出现 AskUserQuestion 的 tool_use 块，stop_reason=tool_use，未产出 JSON）。
      // 结构化 JSON 生成不该调用任何工具：显式禁用工具调用，让模型直接产出结构化输出。
      // 这也解释 match 的 100s 超时——注入工具 + 结构化输出让网关进入慢路径/循环。
      tool_choice: { type: "none" },
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
      // TODO(debug): 透出底层失败原因（超时/解析/网关），定位后移除
      {
        stage: "parse_throw",
        model: options.model,
        maxTokens: options.maxTokens,
        errName: error instanceof Error ? error.name : typeof error,
        errMessage: error instanceof Error ? error.message : String(error),
      },
    );
  }
  if (!message.parsed_output) {
    throw new HttpError(
      502,
      "MODEL_OUTPUT_INVALID",
      "AI 返回了无法解析的结构。",
      // TODO(debug): 模型返回了但无法解析成 schema，透出停止原因与原文片段，定位后移除
      {
        stage: "no_parsed_output",
        model: options.model,
        stopReason: (message as { stop_reason?: unknown }).stop_reason ?? null,
        rawTextHead: JSON.stringify(
          (message as { content?: unknown }).content,
        )?.slice(0, 600) ?? null,
      },
    );
  }
  return message.parsed_output as T;
}
