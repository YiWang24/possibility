import { useEffect, useRef } from 'react';
import { PERSONA_MODEL, drawPersona } from './personaDraw';

/**
 * "动态数字形象" — a faithful port of the prototype's `drawDynamicPersona()`
 * (原型 ~3121–3246) and its model builder `refreshDynamicPersona()` (~3080–3120).
 *
 * The live app has no DOM dimension inputs to read (`currentPersonaSnapshot`
 * scraped `#dimSkill` … in the prototype), so a single stable default model is
 * built in personaDraw.ts (fixed form / hue / lobes / seed + the three home
 * 人生底牌). Canvas dimensions are computed in JS (never literal attributes);
 * the component takes no props, animates via rAF, honors reduced-motion, and
 * cleans up on unmount.
 */
export default function PersonaCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;

    let raf = 0;
    let disposed = false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const frame = (time: number) => {
      if (disposed) return;
      drawPersona(canvas, ctx, time, PERSONA_MODEL);
      if (!reduce) raf = window.requestAnimationFrame(frame);
    };

    const onResize = () => {
      if (reduce) drawPersona(canvas, ctx, 0, PERSONA_MODEL);
    };

    if (reduce) drawPersona(canvas, ctx, 0, PERSONA_MODEL);
    else raf = window.requestAnimationFrame(frame);
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="dynamicPersonaCanvas"
      role="img"
      aria-label={`根据当前画像内容生成的抽象数字形象：${PERSONA_MODEL.shape}`}
      data-testid="persona-canvas"
    />
  );
}
