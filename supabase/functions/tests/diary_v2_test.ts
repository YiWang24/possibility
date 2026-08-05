import {
  diaryAudioPath,
  diaryPeriodStart,
  localDateAt,
  normalizeAudioMime,
  requireLinkedAccount,
  validateCreateDiaryEntryInput,
  validateFinalizeDiaryEntryInput,
  validateListDiaryInput,
  validateUpdateDiaryTranscriptInput,
} from "../_shared/diary.ts";
import { entryJobKey, summaryJobKey } from "../_shared/diary-queue.ts";
import { buildDiaryProfileProposalRows } from "../_shared/diary-profile-proposals.ts";
import { HttpError } from "../_shared/errors.ts";
import {
  transcribeDiaryAudio,
  TranscriptionError,
} from "../_shared/transcription.ts";
import { validateDiarySummaryInput } from "../_shared/validate.ts";

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertHttpError(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error(`expected HttpError ${code}`);
  } catch (error) {
    assert(error instanceof HttpError, "expected HttpError");
    assert(error.code === code, `expected ${code}, got ${error.code}`);
  }
}

Deno.test("voice diary creation derives local date and immutable audio path", () => {
  const input = validateCreateDiaryEntryInput({
    entry_id: "01901234-5678-7abc-8def-0123456789ab",
    source: "voice",
    recorded_at: "2026-07-31T02:30:00.000Z",
    timezone: "America/Toronto",
    mime_type: "audio/webm;codecs=opus",
  });

  assert(input.localDate === "2026-07-30");
  assert(input.mime === "audio/webm");
  assert(input.extension === "webm");
  assert(
    diaryAudioPath("user-1", input) ===
      "user-1/2026/07/01901234-5678-7abc-8def-0123456789ab/source.webm",
  );
});

Deno.test("local diary date respects the user's timezone", () => {
  const instant = new Date("2026-01-01T01:00:00.000Z");
  assert(localDateAt(instant, "UTC") === "2026-01-01");
  assert(localDateAt(instant, "America/Toronto") === "2025-12-31");
});

Deno.test("diary period starts are stable date keys", () => {
  assert(diaryPeriodStart("day", "2026-07-30") === "2026-07-30");
  assert(diaryPeriodStart("month", "2026-07-30") === "2026-07-01");
  assert(diaryPeriodStart("year", "2026-07-30") === "2026-01-01");
});

Deno.test("voice diary rejects invalid identifiers, timezones, and audio formats", () => {
  const base = {
    entry_id: "01901234-5678-7abc-8def-0123456789ab",
    source: "voice",
    recorded_at: "2026-07-30T12:00:00.000Z",
    timezone: "America/Toronto",
    mime_type: "audio/mp4",
  };
  assertHttpError(
    () => validateCreateDiaryEntryInput({ ...base, entry_id: "not-a-uuid" }),
    "INVALID_INPUT",
  );
  assertHttpError(
    () => validateCreateDiaryEntryInput({ ...base, timezone: "Mars/Olympus" }),
    "INVALID_INPUT",
  );
  assertHttpError(() => normalizeAudioMime("audio/ogg"), "UNSUPPORTED_AUDIO");
});

Deno.test("voice diary finalization enforces the ten minute limit", () => {
  const entry_id = "01901234-5678-7abc-8def-0123456789ab";
  assert(
    validateFinalizeDiaryEntryInput({ entry_id, duration_ms: 600_000 })
      .durationMs === 600_000,
  );
  assertHttpError(
    () => validateFinalizeDiaryEntryInput({ entry_id, duration_ms: 600_001 }),
    "INVALID_INPUT",
  );
});

Deno.test("diary list validates pagination and local date filters", () => {
  const input = validateListDiaryInput({
    limit: 100,
    offset: 10,
    from: "2026-07-01",
    to: "2026-08-01",
  });
  assert(input.limit === 100);
  assert(input.offset === 10);
  assert(input.from === "2026-07-01");
  assert(input.to === "2026-08-01");
  assertHttpError(
    () => validateListDiaryInput({ from: "07/01/2026" }),
    "INVALID_INPUT",
  );
});

