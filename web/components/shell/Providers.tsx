"use client";
import { useEffect } from "react";
import { bootstrap } from "@/lib/supabase";
import { ToastHost } from "@/components/ui/Toast";
import { AuthGateHost } from "@/components/auth/AuthGate";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    bootstrap().catch(() => {
      /* 断网时各页面走 demo 兜底 */
    });
  }, []);
  return (
    <>
      {children}
      <AuthGateHost />
      <ToastHost />
    </>
  );
}
