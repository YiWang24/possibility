"use client";

import {
  type CardGameCatalog,
  type CardGameCatalogEnvelope,
  validateCardGameCatalog,
} from "@possibility/shared-types";
import { functionURL, SUPABASE_ANON_KEY } from "@/lib/config";
import type {
  CardGameConfig,
  CardGameKind,
  GameScenario,
} from "./data";
import { cardGameConfig } from "./data";

export interface CardGameManifestItem {
  game_key: string;
  title: string;
  intro_copy: string;
  accent: string;
  glyph: string;
  version: number;
  content_hash: string;
  sort_order: number;
}

interface CardGameManifest {
  schema_version: number;
  games: CardGameManifestItem[];
}

export interface LoadedCardGameConfig {
  config: CardGameConfig;
  envelope: CardGameCatalogEnvelope | null;
  source: "remote" | "cache" | "fallback";
}

const MANIFEST_CACHE_KEY = "card_game_manifest_v1";
const CATALOG_CACHE_PREFIX = "card_game_catalog_v1";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readJson<T>(key: string): T | null {
  const raw = storage()?.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    storage()?.removeItem(key);
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Cache failure must not block the game.
  }
}

function catalogCacheKey(
  gameKey: string,
  version: number,
  hash: string,
): string {
  return `${CATALOG_CACHE_PREFIX}:${gameKey}:${version}:${hash}`;
}

function cachedCatalogForVersion(
  gameKey: string,
  version: number,
): CardGameCatalogEnvelope | null {
  const local = storage();
  if (!local) return null;
  const prefix = `${CATALOG_CACHE_PREFIX}:${gameKey}:${version}:`;
  for (let index = 0; index < local.length; index += 1) {
    const key = local.key(index);
    if (!key?.startsWith(prefix)) continue;
    const cached = readJson<CardGameCatalogEnvelope>(key);
    if (cached) return cached;
  }
  return null;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  if (!response.ok) {
    throw new Error(`card catalog request failed (${response.status})`);
  }
  return await response.json() as T;
}

export async function loadCardGameManifest(): Promise<CardGameManifestItem[]> {
  try {
    const manifest = await getJson<CardGameManifest>(
      functionURL("card-game-catalog"),
    );
    if (manifest.schema_version !== 1 || !Array.isArray(manifest.games)) {
      throw new Error("unsupported card manifest");
    }
    writeJson(MANIFEST_CACHE_KEY, manifest);
    return manifest.games;
  } catch {
    return readJson<CardGameManifest>(MANIFEST_CACHE_KEY)?.games ?? [];
  }
}

function catalogToConfig(
  envelope: CardGameCatalogEnvelope,
): CardGameConfig {
  const catalog = validateCardGameCatalog(envelope.catalog);
  const groups = new Map(
    catalog.groups.map((group) => [group.key, group]),
  );
  const stages = [...catalog.stages].sort((a, b) =>
    a.activate_after_trades - b.activate_after_trades ||
    a.sort_order - b.sort_order
  );
  const scenarioRounds: GameScenario[][] = stages.map((stage) =>
    catalog.scenarios
      .filter((scenario) =>
        scenario.enabled && scenario.stage_key === stage.key
      )
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((scenario) => ({
        key: scenario.key,
        title: scenario.title,
        copy: scenario.description,
        theme: scenario.theme_key,
        severity: scenario.severity,
      }))
  );
  return {
    kind: catalog.game.key as CardGameKind,
    title: catalog.game.title,
    eyebrow: catalog.game.eyebrow,
    introTitle: catalog.game.intro_title,
    introCopy: catalog.game.intro_copy,
    rules: catalog.display.rule_copy.map((rule) => [
      rule.title,
      rule.description,
    ]),
    selectTitle: "选择你想带走的底牌",
    cardPrefix: "",
    severityMeta: catalog.display.pressure_labels
      .sort((a, b) => a.level - b.level)
      .map((label) => ({ name: label.title, copy: label.description })),
    pressureLabel: "命运压力",
    cards: catalog.cards
      .filter((card) => card.enabled)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((card) => ({
        id: card.key,
        name: card.title,
        glyph: card.glyph,
        group: groups.get(card.group_key)?.title ?? card.group_key,
        copy: card.description,
      })),
    scenarioRounds,
    groupCopy: Object.fromEntries(
      catalog.groups.map((group) => [group.title, group.ai_description]),
    ),
    accent: catalog.display.accent,
    glyph: catalog.display.glyph,
    contentWarning: catalog.game.content_warning ?? undefined,
    catalogVersion: envelope.version,
    contentHash: envelope.content_hash,
    engineKey: envelope.engine_key,
    dynamicRules: catalog.rules,
    stageMeta: stages.map((stage) => ({
      age: stage.subtitle,
      name: stage.title,
      activateAfterTrades: stage.activate_after_trades,
    })),
    sourceCatalog: catalog,
  };
}

function fallback(kind: CardGameKind): LoadedCardGameConfig {
  return {
    config: cardGameConfig(kind),
    envelope: null,
    source: "fallback",
  };
}

export async function loadCardGameConfig(
  kind: CardGameKind,
  pinnedVersion?: number | null,
): Promise<LoadedCardGameConfig> {
  if (pinnedVersion) {
    const cached = cachedCatalogForVersion(kind, pinnedVersion);
    if (cached) {
      try {
        return {
          config: catalogToConfig(cached),
          envelope: cached,
          source: "cache",
        };
      } catch {
        storage()?.removeItem(
          catalogCacheKey(kind, pinnedVersion, cached.content_hash),
        );
      }
    }
    try {
      const envelope = await getJson<CardGameCatalogEnvelope>(
        `${
          functionURL("card-game-catalog")
        }?game=${encodeURIComponent(kind)}&version=${pinnedVersion}`,
      );
      validateCardGameCatalog(envelope.catalog);
      writeJson(
        catalogCacheKey(
          envelope.game_key,
          envelope.version,
          envelope.content_hash,
        ),
        envelope,
      );
      return {
        config: catalogToConfig(envelope),
        envelope,
        source: "remote",
      };
    } catch {
      return fallback(kind);
    }
  }

  try {
    const manifest = await loadCardGameManifest();
    const current = manifest.find((game) => game.game_key === kind);
    if (!current) return fallback(kind);
    const key = catalogCacheKey(
      current.game_key,
      current.version,
      current.content_hash,
    );
    const cached = readJson<CardGameCatalogEnvelope>(key);
    if (cached) {
      try {
        return {
          config: catalogToConfig(cached),
          envelope: cached,
          source: "cache",
        };
      } catch {
        storage()?.removeItem(key);
      }
    }

    const envelope = await getJson<CardGameCatalogEnvelope>(
      `${
        functionURL("card-game-catalog")
      }?game=${encodeURIComponent(kind)}&version=${current.version}`,
    );
    validateCardGameCatalog(envelope.catalog);
    writeJson(key, envelope);
    return {
      config: catalogToConfig(envelope),
      envelope,
      source: "remote",
    };
  } catch {
    return fallback(kind);
  }
}

export function catalogForConfig(
  config: CardGameConfig,
): CardGameCatalog | null {
  return config.sourceCatalog ?? null;
}
