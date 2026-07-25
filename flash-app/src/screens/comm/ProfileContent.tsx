import { useRef, useState } from 'react';
import { HUES } from '@/data/users';
import type { User } from '@/data/users';
import { profileMetaFor } from '@/data/profileMeta';
import { avatarForUserId } from './avatars';
import { profileServicesFor } from './services';
import type { ServiceId } from './services';
import ProfileStoryPanel from './ProfileStoryPanel';
import ProfileAdvicePanel from './ProfileAdvicePanel';
import ProfileServicePanel from './ProfileServicePanel';
import PublicPersona from './PublicPersona';
import ProfileModal from './ProfileModal';
import type { ModalState, ModalView } from './ProfileModal';

type ProfileTab = 'story' | 'advice' | 'service' | 'persona';

interface ProfileContentProps {
  user: User;
  unlocked: boolean;
  onUnlock: () => void;
  showToast: (msg: string) => void;
}

const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'story', label: 'TA 的故事' },
  { id: 'advice', label: '经验与建议' },
  { id: 'service', label: '可提供服务' },
  { id: 'persona', label: '数字人画像' },
];

/** Everything inside #profilePage below the top bar (原型 renderProfile). */
export default function ProfileContent({ user, unlocked, onUnlock, showToast }: ProfileContentProps) {
  const [tab, setTab] = useState<ProfileTab>('story');
  const [modal, setModal] = useState<ModalState | null>(null);
  const seqRef = useRef(0);

  const meta = profileMetaFor(user);
  const services = profileServicesFor(user);
  const hue = HUES[user.hue];
  const avatar = avatarForUserId(user.id);

  const openModal = (view: ModalView) => {
    seqRef.current += 1;
    setModal({ view, seq: seqRef.current });
  };
  const closeModal = () => {
    setModal(null);
  };
  const selectService = (id: ServiceId) => {
    openModal(id);
  };

  return (
    <>
      <div className="scroll" id="profileScroll" data-testid="profile-scroll">
        <div className="prof-hero">
          <div className="prof-row">
            <div className="prof-av" style={{ background: hue?.g ?? '' }}>
              {avatar !== '' ? <img src={avatar} alt={`${user.name}的头像`} /> : user.ini}
            </div>
            <div className="prof-id">
              <div className="prof-name-line">
                <h2>{user.name}</h2>
                <span className="prof-verified">经历已验证</span>
              </div>
              <p className="prof-loc">
                {meta.age} 岁 · {meta.city}
              </p>
            </div>
          </div>
          <div className="prof-transition">
            {meta.from}
            <i>→</i>
            {meta.to}
          </div>
          <div className="prof-years">
            {meta.years} · {meta.result}
          </div>
          <div className="prof-tags">
            {user.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>

        <div className="prof-tabs" role="tablist" aria-label="用户主页内容">
          {TABS.map((t) => (
            <button
              type="button"
              key={t.id}
              className={`prof-tab${tab === t.id ? ' on' : ''}`}
              role="tab"
              aria-selected={tab === t.id}
              data-testid={`prof-tab-${t.id}`}
              onClick={() => {
                setTab(t.id);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <ProfileStoryPanel user={user} meta={meta} on={tab === 'story'} />
        <ProfileAdvicePanel meta={meta} unlocked={unlocked} on={tab === 'advice'} />
        <ProfileServicePanel services={services} meta={meta} on={tab === 'service'} onSelect={selectService} />
        <PublicPersona user={user} on={tab === 'persona'} />
      </div>

      <div className="prof-paybar" id="profilePaybar">
        <button
          type="button"
          className="prof-paybtn"
          id="unlockProfileBtn"
          data-testid="prof-unlock"
          disabled={unlocked}
          onClick={() => {
            openModal('unlock');
          }}
        >
          {unlocked ? (
            <>
              完整经验已解锁 <strong>✓</strong>
            </>
          ) : (
            <>
              解锁完整经验 <strong>¥9.9</strong>
            </>
          )}
        </button>
        <button
          type="button"
          className="prof-paybtn primary"
          data-testid="prof-consult"
          onClick={() => {
            openModal('consult');
          }}
        >
          向她咨询 <strong>¥29</strong>
        </button>
      </div>

      <ProfileModal modal={modal} user={user} meta={meta} services={services} onClose={closeModal} onUnlock={onUnlock} showToast={showToast} />
    </>
  );
}
