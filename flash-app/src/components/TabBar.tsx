import type { TabId } from '@/App';

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="8.6" r="3.6" />
      <path d="M5 20.2c1.1-3.5 3.8-5.3 7-5.3s5.9 1.8 7 5.3" />
    </svg>
  );
}
function IconLab() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 3h5M10.5 3v5.2L5.4 17a2.4 2.4 0 0 0 2.1 3.6h9a2.4 2.4 0 0 0 2.1-3.6l-5.1-8.8V3" />
      <path d="M7.5 14.5h9" />
    </svg>
  );
}
function IconComm() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 3.4v17.2M4.6 7.7l14.8 8.6M4.6 16.3L19.4 7.7" />
    </svg>
  );
}
function IconMe() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.3 20c1-3.7 3.6-5.6 6.7-5.6s5.7 1.9 6.7 5.6" />
      <path d="M18.5 4.5l1 1 2-2" />
    </svg>
  );
}

const tabs: { id: TabId; label: string; Icon: () => JSX.Element }[] = [
  { id: 'home', label: '认识自己', Icon: IconHome },
  { id: 'lab', label: '人生实验室', Icon: IconLab },
  { id: 'comm', label: '万花筒社区', Icon: IconComm },
  { id: 'me', label: '我的', Icon: IconMe },
];

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav
      className="tab-bar flex-none flex items-center justify-around"
      data-testid="tab-bar"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => { onTabChange(tab.id); }}
            className="flex flex-col items-center gap-[2px] px-2 py-1 transition-colors"
            style={{ color: isActive ? 'var(--ink)' : 'var(--faint)' }}
          >
            <tab.Icon />
            <span className="text-[10.5px] tracking-[0.12em]" style={{ fontWeight: isActive ? 600 : 400 }}>
              {tab.label}
            </span>
            <span
              className="w-1 h-1 rounded-full mt-[2px] transition-opacity"
              style={{ background: 'var(--blue)', opacity: isActive ? 1 : 0 }}
            />
          </button>
        );
      })}
    </nav>
  );
}
