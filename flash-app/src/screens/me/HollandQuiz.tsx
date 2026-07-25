// 霍兰德兴趣测评 quiz shell (source: prototype #assessmentPage ~2508,
// `openAssessmentIntro('holland')` ~6321, `renderHollandQuestion` ~6357,
// `renderHollandResult` ~6448). RIASEC scoring is real (simple likert sums); the
// result is shown inline instead of via the separate assessmentResultPage push.

import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { HOLLAND_ITEMS, HOLLAND_META } from '@/data/holland';
import { computeHollandResult, HOLLAND_CODES, hollandNarrative, LIKERT_LABELS } from './hollandScoring';
import { safeStoreSet } from './myProfileStorage';

type Phase = 'intro' | 'questions' | 'result';
const TOTAL = HOLLAND_ITEMS.length;

interface HollandQuizProps {
  open: boolean;
  onClose: () => void;
}

export default function HollandQuiz({ open, onClose }: HollandQuizProps) {
  const showToast = useAppStore((s) => s.showToast);
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => Array.from({ length: TOTAL }, () => null));

  const answered = answers.filter((v) => v !== null).length;
  const progressPct = phase === 'result' ? 100 : (answered / TOTAL) * 100;
  const progressText = phase === 'intro' ? '准备开始' : phase === 'result' ? '已完成' : `${String(index + 1)} / ${String(TOTAL)}`;
  const current = answers[index] ?? null;

  const begin = (): void => {
    const firstEmpty = answers.findIndex((v) => v === null);
    setIndex(firstEmpty >= 0 ? firstEmpty : 0);
    setPhase('questions');
  };

  const select = (value: number): void => {
    setAnswers((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const next = (): void => {
    if (current === null) return;
    if (index < TOTAL - 1) {
      setIndex(index + 1);
      return;
    }
    const missing = answers.findIndex((v) => v === null);
    if (missing >= 0) {
      setIndex(missing);
      showToast('还有一道题没有回答');
      return;
    }
    setPhase('result');
  };

  const result = phase === 'result' ? computeHollandResult(answers) : null;

  const save = (): void => {
    if (result === null) return;
    const tags = result.selected.map((k) => HOLLAND_META[k].label);
    safeStoreSet('kaleido_holland_profile_v1', { code: result.displayCode, tags, source: 'formal_assessment', visible: false });
    showToast('已写入兴趣画像 · 原始答案默认私密');
    onClose();
  };

  const item = HOLLAND_ITEMS[index];

  return (
    <section className={`push assessment-page${open ? ' open' : ''}`} id="assessmentPage" data-testid="push-assessmentPage">
      <div className="top">
        <button type="button" className="backbtn" aria-label="退出并保存" data-testid="assessment-back" onClick={onClose}>
          ‹
        </button>
        <div>
          <h2 id="assessmentTitle">霍兰德兴趣测评</h2>
          <div className="sub2" id="assessmentSub">
            兴趣不是能力，也不是职业判决
          </div>
        </div>
        <div className="assess-head-progress">
          <div className="track">
            <i style={{ width: `${String(progressPct)}%` }} />
          </div>
          <span>{progressText}</span>
        </div>
      </div>

      <div className="assessment-body" id="assessmentBody">
        {phase === 'intro' ? (
          <div className="assessment-intro">
            <div className="assess-kicker">O*NET MINI INTEREST PROFILER</div>
            <h3>
              哪些活动，
              <br />
              会让你自然地靠近？
            </h3>
            <p>接下来会出现30种活动。请只回答“喜欢不喜欢”，不要考虑自己现在会不会、薪资高不高或别人怎么看。</p>
            <ul className="assessment-notice">
              <li>这是霍兰德RIASEC模型的官方移动短版</li>
              <li>结果描述兴趣，不代表能力、资格或命定职业</li>
              <li>中文内容为产品验证中的翻译版本</li>
              <li>答案会保存在当前设备，可随时退出继续</li>
            </ul>
          </div>
        ) : null}

        {phase === 'questions' && item !== undefined ? (
          <div className="question-stage">
            <div className="assess-kicker">凭第一感觉回答 · 不考能力</div>
            <h3>{item[1]}</h3>
            <div className="likert-list">
              {LIKERT_LABELS.map((label, value) => (
                <button
                  type="button"
                  key={label}
                  className={current === value ? 'on' : ''}
                  data-testid={`holland-likert-${String(value)}`}
                  onClick={() => {
                    select(value);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="answer-saved">{current === null ? '选择后自动保存' : '✓ 已保存在当前设备'}</div>
          </div>
        ) : null}

        {phase === 'result' && result !== null ? <HollandResultView save={save} result={result} /> : null}
      </div>

      {phase === 'intro' ? (
        <div className="assessment-foot">
          <button type="button" className="secondary" data-testid="holland-later" onClick={onClose}>
            以后再说
          </button>
          <button type="button" className="primary" data-testid="holland-begin" onClick={begin}>
            {answered > 0 ? `继续 ${String(answered)}/${String(TOTAL)}` : '开始测评'}
          </button>
        </div>
      ) : null}

      {phase === 'questions' ? (
        <div className="assessment-foot">
          <button
            type="button"
            className="secondary"
            disabled={index === 0}
            data-testid="holland-prev"
            onClick={() => {
              if (index > 0) setIndex(index - 1);
            }}
          >
            上一题
          </button>
          <button type="button" className="primary" disabled={current === null} data-testid="holland-next" onClick={next}>
            {index === TOTAL - 1 ? '生成结果' : '下一题'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

interface HollandResultViewProps {
  result: ReturnType<typeof computeHollandResult>;
  save: () => void;
}

function HollandResultView({ result, save }: HollandResultViewProps) {
  const top = result.selected;
  const t0 = top[0] ?? 'R';
  const t1 = top[1] ?? t0;
  const topNames = top.map((k) => HOLLAND_META[k].name.replace('型', '')).join('、');
  const codeStyle = result.displayCode.length > 5 ? { fontSize: '24px', letterSpacing: '.06em' } : {};

  return (
    <>
      <div className="result-hero">
        <div className="overline">YOUR INTEREST CONSTELLATION</div>
        <div className="code" style={codeStyle}>
          {result.displayCode}
        </div>
        <h3>
          你的兴趣更靠近
          <br />
          {topNames}
        </h3>
        <p>{hollandNarrative(result)}</p>
      </div>
      <div className="riasec-bars">
        {HOLLAND_CODES.map((k) => (
          <div className="rbar" key={k}>
            <b>{k}</b>
            <div className="track">
              <i style={{ width: `${String((result.scores[k] / 20) * 100)}%`, background: HOLLAND_META[k].color }} />
            </div>
            <span>{result.scores[k]}/20</span>
          </div>
        ))}
      </div>
      <div className="result-insight">
        <div className="cap">PROFILE SIGNAL · 可写入画像</div>
        <h4>{top.map((k) => HOLLAND_META[k].label).join(' · ')}</h4>
        <p>
          {HOLLAND_META[t0].desc}
          {HOLLAND_META[t1].desc}
        </p>
        <div className="result-tags">
          {top.map((k) => (
            <span key={k}>{HOLLAND_META[k].label}</span>
          ))}
        </div>
      </div>
      <p className="method-note">兴趣不等于能力、人格或资格。本结果来自O*NET Mini Interest Profiler的中文验证中版本，用于扩展探索，不替你决定职业。</p>
      <button type="button" className="result-save" data-testid="holland-save" onClick={save}>
        将这组兴趣信号保存到我的画像
      </button>
    </>
  );
}
