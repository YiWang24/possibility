// Thin wrapper over `lingguang.asr` for the voice diary.
//
// The host API only produces text — it never records or saves an audio file — so the
// recorder times its own session to get a duration and there is no playback.

export type AsrErrorCode = 'not-allowed' | 'audio-capture' | 'no-speech' | 'network' | 'engine' | 'aborted' | 'unknown';

export type AsrEndReason = 'stop' | 'abort' | 'error';

interface AsrNamespace {
  start: (options: {
    lang?: string;
    interim?: boolean;
    continuous?: boolean;
    onText: (payload: { text: string; sessionId: string; seq?: number; isFinal?: boolean }) => void;
    onError?: (err: { error: AsrErrorCode; message?: string; fatal?: boolean; sessionId: string; code?: string }) => void;
    onEnd?: (reason: AsrEndReason, sessionId: string) => void;
  }) => Promise<void>;
  stop: () => Promise<void>;
  abort: () => Promise<void>;
}

/** Actionable Chinese copy per host error code. */
const ERROR_COPY: Record<AsrErrorCode, string> = {
  'not-allowed': '需要麦克风权限才能录音，请在系统设置里允许后重试',
  'audio-capture': '麦克风被占用或不可用，请关闭其他录音应用后重试',
  'no-speech': '没有听清，靠近一点再说一次试试',
  network: '网络不稳定，语音识别中断了，请重试',
  engine: '语音识别出了点问题，请重试',
  aborted: '录音已中止',
  unknown: '语音识别失败，请重试',
};

/**
 * Map a host error code to copy the user can act on.
 *
 * `code` is deliberately widened to string: the documented union is what the host
 * promises, not what a future client is guaranteed to send, and an unrecognised code
 * should fall back rather than render `undefined`.
 */
export function describeAsrError(code: string, hostMessage?: string): string {
  const copy: string | undefined = (ERROR_COPY as Record<string, string>)[code];
  if (copy !== undefined) return copy;
  return hostMessage !== undefined && hostMessage !== '' ? hostMessage : ERROR_COPY.unknown;
}

/**
 * Resolve the host ASR namespace, or undefined when unavailable.
 *
 * ASR needs host client >= 1.0.52, and is absent entirely when the app runs in a plain
 * browser during development. Callers fall back to manual text entry.
 */
function getAsr(): AsrNamespace | undefined {
  const asr: unknown = (globalThis as { lingguang?: { asr?: unknown } }).lingguang?.asr;
  if (typeof asr !== 'object' || asr === null) return undefined;
  const candidate = asr as Partial<AsrNamespace>;
  if (typeof candidate.start !== 'function' || typeof candidate.stop !== 'function' || typeof candidate.abort !== 'function') {
    return undefined;
  }
  return candidate as AsrNamespace;
}

export function isAsrAvailable(): boolean {
  return getAsr() !== undefined;
}

export interface AsrSessionHandlers {
  /** Full transcript so far — always overwrite, never append (host semantics). */
  onText: (text: string) => void;
  onError: (message: string, code: AsrErrorCode) => void;
  onEnd: (reason: AsrEndReason) => void;
}

/**
 * Start a dictation session.
 *
 * Rejects with a human-readable message when the session cannot start at all (no
 * permission, capability missing). Failures *during* recognition arrive via onError.
 */
export async function startAsrSession(handlers: AsrSessionHandlers): Promise<void> {
  const asr = getAsr();
  if (!asr) throw new Error('当前版本不支持语音识别，可以直接手动输入');
  await asr.start({
    lang: 'zh-CN',
    interim: true,
    continuous: true,
    onText: ({ text }) => {
      handlers.onText(text);
    },
    onError: (err) => {
      handlers.onError(describeAsrError(err.error, err.message), err.error);
    },
    onEnd: (reason) => {
      handlers.onEnd(reason);
    },
  });
}

/** Graceful stop — gives the engine a chance to emit its final text. */
export async function stopAsrSession(): Promise<void> {
  await getAsr()?.stop();
}

/** Immediate stop — final text is not guaranteed. */
export async function abortAsrSession(): Promise<void> {
  await getAsr()?.abort();
}
