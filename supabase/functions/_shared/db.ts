import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.0";
import { LIMITS } from "./config.ts";
import { HttpError } from "./errors.ts";
import type { ChatSignal, DiaryOutput, SimulationOutput } from "./schemas.ts";

export type ConversationRow = {
  id: string;
  user_id: string;
  topic: string;
  status: string;
  crossroads?: unknown;
};

export type StoredMessage = {
  role: "user" | "assistant";
  content: string;
};

function dbFailure(
  operation: string,
  error: { message: string } | null,
): never {
  console.error(`Database ${operation} failed:`, error?.message);
  throw new HttpError(500, "DATABASE_ERROR", "暂时无法保存数据，请稍后重试。");
}

export async function getOrCreateConversation(
  db: SupabaseClient,
  userId: string,
  topic: string,
  conversationId?: string,
): Promise<ConversationRow> {
  if (conversationId) {
    const { data, error } = await db.from("conversations")
      .select("id,user_id,topic,status,crossroads")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) dbFailure("load conversation", error);
    if (!data) {
      throw new HttpError(
        404,
        "CONVERSATION_NOT_FOUND",
        "对话不存在或无权访问。",
      );
    }
    return data as ConversationRow;
  }

  const { data, error } = await db.from("conversations")
    .insert({ user_id: userId, topic })
    .select("id,user_id,topic,status,crossroads")
    .single();
  if (error || !data) dbFailure("create conversation", error);
  return data as ConversationRow;
}

export async function loadHistory(
  db: SupabaseClient,
  conversationId: string,
): Promise<StoredMessage[]> {
  const { data, error } = await db.from("messages")
    .select("role,content")
    .eq("conversation_id", conversationId)
    .order("id", { ascending: false })
    .limit(LIMITS.historyMessages);
  if (error) dbFailure("load messages", error);
  return ((data ?? []) as StoredMessage[]).reverse();
}

export async function insertMessage(
  db: SupabaseClient,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  meta?: unknown,
): Promise<void> {
  const { error } = await db.from("messages").insert({
    conversation_id: conversationId,
    role,
    content,
    ...(meta === undefined ? {} : { meta }),
  });
  if (error) dbFailure("insert message", error);
}

export async function applyChatSignal(
  db: SupabaseClient,
  userId: string,
  conversationId: string,
  currentStatus: string,
  signal: ChatSignal,
): Promise<{ portrait_pct: number; dims: Record<string, string> }> {
  const conversationUpdate = signal.crossroads.ready
    ? { status: "crossroads", crossroads: signal.crossroads }
    : currentStatus === "open"
    ? { crossroads: signal.crossroads }
    : null;
  if (conversationUpdate) {
    const { error: conversationError } = await db.from("conversations")
      .update(conversationUpdate)
      .eq("id", conversationId)
      .eq("user_id", userId);
    if (conversationError) dbFailure("update conversation", conversationError);
  }

  const newDims = Object.fromEntries(
    signal.profile_updates.map(({ dimension, value }) => [dimension, value]),
  );
  return applyProfileUpdate(db, newDims, signal.portrait_delta);
}

async function applyProfileUpdate(
  db: SupabaseClient,
  dims: Record<string, string>,
  portraitDelta: number,
): Promise<{ portrait_pct: number; dims: Record<string, string> }> {
  const { data, error } = await db.rpc("apply_profile_update", {
    p_dims: dims,
    p_portrait_delta: portraitDelta,
  });
  const row = (data as Array<{ portrait_pct: number; dims: unknown }> | null)
    ?.[0];
  if (error || !row) dbFailure("apply profile update", error);
  return {
    portrait_pct: Number(row.portrait_pct),
    dims: (row.dims as Record<string, string> | null) ?? {},
  };
}

export async function insertSimulation(
  db: SupabaseClient,
  userId: string,
  input: {
    question: string;
    choice: string;
    years: number;
    time_horizon: string;
    carry_cards?: string[];
  },
  result: SimulationOutput,
): Promise<void> {
  const { error } = await db.from("simulations").insert({
    user_id: userId,
    question: input.question,
    choice: input.choice,
    years: input.years,
    time_horizon: input.time_horizon,
    carry_cards: input.carry_cards ?? [],
    scenarios: result.scenarios,
    bottom_line: result.bottom_line_analysis,
  });
  if (error) dbFailure("insert simulation", error);
}

export async function insertDiaryAnalysis(
  db: SupabaseClient,
  userId: string,
  transcript: string,
  result: DiaryOutput,
): Promise<void> {
  const { error } = await db.from("diary_entries").insert({
    user_id: userId,
    transcript,
    emotions: result.emotions,
    keywords: result.keywords,
  });
  if (error) dbFailure("insert diary", error);
}

export async function mergeProfileDimensions(
  db: SupabaseClient,
  updates: Array<{ dimension: string; value: string }>,
): Promise<void> {
  if (updates.length === 0) return;
  const dims = Object.fromEntries(
    updates.map(({ dimension, value }) => [dimension, value]),
  );
  await applyProfileUpdate(db, dims, 0);
}
