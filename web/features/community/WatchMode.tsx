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
/** 惯性：初速 × 一帧时长，衰减到 0.88/帧，落到阈值以下转入吸附 */
const FLICK_SCALE = 16;
const INERTIA_DECAY = 0.88;
const INERTIA_STOP = 0.55;
/** 吸附：向目标做指数逼近，差值足够小时直接落位 */
const SNAP_LERP = 0.18;
const SNAP_STOP = 0.7;
/** 抬手后压制一次 click，避免甩动结束时误入主页 */
const CLICK_SUPPRESS_MS = 120;
/** 衰减与插值的基准帧长。实际帧长按它归一，120Hz 屏才不会把整段动画跑快一倍 */
const FRAME_MS = 1000 / 60;
/** 单帧归一化上限：切后台再回来时 rAF 会攒出一个巨大的 delta，不能让它一次跳完 */
const MAX_FRAMES_PER_TICK = 4;
/** 松手前静止超过这个时长就不算甩动 —— 拖到位停一下再松手应当停在原地 */
const FLICK_MAX_AGE_MS = 90;

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
  const reduceMotionRef = useRef(false);
  /** 键盘操作中：只有这时才让真实 DOM 焦点跟着高亮气泡走，免得拖拽时抢焦点 */
  const keyboardRef = useRef(false);
  /** 上一次真正生效过的搜索词，用来区分「搜索变了」和「旅人列表到货了」 */
  const lastQueryRef = useRef<string | null>(null);

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
      // 淡出的气泡还留在 DOM 里，不摘出无障碍树的话读屏会念出 35 位旅人，
      // 其中多数既看不见也点不了
      if (hidden) node.setAttribute("aria-hidden", "true");
      else node.removeAttribute("aria-hidden");
      if (!hidden && place.dist < focusDist) {
        focusDist = place.dist;
        focusKey = cell.key;
      }
    }
    for (const [key, node] of nodesRef.current) {
      const on = key === focusKey;
      node.classList.toggle("is-focus", on);
      node.tabIndex = on && !node.classList.contains("is-search-hidden") ? 0 : -1;
      /* 只改 tabIndex 不移动 DOM 焦点的话：焦点环留在原来那颗气泡上，回车打开的
         是按方向键之前的那位旅人；等原节点被 7×5 窗口卸载，焦点直接掉回 body，
         方向键就变成滚页面了。所以键盘操作期间让真实焦点跟着高亮走。 */
      if (on && keyboardRef.current && document.activeElement !== node) {
        node.focus({ preventScroll: true });
      }
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
    let bestDy = Infinity;
    for (const cell of visibleCells(travelersRef.current, x, y)) {
      if (!watchMatches(cell.traveler, q)) continue;
      const dist = Math.hypot(cell.wx + x, cell.wy + y);
      const dy = Math.abs(cell.wy + y);
      /* 横移一格会落在两颗气泡的正中间（相邻列错开半行，距离严格相等）。
         纯按 dist 比大小时平局由遍历顺序决定，于是「只按左右方向键」也会
         每次顺带把镜头抬高半行。平局时改取纵向偏移更小的那颗，横移就只横移。 */
      const closer = dist < bestDist - 0.001;
      const tie = Math.abs(dist - bestDist) <= 0.001 && dy < bestDy;
      if (closer || tie) {
        bestDist = dist;
        bestDy = dy;
        best = cell;
      }
    }
    return best ? { x: -best.wx, y: -best.wy } : null;
  }, []);

  /** 停下时的落点：优先就近整格；搜索命中全在窗口外时把镜头拉回最近的命中项
      （原型 snapWatchCommunity 的 !nearest 分支，移植时漏了 —— 少了它，
      拖到没有命中的区域后气泡全淡出且再也吸不回来）。 */
  const settleTargetFrom = useCallback((x: number, y: number): Pan | null => {
    const near = nearestPanTo(x, y);
    if (near) return near;
    const q = queryRef.current;
    if (q === "") return null;
    const hit = findSearchTarget(travelersRef.current, x, y, q);
    if (!hit) return null;
    const { wx, wy } = watchWorldPoint(hit.q, hit.r);
    return { x: -wx, y: -wy };
  }, [nearestPanTo]);

  /* 衰减和插值都按「多少个 60Hz 帧」算，而不是「多少帧」——
     iOS 版把定时器步进压到 8ms 换算衰减，也是为了 ProMotion 上总位移不变。
     这里照做：120Hz 屏每帧 frames≈0.5，衰减开方，滑行距离与时长都跟 60Hz 一致。 */
  const runLoop = useCallback(() => {
    if (rafRef.current !== null) return;
    let last = performance.now();
    const step = (now: number) => {
      const motion = motionRef.current;
      if (!motion) {
        rafRef.current = null;
        return;
      }
      const frames = Math.min(MAX_FRAMES_PER_TICK, Math.max(0.2, (now - last) / FRAME_MS));
      last = now;
      const pan = panRef.current;
      if (motion.kind === "inertia") {
        pan.x += motion.mx * frames;
        pan.y += motion.my * frames;
        const decay = INERTIA_DECAY ** frames;
        motion.mx *= decay;
        motion.my *= decay;
        if (Math.abs(motion.mx) + Math.abs(motion.my) <= INERTIA_STOP) {
          const target = settleTargetFrom(pan.x, pan.y);
          motionRef.current = target ? { kind: "snap", tx: target.x, ty: target.y } : null;
        }
      } else {
        const lerp = 1 - (1 - SNAP_LERP) ** frames;
        pan.x += (motion.tx - pan.x) * lerp;
        pan.y += (motion.ty - pan.y) * lerp;
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
  }, [settleTargetFrom, sync]);

  /** 移到 (x,y)。降低动态效果时直接落位 —— 滑行是本页最大的一段运动，
      光靠样式表里的 prefers-reduced-motion 只能停下背景那圈弧。 */
  const glideTo = useCallback(
    (x: number, y: number) => {
      stopMotion();
      if (reduceMotionRef.current) {
        panRef.current.x = x;
        panRef.current.y = y;
        sync();
        return;
      }
      motionRef.current = { kind: "snap", tx: x, ty: y };
      runLoop();
    },
    [runLoop, stopMotion, sync],
  );

  /* 拖拽：指针按下记基准，document 上跟移动 —— 手指滑出舞台也不断线。 */
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    /* 第二根手指（手掌、另一只拇指、捏合的起手）不能顶掉进行中的拖拽 ——
       否则 A 指的移动会被 pointerId 判定挡掉，B 指一抬还会在 A 指仍按着屏幕时
       启动一段吸附动画，舞台就在手底下自己动起来了。 */
    if (dragRef.current) return;
    keyboardRef.current = false;
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

    /** 落到最近的整格；已经在格上就什么都不做 */
    const settle = () => {
      const target = settleTargetFrom(panRef.current.x, panRef.current.y);
      if (!target) return;
      if (target.x === panRef.current.x && target.y === panRef.current.y) return;
      glideTo(target.x, target.y);
    };

    const onUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      stageRef.current?.classList.remove("is-dragging");

      // 轻点也要 settle：这一下可能是为了摁停一段滑行，停下的位置多半不在整格上。
      // iOS 的 onEnded 无条件走 runInertia → snapToNearest，这里对齐。
      if (!drag.moved) {
        settle();
        return;
      }

      suppressClickRef.current = true;
      if (suppressTimerRef.current !== null) window.clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = window.setTimeout(() => {
        suppressClickRef.current = false;
        suppressTimerRef.current = null;
      }, CLICK_SUPPRESS_MS);

      // drag.vx 只在 onMove 里写。拖到位后按住不动再松手，这个速度已经过期，
      // 直接乘 FLICK_SCALE 会把舞台甩飞 —— 手停住了就该停在原地。
      const stale = performance.now() - drag.lt > FLICK_MAX_AGE_MS;
      if (stale || reduceMotionRef.current) {
        settle();
        return;
      }

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
  }, [runLoop, sync, settleTargetFrom, glideTo]);

  /* 跟随系统的「减弱动态效果」，用户改设置后立即生效 */
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotionRef.current = media.matches;
    const onChange = (event: MediaQueryListEvent) => {
      reduceMotionRef.current = event.matches;
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (suppressTimerRef.current !== null) window.clearTimeout(suppressTimerRef.current);
    },
    [],
  );

  /* 数据到位或搜索词变化：重排格子；只有搜索词真的变了才推镜头。
     iOS 只挂在 .onChange(of: searchQuery) 上 —— 这里若跟着 travelers 一起重定位，
     慢网下列表到货的那一刻会和正在进行的拖拽同时写 panRef，舞台会跟手指打架。 */
  useEffect(() => {
    travelersRef.current = travelers;
    const q = query.trim().toLowerCase();
    const queryChanged = lastQueryRef.current !== q;
    queryRef.current = q;
    lastQueryRef.current = q;
    setNoMatch(q !== "" && travelers.length > 0 && !hasWatchMatch(travelers, q));
    sync(true);
    if (!queryChanged || dragRef.current) return;
    const target = findSearchTarget(travelers, panRef.current.x, panRef.current.y, q);
    if (target) {
      const { wx, wy } = watchWorldPoint(target.q, target.r);
      glideTo(-wx, -wy);
    }
  }, [travelers, query, sync, glideTo]);

  // 新挂载的格子在浏览器绘制前先落到正确位置，避免它们在中心闪一帧
  useLayoutEffect(() => {
    paint();
  }, [cells, paint]);

  /* 方向键按格平移 —— 拖拽是鼠标/触摸语义，键盘用户需要等价入口。
     左右一次跨两列：错位网格里相邻列整体错开半行，同高度的格子根本不存在，
     只挪一列必然上下偏 92px，而两个候选严格等距、连平局判据都分不开 ——
     左右各按一次也回不到原点，镜头会一路往下漂。隔一列才是真正的横向邻居。 */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, Pan> = {
      ArrowLeft: { x: -WATCH_DX * 2, y: 0 },
      ArrowRight: { x: WATCH_DX * 2, y: 0 },
      ArrowUp: { x: 0, y: -WATCH_DY },
      ArrowDown: { x: 0, y: WATCH_DY },
    };
    const delta = step[event.key];
    if (!delta) return;
    event.preventDefault();
    keyboardRef.current = true;
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
