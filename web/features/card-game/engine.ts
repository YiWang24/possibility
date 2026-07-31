/* 卡牌游戏通用引擎 —— 1:1 移植自 iOS CardGameEngine.swift（原型 lifeState / relationshipState / valueGameState 状态机）
 *
 * intro → 选 9 张 → 每轮：抽情境（按压力就近取 5 张）→ 决策（接受 加压 / 交换弃 2 张 减压）
 * → 手中自然剩 3 张 → 结果分析。人生卡牌额外生成深层画像（lifeAnalysis）。
 *
 * 纯 TS，无 React 依赖，可单测；持久化通过可注入的 StorageLike（默认 localStorage）。
 */

import { cardGameScenarioOptions } from "@possibility/shared-types";
import {
  type CardGameConfig,
  type CardGameKind,
  type GameCard,
  type GameScenario,
  CARD_GAME_KINDS,
  cardGameConfig,
  scenariosForTradeCount,
} from "./data";

export type Phase = "intro" | "select" | "draw" | "decision" | "trade" | "result";
export type TradeDecisionSource = "voluntary_reject" | "pressure_forced";

export interface AcceptedEntry {
  round: number;
  scenario: GameScenario;
  severity: number;
}

export interface TradedEntry {
  round: number;
  scenario: GameScenario;
  ids: string[];
  cannotAccept: string;
  abandon: string;
  decisionSource: TradeDecisionSource;
}

/* ============ 本地存储（对齐 iOS CardGameLocalRecord） ============ */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const memoryMap = new Map<string, string>();
const memoryStorage: StorageLike = {
  getItem: (k) => memoryMap.get(k) ?? null,
  setItem: (k, v) => {
    memoryMap.set(k, v);
  },
  removeItem: (k) => {
    memoryMap.delete(k);
  },
};

export function defaultStorage(): StorageLike {
  if (typeof window !== "undefined") {
    try {
      const s = window.localStorage;
      s.getItem("__probe__");
      return s;
    } catch {
      /* 隐私模式等场景退回内存 */
    }
  }
  return memoryStorage;
}

export function userScopedCardGameStorage(
  userId: string,
  base: StorageLike = defaultStorage(),
): StorageLike {
  const scoped = (key: string) => `card_game_user:${userId}:${key}`;
  return {
    getItem(key) {
      const value = base.getItem(scoped(key));
      if (value !== null) return value;
      // One-time migration of the pre-v2 unscoped cache to the currently
      // authenticated user. Removing it prevents later account contamination.
      const legacy = base.getItem(key);
      if (legacy !== null) {
        base.setItem(scoped(key), legacy);
        base.removeItem(key);
      }
      return legacy;
    },
    setItem(key, value) {
      base.setItem(scoped(key), value);
    },
    removeItem(key) {
      base.removeItem(scoped(key));
    },
  };
}

function doneKey(kind: CardGameKind) {
  return `kaleido_cardgame_done_${kind}`;
}
function progressKey(kind: CardGameKind) {
  return `kaleido_cardgame_progress_${kind}_v1`;
}

export const CardGameLocalRecord = {
  isDone(kind: CardGameKind, store: StorageLike = defaultStorage()): boolean {
    return store.getItem(doneKey(kind)) === "1";
  },
  markDone(kind: CardGameKind, store: StorageLike = defaultStorage()) {
    store.setItem(doneKey(kind), "1");
  },
  saveProgress(data: string, kind: CardGameKind, store: StorageLike = defaultStorage()) {
    store.setItem(progressKey(kind), data);
  },
  progressData(kind: CardGameKind, store: StorageLike = defaultStorage()): string | null {
    return store.getItem(progressKey(kind));
  },
  clearProgress(kind: CardGameKind, store: StorageLike = defaultStorage()) {
    store.removeItem(progressKey(kind));
  },
  hasProgress(kind: CardGameKind, store: StorageLike = defaultStorage()): boolean {
    return this.progressData(kind, store) !== null;
  },
  doneKinds(
    store: StorageLike = defaultStorage(),
    kinds: readonly CardGameKind[] = CARD_GAME_KINDS,
  ): Set<CardGameKind> {
    return new Set(kinds.filter((k) => this.isDone(k, store)));
  },
  progressKinds(
    store: StorageLike = defaultStorage(),
    kinds: readonly CardGameKind[] = CARD_GAME_KINDS,
  ): Set<CardGameKind> {
    return new Set(kinds.filter((k) => this.hasProgress(k, store)));
  },
};

