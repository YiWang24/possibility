export type CardGameCatalogStatus = "draft" | "published" | "archived";
export type CardGameSessionStatus =
  | "in_progress"
  | "completed"
  | "abandoned"
  | "invalid";
export type CardGamePhase =
  | "select"
  | "draw"
  | "decision"
  | "trade"
  | "result";

export interface CardGamePressureRule {
  initial: number;
  min: number;
  max: number;
  accept_delta: number;
  trade_delta: number;
}

export interface CardGameRules {
  initial_select_count: number;
  final_card_count: number;
  discard_per_trade: number;
  scenario_choice_count: number;
  pressure: CardGamePressureRule;
  scenario_selection: "nearest_pressure_unseen_v1";
  stage_basis: "trade_count";
  allow_redraw: boolean;
}

export interface CardGameDisplayRule {
  title: string;
  description: string;
}

export interface CardGamePressureLabel {
  level: number;
  title: string;
  description: string;
}

export interface CardGameCatalogGroup {
  key: string;
  title: string;
  ai_description: string;
}

export interface CardGameCatalogCard {
  key: string;
  title: string;
  description: string;
  glyph: string;
  group_key: string;
  sort_order: number;
  enabled: boolean;
  ai: {
    summary: string;
    signals: Record<string, number>;
    tensions: string[];
  };
}

export interface CardGameCatalogStage {
  key: string;
  title: string;
  subtitle: string;
  activate_after_trades: number;
  sort_order: number;
}

export interface CardGameCatalogScenario {
  key: string;
  stage_key: string;
  title: string;
  description: string;
  theme_key: string;
  severity: number;
  sort_order: number;
  enabled: boolean;
}

export interface CardGameAnalysisConfig {
  schema_version: number;
  initial_card_weight: number;
  final_card_weight: number;
  discarded_card_weight: number;
  signal_clamp: [number, number];
  mode_thresholds: Array<{
    key: string;
    max_accept_rate: number;
    title: string;
  }>;
}

export interface CardGameCatalog {
  schema_version: number;
  game: {
    key: string;
    title: string;
    eyebrow: string;
    intro_title: string;
    intro_copy: string;
    profile_dimension: string | null;
    content_warning: string | null;
  };
  rules: CardGameRules;
  display: {
    accent: string;
    glyph: string;
    card_back_asset: string;
    pressure_labels: CardGamePressureLabel[];
    rule_copy: CardGameDisplayRule[];
  };
  groups: CardGameCatalogGroup[];
  cards: CardGameCatalogCard[];
  stages: CardGameCatalogStage[];
  scenarios: CardGameCatalogScenario[];
  analysis: CardGameAnalysisConfig;
}

export interface CardGameCatalogEnvelope {
  game_id: string;
  game_key: string;
  version_id: string;
  version: number;
  content_hash: string;
  engine_key: "trade_down_v1";
  analysis_key: "signal_aggregation_v1";
  catalog: CardGameCatalog;
}

export type CardGameActionType =
  | "confirm_selection"
  | "draw_scenario"
  | "accept_scenario"
  | "trade_cards";

export interface CardGameAction {
  sequence: number;
  action_type: CardGameActionType;
  scenario_key?: string | null;
  card_keys?: string[];
  reason_cannot_accept?: string | null;
  reason_abandon?: string | null;
  pressure_before?: number | null;
  pressure_after?: number | null;
  created_at?: string;
}

export interface CardGameState {
  phase: CardGamePhase;
  selected_card_keys: string[];
  held_card_keys: string[];
  seen_scenario_keys: string[];
  current_scenario_key: string | null;
  round_count: number;
  accept_count: number;
  trade_count: number;
  pressure: number;
}

