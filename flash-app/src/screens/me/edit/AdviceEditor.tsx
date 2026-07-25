// Advice-module edit mode (source: prototype ~5679 advice branch of
// `renderMyProfileEditor`, ~5766 `renderMyAdviceEditor` + module/link mutators).
//
// NOTE: the prototype's per-module image upload used <input type="file"> + FileReader
// + canvas (forbidden by the flash-app platform; docs/API_MEDIA.md requires
// chooseImage + uploadImage over the network, disabled here). The add-image control
// is therefore dropped; any previously-saved data-URL images still render and can be
// removed. Title / content / links remain fully editable.

import type { AdviceModule } from '@/data/profile';
import type { EditorProps } from '../myProfileStore';

let idSeed = 0;
function newId(prefix: string): string {
  idSeed += 1;
  return `${prefix}-${Date.now().toString(36)}-${String(idSeed)}`;
}

export default function AdviceEditor({ draft, updateDraft }: EditorProps) {
  const modules = draft.adviceModules;

  const patchModule = (index: number, patch: Partial<AdviceModule>): void => {
    updateDraft((d) => ({
      ...d,
      adviceModules: d.adviceModules.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));
  };

  const addModule = (): void => {
    updateDraft((d) => ({
      ...d,
      adviceModules: [...d.adviceModules, { id: newId('advice'), title: '新的经验主题', content: '', images: [], links: [] }],
    }));
  };

  const removeModule = (index: number): void => {
    updateDraft((d) => ({ ...d, adviceModules: d.adviceModules.filter((_, i) => i !== index) }));
  };

  const addLink = (index: number): void => {
    const target = modules[index];
    if (target === undefined || target.links.length >= 6) return;
    patchModule(index, { links: [...target.links, { id: newId('link'), label: '相关资料', url: '' }] });
  };

  const updateLink = (index: number, linkIndex: number, key: 'label' | 'url', value: string): void => {
    const target = modules[index];
    if (target === undefined) return;
    patchModule(index, { links: target.links.map((l, i) => (i === linkIndex ? { ...l, [key]: value } : l)) });
  };

  const removeLink = (index: number, linkIndex: number): void => {
    const target = modules[index];
    if (target === undefined) return;
    patchModule(index, { links: target.links.filter((_, i) => i !== linkIndex) });
  };

  const removeImage = (index: number, imageIndex: number): void => {
    const target = modules[index];
    if (target === undefined) return;
    patchModule(index, { images: target.images.filter((_, i) => i !== imageIndex) });
  };

  return (
    <div className="edit-section">
      <div className="edit-section-title">
        <b>经验与建议模块</b>
        <span>标题、正文与链接</span>
      </div>
      <div>
        {modules.length === 0 ? (
          <div className="advice-editor-empty">还没有经验模块。你可以从一段亲历、一个方法或一份资料开始。</div>
        ) : (
          modules.map((module, index) => (
            <div className="advice-editor-card" key={module.id}>
              <div className="timeline-edit-actions">
                <span>经验模块 {String(index + 1).padStart(2, '0')}</span>
                <button
                  type="button"
                  className="timeline-remove"
                  aria-label="删除这个经验模块"
                  data-testid={`my-advice-remove-${String(index)}`}
                  onClick={() => {
                    removeModule(index);
                  }}
                >
                  删除模块
                </button>
              </div>
              <label className="edit-field">
                <span>模块标题</span>
                <input
                  value={module.title}
                  maxLength={40}
                  placeholder="例如：转型前先做一次低成本验证"
                  data-testid={`my-advice-title-${String(index)}`}
                  onChange={(e) => {
                    patchModule(index, { title: e.target.value });
                  }}
                />
              </label>
              <label className="edit-field">
                <span>详细内容</span>
                <textarea
                  value={module.content}
                  maxLength={1200}
                  placeholder="写下经验、方法、步骤或提醒"
                  data-testid={`my-advice-content-${String(index)}`}
                  onChange={(e) => {
                    patchModule(index, { content: e.target.value });
                  }}
                />
              </label>
              {module.images.length > 0 ? (
                <div className="advice-editor-media">
                  {module.images.map((image, imageIndex) => (
                    <div className="advice-image-thumb" key={image.id}>
                      <img src={image.src} alt={image.name} />
                      <button
                        type="button"
                        className="advice-image-remove"
                        aria-label="删除图片"
                        data-testid={`my-advice-img-remove-${String(index)}-${String(imageIndex)}`}
                        onClick={() => {
                          removeImage(index, imageIndex);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="advice-link-list">
                {module.links.map((link, linkIndex) => (
                  <div className="advice-link-editor" key={link.id}>
                    <input
                      value={link.label}
                      maxLength={24}
                      placeholder="链接名称"
                      aria-label="链接名称"
                      data-testid={`my-advice-link-label-${String(index)}-${String(linkIndex)}`}
                      onChange={(e) => {
                        updateLink(index, linkIndex, 'label', e.target.value);
                      }}
                    />
                    <input
                      value={link.url}
                      maxLength={240}
                      placeholder="https://..."
                      aria-label="链接地址"
                      data-testid={`my-advice-link-url-${String(index)}-${String(linkIndex)}`}
                      onChange={(e) => {
                        updateLink(index, linkIndex, 'url', e.target.value);
                      }}
                    />
                    <button
                      type="button"
                      className="advice-link-remove"
                      aria-label="删除链接"
                      data-testid={`my-advice-link-remove-${String(index)}-${String(linkIndex)}`}
                      onClick={() => {
                        removeLink(index, linkIndex);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {module.links.length < 6 ? (
                <button
                  type="button"
                  className="edit-add"
                  data-testid={`my-advice-link-add-${String(index)}`}
                  onClick={() => {
                    addLink(index);
                  }}
                >
                  ＋ 添加链接
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
      <button type="button" className="edit-add" data-testid="my-advice-add" onClick={addModule}>
        ＋ 新增经验模块
      </button>
      <p className="advice-edit-help">每个模块都可以独立增删；链接保存后可直接访问。</p>
    </div>
  );
}
