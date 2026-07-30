"use client";
/* 会话状态 —— 对齐 iOS SupabaseService 的 Auth 职责（技术设计文档 §登录系统）。
   手机验证码流向：匿名转正（updateUser 原地链接，user_id 不变）或既有账号登录
   （verifyOtp type=sms，成功后经 merge-anonymous 迁移匿名数据）。 */
import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { bootstrap, callFunction, supabase } from "@/lib/supabase";
import { useData } from "./data";

/** 手机验证码流向（对齐 iOS PhoneOTPFlow） */
export type PhoneOtpFlow =
  /** verifyOtp 用 type=phone_change（匿名原地转正，user_id 不变） */
  | "link_anonymous"
  /** verifyOtp 用 type=sms（登录后触发匿名数据迁移） */
  | "sign_in";

/** 展示用手机号 → E.164（默认 +86；11 位裸号自动补前缀） */
export function e164Phone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("86") && digits.length === 13) return `+${digits}`;
  return `+86${digits}`;
}

/** 已绑定手机号脱敏展示（Supabase 存储格式 8613812345678 → +86 138****5678） */
export function phoneDisplay(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let p = phone;
  if (p.startsWith("86") && p.length === 13) p = p.slice(2);
  if (p.length !== 11) return phone;
  return `+86 ${p.slice(0, 3)}****${p.slice(7)}`;
}

/** Supabase Auth 错误码判定（号码已被注册 → 切换为既有账号登录流） */
function isPhoneExistsError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (code === "phone_exists") return true;
  const message = (err as { message?: unknown }).message;
  return typeof message === "string" && message.includes("phone_exists");
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String(err.message);
  return String(err);
}

interface AuthState {
  userId: string | null;
  /** 游客（匿名会话或尚未建立会话）—— AuthGate 据此决定是否弹登录页 */
  isAnonymous: boolean;
  /** 已绑定手机号（Supabase 存储格式，如 8613812345678） */
  phone: string | null;
  /** bootstrap 是否完成（成功或失败） */
  ready: boolean;
  lastError: string | null;
  /** 最近一次 sendOtp 的流向，verifyOtp 据此选 type */
  otpFlow: PhoneOtpFlow;

  /** 启动：订阅 onAuthStateChange + 匿名登录（幂等，可多处调用） */
  init: () => void;
  /**
   * 发送验证码。匿名态优先走转正路径（updateUser 原地链接）；
   * 号码已被注册（phone_exists）时自动切换为既有账号登录流。
   */
  sendOtp: (rawPhone: string) => Promise<PhoneOtpFlow>;
  /** 校验验证码。sign_in 流会替换会话：先暂存匿名 token，成功后经 merge-anonymous 迁移数据 */
  verifyOtp: (rawPhone: string, code: string) => Promise<void>;
  /** 退出登录：清空本地缓存后回落到全新匿名会话（游客模式仍可用） */
  signOut: () => Promise<void>;
  /** 注销账号：服务端删除 auth 用户（业务表级联清理）后本地登出 */
  deleteAccount: () => Promise<void>;
}

let initialized = false;

export const useAuth = create<AuthState>()((set, get) => {
  /** 用会话同步本地状态（无会话时回到游客态语义：isAnonymous=true） */
  const syncSession = (session: Session | null) => {
    const user = session?.user ?? null;
    set({
      userId: user?.id ?? get().userId,
      isAnonymous: user?.is_anonymous ?? true,
      phone: user?.phone || null,
    });
  };

  /** 登录 / 转正后：同步会话状态并重拉用户侧数据 */
  const refreshAfterAuthChange = async () => {
    const { data } = await supabase().auth.getSession();
    syncSession(data.session);
    await useData.getState().refreshAfterAuthChange();
  };

  return {
    userId: null,
    isAnonymous: true,
    phone: null,
    ready: false,
    lastError: null,
    otpFlow: "link_anonymous",

    init() {
      if (initialized) return;
      initialized = true;
      // 监听会话变化（转正 / 换账号 / 登出），保持状态与 UI 同步
      supabase().auth.onAuthStateChange((event, session) => {
        if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "TOKEN_REFRESHED"].includes(event)) return;
        syncSession(session);
      });
      bootstrap()
        .then(async () => {
          const { data } = await supabase().auth.getSession();
          syncSession(data.session);
          set({ ready: true });
        })
        .catch((err) => set({ ready: true, lastError: errMessage(err) }));
    },

    async sendOtp(rawPhone) {
      const sb = supabase();
      const phone = e164Phone(rawPhone);
      const { data } = await sb.auth.getSession();
      if (get().isAnonymous && data.session) {
        // 匿名转正：updateUser 原地链接手机号（user_id 不变），验证码走 phone_change
        const { error } = await sb.auth.updateUser({ phone });
        if (!error) {
          set({ otpFlow: "link_anonymous" });
          return "link_anonymous";
        }
        if (!isPhoneExistsError(error)) throw error;
        // 号码已被注册 → 切换为既有账号登录流
      }
      const { error } = await sb.auth.signInWithOtp({ phone });
      if (error) throw error;
      set({ otpFlow: "sign_in" });
      return "sign_in";
    },

    async verifyOtp(rawPhone, code) {
      const sb = supabase();
      const phone = e164Phone(rawPhone);
      const token = code.replace(/\D/g, "");
      if (get().otpFlow === "link_anonymous") {
        const { error } = await sb.auth.verifyOtp({ phone, token, type: "phone_change" });
        if (error) throw error;
      } else {
        // sign_in 流整个替换会话：匿名 access token 必须在替换前抓住，供 merge-anonymous 迁移
        const { data } = await sb.auth.getSession();
        const anonymousToken = data.session?.user.is_anonymous ? data.session.access_token : null;
        const { error } = await sb.auth.verifyOtp({ phone, token, type: "sms" });
        if (error) throw error;
        if (anonymousToken) {
          try {
            await callFunction<{ ok: boolean; merged: boolean }>("merge-anonymous", {
              anonymous_access_token: anonymousToken,
            });
          } catch (err) {
            // 失败不阻断登录（可由后台任务/客服兜底）
            set({ lastError: `匿名数据迁移失败：${errMessage(err)}` });
          }
        }
      }
      await refreshAfterAuthChange();
    },

    async signOut() {
      const sb = supabase();
      try {
        await sb.auth.signOut();
      } catch {
        /* 忽略登出错误 */
      }
      useData.getState().resetUserCaches();
      set({ userId: null, isAnonymous: true, phone: null });
      // 回落到全新匿名会话（游客模式仍可用）
      try {
        const { data, error } = await sb.auth.signInAnonymously();
        if (error) throw error;
        set({ userId: data.user?.id ?? null, isAnonymous: true, phone: null, ready: true });
        await useData.getState().refreshAfterAuthChange();
      } catch (err) {
        set({ lastError: errMessage(err) });
      }
    },

    async deleteAccount() {
      await callFunction<{ ok: boolean }>("delete-account", {});
      await get().signOut();
    },
  };
});
