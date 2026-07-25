import { HUES, USERS } from '@/data/users';

interface SimPeopleProps {
  onOpenProfile: (id: number) => void;
}

// 类似经验的人 — the sim-user carousel. Mirrors simCardHTML (~3705) + userAvatarMarkup.
export default function SimPeople({ onOpenProfile }: SimPeopleProps) {
  const people = USERS.filter((u) => u.sim);
  return (
    <div className="simrow" id="rsPeople" style={{ marginTop: '2px', opacity: 1, animation: 'none' }}>
      {people.map((u) => {
        const h = HUES[u.hue];
        const avatar = u.avatar;
        return (
          <div
            className="simcard"
            key={u.id}
            role="button"
            tabIndex={0}
            data-testid={`sim-person-${String(u.id)}`}
            onClick={() => {
              onOpenProfile(u.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenProfile(u.id);
              }
            }}
          >
            <div className="hd" style={{ background: h?.g ?? '' }}>
              <div className="av" style={{ background: h?.a ?? '' }}>
                {avatar !== undefined && avatar !== '' ? <img src={avatar} alt={`${u.name}的头像`} draggable={false} /> : u.ini}
              </div>
            </div>
            <div className="bd">
              <div className="nm">{u.name}</div>
              <div className="qt">{u.quote}</div>
              <div className="stags">
                {u.tags.map((t) => (
                  <span className="stag" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
