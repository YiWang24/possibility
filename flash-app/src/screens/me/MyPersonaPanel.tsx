// "动态画像" tab of 我的公开主页 (source: prototype ~5237 `publicPersonaHTML`
// with `isMine = true`, ~5579 persona section of `renderMyProfile`).

import PersonaCanvas from '@/components/PersonaCanvas';
import type { MyProfile } from '@/data/profile';
import type { EditMode } from './myProfileStore';
import { hasPersonaResult, personaSource, profilePersonaItems } from './personaModel';

interface MyPersonaPanelProps {
  profile: MyProfile;
  mbti: string | null;
  active: boolean;
  onEdit: (mode: EditMode) => void;
}

export default function MyPersonaPanel({ profile, mbti, active, onEdit }: MyPersonaPanelProps) {
  const source = personaSource(mbti);
  const items = profilePersonaItems(profile.visibility, source);
  const lifeItem = items.find((item) => item.key === 'life');
  const dimensions = items.filter((item) => item.key !== 'life' || (item.cards ?? []).length === 0);
  const total = 7;
  const progress = Math.round((items.length / total) * 100);
  const lifeCards = lifeItem?.cards ?? [];

  return (
    <section className={`prof-panel my-prof-panel${active ? ' on' : ''}`} id="myprof-persona">
      <div className="prof-section-title">
        <h3>我的动态画像</h3>
        <div className="prof-section-actions">
          <span>已展示 {items.length} 项</span>
          <button
            type="button"
            className="prof-section-edit"
            data-testid="me-persona-edit"
            onClick={() => {
              onEdit('persona');
            }}
          >
            设置展示
          </button>
        </div>
      </div>

      <div className="card portrait public-profile-portrait">
        <div className="digital-human-stage public-persona-stage">
          <PersonaCanvas testId="persona-canvas-me" />
          <span className="digital-human-live">SYNCED LIVE FORM</span>
          <div className="digital-human-caption">
            <b>{profile.name} · 动态画像</b>
            <span>与“认识自己”页面实时同步</span>
          </div>
        </div>

        {lifeCards.length > 0 ? (
          <div className="portrait-life-signature show">
            <div className="signature-head">
              <b>我的人生底牌</b>
              <span>已参与数字形象生成</span>
            </div>
            <div className="cards">
              {lifeCards.map((card) => (
                <div className="card-mini" key={card.name}>
                  <i>{card.glyph}</i>
                  <span>{card.name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {items.length > 0 ? (
          <>
            <div className="pbar">
              <div className="tr">
                <i style={{ width: `${String(progress)}%` }} />
              </div>
              <span>{items.length} 项公开</span>
            </div>
            <div className="dims public-persona-dims">
              {dimensions.map((item) => (
                <div className="dim" key={item.key}>
                  <span className="ic" style={{ background: item.color }}>
                    {item.glyph}
                  </span>
                  <span className="tx">
                    <b>{item.label}</b>
                    <p>{item.value}</p>
                  </span>
                  <span className="ar">{hasPersonaResult(item) ? '已公开' : '待完善'}</span>
                </div>
              ))}
            </div>
            <p className="persona-public-note">动态画像与“认识自己”保持一致；下方展示你在“设置展示”中开启的画像内容。</p>
          </>
        ) : (
          <div className="persona-empty" style={{ marginTop: '14px' }}>
            目前没有开启公开展示的画像内容
          </div>
        )}
      </div>
    </section>
  );
}
