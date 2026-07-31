import { runtimeConfig } from "./config.ts";
import { diaryPeriodStart } from "./diary.ts";
import {
  type DiaryJob,
  enqueueDiaryJob,
  entryJobKey,
  summaryJobKey,
} from "./diary-queue.ts";
import {
  buildDiaryProfileProposalRows,
  type DiaryProfileUpdate,
  profileUpdatesFromAnalysis,
} from "./diary-profile-proposals.ts";
import { structuredOutput } from "./llm-lazy.ts";
import { diaryPrompt, layeredDiarySummaryPrompt } from "./prompts.ts";
import {
  type DiaryOutput,
  diarySchema,
  type LayeredDiarySummaryOutput,
  layeredDiarySummarySchema,
} from "./schemas.ts";
import { serviceClient } from "./service.ts";
import { transcribeDiaryAudio, TranscriptionError } from "./transcription.ts";
import { ServerEvent } from "./events.ts";
import { trackEvent } from "./track.ts";

const MAX_SUMMARY_INPUT_CHARS = 28_000;
const SUMMARY_PROMPT_VERSION = "diary-summary-v2";
const ANALYSIS_PROMPT_VERSION = "diary-entry-v2";

type EntryRow = {
  entry_uuid: string;
  user_id: string;
  status: string;
  local_date: string;
  audio_path: string | null;
  audio_mime: string | null;
  audio_bytes: number | null;
  duration_ms: number | null;
  transcript: string | null;
  transcript_raw: string | null;
  transcript_edited: string | null;
  title: string | null;
  entry_summary: string | null;
  emotions: string[] | null;
  keywords: string[] | null;
  analysis: Record<string, unknown>;
  content_version: number;
  attempt_count: number;
  updated_at: string;
  deleted_at: string | null;
};

type SummaryRow = {
  period_type: "day" | "month" | "year";
  period_start: string;
  status: string;
  source_fingerprint: string | null;
  summary: Record<string, unknown>;
};

export class DiaryProcessingError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable = true,
  ) {
    super(code);
    this.name = "DiaryProcessingError";
  }
}