/* ============ 局内快照 ============ */

interface AcceptedSnapshot {
  round: number;
  title: string;
  severity: number;
}

interface TradedSnapshot {
  round: number;
  title: string;
  ids: string[];
  cannotAccept: string;
  abandon: string;
  decisionSource?: TradeDecisionSource;
}

interface ProgressSnapshot {
  version: number;
  kind: string;
  phase: Phase;
  selected: string[];
  held: string[];
  accepted: AcceptedSnapshot[];
  traded: TradedSnapshot[];
  round: number;
  pressure: number;
  acceptStreak: number;
  seenTitles: string[];
  currentTitle: string | null;
  tradePick: string[];
  reasonCannotAccept: string;
  reasonAbandon: string;
}

/* ============ 引擎 ============ */

export class CardGameEngine {
  readonly config: CardGameConfig;
  private store: StorageLike;

  phase: Phase = "intro";
  /** 选牌顺序即持有顺序 */
  selected: string[] = [];
  held: string[] = [];
  accepted: AcceptedEntry[] = [];
  traded: TradedEntry[] = [];
  round = 0;
  pressure = 1;
  acceptStreak = 0;
  seenTitles: Set<string> = new Set();
  current: GameScenario | null = null;
  tradePick: string[] = [];
  reasonCannotAccept = "";
  reasonAbandon = "";
  scenarioSeed = 0;

  constructor(
    kind: CardGameKind,
    configOrStore?: CardGameConfig | StorageLike,
    store: StorageLike = defaultStorage(),
  ) {
    if (
      configOrStore &&
      "getItem" in configOrStore &&
      "setItem" in configOrStore
    ) {
      this.config = cardGameConfig(kind);
      this.store = configOrStore;
    } else {
      this.config = configOrStore ?? cardGameConfig(kind);
      this.store = store;
    }
    this.restoreProgress();
  }

  get initialSelectCount(): number {
    return this.config.dynamicRules?.initial_select_count ?? 9;
  }

  get finalCardCount(): number {
    return this.config.dynamicRules?.final_card_count ?? 3;
  }

  get discardPerTrade(): number {
    return this.config.dynamicRules?.discard_per_trade ?? 2;
  }

  get scenarioChoiceCount(): number {
    return this.config.dynamicRules?.scenario_choice_count ?? 5;
  }

  get pressureMin(): number {
    return this.config.dynamicRules?.pressure.min ?? 1;
  }

  get pressureMax(): number {
    return this.config.dynamicRules?.pressure.max ??
      this.config.severityMeta.length;
  }

  get pressureInitial(): number {
    return this.config.dynamicRules?.pressure.initial ?? 1;
  }

  card(id: string): GameCard {
    return this.config.cards.find((c) => c.id === id)!;
  }

  get heldCards(): GameCard[] {
    return this.held.map((id) => this.card(id));
  }

  get severityMeta(): { name: string; copy: string } {
    const index = Math.max(
      0,
      Math.min(
        this.config.severityMeta.length - 1,
        this.pressure - this.pressureMin,
      ),
    );
    return this.config.severityMeta[index];
  }

  /** 顶部进度（原型 lifeGameProgress） */
  progress(extra = 0): number {
    switch (this.phase) {
      case "intro":
        return 0;
      case "select":
        return Math.max(0.04, this.selected.length * 0.02);
      case "result":
        return 1;
      default: {
        const releasable = this.initialSelectCount - this.finalCardCount;
        const released = releasable === 0
          ? 1
          : (this.initialSelectCount - this.held.length) / releasable;
        return Math.min(0.96, 0.16 + released * 0.72 + Math.min(this.round, 8) * 0.015 + extra);
      }
    }
  }

  /* ==== 流程 ==== */

  start() {
    this.selected = [];
    this.held = [];
    this.accepted = [];
    this.traded = [];
    this.round = 0;
    this.pressure = this.pressureInitial;
    this.acceptStreak = 0;
    this.seenTitles = new Set();
    this.current = null;
    this.tradePick = [];
    this.reasonCannotAccept = "";
    this.reasonAbandon = "";
    this.phase = "select";
    this.saveProgress();
  }

  /** 选牌开关；满 9 张时返回提示 */
  toggleSelect(id: string): string | null {
    const i = this.selected.indexOf(id);
    if (i >= 0) {
      this.selected.splice(i, 1);
    } else if (this.selected.length < this.initialSelectCount) {
      this.selected.push(id);
    } else {
      return `这一局只能带走 ${this.initialSelectCount} 张底牌`;
    }
    this.saveProgress();
    return null;
  }

