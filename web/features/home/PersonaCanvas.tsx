"use client";
/* 数字形象画布 —— 移植 iOS PersonaCanvasView.draw（坐标 / 色值照抄，Canvas 2D 复刻）。
   30fps requestAnimationFrame 驱动呼吸 / 公转 / 粒子流动；prefers-reduced-motion 或 paused 时冻结。 */

import { useEffect, useRef } from "react";
import { mulberry32, type PersonaModel } from "./persona";

/** hsla → CSS 颜色串（h 度，s/l/a 为 0..1，与 iOS hsla 同 HSL 模型） */
function hsla(h: number, s: number, l: number, a: number): string {
  const hue = (((h % 360) + 360) % 360).toFixed(2);
  return `hsla(${hue}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%, ${a})`;
}

/** 绘制（对照原型 drawDynamicPersona，坐标 / 色值照抄） */
function draw(ctx: CanvasRenderingContext2D, w: number, h: number, model: PersonaModel, t: number) {
  const rand = mulberry32(model.seed);
  const cx = w * 0.5;
  const cy = h * 0.48;
  const breathe = 1 + Math.sin(t * 0.00105) * 0.035;
  const hue = model.hue;
  ctx.globalCompositeOperation = "lighter";

  // 1. 背景微尘
  for (let i = 0; i < 72; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const s = 0.35 + rand() * 1.25;
    const drift = Math.sin(t * 0.00035 + i) * 2.5;
    ctx.fillStyle = hsla(hue + (rand() - 0.5) * 75, 0.9, 0.72, 0.1 + rand() * 0.34);
    ctx.fillRect(x + drift, y, s, s);
  }

  // 2. aura 呼吸光晕
  {
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 92);
    g.addColorStop(0, hsla(hue + 28, 1, 0.76, 0.42));
    g.addColorStop(0.42, hsla(hue, 0.95, 0.57, 0.16));
    g.addColorStop(1, hsla(hue - 22, 0.9, 0.42, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 92 * breathe, 70 * breathe, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 形体填充渐变（中心偏移）与描边
  const formShading = (): CanvasGradient => {
    const g = ctx.createRadialGradient(cx - 18, cy - 24, 2, cx - 18, cy - 24, 76);
    g.addColorStop(0, "rgba(247,250,255,0.9)");
    g.addColorStop(0.16, hsla(hue + 34, 1, 0.8, 0.72));
    g.addColorStop(0.55, hsla(hue, 0.95, 0.6, 0.28));
    g.addColorStop(1, hsla(hue - 24, 0.9, 0.42, 0.04));
    return g;
  };
  const strokeColor = hsla(hue + 24, 1, 0.84, 0.66);
  ctx.lineWidth = 1.15;

  // 3. 形体
  switch (model.form) {
    case "crystal": {
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 8;
        const radius = (i % 2 === 1 ? 46 : 68) * (1 + (i % 4 === 0 ? 0.15 : 0)) * breathe;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius * 0.86;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = formShading();
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 43);
      ctx.lineTo(cx + 34, cy);
      ctx.lineTo(cx, cy + 48);
      ctx.lineTo(cx - 34, cy);
      ctx.closePath();
      ctx.strokeStyle = hsla(hue + 54, 1, 0.9, 0.48);
      ctx.stroke();
      break;
    }
    case "bloom": {
      for (let i = 0; i < 7; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((i * Math.PI * 2) / 7 + t * 0.000035);
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.bezierCurveTo(20, -21, 27, -53, 0, -67 * breathe);
        ctx.bezierCurveTo(-27, -53, -20, -21, 0, -7);
        ctx.closePath();
        ctx.fillStyle = hsla(hue + i * 9, 1, (70 + (i % 2) * 8) / 100, 0.25);
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case "wing": {
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(side, 1);
        ctx.beginPath();
        ctx.moveTo(5, -28);
        ctx.bezierCurveTo(24, -66, 72, -66, 68, -20);
        ctx.bezierCurveTo(62, 8, 35, 10, 12, 22);
        ctx.bezierCurveTo(37, 18, 54, 38, 42, 58);
        ctx.bezierCurveTo(20, 48, 9, 23, 5, -28);
        ctx.closePath();
        const g = ctx.createRadialGradient(-18, -24, 2, -18, -24, 76);
        g.addColorStop(0, "rgba(247,250,255,0.9)");
        g.addColorStop(0.16, hsla(hue + 34, 1, 0.8, 0.72));
        g.addColorStop(0.55, hsla(hue, 0.95, 0.6, 0.28));
        g.addColorStop(1, hsla(hue - 24, 0.9, 0.42, 0.04));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.ellipse(cx, cy, 10, 48 * breathe, 0, 0, Math.PI * 2);
      ctx.fillStyle = formShading();
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      break;
    }
    case "orbit": {
      ctx.beginPath();
      ctx.ellipse(cx, cy, 38 * breathe, 38 * breathe, 0, 0, Math.PI * 2);
      ctx.fillStyle = formShading();
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(i * 0.72 + t * 0.00006);
        const rx = 58 + i * 10;
        const ry = 23 + i * 7;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = hsla(hue + 18 + i * 18, 1, 0.82, 0.38 - i * 0.07);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
  }

  // 4. 淡椭圆轨道环
  const orbitCount = 2 + Math.min(4, model.filled);
  for (let orbit = 0; orbit < orbitCount; orbit++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((model.seed % 9) * 0.07 + orbit * 0.38);
    const rx = 56 + orbit * 13;
    const ry = 31 + orbit * 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = hsla(hue + orbit * 18, 0.9, 0.7, 0.08 + orbit * 0.018);
    ctx.stroke();
    ctx.restore();
  }
  ctx.lineWidth = 1.15;

  // 5. 粒子云（沿波瓣边缘）
  const particleCount = 190 + model.filled * 28 + model.signature.length * 18;
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const layer = 0.32 + rand() * 0.78;
    const edge =
      48 * (1 + 0.25 * Math.sin(model.lobes * angle + (model.seed % 17) * 0.11 + t * 0.00022)) * breathe;
    const radius = edge * layer + (rand() - 0.5) * 9;
    const x = cx + Math.cos(angle) * radius * (1.02 + 0.12 * Math.sin(t * 0.0003));
    const y = cy + Math.sin(angle) * radius * 0.78 + (rand() - 0.5) * 5;
    const s = 0.65 + rand() * 2.15 * (0.55 + layer * 0.65);
    const pHue = hue + Math.sin(angle * 2) * 35 + (rand() - 0.5) * 18;
    ctx.fillStyle = hsla(pHue, 0.95, 0.64 + rand() * 0.22, 0.24 + layer * 0.62);
    if (i % 4 === 0) {
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    } else {
      const r = s * 0.42;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 6. 核心发光
  {
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, 42);
    g.addColorStop(0, hsla(hue + 32, 1, 0.88, 0.82));
    g.addColorStop(0.26, hsla(hue, 0.95, 0.66, 0.3));
    g.addColorStop(1, hsla(hue - 18, 0.9, 0.42, 0));
    const coreR = 42 * breathe;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();
  }

  // 7. 维度节点小方块
  const nodes = Math.max(3, model.filled + model.signature.length);
  for (let i = 0; i < nodes; i++) {
    const angle =
      (i / nodes) * Math.PI * 2 + t * 0.00016 * (i % 2 === 1 ? 1 : -1) + (model.seed % 13);
    const radius = 70 + (i % 3) * 14;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * 0.55;
    ctx.fillStyle = hsla(hue + i * 17, 1, 0.78, 0.88);
    ctx.fillRect(x - 1.8, y - 1.8, 3.6, 3.6);
  }

  // 8. 底牌高光 + 连心线
  const sigCount = Math.min(3, model.signature.length);
  for (let i = 0; i < sigCount; i++) {
    const angle = -Math.PI * 0.9 + i * Math.PI * 0.9 + Math.sin(t * 0.00045 + i) * 0.08;
    const radius = 64 + (i % 2) * 18;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * 0.58;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 12);
    g.addColorStop(0, hsla(hue + 42 + i * 24, 1, 0.88, 0.95));
    g.addColorStop(0.28, hsla(hue + i * 24, 0.95, 0.67, 0.48));
    g.addColorStop(1, hsla(hue + i * 24, 0.95, 0.55, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = hsla(hue + 20 + i * 24, 1, 0.82, 0.34);
    ctx.stroke();
    ctx.lineWidth = 1.15;
  }
}

/* draw() 的坐标系被写死在这个高度上（iOS 舞台高 216pt）。
   它现在是设计尺寸而不是渲染尺寸：舞台多高，整幅画就按比例放多大。 */
const DESIGN_H = 216;

export function PersonaCanvas({ model, paused = false }: { model: PersonaModel; paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const frozen = paused || reduceMotion;

    let raf = 0;
    let lastDraw = 0;
    const parent = canvas.parentElement;

    const render = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent?.clientWidth ?? canvas.clientWidth;
      const h = parent?.clientHeight ?? canvas.clientHeight;
      if (w > 0 && h > 0) {
        const pw = Math.round(w * dpr);
        const ph = Math.round(h * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
        }
        /* draw() 里的坐标（aura 92×70、形体半径 ~68）是照抄 iOS 的绝对像素，
           画布放大时形象不会跟着长，在首页 hero 那种大舞台上会缩成一枚小徽章。
           这里不去改 draw 的上百个坐标，而是把它当成固定设计尺寸的矢量：
           按舞台高度整体缩放，逻辑宽度反算回去，背景微尘仍铺满全宽。 */
        const scale = h / DESIGN_H;
        const logicalW = w / scale;
        ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
        ctx.clearRect(0, 0, logicalW, DESIGN_H);
        ctx.globalCompositeOperation = "source-over";
        // 原型 time 单位为 ms
        draw(ctx, logicalW, DESIGN_H, model, frozen ? 0 : now);
      }
    };

    // 30fps 节流循环
    const tick = (now: number) => {
      if (now - lastDraw >= 1000 / 30) {
        lastDraw = now;
        render(now);
      }
      if (!frozen) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [model, paused]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />;
}
