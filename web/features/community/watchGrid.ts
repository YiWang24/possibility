/* 放映模式无限网格的纯计算层 —— 移植 iOS WatchModeView（原型 watch-mode）。
   哈希、步距、焦点衰减都与 iOS 逐位一致：同一格 (q,r) 在两端映射到同一位旅人，
   截图与 UI 走查才能对得上。这里不碰 DOM，方便单独推演坐标。 */

import type { Traveler } from "@/lib/models";

/** 错位网格步距（iOS WatchModeView.dx / .dy） */
export const WATCH_DX = 160;
export const WATCH_DY = 184;
/** 可见窗口 9×5。列数比 iOS 的 7 多一对：桌面舞台宽 1120px（半宽 560），
    7 列只铺到 ±480+57，两侧会各留一条永远没有气泡的暗带。 */
export const WATCH_COLS = 9;
export const WATCH_ROWS = 5;

/** 焦点衰减半径：离舞台中心越远越小越淡，460px 外落到最小档 */
const FOCUS_RADIUS = 460;
const MIN_SCALE = 0.62;
const SCALE_SPAN = 0.58;
const MIN_OPACITY = 0.28;
const OPACITY_SPAN = 0.72;

/** 搜索重定位时向外扫描的最大环数（iOS recenterOnSearch 同值） */
const SEARCH_MAX_RADIUS = 10;

export interface WatchCell {
  /** "q:r" —— 同时充当 React key 与 DOM 节点索引 */
  key: string;
  q: number;
  r: number;
  /** 世界坐标（与平移量相加即得屏幕相对中心的偏移） */
  wx: number;
  wy: number;
  traveler: Traveler;
}

export interface WatchPlacement {
  /** 相对舞台中心的偏移 */
  dx: number;
  dy: number;
  dist: number;
  scale: number;
  opacity: number;
}

/** 32 位整数哈希（iOS WatchModeView.hash / 原型 watchHash，salt 固定 0） */
export function watchHash(q: number, r: number): number {
  let h = Math.imul(q, 73856093) ^ Math.imul(r, 19349663) ^ 83492791;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** 世界坐标：奇数列整体下移半格，形成错落蜂窝而不是死板方阵 */
export function watchWorldPoint(q: number, r: number): { wx: number; wy: number } {
  return { wx: q * WATCH_DX, wy: r * WATCH_DY + (Math.abs(q) % 2) * (WATCH_DY / 2) };
}

/** 格子 → 旅人。确定性映射，来回滑动看到的还是同一个人 */
export function travelerAt(travelers: Traveler[], q: number, r: number): Traveler | null {
  if (travelers.length === 0) return null;
  return travelers[watchHash(q, r) % travelers.length] ?? null;
}

/** 搜索匹配字段与卡片流一致（姓名 / 一句话 / 简介 / 标签） */
export function watchMatches(traveler: Traveler, query: string): boolean {
  if (query === "") return true;
  return [traveler.name, traveler.quote, traveler.bio, ...traveler.tags]
    .join(" ")
    .toLowerCase()
    .includes(query.toLowerCase());
}

/** 平移量 (x,y) 下应当挂载的格子。列的行基准各算各的 —— 奇数列被半格偏移抬高，
    共用一个 centerR 会让边缘列在滑动中提前空出来。 */
export function visibleCells(travelers: Traveler[], x: number, y: number): WatchCell[] {
  const cells: WatchCell[] = [];
  if (travelers.length === 0) return cells;
  const centerQ = Math.round(-x / WATCH_DX);
  const halfCols = Math.floor(WATCH_COLS / 2);
  const halfRows = Math.floor(WATCH_ROWS / 2);
  for (let dq = -halfCols; dq <= halfCols; dq++) {
    const q = centerQ + dq;
    const qOffset = (Math.abs(q) % 2) * (WATCH_DY / 2);
    const centerR = Math.round((-y - qOffset) / WATCH_DY);
    for (let dr = -halfRows; dr <= halfRows; dr++) {
      const r = centerR + dr;
      const traveler = travelerAt(travelers, q, r);
      if (!traveler) continue;
      const { wx, wy } = watchWorldPoint(q, r);
      cells.push({ key: `${q}:${r}`, q, r, wx, wy, traveler });
    }
  }
  return cells;
}

/** 单个气泡的位置与视觉衰减 */
export function watchPlacement(wx: number, wy: number, x: number, y: number): WatchPlacement {
  const dx = wx + x;
  const dy = wy + y;
  const dist = Math.hypot(dx, dy);
  const focus = Math.max(0, 1 - dist / FOCUS_RADIUS);
  return {
    dx,
    dy,
    dist,
    scale: MIN_SCALE + focus * SCALE_SPAN,
    opacity: MIN_OPACITY + focus * OPACITY_SPAN,
  };
}

/** 旅人集合里是否存在匹配项 —— 用于「没有找到匹配旅人」空态与提前退出环扫描 */
export function hasWatchMatch(travelers: Traveler[], query: string): boolean {
  if (query === "") return true;
  return travelers.some((t) => watchMatches(t, query));
}

/** 从当前中心一圈圈向外找最近的命中格（iOS recenterOnSearch）。
    先扫完整环再取环内最近的一格，避免扫描顺序把镜头甩到同环的另一侧。 */
export function findSearchTarget(
  travelers: Traveler[],
  x: number,
  y: number,
  query: string,
): { q: number; r: number } | null {
  if (query === "" || !hasWatchMatch(travelers, query)) return null;
  const centerQ = Math.round(-x / WATCH_DX);
  for (let radius = 0; radius <= SEARCH_MAX_RADIUS; radius++) {
    let best: { q: number; r: number } | null = null;
    let bestDist = Infinity;
    for (let q = centerQ - radius; q <= centerQ + radius; q++) {
      /* 行基准必须按列各算各的。奇数列整体下移半格，用同一个 centerR 的话
         ——而镜头有一半时间正停在奇数列的气泡上——Math.round(r + 0.5) 会多进一位，
         第 0 环扫的是中心气泡下面那一行，搜索重定位于是白跳一格。 */
      const qOffset = (Math.abs(q) % 2) * (WATCH_DY / 2);
      const centerR = Math.round((-y - qOffset) / WATCH_DY);
      for (let r = centerR - radius; r <= centerR + radius; r++) {
        // 只看这一环的边框，内部格子上一轮已经扫过
        if (radius !== 0 && Math.abs(q - centerQ) !== radius && Math.abs(r - centerR) !== radius) {
          continue;
        }
        const traveler = travelerAt(travelers, q, r);
        if (!traveler || !watchMatches(traveler, query)) continue;
        const { wx, wy } = watchWorldPoint(q, r);
        const dist = Math.hypot(wx + x, wy + y);
        if (dist < bestDist) {
          bestDist = dist;
          best = { q, r };
        }
      }
    }
    if (best) return best;
  }
  return null;
}
