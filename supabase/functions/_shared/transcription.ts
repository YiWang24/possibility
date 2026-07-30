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
    throw new TranscriptionError(
      retryable
        ? `TRANSCRIPTION_UPSTREAM_${response.status}`
        : "TRANSCRIPTION_CONFIGURATION_ERROR",
      retryable,
    );
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
