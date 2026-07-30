import { callFunction, supabase } from "@/lib/supabase";
import type {
  CreateDiaryEntryResponse,
  DiaryEntry,
  DiarySummaryResponse,
  ListDiaryResponse,
} from "./data";

const AUDIO_BUCKET = "diary-audio";

export async function listDiaryEntries(input?: {
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
}): Promise<ListDiaryResponse> {
  return callFunction<ListDiaryResponse>("list-diary", {
    limit: input?.limit ?? 100,
    offset: input?.offset ?? 0,
    ...(input?.from ? { from: input.from } : {}),
    ...(input?.to ? { to: input.to } : {}),
  });
}

export async function createVoiceDiary(input: {
  entryId: string;
  recordedAt: string;
  timezone: string;
  mimeType: string;
}): Promise<CreateDiaryEntryResponse> {
  return callFunction<CreateDiaryEntryResponse>("create-diary-entry", {
    entry_id: input.entryId,
    source: "voice",
    recorded_at: input.recordedAt,
    timezone: input.timezone,
    mime_type: input.mimeType,
  });
}

export async function uploadDiaryAudio(input: {
  path: string;
  blob: Blob;
  contentType: string;
}): Promise<void> {
  const { error } = await supabase().storage
    .from(AUDIO_BUCKET)
    .upload(input.path, input.blob, {
      contentType: input.contentType,
      cacheControl: "3600",
      upsert: false,
    });
  if (error) throw error;
}

export async function finalizeVoiceDiary(input: {
  entryId: string;
  durationMs: number;
}): Promise<{ entry_id: string; status: DiaryEntry["status"] }> {
  return callFunction("finalize-diary-entry", {
    entry_id: input.entryId,
    duration_ms: Math.max(0, Math.round(input.durationMs)),
  });
}

export async function diaryAudioUrl(entryId: string): Promise<string> {
  const response = await callFunction<{ signed_url: string }>("diary-audio-url", {
    entry_id: entryId,
  });
  return response.signed_url;
}

export async function deleteDiaryEntry(entryId: string): Promise<void> {
  await callFunction("delete-diary-entry", { entry_id: entryId });
}

export async function deleteDiaryAudio(entryId: string): Promise<void> {
  await callFunction("delete-diary-audio", { entry_id: entryId });
}

export async function exportDiary(): Promise<unknown> {
  return callFunction("export-diary", {});
}

export async function retryDiaryEntry(
  entryId: string,
): Promise<{ entry_id: string; status: DiaryEntry["status"] }> {
  return callFunction("retry-diary-entry", { entry_id: entryId });
}

export async function updateDiaryTranscript(input: {
  entryId: string;
  transcript: string;
}): Promise<{
  entry_id: string;
  status: DiaryEntry["status"];
  content_version: number;
}> {
  return callFunction("update-diary-transcript", {
    entry_id: input.entryId,
    transcript: input.transcript,
  });
}

export async function getDiarySummary(input: {
  period: "day" | "month" | "year";
  ref: string;
}): Promise<DiarySummaryResponse> {
  return callFunction("diary-summary", input);
}
