import { useEffect, useRef, useState, type JSX } from 'react';
import { useAppStore, usePushOpen, usePushPayload } from '@/store/appStore';
import NextActions from '@/screens/home/chat/NextActions';
import ChatSummary from '@/screens/home/chat/ChatSummary';
import { useChatConversation, type ChatItem } from '@/screens/home/chat/useChatConversation';

const DEFAULT_SEED = '我最近一直在想一个问题，但还没理清。';

export default function ChatPush() {
  const open = usePushOpen('chatPage');
  const payload = usePushPayload('chatPage');
  const closePush = useAppStore((s) => s.closePush);
  const setTab = useAppStore((s) => s.setTab);
  const showToast = useAppStore((s) => s.showToast);

  const topic = payload.topic;
  const seedQuestion = payload.question ?? DEFAULT_SEED;

  const { items, answers, busy, turns, send, confirmInsight, requestCorrection } = useChatConversation(open, seedQuestion, topic);
  const [input, setInput] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Keep the transcript pinned to the newest message (scrollBottom).
  useEffect(() => {
    const el = scrollRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [items]);

  const sendChat = () => {
    const value = input.trim();
    if (value === '' || busy) return;
    setInput('');
    send(value);
  };

  const goLab = () => {
    setTab('lab');
    showToast('问题已带入人生实验室');
  };
  const goSimilar = () => {
    setTab('comm');
    showToast('正在寻找相似经历');
  };
  const doShare = () => {
    showToast('探索摘要已复制，可以分享了');
  };

  const renderItem = (item: ChatItem, index: number): JSX.Element => {
    switch (item.kind) {
      case 'me':
        return (
          <div key={index} className="msg me">
            <div className="bubble">{item.text}</div>
          </div>
        );
      case 'ai':
        // Trusted template copy; any user-typed value was escaped in chatScript.
        return (
          <div key={index} className="msg ai">
            <div className="bubble" dangerouslySetInnerHTML={{ __html: item.html }} />
          </div>
        );
      case 'ai-text':
        // Model output. Rendered as text, never as HTML — the model is not a trusted
        // source of markup, and `white-space: pre-wrap` keeps its paragraph breaks.
        return (
          <div key={index} className="msg ai">
            <div className="bubble" style={{ whiteSpace: 'pre-wrap' }} data-testid="chat-ai-text">
              {item.text}
            </div>
          </div>
        );
      case 'think':
        return (
          <div key={index} className="aithink">
            <span className="miniorb" />
            正在理解你刚才的话……
          </div>
        );
      case 'review-actions':
        return (
          <div key={index} className="chat-actions">
            <button type="button" className="gochip" data-testid="chat-confirm" onClick={confirmInsight}>
              嗯，比较接近
            </button>
            <button type="button" className="chip" data-testid="chat-correct" onClick={requestCorrection}>
              还不太对
            </button>
          </div>
        );
      case 'correction-actions':
        return (
          <div key={index} className="chat-actions">
            <button type="button" className="gochip" data-testid="chat-confirm" onClick={confirmInsight}>
              这次准确了
            </button>
            <button type="button" className="chip" data-testid="chat-correct" onClick={requestCorrection}>
              我再补充一点
            </button>
          </div>
        );
      case 'next-actions':
        return (
          <NextActions
            key={index}
            showSummaryButton
            onLab={goLab}
            onSimilar={goSimilar}
            onShare={doShare}
            onSummary={() => {
              setShowSummary(true);
            }}
          />
        );
    }
  };

  return (
    <>
      <section className={`push${open ? ' open' : ''}`} id="chatPage" data-testid="push-chatPage">
        <div className="top">
          <button
            type="button"
            className="backbtn"
            data-testid="push-chatPage-back"
            aria-label="返回"
            onClick={() => {
              closePush('chatPage');
            }}
          >
            ‹
          </button>
          <div>
            <h2 id="chatTitle">{topic !== undefined ? `探索 · ${topic}` : '探索问题'}</h2>
            <div className="sub2">和你的动态画像一起想清楚</div>
          </div>
        </div>
        <div className="scroll" id="chatScroll" ref={scrollRef}>
          {items.map(renderItem)}
        </div>
        <div className="c-input">
          <input
            id="chatInput"
            type="text"
            data-testid="chat-input"
            placeholder="想到什么，直接问…"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendChat();
            }}
          />
          <button type="button" className="c-send" data-testid="chat-send" disabled={busy} onClick={sendChat}>
            发送
          </button>
        </div>
      </section>

      {/* Gated on `open` too, so closing the chat drops the summary without a reset effect. */}
      {showSummary && open ? (
        <ChatSummary
          question={seedQuestion}
          topic={topic}
          answers={answers}
          turns={turns()}
          onBack={() => {
            setShowSummary(false);
          }}
          onFinish={() => {
            setShowSummary(false);
            closePush('chatPage');
            showToast('本次探索已保存');
          }}
          onLab={goLab}
          onSimilar={goSimilar}
          onShare={doShare}
        />
      ) : null}
    </>
  );
}
