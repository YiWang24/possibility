// Imperative layout + drag/inertia + search targeting for the watch grid.
// Faithful port of updateWatchCommunity / drag / inertia / snap / search
// (原型 ~4741-4853, 4710-4740). Operates on the DOM via refs, like the prototype.

import { HUES } from '@/data/users';
import type { User } from '@/data/users';
import { WATCH_COLS, WATCH_DX, WATCH_DY, WATCH_ROWS } from '@/data/community';
import { cachedWatchEntries, communityTextMatches, watchSearchValues, watchUserAt, watchWorldPoint } from './watchUsers';

export interface WatchDrag {
  pointerId: number;
  sx: number;
  sy: number;
  startX: number;
  startY: number;
  lx: number;
  ly: number;
  lt: number;
  vx: number;
  vy: number;
  moved: boolean;
}

export interface WatchState {
  stage: HTMLElement;
  buttons: HTMLButtonElement[];
  x: number;
  y: number;
  drag: WatchDrag | null;
  raf: number | null;
  resetTimer: number | null;
  justDragged: boolean;
  query: string;
}

/** Fill a node's avatar/name/intro/tags once per (q,r) key (原型 bindWatchCard). */
function bindWatchCard(btn: HTMLButtonElement, u: User, key: string): void {
  if (btn.dataset['key'] === key) return;
  btn.dataset['key'] = key;
  btn.style.setProperty('--watch-glow', HUES[u.hue]?.a ?? '#5E96FF');
  const avatar = btn.querySelector('.watch-avatar');
  if (avatar instanceof HTMLImageElement) {
    avatar.src = u.avatar ?? '';
    avatar.alt = `${u.name}的头像`;
  }
  const name = btn.querySelector('.watch-name');
  if (name) name.textContent = u.name;
  const intro = btn.querySelector('.watch-intro');
  if (intro) intro.textContent = u.bio;
  const tags = btn.querySelector('.watch-tags');
  if (tags) {
    tags.replaceChildren(
      ...u.tags.map((t) => {
        const span = document.createElement('span');
        span.textContent = t;
        return span;
      }),
    );
  }
}

/** Reposition every node around the current pan offset (原型 updateWatchCommunity). */
export function updateWatchCommunity(st: WatchState): void {
  let slot = 0;
  let nearest: HTMLButtonElement | null = null;
  let minDist = Infinity;
  let matchCount = 0;
  const query = st.query.trim().toLowerCase();
  const centerQ = Math.round(-st.x / WATCH_DX);
  for (let dq = -Math.floor(WATCH_COLS / 2); dq <= Math.floor(WATCH_COLS / 2); dq++) {
    const q = centerQ + dq;
    const qOffset = (Math.abs(q) % 2) * (WATCH_DY / 2);
    const centerR = Math.round((-st.y - qOffset) / WATCH_DY);
    for (let dr = -Math.floor(WATCH_ROWS / 2); dr <= Math.floor(WATCH_ROWS / 2); dr++) {
      const btn = st.buttons[slot];
      slot++;
      if (!btn) continue;
      const r = centerR + dr;
      const wx = q * WATCH_DX;
      const wy = r * WATCH_DY + qOffset;
      const x = wx + st.x;
      const y = wy + st.y;
      const dist = Math.hypot(x, y);
      const focus = Math.max(0, 1 - dist / 460);
      const scale = 0.62 + focus * 0.58;
      const opacity = 0.28 + focus * 0.72;
      const u = watchUserAt(q, r);
      const match = communityTextMatches(watchSearchValues(u), query);
      bindWatchCard(btn, u, `${String(q)}:${String(r)}`);
      btn.classList.toggle('is-search-hidden', !match);
      btn.dataset['wx'] = String(wx);
      btn.dataset['wy'] = String(wy);
      btn.style.transform = `translate(calc(-50% + ${String(x)}px), calc(-50% + ${String(y)}px)) scale(${String(scale)})`;
      btn.style.opacity = String(opacity);
      btn.style.zIndex = String(100 - Math.round(dist / 10));
      if (match) {
        matchCount++;
        if (dist < minDist) {
          minDist = dist;
          nearest = btn;
        }
      }
    }
  }
  for (const btn of st.buttons) btn.classList.toggle('is-focus', btn === nearest);
  const empty = st.stage.querySelector('.watch-search-empty');
  if (empty) empty.classList.toggle('show', query !== '' && matchCount === 0);
}

export function cancelWatchMotion(st: WatchState): void {
  if (st.raf !== null) {
    cancelAnimationFrame(st.raf);
    st.raf = null;
  }
}

