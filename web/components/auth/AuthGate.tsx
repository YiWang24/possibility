"use client";
/* 登录门控 —— 对齐 iOS AuthGateCenter（游客模式 + 按需登录）。
   关键动作（发悬赏 / 回应悬赏 / 编辑公开主页 / 解锁付费）前调 require：
   游客 → 就地弹 LoginSheet，登录成功后继续原动作；正式用户 → 直接执行。 */
import { useEffect } from "react";
import { create } from "zustand";
import { LoginSheet } from "./LoginSheet";
import { useAuth } from "@/stores/auth";

interface AuthGateState {
  showLogin: boolean;
  pendingAction: (() => void) | null;
  /** 游客则弹登录页并记住待办动作；正式用户直接执行 */
  require: (action: () => void) => void;
  /** 主动打开登录页（Me 页「登录」入口等，无待办动作） */
  openLogin: () => void;
  /** LoginSheet 登录成功：收起后稍等关闭动画，再继续原动作 */
  loginSucceeded: () => void;
  /** 用户放弃登录：丢弃待办动作 */
  cancelled: () => void;
}

export const useAuthGateStore = create<AuthGateState>()((set, get) => ({
  showLogin: false,
  pendingAction: null,

  require(action) {
    if (useAuth.getState().isAnonymous) {
      set({ pendingAction: action, showLogin: true });
    } else {
      action();
    }
  },

  openLogin() {
    set({ pendingAction: null, showLogin: true });
  },

  loginSucceeded() {
    const action = get().pendingAction;
    set({ showLogin: false, pendingAction: null });
    // 稍等 sheet 关闭动画再继续原动作（立即执行会与退场动画互相打架）
    if (action) setTimeout(action, 400);
  },

  cancelled() {
    set({ showLogin: false, pendingAction: null });
  },
}));

/**
 * 登录门控 hook：`const { require } = useAuthGate()`，
 * 关键动作处 `require(() => doSomething())`。
 * 需要页面树中挂载一个 <AuthGateHost />（AppShell / layout 级别挂一次即可）。
 */
export function useAuthGate() {
  const require = useAuthGateStore((s) => s.require);
  const openLogin = useAuthGateStore((s) => s.openLogin);
  const isAnonymous = useAuth((s) => s.isAnonymous);
  return { require, openLogin, isAnonymous };
}

/** 宿主组件：渲染被门控触发的 LoginSheet（全局挂载一次） */
export function AuthGateHost() {
  const showLogin = useAuthGateStore((s) => s.showLogin);
  const loginSucceeded = useAuthGateStore((s) => s.loginSucceeded);
  const cancelled = useAuthGateStore((s) => s.cancelled);

  /* 确保会话监听已建立（幂等） */
  useEffect(() => {
    useAuth.getState().init();
  }, []);

  return <LoginSheet open={showLogin} onClose={cancelled} onSuccess={loginSucceeded} />;
}
