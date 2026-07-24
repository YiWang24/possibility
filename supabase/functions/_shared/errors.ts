// 统一 JSON 响应 / 错误封装
import { corsHeaders } from "./cors.ts";

export function json(
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...extra },
  });
}

export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}
