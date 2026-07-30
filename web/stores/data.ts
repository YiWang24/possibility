"use client";
/* 服务端状态数据仓 —— 对齐 iOS SupabaseService 的取数与缓存职责。
   服务端状态经此拉取缓存；UI/客户端状态留在各页面组件（二者分治）。
   拉取失败一律回退 demo 种子（断网兜底，技术设计文档 §13）。 */
import { create } from "zustand";
import { bootstrap, callFunction, supabase } from "@/lib/supabase";
import {
  PRICE_UNLOCK_PROFILE,
  travelerDetailFromRow,
  travelerFromRow,
  type Bounty,
  type RemoteProfile,
  type Traveler,
  type TravelerDetail,
  type TravelerServiceItem,
} from "@/lib/models";
import {
  DEMO_BOUNTIES,
  DEMO_TRAVELERS,
  DEMO_TRAVELER_DETAILS,
  demoServices,
} from "@/lib/demo-data";

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String(err.message);
  return String(err);
}

/** get-profile 会话缓存 TTL（对齐 iOS remoteProfileCacheTTL = 60s） */
const PROFILE_CACHE_TTL_MS = 60_000;

/** 当前会话 user id（无会话时先补匿名登录） */
async function currentUserId(): Promise<string | null> {
  try {
    await bootstrap();
  } catch {
    return null;
  }
  const { data } = await supabase().auth.getSession();
  return data.session?.user.id ?? null;
}

interface DataState {
  /* ---- 缓存 ---- */
  travelers: Traveler[];
  travelerDetails: Record<number, TravelerDetail>;
  services: TravelerServiceItem[];
  bounties: Bounty[];
  bountiesTotal: number;
  profile: RemoteProfile | null;
  profileFetchedAt: number;
  unlockedProfileIds: number[];
  lastError: string | null;

  /* ---- 公开内容 ---- */
  loadTravelers: () => Promise<void>;
  /** 把实时生成/新拉取的旅人按 id 去重合并进缓存，并按 id 排序（推演推荐用） */
  mergeTravelers: (incoming: Traveler[]) => void;
  loadTravelerDetail: (id: number) => Promise<TravelerDetail | null>;
  loadServices: (travelerId: number) => Promise<TravelerServiceItem[]>;
  loadBounties: (limit?: number, offset?: number) => Promise<void>;

  /* ---- 用户数据（RLS：仅本人） ---- */
  /** GET /get-profile 云端画像（60s TTL；force 跳过缓存） */
  loadProfile: (force?: boolean) => Promise<RemoteProfile | null>;
  /** 写路径成功后调用：下次 loadProfile 强制重拉 */
  invalidateProfile: () => void;
  loadUnlocks: () => Promise<void>;
  isUnlocked: (travelerId: number) => boolean;
  /** mock 解锁完整经验（¥9.9）：INSERT unlocks → 本地标记 */
  unlockProfile: (travelerId: number) => Promise<boolean>;
  /** 登录 / 转正 / 登出后：失效画像缓存并重拉用户侧数据 */
  refreshAfterAuthChange: () => Promise<void>;
  /** 登出 / 注销时清空所有仅属于旧账号的缓存 */
  resetUserCaches: () => void;
}

