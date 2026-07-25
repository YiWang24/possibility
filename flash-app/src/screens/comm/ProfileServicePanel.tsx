import type { ProfileMeta } from '@/data/profileMeta';
import type { ProfileServiceCard, ServiceId } from './services';

interface ProfileServicePanelProps {
  services: ProfileServiceCard[];
  meta: ProfileMeta;
  on: boolean;
  onSelect: (id: ServiceId) => void;
}

/** 用户主页 · 可提供服务 tab (原型 prof-service panel). */
export default function ProfileServicePanel({ services, meta, on, onSelect }: ProfileServicePanelProps) {
  return (
    <section className={`prof-panel${on ? ' on' : ''}`} id="prof-service" role="tabpanel">
      <div className="prof-section-title">
        <h3>基于她的亲历提供服务</h3>
        <span>共 {services.length} 项</span>
      </div>
      {services.map((s) => (
        <div className={`consult-card ${s.style}`} key={s.id}>
          <div className="consult-price">
            <div>
              <div className="ey">{s.type}</div>
              <h3>{s.title}</h3>
            </div>
            <strong>
              ¥{s.price}
              <small>{s.unit}</small>
            </strong>
          </div>
          <p className="consult-desc">{s.desc}</p>
          {s.id === 'consult' ? (
            <div className="consult-meta">
              <span>
                <b>{meta.response}</b>
              </span>
              <span>
                已咨询 <b>{meta.consulted} 人</b>
              </span>
            </div>
          ) : null}
          <div className="consult-topics">
            {s.tags.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
          <button
            type="button"
            className="prof-inline-cta"
            data-testid={`prof-service-${s.id}`}
            onClick={() => {
              onSelect(s.id);
            }}
          >
            选择这项服务 · ¥{s.price}
          </button>
        </div>
      ))}
      <div className="consult-steps">
        <div className="prof-section-title" style={{ marginBottom: '4px' }}>
          <h3>服务保障</h3>
          <span>平台担保</span>
        </div>
        <div className="consult-step">
          <i>1</i>
          <div>
            <b>选择服务并补充需求</b>
            <p>不同类型会进入对应的确认或申请流程</p>
          </div>
        </div>
        <div className="consult-step">
          <i>2</i>
          <div>
            <b>平台确认交付范围</b>
            <p>下单前明确服务内容、周期与回复方式</p>
          </div>
        </div>
        <div className="consult-step">
          <i>3</i>
          <div>
            <b>完成后再确认交付</b>
            <p>有争议可申请平台介入处理</p>
          </div>
        </div>
      </div>
    </section>
  );
}
