// POST /send-sms-hook — Supabase Auth Send SMS Hook（阿里云短信通道）。
//
// 无用户 JWT（config.toml verify_jwt = false），改用 standardwebhooks
// 对称签名校验请求确系 Auth 服务发出（SEND_SMS_HOOK_SECRET）。
// 成功须返回 200 + JSON；失败按 hook 约定返回 {error:{http_code,message}}。

import { Webhook } from "standardwebhooks";
import { sendSms } from "../_shared/aliyun-sms.ts";
import { parseSendSmsHookPayload } from "../_shared/sms-hook.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { HttpError } from "../_shared/errors.ts";

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();

    // 签名校验：secret 形如 v1,whsec_<base64>，Webhook 只吃 base64 部分
    const secret = runtimeConfig.sendSmsHookSecret.replace("v1,whsec_", "");
    try {
      new Webhook(secret).verify(rawBody, Object.fromEntries(req.headers));
    } catch {
      throw new HttpError(401, "INVALID_SIGNATURE", "hook 签名校验失败。");
    }

    const { phone, otp } = parseSendSmsHookPayload(JSON.parse(rawBody));
    await sendSms(
      {
        accessKeyId: runtimeConfig.aliyunSmsAccessKeyId,
        accessKeySecret: runtimeConfig.aliyunSmsAccessKeySecret,
        signName: runtimeConfig.aliyunSmsSignName,
        templateCode: runtimeConfig.aliyunSmsTemplateCode,
      },
      phone,
      otp,
    );

    return new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Auth 会把 message 透传给客户端的 signInWithOTP 报错
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError
      ? error.message
      : "短信发送失败，请稍后重试。";
    if (!(error instanceof HttpError)) console.error("send-sms-hook:", error);
    return new Response(
      JSON.stringify({ error: { http_code: status, message } }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  }
});
