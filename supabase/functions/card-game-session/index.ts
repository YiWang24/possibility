import {
  applyCardGameAction,
  buildCardGameRun,
  type CardGameAction,
  type CardGameCatalog,
  type CardGameDecisionSource,
  type CardGameSession,
  type CardGameState,
  initialCardGameState,
  replayCardGameActions,
  validateCardGameCatalog,
} from "../../../packages/shared-types/src/card-game.ts";
import { requireUser } from "../_shared/auth.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";
import { serviceClient } from "../_shared/service.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GAME_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const MAX_ACTION_BATCH = 50;
const MAX_TOTAL_ACTIONS = 200;

type SessionRow = {
  id: string;
  user_id: string;
  game_id: string;
  game_version_id: string;
  client_session_id: string;
  status: CardGameSession["status"];
  phase: CardGameState["phase"];
  seed: number;
  state_version: number;
  last_action_seq: number;
  selected_card_keys: string[];
  held_card_keys: string[];
  seen_scenario_keys: string[];
  current_scenario_key: string | null;
  round_count: number;
  accept_count: number;
  trade_count: number;
  pressure: number;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
};

type LoadedSession = {
  row: SessionRow;
  gameKey: string;
  catalogVersion: number;
  catalog: CardGameCatalog;
};

function record(value: unknown, field = "body"): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_INPUT", `${field} 必须是对象。`);
  }
  return value as Record<string, unknown>;
}

function string(
  value: unknown,
  field: string,
  max: number,
  required = true,
): string | null {
  if (value === undefined || value === null) {
    if (required) {
      throw new HttpError(400, "INVALID_INPUT", `${field} 不能为空。`);
    }
    return null;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, "INVALID_INPUT", `${field} 必须是字符串。`);
  }
  const parsed = value.trim();
  if ((required && parsed.length === 0) || parsed.length > max) {
    throw new HttpError(400, "INVALID_INPUT", `${field} 长度无效。`);
  }
  return parsed || null;
}

function integer(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      `${field} 必须是 ${min}-${max} 的整数。`,
    );
  }
  return Number(value);
}

function uuid(value: unknown, field: string): string {
  const parsed = string(value, field, 64)!;
  if (!UUID_PATTERN.test(parsed)) {
    throw new HttpError(400, "INVALID_INPUT", `${field} 必须是 UUID。`);
  }
  return parsed;
}

function stateFromRow(row: SessionRow): CardGameState {
  return {
    phase: row.phase,
    selected_card_keys: row.selected_card_keys,
    held_card_keys: row.held_card_keys,
    seen_scenario_keys: row.seen_scenario_keys,
    current_scenario_key: row.current_scenario_key,
    round_count: row.round_count,
    accept_count: row.accept_count,
    trade_count: row.trade_count,
    pressure: row.pressure,
  };
}

function sessionResponse(loaded: LoadedSession): CardGameSession {
  const row = loaded.row;
  return {
    id: row.id,
    client_session_id: row.client_session_id,
    game_key: loaded.gameKey,
    catalog_version: loaded.catalogVersion,
    status: row.status,
    seed: Number(row.seed),
    state_version: row.state_version,
    last_action_seq: row.last_action_seq,
    state: stateFromRow(row),
    started_at: row.started_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
  };
}

async function loadSession(
  userId: string,
  sessionId: string,
): Promise<LoadedSession> {
  const db = serviceClient();
  const { data: session, error: sessionError } = await db
    .from("card_game_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (sessionError) {
    console.error("load card session failed:", sessionError.message);
    throw new HttpError(500, "DATABASE_ERROR", "暂时无法加载卡牌进度。");
  }
  if (!session) {
    throw new HttpError(404, "SESSION_NOT_FOUND", "卡牌进度不存在。");
  }
  const row = session as SessionRow;

  const [{ data: game, error: gameError }, {
    data: version,
    error: versionError,
  }] = await Promise.all([
    db.from("card_games").select("game_key").eq("id", row.game_id).single(),
    db
      .from("card_game_catalog_versions")
      .select("version,catalog")
      .eq("id", row.game_version_id)
      .single(),
  ]);
  if (gameError || versionError || !game || !version) {
    console.error(
      "load card session dependencies failed:",
      gameError?.message,
      versionError?.message,
    );
    throw new HttpError(500, "DATABASE_ERROR", "卡牌进度引用的牌库不可用。");
  }
  return {
    row,
    gameKey: game.game_key as string,
    catalogVersion: Number(version.version),
    catalog: validateCardGameCatalog(version.catalog),
  };
}

