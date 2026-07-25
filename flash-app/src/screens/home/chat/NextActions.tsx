// "信息已经足够 · 选择下一步" panel (source: chatNextActionsHTML, ~3754).

interface NextActionsProps {
  showSummaryButton: boolean;
  onLab: () => void;
  onSimilar: () => void;
  onShare: () => void;
  onSummary: () => void;
}

export default function NextActions({ showSummaryButton, onLab, onSimilar, onShare, onSummary }: NextActionsProps) {
  return (
    <div className="chat-next-panel">
      <div className="cap">信息已经足够 · 选择下一步</div>
      <h4>把刚才的理解带去哪里？</h4>
      <div className="chat-next-grid">
        <button type="button" className="chat-path primary" data-testid="chat-path-lab" onClick={onLab}>
          <i>◉</i>
          <b>去人生实验室</b>
          <small>带着当前问题，推演几种可能</small>
        </button>
        <button type="button" className="chat-path" data-testid="chat-path-similar" onClick={onSimilar}>
          <i>⌁</i>
          <b>看相似经历</b>
          <small>去社区找走过这段路的人</small>
        </button>
        <button type="button" className="chat-path" data-testid="chat-path-share" onClick={onShare}>
          <i>↗</i>
          <b>分享这次探索</b>
          <small>发给一个你信任的人</small>
        </button>
      </div>
      {showSummaryButton ? (
        <button type="button" className="chat-next-summary" data-testid="chat-open-summary" onClick={onSummary}>
          先查看完整总结 →
        </button>
      ) : null}
    </div>
  );
}
