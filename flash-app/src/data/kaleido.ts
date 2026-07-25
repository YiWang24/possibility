// Kaleidoscope canvas rendering constants + gem palette (source: prototype lines ~8530-8534).

/** Gem colors cycled through the kaleidoscope source scene. */
export const GEM_COLS: string[] = ['#F06ACD', '#9FBEFF', '#5E96FF', '#8F7BFF', '#D9B3F5', '#FF7A4D', '#FFB067', '#E35CC1'];

/** Full kaleidoscope disc size in canvas units. */
export const KAL_SIZE = 460;
/** Kaleidoscope disc radius (KAL_SIZE / 2). */
export const KAL_R = KAL_SIZE / 2;
/** Circumscribed radius of each mirror triangle, in canvas units. */
export const KAL_TRI = 68;
/** Off-screen source canvas size. */
export const SRC_SIZE = 200;
