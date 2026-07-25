import { useState } from 'react';

const COMM_TABS = ['为你推荐', '悬赏贴'];

const GRADIENT_HEADERS = [
  'linear-gradient(135deg, #3E77F2 0%, #B03390 100%)',
  'linear-gradient(135deg, #8F7BFF 0%, #2F63E8 100%)',
  'linear-gradient(135deg, #E35CC1 0%, #5E96FF 100%)',
  'linear-gradient(135deg, #3ED9A4 0%, #2F63E8 100%)',
  'linear-gradient(135deg, #FF7A4D 0%, #8F7BFF 100%)',
  'linear-gradient(135deg, #D7F464 20%, #3ED9A4 100%)',
];

interface UserCard {
  id: number;
  name: string;
  avatarColor: string;
  headerGradient: string;
  quote: string;
  tags: string[];
}

const USERS: UserCard[] = [
  { id: 1, name: '星辰旅人', avatarColor: '#6FA5FF', headerGradient: GRADIENT_HEADERS[0] ?? '', quote: '30岁从大厂裸辞转独立开发，这3年我经历了什么', tags: ['职业转型', '独立开发'] },
  { id: 2, name: '月色漫步', avatarColor: '#8F7BFF', headerGradient: GRADIENT_HEADERS[1] ?? '', quote: '原生家庭不好的人，如何建立健康的亲密关系？', tags: ['亲密关系', '成长'] },
  { id: 3, name: '清风明月', avatarColor: '#F06ACD', headerGradient: GRADIENT_HEADERS[2] ?? '', quote: '从焦虑到平静：每天15分钟正念冥想改变了我', tags: ['情绪管理', '冥想'] },
  { id: 4, name: '林间小鹿', avatarColor: '#3ED9A4', headerGradient: GRADIENT_HEADERS[3] ?? '', quote: '25岁拿到绿卡后，我反而陷入了迷茫期', tags: ['海外生活', '自我认知'] },
  { id: 5, name: '夜行者', avatarColor: '#FF7A4D', headerGradient: GRADIENT_HEADERS[4] ?? '', quote: '考研三战上岸，那些我不愿回忆的崩溃时刻', tags: ['考研', '坚持'] },
  { id: 6, name: '拾光者', avatarColor: '#D7F464', headerGradient: GRADIENT_HEADERS[5] ?? '', quote: '把兴趣变成收入：从零开始做自媒体的真实历程', tags: ['自媒体', '副业'] },
];

interface BountyItem {
  id: number;
  tags: string[];
  title: string;
  reward: number;
  replies: number;
}

