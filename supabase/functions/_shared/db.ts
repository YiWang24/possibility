import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.0";
import { LIMITS } from "./config.ts";
import { HttpError } from "./errors.ts";
import type {
  ChatSignal,
  DiaryOutput,
  GeneratedTraveler,
  LabChoiceOutput,
  MatchOutput,
  SimulationOutput,
} from "./schemas.ts";
import type { LabChoiceInput, MatchState } from "./validate.ts";

export type ConversationRow = {
  id: string;
  user_id: string;
  topic: string;
  status: string;
  crossroads?: unknown;
  // 岔路口形成耗时（crossroad_formed.time_to_form_ms）需要对话起点，故一并取回。
  created_at: string;
};

// 对话行的固定投影：新增列必须同时出现在这里和 ConversationRow，否则埋点静默拿到 undefined。
const CONVERSATION_COLUMNS = "id,user_id,topic,status,crossroads,created_at";

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
      .select(CONVERSATION_COLUMNS)
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
    .select(CONVERSATION_COLUMNS)
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
    transcript_raw: transcript,
    title: result.title,
    entry_summary: result.entry_summary,
    emotions: result.emotions,
    keywords: result.keywords,
  });
  if (error) dbFailure("insert diary", error);
}

export async function insertMatchResult(
  db: SupabaseClient,
  userId: string,
  userState: MatchState,
  result: MatchOutput,
): Promise<void> {
  const { error } = await db.from("match_results").insert({
    user_id: userId,
    user_state: userState,
    matches: result.matches,
  });
  if (error) dbFailure("insert match result", error);
}

export async function insertLabChoiceSet(
  db: SupabaseClient,
  userId: string,
  input: LabChoiceInput,
  result: LabChoiceOutput,
): Promise<void> {
  const { error } = await db.from("lab_choice_sets").insert({
    user_id: userId,
    question: input.question,
    topic: input.topic ?? null,
    constraints: input.constraints ?? [],
    previous_choices: input.previousChoices ?? [],
    cards: result.cards,
    rationale: result.rationale,
  });
  if (error) dbFailure("insert lab choice set", error);
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

// 响应回传给前端的旅人对象（对齐 iOS Traveler 模型：is_similar snake_case）。
export type InsertedTraveler = {
  id: number;
  name: string;
  initial: string;
  hue: number;
  is_similar: boolean;
  quote: string;
  bio: string;
  tags: string[];
  dims: string[][];
  trajectory: Array<{ age: string; t: string; d: string }>;
};

// 把 LLM 实时生成的旅人写入共享表 travelers + traveler_details，返回完整对象。
// 必须传入 service-role 客户端（serviceClient()）——travelers 无面向用户的 insert 策略。
//
// id：travelers.id 是普通 bigint 主键（无自增）。用毫秒时间戳基 `Date.now()*10+i`
// 避免「读 max→+1」的读改写竞态，且远离种子 id 1–12；单用户同毫秒并发概率极低。
// 结果保持在 Number.MAX_SAFE_INTEGER 内（~1.7e13），前端按 Int 精确解码。
export async function insertGeneratedTravelers(
  serviceDb: SupabaseClient,
  generated: GeneratedTraveler[],
): Promise<InsertedTraveler[]> {
  if (generated.length === 0) return [];

  const base = Date.now();
  const rows: InsertedTraveler[] = generated.map((t, i) => ({
    id: base * 10 + i,
    name: t.name,
    initial: t.initial,
    hue: t.hue,
    is_similar: true,
    quote: t.quote,
    bio: t.bio,
    tags: t.tags,
    dims: t.dims,
    trajectory: t.trajectory,
  }));

  const { error: travelerError } = await serviceDb.from("travelers").insert(
    rows,
  );
  if (travelerError) dbFailure("insert travelers", travelerError);

  const detailRows = generated.map((t, i) => ({
    traveler_id: rows[i].id,
    age: t.detail.age,
    city: t.detail.city,
    from_role: t.detail.from_role,
    to_role: t.detail.to_role,
    years: t.detail.years,
    intro: t.detail.intro,
    full_text: t.detail.full_text,
    advice: t.detail.advice,
    result: t.detail.result,
    consulted: t.detail.consulted,
    response_time: t.detail.response_time,
  }));
  const { error: detailError } = await serviceDb.from("traveler_details")
    .insert(detailRows);
  if (detailError) dbFailure("insert traveler_details", detailError);

  return rows;
}
