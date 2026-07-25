// Community users and their gradient palette (source: prototype lines ~2733-2827:
// `HUES`, `USERS`). USERS is split across usersA/usersB to keep files <=300 lines;
// PROFILE_META + profileMetaFor live in ./profileMeta.

import { USERS_A } from './usersA';
import { USERS_B } from './usersB';

/** Gradient (`g`) + accent (`a`) color pair; `User.hue` indexes into HUES. */
export interface Hue {
  g: string;
  a: string;
}

export const HUES: Hue[] = [
  { g: 'linear-gradient(135deg,#0F1F52,#2E5EDB 55%,#6FA5FF)', a: '#3D6EF0' },
  { g: 'linear-gradient(135deg,#3A1035,#B03390 55%,#F06ACD)', a: '#C445A4' },
  { g: 'linear-gradient(135deg,#0E2A22,#1F8A66 60%,#8FD84B)', a: '#2FA98C' },
  { g: 'linear-gradient(135deg,#3A140C,#D14A24 60%,#FF8A54)', a: '#E85A34' },
  { g: 'linear-gradient(135deg,#171243,#4A3BD1 60%,#8F7BFF)', a: '#6E58E8' },
];

/** A single "维度" entry: `[label, value]`. */
export type UserDim = [label: string, value: string];

/** One milestone on a user's life trajectory. */
export interface UserTrajectory {
  age: string;
  t: string;
  d: string;
}

/** Structured transition meta present on users without a hand-written PROFILE_META entry. */
export interface UserMeta {
  age: number;
  city: string;
  from: string;
  to: string;
  years: string;
  result: string;
  consulted: number;
  response: string;
}

export interface User {
  id: number;
  name: string;
  ini: string;
  hue: number;
  sim: boolean;
  quote: string;
  tags: string[];
  bio: string;
  traj: UserTrajectory[];
  dims: UserDim[];
  /** Present only on users 6-12 (users 1-5 rely on PROFILE_META). */
  meta?: UserMeta;
  /** Assigned at runtime in the prototype from WATCH_AVATARS; not part of the seed literal. */
  avatar?: string;
}

/** All 12 seed users, in original order. */
export const USERS: User[] = [...USERS_A, ...USERS_B];
