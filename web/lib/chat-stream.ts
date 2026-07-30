"use client";
import { SUPABASE_ANON_KEY, functionURL } from "./config";
import { jwt } from "./supabase";

/* 探索对话 SSE 客户端 —— 对齐 iOS ChatStreamClient 协议 */

export type ChatConclusion = {
  ready: boolean;
  next_step: "match" | "lab";
  reason: string;
};

export type Crossroads = {
  ready: boolean;
  summary?: string;
  match_query?: Record<string, unknown>;
};

export type ChatStreamDone = {
  conversation_id?: string;
  crossroads?: Crossroads;
  profile_signals?: Record<string, string>;
  conclusion?: ChatConclusion;
  is_enough?: boolean;
  next_actions?: { type: string; label: string }[];
  high_risk?: boolean;
};

export type ChatTurn = { role: string; content: string };

export type ChatRequest = {
  conversation_id?: string;
  topic: string;
  message: string;
  history: ChatTurn[];
};

export class ChatStreamError extends Error {
  code: string;
  requestId?: string;
  constructor(code: string, message: string, requestId?: string) {
    super(message);
    this.code = code;
    this.requestId = requestId;
  }
}

/* 逐行解析 SSE：event: 记录事件名，data: 单行 JSON 即一次完整事件 */
export async function streamChat(
  request: ChatRequest,
  handlers: {
    onToken: (t: string) => void;
    onDone: (done: ChatStreamDone) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  const token = await jwt();

  const res = await fetch(functionURL("chat"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
    signal: handlers.signal,
  });

  // 后端始终在响应头回填 X-Request-ID（见 _shared/errors.ts），用它做关联锚点。
  const requestId = res.headers.get("x-request-id") ?? undefined;

  if (!res.ok || !res.body) {
    throw new ChatStreamError("HTTP_ERROR", `请求失败（${res.status}）`, requestId);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";

  const dispatch = (data: string) => {
    if (!data) return;
    if (event === "done") {
      let done: ChatStreamDone = {};
      try {
        done = JSON.parse(data) as ChatStreamDone;
      } catch {
        /* 与 iOS 一致：done 解码失败按空载荷收尾 */
      }
      handlers.onDone(done);
      return;
    }
    if (event === "error") {
      let code = "STREAM_ERROR";
      let message = "回复中断，请稍后重试。";
      let rid: string | undefined;
      try {
        const err = JSON.parse(data) as {
          error?: { code?: string; message?: string };
          request_id?: string;
        };
        code = err.error?.code ?? code;
        message = err.error?.message ?? message;
        rid = err.request_id;
      } catch {
        /* 保留默认文案 */
      }
      throw new ChatStreamError(code, message, rid ?? requestId);
    }
    try {
      const chunk = JSON.parse(data) as { t?: string };
      if (chunk.t) handlers.onToken(chunk.t);
    } catch {
      /* 非 JSON 行忽略 */
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.replace(/\r$/, "");
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dispatch(line.slice(5).trim());
        event = "message";
      }
    }
  }
}
