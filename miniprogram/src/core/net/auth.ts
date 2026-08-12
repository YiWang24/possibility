/**
 * 会话管理 —— 对应 iOS `SupabaseService` 的登录部分、Web `web/stores/auth.ts`。
 *
 * 小程序端的登录方式与其他三端都不同：iOS 是邮箱密码 + Apple，Web 是邮箱密码，
 * 小程序走微信一键登录。链路是
 *
 *   wx.login() 拿 code
 *     → POST /functions/v1/wechat-auth  { code }
 *     → 后端 code2session(AppID + AppSecret) 换 openid
 *     → service-role 查/建用户 wx_<openid>
 *     → admin.generateLink(magiclink) → verifyOtp 换 session
 *     → 返回 { access_token, refresh_token, expires_in }
 *
 * AppSecret 只存 Supabase Function Secrets（源头 Doppler），绝不进小程序包 —— 与
 * DEEPSEEK_API_KEY / AZURE_SPEECH_KEY 同一条红线。
 *
 * ⚠️ `openid` 按 AppID 绑定。换 AppID（比如主体从个人变更为个体工商户后重开小程序）
 * 会让已有 openid 全部失效，账号体系要重做 —— 主体必须在上线前定死。
 */

import { SUPABASE_ANON_KEY, authURL, functionURL } from '../config'

const SESSION_KEY = 'possibility_session_v1'
/** 提前 60s 视为过期，避免请求正好卡在过期瞬间 */
const REFRESH_SKEW_MS = 60_000

export interface Session {
  access_token: string
  refresh_token: string
  /** 绝对过期时间戳（ms）。后端给的是 expires_in 秒数，存的时候换算好。 */
  expires_at: number
  user_id: string
}

let cached: Session | null | undefined
/** 同一时刻只允许一个刷新在途，避免并发请求打出多个 refresh */
let refreshing: Promise<Session> | null = null

function readSession(): Session | null {
  if (cached !== undefined) return cached
  try {
    cached = (wx.getStorageSync(SESSION_KEY) as Session) || null
  } catch {
    cached = null
  }
  return cached
}

function writeSession(session: Session | null): void {
  cached = session
  try {
    if (session) wx.setStorageSync(SESSION_KEY, session)
    else wx.removeStorageSync(SESSION_KEY)
  } catch {
    /* 存储失败不阻断本次会话，内存里的 cached 仍可用 */
  }
}

export function currentSession(): Session | null {
  return readSession()
}

export function isSignedIn(): boolean {
  return readSession() !== null
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user?: { id?: string }
}

function toSession(res: TokenResponse, fallbackUserId = ''): Session {
  return {
    access_token: res.access_token,
    refresh_token: res.refresh_token,
    expires_at: Date.now() + res.expires_in * 1000,
    user_id: res.user?.id ?? fallbackUserId,
  }
}

/** 微信一键登录。成功后 session 落本地存储。 */
export function signInWithWeixin(): Promise<Session> {
  return new Promise<Session>((resolve, reject) => {
    wx.login({
      success(loginRes) {
        if (!loginRes.code) {
          reject(new Error('wx.login 未返回 code'))
          return
        }
        wx.request({
          url: functionURL('wechat-auth'),
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
          },
          data: { code: loginRes.code },
          timeout: 30_000,
          success(res) {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`登录失败（${res.statusCode}）`))
              return
            }
            const session = toSession(res.data as TokenResponse)
            writeSession(session)
            resolve(session)
          },
          fail(err) {
            reject(new Error(err.errMsg || '登录请求失败'))
          },
        })
      },
      fail(err) {
        reject(new Error(err.errMsg || 'wx.login 失败'))
      },
    })
  })
}

/** 用 refresh_token 续期。并发调用会合流到同一个在途请求。 */
function refreshSession(session: Session): Promise<Session> {
  if (refreshing) return refreshing

  refreshing = new Promise<Session>((resolve, reject) => {
    wx.request({
      url: authURL('token?grant_type=refresh_token'),
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      data: { refresh_token: session.refresh_token },
      timeout: 30_000,
      success(res) {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          // refresh_token 已失效：清掉本地会话，让调用方把用户带回登录页
          writeSession(null)
          reject(new Error('会话已过期，请重新登录'))
          return
        }
        const next = toSession(res.data as TokenResponse, session.user_id)
        writeSession(next)
        resolve(next)
      },
      fail(err) {
        reject(new Error(err.errMsg || '会话续期失败'))
      },
    })
  }).finally(() => {
    refreshing = null
  })

  return refreshing
}

/**
 * 取当前可用的 access_token，必要时自动续期。
 *
 * 没有会话就直接抛 —— 与 Web 同策略：不静默发无效请求让后端回 401，
 * 而是让 AuthGate 把用户带回登录页。
 */
export async function accessToken(): Promise<string> {
  const session = readSession()
  if (!session) throw new Error('未登录')

  if (Date.now() < session.expires_at - REFRESH_SKEW_MS) {
    return session.access_token
  }
  const next = await refreshSession(session)
  return next.access_token
}

/** 退出登录。换账号时必须调用，否则在途请求会串到上一个账号。 */
export function signOut(): void {
  writeSession(null)
  refreshing = null
}
