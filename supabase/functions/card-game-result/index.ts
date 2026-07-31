import type {
  CardGameAction,
  CardGameAiNarrative,
  CardGameAiNarrativeResponse,
} from "../../../packages/shared-types/src/card-game.ts";
import { validateCardGameCatalog } from "../../../packages/shared-types/src/card-game.ts";
import { requireUser } from "../_shared/auth.ts";
import { runInBackground } from "../_shared/background.ts";
import {
  buildCardGameNarrativeEvidence,
  CARD_GAME_NARRATIVE_PROMPT_VERSION,
  CARD_GAME_NARRATIVE_SCHEMA_VERSION,
  cardGameNarrativeSchema,
  cardGameNarrativeSystemPrompt,
  narrativeEvidenceIsGrounded,
} from "../_shared/card-game-narrative.ts";
import { runtimeConfig } from "../_shared/config.ts";
import { preflightResponse } from "../_shared/cors.ts";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "../_shared/errors.ts";
import { structuredOutput } from "../_shared/llm.ts";
import { serviceClient } from "../_shared/service.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GENERATION_STALE_MS = 3 * 60 * 1_000;
const MAX_GENERATION_ATTEMPTS = 2;

type RunRow = {
  id: string;
  session_id: string;
  user_id: string;
  game_version_id: string;
  initial_card_keys: string[];
  final_card_keys: string[];
  discarded_card_keys: string[];
  metrics: Record<string, unknown>;
  ai_narrative_status: "pending" | "generating" | "ready" | "failed";
  ai_narrative: CardGameAiNarrative | null;
  ai_narrative_prompt_version: string | null;
  ai_narrative_generation_id: string | null;
  ai_narrative_attempts: number;
  ai_narrative_started_at: string | null;
  ai_narrative_generated_at: string | null;
};

function inputRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_INPUT", "请求体必须是对象。");
  }
  return value as Record<string, unknown>;
}

function sessionIdOf(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new HttpError(400, "INVALID_INPUT", "session_id 必须是 UUID。");
  }
  return value;
}

function attemptCountForPrompt(run: RunRow): number {
  return run.ai_narrative_prompt_version === CARD_GAME_NARRATIVE_PROMPT_VERSION
    ? run.ai_narrative_attempts
    : 0;
}

function isCurrentReady(run: RunRow): boolean {
  return run.ai_narrative_status === "ready" &&
    run.ai_narrative_prompt_version === CARD_GAME_NARRATIVE_PROMPT_VERSION &&
    run.ai_narrative?.schema_version === CARD_GAME_NARRATIVE_SCHEMA_VERSION;
}

function isActiveGeneration(run: RunRow): boolean {
  if (
    run.ai_narrative_status !== "generating" ||
    run.ai_narrative_prompt_version !== CARD_GAME_NARRATIVE_PROMPT_VERSION ||
    !run.ai_narrative_started_at
  ) return false;
  const startedAt = Date.parse(run.ai_narrative_started_at);
  return Number.isFinite(startedAt) &&
    Date.now() - startedAt < GENERATION_STALE_MS;
}

function responseFor(run: RunRow): CardGameAiNarrativeResponse {
  const ready = isCurrentReady(run);
  const attempts = attemptCountForPrompt(run);
  const status = !ready && run.ai_narrative_status === "ready"
    ? "pending"
    : run.ai_narrative_status;
  return {
    ok: true,
    session_id: run.session_id,
    status: ready ? "ready" : status,
    narrative: ready ? run.ai_narrative : null,
    generated_at: ready ? run.ai_narrative_generated_at : null,
    retryable: !ready && !isActiveGeneration(run) &&
      attempts < MAX_GENERATION_ATTEMPTS,
    source: ready ? "ai" : "rules",
  };
}

async function loadRun(
  db: ReturnType<typeof serviceClient>,
  userId: string,
  sessionId: string,
): Promise<RunRow> {
  const { data, error } = await db
    .from("card_game_runs")
    .select(
      "id,session_id,user_id,game_version_id,initial_card_keys,final_card_keys,discarded_card_keys,metrics,ai_narrative_status,ai_narrative,ai_narrative_prompt_version,ai_narrative_generation_id,ai_narrative_attempts,ai_narrative_started_at,ai_narrative_generated_at",
    )
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("load card game narrative run failed:", error.code);
    throw new HttpError(500, "DATABASE_ERROR", "暂时无法加载卡牌结果。");
  }
  if (!data) {
    throw new HttpError(404, "CARD_GAME_RUN_NOT_FOUND", "这局卡牌尚未完成。");
  }
  return data as RunRow;
}

async function claimGeneration(run: RunRow): Promise<RunRow | null> {
  if (isCurrentReady(run) || isActiveGeneration(run)) return null;
  const attempts = attemptCountForPrompt(run);
  if (attempts >= MAX_GENERATION_ATTEMPTS) return null;
  const generationId = crypto.randomUUID();
  const { data, error } = await serviceClient()
    .from("card_game_runs")
    .update({
      ai_narrative_status: "generating",
      ai_narrative: null,
      ai_narrative_schema_version: CARD_GAME_NARRATIVE_SCHEMA_VERSION,
      ai_narrative_prompt_version: CARD_GAME_NARRATIVE_PROMPT_VERSION,
      ai_narrative_model: null,
      ai_narrative_generation_id: generationId,
      ai_narrative_attempts: attempts + 1,
      ai_narrative_started_at: new Date().toISOString(),
      ai_narrative_generated_at: null,
      ai_narrative_error_code: null,
    })
    .eq("id", run.id)
    .eq("user_id", run.user_id)
    .eq("ai_narrative_attempts", run.ai_narrative_attempts)
    .select(
      "id,session_id,user_id,game_version_id,initial_card_keys,final_card_keys,discarded_card_keys,metrics,ai_narrative_status,ai_narrative,ai_narrative_prompt_version,ai_narrative_generation_id,ai_narrative_attempts,ai_narrative_started_at,ai_narrative_generated_at",
    )
    .maybeSingle();
  if (error) {
    console.error("claim card game narrative failed:", error.code);
    throw new HttpError(500, "DATABASE_ERROR", "暂时无法开始生成卡牌解读。");
  }
  return data ? data as RunRow : null;
}

