"use client";
/* 我的公开主页 —— 移植 iOS MyProfileModels.swift（原型 DEFAULT_MY_PROFILE / MY_PROFILE_KEY）。
   纯本地：localStorage JSON 持久化（key kaleido_my_profile_v1），加载时与默认档案深合并。 */
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
  /** 画像展示开关：personality / skill / like / love / family / social / life */
  visibility: Record<string, boolean>;
  adviceModules: AdviceModule[];
  services: ServiceOffer[];
  meta: MyProfileMeta;
}

export const MY_PROFILE_STORAGE_KEY = "kaleido_my_profile_v1";

/** 旧版默认昵称（远端存的是它时恢复为新默认名） */
export const LEGACY_DEFAULT_NAME = "屿岸";

export const VISIBILITY_KEYS: { key: string; label: string }[] = [
  { key: "personality", label: "人格底色" },
  { key: "skill", label: "我擅长" },
  { key: "like", label: "我喜欢" },
  { key: "love", label: "我在恋爱关系中在意" },
  { key: "family", label: "我在家庭关系中在意" },
  { key: "social", label: "我在人际交往中在意" },
  { key: "life", label: "我的人生底牌" },
];

export const DEFAULT_MY_PROFILE: MyProfile = {
  name: "老己",
  hue: 4,
  quote: "我还没有抵达答案，但已经开始认真记录自己如何选择。",
  tags: ["交互设计", "AI 产品探索", "上海"],
  bio: "交互设计师 → AI 产品探索者",
  traj: [
    { age: "22 岁", t: "进入交互设计行业", d: "从界面和体验开始，逐渐对产品为什么成立产生兴趣。" },
    { age: "27 岁", t: "开始探索 AI 产品", d: "用小项目验证转型意愿，也记录每次选择背后的现实约束。" },
  ],
  visibility: {
    personality: true,
    skill: true,
    like: true,
    love: false,
    family: false,
    social: false,
    life: false,
  },
  adviceModules: [
    {
      id: "default-decision",
      title: "转型前，先做一次低成本验证",
      content:
        "先做一个可以撤回的小实验，再决定是否改变。\n把真实意愿和现实承受力分开记录。\n重要决定前，至少听三种不同经历。",
      links: [],
    },
    {
      id: "default-ability",
      title: "把旧能力翻译成新岗位的优势",
      content:
        "把设计经验转译成产品判断证据。\n优先补真实项目，而不是继续囤课。\n记录每次取舍背后的依据。",
      links: [],
    },
    {
      id: "default-interview",
      title: "让面试官看见真实的行动证据",
      content:
        "不把转型故事讲成一条完美直线。\n用真实行动解释为什么改变。\n坦白仍在补齐的能力。",
      links: [],
    },
  ],
  services: [
    {
      id: "consult",
      enabled: true,
      type: "1 对 1 交流",
      title: "转型路径交流",
      price: "29",
      desc: "围绕当前选择、能力迁移与行动计划进行一次真实经验交流。",
    },
    {
      id: "materials",
      enabled: false,
      type: "资料工具包",
      title: "探索复盘模板",
      price: "9.9",
      desc: "整理我在探索过程中使用的问题清单、复盘表和小实验模板。",
    },
    {
      id: "companion",
      enabled: false,
      type: "阶段陪跑",
      title: "四周行动陪跑",
      price: "599",
      desc: "每周复盘一次进展，在关键选择点提供经验反馈。",
    },
  ],
  meta: {
    age: 28,
    city: "上海",
    from: "交互设计师",
    to: "AI 产品探索者",
    years: "探索第 1 年",
    result: "持续用真实项目验证方向",
    consulted: 0,
    response: "暂未开放咨询",
    intro:
      "我正在从熟悉的交互设计向 AI 产品方向探索。比起把转型包装成一条直线，我更想诚实记录犹豫、试错和逐渐清楚的过程。",
    full:
      "最难的不是学会一个新工具，而是接受自己暂时没有确定答案。我开始用小项目、访谈和每周复盘代替空想，让每一步都留下可以判断的证据。",
  },
};

/** 持久化/远端数据与默认档案深合并（原型 loadMyProfile 语义：缺失字段回落默认值） */
export function mergeWithDefaultProfile(stored?: Partial<MyProfile> | null): MyProfile {
  const base = DEFAULT_MY_PROFILE;
  if (!stored) return base;
  return {
    ...base,
    ...stored,
    traj: stored.traj ?? base.traj,
    tags: stored.tags ?? base.tags,
    visibility: { ...base.visibility, ...(stored.visibility ?? {}) },
    adviceModules: stored.adviceModules ?? base.adviceModules,
    services: stored.services ?? base.services,
    meta: { ...base.meta, ...(stored.meta ?? {}) },
  };
}

/* ========= 远端映射（public_profiles 表 ↔ MyProfile，对齐 iOS RemotePublicProfile） ========= */

/** 上行 payload（save-profile action=save_public_profile 用；hue / meta 等纯本地字段不上云） */
export function myProfileRemotePayload(profile: MyProfile): RemotePublicProfile {
  return {
    name: profile.name,
    quote: profile.quote,
    bio: profile.bio,
    avatar_url: null,
    tags: profile.tags,
    trajectory: profile.traj,
    services: profile.services,
    advice: profile.adviceModules,
    visibility: profile.visibility,
  };
}

/** 用远端字段覆盖本地模型（远端缺失/空字段保留本地值，不破坏本地持久化语义） */
export function mergeRemoteMyProfile(local: MyProfile, remote: RemotePublicProfile): MyProfile {
  const merged: MyProfile = { ...local };
  if (remote.name) {
    merged.name = remote.name === LEGACY_DEFAULT_NAME ? DEFAULT_MY_PROFILE.name : remote.name;
  }
  if (remote.quote) merged.quote = remote.quote;
  if (remote.bio) merged.bio = remote.bio;
  if (remote.tags?.length) merged.tags = remote.tags;
  if (remote.trajectory?.length) merged.traj = remote.trajectory;
  if (remote.services?.length) merged.services = remote.services;
  if (remote.advice?.length) merged.adviceModules = remote.advice;
  if (remote.visibility && Object.keys(remote.visibility).length) {
    merged.visibility = { ...merged.visibility, ...remote.visibility };
  }
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
      /* 读盘时与默认档案深合并：老版本数据缺字段也不会破坏 UI */
      merge: (persisted, current) => {
        const stored = (persisted as Partial<MyProfileState> | undefined)?.profile;
        return { ...current, profile: mergeWithDefaultProfile(stored) };
      },
    },
  ),
);
