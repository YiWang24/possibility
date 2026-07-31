/**
 * One-time bridge from the original hard-coded Web catalog to the immutable
 * server catalog v1. Run with:
 *
 *   bun scripts/build-card-game-seed.ts <migration-file>
 *
 * Later catalog versions should be authored directly against the published
 * CardGameCatalog JSON contract rather than importing the legacy module.
 */
import {
  CARD_GAME_KINDS,
  type CardGameConfig,
  cardGameConfig,
  lifeRoundMeta,
} from "../web/features/card-game/data";
import type {
  CardGameCatalog,
  CardGameCatalogGroup,
} from "../packages/shared-types/src/card-game";
import { validateCardGameCatalog } from "../packages/shared-types/src/card-game";

const outputPath = process.argv[2];
if (!outputPath) throw new Error("migration output path is required");

const groupKeys: Record<string, string> = {
  "关系": "relationship",
  "内在力量": "inner_strength",
  "价值原则": "values",
  "能力行动": "competence",
  "现实支点": "security",
  "外部认可": "recognition",
  "安全": "security",
  "连接": "connection",
  "自主": "autonomy",
  "成长": "growth",
  "现实": "practicality",
  "未来": "future_orientation",
  "边界": "boundaries",
  "支持": "support",
  "沟通": "communication",
  "责任": "responsibility",
  "真诚": "authenticity",
  "轻松": "ease",
};

const themeKeys: Record<string, string> = {
  "家庭安全": "family_security",
  "自我评价": "self_evaluation",
  "失去陪伴": "loss_of_companionship",
  "社会关系": "social_relationships",
  "健康": "health",
  "成就": "achievement",
  "社会评价": "social_evaluation",
  "自由": "freedom",
  "亲密关系": "intimacy",
  "现实安全": "material_security",
  "信任": "trust",
  "生命意义": "meaning",
  "家庭责任": "family_responsibility",
  "自主性": "autonomy",
  "家庭关系": "family_relationships",
  "承诺": "commitment",
  "生活": "daily_life",
  "沟通": "communication",
  "经济": "finances",
  "家庭": "family",
  "距离": "distance",
  "选择": "choice",
  "未来": "future",
  "责任": "responsibility",
  "修复": "repair",
  "关系": "relationship",
  "相处": "getting_along",
  "联系": "contact",
  "边界": "boundaries",
  "分工": "division_of_labor",
  "自主": "autonomy",
  "安全": "safety",
  "控制": "control",
  "危机": "crisis",
  "回应": "responsiveness",
  "融入": "belonging",
  "差异": "difference",
  "互惠": "reciprocity",
  "冲突": "conflict",
  "竞争": "competition",
  "变化": "change",
  "尊重": "respect",
  "归属": "belonging",
};

const profileDimensions: Record<string, string> = {
  life: "life",
  marriage: "love",
  family: "family",
  social: "social",
};

function stableKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function stageKey(kind: string, index: number): string {
  if (kind === "life") {
    return ["early_life", "adult_life", "later_life"][index] ??
      `life_stage_${index + 1}`;
  }
  return `${kind}_journey`;
}

function makeGroups(config: CardGameConfig): CardGameCatalogGroup[] {
  const labels = [...new Set(config.cards.map((card) => card.group))];
  return labels.map((label) => ({
    key: groupKeys[label] ?? stableKey(label),
    title: label,
    ai_description: config.groupCopy[label] ??
      `用户对${label}相关价值的重视程度。`,
  }));
}

