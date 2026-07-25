// "经验与建议" tab (source: prototype ~5314 `myAdviceModulesHTML`,
// ~5305 `safeAdviceURL`, ~5594 advice section of `renderMyProfile`).

import type { MyProfile } from '@/data/profile';
import type { EditMode } from './myProfileStore';

interface MyAdvicePanelProps {
  profile: MyProfile;
  active: boolean;
  onEdit: (mode: EditMode) => void;
}

/** Coerce a user-entered link into a safe http(s) URL, or '' when invalid. */
function safeAdviceURL(value: string): string {
  let raw = value.trim();
  if (raw === '') return '';
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export default function MyAdvicePanel({ profile, active, onEdit }: MyAdvicePanelProps) {
  const modules = profile.adviceModules;

  return (
    <section className={`prof-panel my-prof-panel${active ? ' on' : ''}`} id="myprof-advice">
      <div className="prof-section-title">
        <h3>我愿意分享的经验</h3>
        <button
          type="button"
          className="prof-section-edit"
          data-testid="me-advice-edit"
          onClick={() => {
            onEdit('advice');
          }}
        >
          编辑建议
        </button>
      </div>

      {modules.length === 0 ? (
        <div className="persona-empty">还没有公开经验模块，点击“编辑建议”添加第一条内容</div>
      ) : (
        modules.map((module, index) => {
          const title = module.title !== '' ? module.title : '未命名经验';
          const links = module.links.map((link) => ({ ...link, safeURL: safeAdviceURL(link.url) })).filter((link) => link.safeURL !== '');
          return (
            <article className="advice-card my-advice-card" key={module.id}>
              <div className="num">经验 {String(index + 1).padStart(2, '0')}</div>
              <h4>{title}</h4>
              {module.content !== '' ? <p className="advice-copy">{module.content}</p> : null}
              {module.images.length > 0 ? (
                <div className="my-advice-media">
                  {module.images.map((image) => (
                    <img key={image.id} src={image.src} alt={image.name !== '' ? image.name : title} />
                  ))}
                </div>
              ) : null}
              {links.length > 0 ? (
                <div className="my-advice-links">
                  {links.map((link) => (
                    <a
                      key={link.id}
                      data-testid={`my-advice-link-${link.id}`}
                      className="my-advice-link"
                      href={link.safeURL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label !== '' ? link.label : '查看相关链接'}
                    </a>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })
      )}
    </section>
  );
}