const BOUNTIES: BountyItem[] = [
  { id: 1, tags: ['职业转型', '产品经理'], title: '设计师转产品经理，有没有过来人分享真实经历？', reward: 50, replies: 12 },
  { id: 2, tags: ['留学', '心理'], title: '留学期间严重焦虑，如何自救？', reward: 30, replies: 8 },
  { id: 3, tags: ['创业', '副业'], title: '月入2万的副业有哪些？想听真实案例', reward: 80, replies: 23 },
];

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');

  return (
    <div className="pb-4">
      {/* Tabs */}
      <div className="flex gap-5 items-baseline">
        {COMM_TABS.map((tab, i) => (
          <button
            key={tab}
            data-testid={`comm-tab-${String(i)}`}
            onClick={() => { setActiveTab(i); }}
            className="relative pb-[6px] transition-colors"
            style={{
              fontSize: activeTab === i ? '17px' : '15px',
              fontWeight: activeTab === i ? 700 : 400,
              color: activeTab === i ? 'var(--ink)' : 'var(--faint)',
            }}
          >
            {tab}
            {activeTab === i && (
              <span className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[18px] h-[3px] rounded-[2px]" style={{ background: 'var(--aurora)' }} />
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-[9px] mt-[13px] h-[44px] px-[14px] rounded-[16px] border transition-all"
        style={{
          background: 'rgba(17,22,37,0.55)',
          borderColor: 'rgba(207,224,255,0.12)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          type="text"
          placeholder="搜索用户、简介或标签"
          value={search}
          onChange={(e) => { setSearch(e.target.value); }}
          className="flex-1 bg-transparent border-none outline-none text-[12.5px] text-[var(--ink)] placeholder:text-[rgba(154,164,188,0.62)]"
        />
        {search.length > 0 && (
          <button
            onClick={() => { setSearch(''); }}
            className="w-[25px] h-[25px] rounded-full flex items-center justify-center text-[17px] text-[var(--sub)]"
            style={{ background: 'rgba(255,255,255,0.07)' }}
          >
            ×
          </button>
        )}
      </div>

      {/* Feed: tab 0 = recommend cards, tab 1 = bounties */}
      {activeTab === 0 ? (
        <div className="mt-4 columns-2 gap-[11px]">
          {USERS.map((user) => (
            <UserCardComp key={user.id} user={user} />
          ))}
        </div>
      ) : (
        <div className="mt-4 columns-2 gap-[11px]">
          {BOUNTIES.map((b) => (
            <BountyCard key={b.id} bounty={b} />
          ))}
        </div>
      )}

      {/* FAB - Kaleidoscope draw */}
      <button
        className="fixed right-5 bottom-[118px] z-40 flex items-center gap-2 px-5 py-[13px] rounded-full text-[13.5px] font-semibold text-white tracking-wider"
        style={{ background: 'var(--btn-g)', boxShadow: '0 12px 30px -8px rgba(79,125,255,0.65)' }}
      >
        <span className="w-5 h-5 rounded-full" style={{ background: 'conic-gradient(from 0deg, #5E96FF, #8F7BFF, #E35CC1, #FF7A4D, #5E96FF)' }} />
        抽一人
      </button>
    </div>
  );
}

function UserCardComp({ user }: { user: UserCard }) {
  return (
    <button
      data-testid={`ucard-${String(user.id)}`}
      className="break-inside-avoid mb-[11px] w-full text-left rounded-[20px] border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow-card)] overflow-hidden transition-transform active:scale-[0.97]"
    >
      {/* Header gradient */}
      <div className="h-16 relative" style={{ background: user.headerGradient }}>
        {/* Avatar */}
        <div
          className="absolute left-[14px] -bottom-4 w-10 h-10 rounded-full border-[3px] border-[var(--card)] flex items-center justify-center text-[15px] font-semibold text-white"
          style={{ background: user.avatarColor }}
        >
          {user.name.charAt(0)}
        </div>
      </div>
      {/* Body */}
      <div className="pt-[22px] px-[14px] pb-[14px]">
        <div className="text-[13.5px] font-semibold">{user.name}</div>
        <p className="text-[11.5px] text-[var(--sub)] leading-[1.7] mt-1.5 line-clamp-3">{user.quote}</p>
        <div className="flex flex-wrap gap-[5px] mt-2">
          {user.tags.map((tag) => (
            <span key={tag} className="text-[10px] text-[#9DBCFF] bg-[rgba(94,150,255,0.13)] px-2 py-[3px] rounded-full">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-2.5 text-[11.5px] text-[var(--blue)] font-medium">去看看 ›</div>
      </div>
    </button>
  );
}

function BountyCard({ bounty }: { bounty: BountyItem }) {
  return (
    <button
      data-testid={`bounty-${String(bounty.id)}`}
      className="break-inside-avoid mb-[11px] w-full text-left p-4 rounded-[20px] border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow-card)] transition-all active:scale-[0.98]"
    >
      <div className="flex flex-wrap gap-[5px]">
        {bounty.tags.map((tag) => (
          <span key={tag} className="text-[9.5px] text-[#AFC8FF] bg-[rgba(94,150,255,0.1)] px-[7px] py-1 rounded-full">
            {tag}
          </span>
        ))}
      </div>
      <h4 className="text-[13.5px] font-semibold leading-[1.65] mt-2.5">{bounty.title}</h4>
      <div className="flex items-end justify-between mt-3">
        <span className="text-[10.5px] text-[var(--apricot)]">
          <b className="text-[17px] mr-0.5">{bounty.reward}</b>积分
        </span>
        <span className="text-[10px] text-[var(--faint)]">{bounty.replies} 回答</span>
      </div>
    </button>
  );
}