  confirmSelection() {
    if (this.selected.length !== this.initialSelectCount) return;
    this.held = [...this.selected];
    this.round = 0;
    this.pressure = this.pressureInitial;
    this.acceptStreak = 0;
    this.seenTitles = new Set();
    this.phase = "draw";
    this.saveProgress();
  }

  /** 抽牌候选（原型 stageOptions：优先压力邻近、未出现过的情境） */
  get scenarioOptions(): GameScenario[] {
    if (this.config.sourceCatalog) {
      const byKey = new Map(
        this.config.scenarioRounds.flat().map((scenario) => [
          scenario.key,
          scenario,
        ]),
      );
      return cardGameScenarioOptions(
        this.config.sourceCatalog,
        {
          phase: this.phase === "intro" ? "select" : this.phase,
          selected_card_keys: [...this.selected],
          held_card_keys: [...this.held],
          seen_scenario_keys: [...this.seenTitles].flatMap((title) => {
            const scenario = this.config.scenarioRounds
              .flat()
              .find((candidate) => candidate.title === title);
            return scenario?.key ? [scenario.key] : [];
          }),
          current_scenario_key: this.current?.key ?? null,
          round_count: this.round,
          accept_count: this.accepted.length,
          trade_count: this.traded.length,
          pressure: this.pressure,
        },
        this.scenarioSeed,
      ).flatMap((scenario) => {
        const mapped = byKey.get(scenario.key);
        return mapped ? [mapped] : [];
      });
    }
    const pool = scenariosForTradeCount(this.config, this.traded.length);
    const candidates = pool.map((scenario, index) => ({
      scenario,
      distance: Math.abs(scenario.severity - this.pressure),
      seen: this.seenTitles.has(scenario.title) ? 1 : 0,
      order: (index * 7 + this.round * 11) % 23,
    }));
    candidates.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.seen !== b.seen) return a.seen - b.seen;
      return a.order - b.order;
    });
    return candidates.slice(0, this.scenarioChoiceCount).map((c) =>
      c.scenario
    );
  }

  draw(scenario: GameScenario) {
    this.current = scenario;
    this.seenTitles.add(scenario.title);
    this.phase = "decision";
    this.saveProgress();
  }

  get canTrade(): boolean {
    return this.held.length - this.discardPerTrade >= this.finalCardCount;
  }

  get canAccept(): boolean {
    return this.phase === "decision" && this.pressure < this.pressureMax;
  }

  get isForcedTrade(): boolean {
    return (this.phase === "decision" || this.phase === "trade") &&
      this.pressure >= this.pressureMax;
  }

  accept() {
    if (!this.current || !this.canAccept) return;
    this.accepted.push({ round: this.round, scenario: this.current, severity: this.pressure });
    this.acceptStreak += 1;
    const delta = this.config.dynamicRules?.pressure.accept_delta ?? 1;
    this.pressure = Math.min(this.pressureMax, this.pressure + delta);
    this.finishRound();
  }

  beginTrade() {
    this.tradePick = [];
    this.reasonCannotAccept = "";
    this.reasonAbandon = "";
    this.phase = "trade";
    this.saveProgress();
  }

  toggleTrade(id: string): string | null {
    const i = this.tradePick.indexOf(id);
    if (i >= 0) {
      this.tradePick.splice(i, 1);
    } else if (this.tradePick.length < this.discardPerTrade) {
      this.tradePick.push(id);
    } else {
      return `这一轮需要交换 ${this.discardPerTrade} 张底牌`;
    }
    this.saveProgress();
    return null;
  }

  confirmTrade() {
    if (this.tradePick.length !== this.discardPerTrade || !this.current) return;
    const decisionSource: TradeDecisionSource = this.isForcedTrade
      ? "pressure_forced"
      : "voluntary_reject";
    this.traded.push({
      round: this.round,
      scenario: this.current,
      ids: [...this.tradePick],
      cannotAccept: this.reasonCannotAccept.trim(),
      abandon: this.reasonAbandon.trim(),
      decisionSource,
    });
    this.held = this.held.filter((id) => !this.tradePick.includes(id));
    this.tradePick = [];
    this.acceptStreak = 0;
    const delta = this.config.dynamicRules?.pressure.trade_delta ?? -1;
    this.pressure = Math.max(
      this.pressureMin,
      Math.min(this.pressureMax, this.pressure + delta),
    );
    this.finishRound();
  }

  private finishRound() {
    this.round += 1;
    this.current = null;
    this.phase = this.held.length === this.finalCardCount ? "result" : "draw";
    this.saveProgress();
  }

  returnToDraw() {
    this.current = null;
    this.tradePick = [];
    this.reasonCannotAccept = "";
    this.reasonAbandon = "";
    this.phase = "draw";
    this.saveProgress();
  }

  cancelTrade() {
    this.tradePick = [];
    this.phase = "decision";
    this.saveProgress();
  }

  /** life 三段轮次信息（其余游戏返回轮次文案） */
  get stageMeta(): { age: string; name: string } {
    if (this.config.stageMeta?.length) {
      const stage = [...this.config.stageMeta]
        .filter((candidate) =>
          candidate.activateAfterTrades <= this.traded.length
        )
        .sort((a, b) =>
          b.activateAfterTrades - a.activateAfterTrades
        )[0];
      if (stage) return { age: stage.age, name: stage.name };
    }
    return { age: `第 ${this.round + 1} 轮`, name: this.config.title };
  }

  /* ==== 结果保存 ==== */

  /** 本地完成标记（对齐 iOS saveResultLocally 的记录部分；返回三张底牌名称） */
  saveResultLocally(): string[] {
    const tags = this.heldCards.map((c) => c.name);
    CardGameLocalRecord.markDone(this.config.kind, this.store);
    this.saveProgress();
    return tags;
  }

  /** 云端成功后清除可重试快照 */
  clearProgressAfterSync() {
    CardGameLocalRecord.clearProgress(this.config.kind, this.store);
  }

  /** 整局结果上云请求体：action=save_card_game，kind + 最终 3 张底牌 + 轮次 + 接受/交换记录 */
  buildSavePayload(): Record<string, unknown> {
    return {
      action: "save_card_game",
      kind: this.config.kind,
      final_cards: this.heldCards.map((c) => ({
        id: c.id,
        name: c.name,
        glyph: c.glyph,
        group: c.group,
      })),
      rounds: this.round,
      accepted: this.accepted.map((e) => ({
        round: e.round,
        scenario: e.scenario.title,
        severity: e.severity,
      })),
      traded: this.traded.map((e) => ({
        round: e.round,
        scenario: e.scenario.title,
        ids: e.ids,
        decision_source: e.decisionSource,
        reasons: [e.cannotAccept, e.abandon].filter((s) => s.length > 0),
      })),
    };
  }

  /* ==== 局内快照 ==== */

  saveProgress() {
    if (this.phase === "intro") {
      CardGameLocalRecord.clearProgress(this.config.kind, this.store);
      return;
    }
    const snapshot: ProgressSnapshot = {
      version: 1,
      kind: this.config.kind,
      phase: this.phase,
      selected: [...this.selected],
      held: [...this.held],
      accepted: this.accepted.map((e) => ({
        round: e.round,
        title: e.scenario.title,
        severity: e.severity,
      })),
      traded: this.traded.map((e) => ({
        round: e.round,
        title: e.scenario.title,
        ids: [...e.ids],
        cannotAccept: e.cannotAccept,
        abandon: e.abandon,
        decisionSource: e.decisionSource,
      })),
      round: this.round,
      pressure: this.pressure,
      acceptStreak: this.acceptStreak,
      seenTitles: [...this.seenTitles],
      currentTitle: this.current?.title ?? null,
      tradePick: [...this.tradePick],
      reasonCannotAccept: this.reasonCannotAccept,
      reasonAbandon: this.reasonAbandon,
    };
    try {
      CardGameLocalRecord.saveProgress(JSON.stringify(snapshot), this.config.kind, this.store);
    } catch {
      /* 存储满等异常静默忽略 */
    }
  }

  private restoreProgress() {
    const data = CardGameLocalRecord.progressData(this.config.kind, this.store);
    if (data === null) return;
    let snapshot: ProgressSnapshot;
    try {
      snapshot = JSON.parse(data) as ProgressSnapshot;
    } catch {
      CardGameLocalRecord.clearProgress(this.config.kind, this.store);
      return;
    }
    if (!this.isValidSnapshot(snapshot)) {
      CardGameLocalRecord.clearProgress(this.config.kind, this.store);
      return;
    }
    const scenarioByTitle = this.scenarioByTitle();
    this.phase = snapshot.phase;
    this.selected = [...snapshot.selected];
    this.held = [...snapshot.held];
    this.accepted = snapshot.accepted.map((e) => ({
      round: e.round,
      scenario: scenarioByTitle.get(e.title)!,
      severity: e.severity,
    }));
    this.traded = snapshot.traded.map((e) => ({
      round: e.round,
      scenario: scenarioByTitle.get(e.title)!,
      ids: [...e.ids],
      cannotAccept: e.cannotAccept,
      abandon: e.abandon,
      decisionSource: e.decisionSource ?? "voluntary_reject",
    }));
    this.round = snapshot.round;
    this.pressure = snapshot.pressure;
    this.acceptStreak = snapshot.acceptStreak;
    this.seenTitles = new Set(snapshot.seenTitles.filter((t) => scenarioByTitle.has(t)));
    this.current =
      snapshot.currentTitle !== null ? (scenarioByTitle.get(snapshot.currentTitle) ?? null) : null;
    this.tradePick = [...snapshot.tradePick];
    this.reasonCannotAccept = snapshot.reasonCannotAccept;
    this.reasonAbandon = snapshot.reasonAbandon;
  }

  private scenarioByTitle(): Map<string, GameScenario> {
    const map = new Map<string, GameScenario>();
    for (const pool of this.config.scenarioRounds) {
      for (const s of pool) if (!map.has(s.title)) map.set(s.title, s);
    }
    return map;
  }

  /** 快照全量校验（对齐 iOS restoreProgress 的 guard 链） */
  private isValidSnapshot(s: ProgressSnapshot): boolean {
    const phases: Phase[] = ["intro", "select", "draw", "decision", "trade", "result"];
    if (
      typeof s !== "object" ||
      s === null ||
      s.version !== 1 ||
      s.kind !== this.config.kind ||
      !phases.includes(s.phase) ||
      !Array.isArray(s.selected) ||
      !Array.isArray(s.held) ||
      !Array.isArray(s.accepted) ||
      !Array.isArray(s.traded) ||
      !Array.isArray(s.seenTitles) ||
      !Array.isArray(s.tradePick) ||
      !Number.isInteger(s.round) ||
      !Number.isInteger(s.pressure) ||
      !Number.isInteger(s.acceptStreak) ||
      typeof s.reasonCannotAccept !== "string" ||
      typeof s.reasonAbandon !== "string"
    ) {
      return false;
    }
    const isStrArr = (a: unknown[]): a is string[] => a.every((x) => typeof x === "string");
    if (!isStrArr(s.selected) || !isStrArr(s.held) || !isStrArr(s.seenTitles) || !isStrArr(s.tradePick)) {
      return false;
    }
    const validCardIDs = new Set(this.config.cards.map((c) => c.id));
    const scenarioByTitle = this.scenarioByTitle();
    const tradedIDs = s.traded.flatMap((e) => e.ids ?? []);
    const requiresCurrent = s.phase === "decision" || s.phase === "trade";
    const heldSet = new Set(s.held);
    const isSubset = (sub: Iterable<string>, sup: Set<string>) =>
      [...sub].every((x) => sup.has(x));
    if (
      new Set(s.selected).size !== s.selected.length ||
      heldSet.size !== s.held.length ||
      new Set(s.tradePick).size !== s.tradePick.length ||
      !isSubset(s.selected, validCardIDs) ||
      !isSubset(s.held, validCardIDs) ||
      !isSubset(s.tradePick, heldSet) ||
      s.selected.length > this.initialSelectCount ||
      s.held.length > this.initialSelectCount ||
      s.pressure < this.pressureMin ||
      s.pressure > this.pressureMax ||
      s.round < 0 ||
      s.acceptStreak < 0 ||
      (s.phase === "result" &&
        s.held.length !== this.finalCardCount) ||
      (s.phase !== "select" &&
        s.selected.length !== this.initialSelectCount) ||
      (s.phase !== "select" &&
        s.held.length < this.finalCardCount) ||
      (s.phase !== "select" && !isSubset(s.held, new Set(s.selected))) ||
      (s.phase !== "select" &&
        s.held.length !==
          this.initialSelectCount -
            s.traded.length * this.discardPerTrade) ||
      new Set(tradedIDs).size !== tradedIDs.length ||
      tradedIDs.some((id) => heldSet.has(id)) ||
      s.round !== s.accepted.length + s.traded.length ||
      (requiresCurrent && s.currentTitle == null) ||
      (s.phase === "trade" &&
        s.tradePick.length > this.discardPerTrade)
    ) {
      return false;
    }
    for (const e of s.accepted) {
      if (
        !Number.isInteger(e.round) ||
        e.round < 0 ||
        typeof e.title !== "string" ||
        !scenarioByTitle.has(e.title) ||
        !Number.isInteger(e.severity) ||
        e.severity < 1 ||
        e.severity > this.pressureMax
      ) {
        return false;
      }
    }
    for (const e of s.traded) {
      if (
        !Number.isInteger(e.round) ||
        e.round < 0 ||
        typeof e.title !== "string" ||
        !scenarioByTitle.has(e.title) ||
        !Array.isArray(e.ids) ||
        e.ids.length !== this.discardPerTrade ||
        new Set(e.ids).size !== this.discardPerTrade ||
        !isSubset(e.ids, validCardIDs) ||
        typeof e.cannotAccept !== "string" ||
        typeof e.abandon !== "string" ||
        (e.decisionSource !== undefined &&
          e.decisionSource !== "voluntary_reject" &&
          e.decisionSource !== "pressure_forced")
      ) {
        return false;
      }
    }
    if (s.currentTitle != null && !scenarioByTitle.has(s.currentTitle)) return false;
    return true;
  }

  /* ==== 结果分析 ==== */

  /** 通用：留牌最多的分组（并列取字典序最小） */
  get topGroup(): string {
    const counts = new Map<string, number>();
    for (const c of this.heldCards) counts.set(c.group, (counts.get(c.group) ?? 0) + 1);
    let best = "";
    let bestCount = -1;
    for (const [key, value] of [...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
      if (value > bestCount) {
        best = key;
        bestCount = value;
      }
    }
    return best;
  }

  get groupNarrative(): string {
    return this.config.groupCopy[this.topGroup] ?? "";
  }

  /* ==== 人生卡牌深层分析（原型 lifeAnalysis 全量移植） ==== */

  lifeAnalysis(): LifeAnalysis {
    const initial = this.selected.map((id) => this.card(id));
    const heldCards = this.heldCards;
    const initialCounts = new Map<string, number>();
    const heldCounts = new Map<string, number>();
    for (const c of initial) initialCounts.set(c.group, (initialCounts.get(c.group) ?? 0) + 1);
    for (const c of heldCards) heldCounts.set(c.group, (heldCounts.get(c.group) ?? 0) + 1);

    const allGroups = ["关系", "内在力量", "能力行动", "价值原则", "现实支点", "外部认可"];
    let topGroup = "内在力量";
    let topScore = -Infinity;
    for (const g of allGroups) {
      const score = (initialCounts.get(g) ?? 0) + (heldCounts.get(g) ?? 0) * 2;
      if (score > topScore) {
        topScore = score;
        topGroup = g;
      }
    }

    const groupCopy = this.config.groupCopy[topGroup] ?? "";
    const noun: Record<string, string> = {
      关系: "关系守护者",
      内在力量: "内驱守望者",
      能力行动: "行动建构者",
      价值原则: "原则坚持者",
      现实支点: "现实锚定者",
      外部认可: "光芒追寻者",
    };
    const mode =
      this.traded.length > this.accepted.length
        ? "掌舵型"
        : this.traded.length < this.accepted.length
          ? "接纳型"
          : "平衡型";

    const rejected = this.traded.map((e) => e.scenario.theme);
    const sacrificed = this.traded.flatMap((e) => e.ids).map((id) => this.card(id));
    const firstTrade = sacrificed.map((c) => c.name);
    const acceptedNames = this.accepted.map((e) => e.scenario.title);

    // 亲口理由分析
    const reasonEntries = this.traded.filter((e) => e.cannotAccept !== "" || e.abandon !== "");
    const reasonText = reasonEntries
      .flatMap((e) => [e.cannotAccept, e.abandon])
      .filter((s) => s !== "")
      .join(" ");
    let voiceQuotes: { label: string; text: string }[] = [];
    for (const entry of reasonEntries) {
      if (entry.cannotAccept !== "") {
        voiceQuotes.push({ label: `不能接受“${entry.scenario.title}”`, text: entry.cannotAccept });
      }
      if (entry.abandon !== "") {
        voiceQuotes.push({ label: "愿意放弃底牌", text: entry.abandon });
      }
    }
    voiceQuotes = voiceQuotes.slice(0, 4);

    const containsAny = (words: string[]) => words.some((w) => reasonText.includes(w));
    let reasonInsight = "";
    if (reasonText !== "") {
      if (containsAny(["家人", "父母", "孩子", "伴侣", "爱人", "关系", "信任", "孤独", "离开"])) {
        reasonInsight =
          "你亲口提到的重要他人和关系责任，说明真正触发你的不只是事件本身，而是“我是否保护好了这段关系”。";
      } else if (containsAny(["健康", "生病", "钱", "收入", "稳定", "安全", "生活", "房子"])) {
        reasonInsight =
          "你给出的理由不断回到健康、稳定或生活基础，说明你最难承受的是人生底线被击穿，而不只是暂时的不顺。";
      } else if (containsAny(["失败", "认可", "证明", "价值", "丢脸", "否定", "不够好"])) {
        reasonInsight =
          "你的理由触及了失败、认可或自我价值，说明这件事之所以不能接受，是因为它可能动摇“我是否足够好”的判断。";
      } else if (containsAny(["控制", "失控", "确定", "害怕", "担心", "无法", "不能"])) {
        reasonInsight =
          "你的表达里带着对失控和不确定的警觉。你想消除的可能不只是坏结果，更是等待结果时无法掌舵的感觉。";
      } else if (containsAny(["责任", "应该", "照顾", "拖累", "承担", "保护"])) {
        reasonInsight =
          "你习惯从责任出发解释选择。对你而言，真正难受的可能不是损失，而是觉得自己没有承担好本应承担的部分。";
      } else {
        reasonInsight =
          "你的理由显示，你不是在机械地交换卡牌，而是在区分“以后还能重新获得的”和“一旦失去就无法补回的”。";
      }
    }

    const clamp = (n: number) => Math.max(4, Math.min(96, Math.round(n)));
    const acceptanceScore = clamp((this.accepted.length / Math.max(this.round, 1)) * 100);
    const relationScore = clamp(
      (((initialCounts.get("关系") ?? 0) / 6) * 0.45 +
        ((heldCounts.get("关系") ?? 0) / Math.max(heldCards.length, 1)) * 0.55) *
        100,
    );
    const initialPrinciple = initialCounts.get("价值原则") ?? 0;
    const principleScore =
      initialPrinciple > 0
        ? clamp(
            ((initialPrinciple / 3) * 0.4 +
              ((heldCounts.get("价值原则") ?? 0) / initialPrinciple) * 0.6) *
              100,
          )
        : 8;
    const spectrum: { left: string; right: string; value: number }[] = [
      { left: "主动掌控", right: "接纳现实", value: acceptanceScore },
      { left: "自我驱动", right: "关系锚定", value: relationScore },
      { left: "现实调整", right: "原则坚持", value: principleScore },
    ];

    const truthByGroup: Record<string, string> = {
      关系:
        mode === "掌舵型"
          ? "你真正害怕的可能不是困难本身，而是重要关系在困难里失去确定性。为了把关系拉回安全的位置，你愿意先消耗自己的其他资源。"
          : "你比自己想象中更能承受生活的不完美，前提是重要的人和彼此的信任仍然留在身边。",
      内在力量:
        mode === "掌舵型"
          ? "你对失控很敏感，但你并不等待别人来救场。你的第一反应，是动用自己已有的力量，把人生重新拉回手里。"
          : "你相信真正带不走的东西在自己身上。环境可以变坏，但只要内在力量还在，你就不认为自己彻底失去了选择。",
      能力行动:
        "你想保护的不只是“优秀”，而是解决问题的资格。对你而言，能力意味着即使生活失序，自己仍有重新开始的路径。",
      价值原则:
        "你可以失去一些外在条件，却很难接受自己变成一个不认同的人。守住原则，对你来说是在守住“我还是我”。",
      现实支点:
        "你追求的未必是保守，而是不能跌出生活的底线。只有身体和现实秩序稳住，你才允许自己继续谈理想。",
      外部认可:
        "你在意的可能不只是光环。被看见对你意味着机会仍在、价值仍被确认，也意味着自己没有从世界中消失。",
    };
    const truth = (truthByGroup[topGroup] ?? "") + (reasonInsight === "" ? "" : ` ${reasonInsight}`);

    const sacrificeText = firstTrade.slice(0, 3).join("、");
    let tension: string;
    const firstEvent = this.traded[0];
    if (firstEvent) {
      tension = `你曾主动把“${sacrificeText}”带进人生，说明它们并非不重要；但当“${firstEvent.scenario.title}”出现时，你又愿意先放下它们。你的价值排序不是固定清单，而会在威胁出现时迅速重排。`;
      if (firstEvent.abandon !== "") {
        tension += ` 你给出的理由是：“${firstEvent.abandon}”——这让交换不再只是轻重排序，也暴露了你判断“什么还能重来”的标准。`;
      }
    } else {
      tension =
        "你没有用任何底牌换取确定性。这里既有接纳现实的力量，也可能藏着另一面：你习惯先承受，而不是确认自己是否还有改变局面的权利。";
    }

    let blindspot: string;
    if (this.accepted.length >= 4) {
      blindspot =
        "你可能会把“我能承受”误认成“我应该承受”。真正的接纳并不等于独自消化，求助和设立边界也可以是成熟。";
    } else if (this.traded.length >= 4) {
      blindspot =
        "你可能高估了消除风险的必要性。为了让坏事不发生而持续支付代价，有时会让长期资源先被耗尽。";
    } else if (topGroup === "关系") {
      blindspot =
        "关系受到威胁时，你可能太快拿自己的能力、需要或边界去交换稳定。关系被保住，不一定等于你也被照顾。";
    } else if (topGroup === "价值原则") {
      blindspot =
        "原则让你保持完整，也可能让灰度情境显得非黑即白。有些调整不是背叛自己，而是为价值寻找新的实现方式。";
    } else if (topGroup === "现实支点") {
      blindspot =
        "对底线的敏感让你擅长识别风险，但也可能过早收缩探索空间，把“还没发生”提前活成“不能发生”。";
    } else {
      blindspot =
        "你容易把能够解决问题，当成必须负责解决问题。能力很强的人，也可能因此忽略自己的疲惫和被支持的需要。";
    }

    let reflection: string;
    if (firstEvent) {
      reflection = `如果现实中真的遭遇“${firstEvent.scenario.title}”，你愿意失去“${firstTrade.slice(0, 2).join("、")}”来换回确定吗？还是当时只是太害怕失控？`;
    } else {
      reflection = `你接受的“${acceptedNames[0] ?? "不确定"}”里，有没有一件并非真正接纳，而是你当时不相信自己拥有别的选择？`;
    }

    const modeCopy =
      mode === "掌舵型"
        ? "愿意付出已有资源，换回对人生的控制感"
        : mode === "接纳型"
          ? "更愿接受无法控制的现实，保护已经拥有的部分"
          : "在接受现实与主动改变之间寻找平衡";

    const seenRejected = new Set<string>();
    const uniqueRejected = rejected.filter((t) => {
      if (seenRejected.has(t)) return false;
      seenRejected.add(t);
      return true;
    });
    const hiddenTraits: { label: string; value: string }[] = [
      { label: "我最看重", value: heldCards.slice(0, 4).map((c) => c.name).join("、") },
      { label: "我的安全感来自", value: groupCopy },
      { label: "我的取舍方式", value: modeCopy },
      {
        label: "我最不愿承受",
        value: uniqueRejected.length === 0 ? "没有明确拒绝的情境" : uniqueRejected.slice(0, 3).join("、"),
      },
      {
        label: "我能够放下",
        value: firstTrade.length === 0 ? "这一局没有典当任何底牌" : firstTrade.slice(0, 4).join("、"),
      },
      {
        label: "我面对不可控事件时",
        value: `接受了 ${this.accepted.length} 次，主动交换了 ${this.traded.length} 次`,
      },
      { label: "我的内在真相", value: truth },
      { label: "我的内在张力", value: tension },
      { label: "我可能忽略", value: blindspot },
      {
        label: "我做出选择时真正担心",
        value: reasonInsight === "" ? "这次没有写下原因，暂时只依据取舍行为推断" : reasonInsight,
      },
    ];

    return {
      held: heldCards,
      title: `${mode}${noun[topGroup] ?? ""}`,
      groupCopy,
      truth,
      tension,
      blindspot,
      reflection,
      spectrum,
      voiceQuotes,
      reasonInsight,
      hiddenTraits,
      acceptedCount: this.accepted.length,
      tradedCount: this.traded.length,
    };
  }
}

export interface LifeAnalysis {
  held: GameCard[];
  title: string;
  groupCopy: string;
  truth: string;
  tension: string;
  blindspot: string;
  reflection: string;
  spectrum: { left: string; right: string; value: number }[];
  voiceQuotes: { label: string; text: string }[];
  reasonInsight: string;
  hiddenTraits: { label: string; value: string }[];
  acceptedCount: number;
  tradedCount: number;
}