function findCommunitySearchTarget(st: WatchState, query: string): { q: number; r: number } | null {
  if (query === '') return null;
  let best: { q: number; r: number } | null = null;
  let bestDist = Infinity;
  for (const [key, u] of cachedWatchEntries()) {
    if (!communityTextMatches(watchSearchValues(u), query)) continue;
    const parts = key.split(':');
    const q = Number(parts[0]);
    const r = Number(parts[1]);
    const p = watchWorldPoint(q, r);
    const dist = Math.hypot(p.wx + st.x, p.wy + st.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = { q, r };
    }
  }
  if (best) return best;
  const centerQ = Math.round(-st.x / WATCH_DX);
  const centerR = Math.round(-st.y / WATCH_DY);
  for (let radius = 0; radius <= 10; radius++) {
    for (let q = centerQ - radius; q <= centerQ + radius; q++) {
      for (let r = centerR - radius; r <= centerR + radius; r++) {
        if (radius !== 0 && Math.abs(q - centerQ) !== radius && Math.abs(r - centerR) !== radius) continue;
        const u = watchUserAt(q, r);
        if (communityTextMatches(watchSearchValues(u), query)) return { q, r };
      }
    }
  }
  return null;
}

/** Pan so the nearest matching member is centered (原型 centerCommunitySearchResult). */
export function centerCommunitySearchResult(st: WatchState, query: string): boolean {
  const target = findCommunitySearchTarget(st, query);
  if (!target) return false;
  const p = watchWorldPoint(target.q, target.r);
  cancelWatchMotion(st);
  st.x = -p.wx;
  st.y = -p.wy;
  updateWatchCommunity(st);
  return true;
}

function snapWatchCommunity(st: WatchState): void {
  let nearest: HTMLButtonElement | null = null;
  let minDist = Infinity;
  for (const btn of st.buttons) {
    if (btn.classList.contains('is-search-hidden')) continue;
    const dist = Math.hypot(Number(btn.dataset['wx']) + st.x, Number(btn.dataset['wy']) + st.y);
    if (dist < minDist) {
      minDist = dist;
      nearest = btn;
    }
  }
  if (!nearest) {
    const query = st.query.trim().toLowerCase();
    if (query !== '') centerCommunitySearchResult(st, query);
    return;
  }
  const tx = -Number(nearest.dataset['wx']);
  const ty = -Number(nearest.dataset['wy']);
  const step = (): void => {
    st.x += (tx - st.x) * 0.18;
    st.y += (ty - st.y) * 0.18;
    updateWatchCommunity(st);
    if (Math.abs(tx - st.x) + Math.abs(ty - st.y) > 0.7) st.raf = requestAnimationFrame(step);
    else {
      st.x = tx;
      st.y = ty;
      updateWatchCommunity(st);
      st.raf = null;
    }
  };
  st.raf = requestAnimationFrame(step);
}

function runWatchInertia(st: WatchState, vx: number, vy: number): void {
  let mx = vx * 16;
  let my = vy * 16;
  const step = (): void => {
    st.x += mx;
    st.y += my;
    mx *= 0.88;
    my *= 0.88;
    updateWatchCommunity(st);
    if (Math.abs(mx) + Math.abs(my) > 0.55) st.raf = requestAnimationFrame(step);
    else {
      st.raf = null;
      snapWatchCommunity(st);
    }
  };
  st.raf = requestAnimationFrame(step);
}

export function beginWatchCommunity(st: WatchState, e: PointerEvent): void {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  cancelWatchMotion(st);
  st.drag = {
    pointerId: e.pointerId,
    sx: e.clientX,
    sy: e.clientY,
    startX: st.x,
    startY: st.y,
    lx: e.clientX,
    ly: e.clientY,
    lt: performance.now(),
    vx: 0,
    vy: 0,
    moved: false,
  };
  st.stage.classList.add('dragging');
}

export function moveWatchCommunity(st: WatchState, e: PointerEvent): void {
  const d = st.drag;
  if (!d || e.pointerId !== d.pointerId) return;
  const dx = e.clientX - d.sx;
  const dy = e.clientY - d.sy;
  if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
  if (!d.moved) return;
  const now = performance.now();
  const dt = Math.max(8, now - d.lt);
  d.vx = (e.clientX - d.lx) / dt;
  d.vy = (e.clientY - d.ly) / dt;
  d.lx = e.clientX;
  d.ly = e.clientY;
  d.lt = now;
  st.x = d.startX + dx;
  st.y = d.startY + dy;
  updateWatchCommunity(st);
  e.preventDefault();
}

export function endWatchCommunity(st: WatchState, e: PointerEvent): void {
  const d = st.drag;
  if (!d || e.pointerId !== d.pointerId) return;
  st.drag = null;
  st.stage.classList.remove('dragging');
  if (d.moved) {
    st.justDragged = true;
    if (st.resetTimer !== null) clearTimeout(st.resetTimer);
    st.resetTimer = window.setTimeout(() => {
      st.justDragged = false;
      st.resetTimer = null;
    }, 100);
    runWatchInertia(st, d.vx, d.vy);
  }
}