function nextPeriodStart(
  period: "day" | "month" | "year",
  start: string,
): string {
  const date = new Date(`${start}T00:00:00.000Z`);
  if (period === "day") date.setUTCDate(date.getUTCDate() + 1);
  if (period === "month") date.setUTCMonth(date.getUTCMonth() + 1);
  if (period === "year") date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function storeDiaryProfileProposals(
  userId: string,
  entryId: string,
  sourceVersion: number,
  updates: DiaryProfileUpdate[],
): Promise<void> {
  const rows = await buildDiaryProfileProposalRows(
    userId,
    entryId,
    sourceVersion,
    updates,
    {
      modelName: runtimeConfig.diaryModel,
      promptVersion: ANALYSIS_PROMPT_VERSION,
    },
  );
  if (rows.length === 0) return;
  const { error } = await serviceClient().from("memory_proposals").upsert(
    rows,
    { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
  );
  if (error) {
    throw new DiaryProcessingError("DIARY_PROFILE_PROPOSAL_SAVE_FAILED");
  }
}

export function entryFingerprint(entries: EntryRow[]): Promise<string> {
  return sha256(
    entries
      .slice()
      .sort((a, b) => a.entry_uuid.localeCompare(b.entry_uuid))
      .map((entry) =>
        [
          entry.entry_uuid,
          entry.content_version,
          entry.status,
          entry.updated_at,
        ].join(":")
      )
      .join("|"),
  );
}

function topFrequent(values: string[], max: number): string[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = raw.trim();
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([value]) => value);
}

function finalText(entry: EntryRow): string {
  return (entry.transcript_edited ?? entry.transcript_raw ?? entry.transcript ??
    "").trim();
}

async function loadEntry(userId: string, entryId: string): Promise<EntryRow> {
  const result = await serviceClient()
    .from("diary_entries")
    .select(
      "entry_uuid,user_id,status,local_date,audio_path,audio_mime,audio_bytes," +
        "duration_ms,transcript,transcript_raw,transcript_edited,title," +
        "entry_summary,emotions,keywords,analysis,content_version,attempt_count," +
        "updated_at,deleted_at",
    )
    .eq("user_id", userId)
    .eq("entry_uuid", entryId)
    .is("deleted_at", null)
    .maybeSingle();
  if (result.error) throw new DiaryProcessingError("DIARY_ENTRY_READ_FAILED");
  if (!result.data) {
    throw new DiaryProcessingError("DIARY_ENTRY_NOT_FOUND", false);
  }
  return result.data as unknown as EntryRow;
}

export async function processTranscription(job: DiaryJob): Promise<void> {
  if (!job.entry_id) {
    throw new DiaryProcessingError("DIARY_JOB_ENTRY_ID_MISSING", false);
  }
  const entry = await loadEntry(job.user_id, job.entry_id);
  if (finalText(entry)) {
    if (["uploaded", "failed"].includes(entry.status)) {
      const recovered = await serviceClient()
        .from("diary_entries")
        .update({ status: "transcribed", error_code: null })
        .eq("user_id", entry.user_id)
        .eq("entry_uuid", entry.entry_uuid)
        .in("status", ["uploaded", "failed"]);
      if (recovered.error) {
        throw new DiaryProcessingError("DIARY_TRANSCRIPTION_RECOVERY_FAILED");
      }
    }
    await enqueueDiaryJob({
      job_key: entryJobKey(
        "analyze_entry",
        entry.entry_uuid,
        entry.content_version,
      ),
      task_type: "analyze_entry",
      user_id: entry.user_id,
      entry_id: entry.entry_uuid,
      period_start: null,
    });
    return;
  }
  if (!entry.audio_path || !entry.audio_mime) {
    throw new DiaryProcessingError("AUDIO_NOT_FOUND", false);
  }

  const claimed = await serviceClient()
    .from("diary_entries")
    .update({
      status: "transcribing",
      error_code: null,
      attempt_count: entry.attempt_count + 1,
    })
    .eq("user_id", entry.user_id)
    .eq("entry_uuid", entry.entry_uuid)
    .in("status", ["uploaded", "failed"])
    .select("entry_uuid")
    .maybeSingle();
  if (claimed.error) {
    throw new DiaryProcessingError("DIARY_TRANSCRIPTION_CLAIM_FAILED");
  }
  if (!claimed.data) {
    throw new DiaryProcessingError(
      entry.status === "transcribing"
        ? "DIARY_TRANSCRIPTION_BUSY"
        : "DIARY_TRANSCRIPTION_STATE_INVALID",
      entry.status === "transcribing",
    );
  }

  const downloaded = await serviceClient().storage
    .from("diary-audio")
    .download(entry.audio_path);
  if (downloaded.error || !downloaded.data) {
    throw new DiaryProcessingError("AUDIO_DOWNLOAD_FAILED");
  }
  if (downloaded.data.size > 20 * 1024 * 1024) {
    throw new DiaryProcessingError("AUDIO_TOO_LARGE", false);
  }

  let transcript;
  try {
    transcript = await transcribeDiaryAudio(
      downloaded.data,
      entry.audio_path.split("/").at(-1) ?? "diary.webm",
      entry.audio_mime,
    );
  } catch (error) {
    if (error instanceof TranscriptionError) {
      throw new DiaryProcessingError(error.code, error.retryable);
    }
    throw error;
  }

  const updated = await serviceClient()
    .from("diary_entries")
    .update({
      status: "transcribed",
      transcript: transcript.text,
      transcript_raw: transcript.text,
      transcript_language: transcript.language,
      transcription_provider: transcript.provider,
      transcription_model: transcript.model,
      transcribed_at: new Date().toISOString(),
      error_code: null,
    })
    .eq("user_id", entry.user_id)
    .eq("entry_uuid", entry.entry_uuid)
    .eq("status", "transcribing")
    .select("entry_uuid")
    .maybeSingle();
  if (updated.error || !updated.data) {
    throw new DiaryProcessingError("DIARY_TRANSCRIPTION_SAVE_FAILED");
  }

  await enqueueDiaryJob({
    job_key: entryJobKey(
      "analyze_entry",
      entry.entry_uuid,
      entry.content_version,
    ),
    task_type: "analyze_entry",
    user_id: entry.user_id,
    entry_id: entry.entry_uuid,
    period_start: null,
  });
}

export async function processEntryAnalysis(job: DiaryJob): Promise<void> {
  if (!job.entry_id) {
    throw new DiaryProcessingError("DIARY_JOB_ENTRY_ID_MISSING", false);
  }
  const entry = await loadEntry(job.user_id, job.entry_id);
  if (entry.status === "ready" && entry.entry_summary) {
    await storeDiaryProfileProposals(
      entry.user_id,
      entry.entry_uuid,
      entry.content_version,
      profileUpdatesFromAnalysis(entry.analysis),
    );
    return;
  }
  const transcript = finalText(entry);
  if (!transcript) {
    throw new DiaryProcessingError("TRANSCRIPT_EMPTY", false);
  }

  const claimed = await serviceClient()
    .from("diary_entries")
    .update({
      status: "analyzing",
      error_code: null,
      attempt_count: entry.attempt_count + 1,
    })
    .eq("user_id", entry.user_id)
    .eq("entry_uuid", entry.entry_uuid)
    .in("status", ["transcribed", "failed"])
    .select("entry_uuid")
    .maybeSingle();
  if (claimed.error) {
    throw new DiaryProcessingError("DIARY_ANALYSIS_CLAIM_FAILED");
  }
  if (!claimed.data) {
    throw new DiaryProcessingError(
      entry.status === "analyzing"
        ? "DIARY_ANALYSIS_BUSY"
        : "DIARY_ANALYSIS_STATE_INVALID",
      entry.status === "analyzing",
    );
  }

  const result = await structuredOutput<DiaryOutput>({
    model: runtimeConfig.diaryModel,
    maxTokens: 1_024,
    system: diaryPrompt,
    prompt: transcript,
    schema: diarySchema,
    track: { userId: entry.user_id, feature: "analyze_diary_entry" },
  });

  const updated = await serviceClient()
    .from("diary_entries")
    .update({
      status: "ready",
      title: result.title.slice(0, 48),
      entry_summary: result.entry_summary.slice(0, 240),
      emotions: result.emotions,
      keywords: result.keywords,
      analysis: {
        dim_updates: result.dim_updates,
        source: "transcript",
      },
      analysis_provider: "deepseek",
      analysis_model: runtimeConfig.diaryModel,
      prompt_version: ANALYSIS_PROMPT_VERSION,
      analyzed_at: new Date().toISOString(),
      error_code: null,
    })
    .eq("user_id", entry.user_id)
    .eq("entry_uuid", entry.entry_uuid)
    .eq("status", "analyzing")
    .select("entry_uuid,local_date")
    .maybeSingle();
  if (updated.error || !updated.data) {
    throw new DiaryProcessingError("DIARY_ANALYSIS_SAVE_FAILED");
  }
  await storeDiaryProfileProposals(
    entry.user_id,
    entry.entry_uuid,
    entry.content_version,
    result.dim_updates,
  );
  trackEvent(entry.user_id, ServerEvent.DIARY_CREATED, {
    input_method: "voice",
    content_chars: transcript.length,
  });

  const dayStart = updated.data.local_date;
  await enqueueDiaryJob({
    job_key: summaryJobKey(
      "generate_day_summary",
      entry.user_id,
      dayStart,
    ),
    task_type: "generate_day_summary",
    user_id: entry.user_id,
    entry_id: null,
    period_start: dayStart,
  }, 5);
}

function summaryPeriod(task: DiaryJob["task_type"]):
  | "day"
  | "month"
  | "year" {
  if (task === "generate_day_summary") return "day";
  if (task === "generate_month_summary") return "month";
  if (task === "generate_year_summary") return "year";
  throw new DiaryProcessingError("DIARY_SUMMARY_TASK_INVALID", false);
}

async function loadPeriodEntries(
  userId: string,
  period: "day" | "month" | "year",
  start: string,
): Promise<EntryRow[]> {
  const result = await serviceClient()
    .from("diary_entries")
    .select(
      "entry_uuid,user_id,status,local_date,audio_path,audio_mime,audio_bytes," +
        "duration_ms,transcript,transcript_raw,transcript_edited,title," +
        "entry_summary,emotions,keywords,analysis,content_version,attempt_count," +
        "updated_at,deleted_at",
    )
    .eq("user_id", userId)
    .eq("status", "ready")
    .is("deleted_at", null)
    .gte("local_date", start)
    .lt("local_date", nextPeriodStart(period, start))
    .order("local_date", { ascending: true })
    .order("recorded_at", { ascending: true })
    .limit(1000);
  if (result.error) throw new DiaryProcessingError("DIARY_PERIOD_READ_FAILED");
  return (result.data ?? []) as unknown as EntryRow[];
}

async function loadChildSummaries(
  userId: string,
  period: "month" | "year",
  start: string,
): Promise<SummaryRow[]> {
  const childType = period === "month" ? "day" : "month";
  const result = await serviceClient()
    .from("diary_summaries")
    .select("period_type,period_start,status,source_fingerprint,summary")
    .eq("user_id", userId)
    .eq("period_type", childType)
    .eq("status", "ready")
    .gte("period_start", start)
    .lt("period_start", nextPeriodStart(period, start))
    .order("period_start", { ascending: true });
  if (result.error) {
    throw new DiaryProcessingError("DIARY_CHILD_SUMMARY_READ_FAILED");
  }
  return (result.data ?? []) as unknown as SummaryRow[];
}

function summaryPromptInput(
  period: "day" | "month" | "year",
  start: string,
  entries: EntryRow[],
  children: SummaryRow[],
  stats: {
    activeDays: number;
    durationMs: number;
    topEmotions: string[];
    topKeywords: string[];
  },
): string {
  // Raw transcripts stay inside the daily layer. Month/year consume child
  // summaries so a busy recent week cannot crowd older periods out.
  const evidence = period === "day"
    ? entries.map((entry) => ({
      entry_id: entry.entry_uuid,
      date: entry.local_date,
      title: entry.title,
      summary: entry.entry_summary,
      transcript: finalText(entry).slice(
        0,
        Math.max(300, Math.floor(14_000 / Math.max(entries.length, 1))),
      ),
    }))
    : [];
  const childBudget = Math.max(
    240,
    Math.floor(16_000 / Math.max(children.length, 1)),
  );
  const childSummaries = children.map((child) => ({
    period_start: child.period_start,
    insight: typeof child.summary.insight === "string"
      ? child.summary.insight.slice(0, Math.floor(childBudget * 0.55))
      : "",
    highlights: Array.isArray(child.summary.highlight_refs)
      ? child.summary.highlight_refs.slice(0, 2)
      : [],
  }));
  const payload = {
    period,
    period_start: start,
    in_progress: Date.now() <
      new Date(`${nextPeriodStart(period, start)}T00:00:00Z`).getTime(),
    deterministic_stats: {
      entry_count: entries.length,
      active_day_count: stats.activeDays,
      total_duration_ms: stats.durationMs,
      top_emotions: stats.topEmotions,
      top_keywords: stats.topKeywords,
    },
    child_summaries: childSummaries,
    evidence,
  };
  const serialized = JSON.stringify(payload);
  if (serialized.length <= MAX_SUMMARY_INPUT_CHARS) return serialized;
  return JSON.stringify({
    ...payload,
    child_summaries: childSummaries.map((child) => ({
      period_start: child.period_start,
      insight: child.insight.slice(0, 120),
      highlights: [],
    })),
    evidence: evidence.map((item) => ({
      ...item,
      transcript: item.transcript.slice(0, 200),
    })),
  });
}

async function queueParentSummary(
  userId: string,
  period: "day" | "month" | "year",
  periodStart: string,
): Promise<void> {
  if (period === "year") return;
  const task = period === "day"
    ? "generate_month_summary"
    : "generate_year_summary";
  const parentStart = diaryPeriodStart(
    period === "day" ? "month" : "year",
    periodStart,
  );
  await enqueueDiaryJob({
    job_key: summaryJobKey(task, userId, parentStart),
    task_type: task,
    user_id: userId,
    entry_id: null,
    period_start: parentStart,
  }, 5);
}

async function queueMissingChildSummaries(
  job: DiaryJob,
  period: "day" | "month" | "year",
  entries: EntryRow[],
  children: SummaryRow[],
): Promise<boolean> {
  if (period === "day" || entries.length === 0) return false;
  const existingStarts = new Set(children.map((child) => child.period_start));
  const expectedStarts = new Set(
    entries.map((entry) =>
      period === "month"
        ? entry.local_date
        : diaryPeriodStart("month", entry.local_date)
    ),
  );
  const childTask = period === "month"
    ? "generate_day_summary"
    : "generate_month_summary";
  const missing = [...expectedStarts].filter((start) =>
    !existingStarts.has(start)
  );
  if (missing.length === 0) return false;

  for (const start of missing) {
    await enqueueDiaryJob({
      job_key: summaryJobKey(childTask, job.user_id, start),
      task_type: childTask,
      user_id: job.user_id,
      entry_id: null,
      period_start: start,
    });
  }
  const waitKey = (await entryFingerprint(entries)).slice(0, 16);
  await enqueueDiaryJob({
    ...job,
    job_key: summaryJobKey(
      job.task_type as
        | "generate_month_summary"
        | "generate_year_summary",
      job.user_id,
      job.period_start!,
      `wait-${waitKey}`,
    ),
  }, 15);
  return true;
}

export async function processDiarySummary(job: DiaryJob): Promise<void> {
  if (!job.period_start) {
    throw new DiaryProcessingError("DIARY_JOB_PERIOD_MISSING", false);
  }
  const period = summaryPeriod(job.task_type);
  const entries = await loadPeriodEntries(
    job.user_id,
    period,
    job.period_start,
  );
  const children = period === "day"
    ? []
    : await loadChildSummaries(job.user_id, period, job.period_start);
  if (
    await queueMissingChildSummaries(job, period, entries, children)
  ) {
    return;
  }
  const fingerprint = await sha256(
    `${await entryFingerprint(entries)}|${
      children.map((item) =>
        `${item.period_start}:${item.source_fingerprint ?? ""}`
      ).join("|")
    }`,
  );

  const existing = await serviceClient()
    .from("diary_summaries")
    .select("status,source_fingerprint,attempt_count")
    .eq("user_id", job.user_id)
    .eq("period_type", period)
    .eq("period_start", job.period_start)
    .maybeSingle();
  if (existing.error) {
    throw new DiaryProcessingError("DIARY_SUMMARY_READ_FAILED");
  }
  if (
    existing.data?.status === "ready" &&
    existing.data.source_fingerprint === fingerprint
  ) {
    return;
  }

  const activeDays = new Set(entries.map((entry) => entry.local_date)).size;
  const durationMs = entries.reduce(
    (total, entry) => total + (entry.duration_ms ?? 0),
    0,
  );
  const topEmotions = topFrequent(
    entries.flatMap((entry) => entry.emotions ?? []),
    5,
  );
  const topKeywords = topFrequent(
    entries.flatMap((entry) => entry.keywords ?? []),
    8,
  );
  const baseRow = {
    user_id: job.user_id,
    period_type: period,
    period_start: job.period_start,
    status: "generating",
    source_fingerprint: fingerprint,
    entry_count: entries.length,
    active_day_count: activeDays,
    total_duration_ms: durationMs,
    provider: "deepseek",
    model: runtimeConfig.diaryModel,
    prompt_version: SUMMARY_PROMPT_VERSION,
    error_code: null,
    attempt_count: (existing.data?.attempt_count ?? 0) + 1,
  };
  const preparing = await serviceClient()
    .from("diary_summaries")
    .upsert(baseRow, { onConflict: "user_id,period_type,period_start" });
  if (preparing.error) {
    throw new DiaryProcessingError("DIARY_SUMMARY_PREPARE_FAILED");
  }

  if (entries.length === 0) {
    const empty = await serviceClient()
      .from("diary_summaries")
      .update({
        status: "ready",
        summary: {
          insight: "这个周期还没有可以总结的日记。",
          top_emotions: [],
          top_keywords: [],
          highlights: [],
          highlight_refs: [],
        },
        generated_at: new Date().toISOString(),
        data_cutoff_at: new Date().toISOString(),
      })
      .eq("user_id", job.user_id)
      .eq("period_type", period)
      .eq("period_start", job.period_start)
      .eq("source_fingerprint", fingerprint);
    if (empty.error) {
      throw new DiaryProcessingError("DIARY_SUMMARY_SAVE_FAILED");
    }
    await queueParentSummary(job.user_id, period, job.period_start);
    return;
  }

  const generated = await structuredOutput<LayeredDiarySummaryOutput>({
    model: runtimeConfig.diaryModel,
    maxTokens: period === "year" ? 1_600 : 1_024,
    system: layeredDiarySummaryPrompt,
    prompt: summaryPromptInput(period, job.period_start, entries, children, {
      activeDays,
      durationMs,
      topEmotions,
      topKeywords,
    }),
    schema: layeredDiarySummarySchema,
    track: { userId: job.user_id, feature: `diary_summary_${period}` },
  });

  const allowedEntryIds = new Set(entries.map((entry) => entry.entry_uuid));
  const highlightRefs = generated.highlights
    .map((highlight) => ({
      text: highlight.text,
      entry_ids: highlight.entry_ids.filter((id) => allowedEntryIds.has(id)),
    }))
    .filter((highlight) => highlight.entry_ids.length > 0);

  const currentEntries = await loadPeriodEntries(
    job.user_id,
    period,
    job.period_start,
  );
  const currentChildren = period === "day"
    ? []
    : await loadChildSummaries(job.user_id, period, job.period_start);
  const currentFingerprint = await sha256(
    `${await entryFingerprint(currentEntries)}|${
      currentChildren.map((item) =>
        `${item.period_start}:${item.source_fingerprint ?? ""}`
      ).join("|")
    }`,
  );
  if (currentFingerprint !== fingerprint) {
    await serviceClient()
      .from("diary_summaries")
      .update({ status: "stale" })
      .eq("user_id", job.user_id)
      .eq("period_type", period)
      .eq("period_start", job.period_start);
    await enqueueDiaryJob({
      ...job,
      job_key: summaryJobKey(
        job.task_type as
          | "generate_day_summary"
          | "generate_month_summary"
          | "generate_year_summary",
        job.user_id,
        job.period_start,
        currentFingerprint.slice(0, 16),
      ),
    });
    return;
  }

  const saved = await serviceClient()
    .from("diary_summaries")
    .update({
      status: "ready",
      summary: {
        insight: generated.insight,
        top_emotions: topEmotions,
        top_keywords: topKeywords,
        highlights: highlightRefs.map((item) => item.text),
        highlight_refs: highlightRefs,
      },
      generated_at: new Date().toISOString(),
      data_cutoff_at: new Date().toISOString(),
      error_code: null,
    })
    .eq("user_id", job.user_id)
    .eq("period_type", period)
    .eq("period_start", job.period_start)
    .eq("source_fingerprint", fingerprint);
  if (saved.error) {
    throw new DiaryProcessingError("DIARY_SUMMARY_SAVE_FAILED");
  }

  await queueParentSummary(job.user_id, period, job.period_start);
}

export function processDiaryJob(job: DiaryJob): Promise<void> {
  if (job.task_type === "transcribe_entry") {
    return processTranscription(job);
  }
  if (job.task_type === "analyze_entry") {
    return processEntryAnalysis(job);
  }
  return processDiarySummary(job);
}

export async function recordDiaryJobFailure(
  job: DiaryJob,
  error: unknown,
  terminal: boolean,
): Promise<void> {
  const code = error instanceof DiaryProcessingError
    ? error.code
    : "DIARY_PROCESSING_FAILED";
  if (job.entry_id) {
    const fallbackStatus = job.task_type === "transcribe_entry"
      ? "uploaded"
      : "transcribed";
    await serviceClient()
      .from("diary_entries")
      .update({
        status: terminal ? "failed" : fallbackStatus,
        error_code: code,
      })
      .eq("user_id", job.user_id)
      .eq("entry_uuid", job.entry_id);
    return;
  }
  if (job.period_start) {
    await serviceClient()
      .from("diary_summaries")
      .update({
        status: terminal ? "failed" : "pending",
        error_code: code,
      })
      .eq("user_id", job.user_id)
      .eq("period_type", summaryPeriod(job.task_type))
      .eq("period_start", job.period_start);
  }
}
