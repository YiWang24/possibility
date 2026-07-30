"use client";
/* 冷启动登录墙 —— 全部 Edge Function 强制校验 JWT，未登录时任何页面都会大面积 401，
   所以无会话直接全屏拦在这里，而不是让用户进去看一片报错。
   会话过期后的补登录仍走 AuthGate + LoginSheet（弹层形态）。 */
import { useEffect, type ReactNode } from "react";
import { EmailPasswordForm } from "./EmailPasswordForm";
import { useAuth, useIsAuthenticated } from "@/stores/auth";

export function AuthWall({ children }: { children: ReactNode }) {
  const ready = useAuth((s) => s.ready);
  const isAuthenticated = useIsAuthenticated();

  /* 会话监听 + 恢复既有会话（幂等） */
  useEffect(() => {
    useAuth.getState().init();
  }, []);

  if (!ready) return <Splash />;
  if (!isAuthenticated) return <LoginWall />;
  return <>{children}</>;
}

/** 会话恢复期的过场：只有一枚呼吸的色环，避免闪一下登录页再跳走 */
function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-stage">
      <div className="h-12 w-12 animate-pulse rounded-full bg-aurora opacity-70" />
      <span className="sr-only">正在恢复会话…</span>
    </div>
  );
}

function LoginWall() {
  return (
    <main className="min-h-dvh bg-stage">
      <div className="mx-auto flex min-h-dvh w-full max-w-[980px] flex-col justify-center gap-9 px-[22px] py-14 lg:flex-row lg:items-center lg:gap-16 lg:py-20">
        {/* 品牌头：左对齐 + 竖向极光细线，靠尺度对比而非居中大标题撑场 */}
        <header className="flex flex-1 flex-col gap-5">
          <div className="flex gap-4">
            <span className="mt-1 w-[3px] shrink-0 rounded-chip bg-aurora" aria-hidden />
            <div className="flex flex-col gap-2">
              <p className="text-[11px] tracking-[3.5px] text-faint">POSSIBILITY · 万花筒</p>
              <h1 className="text-[32px] font-bold leading-[1.2] tracking-[0.6px] text-ink lg:text-[38px]">
                认识你自己，
                <br />
                推演你的
                <span className="text-aurora">人生可能性</span>
              </h1>
            </div>
          </div>
          <p className="max-w-[34ch] pl-7 text-[13px] leading-[1.9] text-sub">
            画像、推演与社区都绑定在你的账号上。
            用邮箱注册一个可以找回的身份，换设备也能接着往下走。
          </p>
        </header>

        {/* 表单卡 */}
        <div className="w-full lg:max-w-[380px]">
          <div className="kaleido-card p-[22px]">
            <EmailPasswordForm />
          </div>
        </div>
      </div>
    </main>
  );
}