Deno.test("voice diary writes require a linked account", () => {
  requireLinkedAccount(false);
  assertHttpError(() => requireLinkedAccount(true), "ACCOUNT_REQUIRED");
  assertHttpError(() => requireLinkedAccount(undefined), "ACCOUNT_REQUIRED");
});

Deno.test("diary transcript edits and layered summary refs are validated", () => {
  const entry_id = "01901234-5678-7abc-8def-0123456789ab";
  const edit = validateUpdateDiaryTranscriptInput({
    entry_id,
    transcript: "  今天完成了第一版。  ",
  });
  assert(edit.transcript === "今天完成了第一版。");
  assert(validateDiarySummaryInput({ period: "day", ref: "2026-07-30" }));
  assert(validateDiarySummaryInput({ period: "month", ref: "2026-07" }));
  assert(validateDiarySummaryInput({ period: "year", ref: "2026" }));
  assertHttpError(
    () => validateDiarySummaryInput({ period: "day", ref: "2026-07" }),
    "INVALID_INPUT",
  );
});

Deno.test("diary queue keys are stable per content version and period", () => {
  const entryId = "01901234-5678-7abc-8def-0123456789ab";
  assert(
    entryJobKey("transcribe_entry", entryId, 2) ===
      `transcribe_entry:${entryId}:v2`,
  );
  assert(
    summaryJobKey(
      "generate_month_summary",
      "user-1",
      "2026-07-01",
    ) === "generate_month_summary:user-1:2026-07-01:latest",
  );
});

Deno.test("diary profile proposals are normalized, deduplicated, and versioned", async () => {
  const rows = await buildDiaryProfileProposalRows(
    "user-1",
    "01901234-5678-7abc-8def-0123456789ab",
    3,
    [
      { dimension: "skill", value: "  Product   Strategy " },
      { dimension: "skill", value: "product strategy" },
      { dimension: "like", value: "安静地散步" },
      { dimension: "invalid", value: "不能写入" },
    ],
    { modelName: "deepseek-test", promptVersion: "diary-entry-test" },
  );

  assert(rows.length === 2);
  assert(rows[0].source_type === "diary");
  assert(rows[0].source_version === 3);
  assert(rows[0].normalized_value === "product strategy");
  assert(rows[0].dedupe_key.length === 64);

  const repeated = await buildDiaryProfileProposalRows(
    "user-1",
    "01901234-5678-7abc-8def-0123456789ab",
    3,
    [{ dimension: "skill", value: "Product Strategy" }],
    { modelName: "deepseek-test", promptVersion: "diary-entry-test" },
  );
  assert(repeated[0].dedupe_key === rows[0].dedupe_key);
});

Deno.test("Azure transcription sends multipart audio and returns text", async () => {
  let requestedUrl = "";
  let subscriptionKey = "";
  const captured: {
    definition: FormDataEntryValue | null;
    audioField: FormDataEntryValue | null;
  } = { definition: null, audioField: null };
  const fetchImpl = ((input: string | URL | Request, init?: RequestInit) => {
    requestedUrl = String(input);
    subscriptionKey =
      new Headers(init?.headers).get("Ocp-Apim-Subscription-Key") ?? "";
    const form = init?.body as FormData;
    captured.definition = form.get("definition");
    captured.audioField = form.get("audio");
    return Promise.resolve(
      Response.json({
        combinedPhrases: [{ text: "今天完成了真实语音转写。" }],
        phrases: [{ locale: "zh-CN", text: "今天完成了真实语音转写。" }],
      }),
    );
  }) as typeof fetch;

  const result = await transcribeDiaryAudio(
    new Blob(["voice-bytes"], { type: "audio/webm" }),
    "source.webm",
    "audio/webm",
    {
      apiKey: "test-key",
      endpoint: "https://speech.example.test/",
      apiVersion: "2025-10-15",
      locales: ["zh-CN", "en-US"],
      fetchImpl,
    },
  );

  assert(
    requestedUrl ===
      "https://speech.example.test/speechtotext/transcriptions:transcribe?api-version=2025-10-15",
  );
  assert(subscriptionKey === "test-key");
  assert(captured.definition === '{"locales":["zh-CN","en-US"]}');
  assert(captured.audioField instanceof File);
  assert(result.text === "今天完成了真实语音转写。");
  assert(result.language === "zh-CN");
  assert(result.provider === "azure");
});

