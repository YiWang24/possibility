// Imperative layout + drag/inertia + search targeting for the watch grid.
// Faithful port of updateWatchCommunity / drag / inertia / snap / search
// (原型 ~4741-4853, 4710-4740). Operates on the DOM via refs, like the prototype.

import { HUES } from '@/data/users';
import type { User } from '@/data/users';
import { WATCH_COLS, WATCH_DX, WATCH_DY, WATCH_ROWS } from '@/data/community';
import { cachedWatchEntries, watchUserAt, watchUserMatches, watchWorldPoint } from './watchUsers';

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
  /** World-space position per slot. Previously lived in data-wx/data-wy attributes,
   *  which cost two attribute mutations per node per frame just to be read back here. */
  wx: Float64Array;
  wy: Float64Array;
  /** Last value pushed to the DOM per slot, so a frame only writes what actually changed. */
  cellQ: Float64Array;
  cellR: Float64Array;
  bound: Uint8Array;
  zIndex: Int32Array;
  hidden: Uint8Array;
  /** Slot currently carrying `.is-focus`, or -1. */
  focusSlot: number;
  x: number;
  y: number;
  drag: WatchDrag | null;
  raf: number | null;
  /** Pending coalescing frame for pointermove (see scheduleWatchUpdate). */
  tick: number | null;
  resetTimer: number | null;
  justDragged: boolean;
  query: string;
  panning: boolean;
}

export function createWatchState(stage: HTMLElement, buttons: HTMLButtonElement[], query: string): WatchState {
  const n = buttons.length;
  return {
    stage,
    buttons,
    wx: new Float64Array(n),
    wy: new Float64Array(n),
    cellQ: new Float64Array(n),
    cellR: new Float64Array(n),
    bound: new Uint8Array(n),
    zIndex: new Int32Array(n).fill(Number.MIN_SAFE_INTEGER),
    hidden: new Uint8Array(n),
    focusSlot: -1,
    x: 0,
    y: 0,
    drag: null,
    raf: null,
    tick: null,
    resetTimer: null,
    justDragged: false,
    query,
    panning: false,
  };
}

/**
 * Mark the wall as in motion for the whole drag → inertia → snap sequence.
 *
 * `.is-panning` switches off the per-node transition and focus filter. Those repaint all
 * 63 nodes whenever the centred card changes, which happens several times a second while
 * panning; full fidelity returns as soon as the wall settles.
 */
function setPanning(st: WatchState, on: boolean): void {
  if (st.panning === on) return;
  st.panning = on;
  st.stage.classList.toggle('is-panning', on);
}

/**
 * Run at most one layout pass per rendered frame.
 *
 * Touch panels sample well above the display refresh rate — a 2s drag delivered ~150
 * pointermove events against 27 painted frames, so the old synchronous call did the
 * whole 63-node pass five times over for every frame the user actually saw.
 */
function scheduleWatchUpdate(st: WatchState): void {
  if (st.tick !== null) return;
  st.tick = requestAnimationFrame(() => {
    st.tick = null;
    updateWatchCommunity(st);
  });
}

