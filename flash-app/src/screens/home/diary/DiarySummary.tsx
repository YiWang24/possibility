import { useMemo, useState } from 'react';
import { MONTH_EMOTION } from './diaryHelpers';
import { useDiaryStore } from './diaryStore';
import { mergeWithSeed } from './diaryStorage';
import { FALLBACK_MONTH, FALLBACK_YEAR, summarizeDiary, type DiarySummaryContent, type MonthSummary, type YearSummary } from './diarySummarize';

interface DiarySummaryProps {
  period: 'month' | 'year';
  showToast: (msg: string) => void;
}

export default function DiarySummary({ period, showToast }: DiarySummaryProps) {
  const isMonth = period === 'month';
  const recorded = useDiaryStore((s) => s.recorded);
  const entries = useMemo(() => mergeWithSeed(recorded), [recorded]);
  const monthEntryCount = entries.length;

  const [refreshing, setRefreshing] = useState(false);
  const [month, setMonth] = useState<MonthSummary>(FALLBACK_MONTH);
  const [year, setYear] = useState<YearSummary>(FALLBACK_YEAR);

  // Generated on demand rather than on mount: it is the most expensive call in the app,
  // and the scripted copy already reads correctly until the user asks for a refresh.
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    void (async () => {
      // Annotated rather than inferred: the platform's build runs a stricter check than
      // the local one and rejects an evolving `let x = null`.
      let generated: DiarySummaryContent | null = null;
      try {
        generated = await summarizeDiary(period, entries);
      } catch {
        // Keeps whatever is already on screen.
      }
      if (generated?.kind === 'month') setMonth(generated);
      else if (generated?.kind === 'year') setYear(generated);
      setRefreshing(false);
      showToast(generated === null ? '这次没能生成总结，先看看现有内容' : isMonth ? '月度总结已根据最新日记更新' : '年度总结已根据最新日记更新');
    })();
  };

  return (
    <div id="diaryDetailBody">
      <div className="diary-view-head">
        <div>
          <div className="ey">{isMonth ? 'MONTHLY REVIEW' : 'YEARLY REVIEW'}</div>
          <h2>{isMonth ? '2026年7月' : '2026年度'}</h2>
          <p>{`${String(monthEntryCount)}篇日记已纳入总结`}</p>
        </div>
        <button type="button" className="diary-summary-refresh" data-testid="diary-summary-refresh" disabled={refreshing} onClick={refresh}>
          {refreshing ? '总结中…' : '更新总结'}
        </button>
      </div>

      {isMonth ? (
        <>
          <div className="diary-summary-hero">
            <div className="cap">JULY IN VOICE · 2026年7月</div>
            <h3>{month.headline}</h3>
            <p>{month.intro}</p>
            <div className="diary-stat-grid">
              <div className="diary-stat">
                <b>{monthEntryCount}</b>
                <span>记录天数</span>
              </div>
              <div className="diary-stat">
                <b>46m</b>
                <span>语音时长</span>
              </div>
              <div className="diary-stat">
                <b>52</b>
                <span>提取关键词</span>
              </div>
            </div>
          </div>
          <section className="diary-summary-card">
            <div className="diary-block-head">
              <b>本月情绪流动</b>
              <span>前紧后松</span>
            </div>
            <div className="diary-emotion-chart">
              {MONTH_EMOTION.map(([label, height]) => (
                <div key={label} className="diary-emotion-col">
                  <i style={{ height: `${String(height)}%` }} />
                  <b>{label}</b>
                </div>
              ))}
            </div>
          </section>
          <section className="diary-summary-card">
            <div className="diary-block-head">
              <b>反复出现的主题</b>
              <span>跨 {monthEntryCount} 篇日记</span>
            </div>
            <div className="diary-keywords">
              {month.themes.map((theme) => (
                <span key={theme}>{theme}</span>
              ))}
            </div>
            <div className="diary-insight-list">
              {month.insights.map((insight) => (
                <div key={insight.title} className="diary-insight">
                  <div className="cap">{insight.cap}</div>
                  <b>{insight.title}</b>
                  <p>{insight.copy}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="diary-summary-hero">
            <div className="cap">YOUR 2026 · 年度声音</div>
            <h3>{year.headline}</h3>
            <p>{year.intro}</p>
            <div className="diary-stat-grid">
              <div className="diary-stat">
                <b>143</b>
                <span>记录天数</span>
              </div>
              <div className="diary-stat">
                <b>6.8h</b>
                <span>语音时长</span>
              </div>
              <div className="diary-stat">
                <b>428</b>
                <span>提取关键词</span>
              </div>
            </div>
          </div>
          <section className="diary-summary-card">
            <div className="diary-block-head">
              <b>年度关键词</b>
              <span>按出现与情绪权重排序</span>
            </div>
            <div className="diary-keywords">
              {year.keywords.map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>
          </section>
          <section className="diary-summary-card">
            <div className="diary-block-head">
              <b>这一年的四个章节</b>
              <span>持续生成中</span>
            </div>
            <div className="diary-year-line">
              {year.chapters.map((chapter) => (
                <div key={chapter.span} className="diary-year-node">
                  <span>{chapter.span}</span>
                  <b>{chapter.title}</b>
                  <p>{chapter.copy}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="diary-summary-card">
            <div className="diary-block-head">
              <b>写给年底的你</b>
              <span>AI 年度回望</span>
            </div>
            <div className="diary-insight-list">
              <div className="diary-insight">
                <b>{year.closing.title}</b>
                <p>{year.closing.copy}</p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
