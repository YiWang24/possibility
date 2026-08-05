import { runtimeConfig } from "./config.ts";

const TRANSCRIPTION_TIMEOUT_MS = 120_000;
const MAX_TRANSCRIPT_CHARS = 20_000;

export type TranscriptionResult = {
  text: string;
  language: string | null;
  provider: "azure";
  model: string;
};

export class TranscriptionError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(code);
    this.name = "TranscriptionError";
  }
}

export type TranscriptionOptions = {
  apiKey?: string;
  endpoint?: string;
  apiVersion?: string;
  locales?: string[];
  fetchImpl?: typeof fetch;
};

function firstLocale(payload: Record<string, unknown>): string | null {
  if (Array.isArray(payload.phrases)) {
    for (const phrase of payload.phrases) {
      if (
        typeof phrase === "object" &&
        phrase !== null &&
        "locale" in phrase &&
        typeof phrase.locale === "string"
      ) {
        return phrase.locale.trim() || null;
      }
    }
  }
  return null;
}

function combinedText(payload: Record<string, unknown>): string {
  if (!Array.isArray(payload.combinedPhrases)) return "";
  return payload.combinedPhrases
    .map((phrase) => {
      if (
        typeof phrase === "object" &&
        phrase !== null &&
        "text" in phrase &&
        typeof phrase.text === "string"
      ) {
        return phrase.text.trim();
      }
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

// Azure 用同一个 422 表达两件完全不同的事：这段录音里没有人声，以及这个文件根本
// 不是我们能解码的音频。两者都不该自动重试，但对用户是"请重新录一次"和"请换个格式"
// 两条提示；更要紧的是，真正的配置故障（密钥失效、端点写错、区域不匹配）必须能从
// 这堆 4xx 里被单独识别出来，否则运维分不清该救火还是该忽略。
//
// 只读取 Azure 的机器码，绝不把上游 message 往外传——错误消息可能回显音频内容，
// 而 error_code 会落库（见设计文档 §11.3 日志与埋点）。
async function terminalErrorCode(response: Response): Promise<string> {
  if (response.status !== 422) return "TRANSCRIPTION_CONFIGURATION_ERROR";
  let innerCode = "";
  try {
    const body = await response.json() as {
      innerError?: { code?: unknown };
    };
    if (typeof body?.innerError?.code === "string") {
      innerCode = body.innerError.code;
    }
  } catch {
    // 错误体解析失败不该掩盖原始故障，落到下面的通用拒绝码即可。
  }
  switch (innerCode) {
    case "NoLanguageIdentified":
      return "TRANSCRIPTION_EMPTY";
    case "InvalidAudioFormat":
      return "UNSUPPORTED_AUDIO";
    default:
      return "TRANSCRIPTION_AUDIO_REJECTED";
  }
}

export async function transcribeDiaryAudio(
  audio: Blob,
  filename: string,
  mimeType: string,
  options: TranscriptionOptions = {},
): Promise<TranscriptionResult> {
  let apiKey: string;
  let endpoint: string;
  let apiVersion: string;
  let locales: string[];
  try {
    apiKey = options.apiKey ?? runtimeConfig.azureSpeechKey;
    endpoint = (options.endpoint ?? runtimeConfig.azureSpeechEndpoint).replace(
      /\/+$/,
      "",
    );
    apiVersion = options.apiVersion ?? runtimeConfig.azureSpeechApiVersion;
    locales = options.locales ?? runtimeConfig.azureSpeechLocales;
    if (locales.length === 0) throw new Error("missing locales");
  } catch {
    throw new TranscriptionError("TRANSCRIPTION_CONFIGURATION_ERROR", false);
  }
  const fetchImpl = options.fetchImpl ?? fetch;

  const form = new FormData();
  form.append("audio", new File([audio], filename, { type: mimeType }));
  form.append("definition", JSON.stringify({ locales }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS);
  let response: Response;
  try {
    const url = new URL(
      `${endpoint}/speechtotext/transcriptions:transcribe`,
    );
    url.searchParams.set("api-version", apiVersion);
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    throw new TranscriptionError(
      error instanceof DOMException && error.name === "AbortError"
        ? "TRANSCRIPTION_TIMEOUT"
        : "TRANSCRIPTION_NETWORK_ERROR",
      true,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const retryable = response.status === 408 || response.status === 409 ||
      response.status === 429 || response.status >= 500;
    if (retryable) {
      throw new TranscriptionError(
        `TRANSCRIPTION_UPSTREAM_${response.status}`,
        true,
      );
    }
    throw new TranscriptionError(await terminalErrorCode(response), false);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TranscriptionError("TRANSCRIPTION_RESPONSE_INVALID", true);
  }
  if (typeof payload !== "object" || payload === null) {
    throw new TranscriptionError("TRANSCRIPTION_RESPONSE_INVALID", true);
  }
  const result = payload as Record<string, unknown>;
  const text = combinedText(result);
  if (!text) {
    throw new TranscriptionError("TRANSCRIPTION_EMPTY", false);
  }
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    throw new TranscriptionError("TRANSCRIPTION_TOO_LONG", false);
  }

  return {
    text,
    language: firstLocale(result),
    provider: "azure",
    model: `fast-transcription-${apiVersion}`,
  };
}
