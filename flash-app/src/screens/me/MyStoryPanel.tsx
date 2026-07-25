// "我的故事" tab (source: prototype ~5281 `profileTimelineHTML` with isMine,
// ~5583 story section of `renderMyProfile`). For the "me" profile the prototype's
// `profileMetaFor` derives intro/full from the quote + trajectory, so we mirror
// that here rather than showing the stored meta.intro/full.

import { useState } from 'react';
import type { MyProfile } from '@/data/profile';
import type { EditMode } from './myProfileStore';

interface MyStoryPanelProps {
  profile: MyProfile;
  active: boolean;
  onEdit: (mode: EditMode) => void;
}

export default function MyStoryPanel({ profile, active, onEdit }: MyStoryPanelProps) {
  const [openIndexes, setOpenIndexes] = useState<ReadonlySet<number>>(new Set([0]));

  const toggle = (index: number): void => {
    setOpenIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const intro = `${profile.quote} ${profile.traj[0]?.d ?? ''}`.trim();
  const full = profile.traj.map((t) => `${t.age}，${t.t}：${t.d}`).join(' ');
  const yearsMatch = profile.meta.years.match(/\d+/);
  const yearsLabel = yearsMatch !== null ? yearsMatch[0] : String(profile.traj.length);

  return (
    <section className={`prof-panel my-prof-panel${active ? ' on' : ''}`} id="myprof-story">
      <div className="prof-section-title">
        <h3>我的人生关键轨迹</h3>
        <button
          type="button"
          className="prof-section-edit"
          data-testid="me-story-edit"
          onClick={() => {
            onEdit('story');
          }}
        >
          编辑故事
        </button>
      </div>
      <div className="prof-timeline">
        {profile.traj.map((t, i) => {
          const open = openIndexes.has(i);
          return (
            <div className="pt-item" key={`${t.age}-${t.t}-${String(i)}`}>
              <span className="pt-dot" />
              <button
                type="button"
                className={`pt-card${open ? ' open' : ''}`}
                aria-expanded={open}
                data-testid={`me-timeline-${String(i)}`}
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

      <div className="prof-quote">{profile.quote}</div>
      <div className="story-copy">
        <h3>我的转型故事</h3>
        <p>{intro}</p>
      </div>
      <div className="story-facts">
        <div className="story-fact">
          <b>{yearsLabel} 年</b>
          <span>真实实践</span>
        </div>
        <div className="story-fact">
          <b>{profile.traj.length}</b>
          <span>关键节点</span>
        </div>
        <div className="story-fact">
          <b>{profile.meta.consulted}</b>
          <span>已帮助人数</span>
        </div>
      </div>
      <div className="story-full">
        <h4>完整故事 · 最难的一关</h4>
        <p>{full}</p>
      </div>
    </section>
  );
}
