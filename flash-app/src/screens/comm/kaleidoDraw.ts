// Kaleidoscope disc renderer — faithful port of buildKaleido/drawKalSource/
// renderKaleido/kalLoop/kalSpin (原型 ~8535-8634), encapsulated as a factory so
// there is no module-level canvas state.

import { GEM_COLS, KAL_R, KAL_SIZE, KAL_TRI, SRC_SIZE } from '@/data/kaleido';

interface Gem {
  orbit: number;
  phase: number;
  spd: number;
  rspd: number;
  r: number;
  col: string;
  kind: number;
}

interface Tri {
  hx: number;
  hy: number;
  a: number;
  flip: boolean;
}

export interface KaleidoController {
  spin: () => void;
  stop: () => void;
}

export function createKaleido(canvas: HTMLCanvasElement): KaleidoController {
  // Canvas backing store sized in JS (never literal width/height attributes).
  canvas.width = KAL_SIZE;
  canvas.height = KAL_SIZE;
  const ctx = canvas.getContext('2d');
  const src = document.createElement('canvas');
  src.width = SRC_SIZE;
  src.height = SRC_SIZE;
  const srcCtx = src.getContext('2d');

  // Fixed pseudo-random gems so the pattern is reproducible (原型 seed=12).
  let seed = 12;
  const rnd = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const gems: Gem[] = [];
  for (let j = 0; j < 7; j++) {
    gems.push({
      orbit: 22 + rnd() * 62,
      phase: rnd() * Math.PI * 2,
      spd: 0.28 + rnd() * 0.5,
      rspd: (rnd() > 0.5 ? 1 : -1) * (0.4 + rnd() * 0.9),
      r: 20 + rnd() * 22,
      col: GEM_COLS[Math.floor(rnd() * GEM_COLS.length)] ?? '#5E96FF',
      kind: Math.floor(rnd() * 4),
    });
  }
  const tris: Tri[] = [];
  for (let h = -1; h < 6; h++) {
    const hx = h === -1 ? 0 : Math.cos((Math.PI / 3) * h) * KAL_TRI * 3;
    const hy = h === -1 ? 0 : Math.sin((Math.PI / 3) * h) * KAL_TRI * 3;
    for (let i = 0; i < 6; i++) {
      tris.push({ hx, hy, a: (Math.PI / 3) * i, flip: i % 2 === 1 });
    }
  }

  let t = 0;
  let boost = 0;
  let last = 0;
  let raf: number | null = null;

  const drawSource = (time: number): void => {
    if (!srcCtx) return;
    const bg = srcCtx.createLinearGradient(0, 0, SRC_SIZE, SRC_SIZE);
    bg.addColorStop(0, '#3D48C8');
    bg.addColorStop(0.55, '#6070DE');
    bg.addColorStop(1, '#2A2F9E');
    srcCtx.fillStyle = bg;
    srcCtx.fillRect(0, 0, SRC_SIZE, SRC_SIZE);
    const cx = SRC_SIZE / 2;
    const cy = SRC_SIZE / 2;
    for (const gm of gems) {
      const a = gm.phase + time * gm.spd;
      const x = cx + Math.cos(a) * gm.orbit;
      const y = cy + Math.sin(a) * gm.orbit;
      srcCtx.save();
      srcCtx.translate(x, y);
      srcCtx.rotate(time * gm.rspd);
      const g = srcCtx.createRadialGradient(-gm.r * 0.3, -gm.r * 0.3, gm.r * 0.1, 0, 0, gm.r * 1.2);
      g.addColorStop(0, 'rgba(255,255,255,.95)');
      g.addColorStop(0.35, gm.col);
      g.addColorStop(1, 'rgba(10,12,40,.9)');
      srcCtx.fillStyle = g;
      const r = gm.r;
      srcCtx.beginPath();
      if (gm.kind === 0) {
        srcCtx.arc(0, 0, r, 0, Math.PI * 2);
      } else if (gm.kind === 1) {
        srcCtx.moveTo(0, -r);
        srcCtx.lineTo(r * 0.8, 0);
        srcCtx.lineTo(0, r);
        srcCtx.lineTo(-r * 0.8, 0);
        srcCtx.closePath();
      } else if (gm.kind === 2) {
        srcCtx.rect(-r, -r * 0.4, r * 2, r * 0.8);
      } else {
        srcCtx.moveTo(0, -r);
        srcCtx.lineTo(r, r * 0.7);
        srcCtx.lineTo(-r, r * 0.7);
        srcCtx.closePath();
      }
      srcCtx.fill();
      srcCtx.strokeStyle = 'rgba(255,255,255,.55)';
      srcCtx.lineWidth = 1.5;
      srcCtx.stroke();
      srcCtx.restore();
    }
  };

  const render = (): void => {
    if (!ctx) return;
    const k = KAL_TRI;
    ctx.clearRect(0, 0, KAL_SIZE, KAL_SIZE);
    for (const tr of tris) {
      ctx.save();
      ctx.translate(KAL_R + tr.hx, KAL_R + tr.hy);
      ctx.rotate(tr.a);
      ctx.translate(-k, 0);
      if (tr.flip) ctx.scale(1, -1);
      ctx.beginPath();
      ctx.moveTo(k, 0);
      ctx.lineTo(k * Math.cos((2 * Math.PI) / 3), k * Math.sin((2 * Math.PI) / 3));
      ctx.lineTo(k * Math.cos((4 * Math.PI) / 3), k * Math.sin((4 * Math.PI) / 3));
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(src, -k, -k, k * 2, k * 2);
      ctx.restore();
    }
    const core = ctx.createRadialGradient(KAL_R, KAL_R, 0, KAL_R, KAL_R, 30);
    core.addColorStop(0, 'rgba(255,255,255,.85)');
    core.addColorStop(0.6, 'rgba(217,179,245,.25)');
    core.addColorStop(1, 'rgba(217,179,245,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(KAL_R, KAL_R, 30, 0, Math.PI * 2);
    ctx.fill();
  };

  const loop = (now: number): void => {
    const dt = Math.min(50, now - last);
    last = now;
    t += dt * 0.0005 * (1 + boost);
    boost *= Math.pow(0.9982, dt);
    drawSource(t);
    render();
    raf = requestAnimationFrame(loop);
  };

  const stop = (): void => {
    if (raf !== null) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  };

  const spin = (): void => {
    boost = 16;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      t += 2;
      drawSource(t);
      render();
      return;
    }
    stop();
    last = performance.now();
    raf = requestAnimationFrame(loop);
  };

  drawSource(0);
  render();
  return { spin, stop };
}
