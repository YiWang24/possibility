"use client";
/* 社区放映模式 —— 移植 iOS WatchModeView（原型 watch-mode）。
   无限错位平铺的圆形气泡舞台：拖拽平移、抬手惯性、停下就近吸附，
   搜索会把镜头推到最近的命中旅人；点击气泡进入该旅人主页。

   为什么位置不走 React state：平移每帧都在变，35 个气泡逐帧 re-render
   在中端机上必掉帧。这里只把「当前挂载哪些格子」交给 React（越过格边界
   才变一次），逐帧的 transform / opacity / z-index 直接写 DOM。 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Traveler } from "@/lib/models";
import { hue, mockAvatarById } from "@/lib/theme";
import {
  findSearchTarget,
  hasWatchMatch,
  visibleCells,
  watchMatches,
  watchPlacement,
  watchWorldPoint,
  WATCH_DX,
  WATCH_DY,
  type WatchCell,
} from "./watchGrid";

/** 判定成拖拽的位移阈值：小于它仍算点击，轻点不会误伤跳转 */
const DRAG_THRESHOLD = 4;
/** 惯性：初速 × 一帧时长，每帧衰减到 0.88，落到阈值以下转入吸附 */
const FLICK_SCALE = 16;
const INERTIA_DECAY = 0.88;
const INERTIA_STOP = 0.55;
/** 吸附：向目标做指数逼近，差值足够小时直接落位 */
const SNAP_LERP = 0.18;
const SNAP_STOP = 0.7;
/** 抬手后压制一次 click，避免甩动结束时误入主页 */
const CLICK_SUPPRESS_MS = 120;

interface Pan {
  x: number;
  y: number;
}

