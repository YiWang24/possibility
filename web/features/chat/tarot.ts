"use client";

import { callFunction, supabase } from "@/lib/supabase";

export const DAILY_TAROT_LIMIT = 3;

export type TarotShareChannel = "wechat" | "moments" | "xiaohongshu" | "weibo" | "other";
export type TarotPurchaseProduct = "subscription" | "credits15" | "credits100";

export interface TarotCard {
  id: string;
  name: string;
  numeral: string;
  symbol: string;
  light: string;
  shadow: string;
  action: string;
}

export interface DrawnTarotCard extends TarotCard {
  reversed: boolean;
}

export interface TarotReading {
  question: string;
  cards: DrawnTarotCard[];
  answer: string;
}

export interface TarotQuotaState {
  date: string;
  used: number;
  sharedChannels: TarotShareChannel[];
  shareRewardCount: number;
  purchasedCredits: number;
  subscriptionActive: boolean;
}

export interface LoadedTarotQuota {
  storageKey: string;
  state: TarotQuotaState;
}

interface RemoteTarotQuota {
  date: string;
  used: number;
  shared_channels: string[];
  share_reward_count?: number;
  remaining: number;
  allowed?: boolean;
  claimed?: boolean;
}

const TAROT_DECK: TarotCard[] = [
  { id: "fool", name: "愚者", numeral: "0", symbol: "✦", light: "新的尝试与开放性", shadow: "准备不足、只凭冲动", action: "先做一个可撤回的小实验" },
  { id: "magician", name: "魔术师", numeral: "I", symbol: "∞", light: "资源正在聚拢", shadow: "高估掌控力或包装", action: "列出手上真正可调用的三项资源" },
  { id: "priestess", name: "女祭司", numeral: "II", symbol: "☾", light: "安静观察与直觉", shadow: "关键信息仍藏在水面下", action: "先补一条最影响判断的事实" },
  { id: "empress", name: "皇后", numeral: "III", symbol: "❋", light: "滋养、增长与创造", shadow: "投入过多而缺少边界", action: "给成长设一个明确的资源上限" },
  { id: "emperor", name: "皇帝", numeral: "IV", symbol: "◇", light: "结构、秩序与执行", shadow: "过度控制或路径僵化", action: "把目标拆成可检查的里程碑" },
  { id: "hierophant", name: "教皇", numeral: "V", symbol: "✥", light: "经验、规则与可信指引", shadow: "被惯例和他人答案束缚", action: "找一位走过此路的人核对现实" },
  { id: "lovers", name: "恋人", numeral: "VI", symbol: "♡", light: "价值一致后的选择", shadow: "想同时保住所有可能", action: "先写下你最不愿交换掉的价值" },
  { id: "chariot", name: "战车", numeral: "VII", symbol: "➹", light: "方向明确、主动推进", shadow: "速度盖过了风险检查", action: "推进前设一个停止条件" },
  { id: "strength", name: "力量", numeral: "VIII", symbol: "♢", light: "稳定的韧性与耐心", shadow: "用硬撑代替真实调整", action: "把最消耗你的环节先减半" },
  { id: "hermit", name: "隐者", numeral: "IX", symbol: "⌁", light: "独立思考与内在校准", shadow: "信息闭环、越想越窄", action: "独处判断后再找外部证据复核" },
  { id: "wheel", name: "命运之轮", numeral: "X", symbol: "◌", light: "窗口变化、出现转机", shadow: "把偶然当成必然", action: "准备好机会出现时的触发动作" },
  { id: "justice", name: "正义", numeral: "XI", symbol: "⚖", light: "权衡、因果与边界", shadow: "只看对错，忽略真实代价", action: "用同一组标准比较收益与代价" },
  { id: "hanged", name: "倒吊人", numeral: "XII", symbol: "⌛", light: "换视角、暂缓有价值", shadow: "停滞被包装成等待", action: "为等待设置截止日与观察指标" },
  { id: "death", name: "死神", numeral: "XIII", symbol: "✧", light: "旧阶段结束后的更新", shadow: "抗拒必要的告别", action: "明确停止什么，才有空间开始什么" },
  { id: "temperance", name: "节制", numeral: "XIV", symbol: "≈", light: "整合、调配与渐进", shadow: "妥协过多导致方向模糊", action: "设计一个两边都能验证的过渡方案" },
  { id: "devil", name: "恶魔", numeral: "XV", symbol: "△", light: "看见欲望与现实牵引", shadow: "被恐惧、利益或执念绑住", action: "指出你最难承认的那项代价" },
  { id: "tower", name: "高塔", numeral: "XVI", symbol: "ϟ", light: "打破失真的旧假设", shadow: "突发变化与脆弱基础", action: "先检查最可能让计划失效的前提" },
  { id: "star", name: "星星", numeral: "XVII", symbol: "☆", light: "希望、方向感与恢复", shadow: "愿景尚未落到现实", action: "把愿景变成未来七天的一次行动" },
  { id: "moon", name: "月亮", numeral: "XVIII", symbol: "☽", light: "感受敏锐、梦境与想象", shadow: "焦虑让信号变得失真", action: "把事实、猜测和担心分成三列" },
  { id: "sun", name: "太阳", numeral: "XIX", symbol: "☼", light: "清晰、活力与可见成果", shadow: "过度乐观、忽略维护成本", action: "趁动力充足完成一个可展示成果" },
  { id: "judgement", name: "审判", numeral: "XX", symbol: "⌃", light: "复盘后的召唤与决定", shadow: "反复等待外界替你确认", action: "用过去的证据为自己做一次判断" },
  { id: "world", name: "世界", numeral: "XXI", symbol: "◎", light: "整合、完成与进入新周期", shadow: "执着完美收尾才肯开始", action: "定义何时算完成，然后进入下一步" },
];

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function freshQuota(): TarotQuotaState {
  return { date: localDateKey(), used: 0, sharedChannels: [], shareRewardCount: 0, purchasedCredits: 0, subscriptionActive: false };
}

