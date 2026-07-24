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
    timeout: 45_000,
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
  const message = await anthropic().messages.parse({
    model: options.model,
    max_tokens: options.maxTokens,
    system: options.system,
    messages: [{ role: "user", content: options.prompt }],
    output_config: {
      format: jsonSchemaOutputFormat(options.schema),
    },
  });
  if (!message.parsed_output) {
    throw new HttpError(
      502,
      "MODEL_OUTPUT_INVALID",
      "AI 返回了无法解析的结构。",
    );
  }
  return message.parsed_output as T;
}
