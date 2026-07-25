// "我的" tab = 我的公开主页 (source: prototype #scr-me ~2123 + `renderMyProfile`
// ~5555). Hero card + four tabs (动态画像 / 我的故事 / 经验与建议 / 提供服务).

import type { ScreenProps } from './types';
import { useAppStore } from '@/store/appStore';
import { HUES } from '@/data/users';
import { useMyProfileStore, type EditMode, type MyTab } from './me/myProfileStore';
import { resolveAvatarSrc } from './me/avatars';
import MyPersonaPanel from './me/MyPersonaPanel';
import MyStoryPanel from './me/MyStoryPanel';
import MyAdvicePanel from './me/MyAdvicePanel';
import MyServicePanel from './me/MyServicePanel';

const TABS: readonly { id: MyTab; label: string }[] = [
  { id: 'persona', label: '动态画像' },
  { id: 'story', label: '我的故事' },
  { id: 'advice', label: '经验与建议' },
  { id: 'service', label: '提供服务' },
];

export default function MeScreen({ active }: ScreenProps) {
  const profile = useMyProfileStore((s) => s.myProfile);
  const mbti = useMyProfileStore((s) => s.mbti);
  const beginEdit = useMyProfileStore((s) => s.beginEdit);
  const tab = useMyProfileStore((s) => s.meTab);
  const setTab = useMyProfileStore((s) => s.setMeTab);
  const openPush = useAppStore((s) => s.openPush);

  const onEdit = (mode: EditMode): void => {
    beginEdit(mode);
    openPush('myEditPage');
  };

  const heroBackground = HUES[profile.hue]?.g ?? HUES[0]?.g ?? '';
  const { meta } = profile;

  return (
    <section className={`screen${active ? ' on' : ''}`} id="scr-me" data-testid="screen-me">
      <div className="me-profile-root" id="myProfileRoot">
        <div className="prof-hero">
          <div className="prof-row">
            <div className="prof-av" style={{ background: heroBackground }}>
              <img src={resolveAvatarSrc(profile.avatar)} alt={`${profile.name}的头像`} />
            </div>
            <div className="prof-id">
              <div className="prof-name-line">
                <h2>{profile.name}</h2>
                <span className="prof-verified">我的公开主页</span>
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
            {profile.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <button
            type="button"
            className="prof-edit-btn"
            data-testid="me-edit-basic"
            aria-label="编辑个人资料"
            title="编辑个人资料"
            onClick={() => {
              onEdit('basic');
            }}
          >
            <span aria-hidden="true">✎</span>
          </button>
        </div>

        <div className="prof-tabs my-prof-tabs" role="tablist" aria-label="我的主页内容">
          {TABS.map((entry) => (
            <button
              type="button"
              key={entry.id}
              className={`prof-tab${tab === entry.id ? ' on' : ''}`}
              role="tab"
              aria-selected={tab === entry.id}
              data-testid={`me-tab-${entry.id}`}
              onClick={() => {
                setTab(entry.id);
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <MyPersonaPanel profile={profile} mbti={mbti} active={tab === 'persona'} onEdit={onEdit} />
        <MyStoryPanel profile={profile} active={tab === 'story'} onEdit={onEdit} />
        <MyAdvicePanel profile={profile} active={tab === 'advice'} onEdit={onEdit} />
        <MyServicePanel profile={profile} active={tab === 'service'} onEdit={onEdit} />
      </div>
    </section>
  );
}