function normalizeShareChannels(value: unknown): TarotShareChannel[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => item === "friend" ? "wechat" : item)
    .filter((item): item is TarotShareChannel =>
      item === "wechat" || item === "moments" || item === "xiaohongshu" || item === "weibo" || item === "other",
    );
  return [...new Set(normalized)];
}

async function quotaOwner(): Promise<string> {
  try {
    const { data } = await supabase().auth.getSession();
    return data.session?.user.id ?? "guest";
  } catch {
    return "guest";
  }
}

export async function loadTarotQuota(): Promise<LoadedTarotQuota> {
  const storageKey = `possibility:tarot-quota:v1:${await quotaOwner()}`;
  let local = freshQuota();
  if (typeof window === "undefined") return { storageKey, state: local };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as Partial<TarotQuotaState> | null;
    if (parsed && parsed.date === localDateKey()) {
      local = {
        date: parsed.date,
        used: Math.max(0, Number(parsed.used) || 0),
        sharedChannels: normalizeShareChannels(parsed.sharedChannels),
        shareRewardCount: Math.max(
          0,
          Number(parsed.shareRewardCount) || (normalizeShareChannels(parsed.sharedChannels).length > 0 ? 1 : 0),
        ),
        purchasedCredits: Math.max(0, Number(parsed.purchasedCredits) || 0),
        subscriptionActive: parsed.subscriptionActive === true,
      };
    }
  } catch {
    // localStorage 不可用时仍继续请求服务端。
  }
  try {
    const remote = await callFunction<RemoteTarotQuota>("tarot-quota", { action: "status" });
    const state = remoteState(remote, local);
    saveTarotQuota(storageKey, state);
    return { storageKey, state };
  } catch {
    // 新 Edge Function 尚未部署或离线时使用按账号隔离的本地缓存。
    return { storageKey, state: local };
  }
}

