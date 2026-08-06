import { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { useDiaryStore } from './diary/diaryStore';
import { localIsoDate, mergeWithSeed } from './diary/diaryStorage';

const WAVE_DELAYS = [0, 0.12, 0.24, 0.06, 0.3, 0.18, 0.02, 0.26, 0.1, 0.2, 0.05, 0.28];
const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m)}:${s < 10 ? '0' : ''}${String(s)}`;
}

/** The seven days ending today, so the strip tracks real time rather than fixed dates. */
function weekDates(today: Date): { date: string; label: string; today: boolean }[] {
  const days: { date: string; label: string; today: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({ date: localIsoDate(d), label: i === 0 ? '今天' : (WEEK_LABELS[d.getDay()] ?? ''), today: i === 0 });
  }
  return days;
}

export default function DiaryCard() {
  const openPush = useAppStore((s) => s.openPush);
  const phase = useDiaryStore((s) => s.phase);
  const transcript = useDiaryStore((s) => s.transcript);
  const seconds = useDiaryStore((s) => s.seconds);
  const error = useDiaryStore((s) => s.error);
  const asrSupported = useDiaryStore((s) => s.asrSupported);
  const analysisFailedDate = useDiaryStore((s) => s.analysisFailedDate);
  const recorded = useDiaryStore((s) => s.recorded);
  const store = useDiaryStore;

  const timer = useRef(0);
  const recording = phase === 'recording';

  useEffect(() => {
    if (!recording) return;
    timer.current = window.setInterval(() => {
      store.getState().tick();
    }, 1000);
    return () => {
      window.clearInterval(timer.current);
    };
  }, [recording, store]);

  const today = useMemo(() => new Date(), []);
  const todayIso = localIsoDate(today);
  const entries = useMemo(() => mergeWithSeed(recorded), [recorded]);
  const byDate = useMemo(() => new Map(entries.map((e) => [e.date, e])), [entries]);
  const todayEntry = byDate.get(todayIso);
  const week = useMemo(() => weekDates(today), [today]);

  const openDiary = (date?: string) => {
    openPush('diaryPage', date !== undefined ? { date } : {});
  };

  const toggleRecord = () => {
    const s = store.getState();
    if (s.phase === 'recording') {
      void s.finishRecording();
    } else {
      void s.startRecording();
    }
  };

  const resultEntry = phase === 'done' ? todayEntry : undefined;
  const analyzing = phase === 'analyzing';
  const manualMode = !asrSupported && (phase === 'error' || phase === 'idle');

  return (
    <div className="card diary">
      <div className="top">
        <button
          type="button"
          className="diary-title-link"
          data-testid="diary-open-detail"
          aria-label="查看全部语音日记详情"
          onClick={() => {
            openDiary();
          }}
        >
          <h3>我的语音日记</h3>
          <span className="diary-detail-icon" aria-hidden="true">
            ›
          </span>
        </button>
        <div className="diary-actions">
          <button type="button" id="recBtn" data-testid="diary-record-toggle" disabled={analyzing} onClick={toggleRecord}>
            {recording ? '● 录音中' : analyzing ? '分析中…' : '◉ 记录今日'}
          </button>
        </div>
      </div>

      <div className="dweek">
        {week.map((d) => {
          const entry = byDate.get(d.date);
          return (
            <button
              key={d.date}
              type="button"
              className={`dday ${entry ? 'f' : ''}${d.today ? 't' : ''}`}
              data-testid={`diary-day-${d.date}`}
              onClick={() => {
                openDiary(d.date);
              }}
            >
              <i>{entry?.emoji ?? ''}</i>
              <span>{d.label}</span>
            </button>
          );
        })}
      </div>

      <div className={`recorder${recording ? ' show' : ''}`} id="recorder">
        <div className="wave">
          {WAVE_DELAYS.map((delay, i) => (
            <i key={i} style={{ animationDelay: `${String(delay)}s` }} />
          ))}
        </div>
        <span className="tm">{fmt(seconds)}</span>
        <button type="button" className="done" data-testid="diary-record-finish" onClick={toggleRecord}>
          完成
        </button>
      </div>

      {recording && transcript !== '' ? (
        <p className="diary-live-text" data-testid="diary-live-transcript">
          {transcript}
        </p>
      ) : null}

      {manualMode ? (
        <div className="diary-manual" data-testid="diary-manual">
          <textarea
            data-testid="diary-manual-input"
            placeholder="当前环境无法语音识别，可以直接写下今天"
            value={transcript}
            onChange={(e) => {
              store.getState().setTranscript(e.target.value);
            }}
          />
          <button
            type="button"
            className="done"
            data-testid="diary-manual-save"
            onClick={() => {
              void store.getState().saveManual();
            }}
          >
            保存
          </button>
        </div>
      ) : null}

      {error !== null ? (
        <div className="diary-error" data-testid="diary-error">
          <span>{error}</span>
          <button
            type="button"
            data-testid="diary-error-dismiss"
            onClick={() => {
              store.getState().dismissError();
            }}
          >
            知道了
          </button>
        </div>
      ) : null}

      {analyzing ? (
        <div className="diary-analyzing" data-testid="diary-analyzing">
          正在整理今天的关键词…
        </div>
      ) : null}

      <div className={`diary-res${resultEntry !== undefined ? ' show' : ''}`} id="diaryResult">
        {resultEntry !== undefined ? (
          <>
            <div className="lb2">今天的情绪关键词</div>
            <div className="row2">
              <span className="emo-pill">{resultEntry.emotion}</span>
              {resultEntry.keywords.map((kw) => (
                <span key={kw} className="kw">
                  {kw}
                </span>
              ))}
              {analysisFailedDate === todayIso ? (
                <button
                  type="button"
                  className="diary-result-link"
                  data-testid="diary-retry-analysis"
                  onClick={() => {
                    void store.getState().retryAnalysis(todayIso);
                  }}
                >
                  重新分析 ↻
                </button>
              ) : null}
              <button
                type="button"
                className="diary-result-link"
                data-testid="diary-result-detail"
                onClick={() => {
                  openDiary(todayIso);
                }}
              >
                查看详情 ›
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
