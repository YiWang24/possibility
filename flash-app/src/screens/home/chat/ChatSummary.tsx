import { useEffect, useMemo, useState } from 'react';
import NextActions from './NextActions';
import type { Turn } from './chatLlm';
import { fallbackSummary, summarizeChat, type ChatSummaryContent } from './chatSummarize';

// 本次探索总结 (source: openChatSummary + chatSummaryPage markup, ~2146 / ~3804).

interface ChatSummaryProps {
  question: string;
  topic: string | undefined;
  answers: string[];
  /** The real conversation, summarised by the model when it is reachable. */
  turns: Turn[];
  onBack: () => void;
  onFinish: () => void;
  onLab: () => void;
  onSimilar: () => void;
  onShare: () => void;
}

export default function ChatSummary({ question, topic, answers, turns, onBack, onFinish, onLab, onSimilar, onShare }: ChatSummaryProps) {
  const topicLabel = topic ?? '此刻的选择';
  const a0 = answers[0] ?? '你真正想靠近的生活';
  const a1 = answers[1] ?? '你暂时还不能轻易放下的部分';
  const last = answers[answers.length - 1] ?? '你愿意先理解自己的真实需要，再做决定。';

  const fallback = useMemo(() => fallbackSummary(a0, a1, last), [a0, a1, last]);
  const [summary, setSummary] = useState<ChatSummaryContent>(fallback);
  const [generating, setGenerating] = useState(true);

  // Generated once per opening. The scripted copy shows immediately and is replaced
  // in place if the model answers, so the page is never blank or spinner-only.
  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      try {
        const generated = await summarizeChat(question, turns, fallback);
        if (!ctrl.signal.aborted && generated !== null) setSummary(generated);
      } catch {
        // Scripted copy stays on screen.
      }
      if (!ctrl.signal.aborted) setGenerating(false);
    })();
    return () => {
      ctrl.abort();
    };
  }, [question, turns, fallback]);

  return (
    <section className="push open" id="chatSummaryPage" data-testid="push-chatSummaryPage">
      <div className="top">
        <button type="button" className="backbtn" data-testid="push-chatSummaryPage-back" aria-label="返回对话" onClick={onBack}>
          ‹
        </button>
        <div>
          <h2>本次探索总结</h2>
          <div className="sub2">不是定论，是此刻更清楚的你</div>
        </div>
      </div>
      <div className="scroll" id="chatSummaryBody">
        <div className="chat-summary-hero">
          <div className="eyebrow">{topicLabel} · EXPLORATION NOTE</div>
          <h3>{question}</h3>
          <p>{generating ? '正在根据刚才的对话整理这份总结……' : '这份总结来自刚才的对话，只记录你此刻认可的理解，不替你下结论。'}</p>
        </div>
        <div className="chat-summary-card" data-testid="chat-summary-problem">
          <div className="eyebrow">{summary.problem.eyebrow}</div>
          <h4>{summary.problem.heading}</h4>
          <p>{summary.problem.body}</p>
        </div>
        <div className="chat-summary-card tension" data-testid="chat-summary-tension">
          <div className="eyebrow">{summary.tension.eyebrow}</div>
          <h4>{summary.tension.heading}</h4>
          <p>{summary.tension.body}</p>
        </div>
        <div className="chat-summary-card" data-testid="chat-summary-clarity">
          <div className="eyebrow">{summary.clarity.eyebrow}</div>
          <h4>{summary.clarity.heading}</h4>
          <p>{summary.clarity.body}</p>
        </div>
        <div className="chat-summary-card next" data-testid="chat-summary-next">
          <div className="eyebrow">{summary.next.eyebrow}</div>
          <h4>{summary.next.heading}</h4>
          <p>{summary.next.body}</p>
        </div>
        <NextActions showSummaryButton={false} onLab={onLab} onSimilar={onSimilar} onShare={onShare} onSummary={onBack} />
      </div>
      <div className="summary-bottom">
        <button type="button" className="btn-ink" data-testid="chat-finish-summary" onClick={onFinish}>
          完成本次探索
        </button>
      </div>
    </section>
  );
}
