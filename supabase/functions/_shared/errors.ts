import { corsHeaders } from "./cors.ts";

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

export function errorResponse(error: unknown): Response {
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

  const requestId = crypto.randomUUID();
  console.error(`[${requestId}]`, error);
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