export function saveTarotQuota(storageKey: string, state: TarotQuotaState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

export function tarotRemaining(state: TarotQuotaState): number {
  if (state.subscriptionActive) return Number.POSITIVE_INFINITY;
  return Math.max(0, DAILY_TAROT_LIMIT + state.shareRewardCount - state.used) + state.purchasedCredits;
}

function remoteState(remote: RemoteTarotQuota, local: TarotQuotaState): TarotQuotaState {
  const remoteChannels = normalizeShareChannels(remote.shared_channels);
  return {
    date: remote.date || localDateKey(),
    used: Math.max(0, Number(remote.used) || 0),
    sharedChannels: [...new Set([...local.sharedChannels, ...remoteChannels])],
    shareRewardCount: Math.max(
      local.shareRewardCount,
      Math.max(0, Number(remote.share_reward_count) || (remoteChannels.length > 0 ? 1 : 0)),
    ),
    purchasedCredits: local.purchasedCredits,
    subscriptionActive: local.subscriptionActive,
  };
}

export async function consumeTarotAttempt(
  storageKey: string,
  current: TarotQuotaState,
): Promise<{ allowed: boolean; state: TarotQuotaState }> {
  if (current.subscriptionActive) return { allowed: true, state: current };
  try {
    const remote = await callFunction<RemoteTarotQuota>("tarot-quota", { action: "consume" });
    let state = remoteState(remote, current);
    if (remote.allowed !== true && state.purchasedCredits > 0) {
      state = { ...state, purchasedCredits: state.purchasedCredits - 1 };
      saveTarotQuota(storageKey, state);
      return { allowed: true, state };
    }
    saveTarotQuota(storageKey, state);
    return { allowed: remote.allowed === true, state };
  } catch {
    const hasDailyAttempt = current.used < DAILY_TAROT_LIMIT + current.shareRewardCount;
    if (!hasDailyAttempt && current.purchasedCredits <= 0) return { allowed: false, state: current };
    const state = hasDailyAttempt
      ? { ...current, used: current.used + 1 }
      : { ...current, purchasedCredits: current.purchasedCredits - 1 };
    saveTarotQuota(storageKey, state);
    return { allowed: true, state };
  }
}

export async function claimTarotShareReward(
  storageKey: string,
  current: TarotQuotaState,
  channel: TarotShareChannel,
): Promise<{ claimed: boolean; state: TarotQuotaState }> {
  const remoteChannel = channel === "wechat" ? "friend" : channel;
  try {
    const remote = await callFunction<RemoteTarotQuota>("tarot-quota", {
      action: "reward",
      channel: remoteChannel,
    });
    const state = remoteState(remote, current);
    saveTarotQuota(storageKey, state);
    return { claimed: remote.claimed === true, state };
  } catch {
    const state = {
      ...current,
      sharedChannels: [...new Set([...current.sharedChannels, channel])],
      shareRewardCount: current.shareRewardCount + 1,
    };
    saveTarotQuota(storageKey, state);
    return { claimed: true, state };
  }
}

export function applyTarotDemoPurchase(
  storageKey: string,
  current: TarotQuotaState,
  product: TarotPurchaseProduct,
): TarotQuotaState {
  const state = product === "subscription"
    ? { ...current, subscriptionActive: true }
    : {
        ...current,
        purchasedCredits: current.purchasedCredits + (product === "credits15" ? 15 : 100),
      };
  saveTarotQuota(storageKey, state);
  return state;
}

export function isUnclearQuestion(question: string): boolean {
  const clean = question.trim().replace(/[？?。！!，,]/g, "");
  if (clean.length < 4) return true;
  return /^(怎么办|怎么选|帮我看看|我该怎么办|给个建议|你觉得呢|看看未来)$/.test(clean);
}

export function isFuturePredictionQuestion(question: string): boolean {
  const clean = question.trim();
  if (!clean || isUnclearQuestion(clean)) return false;
  const highStakes = /(自杀|伤人|急救|疾病|确诊|吃药|治疗|法律责任|判刑|股票|基金|期货|彩票|博彩)/;
  if (highStakes.test(clean)) return false;
  const explicitMystic = /(塔罗|占卜|算命|运势|命运|吉凶|正缘|命中注定)/;
  const futureOutcome = /(未来|以后|最终|今年|明年|什么时候|何时|能否|是否|会不会|能不能).*(成功|复合|结婚|找到|实现|发生|有结果|顺利|录取|上岸|拿到|离开)/;
  const shortOutcome = /(成功吗|会复合吗|能结婚吗|会顺利吗|能上岸吗|结果会怎样|结局如何)/;
  return explicitMystic.test(clean) || futureOutcome.test(clean) || shortOutcome.test(clean);
}

function randomIndex(max: number): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function createTarotCandidates(count = 12): DrawnTarotCard[] {
  const pool = [...TAROT_DECK];
  const cards: DrawnTarotCard[] = [];
  while (pool.length > 0 && cards.length < count) {
    const [card] = pool.splice(randomIndex(pool.length), 1);
    cards.push({ ...card, reversed: randomIndex(2) === 1 });
  }
  return cards;
}

function cardMeaning(card: DrawnTarotCard): string {
  return card.reversed ? card.shadow : card.light;
}

function questionLens(question: string): { focus: string; experiment: string } {
  if (/(创业|事业|工作|转行|升职|项目|生意)/.test(question)) {
    return { focus: "这件事更取决于资源、节奏和验证，而不是一张“必成或必败”的判决", experiment: "先用真实客户、现金流或作品反馈验证最关键的商业假设" };
  }
  if (/(感情|恋爱|复合|结婚|对方|关系)/.test(question)) {
    return { focus: "关系的走向取决于双方真实行动，牌面只能帮你看见自己的期待与盲区", experiment: "观察一次具体沟通后的回应、边界和持续行动" };
  }
  if (/(考试|考研|录取|上岸|申请|面试)/.test(question)) {
    return { focus: "结果仍由准备质量和外部标准共同决定，牌面提示的是当前策略", experiment: "用一次模拟成绩或真实反馈检查最薄弱的一环" };
  }
  return { focus: "未来没有被牌面写死，这组象征更适合用来照见你的期待、风险和下一步", experiment: "选择一个七天内可完成、结果可观察的小行动" };
}

export function buildTarotReading(question: string, cards: DrawnTarotCard[]): TarotReading {
  const [present, friction, direction] = cards;
  const lens = questionLens(question);
  const directionTone = direction.reversed ? "尚未稳定，需要先处理阻力" : "存在向前展开的空间";
  const answer = [
    `先说结论：${directionTone}，但这不是对未来的保证。${lens.focus}。`,
    `三张牌把问题放在三个位置上：「${present.name}${present.reversed ? "·逆位" : ""}」显示当下更接近${cardMeaning(present)}；「${friction.name}${friction.reversed ? "·逆位" : ""}」提醒核心卡点可能是${cardMeaning(friction)}；「${direction.name}${direction.reversed ? "·逆位" : ""}」把行动走向指向${cardMeaning(direction)}。`,
    `把牌意落回现实：${direction.action}，并${lens.experiment}。等到这条证据出现，再判断“会不会”会更可靠。`,
  ].join("\n\n");
  return { question, cards, answer };
}
