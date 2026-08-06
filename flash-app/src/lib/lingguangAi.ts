// Typed accessor for `lingguang.ai.chat`.
//
// The scaffold's global.d.ts declares `ai` as an inline object literal carrying only
// imageGeneration / vllm / llmStream, so `chat` (documented in docs/API_AI_CHAT.md as
// the replacement for legacy callLLM) cannot be added by declaration merging. This
// module owns the types and performs the one narrowing cast, so no caller has to.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** `json_schema` makes the host return validated JSON, read back from `data`. */
export type ResponseFormat =
  | { type: 'text' }
  | { type: 'json_object' }
  | {
      type: 'json_schema';
      jsonSchema: { name: string; schema: Record<string, unknown> };
    };

export interface ChatOptions {
  messages: ChatMessage[];
  responseFormat?: ResponseFormat;
  /** Milliseconds. */
  timeout?: number;
}

export interface ChatResult {
  /** Raw text the model produced. */
  content: string;
  /** Parsed object — only populated for json_object / json_schema formats. */
  data?: unknown;
}

type ChatFn = (options: ChatOptions) => Promise<ChatResult>;

/**
 * Resolve `lingguang.ai.chat`, or undefined on hosts that predate it.
 *
 * Callers must handle undefined rather than assume the capability exists — the app
 * also runs in a plain browser during development, where `lingguang` is absent.
 */
export function getChat(): ChatFn | undefined {
  const ai: unknown = (globalThis as { lingguang?: { ai?: unknown } }).lingguang?.ai;
  if (typeof ai !== 'object' || ai === null) return undefined;
  const chat = (ai as { chat?: unknown }).chat;
  return typeof chat === 'function' ? (chat as ChatFn) : undefined;
}

export function isChatAvailable(): boolean {
  return getChat() !== undefined;
}
