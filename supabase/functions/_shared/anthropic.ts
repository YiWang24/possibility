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
 * 结构化输出：经工具调用产出，而非网关不可靠的 output_config.format。
 *
 * 诊断实测（ModelBest 网关的 claude-sonnet-5）：原生结构化输出 output_config.format
 * 对稍复杂的请求会退化——simulate/match 挂到 100s 超时，数据密集的 lab-choices 返回
 * 全 placeholder/空串的壳。但网关的工具调用路径工作良好（它甚至会主动注入并调用
 * AskUserQuestion）。因此把 schema 定义成单个工具并强制调用它，读取 tool_use.input
 * 作为结构化结果——走网关可靠的工具路径。
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
  const TOOL_NAME = "emit_result";
  let message;
  try {
    // 超时须明显小于 Edge Function 150s 墙钟，且不重试：SDK 在墙钟内先超时，
    // 才能返回干净 JSON 错误，否则 worker 被平台击杀（546 WORKER_RESOURCE_LIMIT）。
    message = await anthropic().messages.create({
      model: options.model,
      max_tokens: options.maxTokens,
      // 结构化生成不需要思考链（网关的 thinking 会吃光 max_tokens 预算）。
      thinking: { type: "disabled" },
      system: options.system,
      messages: [{ role: "user", content: options.prompt }],
      tools: [{
        name: TOOL_NAME,
        description: "按给定 schema 返回最终结果。必须调用此工具，且只调用它。",
        input_schema: options.schema,
      }],
      // 强制调用我们的工具，压过网关注入的其它工具（AskUserQuestion 等）。
      tool_choice: { type: "tool", name: TOOL_NAME },
    }, { timeout: 100_000, maxRetries: 0 });
  } catch (error) {
    // 带 status 的上游 4xx/5xx 交给 errorResponse 统一映射（429/502）
    if (typeof error === "object" && error !== null && "status" in error) {
      throw error;
    }
    console.error("structuredOutput failed:", error);
    throw new HttpError(
      502,
      "MODEL_OUTPUT_INVALID",
      "AI 生成超时或返回了无法解析的结构，请稍后重试。",
      // TODO(debug): 透出底层失败原因，定位后移除
      {
        stage: "create_throw",
        model: options.model,
        maxTokens: options.maxTokens,
        errName: error instanceof Error ? error.name : typeof error,
        errMessage: error instanceof Error ? error.message : String(error),
      },
    );
  }

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === TOOL_NAME,
  );
  if (!toolUse) {
    throw new HttpError(
      502,
      "MODEL_OUTPUT_INVALID",
      "AI 未按预期返回结构化结果。",
      // TODO(debug): 模型没调用 emit_result 工具，透出停止原因与返回片段，定位后移除
      {
        stage: "no_tool_use",
        model: options.model,
        stopReason: message.stop_reason ?? null,
        rawTextHead: JSON.stringify(message.content)?.slice(0, 600) ?? null,
      },
    );
  }
  return toolUse.input as T;
}
