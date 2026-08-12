/**
 * 后端配置 —— 与 iOS `App/AppConfig.swift`、Web `web/lib/config.ts` 同策略。
 *
 * anon key 受 RLS 约束，可公开；真正的密钥（DEEPSEEK_API_KEY / AZURE_SPEECH_KEY /
 * 微信 AppSecret）只存 Supabase Function Secrets，绝不进小程序包。
 *
 * ⚠️ 域名：`*.supabase.co` 未 ICP 备案，不能作为小程序的 request 合法域名。
 * 开发期靠开发者工具「不校验合法域名」跑通；提审前必须把 API_BASE 切到备案域名的
 * 反代网关（反代 SSE 时记得关 proxy_buffering，否则打字机效果会被缓冲吃掉）。
 * 详见 docs/engineering/小程序端开发方案.md §5。
 */

/** 反代网关就位后改这一处即可，其余代码不感知。 */
export const API_BASE = 'https://gxmruqzcyahjlktshpkh.supabase.co'

export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4bXJ1cXpjeWFoamxrdHNocGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NjM3NjMsImV4cCI6MjEwMDQzOTc2M30.ANJKh_D-kh_4yTeE_AfvIExUaLo3S5I0jOvHSOTOQg4'

/** Edge Function 调用地址 */
export function functionURL(name: string): string {
  return `${API_BASE}/functions/v1/${name}`
}

/** Supabase Auth 端点（token 刷新走这里，登录走 wechat-auth 函数） */
export function authURL(path: string): string {
  return `${API_BASE}/auth/v1/${path}`
}

/**
 * PostgREST 端点。内容侧的公开只读表（travelers / traveler_details /
 * traveler_services / bounties）直读走这里 —— iOS 用 supabase-swift 读的就是它，
 * 小程序没有 SDK 但 PostgREST 本身就是 REST，wx.request 直接打即可。
 * 用户侧表不走这条路：那些有 RLS 且大多需要函数层的业务逻辑。
 */
export function restURL(table: string): string {
  return `${API_BASE}/rest/v1/${table}`
}

/** 流式对话需要的最低基础库版本（wx.request 的 enableChunked） */
export const MIN_CHUNKED_LIB_VERSION = '2.20.2'