export const useData = create<DataState>()((set, get) => ({
  travelers: [],
  travelerDetails: {},
  services: [],
  bounties: [],
  bountiesTotal: 0,
  profile: null,
  profileFetchedAt: 0,
  unlockedProfileIds: [],
  lastError: null,

  /* ============ 公开内容（RLS 匿名可读） ============ */

  async loadTravelers() {
    try {
      const { data, error } = await supabase().from("travelers").select().order("id");
      if (error) throw error;
      set({ travelers: data?.length ? data.map(travelerFromRow) : DEMO_TRAVELERS });
    } catch (err) {
      set({ lastError: errMessage(err), travelers: DEMO_TRAVELERS }); // 断网兜底
    }
  },

  mergeTravelers(incoming) {
    if (!incoming.length) return;
    const byId = new Map(get().travelers.map((t) => [t.id, t]));
    for (const t of incoming) byId.set(t.id, t);
    set({ travelers: [...byId.values()].sort((a, b) => a.id - b.id) });
  },

  async loadTravelerDetail(id) {
    const cached = get().travelerDetails[id];
    if (cached) return cached;
    try {
      const { data, error } = await supabase()
        .from("traveler_details")
        .select()
        .eq("traveler_id", id)
        .single();
      if (error) throw error;
      const detail = travelerDetailFromRow(data);
      set({ travelerDetails: { ...get().travelerDetails, [id]: detail } });
      return detail;
    } catch (err) {
      set({ lastError: errMessage(err) });
      const fallback = DEMO_TRAVELER_DETAILS[id] ?? null;
      if (fallback) set({ travelerDetails: { ...get().travelerDetails, [id]: fallback } });
      return fallback;
    }
  },

  async loadServices(travelerId) {
    try {
      const { data, error } = await supabase()
        .from("traveler_services")
        .select()
        .eq("traveler_id", travelerId);
      if (error) throw error;
      const resolved: TravelerServiceItem[] = data?.length
        ? data.map((row) => ({ ...row, tags: row.tags ?? [] }))
        : demoServices(travelerId);
      set({ services: resolved });
      return resolved;
    } catch (err) {
      const fallback = demoServices(travelerId);
      set({ lastError: errMessage(err), services: fallback });
      return fallback;
    }
  },

  async loadBounties(limit = 20, offset = 0) {
    try {
      const res = await callFunction<{ bounties: Bounty[]; total: number }>("community", {
        action: "list_bounties",
        limit,
        offset,
      });
      const rows = res.bounties ?? [];
      set({
        bounties: rows.length ? rows : DEMO_BOUNTIES,
        bountiesTotal: rows.length ? res.total : DEMO_BOUNTIES.length,
      });
    } catch (err) {
      set({
        lastError: errMessage(err),
        bounties: DEMO_BOUNTIES,
        bountiesTotal: DEMO_BOUNTIES.length,
      });
    }
  },

  /* ============ 用户数据 ============ */

  async loadProfile(force = false) {
    const { profile, profileFetchedAt } = get();
    if (!force && profile && Date.now() - profileFetchedAt < PROFILE_CACHE_TTL_MS) {
      return profile;
    }
    try {
      const remote = await callFunction<RemoteProfile>("get-profile");
      const normalized: RemoteProfile = {
        portrait_pct: remote.portrait_pct ?? 0,
        profile_revision: remote.profile_revision ?? 0,
        verification: remote.verification ?? {
          status: "unverified",
          provider: null,
          verified_at: null,
        },
        facts: remote.facts ?? [],
        card_games: remote.card_games ?? [],
        public_profile: remote.public_profile ?? null,
      };
      set({ profile: normalized, profileFetchedAt: Date.now() });
      return normalized;
    } catch (err) {
      set({ lastError: errMessage(err) });
      // 请求失败时保留空档案，不用假数据伪装真实画像。
      if (!get().profile) {
        set({
          profile: {
            portrait_pct: 0,
            profile_revision: 0,
            verification: {
              status: "unverified",
              provider: null,
              verified_at: null,
            },
            facts: [],
            card_games: [],
            public_profile: null,
          },
        });
      }
      return get().profile;
    }
  },

  invalidateProfile() {
    set({ profileFetchedAt: 0 });
  },

  async loadUnlocks() {
    const uid = await currentUserId();
    if (!uid) return;
    try {
      const { data, error } = await supabase()
        .from("unlocks")
        .select("kind, target_id")
        .eq("user_id", uid);
      if (error) throw error;
      const ids = (data ?? [])
        .filter((row) => row.kind === "profile")
        .map((row) => Number.parseInt(row.target_id, 10))
        .filter((n) => Number.isFinite(n));
      set({ unlockedProfileIds: [...new Set(ids)] });
    } catch (err) {
      set({ lastError: errMessage(err) });
    }
  },

  isUnlocked(travelerId) {
    return get().unlockedProfileIds.includes(travelerId);
  },

  async unlockProfile(travelerId) {
    const uid = await currentUserId();
    if (!uid) return false;
    try {
      const { error } = await supabase().from("unlocks").insert({
        user_id: uid,
        kind: "profile",
        target_id: String(travelerId),
        amount: PRICE_UNLOCK_PROFILE,
      });
      if (error) throw error;
      set({ unlockedProfileIds: [...new Set([...get().unlockedProfileIds, travelerId])] });
      return true;
    } catch (err) {
      set({ lastError: errMessage(err) });
      return false;
    }
  },

  async refreshAfterAuthChange() {
    get().invalidateProfile();
    await Promise.all([get().loadProfile(true), get().loadUnlocks()]);
  },

  resetUserCaches() {
    set({ profile: null, profileFetchedAt: 0, unlockedProfileIds: [] });
  },
}));
