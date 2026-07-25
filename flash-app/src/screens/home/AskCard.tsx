import { useState } from 'react';
import { useAppStore } from '@/store/appStore';

const TOPICS = ['职业', '家庭', '升学', '情感'];

export default function AskCard() {
  const openPush = useAppStore((s) => s.openPush);
  const showToast = useAppStore((s) => s.showToast);
  const [text, setText] = useState('');
  const [topic, setTopic] = useState<string | null>(null);

  const hasTopic = topic !== null;

  const toggleTopic = (t: string) => {
    setTopic((cur) => (cur === t ? null : t));
  };

  const send = () => {
    const question = text.trim();
    if (question === '') {
      showToast('先写下你想探索的问题');
      return;
    }
    openPush('chatPage', topic !== null ? { question, topic } : { question });
  };

  return (
    <div className="ask">
      <div className="glow" />
      <div className="glow2" />
      <div className="glow3" />
      <div className="tag">今天想探索什么</div>
      <h2>
        说出那个
        <br />
        <em>在心里盘旋</em>的问题
      </h2>

      <div className={`askbox${hasTopic ? '' : ' no-topic'}`} id="askBox">
        <div className={`askcat${hasTopic ? '' : ' hidden'}`} id="askCat">
          ✦ <b>{topic ?? ''}</b>
        </div>
        <button
          type="button"
          className="ask-clear"
          data-testid="ask-clear"
          aria-label="清空输入"
          style={{ opacity: text.length > 0 ? 1 : 0 }}
          onClick={() => {
            setText('');
          }}
        >
          ×
        </button>
        <textarea
          id="askText"
          data-testid="ask-text"
          maxLength={200}
          placeholder="写下任何正在心里盘旋的问题…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        <div className="askfoot">
          <button type="button" className="send" data-testid="ask-send" onClick={send}>
            发送
          </button>
        </div>
      </div>

      <div className="chips" id="topicChips">
        {TOPICS.map((t) => (
          <button
            key={t}
            type="button"
            className={`chip soft${topic === t ? ' on' : ''}`}
            data-topic={t}
            data-testid={`topic-${t}`}
            onClick={() => {
              toggleTopic(t);
            }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
