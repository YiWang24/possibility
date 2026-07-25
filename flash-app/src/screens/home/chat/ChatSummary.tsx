import NextActions from './NextActions';

// 本次探索总结 (source: openChatSummary + chatSummaryPage markup, ~2146 / ~3804).

interface ChatSummaryProps {
  question: string;
  topic: string | undefined;
  answers: string[];
  onBack: () => void;
  onFinish: () => void;
  onLab: () => void;
  onSimilar: () => void;
  onShare: () => void;
}

export default function ChatSummary({ question, topic, answers, onBack, onFinish, onLab, onSimilar, onShare }: ChatSummaryProps) {
  const topicLabel = topic ?? '此刻的选择';
  const a0 = answers[0] ?? '你真正想靠近的生活';
  const a1 = answers[1] ?? '你暂时还不能轻易放下的部分';
  const last = answers[answers.length - 1] ?? '你愿意先理解自己的真实需要，再做决定。';

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
          <p>这份总结来自刚才的对话，只记录你此刻认可的理解，不替你下结论。</p>
        </div>
        <div className="chat-summary-card">
          <div className="eyebrow">你真正想解决的</div>
          <h4>不是选出标准答案，而是确认什么值得你承担代价</h4>
          <p>你的犹豫并不等于没有方向。它提醒你：愿望与代价需要被分开看见。</p>
        </div>
        <div className="chat-summary-card tension">
          <div className="eyebrow">此刻的两股拉力</div>
          <h4>想靠近的，和想保护的</h4>
          <p>
            一边是「{a0}」；另一边是「{a1}」。两边都是真的，不必把其中一边解释成软弱。
          </p>
        </div>
        <div className="chat-summary-card">
          <div className="eyebrow">已经比较清楚的</div>
          <h4>你的原话比标签更重要</h4>
          <p>{last}</p>
        </div>
        <div className="chat-summary-card next">
          <div className="eyebrow">下一步的小验证</div>
          <h4>先收集一个真实证据</h4>
          <p>未来 7 天，做一次成本很低、可以撤回的小尝试。记录行动前后的期待、精力和抗拒，再判断你是“不想要”，还是“暂时承担不起”。</p>
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
