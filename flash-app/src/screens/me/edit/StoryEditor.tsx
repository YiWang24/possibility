// Story edit mode (source: prototype ~5666 story branch of
// `renderMyProfileEditor`, ~5747 `renderMyTimelineEditor` + timeline mutators).

import { useAppStore } from '@/store/appStore';
import type { UserTrajectory } from '@/data/users';
import type { EditorProps } from '../myProfileStore';

export default function StoryEditor({ draft, updateDraft }: EditorProps) {
  const showToast = useAppStore((s) => s.showToast);

  const updateTraj = (index: number, key: keyof UserTrajectory, value: string): void => {
    updateDraft((d) => ({
      ...d,
      traj: d.traj.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));
  };

  const addTraj = (): void => {
    updateDraft((d) => ({
      ...d,
      traj: [...d.traj, { age: '现在', t: '新的节点', d: '写下这段经历发生了什么。' }],
    }));
  };

  const removeTraj = (index: number): void => {
    if (draft.traj.length === 1) {
      showToast('至少保留一个时间线节点');
      return;
    }
    updateDraft((d) => ({ ...d, traj: d.traj.filter((_, i) => i !== index) }));
  };

  return (
    <>
      <div className="edit-section">
        <div className="edit-section-title">
          <b>我的故事</b>
          <span>公开叙事</span>
        </div>
        <label className="edit-field">
          <span>故事题记</span>
          <textarea
            maxLength={80}
            value={draft.quote}
            data-testid="my-story-quote"
            onChange={(e) => {
              updateDraft((d) => ({ ...d, quote: e.target.value }));
            }}
          />
        </label>
        <label className="edit-field" style={{ marginTop: '10px' }}>
          <span>故事摘要</span>
          <textarea
            maxLength={260}
            value={draft.meta.intro}
            data-testid="my-story-intro"
            onChange={(e) => {
              updateDraft((d) => ({ ...d, meta: { ...d.meta, intro: e.target.value } }));
            }}
          />
        </label>
        <label className="edit-field" style={{ marginTop: '10px' }}>
          <span>完整故事</span>
          <textarea
            maxLength={500}
            value={draft.meta.full}
            data-testid="my-story-full"
            onChange={(e) => {
              updateDraft((d) => ({ ...d, meta: { ...d.meta, full: e.target.value } }));
            }}
          />
        </label>
      </div>

      <div className="edit-section">
        <div className="edit-section-title">
          <b>故事时间线</b>
          <span>可增删节点</span>
        </div>
        <div>
          {draft.traj.map((item, index) => (
            <div className="timeline-edit-item" key={index}>
              <div className="timeline-edit-actions">
                <span>人生节点 {String(index + 1).padStart(2, '0')}</span>
                <button
                  type="button"
                  className="timeline-remove"
                  data-testid={`my-traj-remove-${String(index)}`}
                  onClick={() => {
                    removeTraj(index);
                  }}
                >
                  删除节点
                </button>
              </div>
              <div className="timeline-edit-row">
                <input
                  value={item.age}
                  maxLength={12}
                  aria-label="时间或年龄"
                  data-testid={`my-traj-age-${String(index)}`}
                  onChange={(e) => {
                    updateTraj(index, 'age', e.target.value);
                  }}
                />
                <input
                  value={item.t}
                  maxLength={30}
                  aria-label="节点标题"
                  data-testid={`my-traj-title-${String(index)}`}
                  onChange={(e) => {
                    updateTraj(index, 't', e.target.value);
                  }}
                />
              </div>
              <textarea
                maxLength={140}
                value={item.d}
                aria-label="节点详情"
                data-testid={`my-traj-detail-${String(index)}`}
                onChange={(e) => {
                  updateTraj(index, 'd', e.target.value);
                }}
              />
            </div>
          ))}
        </div>
        <button type="button" className="edit-add" data-testid="my-traj-add" onClick={addTraj}>
          ＋ 添加一个人生节点
        </button>
      </div>
    </>
  );
}
