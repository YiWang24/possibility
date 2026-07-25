// "提供服务" tab (source: prototype ~5598 service section of `renderMyProfile`).
// Only enabled services are shown; the 2nd/3rd get the materials/companion skins.

import type { MyProfile } from '@/data/profile';
import type { EditMode } from './myProfileStore';

interface MyServicePanelProps {
  profile: MyProfile;
  active: boolean;
  onEdit: (mode: EditMode) => void;
}

function cardSkin(index: number): string {
  if (index === 1) return ' materials';
  if (index === 2) return ' companion';
  return '';
}

export default function MyServicePanel({ profile, active, onEdit }: MyServicePanelProps) {
  const services = profile.services.filter((service) => service.enabled);

  return (
    <section className={`prof-panel my-prof-panel${active ? ' on' : ''}`} id="myprof-service">
      <div className="prof-section-title">
        <h3>我可以提供的服务</h3>
        <button
          type="button"
          className="prof-section-edit"
          data-testid="me-service-edit"
          onClick={() => {
            onEdit('service');
          }}
        >
          编辑服务
        </button>
      </div>

      {services.length === 0 ? (
        <div className="persona-empty">暂未公开服务，可以在这里编辑并开启</div>
      ) : (
        services.map((service, index) => (
          <div className={`consult-card${cardSkin(index)}`} key={service.id}>
            <div className="consult-price">
              <div>
                <div className="ey">{service.type}</div>
                <h3>{service.title}</h3>
              </div>
              <strong>¥{service.price}</strong>
            </div>
            <p className="consult-desc">{service.desc}</p>
          </div>
        ))
      )}
    </section>
  );
}
