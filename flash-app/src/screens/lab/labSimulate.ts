// Generate the three 人生推演 outcomes from the user's actual run, via
// `lingguang.ai.chat` with a json_schema response format.
//
// Only the *content* of each outcome comes from the model. The presentation shell
// (tab label, eyebrow, gradients, which panel carries the floor test) stays in
// SCENARIOS, so a model response can never break the layout.

import { getChat } from '@/lib/lingguangAi';
import { CARRY_META, type CarryCardKey } from '@/data/lab';
import { SCENARIOS, type LabRun, type Scenario, type ScenarioKey, type ScenarioList } from '@/data/lab-sim';

/** The per-outcome fields the model is allowed to fill in. */
export interface ScenarioContent {
  headline: string;
  dims: [string, string][];
  lists: [ScenarioList, ScenarioList];
  keyLead?: string;
  keyBold?: string;
}

export type SimulationContent = Record<ScenarioKey, ScenarioContent>;

const DIM_LABELS = ['职业状态', '收入趋势', '生活节奏', '内心感受'] as const;

const SYSTEM_PROMPT = [
  '你在为一款帮助 22–30 岁年轻人想清人生岔路口的产品，生成一次「人生推演」的结果。',
  '用户给出了一个真实的纠结、选定了一条路、设定了推演年数，可能还带上了几张「不愿交换的底线卡」。',
  '你要沿着这条路推演出三种结局：最好的结果(best)、大概率的结果(likely)、最坏的结果(worst)。',
  '',
  '硬性要求：',
  `- 每种结局的 dims 必须恰好四条，标签依次是：${DIM_LABELS.join('、')}，每条描述不超过 20 字。`,
  '- 每种结局的 lists 必须恰好两组，各 3 条：',
  '  best 用「可能获得」+「需要满足的条件」；',
  '  likely 用「大概率发生」+「需要你付出的」；',
  '  worst 用「可能失去」+「可以提前防的」。',
  '- headline 一句话，写出这条路在该结局下用户会变成什么样，不超过 40 字。',
  '- likely 额外给出 keyLead 和 keyBold：keyLead 是引导语（如「这条路最关键的条件是」），keyBold 是那个条件本身，不超过 20 字。',
  '',
  '写作要求：',
  '- 必须紧扣用户实际提的问题和选的那条路，不要写成放之四海皆准的职业建议。',
  '- 用户带了底线卡时，三种结局都要正面回应这些底线会不会被侵蚀。',
  '- 具体、克制、可验证。不要打鸡血，不要说「相信自己」这类空话。',
  '- 最坏的结果要真的坏，不要粉饰；但要给出可提前防范的动作，而不是制造恐慌。',
  '- 全部使用中文。',
].join('\n');

function contentSchema(withKey: boolean): Record<string, unknown> {
  const listSchema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      items: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
    },
    required: ['title', 'items'],
    additionalProperties: false,
  };
  const properties: Record<string, unknown> = {
    headline: { type: 'string' },
    dims: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, value: { type: 'string' } },
        required: ['label', 'value'],
        additionalProperties: false,
      },
    },
    lists: { type: 'array', minItems: 2, maxItems: 2, items: listSchema },
  };
  const required = ['headline', 'dims', 'lists'];
  if (withKey) {
    properties['keyLead'] = { type: 'string' };
    properties['keyBold'] = { type: 'string' };
    required.push('keyLead', 'keyBold');
  }
  return { type: 'object', properties, required, additionalProperties: false };
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    best: contentSchema(false),
    likely: contentSchema(true),
    worst: contentSchema(false),
  },
  required: ['best', 'likely', 'worst'],
  additionalProperties: false,
};

export function buildRunPrompt(run: LabRun): string {
  const lines = [`我的纠结：${run.question}`, `我选择的这条路：${run.pick}`, `推演时间跨度：${String(run.year)} 年后`];
  if (run.carry.length > 0) {
    const names = run.carry.map((key: CarryCardKey) => CARRY_META[key].name);
    lines.push(`我不愿交换的底线：${names.join('、')}`);
  } else {
    lines.push('我这一轮没有指定不愿交换的底线。');
  }
  return lines.join('\n');
}