export interface CardGameSession {
  id: string;
  client_session_id: string;
  game_key: string;
  catalog_version: number;
  status: CardGameSessionStatus;
  seed: number;
  state_version: number;
  last_action_seq: number;
  state: CardGameState;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CardGameRunPayload {
  analysis_schema_version: number;
  initial_card_keys: string[];
  final_card_keys: string[];
  discarded_card_keys: string[];
  metrics: Record<string, unknown>;
  ai_snapshot: Record<string, unknown>;
  display_snapshot: Record<string, unknown>;
  legacy_final_cards: Array<{
    id: string;
    name: string;
    glyph: string;
    group: string;
  }>;
  legacy_accepted: Array<{
    round: number;
    scenario: string;
    severity: number;
  }>;
  legacy_traded: Array<{
    round: number;
    scenario: string;
    ids: string[];
    reasons: string[];
  }>;
}

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const PROFILE_DIMENSIONS = new Set([
  "personality",
  "skill",
  "like",
  "love",
  "family",
  "social",
  "life",
]);

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, field: string): number {
  invariant(
    typeof value === "number" && Number.isFinite(value),
    `${field} must be a number`,
  );
  return value;
}

function integer(value: unknown, field: string, min = 0): number {
  const parsed = finiteNumber(value, field);
  invariant(
    Number.isInteger(parsed) && parsed >= min,
    `${field} must be an integer >= ${min}`,
  );
  return parsed;
}

function nonEmptyString(value: unknown, field: string, max = 500): string {
  invariant(typeof value === "string", `${field} must be a string`);
  const parsed = value.trim();
  invariant(
    parsed.length > 0 && parsed.length <= max,
    `${field} has invalid length`,
  );
  return parsed;
}

function key(value: unknown, field: string): string {
  const parsed = nonEmptyString(value, field, 64);
  invariant(
    KEY_PATTERN.test(parsed),
    `${field} must be a stable snake_case key`,
  );
  return parsed;
}

function uniqueKeys(values: string[], field: string): void {
  invariant(
    new Set(values).size === values.length,
    `${field} contains duplicate keys`,
  );
}

/**
 * Runtime validation used at the publish boundary and again by clients.
 * It deliberately validates the fixed v1 contract instead of accepting a
 * general-purpose rule DSL.
 */
