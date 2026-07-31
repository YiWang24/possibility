import type { AccentName } from "./theme";

/**
 * The edit decision list — the single source of truth for the film.
 *
 * Editing the video means editing this array: clip choice, in-point, duration
 * and copy all live here, so the scene components stay presentational and the
 * landscape and vertical cuts can never drift apart.
 *
 * `trim` and `seconds` are in seconds. Clips were pre-cut to 30fps CFR by
 * `scripts/cut-clips.sh`, so one clip second is one composition second.
 */

export type SceneMode = "title" | "showcase";

export interface Scene {
  readonly id: string;
  readonly mode: SceneMode;
  /** Filename under public/clips. Omitted for full-frame title beats. */
  readonly clip?: string;
  /** In-point within the clip, in seconds. */
  readonly trim?: number;
  readonly seconds: number;
  readonly accent: AccentName;
  /** Wide-tracked Latin label, mirroring the app's own micro-labels. */
  readonly kicker?: string;
  /** Each entry is one rendered line; keep them short enough to read fast. */
  readonly lines?: readonly string[];
  /** Enlarge the device so the generative visuals get real estate. */
  readonly emphasis?: boolean;
  /** Put the device on the left instead of the right, for rhythm. */
  readonly flip?: boolean;
}

/** The full ~68s master cut. */
export const masterScript: readonly Scene[] = [
  {
    id: "open",
    mode: "title",
    seconds: 3,
    accent: "violet",
    // Kickers are set in Inter with heavy tracking — keep them Latin-only,
    // or CJK glyphs fall through to a system face and the tracking scatters.
    kicker: "KALEIDO",
    lines: ["深夜，一个", "不敢问同事的问题"],
  },
  {
    id: "question",
    mode: "showcase",
    clip: "01-question.mp4",
    // The home screen holds the typed question only until t≈6.5s, after which
    // the capture navigates into 语音日记. Do not run past it.
    trim: 2.5,
    seconds: 3.8,
    accent: "violet",
    kicker: "THE FORK",
    lines: ["我是否要从交互设计师", "转为产品经理？"],
  },
  {
    id: "held",
    mode: "showcase",
    clip: "02-ai-chat.mp4",
    trim: 2,
    seconds: 10,
    accent: "violet",
    kicker: "HELD, NOT ANSWERED",
    lines: ["它没急着给建议", "先把你的两难说清楚"],
  },
  {
    id: "simulate",
    mode: "showcase",
    clip: "03-lab-cards.mp4",
    trim: 4,
    seconds: 8.5,
    accent: "violet",
    kicker: "SIMULATE",
    lines: ["把这个选择", "推到五年后"],
  },
  {
    id: "compute",
    mode: "showcase",
    clip: "04-orb.mp4",
    trim: 1,
    seconds: 1.5,
    accent: "violet",
    emphasis: true,
  },
  {
    id: "futures",
    mode: "showcase",
    clip: "05-result-likely.mp4",
    // Stop before the tab flips to 最好的结果 — that beat belongs to `limit`.
    trim: 0.5,
    seconds: 7,
    accent: "violet",
    kicker: "THREE FUTURES",
    lines: ["三种可能", "连代价一起给你"],
  },
  {
    id: "limit",
    mode: "showcase",
    clip: "06-result-best.mp4",
    trim: 1,
    seconds: 7.5,
    accent: "violet",
    kicker: "THE LIMIT",
    lines: ["也告诉你", "最坏能坏到哪"],
  },
  {
    id: "turn",
    mode: "title",
    seconds: 2.5,
    accent: "cyan",
    kicker: "BUT —",
    lines: ["可它没真的", "走过这条路"],
  },
  {
    id: "someone",
    mode: "showcase",
    clip: "07-crystal.mp4",
    // The crystal holds ~1.5s, then resolves onto 与你的画像最相似的人 —
    // that reveal *is* the beat, so the scene ends on the person, not the gem.
    trim: 0.2,
    seconds: 2.6,
    accent: "cyan",
    kicker: "SOMEONE HAS",
    lines: ["有人走过"],
    emphasis: true,
    flip: true,
  },
  {
    id: "community",
    mode: "showcase",
    clip: "08-community.mp4",
    trim: 2,
    seconds: 6.5,
    accent: "cyan",
    kicker: "KALEIDOSCOPE",
    lines: ["和你同路的人", "都在这里"],
    emphasis: true,
    flip: true,
  },
  {
    id: "jianning",
    mode: "showcase",
    clip: "09-jianning.mp4",
    trim: 1,
    seconds: 9,
    accent: "cyan",
    // The profile on screen already says 交互设计师 → 产品经理 — don't narrate it.
    kicker: "JIANNING · 3 YEARS",
    lines: ["她真的走过这条路", "把坑都留给了后来人"],
  },
  {
    id: "form",
    mode: "showcase",
    clip: "10-profile.mp4",
    trim: 1,
    seconds: 5,
    accent: "cyan",
    kicker: "YOUR LIVE FORM",
    lines: ["你的选择", "也会成为别人的地图"],
  },
  {
    id: "close",
    mode: "title",
    seconds: 4,
    accent: "cyan",
    kicker: "KALEIDO",
    lines: ["万花筒", "AI 决策陪伴", "青年人生 OS"],
  },
];

