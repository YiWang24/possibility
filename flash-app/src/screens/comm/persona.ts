// "数字人画像" model + canvas renderer — a faithful port of the prototype's
// publicPersonaModel (原型 ~5215-5236) and drawDynamicPersona (~3121-3246).
// Pure logic only (no component export) so it stays react-refresh clean.

import type { User } from '@/data/users';

export interface PersonaItem {
  key: string;
  label: string;
  value: string;
  glyph: string;
  color: string;
}

type FormKey = 'crystal' | 'bloom' | 'wing' | 'orbit';

export interface PersonaModel {
  form: FormKey;
  shape: string;
  hue: number;
  lobes: number;
  seed: number;
  filled: number;
  signature: string[];
}

/** Glyph + tint chosen from a dimension's label (原型 personaPresentation). */
export function personaPresentation(label: string, value: string, key: string): PersonaItem {
  let glyph = '◎';
  let color = 'rgba(89,104,217,.16)';
  if (/擅长|能力/.test(label)) {
    glyph = '✦';
    color = 'rgba(94,150,255,.15)';
  } else if (/喜欢|兴趣/.test(label)) {
    glyph = '♡';
    color = 'rgba(227,92,193,.15)';
  } else if (/恋爱|情感|关系/.test(label)) {
    glyph = '✿';
    color = 'rgba(255,122,77,.16)';
  } else if (/家庭/.test(label)) {
    glyph = '⌂';
    color = 'rgba(62,217,164,.14)';
  }
  return { key, label, value, glyph, color };
}

export function hasPersonaResult(item: PersonaItem): boolean {
  return item.value !== '' && !/(尚未|待探索|未填写|未生成)/.test(item.value);
}

/** Public persona dimensions for a community user (原型 profilePersonaItems). */
export function profilePersonaItems(u: User): PersonaItem[] {
  const dims = Array.isArray(u.dims) ? u.dims : [];
  const count = Math.min(dims.length, 2 + (Math.abs(u.id) % 3));
  return dims.slice(0, count).map((item, i) => personaPresentation(item[0], item[1], `d${String(i)}`));
}

function dynamicPersonaHash(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function dynamicPersonaRandom(seedInput: number): () => number {
  let seed = seedInput;
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive a stable, reproducible persona form from the user's public dimensions. */
export function publicPersonaModel(u: User, items: PersonaItem[]): PersonaModel {
  const joined = items.map((it) => `${it.label}:${it.value}`).join('|');
  const text = joined !== '' ? joined : `${u.name}·公开画像`;
  const seed = dynamicPersonaHash(text);
  const content = items.map((it) => it.value).join(' ');
  const count = (re: RegExp): number => (content.match(re) ?? []).length;
  const signals: Record<FormKey, number> = {
    crystal: count(/结构|有序|计划|理性|思考|分析|原则|边界|才华|智商/g),
    bloom: count(/共情|陪伴|关系|家庭|亲情|朋友|人际|真诚|尊重|回应|交流|支持|爱|善良|信任/g),
    wing: count(/视觉|手绘|创造|审美|表达|自由|好奇|喜欢/g),
    orbit: count(/独处|探索|学习|尝试|成长|行动|勇气|坚强/g),
  };
  const forms: Record<FormKey, { shape: string; hue: number; lobes: number }> = {
    crystal: { shape: '折光晶灵', hue: 216, lobes: 6 },
    bloom: { shape: '共生花灵', hue: 286, lobes: 7 },
    wing: { shape: '流光翼影', hue: 190, lobes: 4 },
    orbit: { shape: '星轨旅者', hue: 248, lobes: 5 },
  };
  const keys: FormKey[] = ['crystal', 'bloom', 'wing', 'orbit'];
  const topScore = Math.max(...keys.map((k) => signals[k]));
  const candidates = keys.filter((k) => signals[k] === topScore);
  const selectedKey = candidates[seed % candidates.length] ?? 'orbit';
  const def = forms[selectedKey];
  return { form: selectedKey, shape: def.shape, hue: def.hue, lobes: def.lobes, seed, filled: items.length, signature: [] };
}

const hsla = (h: number, s: number, l: number, a: number): string => `hsla(${String(h)}, ${String(s)}%, ${String(l)}%, ${String(a)})`;

/** Render one animation frame of the abstract persona (原型 drawDynamicPersona). */
export function drawDynamicPersona(canvas: HTMLCanvasElement, model: PersonaModel, time: number): void {
  const width = Math.max(280, canvas.clientWidth > 0 ? canvas.clientWidth : 340);
  const height = Math.max(180, canvas.clientHeight > 0 ? canvas.clientHeight : 216);
  const ratio = Math.min(window.devicePixelRatio > 0 ? window.devicePixelRatio : 1, 2);
  const targetW = Math.round(width * ratio);
  const targetH = Math.round(height * ratio);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const rand = dynamicPersonaRandom(model.seed);
  const cx = width * 0.5;
  const cy = height * 0.48;
  const breathe = 1 + Math.sin(time * 0.00105) * 0.035;
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < 72; i++) {
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
    for (let i = 0; i < 16; i++) {
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
    for (let i = 0; i < 7; i++) {
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
    for (let i = 0; i < 3; i++) {
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
  for (let orbit = 0; orbit < orbitCount; orbit++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, 56 + orbit * 13, 31 + orbit * 8, (model.seed % 9) * 0.07 + orbit * 0.38, 0, Math.PI * 2);
    ctx.strokeStyle = hsla(model.hue + orbit * 18, 90, 70, 0.08 + orbit * 0.018);
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  const particleCount = 190 + model.filled * 28 + model.signature.length * 18;
  for (let i = 0; i < particleCount; i++) {
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
  for (let i = 0; i < nodes; i++) {
    const angle = (i / nodes) * Math.PI * 2 + time * 0.00016 * (i % 2 !== 0 ? 1 : -1) + (model.seed % 13);
    const radius = 70 + (i % 3) * 14;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * 0.55;
    ctx.fillStyle = hsla(model.hue + i * 17, 100, 78, 0.88);
    ctx.fillRect(x - 1.8, y - 1.8, 3.6, 3.6);
  }

  ctx.globalCompositeOperation = 'source-over';
}
