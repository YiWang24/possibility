import { useMemo, useState } from 'react';
import { buildArchive, buildRail, diaryWaveHeights, getDiaryEntry } from './diaryHelpers';
import { useDiaryStore } from './diaryStore';
import { localIsoDate, mergeWithSeed } from './diaryStorage';

interface DiaryDayProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onRecordToday: () => void;
  showToast: (msg: string) => void;
}

/** "7/12" / "7月" — read off the entry's own date instead of assuming a month. */
function monthOf(date: string): string {
  return String(Number(date.slice(5, 7)));
}

export default function DiaryDay({ selectedDate, onSelectDate, onRecordToday, showToast }: DiaryDayProps) {
  const [playing, setPlaying] = useState(false);
  const recorded = useDiaryStore((s) => s.recorded);
  const todayIso = useMemo(() => localIsoDate(new Date()), []);
  const entries = useMemo(() => mergeWithSeed(recorded), [recorded]);

  const entry = getDiaryEntry(entries, selectedDate);
  const rail = buildRail(entries, todayIso);
  const archive = buildArchive(entries);
  const activeIndex = Math.max(
    0,
    entries.findIndex((item) => item.date === selectedDate),
  );
  const wave = diaryWaveHeights(activeIndex + 1);

  const togglePlay = () => {
    const next = !playing;
    setPlaying(next);
    showToast(next ? '正在播放这篇语音日记' : '语音已暂停');
  };

  return (
    <div id="diaryDetailBody">
      <div className="diary-view-head">
        <div>
          <div className="ey">ALL VOICE NOTES</div>
          <h2>全部日记</h2>
          <p>已记录 {entries.length} 天</p>
        </div>
      </div>

      <div className="diary-date-rail">
        {rail.map((item) => (
          <button
            key={item.date}
            type="button"
            className={`diary-date-chip${item.date === selectedDate ? ' on' : ''}`}
            data-testid={`diary-chip-${item.date}`}
            aria-label={`查看${item.week}${item.day}日的日记`}
            onClick={() => {
              onSelectDate(item.date);
            }}
          >
            <span>{item.week}</span>
            <i>{item.emoji}</i>
            <b>
              {monthOf(item.date)}/{item.day}
            </b>
          </button>
        ))}
      </div>

      {entry !== undefined ? (
        <>
          <article className="diary-day-hero">
            <div className="date">{entry.label} · VOICE NOTE</div>
            <h3>{entry.title}</h3>
            <div className="mood">
              <i>{entry.emoji}</i>
              <span>{entry.emotion}</span>
            </div>
            {/* Dictated entries have no audio to play — ASR returns text only. */}
            {entry.recorded === true ? (
              <div className="diary-audio" data-testid="diary-audio-recorded">
                <div className="diary-wave-static">
                  {wave.map((h, i) => (
                    <i key={i} style={{ height: `${String(h)}%` }} />
                  ))}
                </div>
                <span>{entry.duration} · 已转写</span>
              </div>
            ) : (
              <div className="diary-audio">
                <button
                  type="button"
                  className={`diary-play${playing ? ' playing' : ''}`}
                  data-testid="diary-play"
                  aria-label={playing ? '暂停这篇语音日记' : '播放这篇语音日记'}
                  onClick={togglePlay}
                >
                  {playing ? 'Ⅱ' : '▶'}
                </button>
                <div className="diary-wave-static">
                  {wave.map((h, i) => (
                    <i key={i} style={{ height: `${String(h)}%` }} />
                  ))}
                </div>
                <span>{entry.duration}</span>
              </div>
            )}
          </article>
          <section className="diary-keyword-block">
            <div className="diary-block-head">
              <b>每日关键词</b>
              <span>由语音内容自动提取</span>
            </div>
            <div className="diary-keywords">
              {entry.keywords.map((keyword) => (
                <span key={keyword}># {keyword}</span>
              ))}
            </div>
          </section>
          <section className="diary-transcript">
            <div className="diary-block-head">
              <b>详细语音内容</b>
              <span>{entry.duration} · 已转写</span>
            </div>
            {entry.transcript.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </section>
        </>
      ) : (
        <div className="diary-empty">
          <i>◌</i>
          <h3>今天还没有留下声音</h3>
          <p>不需要组织好语言，从此刻最真实的感受开始就好。</p>
          <button type="button" data-testid="diary-record-today" onClick={onRecordToday}>
            记录今天
          </button>
        </div>
      )}

      <section className="diary-archive">
        <div className="diary-archive-head">
          <h3>全部日期记录</h3>
          <span>{entries.length} 篇 · 按时间倒序</span>
        </div>
        <div className="diary-archive-list">
          {archive.map((diary) => (
            <button
              key={diary.date}
              type="button"
              className={`diary-archive-item${diary.date === selectedDate ? ' on' : ''}`}
              data-testid={`diary-archive-${diary.date}`}
              onClick={() => {
                onSelectDate(diary.date);
              }}
            >
              <span className="diary-archive-date">
                <b>{Number(diary.date.slice(-2))}</b>
                <span>{monthOf(diary.date)}月</span>
              </span>
              <span className="diary-archive-copy">
                <b>{diary.title}</b>
                <p>
                  {diary.emoji} {diary.keywords.map((keyword) => `#${keyword}`).join(' · ')}
                </p>
              </span>
              <span className="diary-archive-arrow">›</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
