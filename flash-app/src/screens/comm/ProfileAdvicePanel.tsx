import { useState } from 'react';
import type { ProfileMeta } from '@/data/profileMeta';
import { ADVICE_TITLES } from '@/data/profile';

type AdviceKind = 'decision' | 'ability' | 'interview';

interface ProfileAdvicePanelProps {
  meta: ProfileMeta;
  unlocked: boolean;
  on: boolean;
}

const CHIPS: { kind: AdviceKind; label: string }[] = [
  { kind: 'decision', label: '转型决策' },
  { kind: 'ability', label: '能力迁移' },
  { kind: 'interview', label: '求职面试' },
];

/** 用户主页 · 经验与建议 tab (原型 prof-advice panel + profileAdviceHTML). */
export default function ProfileAdvicePanel({ meta, unlocked, on }: ProfileAdvicePanelProps) {
  const [kind, setKind] = useState<AdviceKind>('decision');
  const tips = meta.advice[kind];
  const titles = ADVICE_TITLES[kind];
  const visible = tips.slice(0, unlocked ? tips.length : 1);

  return (
    <section className={`prof-panel${on ? ' on' : ''}`} id="prof-advice" role="tabpanel">
      <div className="prof-section-title">
        <h3>把踩过的坑留给后来人</h3>
        <span>{unlocked ? '全部可见' : '部分可见'}</span>
      </div>
      <div className="advice-chips">
        {CHIPS.map((c) => (
          <button
            type="button"
            key={c.kind}
            className={`advice-chip${kind === c.kind ? ' on' : ''}`}
            data-testid={`advice-chip-${c.kind}`}
            onClick={() => {
              setKind(c.kind);
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div id="profileAdviceContent">
        <div className="advice-card">
          <div className="num">{titles[1] ?? ''}</div>
          <h4>{titles[0] ?? ''}</h4>
          <p>{tips[0] ?? ''}</p>
          <div className="advice-steps">
            {visible.map((t, i) => (
              <div className="advice-step" key={t}>
                <i>{i + 1}</i>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
        {unlocked ? null : (
          <div className="prof-lock" aria-label="其余建议尚未解锁">
            <div className="prof-lock-lines">
              <i />
              <i />
              <i />
            </div>
            <div className="prof-lock-copy">
              <b>还有 {tips.length - 1} 条亲历经验</b>
              <span>解锁完整经验后可查看全部内容</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
