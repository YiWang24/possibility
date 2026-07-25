import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/appStore';

interface DayDot {
  date: string;
  emoji: string;
  label: string;
  filled: boolean;
  today?: boolean;
}

const WEEK: DayDot[] = [
  { date: '2026-07-17', emoji: '🙂', label: '五', filled: true },
  { date: '2026-07-18', emoji: '😮‍💨', label: '六', filled: true },
  { date: '2026-07-19', emoji: '😊', label: '日', filled: true },
  { date: '2026-07-20', emoji: '😐', label: '一', filled: true },
  { date: '2026-07-21', emoji: '🙂', label: '二', filled: true },
  { date: '2026-07-22', emoji: '😌', label: '三', filled: true },
  { date: '2026-07-23', emoji: '', label: '今天', filled: false, today: true },
];

const WAVE_DELAYS = [0, 0.12, 0.24, 0.06, 0.3, 0.18, 0.02, 0.26, 0.1, 0.2, 0.05, 0.28];

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m)}:${s < 10 ? '0' : ''}${String(s)}`;
}

export default function DiaryCard() {
  const openPush = useAppStore((s) => s.openPush);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);
  const timer = useRef(0);

  useEffect(() => {
    if (!recording) return;
    timer.current = window.setInterval(() => {
      setSeconds((v) => v + 1);
    }, 1000);
    return () => {
      window.clearInterval(timer.current);
    };
  }, [recording]);

  const startRec = () => {
    setDone(false);
    setSeconds(0);
    setRecording(true);
  };
  const finishRec = () => {
    setRecording(false);
    setDone(true);
  };
  const openDiary = (date?: string) => {
    openPush('diaryPage', date !== undefined ? { date } : {});
  };

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
          <button
            type="button"
            id="recBtn"
            data-testid="diary-record-toggle"
            onClick={() => {
              if (recording) {
                finishRec();
              } else {
                startRec();
              }
            }}
          >
            {recording ? '● 录音中' : '◉ 记录今日'}
          </button>
        </div>
      </div>

      <div className="dweek">
        {WEEK.map((d) => (
          <button
            key={d.date}
            type="button"
            className={`dday ${d.filled ? 'f' : ''}${d.today === true ? 't' : ''}`}
            data-testid={`diary-day-${d.date}`}
            onClick={() => {
              openDiary(d.date);
            }}
          >
            <i>{d.emoji}</i>
            <span>{d.label}</span>
          </button>
        ))}
      </div>

      <div className={`recorder${recording ? ' show' : ''}`} id="recorder">
        <div className="wave">
          {WAVE_DELAYS.map((delay, i) => (
            <i key={i} style={{ animationDelay: `${String(delay)}s` }} />
          ))}
        </div>
        <span className="tm">{fmt(seconds)}</span>
        <button type="button" className="done" data-testid="diary-record-finish" onClick={finishRec}>
          完成
        </button>
      </div>

      <div className={`diary-res${done ? ' show' : ''}`} id="diaryResult">
        {done ? (
          <>
            <div className="lb2">今天的情绪关键词</div>
            <div className="row2">
              <span className="emo-pill">平静</span>
              <span className="kw">工作节奏</span>
              <span className="kw">一点疲惫</span>
              <span className="kw">对未来好奇</span>
              <button
                type="button"
                className="diary-result-link"
                data-testid="diary-result-detail"
                onClick={() => {
                  openDiary('2026-07-23');
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
