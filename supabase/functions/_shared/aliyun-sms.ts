// 阿里云短信（Dysmsapi 2017-05-25，RPC 风格签名）。
// 不引官方 SDK：签名只是 HMAC-SHA1 + 规范化 query，直接 fetch 即可，
// 纯函数拆出便于单测（见 tests/auth_functions_test.ts）。

import { HttpError } from "./errors.ts";

/** 阿里云 RPC 签名要求的 percentEncode（RFC 3986：空格→%20、*→%2A、~ 不转义） */
export function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

/** 参数按 key 字典序排序后逐对 percentEncode，拼接为规范化 query */
export function canonicalQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&");
}

/** 待签名字符串：HTTPMethod&percentEncode("/")&percentEncode(canonicalQuery) */
export function stringToSign(method: string, query: string): string {
  return `${method}&${percentEncode("/")}&${percentEncode(query)}`;
}

/** HMAC-SHA1 后 base64（阿里云签名密钥为 AccessKeySecret + "&"） */
export async function hmacSha1Base64(
  key: string,
  data: string,
): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(data),
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * 归一化为阿里云国内短信要求的 11 位手机号。
 * Supabase 存储的 phone 形如 "8613812345678"（无 +）；也兼容 "+86" 前缀。
 * 非中国大陆手机号直接报错 —— 国内短信通道发不出去，尽早失败。
 */
export function normalizeCnPhone(phone: string): string {
  let p = phone.trim();
  if (p.startsWith("+")) {
    // E.164：必须是 +86 —— 不能只去 "+" 再看位数，
    // 否则 +1 333 444 5555 会被误判为 133-3444-5555
    if (!p.startsWith("+86")) {
      throw new HttpError(
        400,
        "UNSUPPORTED_PHONE",
        "目前仅支持中国大陆手机号接收验证码。",
      );
    }
    p = p.slice(3);
  } else if (p.startsWith("86") && p.length === 13) {
    p = p.slice(2); // Supabase 存储格式：无 + 的 E.164
  }
  if (!/^1[3-9]\d{9}$/.test(p)) {
    throw new HttpError(
      400,
      "UNSUPPORTED_PHONE",
      "目前仅支持中国大陆手机号接收验证码。",
    );
  }
  return p;
}

export type AliyunSmsConfig = {
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
};

/**
 * 构造 SendSms 完整请求 URL（GET）。
 * nonce/timestamp 可注入以便单测产出确定性结果。
 */
export async function buildSendSmsUrl(
  config: AliyunSmsConfig,
  phone: string,
  otp: string,
  nonce: string = crypto.randomUUID(),
  timestamp: string = new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
): Promise<string> {
  const params: Record<string, string> = {
    AccessKeyId: config.accessKeyId,
    Action: "SendSms",
    Format: "JSON",
    PhoneNumbers: normalizeCnPhone(phone),
    RegionId: "cn-hangzhou",
    SignName: config.signName,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: nonce,
    SignatureVersion: "1.0",
    TemplateCode: config.templateCode,
    TemplateParam: JSON.stringify({ code: otp }),
    Timestamp: timestamp,
    Version: "2017-05-25",
  };
  const query = canonicalQuery(params);
  const signature = await hmacSha1Base64(
    `${config.accessKeySecret}&`,
    stringToSign("GET", query),
  );
  return `https://dysmsapi.aliyuncs.com/?Signature=${
    percentEncode(signature)
  }&${query}`;
}

/** 发送验证码短信；阿里云业务失败（Code != OK）时抛错 */
export async function sendSms(
  config: AliyunSmsConfig,
  phone: string,
  otp: string,
): Promise<void> {
  const url = await buildSendSmsUrl(config, phone, otp);
  const res = await fetch(url);
  const body = await res.json() as { Code?: string; Message?: string };
  if (!res.ok || body.Code !== "OK") {
    console.error("aliyun sms failed:", body.Code, body.Message);
    throw new HttpError(500, "SMS_SEND_FAILED", "短信发送失败，请稍后重试。");
  }
}
