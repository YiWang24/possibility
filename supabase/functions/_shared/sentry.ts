// 服务端错误上报（docs/埋点方案.md Layer 3）。
//
// 为什么手写 envelope 而不是引 @sentry/deno：本项目的 Edge Function 只需要
// 「把未预期的异常送出去」这一件事。官方 SDK 会拉进一整套 integrations 与全局
// 副作用（进程钩子、fetch 包装），在 Deno Edge 的短生命周期 isolate 里收益很小，
// 却给冷启动和依赖锁带来实打实的成本。Envelope 是稳定的公开协议，40 行足够。
//
// 与 track.ts 同一条铁律：绝不影响主流程——无 DSN 静默跳过，上报失败只 console.error。

import { runtimeConfig } from "./config.ts";
import { runInBackground } from "./background.ts";

const MAX_STACK_CHARS = 4_000;

type SentryTarget = { url: string; publicKey: string };

/** 解析 DSN：`https://<publicKey>@<host>/<projectId>` → envelope 端点。 */
function parseDsn(dsn: string): SentryTarget | null {
  try {
    const parsed = new URL(dsn);
    const projectId = parsed.pathname.replace(/^\/+/, "");
    if (!parsed.username || !projectId) return null;
    return {
      url: `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/`,
      publicKey: parsed.username,
    };
  } catch {
    return null;
  }
}

let target: SentryTarget | null | undefined;

function resolveTarget(): SentryTarget | null {
  if (target === undefined) {
    const dsn = runtimeConfig.sentryDsn;
    target = dsn ? parseDsn(dsn) : null;
    if (dsn && !target) console.error("sentry: malformed SENTRY_DSN, disabled");
  }
  return target;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Error.stack 首行通常重复原始 message；丢掉它，避免上游把用户正文塞进异常消息。 */
function privacySafeStack(stack: string | undefined): string {
  if (!stack) return "";
  return truncate(stack.split("\n").slice(1).join("\n"), MAX_STACK_CHARS);
}

/** 上报上下文：requestId 与响应体里的 request_id 一致，用于前后端串联同一次故障。 */
export type CaptureContext = {
  /// 出问题的函数名（chat / match / ...），作为 Sentry 的 transaction 维度。
  transaction: string;
  requestId?: string;
};

/**
 * 上报一个未预期异常。fire-and-forget：立即返回，永不抛错、永不阻塞响应。
 * 未配置 SENTRY_DSN 时直接返回，调用点无需判断。
 */
export function captureException(
  error: unknown,
  context: CaptureContext,
): void {
  try {
    const sentry = resolveTarget();
    if (!sentry) return;

    const eventId = crypto.randomUUID().replace(/-/g, "");
    const err = error instanceof Error ? error : undefined;
    const event = {
      event_id: eventId,
      timestamp: Date.now() / 1_000,
      platform: "javascript",
      level: "error",
      logger: "edge-function",
      environment: runtimeConfig.sentryEnvironment,
      transaction: context.transaction,
      tags: {
        function: context.transaction,
        ...(context.requestId ? { request_id: context.requestId } : {}),
      },
      exception: {
        values: [{
          type: err?.name ?? "UnknownError",
          // 原始 message 可能包含 prompt / transcript。类型 + stack + request_id
          // 足够定位代码路径，正文不值得为可读性冒险外发。
          value: "Unexpected server error",
        }],
      },
      extra: { stack: privacySafeStack(err?.stack) },
    };

    const body = [
      JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
      JSON.stringify({ type: "event" }),
      JSON.stringify(event),
    ].join("\n");

    runInBackground(
      fetch(
        `${sentry.url}?sentry_key=${sentry.publicKey}&sentry_version=7`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-sentry-envelope" },
          body,
        },
      ).then(async (response) => {
        // 必须消费 body，否则 Deno 会报连接泄漏；顺带把 4xx（DSN 失效）暴露出来。
        await response.body?.cancel();
        if (!response.ok) console.error(`sentry: envelope ${response.status}`);
      }),
    );
  } catch (reportError) {
    console.error("sentry: capture failed:", reportError);
  }
}
