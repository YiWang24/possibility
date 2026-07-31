// 遥测的「是否开启」与类型声明 —— 从 telemetry.ts 里单独劈出来的轻量层。
//
// 为什么劈：telemetry.ts 顶层装配 OTel（@opentelemetry/api + sdk-trace-base +
// context-async-hooks + @langfuse/otel + @langfuse/vercel-ai-sdk + ai），模块一被
// import 就得把这整条链求值一遍。而调用方大多数时候只想问一句「遥测开着吗」——
// 为一个布尔量拖起整个可观测栈，代价全落在冷启动上（连 CORS 预检都要等）。
//
// 这里只读两个环境变量，零依赖。真正需要 span/exporter 的地方再 import telemetry.ts。

/** LLM 调用的 trace 归属信息，由各 Edge Function 传入共享层。 */
export interface LlmTrace {
  /** trace 名称，用 Edge Function 名（如 "chat"、"analyze-diary"），便于筛选。 */
  name: string;
  /** 观测点名称：同一 trace 内有多次 LLM 调用时用它区分（如 "chat-reply"/"chat-signal"），缺省用 name。 */
  callName?: string;
  userId?: string;
  /** 会话分组：chat 用 conversation.id，其余无会话概念可省略。 */
  sessionId?: string;
  metadata?: Record<string, string>;
}

export const telemetryEnabled = Boolean(
  Deno.env.get("LANGFUSE_PUBLIC_KEY") && Deno.env.get("LANGFUSE_SECRET_KEY"),
);
