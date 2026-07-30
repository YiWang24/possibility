"use client";
/* 首页「认识你自己」客户端状态仓 —— 移植 iOS HomeModel。
   探索发问 / 语音日记（Web 改为文字输入 + 保留麦克风 UI）/ 动态画像维度 / 云端数字形象。
   服务端画像经 useData（get-profile）拉取；本地维度用 localStorage 持久化（对齐 iOS UserDefaults）。 */

import { create } from "zustand";
import { callFunction } from "@/lib/supabase";
import { useData } from "@/stores/data";
import { DIMENSION_KEYS, type DimensionKey } from "@/lib/dimensions";
import type { ExploreTopic } from "@/lib/models";
import { emotionEmoji } from "@/lib/emotions";
import { personaModelFrom, type PersonaData, type PersonaModel } from "./persona";

/** POST /analyze-diary 出参 */
interface DiaryAnalysis {
  emotions: string[];
  keywords: string[];
  dim_updates?: Record<string, string>;
}

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
  created_at: string;
}

/** 人生底牌卡（3 张公开底牌，参与数字形象生成） */
export interface LifeSignatureCard {
  glyph: string;
  name: string;
}

const STORE_PREFIX = "kaleido_dim_";
const DIM_ORDER = ["personality", ...DIMENSION_KEYS] as const;

/** demo：录音得到的预置 transcript（Web 端用户不输入时的兜底） */
const SAMPLE_TRANSCRIPT =
  "今天又在纠结要不要转产品。会议上帮团队理清了一个乱成一团的需求，那一刻很有成就感，但一想到要放弃做了六年的设计，还是会慌。";

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

/* ---- 计时 / 防抖 / 取消 句柄（模块级，不进 state） ---- */
let timerId: ReturnType<typeof setInterval> | null = null;
let analyzeToken = 0;
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

  /* 语音日记 */
  isRecording: boolean;
  elapsed: number;
  analyzing: boolean;
  analysis: DiaryAnalysis | null;
  analysisError: string | null;
  transcript: string;
  lastTranscript: string | null;
  toggleRecording: () => void;
  setTranscript: (text: string) => void;
  startAnalyze: () => void;
  submitEditedTranscript: () => void;
  retryAnalysis: () => void;
  cancelAnalysis: () => void;

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

  /* 今日日记 / 探索天数 */
  todayEmoji: string | null;
  hasRemoteDiaryToday: boolean;
  exploredDays: number;
  hasRecordedToday: () => boolean;
  todayDisplayEmoji: () => string;
  loadDiaryOverview: () => Promise<void>;
}

/** yyyy-MM-dd（本地时区） */
function dayString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

  /* ============ 语音日记 ============ */
  isRecording: false,
  elapsed: 0,
  analyzing: false,
  analysis: null,
  analysisError: null,
  transcript: "",
  lastTranscript: null,

  toggleRecording: () => {
    if (get().isRecording) {
      get().startAnalyze();
      return;
    }
    if (timerId) clearInterval(timerId);
    set({
      isRecording: true,
      elapsed: 0,
      analysis: null,
      analysisError: null,
      transcript: "",
    });
    timerId = setInterval(() => {
      if (!get().isRecording) return;
      set({ elapsed: get().elapsed + 1 });
    }, 1000);
  },

  setTranscript: (text) => set({ transcript: text }),

  startAnalyze: () => {
    if (get().analyzing) return;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    // Web 端无真实 STT：用户输入为准，未输入则回退 demo transcript
    const typed = get().transcript.trim();
    const transcript = typed.length >= 1 ? typed : SAMPLE_TRANSCRIPT;
    set({ isRecording: false, transcript, lastTranscript: transcript });
    void runAnalysis(transcript, set, get);
  },

  submitEditedTranscript: () => {
    if (get().analyzing) return;
    const text = get().transcript.trim();
    if (!text) return;
    set({ transcript: text, lastTranscript: text });
    void runAnalysis(text, set, get);
  },

  retryAnalysis: () => {
    if (get().analyzing) return;
    const t = get().lastTranscript;
    if (!t) return;
    void runAnalysis(t, set, get);
  },

  cancelAnalysis: () => {
    analyzeToken++;
    set({ analyzing: false, analysisError: null });
  },

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

    // 2. 云端画像合并（远端非空、本地为空的键补进来）
    const remote = await useData.getState().loadProfile();
    if (remote?.dims) {
      const merged = { ...get().filledDims };
      for (const key of DIM_ORDER) {
        const value = remote.dims[key];
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
    scheduleRefreshPersona(set, get);
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

  /* ============ 今日日记 / 探索天数 ============ */
  todayEmoji: null,
  hasRemoteDiaryToday: false,
  exploredDays: 47,

  hasRecordedToday: () => get().analysis !== null || get().hasRemoteDiaryToday,

  todayDisplayEmoji: () => {
    const first = get().analysis?.emotions?.[0];
    if (first) return emotionEmoji(first, "");
    return get().todayEmoji ?? "";
  },

  async loadDiaryOverview() {
    const res = await withTimeout(20000, () =>
      callFunction<{ entries: RemoteDiaryEntry[] }>("list-diary", { limit: 50 }),
    );
    if (!res) return;
    const rows = res.entries ?? [];

    const emotionsByDay = new Map<string, string[]>();
    let earliest: Date | null = null;
    for (const row of rows) {
      const created = new Date(row.created_at);
      if (Number.isNaN(created.getTime())) continue;
      if (!earliest || created < earliest) earliest = created;
      const key = dayString(created);
      if (!emotionsByDay.has(key)) emotionsByDay.set(key, row.emotions ?? []);
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

    const todayKey = dayString(today);
    const todayEmotions = emotionsByDay.get(todayKey);
    set({
      hasRemoteDiaryToday: todayEmotions !== undefined,
      todayEmoji: todayEmotions ? emotionEmoji(todayEmotions[0], "") : null,
    });
  },
}));

/* ============ 私有：分析 / 形象生成 ============ */

type SetFn = (partial: Partial<HomeState>) => void;
type GetFn = () => HomeState;

/** 单次提交 analyze-diary（最多等 50s；情绪/关键词绝不由客户端伪造，必须来自服务端） */
async function runAnalysis(transcript: string, set: SetFn, get: GetFn) {
  const token = ++analyzeToken;
  set({ analyzing: true, analysisError: null });
  const result = await withTimeout(50000, () =>
    callFunction<DiaryAnalysis>("analyze-diary", { transcript, input_method: "text" }),
  );
  if (token !== analyzeToken) return; // 已被取消 / 覆盖
  if (result) {
    set({ analysis: result, analyzing: false });
    useData.getState().invalidateProfile();
    void get().loadDiaryOverview();
  } else {
    set({ analysis: null, analyzing: false, analysisError: "这次没能顺利分析，点「重试」再试一次。" });
  }
}

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
