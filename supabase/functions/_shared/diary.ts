import { HttpError } from "./errors.ts";

export const DIARY_AUDIO_BUCKET = "diary-audio";
export const DIARY_MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const DIARY_MAX_DURATION_MS = 10 * 60 * 1000;

export function diaryPeriodStart(
  period: "day" | "month" | "year",
  date: string,
): string {
  if (period === "day") return date;
  if (period === "month") return `${date.slice(0, 7)}-01`;
  return `${date.slice(0, 4)}-01-01`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIME_TO_EXTENSION: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-m4a": "m4a",
};

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_INPUT", "请求体必须是对象。");
  }
  return value as Record<string, unknown>;
}

function requiredString(
  value: unknown,
  name: string,
  maxLength = 200,
): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "INVALID_INPUT", `${name} 必须是字符串。`);
  }
  const clean = value.trim();
  if (!clean || clean.length > maxLength) {
    throw new HttpError(400, "INVALID_INPUT", `${name} 格式不正确。`);
  }
  return clean;
}

export function normalizeAudioMime(value: unknown): {
  mime: string;
  extension: string;
} {
  const raw = requiredString(value, "mime_type", 100).toLowerCase();
  const mime = raw.split(";", 1)[0]?.trim() ?? "";
  const extension = MIME_TO_EXTENSION[mime];
  if (!extension) {
    throw new HttpError(
      400,
      "UNSUPPORTED_AUDIO",
      "暂不支持这种录音格式，请更换浏览器或改用文字记录。",
    );
  }
  return { mime, extension };
}

function validTimezone(value: unknown): string {
  const timezone = requiredString(value, "timezone", 100);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      "timezone 不是有效的 IANA 时区。",
    );
  }
  return timezone;
}

export function localDateAt(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export type CreateDiaryEntryInput = {
  entryId: string;
  source: "voice";
  recordedAt: string;
  timezone: string;
  localDate: string;
  mime: string;
  extension: string;
};

export function validateCreateDiaryEntryInput(
  value: unknown,
): CreateDiaryEntryInput {
  const body = record(value);
  const entryId = requiredString(body.entry_id, "entry_id", 36);
  if (!UUID_RE.test(entryId)) {
    throw new HttpError(400, "INVALID_INPUT", "entry_id 必须是 UUID。");
  }
  if (body.source !== "voice") {
    throw new HttpError(400, "INVALID_INPUT", "source 必须是 voice。");
  }
  const recordedAtDate = new Date(
    requiredString(body.recorded_at, "recorded_at", 50),
  );
  if (Number.isNaN(recordedAtDate.getTime())) {
    throw new HttpError(400, "INVALID_INPUT", "recorded_at 不是有效时间。");
  }
  const timezone = validTimezone(body.timezone);
  const { mime, extension } = normalizeAudioMime(body.mime_type);
  return {
    entryId,
    source: "voice",
    recordedAt: recordedAtDate.toISOString(),
    timezone,
    localDate: localDateAt(recordedAtDate, timezone),
    mime,
    extension,
  };
}

export type DiaryEntryIdInput = { entryId: string };

export function validateDiaryEntryIdInput(value: unknown): DiaryEntryIdInput {
  const body = record(value);
  const entryId = requiredString(body.entry_id, "entry_id", 36);
  if (!UUID_RE.test(entryId)) {
    throw new HttpError(400, "INVALID_INPUT", "entry_id 必须是 UUID。");
  }
  return { entryId };
}

export type UpdateDiaryTranscriptInput = DiaryEntryIdInput & {
  transcript: string;
};

export function validateUpdateDiaryTranscriptInput(
  value: unknown,
): UpdateDiaryTranscriptInput {
  const body = record(value);
  const { entryId } = validateDiaryEntryIdInput(body);
  const transcript = requiredString(body.transcript, "transcript", 20_000);
  return { entryId, transcript };
}

export type FinalizeDiaryEntryInput = DiaryEntryIdInput & {
  durationMs: number;
};

export function validateFinalizeDiaryEntryInput(
  value: unknown,
): FinalizeDiaryEntryInput {
  const body = record(value);
  const { entryId } = validateDiaryEntryIdInput(body);
  const durationMs = body.duration_ms;
  if (
    typeof durationMs !== "number" ||
    !Number.isInteger(durationMs) ||
    durationMs < 0 ||
    durationMs > DIARY_MAX_DURATION_MS
  ) {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      "录音时长必须在 0 到 10 分钟之间。",
    );
  }
  return { entryId, durationMs };
}

export type ListDiaryInput = {
  limit: number;
  offset: number;
  from?: string;
  to?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateListDiaryInput(value: unknown): ListDiaryInput {
  const body = record(value);
  const limit = body.limit ?? 50;
  const offset = body.offset ?? 0;
  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new HttpError(400, "INVALID_INPUT", "limit 必须是 1 到 100 的整数。");
  }
  if (
    typeof offset !== "number" ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 10_000
  ) {
    throw new HttpError(400, "INVALID_INPUT", "offset 格式不正确。");
  }
  const from = body.from;
  const to = body.to;
  if (from !== undefined && (typeof from !== "string" || !DATE_RE.test(from))) {
    throw new HttpError(400, "INVALID_INPUT", "from 必须是 yyyy-MM-dd。");
  }
  if (to !== undefined && (typeof to !== "string" || !DATE_RE.test(to))) {
    throw new HttpError(400, "INVALID_INPUT", "to 必须是 yyyy-MM-dd。");
  }
  return {
    limit,
    offset,
    from: from as string | undefined,
    to: to as string | undefined,
  };
}

export function requireLinkedAccount(isAnonymous: boolean | undefined): void {
  if (isAnonymous !== false) {
    throw new HttpError(
      403,
      "ACCOUNT_REQUIRED",
      "保存语音日记前请先绑定手机号，避免录音随游客会话丢失。",
    );
  }
}

export function diaryAudioPath(
  userId: string,
  input: Pick<CreateDiaryEntryInput, "entryId" | "localDate" | "extension">,
): string {
  const [year, month] = input.localDate.split("-");
  return `${userId}/${year}/${month}/${input.entryId}/source.${input.extension}`;
}