function generationErrorCode(error: unknown): string {
  if (error instanceof HttpError) return error.code.slice(0, 64);
  return error instanceof Error ? error.name.slice(0, 64) : "UNKNOWN";
}

async function markFailed(run: RunRow, error: unknown): Promise<void> {
  const { error: updateError } = await serviceClient()
    .from("card_game_runs")
    .update({
      ai_narrative_status: "failed",
      ai_narrative: null,
      ai_narrative_generation_id: null,
      ai_narrative_error_code: generationErrorCode(error),
    })
    .eq("id", run.id)
    .eq("user_id", run.user_id)
    .eq("ai_narrative_generation_id", run.ai_narrative_generation_id);
  if (updateError) {
    console.error("mark card game narrative failed:", updateError.code);
  }
}

async function generateAndPersist(run: RunRow): Promise<void> {
  try {
    const userDb = serviceClient();
    const [{ data: version, error: versionError }, {
      data: actions,
      error: actionsError,
    }] = await Promise.all([
      userDb.from("card_game_catalog_versions").select("catalog")
        .eq("id", run.game_version_id).single(),
      userDb.from("card_game_actions")
        .select(
          "sequence,action_type,scenario_key,card_keys,reason_cannot_accept,reason_abandon,decision_source,pressure_before,pressure_after,created_at",
        )
        .eq("session_id", run.session_id)
        .order("sequence"),
    ]);
    if (versionError || actionsError || !version) {
      throw new HttpError(500, "EVIDENCE_LOAD_FAILED", "无法加载本局证据。");
    }
    const catalog = validateCardGameCatalog(version.catalog);
    const evidence = buildCardGameNarrativeEvidence(
      catalog,
      (actions ?? []) as CardGameAction[],
      run,
    );
    const narrative = await structuredOutput<CardGameAiNarrative>({
      model: runtimeConfig.structuredModel,
      maxTokens: 1_600,
      maxAttempts: 2,
      perAttemptTimeoutMs: 40_000,
      system: cardGameNarrativeSystemPrompt,
      prompt: evidence.prompt,
      schema: cardGameNarrativeSchema(evidence.evidenceRefs),
      track: { userId: run.user_id, feature: "card_game_result" },
      trace: {
        name: "card-game-result",
        userId: run.user_id,
        sessionId: run.session_id,
        metadata: {
          prompt_version: CARD_GAME_NARRATIVE_PROMPT_VERSION,
          game_key: catalog.game.key,
        },
      },
    });
    if (!narrativeEvidenceIsGrounded(narrative, evidence.evidenceRefs)) {
      throw new HttpError(
        502,
        "UNGROUNDED_MODEL_OUTPUT",
        "AI 结果缺少有效证据。",
      );
    }
    const generatedAt = new Date().toISOString();
    const { error } = await serviceClient()
      .from("card_game_runs")
      .update({
        ai_narrative_status: "ready",
        ai_narrative: narrative,
        ai_narrative_schema_version: CARD_GAME_NARRATIVE_SCHEMA_VERSION,
        ai_narrative_prompt_version: CARD_GAME_NARRATIVE_PROMPT_VERSION,
        ai_narrative_model: runtimeConfig.structuredModel,
        ai_narrative_generation_id: null,
        ai_narrative_generated_at: generatedAt,
        ai_narrative_error_code: null,
      })
      .eq("id", run.id)
      .eq("user_id", run.user_id)
      .eq("ai_narrative_generation_id", run.ai_narrative_generation_id);
    if (error) {
      throw new HttpError(500, "NARRATIVE_SAVE_FAILED", "AI 结果保存失败。");
    }
  } catch (error) {
    await markFailed(run, error);
  }
}

Deno.serve(async (req) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;
  try {
    const body = inputRecord(await readJson(req));
    const operation = body.operation;
    if (operation !== "get" && operation !== "generate") {
      throw new HttpError(
        400,
        "INVALID_OPERATION",
        "operation 必须是 get 或 generate。",
      );
    }
    const sessionId = sessionIdOf(body.session_id);
    const { user, db } = await requireUser(req);
    let run = await loadRun(
      db as ReturnType<typeof serviceClient>,
      user.id,
      sessionId,
    );
    if (operation === "get" || isCurrentReady(run)) {
      return jsonResponse(responseFor(run));
    }

    const claimed = await claimGeneration(run);
    if (claimed) {
      run = claimed;
      runInBackground(generateAndPersist(claimed));
      return jsonResponse(responseFor(run), 202);
    }
    // Another request won the compare-and-set claim; return its current state.
    run = await loadRun(
      db as ReturnType<typeof serviceClient>,
      user.id,
      sessionId,
    );
    return jsonResponse(
      responseFor(run),
      run.ai_narrative_status === "generating" ? 202 : 200,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
