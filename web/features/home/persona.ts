/* 画像驱动的抽象数字形象模型 —— 移植 iOS PersonaCanvasView.swift 的 PersonaModel。
   由画像快照文本 FNV-1a 哈希 + 关键词计分选出 4 种形态之一：
   折光晶灵(crystal) / 共生花灵(bloom) / 流光翼影(wing) / 星轨旅者(orbit)。
   mulberry32 种子随机保证同一画像稳定复现。纯 TS，无 React 依赖。 */

export type PersonaForm = "crystal" | "bloom" | "wing" | "orbit";

export interface PersonaModel {
  seed: number;
  filled: number;
  signature: string[];
  form: PersonaForm;
  hue: number;
  lobes: number;
  shapeName: string;
}

/** 云端 /persona 出参里的形象参数（_shared/schemas.ts personaSchema） */
export interface PersonaData {
  shape: string;
  hue: number;
  lobes: number;
  seed: number;
  summary: string;
}

/** FNV-1a 32 位哈希（对照原型 dynamicPersonaHash，UTF-16 码元） */
function fnv1a(text: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/** 由画像内容构建（对照原型 currentPersonaSnapshot + refreshDynamicPersona） */
export function buildPersonaModel(values: string[], signature: string[]): PersonaModel {
  const text = [...values, ...signature].join("|");
  const seed = fnv1a(text.length === 0 ? "老己·持续探索" : text);
  const content = [...values, ...signature].join(" ");

  const score = (words: string[]): number =>
    words.reduce((acc, w) => acc + (content.split(w).length - 1), 0);

  const signals: [PersonaForm, number, number, number, string][] = [
    [
      "crystal",
      score(["结构", "有序", "计划", "理性", "思考", "分析", "原则", "边界", "才华", "智商"]),
      216,
      6,
      "折光晶灵",
    ],
    [
      "bloom",
      score([
        "共情", "陪伴", "关系", "家庭", "亲情", "朋友", "人际", "真诚", "尊重", "回应",
        "交流", "支持", "爱", "善良", "信任",
      ]),
      286,
      7,
      "共生花灵",
    ],
    ["wing", score(["视觉", "手绘", "创造", "审美", "表达", "自由", "好奇", "喜欢"]), 190, 4, "流光翼影"],
    ["orbit", score(["独处", "探索", "学习", "尝试", "成长", "行动", "勇气", "坚强"]), 248, 5, "星轨旅者"],
  ];

  const top = Math.max(...signals.map((s) => s[1]), 0);
  const candidates = signals.filter((s) => s[1] === top);
  const pick = candidates[seed % candidates.length];
  return {
    seed,
    filled: values.length,
    signature,
    form: pick[0],
    hue: pick[2] + ((seed % 23) - 11),
    lobes: pick[3],
    shapeName: pick[4],
  };
}

/** 后端 shape（中文形态名或英文 key）→ 本地绘制形态；未知形态返回 null 走本地计算 */
export function personaFormNamed(shape: string): PersonaForm | null {
  const lower = shape.toLowerCase();
  if (lower.includes("crystal") || shape.includes("晶")) return "crystal";
  if (lower.includes("bloom") || shape.includes("花")) return "bloom";
  if (lower.includes("wing") || shape.includes("翼")) return "wing";
  if (lower.includes("orbit") || shape.includes("星") || shape.includes("轨")) return "orbit";
  return null;
}

/** 合并云端 persona → 本地形象（对照 HomeModel.personaModel） */
export function personaModelFrom(
  values: string[],
  signature: string[],
  remote: PersonaData | null,
): PersonaModel {
  const local = buildPersonaModel(values, signature);
  if (!remote) return local;
  return {
    seed: Math.max(0, remote.seed) >>> 0,
    filled: values.length,
    signature,
    form: personaFormNamed(remote.shape) ?? local.form,
    hue: remote.hue,
    lobes: Math.min(Math.max(remote.lobes, 3), 9),
    shapeName: remote.shape,
  };
}

/** mulberry32 种子随机（对照原型 dynamicPersonaRandom） */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