/** Fill a node's avatar/name/intro/tags once per (q,r) cell (原型 bindWatchCard). */
function bindWatchCard(st: WatchState, slot: number, btn: HTMLButtonElement, u: User, q: number, r: number): void {
  if (st.bound[slot] === 1 && st.cellQ[slot] === q && st.cellR[slot] === r) return;
  st.bound[slot] = 1;
  st.cellQ[slot] = q;
  st.cellR[slot] = r;
  btn.dataset['key'] = `${String(q)}:${String(r)}`;
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
  let nearest = -1;
  let minDist = Infinity;
  let matchCount = 0;
  const query = st.query.trim().toLowerCase();
  const searching = query !== '';
  const halfCols = Math.floor(WATCH_COLS / 2);
  const halfRows = Math.floor(WATCH_ROWS / 2);
  const centerQ = Math.round(-st.x / WATCH_DX);
  for (let dq = -halfCols; dq <= halfCols; dq++) {
    const q = centerQ + dq;
    const qOffset = (Math.abs(q) % 2) * (WATCH_DY / 2);
    const centerR = Math.round((-st.y - qOffset) / WATCH_DY);
    for (let dr = -halfRows; dr <= halfRows; dr++) {
      const i = slot;
      const btn = st.buttons[i];
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
      const match = !searching || watchUserMatches(u, query);
      bindWatchCard(st, i, btn, u, q, r);
      st.wx[i] = wx;
      st.wy[i] = wy;
      const hidden = match ? 0 : 1;
      if (st.hidden[i] !== hidden) {
        st.hidden[i] = hidden;
        btn.classList.toggle('is-search-hidden', !match);
      }
      // translate3d + a margin-centred node, so no calc() has to be re-parsed per frame.
      btn.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${scale.toFixed(4)})`;
      btn.style.opacity = opacity.toFixed(4);
      // z-index only picks paint order, and rewriting it re-sorts the stacking context.
      // Bucketing it coarsely keeps the same near-card-on-top look while leaving the
      // value untouched on most frames.
      const z = 100 - Math.round(dist / 40);
      if (st.zIndex[i] !== z) {
        st.zIndex[i] = z;
        btn.style.zIndex = String(z);
      }
      if (match) {
        matchCount++;
        if (dist < minDist) {
          minDist = dist;
          nearest = i;
        }
      }
    }
  }
  if (st.focusSlot !== nearest) {
    st.buttons[st.focusSlot]?.classList.remove('is-focus');
    if (nearest >= 0) st.buttons[nearest]?.classList.add('is-focus');
    st.focusSlot = nearest;
  }
  const empty = st.stage.querySelector('.watch-search-empty');
  if (empty) empty.classList.toggle('show', searching && matchCount === 0);
}

export function cancelWatchMotion(st: WatchState): void {
  if (st.raf !== null) {
    cancelAnimationFrame(st.raf);
    st.raf = null;
  }
  if (st.tick !== null) {
    cancelAnimationFrame(st.tick);
    st.tick = null;
  }
}

function findCommunitySearchTarget(st: WatchState, query: string): { q: number; r: number } | null {
  if (query === '') return null;
  let best: { q: number; r: number } | null = null;
  let bestDist = Infinity;
  for (const [key, u] of cachedWatchEntries()) {
    if (!watchUserMatches(u, query)) continue;
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
        if (watchUserMatches(u, query)) return { q, r };
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
  setPanning(st, false);
  return true;
}

function snapWatchCommunity(st: WatchState): void {
  let nearest = -1;
  let minDist = Infinity;
  for (let i = 0; i < st.buttons.length; i++) {
    if (st.hidden[i] === 1) continue;
    const dist = Math.hypot((st.wx[i] ?? 0) + st.x, (st.wy[i] ?? 0) + st.y);
    if (dist < minDist) {
      minDist = dist;
      nearest = i;
    }
  }
  if (nearest < 0) {
    const query = st.query.trim().toLowerCase();
    if (query !== '') centerCommunitySearchResult(st, query);
    setPanning(st, false);
    return;
  }
  const tx = -(st.wx[nearest] ?? 0);
  const ty = -(st.wy[nearest] ?? 0);
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
      setPanning(st, false);
    }
  };
  st.raf = requestAnimationFrame(step);
}

function runWatchInertia(st: WatchState, vx: number, vy: number): void {
  // A coalescing frame from the final pointermove may still be queued; from here the
  // inertia loop drives the updates, so let it not lay the grid out twice in one frame.
  if (st.tick !== null) {
    cancelAnimationFrame(st.tick);
    st.tick = null;
  }
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
  setPanning(st, true);
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
  scheduleWatchUpdate(st);
  e.preventDefault();
}

export function endWatchCommunity(st: WatchState, e: PointerEvent): void {
  const d = st.drag;
  if (!d || e.pointerId !== d.pointerId) return;
  st.drag = null;
  st.stage.classList.remove('dragging');
  if (!d.moved) {
    setPanning(st, false);
    return;
  }
  st.justDragged = true;
  if (st.resetTimer !== null) clearTimeout(st.resetTimer);
  st.resetTimer = window.setTimeout(() => {
    st.justDragged = false;
    st.resetTimer = null;
  }, 100);
  // Stays panning: inertia and the snap that follows are exactly when smoothness matters.
  runWatchInertia(st, d.vx, d.vy);
}