interface DragState {
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

type Motion =
  | { kind: "inertia"; mx: number; my: number }
  | { kind: "snap"; tx: number; ty: number };

export function WatchMode({ travelers, query }: { travelers: Traveler[]; query: string }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef(new Map<string, HTMLAnchorElement>());
  const panRef = useRef<Pan>({ x: 0, y: 0 });
  const cellsRef = useRef<WatchCell[]>([]);
  const signatureRef = useRef("");
  const travelersRef = useRef(travelers);
  const queryRef = useRef("");
  const dragRef = useRef<DragState | null>(null);
  const motionRef = useRef<Motion | null>(null);
  const rafRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const suppressTimerRef = useRef<number | null>(null);

  const [cells, setCells] = useState<WatchCell[]>([]);
  const [noMatch, setNoMatch] = useState(false);

  /* 把当前平移量写进 DOM。焦点＝离中心最近的可见气泡，同时承担
     roving tabindex：只有它可 Tab 到，键盘不必穿过 35 个半透明链接。 */
  const paint = useCallback(() => {
    const { x, y } = panRef.current;
    const q = queryRef.current;
    let focusKey: string | null = null;
    let focusDist = Infinity;
    for (const cell of cellsRef.current) {
      const node = nodesRef.current.get(cell.key);
      if (!node) continue;
      const place = watchPlacement(cell.wx, cell.wy, x, y);
      const hidden = !watchMatches(cell.traveler, q);
      node.style.transform = `translate(calc(-50% + ${place.dx}px), calc(-50% + ${place.dy}px)) scale(${place.scale})`;
      node.style.opacity = String(place.opacity);
      node.style.zIndex = String(100 - Math.round(place.dist / 10));
      node.classList.toggle("is-search-hidden", hidden);
      if (!hidden && place.dist < focusDist) {
        focusDist = place.dist;
        focusKey = cell.key;
      }
    }
    for (const [key, node] of nodesRef.current) {
      const on = key === focusKey;
      node.classList.toggle("is-focus", on);
      node.tabIndex = on ? 0 : -1;
    }
  }, []);

  /* 平移后同步：越过格边界才换一批挂载的格子，其余帧只重绘。
     新格子这一帧还没进 DOM，靠 cells 变更后的 layout effect 补painting。 */
  const sync = useCallback(
    (force = false) => {
      const { x, y } = panRef.current;
      const next = visibleCells(travelersRef.current, x, y);
      const signature = next.map((c) => c.key).join(",");
      if (force || signature !== signatureRef.current) {
        signatureRef.current = signature;
        cellsRef.current = next;
        setCells(next);
      }
      paint();
    },
    [paint],
  );

  const stopMotion = useCallback(() => {
    motionRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  /** 把 (x,y) 吸到最近气泡的中心；搜索态下只认命中项 */
  const nearestPanTo = useCallback((x: number, y: number): Pan | null => {
    const q = queryRef.current;
    let best: WatchCell | null = null;
    let bestDist = Infinity;
    for (const cell of visibleCells(travelersRef.current, x, y)) {
      if (!watchMatches(cell.traveler, q)) continue;
      const dist = Math.hypot(cell.wx + x, cell.wy + y);
      if (dist < bestDist) {
        bestDist = dist;
        best = cell;
      }
    }
    return best ? { x: -best.wx, y: -best.wy } : null;
  }, []);

  const runLoop = useCallback(() => {
    if (rafRef.current !== null) return;
    const step = () => {
      const motion = motionRef.current;
      if (!motion) {
        rafRef.current = null;
        return;
      }
      const pan = panRef.current;
      if (motion.kind === "inertia") {
        pan.x += motion.mx;
        pan.y += motion.my;
        motion.mx *= INERTIA_DECAY;
        motion.my *= INERTIA_DECAY;
        if (Math.abs(motion.mx) + Math.abs(motion.my) <= INERTIA_STOP) {
          const target = nearestPanTo(pan.x, pan.y);
          motionRef.current = target ? { kind: "snap", tx: target.x, ty: target.y } : null;
        }
      } else {
        pan.x += (motion.tx - pan.x) * SNAP_LERP;
        pan.y += (motion.ty - pan.y) * SNAP_LERP;
        if (Math.abs(motion.tx - pan.x) + Math.abs(motion.ty - pan.y) <= SNAP_STOP) {
          pan.x = motion.tx;
          pan.y = motion.ty;
          motionRef.current = null;
        }
      }
      sync();
      rafRef.current = motionRef.current === null ? null : requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [nearestPanTo, sync]);

  const glideTo = useCallback(
    (x: number, y: number) => {
      stopMotion();
      motionRef.current = { kind: "snap", tx: x, ty: y };
      runLoop();
    },
    [runLoop, stopMotion],
  );

  /* 拖拽：指针按下记基准，document 上跟移动 —— 手指滑出舞台也不断线。 */
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stopMotion();
    dragRef.current = {
      pointerId: event.pointerId,
      sx: event.clientX,
      sy: event.clientY,
      startX: panRef.current.x,
      startY: panRef.current.y,
      lx: event.clientX,
      ly: event.clientY,
      lt: performance.now(),
      vx: 0,
      vy: 0,
      moved: false,
    };
    stageRef.current?.classList.add("is-dragging");
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.sx;
      const dy = event.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) drag.moved = true;
      if (!drag.moved) return;
      const now = performance.now();
      // 下限 8ms：两次事件同一毫秒到达时速度会被除爆
      const dt = Math.max(8, now - drag.lt);
      drag.vx = (event.clientX - drag.lx) / dt;
      drag.vy = (event.clientY - drag.ly) / dt;
      drag.lx = event.clientX;
      drag.ly = event.clientY;
      drag.lt = now;
      panRef.current.x = drag.startX + dx;
      panRef.current.y = drag.startY + dy;
      sync();
      if (event.cancelable) event.preventDefault();
    };

    const onUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      stageRef.current?.classList.remove("is-dragging");
      if (!drag.moved) return;
      suppressClickRef.current = true;
      if (suppressTimerRef.current !== null) window.clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = window.setTimeout(() => {
        suppressClickRef.current = false;
        suppressTimerRef.current = null;
      }, CLICK_SUPPRESS_MS);
      motionRef.current = {
        kind: "inertia",
        mx: drag.vx * FLICK_SCALE,
        my: drag.vy * FLICK_SCALE,
      };
      runLoop();
    };

    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [runLoop, sync]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (suppressTimerRef.current !== null) window.clearTimeout(suppressTimerRef.current);
    },
    [],
  );