export function validateCardGameCatalog(input: unknown): CardGameCatalog {
  invariant(isRecord(input), "catalog must be an object");
  invariant(input.schema_version === 1, "unsupported catalog schema_version");
  invariant(isRecord(input.game), "game must be an object");
  invariant(isRecord(input.rules), "rules must be an object");
  invariant(isRecord(input.display), "display must be an object");
  invariant(isRecord(input.analysis), "analysis must be an object");
  invariant(Array.isArray(input.groups), "groups must be an array");
  invariant(Array.isArray(input.cards), "cards must be an array");
  invariant(Array.isArray(input.stages), "stages must be an array");
  invariant(Array.isArray(input.scenarios), "scenarios must be an array");

  const catalog = input as unknown as CardGameCatalog;
  key(catalog.game.key, "game.key");
  nonEmptyString(catalog.game.title, "game.title", 100);
  nonEmptyString(catalog.game.eyebrow, "game.eyebrow", 100);
  nonEmptyString(catalog.game.intro_title, "game.intro_title", 300);
  nonEmptyString(catalog.game.intro_copy, "game.intro_copy", 1_000);
  if (catalog.game.profile_dimension !== null) {
    const dimension = key(
      catalog.game.profile_dimension,
      "game.profile_dimension",
    );
    invariant(
      PROFILE_DIMENSIONS.has(dimension),
      "game.profile_dimension is unsupported",
    );
  }
  if (catalog.game.content_warning !== null) {
    nonEmptyString(
      catalog.game.content_warning,
      "game.content_warning",
      1_000,
    );
  }

  const rules = catalog.rules;
  const initialCount = integer(
    rules.initial_select_count,
    "rules.initial_select_count",
    1,
  );
  const finalCount = integer(
    rules.final_card_count,
    "rules.final_card_count",
    1,
  );
  const discardCount = integer(
    rules.discard_per_trade,
    "rules.discard_per_trade",
    1,
  );
  const scenarioChoiceCount = integer(
    rules.scenario_choice_count,
    "rules.scenario_choice_count",
    1,
  );
  invariant(
    finalCount < initialCount,
    "final_card_count must be smaller than initial_select_count",
  );
  invariant(
    (initialCount - finalCount) % discardCount === 0,
    "card counts must end exactly after complete trades",
  );
  invariant(
    rules.scenario_selection === "nearest_pressure_unseen_v1",
    "unsupported scenario selection",
  );
  invariant(rules.stage_basis === "trade_count", "unsupported stage basis");
  invariant(
    typeof rules.allow_redraw === "boolean",
    "rules.allow_redraw must be boolean",
  );
  integer(rules.pressure.initial, "rules.pressure.initial", 1);
  integer(rules.pressure.min, "rules.pressure.min", 1);
  integer(rules.pressure.max, "rules.pressure.max", 1);
  finiteNumber(rules.pressure.accept_delta, "rules.pressure.accept_delta");
  finiteNumber(rules.pressure.trade_delta, "rules.pressure.trade_delta");
  invariant(
    rules.pressure.min <= rules.pressure.initial &&
      rules.pressure.initial <= rules.pressure.max,
    "initial pressure is outside pressure bounds",
  );

  invariant(
    /^#[0-9a-f]{6}$/i.test(
      nonEmptyString(catalog.display.accent, "display.accent", 7),
    ),
    "display.accent must be a six-digit hex color",
  );
  nonEmptyString(catalog.display.glyph, "display.glyph", 20);
  nonEmptyString(
    catalog.display.card_back_asset,
    "display.card_back_asset",
    100,
  );
  invariant(
    Array.isArray(catalog.display.pressure_labels),
    "display.pressure_labels must be an array",
  );
  const pressureLevels = catalog.display.pressure_labels.map(
    (label, index) => {
      const level = integer(
        label.level,
        `display.pressure_labels[${index}].level`,
        rules.pressure.min,
      );
      invariant(
        level <= rules.pressure.max,
        "pressure label exceeds maximum pressure",
      );
      nonEmptyString(
        label.title,
        `display.pressure_labels[${index}].title`,
        100,
      );
      nonEmptyString(
        label.description,
        `display.pressure_labels[${index}].description`,
        500,
      );
      return level;
    },
  );
  uniqueKeys(pressureLevels.map(String), "display.pressure_labels");
  const expectedPressureLevels = Array.from(
    { length: rules.pressure.max - rules.pressure.min + 1 },
    (_, index) => rules.pressure.min + index,
  );
  invariant(
    expectedPressureLevels.every((level) => pressureLevels.includes(level)),
    "display.pressure_labels must cover every pressure level",
  );
  invariant(
    Array.isArray(catalog.display.rule_copy) &&
      catalog.display.rule_copy.length > 0,
    "display.rule_copy must not be empty",
  );
  for (const [index, rule] of catalog.display.rule_copy.entries()) {
    nonEmptyString(rule.title, `display.rule_copy[${index}].title`, 200);
    nonEmptyString(
      rule.description,
      `display.rule_copy[${index}].description`,
      500,
    );
  }

  const groupKeys = catalog.groups.map((group, index) => {
    key(group.key, `groups[${index}].key`);
    nonEmptyString(group.title, `groups[${index}].title`, 100);
    nonEmptyString(
      group.ai_description,
      `groups[${index}].ai_description`,
      500,
    );
    return group.key;
  });
  uniqueKeys(groupKeys, "groups");
  const groupSet = new Set(groupKeys);

  const cardKeys = catalog.cards.map((card, index) => {
    key(card.key, `cards[${index}].key`);
    nonEmptyString(card.title, `cards[${index}].title`, 100);
    nonEmptyString(card.description, `cards[${index}].description`, 500);
    nonEmptyString(card.glyph, `cards[${index}].glyph`, 20);
    invariant(
      groupSet.has(card.group_key),
      `cards[${index}] references an unknown group`,
    );
    integer(card.sort_order, `cards[${index}].sort_order`);
    invariant(
      typeof card.enabled === "boolean",
      `cards[${index}].enabled must be boolean`,
    );
    invariant(isRecord(card.ai), `cards[${index}].ai must be an object`);
    nonEmptyString(card.ai.summary, `cards[${index}].ai.summary`, 500);
    invariant(
      isRecord(card.ai.signals),
      `cards[${index}].ai.signals must be an object`,
    );
    invariant(
      Array.isArray(card.ai.tensions),
      `cards[${index}].ai.tensions must be an array`,
    );
    for (const [tensionIndex, tension] of card.ai.tensions.entries()) {
      nonEmptyString(
        tension,
        `cards[${index}].ai.tensions[${tensionIndex}]`,
        300,
      );
    }
    for (const [signalKey, value] of Object.entries(card.ai.signals)) {
      key(signalKey, `cards[${index}].ai.signals key`);
      const score = finiteNumber(
        value,
        `cards[${index}].ai.signals.${signalKey}`,
      );
      invariant(
        score >= -1 && score <= 1,
        "card AI signal must be between -1 and 1",
      );
    }
    return card.key;
  });
  uniqueKeys(cardKeys, "cards");
  invariant(
    catalog.cards.filter((card) => card.enabled).length >= initialCount,
    "not enough enabled cards for initial selection",
  );

  const stageKeys = catalog.stages.map((stage, index) => {
    key(stage.key, `stages[${index}].key`);
    nonEmptyString(stage.title, `stages[${index}].title`, 100);
    integer(
      stage.activate_after_trades,
      `stages[${index}].activate_after_trades`,
    );
    integer(stage.sort_order, `stages[${index}].sort_order`);
    return stage.key;
  });
  uniqueKeys(stageKeys, "stages");
  invariant(stageKeys.length > 0, "catalog needs at least one stage");
  invariant(
    catalog.stages.some((stage) => stage.activate_after_trades === 0),
    "catalog needs a stage active before any trade",
  );
  const stageSet = new Set(stageKeys);

  const scenarioKeys = catalog.scenarios.map((scenario, index) => {
    key(scenario.key, `scenarios[${index}].key`);
    nonEmptyString(scenario.title, `scenarios[${index}].title`, 200);
    invariant(
      stageSet.has(scenario.stage_key),
      `scenarios[${index}] references an unknown stage`,
    );
    key(scenario.theme_key, `scenarios[${index}].theme_key`);
    integer(
      scenario.severity,
      `scenarios[${index}].severity`,
      rules.pressure.min,
    );
    invariant(
      scenario.severity <= rules.pressure.max,
      `scenarios[${index}].severity exceeds maximum pressure`,
    );
    invariant(
      typeof scenario.enabled === "boolean",
      `scenarios[${index}].enabled must be boolean`,
    );
    return scenario.key;
  });
  uniqueKeys(scenarioKeys, "scenarios");
  for (const stageKey of stageKeys) {
    invariant(
      catalog.scenarios.filter((scenario) =>
        scenario.enabled && scenario.stage_key === stageKey
      ).length >= scenarioChoiceCount,
      `stage ${stageKey} has fewer enabled scenarios than scenario_choice_count`,
    );
  }

  invariant(
    catalog.analysis.schema_version === 1,
    "unsupported analysis schema_version",
  );
  finiteNumber(
    catalog.analysis.initial_card_weight,
    "analysis.initial_card_weight",
  );
  finiteNumber(
    catalog.analysis.final_card_weight,
    "analysis.final_card_weight",
  );
  finiteNumber(
    catalog.analysis.discarded_card_weight,
    "analysis.discarded_card_weight",
  );
  invariant(
    Array.isArray(catalog.analysis.signal_clamp) &&
      catalog.analysis.signal_clamp.length === 2,
    "analysis.signal_clamp must contain two numbers",
  );
  invariant(
    Array.isArray(catalog.analysis.mode_thresholds) &&
      catalog.analysis.mode_thresholds.length > 0,
    "analysis.mode_thresholds must not be empty",
  );
  const thresholds = catalog.analysis.mode_thresholds.map(
    (threshold, index) => {
      key(threshold.key, `analysis.mode_thresholds[${index}].key`);
      nonEmptyString(
        threshold.title,
        `analysis.mode_thresholds[${index}].title`,
        100,
      );
      const maximum = finiteNumber(
        threshold.max_accept_rate,
        `analysis.mode_thresholds[${index}].max_accept_rate`,
      );
      invariant(
        maximum >= 0 && maximum <= 1,
        "analysis mode threshold must be between 0 and 1",
      );
      return maximum;
    },
  );
  invariant(
    thresholds.some((maximum) => maximum === 1),
    "analysis.mode_thresholds must cover accept rate 1",
  );

  return catalog;
}

