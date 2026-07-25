// Community "watch wall" grid + procedurally-composed member names and avatars
// (source: prototype lines ~4642-4645, `WATCH_*`).

/** Horizontal spacing between watch-wall nodes, in px. */
export const WATCH_DX = 160;
/** Vertical spacing between watch-wall nodes, in px. */
export const WATCH_DY = 184;
/** Number of columns in the watch-wall grid. */
export const WATCH_COLS = 9;
/** Number of rows in the watch-wall grid. */
export const WATCH_ROWS = 7;

/** Name prefixes combined with WATCH_NAME_TAILS to synthesize community handles. */
export const WATCH_NAME_HEADS: string[] = [
  '云间',
  '南岸',
  '北辰',
  '晚晴',
  '松野',
  '青屿',
  '白露',
  '橙湾',
  '星河',
  '木槿',
  '晴川',
  '远帆',
  '林深',
  '小满',
  '月桥',
  '山止',
  '海盐',
  '春序',
  '微光',
  '野渡',
  '风眠',
  '竹影',
  '晨雾',
  '栖迟',
];

/** Name suffixes combined with WATCH_NAME_HEADS to synthesize community handles. */
export const WATCH_NAME_TAILS: string[] = [
  '拾光',
  '行舟',
  '折页',
  '听风',
  '慢跑',
  '看海',
  '造梦',
  '写信',
  '观星',
  '种树',
  '漫游',
  '读城',
  '寻路',
  '开花',
  '向晚',
  '未央',
  '煮茶',
  '登山',
  '停云',
  '问路',
  '放映',
  '织网',
  '点灯',
  '候鸟',
];

/**
 * 16 avatar asset paths.
 * Prototype source: `Array.from({length:16},(_,i)=>`assets/community-avatars/avatar-${String(i+1).padStart(2,'0')}.png`)`
 */
export const WATCH_AVATARS: string[] = [
  'assets/community-avatars/avatar-01.png',
  'assets/community-avatars/avatar-02.png',
  'assets/community-avatars/avatar-03.png',
  'assets/community-avatars/avatar-04.png',
  'assets/community-avatars/avatar-05.png',
  'assets/community-avatars/avatar-06.png',
  'assets/community-avatars/avatar-07.png',
  'assets/community-avatars/avatar-08.png',
  'assets/community-avatars/avatar-09.png',
  'assets/community-avatars/avatar-10.png',
  'assets/community-avatars/avatar-11.png',
  'assets/community-avatars/avatar-12.png',
  'assets/community-avatars/avatar-13.png',
  'assets/community-avatars/avatar-14.png',
  'assets/community-avatars/avatar-15.png',
  'assets/community-avatars/avatar-16.png',
];
