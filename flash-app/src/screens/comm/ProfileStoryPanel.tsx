import { useState } from 'react';
import type { User } from '@/data/users';
import type { ProfileMeta } from '@/data/profileMeta';

interface ProfileStoryPanelProps {
  user: User;
  meta: ProfileMeta;
  on: boolean;
}

/** 用户主页 · TA 的故事 tab (原型 prof-story panel + profileTimelineHTML). */
export default function ProfileStoryPanel({ user, meta, on }: ProfileStoryPanelProps) {
  // Which milestone cards are expanded; the first one opens by default.
  const [openSet, setOpenSet] = useState<Set<number>>(() => new Set([0]));
  const toggle = (i: number) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const yearsNum = meta.years.match(/\d+/)?.[0] ?? String(user.traj.length);

  return (
    <section className={`prof-panel${on ? ' on' : ''}`} id="prof-story" role="tabpanel">
      <div className="prof-section-title">
        <h3>人生关键轨迹</h3>
        <span>点击节点展开详情</span>
      </div>
      <div className="prof-timeline">
        {user.traj.map((t, i) => {
          const isOpen = openSet.has(i);
          return (
            <div className="pt-item" key={`${t.age}-${t.t}`}>
              <span className="pt-dot" />
              <button
                type="button"
                className={`pt-card${isOpen ? ' open' : ''}`}
                aria-expanded={isOpen}
                data-testid={`prof-milestone-${String(i)}`}
                onClick={() => {
                  toggle(i);
                }}
              >
                <span className="pt-head">
                  <span>
                    <span className="pt-age">{t.age}</span>
                    <h4>{t.t}</h4>
                  </span>
                  <span className="pt-arrow">›</span>
                </span>
                <span className="pt-detail">{t.d}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="prof-quote">{user.quote}</div>
      <div className="story-copy">
        <h3>我的转型故事</h3>
        <p>{meta.intro}</p>
      </div>
      <div className="story-facts">
        <div className="story-fact">
          <b>{yearsNum} 年</b>
          <span>真实实践</span>
        </div>
        <div className="story-fact">
          <b>{user.traj.length}</b>
          <span>关键节点</span>
        </div>
        <div className="story-fact">
          <b>{meta.consulted}</b>
          <span>已帮助人数</span>
        </div>
      </div>
      <div className="story-full">
        <h4>完整故事 · 最难的一关</h4>
        <p>{meta.full}</p>
      </div>
    </section>
  );
}
