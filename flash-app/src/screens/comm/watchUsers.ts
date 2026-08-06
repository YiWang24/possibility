// Procedural community members for the 放映模式 (watch mode) infinite grid.
// Faithful port of the prototype's watchHash/watchUserAt/caches (原型 ~4657-4683).

import type { User, UserDim } from '@/data/users';
import { USERS } from '@/data/users';
import { profileMetaFor } from '@/data/profileMeta';
import { WATCH_DX, WATCH_DY, WATCH_NAME_HEADS, WATCH_NAME_TAILS } from '@/data/community';
import { avatarByIndex } from './avatars';

const cache = new Map<string, User>();
const profileUsers = new Map<number, User>();
let sequence = 1000;

function watchHash(q: number, r: number, salt = 0): number {
  let h = Math.imul(q, 73856093) ^ Math.imul(r, 19349663) ^ Math.imul(salt + 1, 83492791);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Deterministic community member at grid cell (q, r) — cached, trimmed by insertion age.
 *
 * Reads deliberately do NOT re-insert to refresh recency: this runs for all 63 visible
 * nodes on every animation frame, and the delete+set pair cost two Map mutations per
 * node per frame. Since the wall pans continuously, oldest-inserted is a good proxy for
 * furthest-away, so plain insertion-order eviction keeps the same working set.
 */
export function watchUserAt(q: number, r: number): User {
  const key = `${String(q)}:${String(r)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const seed = watchHash(q, r);
  const base = USERS[seed % USERS.length];
  if (!base) throw new Error('watchUserAt: USERS is empty');
  const m = profileMetaFor(base);
  const head = WATCH_NAME_HEADS[seed % WATCH_NAME_HEADS.length] ?? '';
  const tail = WATCH_NAME_TAILS[(seed >>> 8) % WATCH_NAME_TAILS.length] ?? '';
  const name = head + tail;
  const u: User = {
    id: sequence++,
    name,
    ini: name.slice(0, 1),
    avatar: avatarByIndex(q * 7 + r * 11),
    hue: (seed >>> 12) % 5,
    sim: false,
    quote: base.quote,
    tags: base.tags.slice(0, 2),
    bio: base.bio,
    traj: base.traj.map((t) => ({ ...t })),
    dims: base.dims.map((d): UserDim => [d[0], d[1]]),
    meta: { age: m.age, city: m.city, from: m.from, to: m.to, years: m.years, result: m.result, consulted: m.consulted, response: m.response },
  };
  cache.set(key, u);
  if (cache.size > 360) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  return u;
}

/** Remember a tapped watch user so ProfilePush can resolve it by id (not in USERS). */
export function registerWatchProfileUser(u: User): void {
  profileUsers.set(u.id, u);
}

export function getWatchProfileUser(id: number): User | undefined {
  return profileUsers.get(id);
}

/** Fields a watch user is matched against during search (原型 watchSearchValues). */
export function watchSearchValues(u: User): (string | undefined)[] {
  return [u.name, u.bio, u.quote, ...u.tags, u.meta?.city, u.meta?.from, u.meta?.to];
}

export function communityTextMatches(values: (string | undefined)[], query: string): boolean {
  if (query === '') return true;
  return values
    .filter((v): v is string => v !== undefined)
    .join(' ')
    .toLowerCase()
    .includes(query);
}

/** Lowercased haystack per user, built once — users are cached, so this stays warm. */
const searchText = new WeakMap<User, string>();

/**
 * Search-match a watch user without rebuilding its haystack.
 *
 * The grid re-tests every visible node on each frame while panning; going through
 * `watchSearchValues` + filter + join + toLowerCase there allocated four times per node
 * per frame. The joined string only depends on the user, so it is memoised instead.
 */
export function watchUserMatches(u: User, query: string): boolean {
  if (query === '') return true;
  let text = searchText.get(u);
  if (text === undefined) {
    text = watchSearchValues(u)
      .filter((v): v is string => v !== undefined)
      .join(' ')
      .toLowerCase();
    searchText.set(u, text);
  }
  return text.includes(query);
}

/** World-space position of grid cell (q, r) (原型 watchWorldPoint). */
export function watchWorldPoint(q: number, r: number): { wx: number; wy: number } {
  return { wx: q * WATCH_DX, wy: r * WATCH_DY + (Math.abs(q) % 2) * (WATCH_DY / 2) };
}

/** Snapshot of the currently-cached (key, user) pairs, for search targeting. */
export function cachedWatchEntries(): [string, User][] {
  return [...cache.entries()];
}