// ---- defensive parsing -------------------------------------------------------

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseDims(raw: unknown, fallback: readonly (readonly [string, string])[]): [string, string][] {
  const list: unknown[] = Array.isArray(raw) ? raw : [];
  const dims: [string, string][] = [];
  for (let i = 0; i < DIM_LABELS.length; i++) {
    const item = list[i];
    const value = typeof item === 'object' && item !== null ? readString(item as Record<string, unknown>, 'value') : '';
    // Labels are fixed by the product, not the model — only the value is generated.
    dims.push([DIM_LABELS[i] ?? '', value === '' ? (fallback[i]?.[1] ?? '') : value]);
  }
  return dims;
}

function parseList(raw: unknown, fallback: ScenarioList): ScenarioList {
  if (typeof raw !== 'object' || raw === null) return fallback;
  const source = raw as Record<string, unknown>;
  const title = readString(source, 'title');
  const items = (Array.isArray(source['items']) ? source['items'] : [])
    .filter((i): i is string => typeof i === 'string')
    .map((i) => i.trim())
    .filter((i) => i !== '');
  if (items.length === 0) return fallback;
  // accent is a CSS colour owned by the design, never by the model.
  return { title: title === '' ? fallback.title : title, accent: fallback.accent, items };
}

function parseOne(raw: unknown, fallback: Scenario): ScenarioContent {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const headline = readString(source, 'headline');
  const rawLists = Array.isArray(source['lists']) ? source['lists'] : [];
  const content: ScenarioContent = {
    headline: headline === '' ? fallback.headline : headline,
    dims: parseDims(source['dims'], fallback.dims),
    lists: [parseList(rawLists[0], fallback.lists[0]), parseList(rawLists[1], fallback.lists[1])],
  };
  if (fallback.keyBold !== undefined) {
    const keyLead = readString(source, 'keyLead');
    const keyBold = readString(source, 'keyBold');
    content.keyLead = keyLead === '' ? (fallback.keyLead ?? '') : keyLead;
    content.keyBold = keyBold === '' ? fallback.keyBold : keyBold;
  }
  return content;
}

/**
 * Read the three outcomes out of a host response.
 *
 * Returns null only when nothing usable came back; individual missing fields fall
 * back to the seeded copy so a partial response still renders a complete page.
 */
export function parseSimulation(result: { content?: unknown; data?: unknown }): SimulationContent | null {
  let payload: unknown = result.data;
  if (typeof payload !== 'object' || payload === null) {
    if (typeof result.content !== 'string') return null;
    try {
      payload = JSON.parse(result.content) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const source = payload as Record<string, unknown>;
  if (!('best' in source) && !('likely' in source) && !('worst' in source)) return null;

  const out = {} as SimulationContent;
  for (const scenario of SCENARIOS) {
    out[scenario.key] = parseOne(source[scenario.key], scenario);
  }
  return out;
}

/** Merge generated content onto the static presentation shell. */
export function applySimulation(content: SimulationContent | null): Scenario[] {
  if (!content) return SCENARIOS;
  return SCENARIOS.map((s) => {
    const generated = content[s.key];
    return {
      ...s,
      headline: generated.headline,
      dims: generated.dims,
      lists: generated.lists,
      ...(generated.keyLead !== undefined ? { keyLead: generated.keyLead } : {}),
      ...(generated.keyBold !== undefined ? { keyBold: generated.keyBold } : {}),
    };
  });
}

/**
 * Run one simulation. Returns null when the capability is missing or the response
 * is unusable, which the caller renders as the seeded outcomes.
 */
export async function simulateLabRun(run: LabRun): Promise<SimulationContent | null> {
  const chat = getChat();
  if (!chat) return null;
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildRunPrompt(run) },
    ],
    responseFormat: { type: 'json_schema', jsonSchema: { name: 'life_simulation', schema: RESPONSE_SCHEMA } },
    timeout: 90000,
  });
  return parseSimulation(result);
}
