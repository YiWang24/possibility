import { useEffect, useRef, useState, type JSX } from 'react';
import { useAppStore, usePushOpen, usePushPayload } from '@/store/appStore';
import NextActions from '@/screens/home/chat/NextActions';
import ChatSummary from '@/screens/home/chat/ChatSummary';
import {
  CORRECTION_PROMPT_HTML,
  clarifyFollowupHTML,
  clarifyIntroHTML,
  confirmAnalysisHTML,
  correctionAckHTML,
  insightHTML,
} from '@/screens/home/chat/chatScript';

type ChatStage = 'clarify' | 'review' | 'correction' | 'ready';

type ChatItem =
  | { kind: 'me'; text: string }
  | { kind: 'ai'; html: string }
  | { kind: 'think' }
  | { kind: 'review-actions' }
  | { kind: 'correction-actions' }
  | { kind: 'next-actions' };

interface Pending {
  html: string;
  then: 'none' | 'review' | 'correction' | 'next';
  delay: number;
}

const DEFAULT_SEED = '我最近一直在想一个问题，但还没理清。';

export default function ChatPush() {
  const open = usePushOpen('chatPage');
  const payload = usePushPayload('chatPage');
  const closePush = useAppStore((s) => s.closePush);
  const setTab = useAppStore((s) => s.setTab);
  const showToast = useAppStore((s) => s.showToast);

  const topic = payload.topic;
  const seedQuestion = payload.question ?? DEFAULT_SEED;

  const [items, setItems] = useState<ChatItem[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [stage, setStage] = useState<ChatStage>('clarify');
  const [turn, setTurn] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [input, setInput] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Seed a fresh conversation on the closed→open transition (startChat).
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setItems([{ kind: 'me', text: seedQuestion }, { kind: 'think' }]);
      setAnswers([]);
      setStage('clarify');
      setTurn(0);
      setInput('');
      setShowSummary(false);
      setPending({ html: clarifyIntroHTML(topic), then: 'none', delay: 900 });
    }
  }

  // Reveal a pending assistant reply after its "thinking" delay (assistantAfter).
  useEffect(() => {
    if (pending === null) return;
    const p = pending;
    const timer = window.setTimeout(() => {
      setItems((prev) => {
        const next: ChatItem[] = [...prev.filter((it) => it.kind !== 'think'), { kind: 'ai', html: p.html }];
        if (p.then === 'review') next.push({ kind: 'review-actions' });
        else if (p.then === 'correction') next.push({ kind: 'correction-actions' });
        else if (p.then === 'next') next.push({ kind: 'next-actions' });
        return next;
      });
      setPending(null);
    }, p.delay);
    return () => {
      window.clearTimeout(timer);
    };
  }, [pending]);

  // Keep the transcript pinned to the newest message (scrollBottom).
  useEffect(() => {
    const el = scrollRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [items]);

  const scheduleAssistant = (html: string, then: Pending['then'], delay = 700) => {
    setItems((prev) => [...prev, { kind: 'think' }]);
    setPending({ html, then, delay });
  };

  const dropActions = (list: ChatItem[]) => list.filter((it) => it.kind !== 'review-actions' && it.kind !== 'correction-actions');

  const sendChat = () => {
    const value = input.trim();
    if (value === '' || pending !== null) return;
    setInput('');
    setItems((prev) => [...prev, { kind: 'me', text: value }]);
    setAnswers((prev) => [...prev, value]);
    if (stage === 'clarify' && turn === 0) {
      setTurn(1);
      scheduleAssistant(clarifyFollowupHTML(topic), 'none');
    } else if (stage === 'clarify') {
      setTurn(2);
      setStage('review');
      scheduleAssistant(insightHTML(answers[0], value), 'review', 800);
    } else if (stage === 'correction') {
      scheduleAssistant(correctionAckHTML(value), 'correction', 760);
    }
  };

  const confirmInsight = () => {
    if (pending !== null) return;
    setItems((prev) => [...dropActions(prev), { kind: 'me', text: '嗯，这个理解比较接近我。' }]);
    setStage('ready');
    scheduleAssistant(confirmAnalysisHTML(answers[0], answers[1]), 'next', 820);
  };

  const requestCorrection = () => {
    if (pending !== null) return;
    setItems((prev) => [...dropActions(prev), { kind: 'me', text: '还不太对。' }]);
    setStage('correction');
    scheduleAssistant(CORRECTION_PROMPT_HTML, 'none');
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
          <button type="button" className="c-send" data-testid="chat-send" disabled={pending !== null} onClick={sendChat}>
            发送
          </button>
        </div>
      </section>

      {showSummary ? (
        <ChatSummary
          question={seedQuestion}
          topic={topic}
          answers={answers}
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
