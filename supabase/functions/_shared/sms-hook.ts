// Send SMS Hook payload 解析（与网络/密钥无关的纯函数，便于单测）。
// Supabase Auth 触发 hook 时 POST：{ user: { id, phone, ... }, sms: { otp } }

import { HttpError } from "./errors.ts";

export type SendSmsHookPayload = {
  phone: string;
  otp: string;
};

export function parseSendSmsHookPayload(raw: unknown): SendSmsHookPayload {
  if (typeof raw !== "object" || raw === null) {
    throw new HttpError(400, "INVALID_PAYLOAD", "hook payload 必须是对象。");
  }
  const { user, sms } = raw as {
    user?: { phone?: unknown };
    sms?: { otp?: unknown };
  };
  const phone = typeof user?.phone === "string" ? user.phone.trim() : "";
  const otp = typeof sms?.otp === "string" ? sms.otp.trim() : "";
  if (!phone) {
    throw new HttpError(
      400,
      "INVALID_PAYLOAD",
      "hook payload 缺少 user.phone。",
    );
  }
  if (!/^\d{4,10}$/.test(otp)) {
    throw new HttpError(
      400,
      "INVALID_PAYLOAD",
      "hook payload 缺少有效 sms.otp。",
    );
  }
  return { phone, otp };
}