  /* 数据到位或搜索词变化：重排格子，并把镜头推到最近的命中旅人 */
  useEffect(() => {
    travelersRef.current = travelers;
    const q = query.trim().toLowerCase();
    queryRef.current = q;
    setNoMatch(q !== "" && travelers.length > 0 && !hasWatchMatch(travelers, q));
    const target = findSearchTarget(travelers, panRef.current.x, panRef.current.y, q);
    sync(true);
    if (target) {
      const { wx, wy } = watchWorldPoint(target.q, target.r);
      glideTo(-wx, -wy);
    }
  }, [travelers, query, sync, glideTo]);

  // 新挂载的格子在浏览器绘制前先落到正确位置，避免它们在中心闪一帧
  useLayoutEffect(() => {
    paint();
  }, [cells, paint]);

  /* 方向键按格平移 —— 拖拽是鼠标/触摸语义，键盘用户需要等价入口 */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, Pan> = {
      ArrowLeft: { x: -WATCH_DX, y: 0 },
      ArrowRight: { x: WATCH_DX, y: 0 },
      ArrowUp: { x: 0, y: -WATCH_DY },
      ArrowDown: { x: 0, y: WATCH_DY },
    };
    const delta = step[event.key];
    if (!delta) return;
    event.preventDefault();
    // 连按时从「上一次的落点」起跳，而不是从半途的插值位置
    const motion = motionRef.current;
    const baseX = motion?.kind === "snap" ? motion.tx : panRef.current.x;
    const baseY = motion?.kind === "snap" ? motion.ty : panRef.current.y;
    const wantX = baseX - delta.x;
    const wantY = baseY - delta.y;
    // 错位网格里横移一格并不落在整格上，落点再吸一次才有焦点气泡
    const target = nearestPanTo(wantX, wantY) ?? { x: wantX, y: wantY };
    glideTo(target.x, target.y);
  };

  const registerNode = (key: string) => (node: HTMLAnchorElement | null) => {
    if (node) nodesRef.current.set(key, node);
    else nodesRef.current.delete(key);
  };

  return (
    <div
      ref={stageRef}
      className="watch-stage"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      tabIndex={0}
      role="group"
      aria-label="旅人放映舞台，拖拽或使用方向键浏览"
    >
      {/* 渐隐 vignette 只罩这一层：提示语和空态留在外面，否则它们贴着边缘会被一起吃掉 */}
      <div className="watch-field">
        <div className="watch-kaleido" aria-hidden />
        <div className="watch-center-ring" aria-hidden />
        <div className="watch-grid">
          {cells.map((cell) => (
            <WatchBubble key={cell.key} cell={cell} ref={registerNode(cell.key)} />
          ))}
        </div>
      </div>
      <p className={`watch-empty${noMatch ? " is-shown" : ""}`} role="status">
        没有找到匹配旅人
        <br />
        换个关键词，或按方向键继续浏览
      </p>
      <p className="watch-hint">无限滑动浏览 · 点击卡片查看主页</p>
    </div>
  );
}

/* 单个气泡。玻璃底 + 色相辉光 + 流光内环 + 星点都在 .watch-user 的 CSS 里，
   这里只提供内容与 --watch-glow 色相。 */
function WatchBubble({
  cell,
  ref,
}: {
  cell: WatchCell;
  ref: (node: HTMLAnchorElement | null) => void;
}) {
  const traveler = cell.traveler;
  return (
    <Link
      ref={ref}
      href={`/traveler/${traveler.id}`}
      className="watch-user"
      style={{ "--watch-glow": hue(traveler.hue).accent } as React.CSSProperties}
      draggable={false}
      tabIndex={-1}
      aria-label={`${traveler.name}：${traveler.bio}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="watch-avatar" src={mockAvatarById(traveler.id)} alt="" draggable={false} />
      <span className="watch-name">{traveler.name}</span>
      <span className="watch-intro">{traveler.bio}</span>
      <span className="watch-tags">
        {traveler.tags.slice(0, 2).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </span>
    </Link>
  );
}
