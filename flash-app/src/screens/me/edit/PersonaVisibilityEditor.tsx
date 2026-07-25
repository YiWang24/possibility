// Persona-visibility edit mode (source: prototype ~5694 persona branch of
// `renderMyProfileEditor`, ~5854 `updateMyVisibility` + `updateMyVisibilitySummary`).

import { useMyProfileStore, type EditorProps } from '../myProfileStore';
import { hasPersonaResult, personaSource } from '../personaModel';

export default function PersonaVisibilityEditor({ draft, updateDraft }: EditorProps) {
  const mbti = useMyProfileStore((s) => s.mbti);
  const source = personaSource(mbti);
  const selected = source.filter((item) => draft.visibility[item.key]);
  const completed = selected.filter(hasPersonaResult);

  return (
    <div className="edit-section">
      <div className="edit-section-title">
        <b>动态画像展示</b>
        <span>勾选后即在主页展示</span>
      </div>
      <div className="visibility-list">
        {source.map((item) => (
          <label className="visibility-row" key={item.key}>
            <div>
              <b>{item.label}</b>
              <span>{item.value}</span>
            </div>
            <input
              type="checkbox"
              checked={draft.visibility[item.key]}
              data-testid={`my-visibility-${item.key}`}
              onChange={(e) => {
                const { checked } = e.target;
                updateDraft((d) => ({ ...d, visibility: { ...d.visibility, [item.key]: checked } }));
              }}
            />
          </label>
        ))}
      </div>
      <p className="persona-public-note">
        已选择 {selected.length} 项，其中 {completed.length} 项已有结果；保存后全部展示，待完善内容会标注状态。动态画像始终与“认识自己”保持一致。
      </p>
    </div>
  );
}