function parseActions(
  value: unknown,
  expectedSequence: number,
): CardGameAction[] {
  if (
    !Array.isArray(value) || value.length === 0 ||
    value.length > MAX_ACTION_BATCH
  ) {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      `actions 必须包含 1-${MAX_ACTION_BATCH} 个动作。`,
    );
  }
  return value.map((item, index) => {
    const input = record(item, `actions[${index}]`);
    const sequence = integer(
      input.sequence,
      `actions[${index}].sequence`,
      1,
      MAX_TOTAL_ACTIONS,
    );
    if (sequence !== expectedSequence + index) {
      throw new HttpError(400, "INVALID_INPUT", "动作序号必须连续。");
    }
    const actionType = string(
      input.action_type,
      `actions[${index}].action_type`,
      30,
    );
    if (
      actionType !== "confirm_selection" &&
      actionType !== "draw_scenario" &&
      actionType !== "accept_scenario" &&
      actionType !== "trade_cards"
    ) {
      throw new HttpError(400, "INVALID_INPUT", "不支持的卡牌动作。");
    }
    const rawCards = input.card_keys ?? [];
    if (
      !Array.isArray(rawCards) ||
      rawCards.length > 100 ||
      !rawCards.every((card) =>
        typeof card === "string" && GAME_KEY_PATTERN.test(card)
      )
    ) {
      throw new HttpError(400, "INVALID_INPUT", "card_keys 无效。");
    }
    const scenarioKey = string(
      input.scenario_key,
      `actions[${index}].scenario_key`,
      64,
      false,
    );
    if (scenarioKey !== null && !GAME_KEY_PATTERN.test(scenarioKey)) {
      throw new HttpError(400, "INVALID_INPUT", "scenario_key 无效。");
    }
    const decisionSource = string(
      input.decision_source,
      `actions[${index}].decision_source`,
      30,
      false,
    );
    if (
      decisionSource !== null &&
      decisionSource !== "voluntary_reject" &&
      decisionSource !== "pressure_forced"
    ) {
      throw new HttpError(400, "INVALID_INPUT", "decision_source 无效。");
    }
    return {
      sequence,
      action_type: actionType,
      scenario_key: scenarioKey,
      card_keys: rawCards as string[],
      reason_cannot_accept: string(
        input.reason_cannot_accept,
        `actions[${index}].reason_cannot_accept`,
        500,
        false,
      ),
      reason_abandon: string(
        input.reason_abandon,
        `actions[${index}].reason_abandon`,
        500,
        false,
      ),
      decision_source: decisionSource as CardGameDecisionSource | null,
      created_at: typeof input.created_at === "string"
        ? input.created_at
        : new Date().toISOString(),
    };
  });
}

function normalizeActions(
  catalog: CardGameCatalog,
  baseState: CardGameState,
  actions: CardGameAction[],
  seed: number,
): { actions: CardGameAction[]; state: CardGameState } {
  let state = baseState;
  const normalized = actions.map((action) => {
    const pressureBefore = state.pressure;
    let next: CardGameState;
    try {
      next = applyCardGameAction(catalog, state, action, seed);
    } catch (error) {
      throw new HttpError(
        400,
        "INVALID_GAME_ACTION",
        error instanceof Error ? error.message : "卡牌动作不合法。",
      );
    }
    const stored: CardGameAction = {
      ...action,
      scenario_key: action.scenario_key ?? state.current_scenario_key,
      decision_source: action.action_type === "trade_cards"
        ? action.decision_source ??
          (pressureBefore >= catalog.rules.pressure.max
            ? "pressure_forced"
            : "voluntary_reject")
        : null,
      pressure_before: pressureBefore,
      pressure_after: next.pressure,
    };
    state = next;
    return stored;
  });
  return { actions: normalized, state };
}

