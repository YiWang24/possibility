"use client";
/* 邮箱 + 密码表单 —— 登录墙（AuthWall 全屏）与登录弹层（AuthGate 兜底）共用同一份交互。
   登录 / 注册只切 tab，不换表单：两条路径的字段完全一致，拆成两个页面纯属多余。 */
import { useCallback, useState, type FormEvent } from "react";
import { PrimaryButton } from "@/components/ui/Basics";
import { authErrorMessage, isEmailExistsError, useAuth } from "@/stores/auth";

type Mode = "signin" | "signup";

/** 与 config.toml 的 minimum_password_length 保持一致 */
const MIN_PASSWORD_LENGTH = 6;

export function EmailPasswordForm({ onSuccess }: { onSuccess?: () => void }) {
  const signIn = useAuth((s) => s.signIn);
  const signUp = useAuth((s) => s.signUp);

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [noticeText, setNoticeText] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= MIN_PASSWORD_LENGTH;
  const canSubmit = emailValid && passwordValid && !busy;

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrorText(null);
    setNoticeText(null);
  };

  const submit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      if (!canSubmit) return;
      setBusy(true);
      setErrorText(null);
      setNoticeText(null);
      try {
        if (mode === "signup") {
          const { needsEmailConfirmation } = await signUp(email.trim(), password);
          if (needsEmailConfirmation) {
            // 线上开了确认邮件时才会走到：此时还没有会话，不能当成功继续
            setMode("signin");
            setNoticeText("注册成功，请查收确认邮件并完成验证后登录");
            setBusy(false);
            return;
          }
        } else {
          await signIn(email.trim(), password);
        }
        setBusy(false);
        onSuccess?.();
      } catch (err) {
        setBusy(false);
        // 邮箱已注册：直接把用户送到登录 tab，省掉一次「为什么失败」的猜测
        if (mode === "signup" && isEmailExistsError(err)) {
          setMode("signin");
          setErrorText("该邮箱已注册，请直接登录");
          return;
        }
        setErrorText(authErrorMessage(err));
      }
    },
    [canSubmit, mode, email, password, signIn, signUp, onSuccess],
  );

  const fieldClass =
    "flex items-center gap-2.5 px-3.5 py-[13px] bg-raised rounded-[13px] border border-line focus-within:border-[#6FA5FF]/60 transition-colors";
  const inputClass = "w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint";

  return (
    <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
      {/* 登录 / 注册切换 */}
      <div className="flex gap-[7px]">
        {(
          [
            { key: "signin", label: "登录" },
            { key: "signup", label: "注册" },
          ] as const
        ).map(({ key, label }) => {
          const on = mode === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => switchMode(key)}
              className={`flex-1 rounded-chip border py-[9px] text-[12.5px] transition active:scale-[0.97] ${
                on
                  ? "bg-btn-g border-[#6FA5FF]/60 font-semibold text-white"
                  : "border-line bg-raised text-sub"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2.5">
        <div className={fieldClass}>
          <input
            className={inputClass}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="邮箱地址"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className={fieldClass}>
          <input
            className={inputClass}
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={MIN_PASSWORD_LENGTH}
            placeholder={`密码（至少 ${MIN_PASSWORD_LENGTH} 位）`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
            className="shrink-0 text-[11.5px] text-sub transition active:scale-95"
          >
            {showPassword ? "隐藏" : "显示"}
          </button>
        </div>
      </div>

      {errorText && <div className="text-[11px] text-orange">{errorText}</div>}
      {noticeText && <div className="text-[11px] text-brand">{noticeText}</div>}

      {/* PrimaryButton 内部是裸 <button>，在 form 里默认 type=submit ——
          点击与回车都走同一条 onSubmit，不另挂 onClick 以免一次交互提交两遍 */}
      <PrimaryButton
        title={busy ? (mode === "signup" ? "注册中…" : "登录中…") : mode === "signup" ? "注册并进入" : "登录"}
        enabled={canSubmit}
      />

      <p className="text-[10.5px] leading-[1.7] text-faint">
        {mode === "signup"
          ? "注册即代表同意用户协议与隐私政策。"
          : "登录即代表同意用户协议与隐私政策。"}
      </p>
    </form>
  );
}