/**
 * The social cut. Deliberately a different edit rather than a squeeze of the
 * master: it keeps only the question, the payoff and the human turn, and
 * holds each beat long enough to read on a phone.
 */
export const teaserScript: readonly Scene[] = [
  {
    id: "question",
    mode: "showcase",
    clip: "01-question.mp4",
    // The home screen holds the typed question only until t≈6.5s, after which
    // the capture navigates into 语音日记. Do not run past it.
    trim: 2.5,
    seconds: 3.8,
    accent: "violet",
    kicker: "THE FORK",
    lines: ["我是否要从交互设计师", "转为产品经理？"],
  },
  {
    id: "futures",
    mode: "showcase",
    clip: "05-result-likely.mp4",
    trim: 0.5,
    seconds: 5,
    accent: "violet",
    kicker: "THREE FUTURES",
    lines: ["三种可能", "连代价一起给你"],
  },
  {
    id: "turn",
    mode: "title",
    seconds: 2,
    accent: "cyan",
    kicker: "BUT —",
    lines: ["可它没真的", "走过这条路"],
  },
  {
    id: "someone",
    mode: "showcase",
    clip: "07-crystal.mp4",
    trim: 0.2,
    seconds: 2.6,
    accent: "cyan",
    kicker: "SOMEONE HAS",
    lines: ["有人走过"],
  },
  {
    id: "jianning",
    mode: "showcase",
    clip: "09-jianning.mp4",
    trim: 1,
    seconds: 5,
    accent: "cyan",
    // The profile on screen already says 交互设计师 → 产品经理 — don't narrate it.
    kicker: "JIANNING · 3 YEARS",
    lines: ["她真的走过这条路", "把坑都留给了后来人"],
  },
  {
    id: "close",
    mode: "title",
    seconds: 3,
    accent: "cyan",
    kicker: "KALEIDO",
    lines: ["万花筒", "AI 决策陪伴", "青年人生 OS"],
  },
];

export interface PlacedScene extends Scene {
  readonly from: number;
  readonly durationInFrames: number;
}

export interface Timeline {
  readonly scenes: readonly PlacedScene[];
  readonly totalFrames: number;
}

/**
 * Lay a script out on a timeline, overlapping neighbours by `crossfade`
 * frames so each scene can fade across the next one.
 */
export function buildTimeline(
  scenes: readonly Scene[],
  fps: number,
  crossfade: number,
): Timeline {
  let cursor = 0;
  const placedScenes = scenes.map((scene) => {
    const durationInFrames = Math.round(scene.seconds * fps);
    const placed: PlacedScene = { ...scene, from: cursor, durationInFrames };
    cursor += durationInFrames - crossfade;
    return placed;
  });

  return { scenes: placedScenes, totalFrames: cursor + crossfade };
}
