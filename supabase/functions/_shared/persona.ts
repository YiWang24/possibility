import type { PersonaOutput } from "./schemas.ts";
import {
  type AIPermissions,
  authorizedProfileContext,
} from "./profile-permissions.ts";

/**
 * 动态画像离线兜底逻辑（对应原型 AI_INTEGRATION_PROMPTS.dynamicPersona）。
 * LLM 不可用时，按已授权画像文本确定性生成，保证 UI 永远有形象可渲染。
 * 逻辑与 LLM 输出契约一致（PersonaOutput），且纯函数、可单测。
 */

export const FORM_DEFS: Record<
  string,
  { name: string; hue: number; lobes: number }
> = {
  crystal: { name: "折光晶灵", hue: 216, lobes: 6 },
  bloom: { name: "共生花灵", hue: 286, lobes: 7 },
  wing: { name: "流光翼影", hue: 190, lobes: 4 },
  orbit: { name: "星轨旅者", hue: 248, lobes: 5 },
};

export type { AIPermissions } from "./profile-permissions.ts";

/**
 * AI 授权采用默认拒绝：只有维度明确设置 persona=true 才进入生成上下文。
 * 公开主页 visibility 与 AI 授权是两个独立概念，不能互相推导。
 */
export function authorizedPersonaContext(
  dims: Record<string, unknown>,
  permissions: AIPermissions,
): string {
  return authorizedProfileContext(dims, permissions, "persona").text;
}

/** 确定性哈希：同样的画像文本必然得到同样的 seed（0..99999）。 */
export function hashSeed(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash % 100_000;
}

/**
 * 依据画像关键词命中数选择形态，命中并列时用 seed 稳定决定，永远返回合法 PersonaOutput：
 * hue ∈ [0,360)、lobes ∈ [3,9]、seed ∈ [0,99999]。
 */
export function fallbackPersona(text: string): PersonaOutput {
  const signals: Record<string, number> = {
    crystal: (text.match(/结构|有序|计划|理性|思考|分析|原则|边界|才华/g) ?? [])
      .length,
    bloom:
      (text.match(/共情|陪伴|关系|家庭|亲情|朋友|人际|真诚|支持|爱|信任/g) ??
        []).length,
    wing: (text.match(/视觉|手绘|创造|审美|表达|自由|好奇|喜欢/g) ?? []).length,
    orbit: (text.match(/独处|探索|学习|尝试|成长|行动|勇气|坚强/g) ?? [])
      .length,
  };
  const seed = hashSeed(text || "屿岸·持续探索");
  const top = Math.max(...Object.values(signals));
  const candidates = Object.keys(signals).filter((k) => signals[k] === top);
  const form = candidates[seed % candidates.length] || "orbit";
  const def = FORM_DEFS[form];
  return {
    seed,
    shape: def.name,
    hue: ((def.hue + (seed % 23) - 11) % 360 + 360) % 360,
    lobes: def.lobes,
    summary: `由当前画像内容生成的${def.name}，象征你正在生长的探索状态。`,
  };
}
