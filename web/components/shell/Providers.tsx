"use client";
import { ToastHost } from "@/components/ui/Toast";
import { AuthGateHost } from "@/components/auth/AuthGate";
import { AuthWall } from "@/components/auth/AuthWall";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 全站 client 组件 + localStorage 会话，登录墙在客户端拦即可，无需 middleware */}
      <AuthWall>{children}</AuthWall>
      <AuthGateHost />
      <ToastHost />
    </>
  );
}
