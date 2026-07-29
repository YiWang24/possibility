// 登录系统后端纯函数单测：阿里云短信签名 / hook payload 解析。
// merge-anonymous 的迁移逻辑在 0016 迁移的 SQL 函数内（事务性），
// 其入参校验路径（非匿名 token、缺参）为集成测试范畴，见技术设计文档。

import { HttpError } from "../_shared/errors.ts";
import {
  buildSendSmsUrl,
  canonicalQuery,
  hmacSha1Base64,
  normalizeCnPhone,
  percentEncode,
  stringToSign,
} from "../_shared/aliyun-sms.ts";
import { parseSendSmsHookPayload } from "../_shared/sms-hook.ts";

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertHttpError(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error(`expected HttpError ${code}`);
  } catch (error) {
    assert(error instanceof HttpError, "expected HttpError");
    assert(error.code === code, `expected ${code}, got ${error.code}`);
  }
}

// ==================== percentEncode（阿里云 RFC 3986 变体） ====================

Deno.test("percentEncode follows aliyun rules", () => {
  assert(percentEncode("a b") === "a%20b", "space → %20");
  assert(percentEncode("a*b") === "a%2Ab", "* → %2A");
  assert(percentEncode("a~b") === "a~b", "~ 不转义");
  assert(percentEncode("a/b:c=d&e") === "a%2Fb%3Ac%3Dd%26e");
  assert(
    percentEncode('{"code":"123456"}') === "%7B%22code%22%3A%22123456%22%7D",
  );
});

Deno.test("canonicalQuery sorts keys and encodes pairs", () => {
  const query = canonicalQuery({ b: "2", a: "1", C: "3 " });
  // 大写字母 ASCII 序在小写之前
  assert(query === "C=3%20&a=1&b=2", query);
});

Deno.test("stringToSign builds aliyun RPC format", () => {
  const sts = stringToSign("GET", "a=1&b=2");
  assert(sts === "GET&%2F&a%3D1%26b%3D2", sts);
});

// ==================== HMAC-SHA1（RFC 2202 已知向量） ====================

Deno.test("hmacSha1Base64 matches known test vector", async () => {
  const sig = await hmacSha1Base64(
    "key",
    "The quick brown fox jumps over the lazy dog",
  );
  assert(sig === "3nybhbi3iqa8ino29wqQcBydtNk=", sig);
});

// ==================== 手机号归一化 ====================

Deno.test("normalizeCnPhone accepts supabase/E.164/bare formats", () => {
  assert(normalizeCnPhone("8613812345678") === "13812345678");
  assert(normalizeCnPhone("+8613812345678") === "13812345678");
  assert(normalizeCnPhone("13812345678") === "13812345678");
  assert(normalizeCnPhone(" 13812345678 ") === "13812345678");
});

Deno.test("normalizeCnPhone rejects non-CN numbers", () => {
  assertHttpError(() => normalizeCnPhone("+13334445555"), "UNSUPPORTED_PHONE");
  assertHttpError(() => normalizeCnPhone("12345"), "UNSUPPORTED_PHONE");
  assertHttpError(() => normalizeCnPhone(""), "UNSUPPORTED_PHONE");
});

// ==================== SendSms URL（注入 nonce/timestamp 保证确定性） ====================

Deno.test("buildSendSmsUrl is deterministic and well-formed", async () => {
  const config = {
    accessKeyId: "testid",
    accessKeySecret: "testsecret",
    signName: "万花筒",
    templateCode: "SMS_123456",
  };
  const url1 = await buildSendSmsUrl(
    config,
    "8613812345678",
    "654321",
    "fixed-nonce",
    "2026-07-28T00:00:00Z",
  );
  const url2 = await buildSendSmsUrl(
    config,
    "+8613812345678",
    "654321",
    "fixed-nonce",
    "2026-07-28T00:00:00Z",
  );
  assert(url1 === url2, "同一入参（不同手机号写法）应产出相同 URL");

  const parsed = new URL(url1);
  assert(parsed.origin === "https://dysmsapi.aliyuncs.com");
  assert(parsed.searchParams.get("Action") === "SendSms");
  assert(parsed.searchParams.get("PhoneNumbers") === "13812345678");
  assert(parsed.searchParams.get("TemplateParam") === '{"code":"654321"}');
  assert(parsed.searchParams.get("SignatureMethod") === "HMAC-SHA1");
  const signature = parsed.searchParams.get("Signature") ?? "";
  // HMAC-SHA1 → 20 字节 → base64 恒为 28 字符（含填充）
  assert(atob(signature).length === 20, "签名应为 20 字节 HMAC-SHA1");
});

// ==================== Send SMS Hook payload ====================

Deno.test("parseSendSmsHookPayload extracts phone and otp", () => {
  const { phone, otp } = parseSendSmsHookPayload({
    user: { id: "u1", phone: "8613812345678" },
    sms: { otp: "123456" },
  });
  assert(phone === "8613812345678");
  assert(otp === "123456");
});

Deno.test("parseSendSmsHookPayload rejects malformed payloads", () => {
  assertHttpError(() => parseSendSmsHookPayload(null), "INVALID_PAYLOAD");
  assertHttpError(() => parseSendSmsHookPayload("{}"), "INVALID_PAYLOAD");
  assertHttpError(
    () =>
      parseSendSmsHookPayload({ user: { phone: "" }, sms: { otp: "123456" } }),
    "INVALID_PAYLOAD",
  );
  assertHttpError(
    () =>
      parseSendSmsHookPayload({ user: { phone: "8613812345678" }, sms: {} }),
    "INVALID_PAYLOAD",
  );
  assertHttpError(
    () =>
      parseSendSmsHookPayload({
        user: { phone: "8613812345678" },
        sms: { otp: "abc123" },
      }),
    "INVALID_PAYLOAD",
  );
});
