"use client";
/* 我的公开主页。localStorage 是离线缓存；公开字段同步 public_profiles。 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AdviceModule, RemotePublicProfile, ServiceOffer, TrajectoryNode } from "@/lib/models";

export interface MyProfileMeta {
  age: number;
  city: string;
  from: string;
  to: string;
  years: string;
  result: string;
  consulted: number;
  response: string;
  intro: string;
  full: string;
}

export interface MyProfile {
  name: string;
  /** 头像色相（theme hue 0–4） */
  hue: number;
  quote: string;
  tags: string[];
  bio: string;
  traj: TrajectoryNode[];
  adviceModules: AdviceModule[];
  services: ServiceOffer[];
  meta: MyProfileMeta;
}

// v2 intentionally does not import the prototype's prefilled v1 profile.
export const MY_PROFILE_STORAGE_KEY = "kaleido_my_profile_v2";
export const DEFAULT_MY_PROFILE: MyProfile = {
  name: "",
  hue: 4,
  quote: "",
  tags: [],
  bio: "",
  traj: [],
  adviceModules: [],
  services: [],
  meta: {
    age: 0,
    city: "",
    from: "",
    to: "",
    years: "",
    result: "",
    consulted: 0,
    response: "",
    intro: "",
    full: "",
  },
};

/** 持久化/远端数据与空档案深合并。 */
export function mergeWithDefaultProfile(stored?: Partial<MyProfile> | null): MyProfile {
  const base = DEFAULT_MY_PROFILE;
  if (!stored) return base;
  return {
    ...base,
    ...stored,
    traj: stored.traj ?? base.traj,
    tags: stored.tags ?? base.tags,
    adviceModules: stored.adviceModules ?? base.adviceModules,
    services: stored.services ?? base.services,
    meta: { ...base.meta, ...(stored.meta ?? {}) },
  };
}

/* ========= 远端映射（public_profiles 表 ↔ MyProfile，对齐 iOS RemotePublicProfile） ========= */

/** 上行 payload（save-profile action=save_public_profile 用） */
export function myProfileRemotePayload(profile: MyProfile): RemotePublicProfile {
  return {
    profile_version: 2,
    name: profile.name,
    quote: profile.quote,
    bio: profile.bio,
    avatar_url: null,
    tags: profile.tags,
    trajectory: profile.traj,
    services: profile.services,
    advice: profile.adviceModules,
    hue: profile.hue,
    age: profile.meta.age,
    city: profile.meta.city,
    from_role: profile.meta.from,
    to_role: profile.meta.to,
    stage: profile.meta.years,
    result: profile.meta.result,
    story_intro: profile.meta.intro,
    story_full: profile.meta.full,
  };
}

/** 用远端字段覆盖本地模型（远端缺失/空字段保留本地值，不破坏本地持久化语义） */
export function mergeRemoteMyProfile(local: MyProfile, remote: RemotePublicProfile): MyProfile {
  const merged: MyProfile = { ...local };
  if (remote.name !== null && remote.name !== undefined) merged.name = remote.name;
  if (remote.quote !== null && remote.quote !== undefined) merged.quote = remote.quote;
  if (remote.bio !== null && remote.bio !== undefined) merged.bio = remote.bio;
  if (remote.tags) merged.tags = remote.tags;
  if (remote.trajectory) merged.traj = remote.trajectory;
  if (remote.services) merged.services = remote.services;
  if (remote.advice) merged.adviceModules = remote.advice;
  if (typeof remote.hue === "number" && remote.hue >= 0 && remote.hue <= 4) merged.hue = remote.hue;
  merged.meta = {
    ...merged.meta,
    ...(typeof remote.age === "number" ? { age: remote.age } : {}),
    ...(remote.city !== null && remote.city !== undefined ? { city: remote.city } : {}),
    ...(remote.from_role !== null && remote.from_role !== undefined ? { from: remote.from_role } : {}),
    ...(remote.to_role !== null && remote.to_role !== undefined ? { to: remote.to_role } : {}),
    ...(remote.stage !== null && remote.stage !== undefined ? { years: remote.stage } : {}),
    ...(remote.result !== null && remote.result !== undefined ? { result: remote.result } : {}),
    ...(remote.story_intro !== null && remote.story_intro !== undefined ? { intro: remote.story_intro } : {}),
    ...(remote.story_full !== null && remote.story_full !== undefined ? { full: remote.story_full } : {}),
  };
  return merged;
}

/* ========= zustand + localStorage 持久化 ========= */

interface MyProfileState {
  profile: MyProfile;
  /** 整体替换（编辑页保存） */
  setProfile: (profile: MyProfile) => void;
  /** 局部更新（visibility 开关等） */
  update: (patch: Partial<MyProfile>) => void;
  /** 云端恢复：远端字段覆盖本地（空字段保留本地值） */
  applyRemote: (remote: RemotePublicProfile) => void;
  /** 恢复默认档案 */
  reset: () => void;
}

export const useMyProfile = create<MyProfileState>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_MY_PROFILE,
      setProfile: (profile) => set({ profile }),
      update: (patch) => set({ profile: { ...get().profile, ...patch } }),
      applyRemote: (remote) => set({ profile: mergeRemoteMyProfile(get().profile, remote) }),
      reset: () => set({ profile: DEFAULT_MY_PROFILE }),
    }),
    {
      name: MY_PROFILE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      /* 只读取当前 v2 缓存；v1 原型假资料不会被迁入。 */
      merge: (persisted, current) => {
        const stored = (persisted as Partial<MyProfileState> | undefined)?.profile;
        return {
          ...current,
          profile: mergeWithDefaultProfile(stored),
        };
      },
    },
  ),
);