Deno.test("Azure transcription marks rate limits retryable", async () => {
  const fetchImpl = (() =>
    Promise.resolve(
      new Response("rate limited", {
        status: 429,
      }),
    )) as typeof fetch;
  try {
    await transcribeDiaryAudio(
      new Blob(["voice"]),
      "source.webm",
      "audio/webm",
      {
        apiKey: "test-key",
        endpoint: "https://speech.example.test",
        apiVersion: "2025-10-15",
        locales: ["zh-CN"],
        fetchImpl,
      },
    );
    throw new Error("expected transcription failure");
  } catch (error) {
    assert(error instanceof TranscriptionError);
    assert(error.code === "TRANSCRIPTION_UPSTREAM_429");
    assert(error.retryable);
  }
});

// Azure 把"没听到人声"和"这不是音频"都塞进 422。折叠成一个配置错误会让用户看到
// 「服务配置错误」，也会让运维分不清密钥失效和用户录了段静音。响应样本取自真实
// eastus 端点，见 transcription_live_test.ts。
Deno.test("Azure 422 区分无人声、不支持格式与其他拒绝", async () => {
  const cases: Array<[string, string]> = [
    ["NoLanguageIdentified", "TRANSCRIPTION_EMPTY"],
    ["InvalidAudioFormat", "UNSUPPORTED_AUDIO"],
    ["SomethingElse", "TRANSCRIPTION_AUDIO_REJECTED"],
  ];

  for (const [innerCode, expected] of cases) {
    const fetchImpl = (() =>
      Promise.resolve(
        Response.json({
          code: "UnprocessableEntity",
          message: "…",
          innerError: { code: innerCode, message: "…" },
        }, { status: 422 }),
      )) as typeof fetch;
    try {
      await transcribeDiaryAudio(
        new Blob(["voice"]),
        "source.webm",
        "audio/webm",
        {
          apiKey: "test-key",
          endpoint: "https://speech.example.test",
          apiVersion: "2025-10-15",
          locales: ["zh-CN"],
          fetchImpl,
        },
      );
      throw new Error(`expected failure for ${innerCode}`);
    } catch (error) {
      assert(error instanceof TranscriptionError);
      assert(error.code === expected, `${innerCode} → ${error.code}`);
      // 三种都是终态：自动重试只会重复烧配额，恢复要靠用户重录或改用文字。
      assert(!error.retryable);
    }
  }
});

Deno.test("Azure 422 错误体不可解析时回退到通用拒绝码", async () => {
  const fetchImpl = (() =>
    Promise.resolve(
      new Response("<html>gateway</html>", { status: 422 }),
    )) as typeof fetch;
  try {
    await transcribeDiaryAudio(
      new Blob(["voice"]),
      "source.webm",
      "audio/webm",
      {
        apiKey: "test-key",
        endpoint: "https://speech.example.test",
        apiVersion: "2025-10-15",
        locales: ["zh-CN"],
        fetchImpl,
      },
    );
    throw new Error("expected transcription failure");
  } catch (error) {
    assert(error instanceof TranscriptionError);
    assert(error.code === "TRANSCRIPTION_AUDIO_REJECTED");
    assert(!error.retryable);
  }
});

// 401 必须留在配置错误里：这是唯一需要立刻报警的一类，不能被音频类错误淹没。
Deno.test("Azure 401 仍然是配置错误", async () => {
  const fetchImpl = (() =>
    Promise.resolve(
      Response.json({ error: { code: "401", message: "…" } }, { status: 401 }),
    )) as typeof fetch;
  try {
    await transcribeDiaryAudio(
      new Blob(["voice"]),
      "source.webm",
      "audio/webm",
      {
        apiKey: "test-key",
        endpoint: "https://speech.example.test",
        apiVersion: "2025-10-15",
        locales: ["zh-CN"],
        fetchImpl,
      },
    );
    throw new Error("expected transcription failure");
  } catch (error) {
    assert(error instanceof TranscriptionError);
    assert(error.code === "TRANSCRIPTION_CONFIGURATION_ERROR");
    assert(!error.retryable);
  }
});
