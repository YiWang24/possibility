"use client";
/* 首页「认识你自己」客户端状态仓 —— 移植 iOS HomeModel。
   探索发问 / 动态画像维度 / 云端数字形象 / 真实日记概览。
   服务端画像经 useData（get-profile）拉取；本地维度用 localStorage 持久化（对齐 iOS UserDefaults）。 */

import { create } from "zustand";
import { callFunction } from "@/lib/supabase";
import { useData } from "@/stores/data";
import { DIMENSION_KEYS, type DimensionKey } from "@/lib/dimensions";
import type { ExploreTopic } from "@/lib/models";
import { personaModelFrom, type PersonaData, type PersonaModel } from "./persona";

/** POST /persona 出参（扁平 {job_id, status, persona, model_version}） */
interface PersonaJob {
  job_id: string;
  status: string;
  persona?: PersonaData | null;
  model_version?: string | null;
}

/** POST /list-diary 出参条目 */
interface RemoteDiaryEntry {
  id: number;
  emotions?: string[] | null;
  local_date: string;
  created_at: string;
}

/** 人生底牌卡（3 张公开底牌，参与数字形象生成） */
export interface LifeSignatureCard {
  glyph: string;
  name: string;
}

const STORE_PREFIX = "kaleido_dim_";
const DIM_ORDER = ["personality", ...DIMENSION_KEYS] as const;

/* ---- localStorage 帮手（SSR 安全） ---- */
function lsGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 隐私模式等静默忽略 */
  }
}

