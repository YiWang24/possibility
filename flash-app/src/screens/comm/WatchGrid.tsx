import { useEffect, useRef } from 'react';
import { WATCH_COLS, WATCH_ROWS } from '@/data/community';
import { registerWatchProfileUser, watchUserAt } from './watchUsers';
import type { WatchState } from './watchMotion';
import {
  beginWatchCommunity,
  cancelWatchMotion,
  centerCommunitySearchResult,
  createWatchState,
  endWatchCommunity,
  moveWatchCommunity,
  updateWatchCommunity,
} from './watchMotion';

const NODE_INDICES = Array.from(Array(WATCH_COLS * WATCH_ROWS).keys());

interface WatchGridProps {
  query: string;
  onOpenUser: (id: number) => void;
}

/** 为你推荐 · 放映模式 infinite draggable grid (原型 watchCommunityHTML + initWatchCommunity). */
export default function WatchGrid({ query, onOpenUser }: WatchGridProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<WatchState | null>(null);
  const onOpenRef = useRef(onOpenUser);
  const queryRef = useRef(query);

  useEffect(() => {
    onOpenRef.current = onOpenUser;
  }, [onOpenUser]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const buttons = Array.from(stage.querySelectorAll<HTMLButtonElement>('.watch-user'));
    const st = createWatchState(stage, buttons, queryRef.current);
    stateRef.current = st;
    updateWatchCommunity(st);

    const onDown = (e: PointerEvent) => {
      beginWatchCommunity(st, e);
    };
    const onMove = (e: PointerEvent) => {
      moveWatchCommunity(st, e);
    };
    const onUp = (e: PointerEvent) => {
      endWatchCommunity(st, e);
    };
    const onClick = (e: MouseEvent) => {
      if (st.justDragged) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const target = e.target;
      if (!(target instanceof Element)) return;
      const card = target.closest<HTMLButtonElement>('.watch-user');
      const key = card?.dataset['key'];
      if (key === undefined) return;
      const parts = key.split(':');
      const u = watchUserAt(Number(parts[0]), Number(parts[1]));
      registerWatchProfileUser(u);
      onOpenRef.current(u.id);
    };

    stage.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    stage.addEventListener('click', onClick);

    return () => {
      cancelWatchMotion(st);
      if (st.resetTimer !== null) clearTimeout(st.resetTimer);
      stage.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      stage.removeEventListener('click', onClick);
      stateRef.current = null;
    };
  }, []);

  useEffect(() => {
    queryRef.current = query;
    const st = stateRef.current;
    if (!st) return;
    st.query = query;
    const q = query.trim().toLowerCase();
    if (q === '' || !centerCommunitySearchResult(st, q)) updateWatchCommunity(st);
  }, [query]);

  return (
    <div className="masonry watch-mode" id="commFeed" ref={stageRef} data-testid="watch-stage">
      <div className="watch-kaleido" />
      <div className="watch-center-ring" />
      <div className="watch-grid" id="watchGrid">
        {NODE_INDICES.map((i) => (
          <button type="button" className="watch-user" key={i} data-testid={`watch-node-${String(i)}`}>
            <img className="watch-avatar" alt="" draggable={false} />
            <span className="watch-name" />
            <span className="watch-intro" />
            <span className="watch-tags" />
          </button>
        ))}
      </div>
      <div className="watch-search-empty">
        没有找到匹配用户
        <br />
        试试“AI”“设计”或城市名称
      </div>
      <div className="watch-hint">无限滑动浏览 · 点击卡片查看主页</div>
    </div>
  );
}
