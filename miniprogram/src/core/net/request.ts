/**
 * Edge Function 调用层 —— 对应 iOS `Core/Network/SupabaseService.swift` 的请求部分、
 * Web `web/lib/supabase.ts` 的 `runCall`。
 *
 * 为什么不用 supabase-js：它依赖 `fetch` / WebSocket / localStorage，小程序运行时全没有，
 * 而且体积吃不消 2MB 主包。后端契约（28 个函数、10 套 JSON Schema）本来就定死在
 * `supabase/functions/_shared/schemas.ts`，手写一层薄 REST 客户端反而更可控。
 */

import { SUPABASE_ANON_KEY, functionURL, restURL } from '../config'
import { accessToken } from './auth'

/** 后端错误响应（`_shared/errors.ts` 的统一形状） */
export class ApiError extends Error {
  code: string
  status: number
  requestId?: string

  constructor(code: string, message: string, status: number, requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.requestId = requestId
  }
}

/** 生成 X-Request-ID，用于把客户端失败与后端日志/Sentry 关联起来 */
export function newRequestId(): string {
  const hex = '0123456789abcdef'
  let out = ''
  for (let i = 0; i < 32; i++) {
    out += hex[Math.floor(Math.random() * 16)]
    if (i === 7 || i === 11 || i === 15 || i === 19) out += '-'
  }
  return out
}

interface RawErrorBody {
  error?: { code?: string; message?: string }
  request_id?: string
}

/**
 * 调用一个 Edge Function。全部 POST，头部与 iOS/Web 一致：
 * `apikey` + `Authorization: Bearer` + `Content-Type` + `X-Request-ID`。
 */
export function invokeFunction<T>(
  name: string,
  body?: Record<string, unknown>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const requestId = newRequestId()

    accessToken()
      .then((token) => {
        wx.request({
          url: functionURL(name),
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            'X-Request-ID': requestId,
          },
          data: body ?? {},
          timeout: 60_000,
          success(res) {
            const status = res.statusCode
            if (status >= 200 && status < 300) {
              resolve(res.data as T)
              return
            }
            const raw = (res.data ?? {}) as RawErrorBody
            reject(
              new ApiError(
                raw.error?.code ?? `HTTP_${status}`,
                raw.error?.message ?? `请求失败（${status}）`,
                status,
                raw.request_id ?? requestId,
              ),
            )
          },
          fail(err) {
            reject(new ApiError('NETWORK_ERROR', err.errMsg || '网络异常', 0, requestId))
          },
        })
      })
      .catch(reject)
  })
}

/**
 * PostgREST 直读（仅内容侧公开只读表）。
 *
 * iOS 用 supabase-swift 读 `traveler_details` / `traveler_services`
 * （`SupabaseService.loadTravelerDetail` / `loadServices`），小程序没有 SDK，
 * 但 PostgREST 就是普通 REST 接口 —— supabase-js 底下发的也是同样的请求。
 *
 * 只用于**读**。公开只读表（`travelers` / `traveler_details` / `traveler_services` /
 * `bounties`）不带会话也能读；用户自己的表（`messages` 等）带上 JWT 由 RLS 兜住归属，
 * iOS 的 `loadMessages` 走的就是这条路。
 *
 * **写一律不要走这里**：写路径的输入校验、业务规则与埋点都在 Edge Function 里，
 * 绕过去等于跳过它们。
 *
 * @param query PostgREST 查询串，如 `traveler_id=eq.1&select=*`
 */
export function restSelect<T>(table: string, query: string): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    const requestId = newRequestId()

    // 内容侧是公开可读的，没登录也应该能看（与 card-game-catalog 同思路）。
    // 有会话就带上，没有就只用 anon key。
    accessToken()
      .catch(() => SUPABASE_ANON_KEY)
      .then((token) => {
        wx.request({
          url: `${restURL(table)}?${query}`,
          method: 'GET',
          header: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            'X-Request-ID': requestId,
          },
          timeout: 30_000,
          success(res) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve((res.data ?? []) as T[])
              return
            }
            const raw = (res.data ?? {}) as { message?: string; code?: string }
            reject(
              new ApiError(
                raw.code ?? `HTTP_${res.statusCode}`,
                raw.message ?? `读取 ${table} 失败（${res.statusCode}）`,
                res.statusCode,
                requestId,
              ),
            )
          },
          fail(err) {
            reject(new ApiError('NETWORK_ERROR', err.errMsg || '网络异常', 0, requestId))
          },
        })
      })
      .catch(reject)
  })
}
