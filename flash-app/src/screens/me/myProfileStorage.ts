// localStorage persistence + schema normalization for "我的公开主页"
// (source: prototype ~5152 `cloneData`, ~5153 `loadMyProfile`,
// ~5103 `normalizeMyAdviceModules`). Every read is normalized so a single stale
// or malformed record can never crash the page.

import { DEFAULT_MY_PROFILE, type AdviceModule, type MyProfile, type ProfileService, type ProfileVisibility } from '@/data/profile';
import { HUES, type UserTrajectory } from '@/data/users';
import type { ProfileMeta } from '@/data/profileMeta';

export const MY_PROFILE_KEY = 'kaleido_my_public_profile_v1';
export const MBTI_STORE_KEY = 'kaleido_mbti_badge_v1';

// ---- typed, throw-safe primitives -------------------------------------------

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function safeStoreGet(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? parseJson(raw) : null;
  } catch {
    return null;
  }
}

export function safeStoreSet(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

// ---- normalizers ------------------------------------------------------------

export function normalizeAdviceModules(raw: unknown): AdviceModule[] {
  return asArray(raw).map((entry, index) => {
    const mod = asRecord(entry);
    const images = asArray(mod['images'])
      .slice(0, 4)
      .map((img, imageIndex) => {
        const image = asRecord(img);
        const src = asString(image['src'], '');
        return {
          id: asString(image['id'], `image-${String(index)}-${String(imageIndex)}`),
          src: /^data:image\//.test(src) ? src : '',
          name: asString(image['name'], '经验配图'),
        };
      })
      .filter((image) => image.src !== '');
    const links = asArray(mod['links'])
      .slice(0, 6)
      .map((lnk, linkIndex) => {
        const link = asRecord(lnk);
        return {
          id: asString(link['id'], `link-${String(index)}-${String(linkIndex)}`),
          label: asString(link['label'], '相关链接'),
          url: asString(link['url'], ''),
        };
      });
    return {
      id: asString(mod['id'], `advice-${String(index)}`),
      title: asString(mod['title'], '未命名经验'),
      content: asString(mod['content'], ''),
      images,
      links,
    };
  });
}

function normalizeTrajectory(raw: unknown, fallback: UserTrajectory[]): UserTrajectory[] {
  const list = asArray(raw);
  if (list.length === 0) return clone(fallback);
  return list.map((entry) => {
    const item = asRecord(entry);
    return {
      age: asString(item['age'], '现在'),
      t: asString(item['t'], '新的节点'),
      d: asString(item['d'], ''),
    };
  });
}

function normalizeServices(raw: unknown, fallback: ProfileService[]): ProfileService[] {
  if (!Array.isArray(raw)) return clone(fallback);
  return raw.map((entry, index) => {
    const service = asRecord(entry);
    const enabled = service['enabled'];
    return {
      id: asString(service['id'], `service-${String(index)}`),
      enabled: enabled === true,
      type: asString(service['type'], '自定义服务'),
      title: asString(service['title'], '未命名服务'),
      price: asString(service['price'], '0'),
      desc: asString(service['desc'], ''),
    };
  });
}

function normalizeVisibility(raw: unknown): ProfileVisibility {
  const saved = asRecord(raw);
  const base = DEFAULT_MY_PROFILE.visibility;
  const pick = (key: keyof ProfileVisibility): boolean => {
    const value = saved[key];
    return typeof value === 'boolean' ? value : base[key];
  };
  return {
    personality: pick('personality'),
    skill: pick('skill'),
    like: pick('like'),
    love: pick('love'),
    family: pick('family'),
    social: pick('social'),
    life: pick('life'),
  };
}

function normalizeAdvice(raw: unknown, base: ProfileMeta['advice']): ProfileMeta['advice'] {
  const saved = asRecord(raw);
  const pick = (key: keyof ProfileMeta['advice']): string[] => {
    const value = saved[key];
    return Array.isArray(value) ? value.map((tip) => asString(tip, '')) : base[key];
  };
  return { decision: pick('decision'), ability: pick('ability'), interview: pick('interview') };
}

function normalizeMeta(raw: unknown): ProfileMeta {
  const saved = asRecord(raw);
  const base = DEFAULT_MY_PROFILE.meta;
  const consulted = saved['consulted'];
  const age = saved['age'];
  return {
    age: typeof age === 'number' ? age : base.age,
    city: asString(saved['city'], base.city),
    from: asString(saved['from'], base.from),
    to: asString(saved['to'], base.to),
    years: asString(saved['years'], base.years),
    result: asString(saved['result'], base.result),
    consulted: typeof consulted === 'number' ? consulted : base.consulted,
    response: asString(saved['response'], base.response),
    intro: asString(saved['intro'], base.intro),
    full: asString(saved['full'], base.full),
    advice: normalizeAdvice(saved['advice'], base.advice),
  };
}

/** Load + normalize the saved profile, falling back to defaults on any gap. */
export function loadMyProfile(): MyProfile {
  const base = clone(DEFAULT_MY_PROFILE);
  const saved = safeStoreGet(MY_PROFILE_KEY);
  if (saved === null) return base;
  const s = asRecord(saved);
  const hueValue = s['hue'];
  const hue = typeof hueValue === 'number' && Number.isInteger(hueValue) && HUES[hueValue] !== undefined ? hueValue : base.hue;
  const tags = Array.isArray(s['tags']) ? s['tags'].map((tag) => asString(tag, '')) : base.tags;
  const meta = normalizeMeta(s['meta']);
  return {
    id: 'me',
    name: asString(s['name'], base.name),
    ini: asString(s['ini'], base.ini),
    hue,
    avatar: asString(s['avatar'], base.avatar),
    quote: asString(s['quote'], base.quote),
    tags,
    bio: asString(s['bio'], base.bio),
    traj: normalizeTrajectory(s['traj'], base.traj),
    dims: base.dims,
    visibility: normalizeVisibility(s['visibility']),
    adviceModules: normalizeAdviceModules(s['adviceModules']),
    services: normalizeServices(s['services'], base.services),
    meta,
  };
}

export function loadMbtiBadge(): string | null {
  const value = safeStoreGet(MBTI_STORE_KEY);
  return typeof value === 'string' && value !== '' ? value : null;
}