export function initialCardGameState(catalog: CardGameCatalog): CardGameState {
  return {
    phase: "select",
    selected_card_keys: [],
    held_card_keys: [],
    seen_scenario_keys: [],
    current_scenario_key: null,
    round_count: 0,
    accept_count: 0,
    trade_count: 0,
    pressure: catalog.rules.pressure.initial,
  };
}

function stableOrder(seed: number, round: number, scenarioKey: string): number {
  let hash = (seed ^ Math.imul(round + 1, 0x9e3779b1)) >>> 0;
  for (let index = 0; index < scenarioKey.length; index += 1) {
    hash ^= scenarioKey.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash;
}

export function activeCardGameStage(
  catalog: CardGameCatalog,
  tradeCount: number,
): CardGameCatalogStage {
  const eligible = catalog.stages
    .filter((stage) => stage.activate_after_trades <= tradeCount)
    .sort((a, b) =>
      b.activate_after_trades - a.activate_after_trades ||
      b.sort_order - a.sort_order
    );
  invariant(eligible[0], "no active stage for trade count");
  return eligible[0];
}

export function cardGameScenarioOptions(
  catalog: CardGameCatalog,
  state: CardGameState,
  seed: number,
): CardGameCatalogScenario[] {
  const stage = activeCardGameStage(catalog, state.trade_count);
  const seen = new Set(state.seen_scenario_keys);
  return catalog.scenarios
    .filter((scenario) => scenario.enabled && scenario.stage_key === stage.key)
    .map((scenario) => ({
      scenario,
      distance: Math.abs(scenario.severity - state.pressure),
      seen: seen.has(scenario.key) ? 1 : 0,
      order: stableOrder(seed, state.round_count, scenario.key),
    }))
    .sort((a, b) =>
      a.distance - b.distance || a.seen - b.seen || a.order - b.order
    )
    .slice(0, catalog.rules.scenario_choice_count)
    .map(({ scenario }) => scenario);
}

function assertDistinctKnownCards(
  catalog: CardGameCatalog,
  cardKeys: string[],
  expectedCount: number,
): void {
  invariant(
    cardKeys.length === expectedCount,
    `expected exactly ${expectedCount} cards`,
  );
  invariant(
    new Set(cardKeys).size === cardKeys.length,
    "card selection contains duplicates",
  );
  const enabled = new Set(
    catalog.cards.filter((card) => card.enabled).map((card) => card.key),
  );
  invariant(
    cardKeys.every((cardKey) => enabled.has(cardKey)),
    "card selection contains unknown cards",
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function applyCardGameAction(
  catalog: CardGameCatalog,
  state: CardGameState,
  action: CardGameAction,
  seed: number,
): CardGameState {
  const next: CardGameState = {
    ...state,
    selected_card_keys: [...state.selected_card_keys],
    held_card_keys: [...state.held_card_keys],
    seen_scenario_keys: [...state.seen_scenario_keys],
  };
  const rules = catalog.rules;

  switch (action.action_type) {
    case "confirm_selection": {
      invariant(
        state.phase === "select",
        "selection is not allowed in the current phase",
      );
      const selected = action.card_keys ?? [];
      assertDistinctKnownCards(catalog, selected, rules.initial_select_count);
      next.selected_card_keys = [...selected];
      next.held_card_keys = [...selected];
      next.phase = "draw";
      return next;
    }
    case "draw_scenario": {
      invariant(
        state.phase === "draw" ||
          (state.phase === "decision" && rules.allow_redraw),
        "scenario draw is not allowed in the current phase",
      );
      const scenarioKey = action.scenario_key ?? "";
      invariant(
        cardGameScenarioOptions(catalog, state, seed).some((scenario) =>
          scenario.key === scenarioKey
        ),
        "scenario is not an eligible option",
      );
      next.current_scenario_key = scenarioKey;
      if (!next.seen_scenario_keys.includes(scenarioKey)) {
        next.seen_scenario_keys.push(scenarioKey);
      }
      next.phase = "decision";
      return next;
    }
    case "accept_scenario": {
      invariant(
        state.phase === "decision" && state.current_scenario_key,
        "there is no scenario to accept",
      );
      invariant(
        !action.scenario_key ||
          action.scenario_key === state.current_scenario_key,
        "accepted scenario does not match current scenario",
      );
      next.accept_count += 1;
      next.round_count += 1;
      next.pressure = clamp(
        state.pressure + rules.pressure.accept_delta,
        rules.pressure.min,
        rules.pressure.max,
      );
      next.current_scenario_key = null;
      next.phase = "draw";
      return next;
    }
    case "trade_cards": {
      invariant(
        state.phase === "decision" && state.current_scenario_key,
        "there is no scenario to trade against",
      );
      invariant(
        !action.scenario_key ||
          action.scenario_key === state.current_scenario_key,
        "traded scenario does not match current scenario",
      );
      const discarded = action.card_keys ?? [];
      invariant(
        discarded.length === rules.discard_per_trade &&
          new Set(discarded).size === discarded.length,
        `trade must discard exactly ${rules.discard_per_trade} distinct cards`,
      );
      const held = new Set(state.held_card_keys);
      invariant(
        discarded.every((cardKey) => held.has(cardKey)),
        "trade contains a card that is not held",
      );
      invariant(
        state.held_card_keys.length - discarded.length >=
          rules.final_card_count,
        "trade would go below final card count",
      );
      next.held_card_keys = state.held_card_keys.filter((cardKey) =>
        !discarded.includes(cardKey)
      );
      next.trade_count += 1;
      next.round_count += 1;
      next.pressure = clamp(
        state.pressure + rules.pressure.trade_delta,
        rules.pressure.min,
        rules.pressure.max,
      );
      next.current_scenario_key = null;
      next.phase = next.held_card_keys.length === rules.final_card_count
        ? "result"
        : "draw";
      return next;
    }
  }
}

export function replayCardGameActions(
  catalog: CardGameCatalog,
  actions: CardGameAction[],
  seed: number,
  baseState = initialCardGameState(catalog),
): CardGameState {
  return actions.reduce(
    (state, action) => applyCardGameAction(catalog, state, action, seed),
    baseState,
  );
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildCardGameRun(
  catalog: CardGameCatalog,
  actions: CardGameAction[],
  state: CardGameState,
  source: {
    session_id: string;
    game_key: string;
    catalog_version: number;
    completed_at: string;
  },
): CardGameRunPayload {
  invariant(
    state.phase === "result",
    "cannot build a result before the game is complete",
  );
  invariant(
    state.held_card_keys.length === catalog.rules.final_card_count,
    "final card count does not match catalog rules",
  );

  const cardByKey = new Map(catalog.cards.map((card) => [card.key, card]));
  const scenarioByKey = new Map(
    catalog.scenarios.map((scenario) => [scenario.key, scenario]),
  );
  const finalSet = new Set(state.held_card_keys);
  const discarded = state.selected_card_keys.filter((cardKey) =>
    !finalSet.has(cardKey)
  );
  const acceptRate = state.round_count === 0
    ? 0
    : state.accept_count / state.round_count;
  const mode = [...catalog.analysis.mode_thresholds]
    .sort((a, b) => a.max_accept_rate - b.max_accept_rate)
    .find((candidate) => acceptRate <= candidate.max_accept_rate) ??
    catalog.analysis.mode_thresholds.at(-1)!;

  const signalTotals = new Map<
    string,
    { weighted: number; weight: number; evidence: string[] }
  >();
  const addSignals = (
    cardKey: string,
    weight: number,
    evidenceType: string,
  ) => {
    const card = cardByKey.get(cardKey);
    invariant(card, `result references unknown card ${cardKey}`);
    for (const [signalKey, value] of Object.entries(card.ai.signals)) {
      const current = signalTotals.get(signalKey) ??
        { weighted: 0, weight: 0, evidence: [] };
      current.weighted += value * weight;
      current.weight += Math.abs(weight);
      current.evidence.push(`${evidenceType}:${cardKey}`);
      signalTotals.set(signalKey, current);
    }
  };
  for (const cardKey of state.selected_card_keys) {
    addSignals(cardKey, catalog.analysis.initial_card_weight, "initial_card");
  }
  for (const cardKey of state.held_card_keys) {
    addSignals(cardKey, catalog.analysis.final_card_weight, "final_card");
  }
  for (const cardKey of discarded) {
    addSignals(
      cardKey,
      catalog.analysis.discarded_card_weight,
      "discarded_card",
    );
  }

  const [signalMin, signalMax] = catalog.analysis.signal_clamp;
  const signals = [...signalTotals.entries()]
    .map(([signalKey, value]) => ({
      key: signalKey,
      score: round(
        clamp(value.weighted / Math.max(value.weight, 1), signalMin, signalMax),
      ),
      confidence: round(Math.min(0.9, 0.45 + value.evidence.length * 0.06)),
      evidence: value.evidence.map((entry) => {
        const [type, ref] = entry.split(":", 2);
        return { type, ref };
      }),
    }))
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  const scenarioThemeCounts: Record<string, number> = {};
  let maximumPressure = catalog.rules.pressure.initial;
  const legacyAccepted: CardGameRunPayload["legacy_accepted"] = [];
  const legacyTraded: CardGameRunPayload["legacy_traded"] = [];
  for (const action of actions) {
    maximumPressure = Math.max(
      maximumPressure,
      action.pressure_before ?? 0,
      action.pressure_after ?? 0,
    );
    if (
      action.action_type !== "accept_scenario" &&
      action.action_type !== "trade_cards"
    ) continue;
    const scenario = scenarioByKey.get(action.scenario_key ?? "");
    if (!scenario) continue;
    scenarioThemeCounts[scenario.theme_key] =
      (scenarioThemeCounts[scenario.theme_key] ?? 0) + 1;
    if (action.action_type === "accept_scenario") {
      legacyAccepted.push({
        round: legacyAccepted.length + legacyTraded.length,
        scenario: scenario.title,
        severity: action.pressure_before ?? scenario.severity,
      });
    } else {
      legacyTraded.push({
        round: legacyAccepted.length + legacyTraded.length,
        scenario: scenario.title,
        ids: [...(action.card_keys ?? [])],
        reasons: [
          action.reason_cannot_accept?.trim() ?? "",
          action.reason_abandon?.trim() ?? "",
        ].filter(Boolean),
      });
    }
  }

  const finalCards = state.held_card_keys.map((cardKey) => {
    const card = cardByKey.get(cardKey)!;
    return {
      key: card.key,
      title_snapshot: card.title,
      group_key: card.group_key,
      summary: card.ai.summary,
      signals: card.ai.signals,
    };
  });

  return {
    analysis_schema_version: catalog.analysis.schema_version,
    initial_card_keys: [...state.selected_card_keys],
    final_card_keys: [...state.held_card_keys],
    discarded_card_keys: discarded,
    metrics: {
      round_count: state.round_count,
      accept_count: state.accept_count,
      trade_count: state.trade_count,
      accept_rate: round(acceptRate),
      max_pressure: maximumPressure,
      decision_mode: mode.key,
      scenario_theme_counts: scenarioThemeCounts,
    },
    ai_snapshot: {
      schema_version: catalog.analysis.schema_version,
      source: {
        session_id: source.session_id,
        game_key: source.game_key,
        catalog_version: source.catalog_version,
        completed_at: source.completed_at,
      },
      final_cards: finalCards,
      behavior: {
        accept_rate: round(acceptRate),
        trade_count: state.trade_count,
        decision_mode: mode.key,
      },
      signals,
      reason_themes: [],
      limitations: ["这是一次情境游戏结果，不等同于稳定人格诊断"],
    },
    display_snapshot: {
      schema_version: 1,
      title: mode.title,
      final_cards: finalCards,
      accepted_count: state.accept_count,
      traded_count: state.trade_count,
    },
    legacy_final_cards: state.held_card_keys.map((cardKey) => {
      const card = cardByKey.get(cardKey)!;
      const group = catalog.groups.find((candidate) =>
        candidate.key === card.group_key
      );
      return {
        id: card.key,
        name: card.title,
        glyph: card.glyph,
        group: group?.title ?? card.group_key,
      };
    }),
    legacy_accepted: legacyAccepted,
    legacy_traded: legacyTraded,
  };
}
