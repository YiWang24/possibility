// 结构化输出封装：output_config.format 约束 JSON，返回已解析对象。
import { anthropic } from "./anthropic.ts";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export async function structured<T = unknown>(opts: {
  model: string;
  system: string;
  user: string;
  schema: unknown;
  effort?: Effort;
  max_tokens?: number;
}): Promise<T> {
  const output_config: Record<string, unknown> = {
    format: { type: "json_schema", schema: opts.schema },
  };
  if (opts.effort) output_config.effort = opts.effort;

  // output_config 在部分 SDK 版本尚未进 TS 类型，wire 参数正确，故 cast。
  // deno-lint-ignore no-explicit-any
  const res: any = await anthropic.messages.create({
    model: opts.model,
    max_tokens: opts.max_tokens ?? 2048,
    system: opts.system,
    output_config,
    messages: [{ role: "user", content: opts.user }],
    // deno-lint-ignore no-explicit-any
  } as any);

  // deno-lint-ignore no-explicit-any
  const text = res.content.find((b: any) => b.type === "text")?.text ?? "{}";
  return JSON.parse(text) as T;
}
