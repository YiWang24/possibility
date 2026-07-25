// MBTI picker inside 画像工作室 (source: prototype ~2455 #mbtiPanel,
// ~6768 `renderMBTIPicker`, ~6773 `toggleMBTIPicker`, ~6777 `selectMBTI`).
// Fully functional + self-contained; MBTI is persisted via the store.

import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { MBTI_TYPES } from '@/data/demoAssessments';
import { useMyProfileStore } from './myProfileStore';

export default function StudioMbtiPanel() {
  const mbti = useMyProfileStore((s) => s.mbti);
  const setMbti = useMyProfileStore((s) => s.setMbti);
  const showToast = useAppStore((s) => s.showToast);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className={`mbti-panel${pickerOpen ? ' open' : ''}`} id="mbtiPanel">
      <div className="mbti-head">
        <b>MBTI：</b>
        <span id="mbtiCurrent">{mbti ?? '未设置'}</span>
      </div>
      <button
        type="button"
        className="mbti-toggle"
        data-testid="mbti-toggle"
        onClick={() => {
          setPickerOpen((prev) => !prev);
        }}
      >
        选择或修改类型 ↓
      </button>
      <div className="mbti-types" id="mbtiTypes">
        {MBTI_TYPES.map((type) => (
          <button
            type="button"
            key={type}
            className={mbti === type ? 'on' : ''}
            data-testid={`mbti-type-${type}`}
            onClick={() => {
              setMbti(type);
              showToast(`已添加 MBTI：${type}`);
            }}
          >
            {type}
          </button>
        ))}
      </div>
    </div>
  );
}
