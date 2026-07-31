"use client";
/* 冷启动登录墙 —— 全部 Edge Function 强制校验 JWT，未登录时任何页面都会大面积 401，
   所以无会话直接全屏拦在这里，而不是让用户进去看一片报错。
   会话过期后的补登录仍走 AuthGate + LoginSheet（弹层形态）。

   为什么不是「先转圈再决定」：会话存在 localStorage，服务端读不到，于是 ready=false
   期间原先只输出一枚色环 —— 线上 HTML 的正文因此只有「正在恢复会话…」六个字，
   首屏一切都得等 JS 下载 + hydrate 之后才开始。
   现在改成两个分支都进 SSR 产物，由 <head> 里的 pre-paint 脚本打的 data-auth 标记
   决定显示哪一个（见 app/layout.tsx 与 globals.css）：
     - 未登录 / 无 JS / 爬虫 → 直接看到完整登录墙，不再是空壳；
     - 已登录 → 直接看到应用外壳，不会闪一下登录页。
   ready 之后 React 接管，按真实会话状态收敛到唯一分支。 */
import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { EmailPasswordForm } from "./EmailPasswordForm";
import { useAuth, useIsAuthenticated } from "@/stores/auth";

export function AuthWall({ children }: { children: ReactNode }) {
  const ready = useAuth((s) => s.ready);
  const isAuthenticated = useIsAuthenticated();

  /* 会话监听 + 恢复既有会话（幂等） */
  useEffect(() => {
    useAuth.getState().init();
  }, []);

  /* 会话恢复完成前：两个分支同时渲染，交给 CSS 按 data-auth 选。
     服务端与 hydrate 期客户端渲染的是同一棵树，不会有 hydration mismatch。 */
  if (!ready) return <SessionRestoreBranches />;
  if (!isAuthenticated) return <LoginWall />;
  return <AppShell>{children}</AppShell>;
}

/** 会话恢复期：把「未登录」与「已登录」两种首屏都放进 HTML，由 data-auth 决定可见性。 */
function SessionRestoreBranches() {
  return (
    <>
      <div data-auth-branch="out">
        <LoginWall />
      </div>
      <div data-auth-branch="in">
        {/* 外壳是静态的，不依赖会话，可以立刻显示；只有内容区留白等数据。 */}
        <AppShell>
          <ContentPlaceholder />
        </AppShell>
      </div>
    </>
  );
}

/** 已登录用户的等待态：外壳已经在了，这里只占住内容区，避免布局跳动。 */
function ContentPlaceholder() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <div className="h-12 w-12 animate-pulse rounded-full bg-aurora opacity-70" />
      <span className="sr-only">正在恢复会话…</span>
    </div>
  );
}

/* 未登录用户的第一屏 —— 也是唯一一屏。原实现是 980px 内容浮在纯黑里，
   1440px 上左右各空 230px，且没用全站的极光底纹，看起来像手机页被居中放大。
   改成主区铺满视口的编辑式分栏：左侧标题吃满尺度，右侧表单卡定宽。 */
function LoginWall() {
  return (
    <main className="screen-bg flex min-h-dvh items-center">
      <div className="shell-gutter mx-auto grid w-full max-w-board grid-cols-1 items-center gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(360px,26rem)] lg:gap-20 lg:py-20 xl:gap-28">
        {/* 品牌头：左对齐 + 竖向极光细线，靠尺度对比而非居中大标题撑场 */}
        <header className="flex flex-col gap-6">
          <div className="flex gap-4 lg:gap-6">
            <span className="mt-1 w-[3px] shrink-0 rounded-chip bg-aurora lg:w-[4px]" aria-hidden />
            <div className="flex flex-col gap-3">
              <p className="text-eyebrow text-faint">POSSIBILITY · 万花筒</p>
              <h1 className="text-[32px] font-bold leading-[1.2] tracking-[0.6px] text-ink lg:text-[clamp(2.4rem,3.4vw,4rem)]">
                认识你自己，
                <br />
                推演你的
                <span className="text-aurora">人生可能性</span>
              </h1>
            </div>
          </div>
          <p className="max-w-[36ch] pl-7 text-[13px] leading-[1.9] text-sub lg:max-w-[48ch] lg:pl-10 lg:text-[15px]">
            画像、推演与社区都绑定在你的账号上。
            用邮箱注册一个可以找回的身份，换设备也能接着往下走。
          </p>
          <p className="hidden max-w-[42ch] border-l border-sub/25 pl-5 font-serif text-[12.5px] leading-[1.9] text-faint lg:ml-10 lg:block">
            <span className="block">离每个人最远的，就是他自己。</span>
            <span className="mt-1 block text-[11px]">——尼采《道德的系谱》</span>
          </p>
        </header>

        {/* 表单卡 */}
        <div className="w-full justify-self-center lg:justify-self-end">
          <div className="kaleido-card p-[22px] lg:p-7">
            <EmailPasswordForm />
          </div>
        </div>
      </div>
    </main>
  );
}