/** 带超时的 Promise（网关偶发挂起时不至于卡死） */
async function withTimeout<T>(ms: number, work: () => Promise<T>): Promise<T | null> {
  try {
    return await Promise.race([
      work(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  } catch {
    return null;
  }
}

/* ---- 防抖句柄（模块级，不进 state） ---- */
let personaDebounce: ReturnType<typeof setTimeout> | null = null;
let lastPersonaSnapshot: string | null = null;

interface HomeState {
  /* 探索发问 */
  question: string;
  topic: ExploreTopic | null;
  setQuestion: (q: string) => void;
  toggleTopic: (t: ExploreTopic) => void;
  clearQuestion: () => void;
  canSend: () => boolean;
  trimmedQuestion: () => string;

  /* 动态画像 */
  filledDims: Record<string, string>;
  remotePersona: PersonaData | null;
  loadPortrait: () => Promise<void>;
  selectedKeywords: (key: DimensionKey) => string[];
  saveDimension: (key: DimensionKey, keywords: string[]) => void;
  savePersonality: (text: string) => void;
  personaModel: () => PersonaModel;
  lifeSignatureCards: () => LifeSignatureCard[];
  completion: () => { completed: number; total: number; percent: number };

  /* 探索天数 */
  exploredDays: number;
  loadDiaryOverview: () => Promise<void>;
}

export const useHome = create<HomeState>()((set, get) => ({
  /* ============ 探索发问 ============ */
  question: "",
  topic: null,
  setQuestion: (q) => set({ question: q }),
  toggleTopic: (t) => {
    const cur = get().topic;
    if (cur?.topic === t.topic) {
      set({ topic: null });
    } else {
      // 选中话题且输入为空时填样例问题（对齐 iOS topic didSet）
      const fill = get().trimmedQuestion() === "" ? t.sampleQuestion : get().question;
      set({ topic: t, question: fill });
    }
  },
  clearQuestion: () => set({ question: "" }),
  trimmedQuestion: () => get().question.trim(),
  canSend: () => get().question.trim().length > 0,

  /* ============ 动态画像 ============ */
  filledDims: {},
  remotePersona: null,

  async loadPortrait() {
    // 1. 本地已填维度
    const local: Record<string, string> = {};
    for (const key of DIM_ORDER) {
      const v = lsGet(STORE_PREFIX + key);
      if (v && v.length > 0) local[key] = v;
    }
    set({ filledDims: local });

    // 2. 从权威原子事实聚合云端画像（不再读取兼容 dims 投影）
    const remote = await useData.getState().loadProfile();
    if (remote?.facts) {
      const merged = { ...get().filledDims };
      for (const key of DIM_ORDER) {
        const value = remote.facts
          .filter((fact) => fact.dimension === key)
          .map((fact) => fact.value.trim())
          .filter(Boolean)
          .join(" · ");
        if (value && value.length > 0 && !merged[key]) {
          merged[key] = value;
          lsSet(STORE_PREFIX + key, value);
        }
      }
      set({ filledDims: merged });
    }

    // 3. 生成云端数字形象
    void refreshPersona(set, get);
  },

  selectedKeywords: (key) => {
    const text = get().filledDims[key];
    if (!text) return [];
    return text.split(" · ").filter((s) => s.length > 0);
  },

  saveDimension: (key, keywords) => {
    const picked = keywords.slice(0, 5);
    const text = picked.join(" · ");
    if (!text) return;
    set({ filledDims: { ...get().filledDims, [key]: text } });
    lsSet(STORE_PREFIX + key, text);
    void (async () => {
      try {
        await callFunction("save-profile", {
          action: "save_dimension",
          dimension: key,
          tags: picked,
          source: "manual",
        });
        useData.getState().invalidateProfile();
      } catch {
        /* 本地已存，失败静默 */
      }
      scheduleRefreshPersona(set, get);
    })();
  },

  savePersonality: (text) => {
    if (!text) return;
    set({ filledDims: { ...get().filledDims, personality: text } });
    lsSet(STORE_PREFIX + "personality", text);
    void (async () => {
      try {
        await callFunction("save-profile", {
          action: "save_dimension",
          dimension: "personality",
          tags: [text],
          source: "assessment",
        });
        useData.getState().invalidateProfile();
      } catch {
        /* 本地已存，失败静默 */
      }
      scheduleRefreshPersona(set, get);
    })();
  },

  personaModel: () => {
    const values = DIM_ORDER.map((k) => get().filledDims[k]).filter((v): v is string => !!v);
    const signature = get().lifeSignatureCards().map((c) => c.name);
    return personaModelFrom(values, signature, get().remotePersona);
  },

  lifeSignatureCards: () => {
    const games = useData.getState().profile?.card_games ?? [];
    const life = games.find((g) => g.kind === "life");
    if (!life) return [];
    return life.final_cards.slice(0, 3).map((c) => ({
      glyph: c.glyph ?? "◆",
      name: c.name,
    }));
  },

  completion: () => {
    const dims = get().filledDims;
    const completed = DIM_ORDER.reduce((count, key) => {
      const v = dims[key];
      return v && v.trim().length > 0 ? count + 1 : count;
    }, 0);
    const total = DIM_ORDER.length;
    const percent = Math.round((completed / total) * 100);
    return { completed, total, percent };
  },

  /* ============ 探索天数 ============ */
  exploredDays: 1,

  async loadDiaryOverview() {
    const res = await withTimeout(20000, () =>
      callFunction<{ entries: RemoteDiaryEntry[] }>("list-diary", { limit: 50 }),
    );
    if (!res) return;
    const rows = res.entries ?? [];

    let earliest: Date | null = null;
    for (const row of rows) {
      const created = new Date(`${row.local_date}T00:00:00`);
      if (Number.isNaN(created.getTime())) continue;
      if (!earliest || created < earliest) earliest = created;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (earliest) {
      const start = new Date(earliest);
      start.setHours(0, 0, 0, 0);
      const days = Math.round((today.getTime() - start.getTime()) / 86400000);
      set({ exploredDays: Math.max(1, days + 1) });
    } else {
      set({ exploredDays: 1 });
    }

  },
}));

/* ============ 私有：形象生成 ============ */

type SetFn = (partial: Partial<HomeState>) => void;
type GetFn = () => HomeState;

/** 画像变化后重新生成云端形象；快照未变且已有形象时跳过（避免重复打 LLM） */
async function refreshPersona(set: SetFn, get: GetFn) {
  const signature = get().lifeSignatureCards().map((c) => c.name);
  const snapshot =
    DIM_ORDER.map((k) => get().filledDims[k])
      .filter((v): v is string => !!v)
      .join("|") +
    "#" +
    signature.join("|");
  if (snapshot === lastPersonaSnapshot && get().remotePersona) return;
  lastPersonaSnapshot = snapshot;
  const job = await withTimeout(15000, () =>
    callFunction<PersonaJob>("persona", { action: "generate" }),
  );
  if (job && job.status !== "failed" && job.persona) {
    set({ remotePersona: job.persona });
  }
}

/** refreshPersona 防抖入口：连续保存多个维度时合并为停手 ~2s 后一次生成 */
function scheduleRefreshPersona(set: SetFn, get: GetFn) {
  if (personaDebounce) clearTimeout(personaDebounce);
  personaDebounce = setTimeout(() => {
    void refreshPersona(set, get);
  }, 2000);
}
