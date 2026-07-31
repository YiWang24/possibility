"use client";

import type {
  CardGameAction,
  CardGameActionType,
  CardGameSession,
} from "@possibility/shared-types";
import { callFunction, supabase } from "@/lib/supabase";

interface LocalSyncState {
  schema_version: 1;
  user_id: string;
  game_key: string;
  catalog_version: number;
  session_id: string;
  client_session_id: string;
  seed: number;
  server_state_version: number;
  last_synced_sequence: number;
  pending_actions: CardGameAction[];
}

interface SessionResponse {
  ok: true;
  session: CardGameSession;
}

export interface CardGameCompletion {
  sessionId: string;
  runId: string;
}

interface CompletionResponse {
  ok: true;
  run: { id: string; session_id: string };
}

const KEY_PREFIX = "card_game_sync_v2";
const LAST_RESULT_PREFIX = "card_game_last_result_v1";

function localKey(userId: string, gameKey: string): string {
  return `${KEY_PREFIX}:${userId}:${gameKey}`;
}

function lastResultKey(userId: string, gameKey: string): string {
  return `${LAST_RESULT_PREFIX}:${userId}:${gameKey}`;
}

export async function lastCompletedCardGameSession(
  gameKey: string,
): Promise<string | null> {
  try {
    const { data } = await supabase().auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return null;
    const raw = window.localStorage.getItem(lastResultKey(userId, gameKey));
    if (!raw) return null;
    const value = JSON.parse(raw) as { session_id?: unknown };
    return typeof value.session_id === "string" ? value.session_id : null;
  } catch {
    return null;
  }
}

function readLocal(userId: string, gameKey: string): LocalSyncState | null {
  try {
    const raw = window.localStorage.getItem(localKey(userId, gameKey));
    if (!raw) return null;
    const value = JSON.parse(raw) as LocalSyncState;
    if (
      value.schema_version !== 1 ||
      value.user_id !== userId ||
      value.game_key !== gameKey ||
      !Array.isArray(value.pending_actions)
    ) {
      window.localStorage.removeItem(localKey(userId, gameKey));
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function writeLocal(state: LocalSyncState): void {
  try {
    window.localStorage.setItem(
      localKey(state.user_id, state.game_key),
      JSON.stringify(state),
    );
  } catch {
    // A full/disabled cache degrades to the legacy result save path.
  }
}

export async function pinnedCardGameCatalogVersion(
  gameKey: string,
): Promise<number | null> {
  try {
    const { data } = await supabase().auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return null;
    return readLocal(userId, gameKey)?.catalog_version ?? null;
  } catch {
    return null;
  }
}

export class CardGameSessionCoordinator {
  readonly seed: number;
  readonly resumed: boolean;
  readonly userId: string;
  private state: LocalSyncState;
  private started = false;
  private chain: Promise<void> = Promise.resolve();
  private completion: Promise<CardGameCompletion> | null = null;

  private constructor(state: LocalSyncState, resumed: boolean) {
    this.state = state;
    this.seed = state.seed;
    this.resumed = resumed;
    this.userId = state.user_id;
  }

  static async create(
    gameKey: string,
    catalogVersion: number,
  ): Promise<CardGameSessionCoordinator> {
    const { data } = await supabase().auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) throw new Error("未登录");

    const existing = readLocal(userId, gameKey);
    const state = existing?.catalog_version === catalogVersion
      ? existing
      : {
        schema_version: 1 as const,
        user_id: userId,
        game_key: gameKey,
        catalog_version: catalogVersion,
        session_id: crypto.randomUUID(),
        client_session_id: crypto.randomUUID(),
        seed: crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff,
        server_state_version: 0,
        last_synced_sequence: 0,
        pending_actions: [],
      };
    writeLocal(state);
    return new CardGameSessionCoordinator(
      state,
      Boolean(existing?.catalog_version === catalogVersion),
    );
  }

  get sessionId(): string {
    return this.state.session_id;
  }

  record(
    input: {
      action_type: CardGameActionType;
      scenario_key?: string | null;
      card_keys?: string[];
      reason_cannot_accept?: string | null;
      reason_abandon?: string | null;
      decision_source?: CardGameAction["decision_source"];
    },
  ): void {
    const previous = this.state.pending_actions.at(-1)?.sequence ??
      this.state.last_synced_sequence;
    this.state.pending_actions.push({
      sequence: previous + 1,
      ...input,
      created_at: new Date().toISOString(),
    });
    writeLocal(this.state);
    void this.flush();
  }

  flush(): Promise<void> {
    this.chain = this.chain.then(async () => {
      await this.ensureStarted();
      if (this.state.pending_actions.length === 0) return;
      const batch = this.state.pending_actions.slice(0, 50);
      const response = await callFunction<SessionResponse>(
        "card-game-session",
        {
          operation: "sync",
          session_id: this.state.session_id,
          expected_state_version: this.state.server_state_version,
          actions: batch,
        },
      );
      this.state.server_state_version = response.session.state_version;
      this.state.last_synced_sequence = response.session.last_action_seq;
      this.state.pending_actions = this.state.pending_actions.filter(
        (action) => action.sequence > response.session.last_action_seq,
      );
      writeLocal(this.state);
    }).catch(() => {
      // Keep the queue for the next action or explicit completion retry.
    });
    return this.chain;
  }

  complete(): Promise<CardGameCompletion> {
    if (this.completion) return this.completion;
    this.completion = this.completeOnce().catch((error) => {
      this.completion = null;
      throw error;
    });
    return this.completion;
  }

  private async completeOnce(): Promise<CardGameCompletion> {
    // Use a fresh chain after an earlier background failure.
    this.chain = Promise.resolve();
    await this.flush();
    if (this.state.pending_actions.length > 0) {
      throw new Error("卡牌动作尚未同步");
    }
    const response = await callFunction<CompletionResponse>("card-game-session", {
      operation: "complete",
      session_id: this.state.session_id,
      expected_state_version: this.state.server_state_version,
    });
    window.localStorage.removeItem(
      localKey(this.state.user_id, this.state.game_key),
    );
    try {
      window.localStorage.setItem(
        lastResultKey(this.state.user_id, this.state.game_key),
        JSON.stringify({
          session_id: response.run.session_id,
          run_id: response.run.id,
          completed_at: new Date().toISOString(),
        }),
      );
    } catch {
      // The run is still authoritative in Postgres; this pointer is only a
      // reload optimization for the just-finished result screen.
    }
    return {
      sessionId: response.run.session_id,
      runId: response.run.id,
    };
  }

  clearLocalState(): void {
    window.localStorage.removeItem(
      localKey(this.state.user_id, this.state.game_key),
    );
  }

  private async ensureStarted(): Promise<void> {
    if (this.started) return;
    const response = await callFunction<SessionResponse>("card-game-session", {
      operation: "start",
      session_id: this.state.session_id,
      client_session_id: this.state.client_session_id,
      game_key: this.state.game_key,
      catalog_version: this.state.catalog_version,
      seed: this.state.seed,
    });
    this.state.server_state_version = response.session.state_version;
    this.state.last_synced_sequence = response.session.last_action_seq;
    this.state.pending_actions = this.state.pending_actions.filter(
      (action) => action.sequence > response.session.last_action_seq,
    );
    this.started = true;
    writeLocal(this.state);
  }
}
