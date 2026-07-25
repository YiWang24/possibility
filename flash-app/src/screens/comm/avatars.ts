// Community avatar assets + index helpers.
// Mirrors the prototype's WATCH_AVATARS assignment (原型 ~4645-4648) and
// bountyAvatarPath (~4930): a 16-image ring indexed by user/bounty position.
// Images MUST be imported (flash-app rule) — string paths would 404.

import { USERS } from '@/data/users';
import a01 from '@/assets/avatars/avatar-01.png';
import a02 from '@/assets/avatars/avatar-02.png';
import a03 from '@/assets/avatars/avatar-03.png';
import a04 from '@/assets/avatars/avatar-04.png';
import a05 from '@/assets/avatars/avatar-05.png';
import a06 from '@/assets/avatars/avatar-06.png';
import a07 from '@/assets/avatars/avatar-07.png';
import a08 from '@/assets/avatars/avatar-08.png';
import a09 from '@/assets/avatars/avatar-09.png';
import a10 from '@/assets/avatars/avatar-10.png';
import a11 from '@/assets/avatars/avatar-11.png';
import a12 from '@/assets/avatars/avatar-12.png';
import a13 from '@/assets/avatars/avatar-13.png';
import a14 from '@/assets/avatars/avatar-14.png';
import a15 from '@/assets/avatars/avatar-15.png';
import a16 from '@/assets/avatars/avatar-16.png';

export const AVATARS: readonly string[] = [a01, a02, a03, a04, a05, a06, a07, a08, a09, a10, a11, a12, a13, a14, a15, a16];

/** Wrap-around lookup into the avatar ring (0-based). */
export function avatarByIndex(index: number): string {
  const n = AVATARS.length;
  return AVATARS[((index % n) + n) % n] ?? '';
}

// Assign avatars exactly like the prototype: USERS[arrayIndex] → AVATARS[arrayIndex % 16].
const USER_AVATAR_BY_ID = new Map<number, string>(USERS.map((u, i) => [u.id, avatarByIndex(i)]));

/** The avatar image for a seeded community user. */
export function avatarForUserId(id: number): string {
  return USER_AVATAR_BY_ID.get(id) ?? '';
}

/** 1-based avatar lookup, mirroring the prototype's bountyAvatarPath(index). */
export function bountyAvatar(index1: number): string {
  return avatarByIndex(index1 - 1);
}
