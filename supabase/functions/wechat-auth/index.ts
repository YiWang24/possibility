// POST /wechat-auth — 微信小程序一键登录。
//
// 小程序端没有 Apple 登录，也不该让用户敲邮箱密码（注册转化会很难看），
// 所以走微信的 code2session 换 openid，再由本函数签发 Supabase session。
//
//   小程序 wx.login() 拿 code
//     → 本函数 code2session(AppID + AppSecret) → openid / unionid
//     → service-role 查 / 建用户
//     → admin.generateLink(magiclink) → verifyOtp 换 session
//     → { access_token, refresh_token, expires_in, user }
//
// 为什么 verify_jwt = false：登录**之前**客户端没有任何用户 JWT，与
// card-game-catalog 同类。替代鉴权是微信侧的 code —— 它 5 分钟有效、只能消费一次，
// 且必须持 AppSecret 才能兑换，攻击者拿不到有效 code 就什么也做不了。
//
// 为什么用 generateLink + verifyOtp 而不是给用户派生一个密码：
// 派生密码意味着「知道 openid + 知道派生算法」就能直接登录，等于把 AppSecret 的
// 泄露面扩大到密码算法；而且那个密码必须存在某处或可复算，两种都不好。
// magiclink 的 hashed_token 是一次性的，用完即弃，不留长期凭据。

import { preflightResponse } from "../_shared/cors.ts";
import { errorResponse, HttpError, jsonResponse } from "../_shared/errors.ts";
import { serviceClient } from "../_shared/service.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { validateWechatAuthInput } from "../_shared/validate.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.0";

const CODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session";

/** 微信侧不会把 openid 当密钥，但它是稳定用户标识，不该原样出现在邮箱里。 */
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Code2SessionResult = {
  openid: string;
  unionid?: string;
};

/**
 * 用 code 换 openid。
 *
 * 微信这个接口的坑：**失败也返回 HTTP 200**，错误在 body 的 errcode 里。
 * 只看状态码会把「code 已被消费」当成登录成功，然后拿 undefined 的 openid
 * 去建用户 —— 所以必须显式检查 errcode 和 openid 是否存在。
 */
async function code2Session(code: string): Promise<Code2SessionResult> {
  const url = new URL(CODE2SESSION_URL);
  url.searchParams.set("appid", runtimeConfig.wechatAppId);
  url.searchParams.set("secret", runtimeConfig.wechatAppSecret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error(
      "wechat code2session network failure:",
      error instanceof Error ? error.name : "UNKNOWN",
    );
    throw new HttpError(
      502,
      "WECHAT_UNREACHABLE",
      "微信登录服务暂时不可用，请稍后重试。",
    );
  }

  if (!response.ok) {
    throw new HttpError(
      502,
      "WECHAT_UNREACHABLE",
      "微信登录服务暂时不可用，请稍后重试。",
    );
  }

  const body = await response.json() as {
    openid?: string;
    unionid?: string;
    errcode?: number;
    errmsg?: string;
  };

  // 不把 errmsg 原样透给客户端：它可能回显 appid 等配置信息。日志里留全量，响应里给通用文案。
  if (body.errcode !== undefined && body.errcode !== 0) {
    console.error(
      `wechat code2session errcode=${body.errcode} errmsg=${body.errmsg}`,
    );
    // 40029 = code 无效（已消费/过期/伪造），这是客户端问题，不是我们的故障
    if (body.errcode === 40029) {
      throw new HttpError(
        401,
        "WECHAT_CODE_INVALID",
        "登录凭证已失效，请重试。",
      );
    }
    // 45011 = 频率限制
    if (body.errcode === 45011) {
      throw new HttpError(
        429,
        "WECHAT_RATE_LIMITED",
        "登录过于频繁，请稍后重试。",
      );
    }
    throw new HttpError(
      502,
      "WECHAT_AUTH_FAILED",
      "微信登录失败，请稍后重试。",
    );
  }

  if (!body.openid) {
    console.error("wechat code2session returned no openid");
    throw new HttpError(
      502,
      "WECHAT_AUTH_FAILED",
      "微信登录失败，请稍后重试。",
    );
  }

  return { openid: body.openid, unionid: body.unionid };
}

/**
 * 找到或创建对应的 Supabase 用户，返回其邮箱（后续 generateLink 用）。
 *
 * 用确定性邮箱作为查找键，而不是另建一张 openid → user_id 的映射表：
 * 少一张表、少一次迁移，且 auth.users.email 本身就有唯一约束，天然防并发重复建号。
 */
async function ensureUser(openid: string, unionid?: string): Promise<string> {
  const handle = await sha256Hex(openid);
  const email = `wx_${handle}@miniprogram.local`;

  const { error } = await serviceClient().auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      provider: "wechat_miniprogram",
      wx_openid: openid,
      ...(unionid ? { wx_unionid: unionid } : {}),
    },
  });

  if (error) {
    // 已存在即正常路径（老用户回来了）。GoTrue 对这种情况回 422/已注册，
    // 精确措辞随版本变化，所以按状态码 + 关键词两条一起判，别只匹配文案。
    const alreadyExists = error.status === 422 ||
      /already|exists|registered|duplicate/i.test(error.message);
    if (!alreadyExists) {
      console.error("wechat auth createUser failed:", error.message);
      throw new HttpError(
        500,
        "AUTH_USER_CREATE_FAILED",
        "登录失败，请稍后重试。",
      );
    }
  }

  return email;
}

/** 用 magiclink 的一次性 hashed_token 换一个真实 session。 */
async function issueSession(email: string) {
  const link = await serviceClient().auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) {
    console.error(
      "wechat auth generateLink failed:",
      link.error?.message ?? "NO_TOKEN",
    );
    throw new HttpError(500, "AUTH_LINK_FAILED", "登录失败，请稍后重试。");
  }

  // verifyOtp 必须用 anon 客户端：service-role 客户端不会走用户会话流程，换不到 token。
  const anon = createClient(
    runtimeConfig.supabaseUrl,
    runtimeConfig.supabaseAnonKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const verified = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });

  const session = verified.data?.session;
  if (verified.error || !session) {
    console.error(
      "wechat auth verifyOtp failed:",
      verified.error?.message ?? "NO_SESSION",
    );
    throw new HttpError(500, "AUTH_SESSION_FAILED", "登录失败，请稍后重试。");
  }

  return session;
}

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "仅支持 POST 请求。");
    }

    const { code } = validateWechatAuthInput(
      await req.json().catch(() => null),
    );
    const { openid, unionid } = await code2Session(code);
    const email = await ensureUser(openid, unionid);
    const session = await issueSession(email);

    // 只回客户端确实需要的字段。openid 不回传：小程序端用不到它，
    // 少一处暴露就少一处泄露面。
    return jsonResponse({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      user: { id: session.user.id },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
});
