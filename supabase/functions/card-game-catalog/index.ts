import { validateCardGameCatalog } from "../../../packages/shared-types/src/card-game.ts";
import { preflightResponse } from "../_shared/cors.ts";
import { errorResponse, HttpError, jsonResponse } from "../_shared/errors.ts";
import { serviceClient } from "../_shared/service.ts";

type GameRow = {
  id: string;
  game_key: string;
  sort_order: number;
};

type VersionRow = {
  id: string;
  game_id: string;
  version: number;
  engine_key: string;
  analysis_key: string;
  content_hash: string;
  catalog: unknown;
};

function parseVersion(value: string | null): number | "latest" {
  if (value === null || value === "" || value === "latest") return "latest";
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) {
    throw new HttpError(400, "INVALID_VERSION", "牌库版本必须是正整数。");
  }
  return version;
}

function cacheHeaders(
  hash: string,
  immutable: boolean,
): Record<string, string> {
  return {
    ETag: `"${hash}"`,
    "Cache-Control": immutable
      ? "public, max-age=31536000, immutable"
      : "public, max-age=300, stale-while-revalidate=86400",
  };
}

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "GET") {
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "仅支持 GET 请求。");
    }

    const url = new URL(req.url);
    const requestedGame = url.searchParams.get("game")?.trim() ?? "";
    const requestedVersion = parseVersion(url.searchParams.get("version"));
    const db = serviceClient();

    if (requestedGame === "") {
      const { data: games, error: gamesError } = await db
        .from("card_games")
        .select("id,game_key,sort_order")
        .eq("status", "active")
        .order("sort_order")
        .order("game_key");
      if (gamesError) {
        console.error("load card games failed:", gamesError.message);
        throw new HttpError(500, "DATABASE_ERROR", "暂时无法加载卡牌列表。");
      }

      const gameRows = (games ?? []) as GameRow[];
      const gameIds = gameRows.map((game) => game.id);
      const { data: versions, error: versionsError } = gameIds.length === 0
        ? { data: [], error: null }
        : await db
          .from("card_game_catalog_versions")
          .select(
            "id,game_id,version,engine_key,analysis_key,content_hash,catalog",
          )
          .in("game_id", gameIds)
          .eq("is_current", true)
          .eq("status", "published");
      if (versionsError) {
        console.error(
          "load current card catalogs failed:",
          versionsError.message,
        );
        throw new HttpError(500, "DATABASE_ERROR", "暂时无法加载卡牌列表。");
      }
      const byGame = new Map(
        ((versions ?? []) as VersionRow[]).map((version) => [
          version.game_id,
          version,
        ]),
      );
      const manifest = gameRows.flatMap((game) => {
        const version = byGame.get(game.id);
        if (!version) return [];
        const catalog = validateCardGameCatalog(version.catalog);
        return [{
          game_key: game.game_key,
          title: catalog.game.title,
          intro_copy: catalog.game.intro_copy,
          accent: catalog.display.accent,
          glyph: catalog.display.glyph,
          version: version.version,
          content_hash: version.content_hash,
          sort_order: game.sort_order,
        }];
      });
      return jsonResponse(
        { schema_version: 1, games: manifest },
        200,
        { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
      );
    }

    if (!/^[a-z][a-z0-9_]{0,63}$/.test(requestedGame)) {
      throw new HttpError(400, "INVALID_GAME", "卡牌游戏标识无效。");
    }

    const { data: game, error: gameError } = await db
      .from("card_games")
      .select("id,game_key")
      .eq("game_key", requestedGame)
      .in("status", ["active", "retired"])
      .maybeSingle();
    if (gameError) {
      console.error("load card game failed:", gameError.message);
      throw new HttpError(500, "DATABASE_ERROR", "暂时无法加载牌库。");
    }
    if (!game) throw new HttpError(404, "GAME_NOT_FOUND", "卡牌游戏不存在。");

    let query = db
      .from("card_game_catalog_versions")
      .select("id,game_id,version,engine_key,analysis_key,content_hash,catalog")
      .eq("game_id", game.id)
      .in("status", ["published", "archived"]);
    query = requestedVersion === "latest"
      ? query.eq("is_current", true)
      : query.eq("version", requestedVersion);
    const { data: version, error: versionError } = await query.maybeSingle();
    if (versionError) {
      console.error("load card catalog failed:", versionError.message);
      throw new HttpError(500, "DATABASE_ERROR", "暂时无法加载牌库。");
    }
    if (!version) {
      throw new HttpError(404, "CATALOG_NOT_FOUND", "牌库版本不存在。");
    }

    const row = version as VersionRow;
    const catalog = validateCardGameCatalog(row.catalog);
    const headers = cacheHeaders(
      row.content_hash,
      requestedVersion !== "latest",
    );
    if (req.headers.get("if-none-match") === headers.ETag) {
      return new Response(null, { status: 304, headers });
    }

    return jsonResponse(
      {
        game_id: game.id,
        game_key: game.game_key,
        version_id: row.id,
        version: row.version,
        content_hash: row.content_hash,
        engine_key: row.engine_key,
        analysis_key: row.analysis_key,
        catalog,
      },
      200,
      headers,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
