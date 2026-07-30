"use client";
/* 登录门控 —— 对齐 iOS AuthGateCenter。冷启动无会话由 AuthWall 全屏拦下，
   所以这里只剩兜底职责：会话中途过期时，关键动作（发悬赏 / 回应悬赏 /
   编辑公开主页 / 解锁付费）前调 require，就地弹 LoginSheet，成功后继续原动作。 */
import { create } from "zustand";
import { LoginSheet } from "./LoginSheet";
import { useAuth, useIsAuthenticated } from "@/stores/auth";

interface AuthGateState {
  showLogin: boolean;
  pendingAction: (() => void) | null;
  /** 未登录（会话过期）则弹登录页并记住待办动作；已登录直接执行 */
  require: (action: () => void) => void;
  /** LoginSheet 登录成功：收起后稍等关闭动画，再继续原动作 */
  loginSucceeded: () => void;
  /** 用户放弃登录：丢弃待办动作 */
  cancelled: () => void;
}

export const useAuthGateStore = create<AuthGateState>()((set, get) => ({
  showLogin: false,
  pendingAction: null,

  require(action) {
    if (useAuth.getState().userId === null) {
      set({ pendingAction: action, showLogin: true });
    } else {
      action();
    }
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
  const isAuthenticated = useIsAuthenticated();
  return { require, isAuthenticated };
}

/** 宿主组件：渲染被门控触发的 LoginSheet（全局挂载一次） */
export function AuthGateHost() {
  const showLogin = useAuthGateStore((s) => s.showLogin);
  const loginSucceeded = useAuthGateStore((s) => s.loginSucceeded);
  const cancelled = useAuthGateStore((s) => s.cancelled);

  return <LoginSheet open={showLogin} onClose={cancelled} onSuccess={loginSucceeded} />;
}
