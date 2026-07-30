"use client";
/* 登录弹层 —— 移植 iOS LoginSheet.swift（手机验证码两步式：输号码 → 输验证码）。
   移动端为底部全宽 sheet，桌面端为居中 modal。微信/Apple 登录 Web 端暂不提供。 */
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PrimaryButton } from "@/components/ui/Basics";
import { useAuth } from "@/stores/auth";

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String(err.message);
  return String(err);
}

export function LoginSheet({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  /** 用户放弃登录（点背景 / 关闭按钮） */
  onClose: () => void;
  /** 登录成功回调（AuthGate 继续被拦截的动作） */
  onSuccess?: () => void;
}) {
  const sendOtp = useAuth((s) => s.sendOtp);
  const verifyOtp = useAuth((s) => s.verifyOtp);

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length === 11 && phoneDigits.startsWith("1");
  const codeValid = code.replace(/\D/g, "").length === 6;

  /* 每次打开重置到第一步 */
  useEffect(() => {
    if (open) {
      setStep("phone");
      setPhone("");
      setCode("");
      setBusy(false);
      setErrorText(null);
      setCountdown(0);
    }
  }, [open]);

  /* 重发倒计时 */
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const sendCode = useCallback(async () => {
    if (!phoneValid || busy) return;
    setBusy(true);
    setErrorText(null);
    try {
      await sendOtp(phoneDigits);
      setStep("code");
      setCode("");
      setCountdown(60);
    } catch (err) {
      setErrorText(`验证码发送失败：${errMessage(err)}`);
    }
    setBusy(false);
  }, [phoneValid, busy, phoneDigits, sendOtp]);

  const verifyCode = useCallback(async () => {
    if (!codeValid || busy) return;
    setBusy(true);
    setErrorText(null);
    try {
      await verifyOtp(phoneDigits, code.replace(/\D/g, ""));
      setBusy(false);
      onSuccess?.();
    } catch {
      setBusy(false);
      setErrorText("验证码不正确或已过期，请重试");
    }
  }, [codeValid, busy, phoneDigits, code, verifyOtp, onSuccess]);

  const inputClass =
    "w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint";
  const fieldClass =
    "flex items-center gap-2.5 px-3.5 py-[13px] bg-raised rounded-[13px] border border-line";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
          {/* 背景遮罩：点击即放弃登录 */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* 移动全宽 sheet / 桌面居中 modal */}
          <motion.div
            className="relative w-full md:w-[420px] max-h-[85vh] overflow-y-auto no-scrollbar bg-[#10131C] border border-line rounded-t-sheet md:rounded-sheet shadow-[0_18px_50px_rgba(0,0,0,0.7)]"
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 48, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            {/* 拖拽指示条（移动端） */}
            <div className="mx-auto mt-3 h-1 w-10 rounded-chip bg-white/20 md:hidden" />

            <div className="flex flex-col gap-4 px-[22px] pt-6 pb-7">
              {/* 头部 */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1.5">
                  <div className="text-[17px] font-bold text-ink">登录 Possibility</div>
                  <div className="text-[11.5px] text-sub">
                    发布、回应与公开主页需要一个可以找回的账号。
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="关闭"
                  className="shrink-0 w-7 h-7 -mr-1 rounded-chip bg-raised border border-line text-sub text-[13px] leading-none transition active:scale-[0.92]"
                >
                  ✕
                </button>
              </div>

              {step === "phone" ? (
                /* ---- 第一步：手机号 ---- */
                <div className="flex flex-col gap-2.5">
                  <div className="text-[12px] font-semibold text-sub">手机号登录</div>
                  <div className={fieldClass}>
                    <span className="text-[14px] font-semibold text-ink">+86</span>
                    <input
                      className={inputClass}
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={11}
                      placeholder="请输入手机号"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && sendCode()}
                    />
                  </div>
                  {errorText && <div className="text-[11px] text-orange">{errorText}</div>}
                  <PrimaryButton
                    title={busy ? "发送中…" : "获取验证码"}
                    enabled={phoneValid && !busy}
                    onClick={sendCode}
                  />
                </div>
              ) : (
                /* ---- 第二步：验证码 ---- */
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] font-semibold text-sub">
                      验证码已发送至 +86 {phoneDigits}
                    </div>
                    <button
                      className="text-[11.5px] text-brand"
                      onClick={() => {
                        setStep("phone");
                        setCode("");
                        setErrorText(null);
                      }}
                    >
                      换个号码
                    </button>
                  </div>
                  <div className={fieldClass}>
                    <input
                      className={`${inputClass} text-[18px] font-semibold tracking-[6px]`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="6 位验证码"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                    />
                  </div>
                  {errorText && <div className="text-[11px] text-orange">{errorText}</div>}
                  <PrimaryButton
                    title={busy ? "验证中…" : "登录"}
                    enabled={codeValid && !busy}
                    onClick={verifyCode}
                  />
                  <button
                    className={`text-[12px] ${countdown > 0 ? "text-faint" : "text-brand"}`}
                    disabled={countdown > 0 || busy}
                    onClick={sendCode}
                  >
                    {countdown > 0 ? `重新发送（${countdown}s）` : "重新发送"}
                  </button>
                </div>
              )}

              <div className="text-[10.5px] leading-[1.7] text-faint">
                登录即代表同意用户协议与隐私政策。游客数据在登录后自动并入你的账号。
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
