// 六种测评通用的答题页（原型 #assessmentPage：intro → 逐题 → 结果）。
// 大五在 intro 与结果页都能在「完整版 120 题 / 快速版 30 题」之间切换，
// 两版进度分别持久化，互不覆盖。

import { Fragment } from 'react';
import { useAppStore, usePushOpen, usePushPayload } from '@/store/appStore';
import { assessmentSpec, isBigFive, type AssessmentKind, type AssessmentSpec } from './assessmentConfig';
import AssessmentResultView from './AssessmentResultView';
import { answeredCount, useAssessment, useAssessmentStore } from './assessmentStore';

/** push 关闭时组件仍然渲染（`.push` 靠 class 做滑入动画），需要一个占位 kind。 */
const FALLBACK_KIND: AssessmentKind = 'bigfive';

/** 题库文案里的 `<br>` 是数据自带的换行标记。 */
function multiline(text: string): string[] {
  return text.split(/<br\s*\/?>/);
}

interface VersionSwitchProps {
  kind: AssessmentKind;
  onSwitch: (target: AssessmentKind) => void;
}

const VERSIONS: readonly { kind: AssessmentKind; label: string; hint: string }[] = [
  { kind: 'bigfive', label: '完整版', hint: '120 题 · 含 30 个细分面向' },
  { kind: 'bigfiveLite', label: '快速版', hint: '30 题 · 只给五维概览' },
];

