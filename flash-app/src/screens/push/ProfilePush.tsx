import { useState } from 'react';
import { useAppStore, usePushOpen, usePushPayload } from '@/store/appStore';
import { USERS } from '@/data/users';
import ProfileContent from '../comm/ProfileContent';
import { getWatchProfileUser } from '../comm/watchUsers';

/** 用户主页 push (原型 #profilePage + openProfile/renderProfile). */
export default function ProfilePush() {
  const open = usePushOpen('profilePage');
  const payload = usePushPayload('profilePage');
  const closePush = useAppStore((s) => s.closePush);
  const showToast = useAppStore((s) => s.showToast);
  // Unlocked full-experience ids persist across users (原型 unlockedProfileIds).
  const [unlockedIds, setUnlockedIds] = useState<Set<number>>(() => new Set());

  // Resolve seeded USERS first, then procedural watch users, then a safe default.
  const userId = payload.userId;
  const user = (userId === undefined ? undefined : (USERS.find((u) => u.id === userId) ?? getWatchProfileUser(userId))) ?? USERS[0];
  if (!user) return null;

  const unlock = () => {
    setUnlockedIds((prev) => {
      const next = new Set(prev);
      next.add(user.id);
      return next;
    });
  };

  return (
    <section className={`push${open ? ' open' : ''}`} id="profilePage" data-testid="push-profilePage">
      <div className="top">
        <button
          type="button"
          className="backbtn"
          data-testid="push-profilePage-back"
          aria-label="返回"
          onClick={() => {
            closePush('profilePage');
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="prof-top-copy">
          <h2 id="profileTopName">{user.name}</h2>
          <p className="sub2">真实经历 · 已验证</p>
        </div>
        <button
          type="button"
          className="prof-top-more"
          data-testid="push-profilePage-more"
          aria-label="更多操作"
          onClick={() => {
            showToast('更多操作：分享主页 · 举报 · 屏蔽');
          }}
        >
          ···
        </button>
      </div>
      <ProfileContent key={user.id} user={user} unlocked={unlockedIds.has(user.id)} onUnlock={unlock} showToast={showToast} />
    </section>
  );
}