function postgresFailure(
  error: { code?: string; message: string } | null,
  fallback: string,
): never {
  if (error?.code === "40001") {
    throw new HttpError(
      409,
      "SESSION_VERSION_CONFLICT",
      "卡牌进度已在其他设备更新，请重新加载。",
    );
  }
  console.error(fallback, error?.message);
  throw new HttpError(500, "DATABASE_ERROR", fallback);
}

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const { user } = await requireUser(req);
    const body = record(await readJson(req));
    const operation = string(body.operation, "operation", 20);
    const db = serviceClient();

    if (operation === "start") {
      const sessionId = uuid(body.session_id, "session_id");
      const clientSessionId = uuid(
        body.client_session_id,
        "client_session_id",
      );
      const gameKey = string(body.game_key, "game_key", 64)!;
      if (!GAME_KEY_PATTERN.test(gameKey)) {
        throw new HttpError(400, "INVALID_INPUT", "game_key 无效。");
      }
      const catalogVersion = integer(
        body.catalog_version,
        "catalog_version",
        1,
        1_000_000,
      );
      const seed = body.seed === undefined
        ? crypto.getRandomValues(new Uint32Array(1))[0]
        : integer(body.seed, "seed", 0, 0x7fff_ffff);
      const { data, error } = await db.rpc("create_card_game_session_v2", {
        p_user_id: user.id,
        p_session_id: sessionId,
        p_client_session_id: clientSessionId,
        p_game_key: gameKey,
        p_catalog_version: catalogVersion,
        p_seed: seed,
      });
      if (error || !data) postgresFailure(error, "创建卡牌进度失败。");
      const loaded = await loadSession(user.id, (data as SessionRow).id);
      return jsonResponse({ ok: true, session: sessionResponse(loaded) });
    }

    if (operation === "resume") {
      const gameKey = string(body.game_key, "game_key", 64)!;
      if (!GAME_KEY_PATTERN.test(gameKey)) {
        throw new HttpError(400, "INVALID_INPUT", "game_key 无效。");
      }
      const { data: game } = await db.from("card_games")
        .select("id")
        .eq("game_key", gameKey)
        .maybeSingle();
      if (!game) return jsonResponse({ ok: true, session: null });
      const { data: session, error } = await db.from("card_game_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("game_id", game.id)
        .eq("status", "in_progress")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) postgresFailure(error, "加载卡牌进度失败。");
      if (!session) return jsonResponse({ ok: true, session: null });
      const loaded = await loadSession(user.id, session.id as string);
      return jsonResponse({ ok: true, session: sessionResponse(loaded) });
    }

    const sessionId = uuid(body.session_id, "session_id");
    const loaded = await loadSession(user.id, sessionId);

    if (operation === "sync") {
      const expectedVersion = integer(
        body.expected_state_version,
        "expected_state_version",
        0,
        MAX_TOTAL_ACTIONS,
      );
      if (expectedVersion !== loaded.row.state_version) {
        throw new HttpError(
          409,
          "SESSION_VERSION_CONFLICT",
          "卡牌进度已在其他设备更新，请重新加载。",
        );
      }
      const actions = parseActions(
        body.actions,
        loaded.row.last_action_seq + 1,
      );
      const transition = normalizeActions(
        loaded.catalog,
        stateFromRow(loaded.row),
        actions,
        Number(loaded.row.seed),
      );
      const { data, error } = await db.rpc("sync_card_game_session_v2", {
        p_user_id: user.id,
        p_session_id: sessionId,
        p_expected_state_version: expectedVersion,
        p_actions: transition.actions,
        p_state: transition.state,
      });
      if (error || !data) postgresFailure(error, "同步卡牌进度失败。");
      const refreshed = await loadSession(user.id, sessionId);
      return jsonResponse({ ok: true, session: sessionResponse(refreshed) });
    }

    if (operation === "complete") {
      const expectedVersion = integer(
        body.expected_state_version,
        "expected_state_version",
        0,
        MAX_TOTAL_ACTIONS,
      );
      if (expectedVersion !== loaded.row.state_version) {
        throw new HttpError(
          409,
          "SESSION_VERSION_CONFLICT",
          "卡牌进度已在其他设备更新，请重新加载。",
        );
      }
      const { data: actionRows, error: actionsError } = await db
        .from("card_game_actions")
        .select(
          "sequence,action_type,scenario_key,card_keys,reason_cannot_accept,reason_abandon,decision_source,pressure_before,pressure_after,created_at",
        )
        .eq("session_id", sessionId)
        .order("sequence");
      if (actionsError) postgresFailure(actionsError, "加载卡牌动作失败。");
      const actions = (actionRows ?? []) as CardGameAction[];
      let replayed: CardGameState;
      try {
        replayed = replayCardGameActions(
          loaded.catalog,
          actions,
          Number(loaded.row.seed),
          initialCardGameState(loaded.catalog),
        );
      } catch (error) {
        console.error("stored card action replay failed:", error);
        throw new HttpError(
          409,
          "INVALID_STORED_SESSION",
          "卡牌进度无法通过规则校验，请重新开始这一局。",
        );
      }
      if (
        JSON.stringify(replayed) !== JSON.stringify(stateFromRow(loaded.row))
      ) {
        throw new HttpError(
          409,
          "INVALID_STORED_SESSION",
          "卡牌进度与动作记录不一致，请重新加载。",
        );
      }
      const completedAt = new Date().toISOString();
      let run;
      try {
        run = buildCardGameRun(
          loaded.catalog,
          actions,
          replayed,
          {
            session_id: sessionId,
            game_key: loaded.gameKey,
            catalog_version: loaded.catalogVersion,
            completed_at: completedAt,
          },
        );
      } catch (error) {
        throw new HttpError(
          400,
          "GAME_NOT_COMPLETE",
          error instanceof Error ? error.message : "这一局尚未完成。",
        );
      }
      const { data, error } = await db.rpc(
        "complete_card_game_session_v2",
        {
          p_user_id: user.id,
          p_session_id: sessionId,
          p_expected_state_version: expectedVersion,
          p_run: run,
        },
      );
      if (error || !data) postgresFailure(error, "保存卡牌结果失败。");
      return jsonResponse({ ok: true, ...record(data, "result") });
    }

    throw new HttpError(
      400,
      "INVALID_OPERATION",
      "operation 必须是 start、resume、sync 或 complete。",
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
