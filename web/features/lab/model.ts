/* 人生实验室共享模型 —— 移植自 iOS LabModel / UserModels.SimulationHorizon / ResultView。
 * 后端契约：
 *   POST /lab-choices  { question, topic?, constraints?, previous_choices? }
 *     → { cards:[{id,glyph,title,description,color}], rationale }
 *   POST /simulate     { question, choice, years, time_horizon, carry_cards? }
 *     → { scenarios:{general,optimistic,cautionary}, bottom_line_analysis, recommended_traveler_ids } */
import type { Traveler } from "@/lib/models";
import type { CardIconKey } from "./CardIcon";
import { matchTitleDesc } from "./CardIcon";

/* ============ 时间跨度（对齐 SimulationHorizon 14 档） ============ */

export interface HorizonSpec {
  /** 稳定键（等价 iOS enum case） */
  key: string;
  /** 传给 /simulate 的 time_horizon，也是核心展示文案 */
  label: string;
  /** 表盘紧凑标签 */
  dialLabel: string;
  /** 传给 /simulate 的 years（短期档兼容为 1） */
  years: number;
}

export const HORIZONS: HorizonSpec[] = [
  { key: "day7", label: "7天", dialLabel: "7天", years: 1 },
  { key: "day30", label: "30天", dialLabel: "30天", years: 1 },
  { key: "month3", label: "3个月", dialLabel: "3月", years: 1 },
  { key: "month6", label: "6个月", dialLabel: "6月", years: 1 },
  { key: "year1", label: "1年", dialLabel: "1", years: 1 },
  { key: "year2", label: "2年", dialLabel: "2", years: 2 },
  { key: "year3", label: "3年", dialLabel: "3", years: 3 },
  { key: "year4", label: "4年", dialLabel: "4", years: 4 },
  { key: "year5", label: "5年", dialLabel: "5", years: 5 },
  { key: "year6", label: "6年", dialLabel: "6", years: 6 },
  { key: "year7", label: "7年", dialLabel: "7", years: 7 },
  { key: "year8", label: "8年", dialLabel: "8", years: 8 },
  { key: "year9", label: "9年", dialLabel: "9", years: 9 },
  { key: "year10", label: "10年", dialLabel: "10年", years: 10 },
];

/** 预设胶囊使用的档位（对齐 iOS presets 子集） */
export const PRESET_HORIZON_KEYS = [
  "day7",
  "day30",
  "month3",
  "month6",
  "year1",
  "year3",
  "year5",
  "year10",
];

export const DEFAULT_HORIZON_KEY = "year5";

export function horizonByKey(key: string): HorizonSpec {
  return HORIZONS.find((h) => h.key === key) ?? HORIZONS[8];
}

/* ============ 选择卡 ============ */

export interface Choice {
  /** 用卡名作稳定 id（同 iOS） */
  id: string;
  icon: CardIconKey;
  name: string;
  desc: string;
  isCustom: boolean;
  /** LLM 卡的 CSS 颜色提示；吸附品牌色后上卡面 */
  color?: string | null;
}

export const CUSTOM_CHOICES_KEY = "kaleido_custom_choices_v1";

/** localStorage 里的自定义卡形状（历史数据可能缺 icon） */
interface StoredCustomChoice {
  name: string;
  desc: string;
  icon?: string;
  color?: string | null;
}

export function loadCustomChoices(): Choice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_CHOICES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCustomChoice[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && typeof c.name === "string" && typeof c.desc === "string")
      .map((c) => ({
        id: c.name,
        name: c.name,
        desc: c.desc,
        isCustom: true,
        color: c.color ?? null,
        icon: (c.icon as CardIconKey) || matchTitleDesc(c.name, c.desc) || "custom",
      }));
  } catch {
    return [];
  }
}

export function persistCustomChoices(choices: Choice[]) {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredCustomChoice[] = choices.map((c) => ({
      name: c.name,
      desc: c.desc,
      icon: c.icon,
      color: c.color ?? null,
    }));
    window.localStorage.setItem(CUSTOM_CHOICES_KEY, JSON.stringify(payload));
  } catch {
    /* 写入失败静默：自定义卡是增强项，不阻断主流程 */
  }
}

/* ============ 底线卡（原型 carry-section / CARRY_META） ============ */

export interface CarryCard {
  id: string;
  icon: CardIconKey;
  name: string;
  source: string;
  /** 最坏结果里的底线风险描述（floor test） */
  risk: string;
}

export const CARRY_CARDS: CarryCard[] = [
  {
    id: "income",
    icon: "money",
    name: "稳定收入",
    source: "对话线索",
    risk: "转型不顺时，收入可能在一段时间内下降，生活安全感受到直接冲击。",
  },
  {
    id: "health",
    icon: "health",
    name: "身体不透支",
    source: "日记线索",
    risk: "反复尝试与加倍学习可能挤压睡眠和恢复时间，身体先替选择支付代价。",
  },
  {
    id: "relation",
    icon: "connect",
    name: "重要关系",
    source: "关系画像",
    risk: "压力与时间投入可能让你减少陪伴，也可能加剧家人对这次改变的不理解。",
  },
  {
    id: "craft",
    icon: "deepen",
    name: "专业积累",
    source: "职业画像",
    risk: "最差情况下，新岗位没有站稳，原有专业身份也因中断而需要重新证明。",
  },
  {
    id: "creation",
    icon: "create",
    name: "创造实感",
    source: "动态画像",
    risk: "你可能进入一个更偏协调和推进的岗位，却发现真正动手创造的时刻反而更少。",
  },
  {
    id: "exit",
    icon: "retreat",
    name: "保留退路",
    source: "风险预案",
    risk: "如果投入过深、现金流下降或履历断裂，回到原路径的成本会明显升高。",
  },
];

export function carryCardById(id: string): CarryCard | undefined {
  return CARRY_CARDS.find((c) => c.id === id);
}

export const LOAD_STEPS = [
  "读取你的动态画像……",
  "匹配 1,842 位相似旅人的经历……",
  "折出三种可能的未来……",
];

/* ============ 后端出入参（wire snake_case） ============ */

export interface LabChoiceCard {
  id: string;
  glyph: string;
  title: string;
  description: string;
  color: string;
}

export interface LabChoiceResponse {
  cards: LabChoiceCard[];
  rationale: string;
}

export interface ScenarioOut {
  headline: string;
  dimensions: { label: string; text: string }[];
  gains: string[];
  costs: string[];
  key_condition: string;
}

export interface BottomLineOut {
  is_acceptable: boolean;
  risks: string[];
  protective_conditions: string[];
}

export interface SimulateResponse {
  scenarios: {
    general: ScenarioOut;
    optimistic: ScenarioOut;
    cautionary: ScenarioOut;
  };
  bottom_line_analysis: BottomLineOut;
  recommended_traveler_ids: number[];
  /** 现固定为空数组，保留兼容 */
  recommended_travelers?: unknown[];
}

/** 推演结果视图数据 */
export interface SimResultData {
  question: string;
  choice: string;
  horizonLabel: string;
  scenarios: SimulateResponse["scenarios"];
  people: Traveler[];
  /** 带入的底线卡 id */
  carry: string[];
  bottomLine: BottomLineOut | null;
}
