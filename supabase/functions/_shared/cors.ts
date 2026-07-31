/**
 * 预检结果缓存时长。supabase-js 每次请求都带 apikey / x-client-info 这类非简单头，
 * 浏览器因此在每个 POST 前先发一次 OPTIONS。不给 Max-Age 就等于把往返翻倍——
 * 线上实测预检本身要 1.2~2.1s（冷 isolate 要先求值整个模块图才轮到 handler）。
 *
 * 24h 是我们的意图值；实际由浏览器封顶（Chrome 2h、Firefox 24h），写大无害。
 */
const PREFLIGHT_MAX_AGE_SECONDS = 86_400;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-request-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
} as const;

/** 预检响应头 = 通用 CORS 头 + Max-Age。Max-Age 只对 OPTIONS 有意义，不污染业务响应。 */
const preflightHeaders = {
  ...corsHeaders,
  "Access-Control-Max-Age": String(PREFLIGHT_MAX_AGE_SECONDS),
} as const;

export function preflightResponse(req: Request): Response | null {
  return req.method === "OPTIONS"
    ? new Response(null, { status: 204, headers: preflightHeaders })
    : null;
}
