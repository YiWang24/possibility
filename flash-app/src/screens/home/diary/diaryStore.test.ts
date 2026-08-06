// Covers the dictation session chain: the recogniser ends a session on every pause,
// so the store has to bank each session's text and reopen until the user taps 完成.

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handlers = {
  onText: (t: string) => void;
  onError: (m: string, c: string) => void;
  onEnd: (r: string) => void;
};

let handlers: Handlers | null = null;
let startCalls = 0;
let startShouldThrow: Error | null = null;

vi.mock('./diaryAsr', () => ({
  isAsrAvailable: () => true,
  startAsrSession: (h: Handlers) => {
    startCalls += 1;
    handlers = h;
    if (startShouldThrow) return Promise.reject(startShouldThrow);
    return Promise.resolve();
  },
  stopAsrSession: () => Promise.resolve(),
  abortAsrSession: () => Promise.resolve(),
}));

vi.mock('./diaryAnalyze', () => ({
  analyzeDiaryTranscript: () => Promise.resolve({ title: 't', emotion: 'e', emoji: '🙂', keywords: ['k'] }),
}));

vi.mock('./diaryStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./diaryStorage')>();
  return { ...actual, loadRecordedEntries: () => [], saveRecordedEntries: () => true };
});

const { useDiaryStore } = await import('./diaryStore');

const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  handlers = null;
  startCalls = 0;
  startShouldThrow = null;
  useDiaryStore.getState().reset();
  useDiaryStore.setState({ recorded: [] });
  await settle();
});

describe('dictation session chain', () => {
  it('opens a session when recording starts', async () => {
    await useDiaryStore.getState().startRecording();
    expect(startCalls).toBe(1);
    expect(useDiaryStore.getState().phase).toBe('recording');
  });

  it('shows the live text of the current session', async () => {
    await useDiaryStore.getState().startRecording();
    handlers?.onText('今天');
    handlers?.onText('今天和导师聊了很久');
    expect(useDiaryStore.getState().transcript).toBe('今天和导师聊了很久');
  });

  it('reopens the session when the engine ends it on a pause', async () => {
    await useDiaryStore.getState().startRecording();
    handlers?.onText('第一句');
    handlers?.onEnd('stop');
    await settle();
    expect(startCalls).toBe(2);
    expect(useDiaryStore.getState().phase).toBe('recording');
  });

  it('banks each session so nothing said before a pause is lost', async () => {
    await useDiaryStore.getState().startRecording();
    handlers?.onText('第一句');
    handlers?.onEnd('stop');
    await settle();
    // The new session reports only its own text, starting from empty.
    handlers?.onText('第二句');
    expect(useDiaryStore.getState().transcript).toBe('第一句 第二句');
    handlers?.onEnd('stop');
    await settle();
    handlers?.onText('第三句');
    expect(useDiaryStore.getState().transcript).toBe('第一句 第二句 第三句');
  });

  it('does not bank an empty session', async () => {
    await useDiaryStore.getState().startRecording();
    handlers?.onText('唯一一句');
    handlers?.onEnd('stop');
    await settle();
    handlers?.onEnd('stop'); // silence, no text at all
    await settle();
    handlers?.onText('后面这句');
    expect(useDiaryStore.getState().transcript).toBe('唯一一句 后面这句');
  });

  it('treats a mid-dictation no-speech as a pause, not a failure', async () => {
    await useDiaryStore.getState().startRecording();
    handlers?.onText('说了一点');
    handlers?.onError('没有听清', 'no-speech');
    expect(useDiaryStore.getState().phase).toBe('recording');
    expect(useDiaryStore.getState().error).toBeNull();
  });

  it('surfaces a real engine failure and stops rechaining', async () => {
    await useDiaryStore.getState().startRecording();
    handlers?.onError('麦克风被占用', 'audio-capture');
    expect(useDiaryStore.getState().phase).toBe('error');
    const callsAfterError = startCalls;
    handlers?.onEnd('error');
    await settle();
    expect(startCalls).toBe(callsAfterError);
  });

  it('reports a start failure instead of silently doing nothing', async () => {
    startShouldThrow = new Error('需要麦克风权限');
    await useDiaryStore.getState().startRecording();
    await settle();
    expect(useDiaryStore.getState().phase).toBe('error');
    expect(useDiaryStore.getState().error).toBe('需要麦克风权限');
  });
});

describe('finishing', () => {
  it('stops rechaining once the user taps 完成', async () => {
    await useDiaryStore.getState().startRecording();
    handlers?.onText('说完了');
    const finish = useDiaryStore.getState().finishRecording();
    handlers?.onEnd('stop');
    await finish;
    expect(startCalls).toBe(1);
  });

  it('saves the whole banked transcript, not just the last session', async () => {
    await useDiaryStore.getState().startRecording();
    handlers?.onText('前半段');
    handlers?.onEnd('stop');
    await settle();
    handlers?.onText('后半段');
    await useDiaryStore.getState().finishRecording();
    const entry = useDiaryStore.getState().recorded[0];
    expect(entry?.transcript[0]).toBe('前半段 后半段');
  });

  it('gives a distinct message when nothing was captured at all', async () => {
    await useDiaryStore.getState().startRecording();
    await useDiaryStore.getState().finishRecording();
    expect(useDiaryStore.getState().phase).toBe('error');
    // Must not reuse the host's own no-speech copy, or the two failures are
    // indistinguishable in a bug report.
    expect(useDiaryStore.getState().error).not.toBe('没有听清，靠近一点再说一次试试');
    expect(useDiaryStore.getState().error).toContain('没有录到内容');
  });

  it('starts a later recording from empty rather than appending to the last one', async () => {
    await useDiaryStore.getState().startRecording();
    handlers?.onText('第一次');
    await useDiaryStore.getState().finishRecording();
    await useDiaryStore.getState().startRecording();
    expect(useDiaryStore.getState().transcript).toBe('');
    handlers?.onText('第二次');
    expect(useDiaryStore.getState().transcript).toBe('第二次');
  });
});

describe('cancelling', () => {
  it('stops rechaining and drops the text', async () => {
    await useDiaryStore.getState().startRecording();
    handlers?.onText('不要这段');
    await useDiaryStore.getState().cancelRecording();
    handlers?.onEnd('abort');
    await settle();
    expect(startCalls).toBe(1);
    expect(useDiaryStore.getState().transcript).toBe('');
    expect(useDiaryStore.getState().phase).toBe('idle');
  });
});
