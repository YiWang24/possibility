// 此刻的处境扫描 push (source: prototype #contextPage ~2474, `openContextScan`
// ~3278, `saveContextScan` ~3291). Four situational questions gate the save, then a
// derived 观察 is generated from the answers — the slot the prototype left empty.

import { useState } from 'react';
import { useAppStore, usePushOpen } from '@/store/appStore';
import { FALLBACK_OBSERVATION, observeContext, type ContextObservation } from './contextObserve';

interface ContextQuestion {
  id: string;
  num: string;
  q: string;
  options: string[];
}

const CONTEXT_QUESTIONS: readonly ContextQuestion[] = [
  { id: 'energy', num: '01 · 精力', q: '除去必须完成的事情，你还有多少精力留给自己？', options: ['几乎没有', '偶尔有', '还算充足'] },
  { id: 'pressure', num: '02 · 现实压力', q: '最近最不能忽略的压力来自哪里？', options: ['收入与支出', '工作环境', '家庭责任', '暂时没有'] },
  { id: 'support', num: '03 · 支持', q: '遇到问题时，你现实中有人可以商量或搭把手吗？', options: ['很难找到', '有一两个人', '支持比较充分'] },
  { id: 'choice', num: '04 · 选择空间', q: '你现在更接近“我不想改变”，还是“我暂时承担不起改变”？', options: ['不想改变', '想，但承担不起', '还分不清'] },
];

export default function ContextPush() {
  const open = usePushOpen('contextPage');
  const closePush = useAppStore((s) => s.closePush);
  const showToast = useAppStore((s) => s.showToast);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [observation, setObservation] = useState<ContextObservation | null>(null);
  const [saving, setSaving] = useState(false);

  const allAnswered = CONTEXT_QUESTIONS.every((question) => answers[question.id] !== undefined);

  // Stay on the page to show the observation rather than closing straight away —
  // it is the only thing the user gets back for answering.
  const save = (): void => {
    if (saving) return;
    setSaving(true);
    const labelled = CONTEXT_QUESTIONS.map((q) => ({ question: q.q, answer: answers[q.id] ?? '' }));
    void (async () => {
      let result: ContextObservation | null = null;
      try {
        result = await observeContext(labelled);
      } catch {
        // Falls back to the descriptive copy below.
      }
      setObservation(result ?? FALLBACK_OBSERVATION);
      setSaving(false);
      showToast('已更新数字人 · 状态没有被写成人格');
    })();
  };

  return (
    <section className={`push context-page${open ? ' open' : ''}`} id="contextPage" data-testid="push-contextPage">
      <div className="top">
        <button
          type="button"
          className="backbtn"
          data-testid="push-contextPage-back"
          aria-label="返回"
          onClick={() => {
            closePush('contextPage');
          }}
        >
          ‹
        </button>
        <div>
          <h2>此刻的处境</h2>
          <div className="sub2">状态、条件与支持 · 都可以修改</div>
        </div>
      </div>
      <div className="scroll">
        <div className="context-intro">
          <div className="k">CONTEXT, NOT CHARACTER</div>
          <h3>
            先不急着解释你是谁，
            <br />
            看看最近发生了什么。
          </h3>
          <p>这些答案只描述当下，不会被写成永久人格。数字人会把它们与稳定倾向分开保存。</p>
        </div>

        {CONTEXT_QUESTIONS.map((question) => (
          <div className="context-q" data-context-q={question.id} key={question.id}>
            <div className="num">{question.num}</div>
            <h4>{question.q}</h4>
            <div className="context-options">
              {question.options.map((option, optIndex) => (
                <button
                  type="button"
                  key={option}
                  className={answers[question.id] === option ? 'on' : ''}
                  data-testid={`context-${question.id}-${String(optIndex)}`}
                  onClick={() => {
                    setAnswers((prev) => ({ ...prev, [question.id]: option }));
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}

        {observation !== null ? (
          <div className="context-observation" data-testid="context-observation">
            <div className="k">此刻的观察</div>
            <h4>{observation.headline}</h4>
            <p>{observation.body}</p>
          </div>
        ) : null}

        <button type="button" className="context-save" data-testid="context-save" disabled={!allAnswered || saving} onClick={save}>
          {saving ? '正在看你的处境…' : observation !== null ? '重新生成观察' : '更新我的动态数字人'}
        </button>
        {observation !== null ? (
          <button
            type="button"
            className="context-done"
            data-testid="context-done"
            onClick={() => {
              closePush('contextPage');
            }}
          >
            完成
          </button>
        ) : null}
      </div>
    </section>
  );
}
