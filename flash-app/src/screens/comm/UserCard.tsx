import type { KeyboardEvent } from 'react';
import { HUES } from '@/data/users';
import type { User } from '@/data/users';
import { avatarForUserId } from './avatars';

interface UserCardProps {
  user: User;
  onOpen: (id: number) => void;
}

/** 为你推荐 masonry card (原型 ucardHTML). */
export default function UserCard({ user, onOpen }: UserCardProps) {
  const hue = HUES[user.hue];
  const avatar = avatarForUserId(user.id);
  const open = () => {
    onOpen(user.id);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };

  return (
    <div className="ucard" role="button" tabIndex={0} data-testid={`ucard-${String(user.id)}`} onClick={open} onKeyDown={onKeyDown}>
      <div className="hd" style={{ background: hue?.g ?? '' }}>
        <div className="av" style={{ background: hue?.a ?? '' }}>
          {avatar !== '' ? <img src={avatar} alt={`${user.name}的头像`} draggable={false} /> : user.ini}
        </div>
      </div>
      <div className="bd">
        <div className="nm">{user.name}</div>
        <div className="qt">{user.quote}</div>
        <div className="stags">
          {user.tags.map((t) => (
            <span className="stag" key={t}>
              {t}
            </span>
          ))}
        </div>
        <div className="go">查看详情 ›</div>
      </div>
    </div>
  );
}
