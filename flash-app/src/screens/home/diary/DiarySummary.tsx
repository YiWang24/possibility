import { useEffect, useRef, useState } from 'react';
import { DIARY_ENTRIES } from '@/data/diary';
import { MONTH_EMOTION, MONTH_INSIGHTS, MONTH_THEMES, YEAR_CHAPTERS, YEAR_CLOSING, YEAR_KEYWORDS } from './diaryHelpers';

interface DiarySummaryProps {
  period: 'month' | 'year';
  showToast: (msg: string) => void;
}

export default function DiarySummary({ period, showToast }: DiarySummaryProps) {
  const isMonth = period === 'month';
  const monthEntryCount = DIARY_ENTRIES.length;
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef(0);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    timer.current = window.setTimeout(() => {
      setRefreshing(false);
      showToast(isMonth ? '月度总结已根据最新日记更新' : '年度总结已根据最新日记更新');
    }, 850);
  };

  return (
    <div id="diaryDetailBody">
      <div className="diary-view-head">
        <div>
          <div className="ey">{isMonth ? 'MONTHLY REVIEW' : 'YEARLY REVIEW'}</div>
          <h2>{isMonth ? '2026年7月' : '2026年度'}</h2>
          <p>{isMonth ? `${String(monthEntryCount)}篇日记已纳入总结` : '143篇日记已纳入总结'}</p>
        </div>
        <button type="button" className="diary-summary-refresh" data-testid="diary-summary-refresh" disabled={refreshing} onClick={refresh}>
          {refreshing ? '总结中…' : '更新总结'}
        </button>
      </div>

      {isMonth ? (
        <>
          <div className="diary-summary-hero">
            <div className="cap">JULY IN VOICE · 2026年7月</div>
            <h3>
              这个月，你从“必须马上决定”
              <br />
              走向了“先用行动收集答案”
            </h3>
            <p>焦虑没有完全消失，但它不再只是反复盘旋，而是逐渐被拆成访谈、共创和项目复盘等可以验证的下一步。</p>
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
              {MONTH_THEMES.map((theme) => (
                <span key={theme}>{theme}</span>
              ))}
            </div>
            <div className="diary-insight-list">
              {MONTH_INSIGHTS.map((insight) => (
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
            <h3>
              这一年，你在练习把人生
              <br />
              从“证明自己”还给“选择自己”
            </h3>
            <p>工作的熟练带来认可，也带来停滞感。你开始允许自己不立刻跳走，而是先靠近真正感兴趣的问题。</p>
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
              {YEAR_KEYWORDS.map((keyword) => (
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
              {YEAR_CHAPTERS.map((chapter) => (
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
                <b>{YEAR_CLOSING.title}</b>
                <p>{YEAR_CLOSING.copy}</p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
