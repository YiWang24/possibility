// Resolve the profile's stored avatar reference (a `MY_AVATARS` path string or a
// data: URL from a local upload) to a bundler-served image URL. Images are
// imported per the flash-app rule that forbids raw string src paths.

import { MY_AVATARS } from '@/data/profile';
import avatar01 from '@/assets/avatars/avatar-01.png';
import avatar02 from '@/assets/avatars/avatar-02.png';
import avatar03 from '@/assets/avatars/avatar-03.png';
import avatar04 from '@/assets/avatars/avatar-04.png';
import avatar05 from '@/assets/avatars/avatar-05.png';
import avatar06 from '@/assets/avatars/avatar-06.png';

const RESOLVED: readonly string[] = [avatar01, avatar02, avatar03, avatar04, avatar05, avatar06];

export interface AvatarOption {
  /** The stored path used as the profile's avatar value. */
  path: string;
  /** The imported, bundler-served image URL. */
  src: string;
}

const FALLBACK = RESOLVED[0] ?? '';

export const AVATAR_OPTIONS: AvatarOption[] = MY_AVATARS.map((path, index) => ({
  path,
  src: RESOLVED[index] ?? FALLBACK,
}));

const PATH_TO_SRC = new Map<string, string>(AVATAR_OPTIONS.map((option) => [option.path, option.src]));

/** A renderable src for a stored avatar value (data URL passthrough, else mapped). */
export function resolveAvatarSrc(stored: string): string {
  if (/^data:image\//.test(stored)) return stored;
  return PATH_TO_SRC.get(stored) ?? FALLBACK;
}

/** Prototype `safeProfileAvatar`: only trust known avatar paths / data URLs. */
export function safeProfileAvatar(stored: string): string {
  return /^(assets\/community-avatars\/|data:image\/)/.test(stored) ? stored : (MY_AVATARS[0] ?? '');
}
