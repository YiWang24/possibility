import { corsHeaders } from "./cors.ts";
import { captureException } from "./sentry.ts";

/// 从请求 URL 推出函数名（Edge Function 的路径首段就是函数名），作为 Sentry 的
/// transaction 维度。拿不到时退回统称——错误上报不该因为解析失败而丢失。
function transactionOf(req?: Request): string {
  if (!req) return "edge-function";
  try {
    return new URL(req.url).pathname.split("/").filter(Boolean)[0] ??
      "edge-function";
  } catch {
    return "edge-function";
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// req 可选：传入后 Sentry 事件带上函数名维度。不传仍能上报，只是少一个分组维度。
export function errorResponse(error: unknown, req?: Request): Response {
  if (error instanceof HttpError) {
    return jsonResponse(
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  }

  if (typeof error === "object" && error !== null && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    if (status === 429) {
      return jsonResponse(
        {
          error: {
            code: "RATE_LIMITED",
            message: "请求过于频繁，请稍后重试。",
          },
        },
        429,
      );
    }
    // 上游（Anthropic）非 429 的 4xx/5xx 统一映射为 502：
    // 4xx 多为网关配置/凭证问题（400/401/403 等），对客户端同样是「上游不可用」，
    // 与自身代码缺陷的 500 INTERNAL_ERROR 区分开，便于运维定位。
    if (Number.isFinite(status) && status >= 400) {
      return jsonResponse(
        {
          error: {
            code: "MODEL_UPSTREAM_ERROR",
            message: "AI 服务暂时不可用，请稍后重试。",
          },
        },
        502,
      );
    }
  }

  // 走到这里的都是「没被预期到」的异常——也就是真正的代码缺陷，正是 Sentry 该收的。
  // 上面几类（HttpError、上游 4xx/5xx）是已知业务分支，送进去只会淹没告警。
  // request_id 与响应体里的一致，前端报错截图能直接定位到这条 Sentry 事件。
  const requestId = crypto.randomUUID();
  console.error(`[${requestId}]`, error);
  captureException(error, {
    transaction: transactionOf(req),
    requestId,
  });
  return jsonResponse(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "服务暂时不可用，请稍后重试。",
        request_id: requestId,
      },
    },
    500,
  );
}

export async function readJson(req: Request): Promise<unknown> {
  if (req.method !== "POST") {
    throw new HttpError(405, "METHOD_NOT_ALLOWED", "仅支持 POST 请求。");
  }
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "请求体必须是 JSON。");
  }
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "请求体不是有效 JSON。");
  }
}
