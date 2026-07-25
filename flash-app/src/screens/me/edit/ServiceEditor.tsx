// Service edit mode (source: prototype ~5687 service branch of
// `renderMyProfileEditor`, ~5865 `renderMyServiceEditor` + service mutators).

import type { ProfileService } from '@/data/profile';
import type { EditorProps } from '../myProfileStore';

export default function ServiceEditor({ draft, updateDraft }: EditorProps) {
  const services = draft.services;

  const patchService = (index: number, patch: Partial<ProfileService>): void => {
    updateDraft((d) => ({
      ...d,
      services: d.services.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  };

  const addService = (): void => {
    updateDraft((d) => ({
      ...d,
      services: [
        ...d.services,
        {
          id: `custom-service-${Date.now().toString(36)}-${String(d.services.length + 1)}`,
          enabled: false,
          type: '自定义服务',
          title: '新的服务',
          price: '29',
          desc: '写下这项服务适合谁、包含什么，以及你会如何提供帮助。',
        },
      ],
    }));
  };

  const removeService = (index: number): void => {
    updateDraft((d) => ({ ...d, services: d.services.filter((_, i) => i !== index) }));
  };

  return (
    <div className="edit-section">
      <div className="edit-section-title">
        <b>提供服务</b>
        <span>可新增、自定义和删除</span>
      </div>
      <div>
        {services.length === 0 ? (
          <div className="advice-editor-empty">还没有服务。新增后可自定义类型、名称、价格与服务说明。</div>
        ) : (
          services.map((service, index) => (
            <div className="timeline-edit-item" key={service.id}>
              <div className="timeline-edit-actions">
                <span>服务 {String(index + 1).padStart(2, '0')}</span>
                <button
                  type="button"
                  className="timeline-remove"
                  data-testid={`my-service-remove-${String(index)}`}
                  onClick={() => {
                    removeService(index);
                  }}
                >
                  删除服务
                </button>
              </div>
              <label className="visibility-row" style={{ marginBottom: '9px' }}>
                <div>
                  <b>{service.title !== '' ? service.title : '未命名服务'}</b>
                  <span>{service.enabled ? '公开中' : '未公开'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={service.enabled}
                  data-testid={`my-service-enabled-${String(index)}`}
                  onChange={(e) => {
                    patchService(index, { enabled: e.target.checked });
                  }}
                />
              </label>
              <div className="edit-grid">
                <label className="edit-field">
                  <span>服务类型</span>
                  <input
                    value={service.type}
                    maxLength={16}
                    placeholder="如：1 对 1 咨询"
                    data-testid={`my-service-type-${String(index)}`}
                    onChange={(e) => {
                      patchService(index, { type: e.target.value });
                    }}
                  />
                </label>
                <label className="edit-field">
                  <span>价格（元）</span>
                  <input
                    value={service.price}
                    maxLength={8}
                    inputMode="decimal"
                    placeholder="29"
                    data-testid={`my-service-price-${String(index)}`}
                    onChange={(e) => {
                      patchService(index, { price: e.target.value });
                    }}
                  />
                </label>
                <label className="edit-field wide">
                  <span>服务名称</span>
                  <input
                    value={service.title}
                    maxLength={32}
                    placeholder="给服务起一个清晰的名称"
                    data-testid={`my-service-title-${String(index)}`}
                    onChange={(e) => {
                      patchService(index, { title: e.target.value });
                    }}
                  />
                </label>
                <label className="edit-field wide">
                  <span>服务说明</span>
                  <textarea
                    value={service.desc}
                    maxLength={260}
                    placeholder="说明适合谁、包含什么和交付方式"
                    data-testid={`my-service-desc-${String(index)}`}
                    onChange={(e) => {
                      patchService(index, { desc: e.target.value });
                    }}
                  />
                </label>
              </div>
            </div>
          ))
        )}
      </div>
      <button type="button" className="edit-add" data-testid="my-service-add" onClick={addService}>
        ＋ 新增服务
      </button>
    </div>
  );
}