function buildCatalog(kind: string, config: CardGameConfig): CardGameCatalog {
  const groups = makeGroups(config);
  const stages = config.scenarioRounds.map((_, index) => ({
    key: stageKey(kind, index),
    title: kind === "life"
      ? lifeRoundMeta[index]?.name ?? `人生阶段 ${index + 1}`
      : config.title,
    subtitle: kind === "life"
      ? lifeRoundMeta[index]?.age ?? `第 ${index + 1} 阶段`
      : "关系情境",
    activate_after_trades: kind === "life" ? index : 0,
    sort_order: (index + 1) * 10,
  }));
  return {
    schema_version: 1,
    game: {
      key: kind,
      title: config.title,
      eyebrow: config.eyebrow,
      intro_title: config.introTitle,
      intro_copy: config.introCopy,
      profile_dimension: profileDimensions[kind] ?? null,
      content_warning: config.contentWarning ?? null,
    },
    rules: {
      initial_select_count: 9,
      final_card_count: 3,
      discard_per_trade: 2,
      scenario_choice_count: 5,
      pressure: {
        initial: 1,
        min: 1,
        max: config.severityMeta.length,
        accept_delta: 1,
        trade_delta: -1,
      },
      scenario_selection: "nearest_pressure_unseen_v1",
      stage_basis: "trade_count",
      // Preserve the original ability to return from a revealed card.
      allow_redraw: true,
    },
    display: {
      accent: config.accent,
      glyph: config.glyph,
      card_back_asset: `${kind}-default`,
      pressure_labels: config.severityMeta.map((meta, index) => ({
        level: index + 1,
        title: meta.name,
        description: meta.copy,
      })),
      rule_copy: config.rules.map(([title, description]) => ({
        title,
        description,
      })),
    },
    groups,
    cards: config.cards.map((card, index) => {
      const groupKey = groupKeys[card.group] ?? stableKey(card.group);
      return {
        key: stableKey(card.id),
        title: card.name,
        description: card.copy || `${card.name}对你意味着什么？`,
        glyph: card.glyph,
        group_key: groupKey,
        sort_order: (index + 1) * 10,
        enabled: true,
        ai: {
          summary: `${card.name}体现了用户对${card.group}相关价值的主动选择。`,
          signals: { [groupKey]: 0.8 },
          tensions: [],
        },
      };
    }),
    stages,
    scenarios: config.scenarioRounds.flatMap((round, roundIndex) =>
      round.map((scenario, scenarioIndex) => ({
        key: `${stageKey(kind, roundIndex)}_${
          String(scenarioIndex + 1).padStart(2, "0")
        }`,
        stage_key: stageKey(kind, roundIndex),
        title: scenario.title,
        description: scenario.copy,
        theme_key: themeKeys[scenario.theme] ?? stableKey(scenario.theme),
        severity: scenario.severity,
        sort_order: (scenarioIndex + 1) * 10,
        enabled: true,
      }))
    ),
    analysis: {
      schema_version: 1,
      initial_card_weight: 1,
      final_card_weight: 2,
      discarded_card_weight: -0.25,
      signal_clamp: [-1, 1],
      mode_thresholds: [
        { key: "control", max_accept_rate: 0.4, title: "掌舵型" },
        { key: "balance", max_accept_rate: 0.7, title: "平衡型" },
        { key: "acceptance", max_accept_rate: 1, title: "接纳型" },
      ],
    },
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const statements: string[] = [
  "-- Generated from the original four client catalogs by scripts/build-card-game-seed.ts.",
  "-- This migration publishes immutable server catalog version 1.",
  "",
  "begin;",
];

for (const [index, kind] of CARD_GAME_KINDS.entries()) {
  const catalog = validateCardGameCatalog(
    buildCatalog(kind, cardGameConfig(kind)),
  );
  const serialized = JSON.stringify(catalog);
  const hash = await sha256(serialized);
  statements.push(`
insert into public.card_games (game_key, status, sort_order)
values ('${kind}', 'active', ${(index + 1) * 10})
on conflict (game_key) do update
set status = excluded.status,
    sort_order = excluded.sort_order;

insert into public.card_game_catalog_versions (
  game_id,
  version,
  catalog_schema_version,
  engine_key,
  analysis_key,
  status,
  is_current,
  catalog,
  content_hash,
  published_at
)
select
  game.id,
  1,
  1,
  'trade_down_v1',
  'signal_aggregation_v1',
  'published',
  true,
  $catalog_${kind}$${serialized}$catalog_${kind}$::jsonb,
  '${hash}',
  now()
from public.card_games game
where game.game_key = '${kind}'
on conflict (game_id, version) do update
set catalog_schema_version = excluded.catalog_schema_version,
    engine_key = excluded.engine_key,
    analysis_key = excluded.analysis_key,
    status = excluded.status,
    is_current = excluded.is_current,
    catalog = excluded.catalog,
    content_hash = excluded.content_hash,
    published_at = excluded.published_at;
`);
}

statements.push("commit;", "");
await Bun.write(outputPath, statements.join("\n"));
