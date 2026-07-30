"use client";
/* 会话状态 —— 对齐 iOS SupabaseService 的 Auth 职责（技术设计文档 §登录系统）。
   账号体系：邮箱 + 密码（Supabase 原生 signUp / signInWithPassword）。
   匿名游客模式已停用 —— 全部 Edge Function 强制校验 JWT，无会话时由 AuthWall
   全屏拦在登录页，所以不再有「游客态」这一档，只有「已登录 / 未登录」。 */
import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { callFunction, supabase } from "@/lib/supabase";
import { useData } from "./data";

/** Supabase Auth 错误码（err.code）—— 用码判定而非匹配 message 文案 */
function authErrorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** 邮箱已被注册 —— 注册 tab 据此自动切到登录 tab */
export function isEmailExistsError(err: unknown): boolean {
  const code = authErrorCode(err);
  return code === "user_already_exists" || code === "email_exists";
}

/** Supabase Auth 错误 → 用户可读中文提示（未收录的错误码回落原始 message） */
export function authErrorMessage(err: unknown): string {
  switch (authErrorCode(err)) {
    case "user_already_exists":
    case "email_exists":
      return "该邮箱已注册，请直接登录";
    case "invalid_credentials":
      return "邮箱或密码不正确";
    case "weak_password":
      return "密码至少需要 6 位";
    case "validation_failed":
      return "邮箱格式不正确";
    case "email_not_confirmed":
      return "邮箱尚未验证，请查收确认邮件";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "操作过于频繁，请稍后再试";
    default:
      // 429 没有稳定错误码时按限流处理，避免把「太频繁」显示成一串英文
      if (err && typeof err === "object" && (err as { status?: unknown }).status === 429) {
        return "操作过于频繁，请稍后再试";
      }
      return errMessage(err);
  }
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String(err.message);
  return String(err);
}

interface AuthState {
  userId: string | null;
  /** 当前账号邮箱（Me 页展示） */
  email: string | null;
  /** 会话恢复是否完成（成功或失败）—— AuthWall 据此决定 splash 还是登录墙 */
  ready: boolean;
  lastError: string | null;

  /** 启动：订阅 onAuthStateChange + 恢复既有会话（幂等，可多处调用） */
  init: () => void;
  /**
   * 注册。config.toml 关了邮箱确认，正常返回即带 session（注册即登录）；
   * 若线上开启了确认邮件，session 为空 —— 返回标志让 UI 提示查收邮件。
   */
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  /** 退出登录：清空本地缓存 + 清空会话（不再回落匿名，AuthWall 自动接管） */
  signOut: () => Promise<void>;
  /** 注销账号：服务端删除 auth 用户（业务表级联清理）后本地登出 */
  deleteAccount: () => Promise<void>;
}

let initialized = false;

export const useAuth = create<AuthState>()((set, get) => {
  /** 用会话同步本地状态。无会话即真正未登录：userId 必须置空，登录墙依赖它 */
  const syncSession = (session: Session | null) => {
    const user = session?.user ?? null;
    set({ userId: user?.id ?? null, email: user?.email ?? null });
  };

  /** 登录后：同步会话状态并重拉用户侧数据 */
  const refreshAfterAuthChange = async () => {
    const { data } = await supabase().auth.getSession();
    syncSession(data.session);
    await useData.getState().refreshAfterAuthChange();
  };

  return {
    userId: null,
    email: null,
    ready: false,
    lastError: null,

    init() {
      if (initialized) return;
      initialized = true;
      // 监听会话变化（登录 / 换账号 / 登出 / 刷新 token），保持状态与 UI 同步
      supabase().auth.onAuthStateChange((event, session) => {
        if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "TOKEN_REFRESHED"].includes(event)) return;
        syncSession(session);
      });
      supabase()
        .auth.getSession()
        .then(({ data }) => {
          syncSession(data.session);
          set({ ready: true });
        })
        .catch((err) => set({ ready: true, lastError: errMessage(err) }));
    },

    async signUp(email, password) {
      const { data, error } = await supabase().auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) return { needsEmailConfirmation: true };
      await refreshAfterAuthChange();
      return { needsEmailConfirmation: false };
    },

    async signIn(email, password) {
      const { error } = await supabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refreshAfterAuthChange();
    },

    async signOut() {
      try {
        await supabase().auth.signOut();
      } catch {
        /* 忽略登出错误：本地状态无论如何都要清干净 */
      }
      useData.getState().resetUserCaches();
      set({ userId: null, email: null, lastError: null });
    },

    async deleteAccount() {
      await callFunction<{ ok: boolean }>("delete-account", {});
      await get().signOut();
    },
  };
});

/** 是否已登录（派生自 userId，避免与会话状态双份真相） */
export function useIsAuthenticated(): boolean {
  return useAuth((s) => s.userId !== null);
}
