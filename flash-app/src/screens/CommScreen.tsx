import { useRef, useState } from 'react';
import type { ScreenProps } from './types';
import { useAppStore } from '@/store/appStore';
import { BOUNTIES } from '@/data/bounties';
import BountyCard from './comm/BountyCard';
import WatchGrid from './comm/WatchGrid';
import Kaleido from './comm/Kaleido';

type CommMode = 0 | 1;

function matches(values: string[], query: string): boolean {
  if (query === '') return true;
  return values.join(' ').toLowerCase().includes(query);
}

/** 03 · 万花筒社区 (原型 #scr-comm + commTab/renderComm/searchCommunity + drawfab). */
export default function CommScreen({ active }: ScreenProps) {
  const openPush = useAppStore((s) => s.openPush);
  const [mode, setMode] = useState<CommMode>(0);
  const [queries, setQueries] = useState<[string, string]>(['', '']);
  const [kal, setKal] = useState<{ open: boolean; seq: number }>({ open: false, seq: 0 });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const raw = queries[mode];
  const query = raw.trim().toLowerCase();

  const openProfile = (userId: number) => {
    openPush('profilePage', { userId });
  };
  const openBounty = (id: number) => {
    // The store's PushPayload has no bounty field; reuse `question` to carry the id.
    openPush('bountyPage', { question: String(id) });
  };
  const openKal = () => {
    setKal((k) => ({ open: true, seq: k.seq + 1 }));
  };
  const closeKal = () => {
    setKal((k) => ({ ...k, open: false }));
  };

  const setQuery = (value: string) => {
    setQueries((prev) => (mode === 0 ? [value, prev[1]] : [prev[0], value]));
  };
  const clearSearch = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const bounties = BOUNTIES.filter((b) => matches([b.q, ...b.tags, b.amount, b.goal, b.n, b.asker, b.city, b.detail], query));
  const feedClass = query !== '' ? 'masonry bounty-search-mode' : 'masonry';

  return (
    <section className={`screen${active ? ' on' : ''}`} id="scr-comm" data-testid="screen-comm">
      <div className="comm-tabs" id="commTabs">
        <button
          type="button"
          className={mode === 0 ? 'on' : undefined}
          data-testid="comm-tab-recommend"
          onClick={() => {
            setMode(0);
          }}
        >
          为你推荐
        </button>
        <button
          type="button"
          className={mode === 1 ? 'on' : undefined}
          data-testid="comm-tab-bounty"
          onClick={() => {
            setMode(1);
          }}
        >
          悬赏贴
        </button>
      </div>

      <div className="comm-search">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          ref={inputRef}
          id="commSearch"
          type="search"
          autoComplete="off"
          aria-label="搜索社区内容"
          data-testid="comm-search-input"
          placeholder={mode === 0 ? '搜索用户、简介或标签' : '搜索悬赏问题或关键词'}
          value={raw}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
        />
        <button
          type="button"
          id="commSearchClear"
          className={raw !== '' ? 'show' : undefined}
          aria-label="清空搜索"
          data-testid="comm-search-clear"
          onClick={clearSearch}
        >
          ×
        </button>
      </div>

      {mode === 0 ? (
        <WatchGrid query={queries[0]} onOpenUser={openProfile} />
      ) : (
        <div className={feedClass} id="commFeed">
          {bounties.length > 0 ? (
            bounties.map((b) => <BountyCard key={b.id} bounty={b} onOpen={openBounty} />)
          ) : (
            <div className="comm-empty">
              <b>没有找到相关悬赏</b>换个关键词再试试
            </div>
          )}
        </div>
      )}

      <button type="button" className="drawfab show" id="drawfab" data-testid="comm-drawfab" onClick={openKal}>
        <span className="miniorb" />
        随机抽取
      </button>

      <Kaleido key={kal.seq} open={kal.open} onClose={closeKal} onOpenUser={openProfile} />
    </section>
  );
}
