"use client";
import { ToastHost } from "@/components/ui/Toast";
import { AuthGateHost } from "@/components/auth/AuthGate";

/* 全站挂载一次的宿主组件。
   登录墙不在这里 —— 它挂在 (app)/layout.tsx，理由和导航外壳一样：
   落在 (app) 之外的路由（独立落地页、分享页…）不该被主导航和登录墙套住。
   放在根布局还有个实际代价：children 会被一个 client 组件的条件分支挡掉，
   整棵树都进不了 SSR 产物。 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AuthGateHost />
      <ToastHost />
    </>
  );
}
