// Faithful port of the prototype's 动态数字形象 model + renderer.
// Source: dynamicPersonaHash / dynamicPersonaRandom / refreshDynamicPersona /
// drawDynamicPersona (原型 ~3049–3246). Kept as a plain module so the React
// component file stays thin (and react-refresh-clean).

export type PersonaForm = 'crystal' | 'bloom' | 'wing' | 'orbit';

export interface PersonaModel {
  seed: number;
  filled: number;
  signature: string[];
  form: PersonaForm;
  hue: number;
  lobes: number;
  shape: string;
}

/** The three signature cards shown on the home portrait (PersonaPortrait). */
const SIGNATURE = ['认真对待每一次告别', '把创造当作呼吸', '把重要的人放在前面'];

const FORM_DEFS: Record<PersonaForm, { name: string; hue: number; lobes: number }> = {
  crystal: { name: '折光晶灵', hue: 216, lobes: 6 },
  bloom: { name: '共生花灵', hue: 286, lobes: 7 },
  wing: { name: '流光翼影', hue: 190, lobes: 4 },
  orbit: { name: '星轨旅者', hue: 248, lobes: 5 },
};

/** hsla() builder — numbers stringified to satisfy restrict-template-expressions. */
function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${String(h)}, ${String(s)}%, ${String(l)}%, ${String(a)})`;
}

/** FNV-1a hash (source: dynamicPersonaHash). */
function dynamicPersonaHash(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Seeded mulberry32 PRNG (source: dynamicPersonaRandom). */
function dynamicPersonaRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDefaultModel(): PersonaModel {
  const seed = dynamicPersonaHash(SIGNATURE.join('|'));
  // A stable "星轨旅者" default: fixed form/hue/lobes, three signature cards, and
  // three filled dimensions of implied progress (reasonable default in 0..3).
  const def = FORM_DEFS.orbit;
  return {
    seed,
    filled: 3,
    signature: SIGNATURE,
    form: 'orbit' as PersonaForm,
    hue: def.hue + (seed % 23) - 11,
    lobes: def.lobes,
    shape: def.name,
  };
}

export const PERSONA_MODEL = buildDefaultModel();

/** Faithful port of drawDynamicPersona(time). */
export function drawPersona(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, time: number, model: PersonaModel): void {
  const width = Math.max(280, canvas.clientWidth > 0 ? canvas.clientWidth : 340);
  const height = Math.max(180, canvas.clientHeight > 0 ? canvas.clientHeight : 216);
  const ratio = Math.min(window.devicePixelRatio > 0 ? window.devicePixelRatio : 1, 2);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const rand = dynamicPersonaRandom(model.seed);
  const cx = width * 0.5;
  const cy = height * 0.48;
  const breathe = 1 + Math.sin(time * 0.00105) * 0.035;
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < 72; i += 1) {
    const x = rand() * width;
    const y = rand() * height;
    const size = 0.35 + rand() * 1.25;
    const drift = Math.sin(time * 0.00035 + i) * 2.5;
    ctx.fillStyle = hsla(model.hue + (rand() - 0.5) * 75, 90, 72, 0.1 + rand() * 0.34);
    ctx.fillRect(x + drift, y, size, size);
  }

  const aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, 88);
  aura.addColorStop(0, hsla(model.hue + 28, 100, 76, 0.42));
  aura.addColorStop(0.42, hsla(model.hue, 95, 57, 0.16));
  aura.addColorStop(1, hsla(model.hue - 22, 90, 42, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 92 * breathe, 70 * breathe, 0, 0, Math.PI * 2);
  ctx.fill();

  const formGradient = ctx.createRadialGradient(cx - 18, cy - 24, 2, cx, cy, 76);
  formGradient.addColorStop(0, 'rgba(247,250,255,.9)');
  formGradient.addColorStop(0.16, hsla(model.hue + 34, 100, 80, 0.72));
  formGradient.addColorStop(0.55, hsla(model.hue, 95, 60, 0.28));
  formGradient.addColorStop(1, hsla(model.hue - 24, 90, 42, 0.04));
  ctx.fillStyle = formGradient;
  ctx.strokeStyle = hsla(model.hue + 24, 100, 84, 0.66);
  ctx.lineWidth = 1.15;

  if (model.form === 'crystal') {
    ctx.beginPath();
    for (let i = 0; i < 16; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 8;
      const radius = (i % 2 !== 0 ? 46 : 68) * (1 + (i % 4 === 0 ? 0.15 : 0)) * breathe;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius * 0.86;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 43);
    ctx.lineTo(cx + 34, cy);
    ctx.lineTo(cx, cy + 48);
    ctx.lineTo(cx - 34, cy);
    ctx.closePath();
    ctx.strokeStyle = hsla(model.hue + 54, 100, 90, 0.48);
    ctx.stroke();
  } else if (model.form === 'bloom') {
    for (let i = 0; i < 7; i += 1) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((i * Math.PI * 2) / 7 + time * 0.000035);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.bezierCurveTo(20, -21, 27, -53, 0, -67 * breathe);
      ctx.bezierCurveTo(-27, -53, -20, -21, 0, -7);
      ctx.closePath();
      ctx.fillStyle = hsla(model.hue + i * 9, 100, 70 + (i % 2) * 8, 0.25);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  } else if (model.form === 'wing') {
    [-1, 1].forEach((side) => {
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
      ctx.fillStyle = formGradient;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
    ctx.beginPath();
    ctx.ellipse(cx, cy, 10, 48 * breathe, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, 38 * breathe, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 3; i += 1) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(i * 0.72 + time * 0.00006);
      ctx.beginPath();
      ctx.ellipse(0, 0, 58 + i * 10, 23 + i * 7, 0, 0, Math.PI * 2);
      ctx.strokeStyle = hsla(model.hue + 18 + i * 18, 100, 82, 0.38 - i * 0.07);
      ctx.stroke();
      ctx.restore();
    }
  }

  const orbitCount = 2 + Math.min(4, model.filled);
  for (let orbit = 0; orbit < orbitCount; orbit += 1) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, 56 + orbit * 13, 31 + orbit * 8, (model.seed % 9) * 0.07 + orbit * 0.38, 0, Math.PI * 2);
    ctx.strokeStyle = hsla(model.hue + orbit * 18, 90, 70, 0.08 + orbit * 0.018);
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  const particleCount = 190 + model.filled * 28 + model.signature.length * 18;
  for (let i = 0; i < particleCount; i += 1) {
    const angle = (i / particleCount) * Math.PI * 2;
    const layer = 0.32 + rand() * 0.78;
    const edge = 48 * (1 + 0.25 * Math.sin(model.lobes * angle + (model.seed % 17) * 0.11 + time * 0.00022)) * breathe;
    const radius = edge * layer + (rand() - 0.5) * 9;
    const x = cx + Math.cos(angle) * radius * (1.02 + 0.12 * Math.sin(time * 0.0003));
    const y = cy + Math.sin(angle) * radius * 0.78 + (rand() - 0.5) * 5;
    const size = 0.65 + rand() * 2.15 * (0.55 + layer * 0.65);
    const hue = model.hue + Math.sin(angle * 2) * 35 + (rand() - 0.5) * 18;
    ctx.fillStyle = hsla(hue, 95, 64 + rand() * 22, 0.24 + layer * 0.62);
    if (i % 4 === 0) ctx.fillRect(x - size / 2, y - size / 2, size, size);
    else {
      ctx.beginPath();
      ctx.arc(x, y, size * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const core = ctx.createRadialGradient(cx, cy, 1, cx, cy, 42);
  core.addColorStop(0, hsla(model.hue + 32, 100, 88, 0.82));
  core.addColorStop(0.26, hsla(model.hue, 95, 66, 0.3));
  core.addColorStop(1, hsla(model.hue - 18, 90, 42, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, 42 * breathe, 0, Math.PI * 2);
  ctx.fill();

  const nodes = Math.max(3, model.filled + model.signature.length);
  for (let i = 0; i < nodes; i += 1) {
    const angle = (i / nodes) * Math.PI * 2 + time * 0.00016 * (i % 2 !== 0 ? 1 : -1) + (model.seed % 13);
    const radius = 70 + (i % 3) * 14;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * 0.55;
    ctx.fillStyle = hsla(model.hue + i * 17, 100, 78, 0.88);
    ctx.fillRect(x - 1.8, y - 1.8, 3.6, 3.6);
  }

  if (model.signature.length > 0) {
    const signatureCount = Math.min(3, model.signature.length);
    for (let i = 0; i < signatureCount; i += 1) {
      const angle = -Math.PI * 0.9 + i * Math.PI * 0.9 + Math.sin(time * 0.00045 + i) * 0.08;
      const radius = 64 + (i % 2) * 18;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius * 0.58;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 12);
      glow.addColorStop(0, hsla(model.hue + 42 + i * 24, 100, 88, 0.95));
      glow.addColorStop(0.28, hsla(model.hue + i * 24, 95, 67, 0.48));
      glow.addColorStop(1, hsla(model.hue + i * 24, 95, 55, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hsla(model.hue + 20 + i * 24, 100, 82, 0.34);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}