function VersionSwitch({ kind, onSwitch }: VersionSwitchProps) {
  return (
    <div className="mt-5 flex gap-2">
      {VERSIONS.map((version) => {
        const on = version.kind === kind;
        return (
          <button
            key={version.kind}
            type="button"
            data-testid={`assessment-version-${version.kind}`}
            className={`flex-1 cursor-pointer rounded-2xl border px-3 py-2.5 text-left transition-colors ${
              on ? 'border-[rgba(132,150,255,.55)] bg-[rgba(89,104,217,.22)]' : 'border-[color:var(--line)] bg-[color:var(--raised)]'
            }`}
            onClick={() => {
              onSwitch(version.kind);
            }}
          >
            <b className={`block text-[12px] font-semibold ${on ? 'text-[#DCE4F7]' : 'text-[color:var(--sub)]'}`}>{version.label}</b>
            <span className="mt-1 block text-[9.5px] text-[color:var(--faint)]">{version.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

interface IntroProps {
  spec: AssessmentSpec;
  kind: AssessmentKind;
  onSwitch: (target: AssessmentKind) => void;
}

function Intro({ spec, kind, onSwitch }: IntroProps) {
  return (
    <div className="assessment-intro">
      <div className="assess-kicker">{spec.kicker}</div>
      <h3>
        {multiline(spec.introTitle).map((line, i) => (
          <Fragment key={`${String(i)}-${line}`}>
            {i > 0 ? <br /> : null}
            {line}
          </Fragment>
        ))}
      </h3>
      <p>{spec.intro}</p>
      {isBigFive(kind) ? <VersionSwitch kind={kind} onSwitch={onSwitch} /> : null}
      <ul className="assessment-notice">
        {spec.notices.map((notice) => (
          <li key={notice}>{notice}</li>
        ))}
      </ul>
    </div>
  );
}

interface QuestionProps {
  spec: AssessmentSpec;
  text: string;
  current: number | null;
  onSelect: (value: number) => void;
}

function Question({ spec, text, current, onSelect }: QuestionProps) {
  return (
    <div className="question-stage">
      <div className="assess-kicker">{spec.kind === 'holland' ? '凭第一感觉回答 · 不考能力' : '按照真实状态回答 · 没有正确答案'}</div>
      <h3>{text}</h3>
      <div className="likert-list">
        {spec.likert.map((label, value) => (
          <button
            type="button"
            key={label}
            className={current === value ? 'on' : ''}
            data-testid={`assessment-likert-${String(value)}`}
            onClick={() => {
              onSelect(value);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="answer-saved">{current === null ? '选择后自动保存' : '✓ 已保存在当前设备'}</div>
    </div>
  );
}

export default function AssessmentPush() {
  const open = usePushOpen('assessmentPage');
  const payload = usePushPayload('assessmentPage');
  const kind = payload.assessmentKind ?? FALLBACK_KIND;

  const spec = assessmentSpec(kind);
  const progress = useAssessment(kind);
  const begin = useAssessmentStore((s) => s.begin);
  const select = useAssessmentStore((s) => s.select);
  const previous = useAssessmentStore((s) => s.previous);
  const next = useAssessmentStore((s) => s.next);
  const showIntro = useAssessmentStore((s) => s.showIntro);
  const closePush = useAppStore((s) => s.closePush);
  const openPush = useAppStore((s) => s.openPush);
  const showToast = useAppStore((s) => s.showToast);

  const { phase, index, result } = progress;
  const total = spec.items.length;
  const answered = answeredCount(progress);
  const current = progress.answers[index] ?? null;
  const item = spec.items[index];

  const progressPct = phase === 'result' ? 100 : (answered / total) * 100;
  const progressText = phase === 'intro' ? '准备开始' : phase === 'result' ? '已完成' : `${String(index + 1)} / ${String(total)}`;

  const exit = (): void => {
    if (phase === 'questions' && answered > 0) showToast('进度已保留，下次可以继续');
    closePush('assessmentPage');
  };

  const advance = (): void => {
    const message = next(kind);
    if (message !== null) showToast(message);
  };

  // 切版本 = 换一个 kind 重新打开本页；目标版本先回到 intro，好让用户看清题量差别。
  const switchVersion = (target: AssessmentKind): void => {
    if (target === kind) return;
    showIntro(target);
    openPush('assessmentPage', { assessmentKind: target });
  };

  return (
    <section className={`push assessment-page${open ? ' open' : ''}`} id="assessmentPage" data-testid="push-assessmentPage">
      <div className="top">
        <button type="button" className="backbtn" aria-label="退出并保存" data-testid="assessment-back" onClick={exit}>
          ‹
        </button>
        <div>
          <h2>{phase === 'result' ? spec.resultTitle : spec.title}</h2>
          <div className="sub2">{phase === 'result' ? spec.resultSub : spec.sub}</div>
        </div>
        <div className="assess-head-progress">
          <div className="track">
            <i style={{ width: `${String(progressPct)}%` }} />
          </div>
          <span>{progressText}</span>
        </div>
      </div>

      <div className="assessment-body">
        {phase === 'intro' ? <Intro spec={spec} kind={kind} onSwitch={switchVersion} /> : null}

        {phase === 'questions' && item !== undefined ? (
          <Question
            spec={spec}
            text={item.t}
            current={current}
            onSelect={(value) => {
              select(kind, value);
            }}
          />
        ) : null}

        {phase === 'result' && result !== null ? (
          <>
            {isBigFive(kind) ? <VersionSwitch kind={kind} onSwitch={switchVersion} /> : null}
            <AssessmentResultView
              spec={spec}
              result={result}
              onSaved={() => {
                closePush('assessmentPage');
              }}
            />
          </>
        ) : null}
      </div>

      {phase === 'intro' ? (
        <div className="assessment-foot">
          <button type="button" className="secondary" data-testid="assessment-later" onClick={exit}>
            以后再说
          </button>
          <button
            type="button"
            className="primary"
            data-testid="assessment-begin"
            onClick={() => {
              begin(kind);
            }}
          >
            {answered > 0 ? `继续 ${String(answered)}/${String(total)}` : '开始测评'}
          </button>
        </div>
      ) : null}

      {phase === 'questions' ? (
        <div className="assessment-foot">
          <button
            type="button"
            className="secondary"
            disabled={index === 0}
            data-testid="assessment-prev"
            onClick={() => {
              previous(kind);
            }}
          >
            上一题
          </button>
          <button type="button" className="primary" disabled={current === null} data-testid="assessment-next" onClick={advance}>
            {index === total - 1 ? '生成结果' : '下一题'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
