// Basic-info edit mode (source: prototype ~5635 basic branch of
// `renderMyProfileEditor`, ~5711 `selectMyAvatar`).
//
// NOTE: the prototype's local avatar upload used <input type="file"> + FileReader
// + canvas, all of which the flash-app platform forbids (docs/API_MEDIA.md requires
// chooseImage + uploadImage, which need network — disabled here). So local upload is
// dropped; the recommended-avatar picker is kept and fully functional.

import { useState } from 'react';
import { AVATAR_OPTIONS, resolveAvatarSrc } from '../avatars';
import type { EditorProps } from '../myProfileStore';

export default function BasicEditor({ draft, updateDraft }: EditorProps) {
  const [tagsText, setTagsText] = useState(draft.tags.join('，'));

  const setMeta = (patch: Partial<typeof draft.meta>): void => {
    updateDraft((d) => ({ ...d, meta: { ...d.meta, ...patch } }));
  };

  return (
    <>
      <div className="edit-section">
        <div className="edit-section-title">
          <b>头像</b>
          <span>从推荐头像中选择</span>
        </div>
        <div className="avatar-upload-panel">
          <div className="avatar-current">
            <img src={resolveAvatarSrc(draft.avatar)} alt="当前头像预览" />
          </div>
          <div className="avatar-upload-copy">
            <b>选择你的头像</b>
            <p>从下方推荐头像中挑选一个，保存后即在主页名片生效。</p>
          </div>
        </div>
        <div className="edit-section-title">
          <b>推荐头像</b>
          <span>点击即可切换</span>
        </div>
        <div className="avatar-editor">
          {AVATAR_OPTIONS.map((option, index) => (
            <button
              type="button"
              key={option.path}
              className={`avatar-option${draft.avatar === option.path ? ' on' : ''}`}
              data-testid={`my-avatar-opt-${String(index)}`}
              onClick={() => {
                updateDraft((d) => ({ ...d, avatar: option.path }));
              }}
            >
              <img src={option.src} alt="头像选项" />
            </button>
          ))}
        </div>
      </div>

      <div className="edit-section">
        <div className="edit-section-title">
          <b>基础信息</b>
          <span>显示在主页名片</span>
        </div>
        <div className="edit-grid">
          <label className="edit-field">
            <span>昵称</span>
            <input
              maxLength={12}
              value={draft.name}
              data-testid="my-edit-name"
              onChange={(e) => {
                updateDraft((d) => ({ ...d, name: e.target.value }));
              }}
            />
          </label>
          <label className="edit-field">
            <span>年龄</span>
            <input
              inputMode="numeric"
              maxLength={3}
              value={draft.meta.age > 0 ? String(draft.meta.age) : ''}
              data-testid="my-edit-age"
              onChange={(e) => {
                setMeta({ age: Number(e.target.value.replace(/\D/g, '')) });
              }}
            />
          </label>
          <label className="edit-field">
            <span>所在城市</span>
            <input
              maxLength={10}
              value={draft.meta.city}
              data-testid="my-edit-city"
              onChange={(e) => {
                setMeta({ city: e.target.value });
              }}
            />
          </label>
          <label className="edit-field">
            <span>当前阶段</span>
            <input
              maxLength={16}
              value={draft.meta.years}
              data-testid="my-edit-years"
              onChange={(e) => {
                setMeta({ years: e.target.value });
              }}
            />
          </label>
          <label className="edit-field">
            <span>过去身份</span>
            <input
              maxLength={16}
              value={draft.meta.from}
              data-testid="my-edit-from"
              onChange={(e) => {
                setMeta({ from: e.target.value });
              }}
            />
          </label>
          <label className="edit-field">
            <span>现在身份</span>
            <input
              maxLength={16}
              value={draft.meta.to}
              data-testid="my-edit-to"
              onChange={(e) => {
                setMeta({ to: e.target.value });
              }}
            />
          </label>
          <label className="edit-field wide">
            <span>目前状态</span>
            <input
              maxLength={30}
              value={draft.meta.result}
              data-testid="my-edit-result"
              onChange={(e) => {
                setMeta({ result: e.target.value });
              }}
            />
          </label>
          <label className="edit-field wide">
            <span>主页标签（用逗号分隔）</span>
            <input
              maxLength={50}
              value={tagsText}
              data-testid="my-edit-tags"
              onChange={(e) => {
                const text = e.target.value;
                setTagsText(text);
                updateDraft((d) => ({
                  ...d,
                  tags: text
                    .split(/[，,]/)
                    .map((tag) => tag.trim())
                    .filter((tag) => tag !== ''),
                }));
              }}
            />
          </label>
        </div>
      </div>
    </>
  );
}
