// Shared primitives used across several seed-data modules.

/** Escalating pressure level used by life / marriage / value card games (1 = mild, 4 = extreme). */
export type SeverityLevel = 1 | 2 | 3 | 4;

/** Copy shown for a given severity level. Severity arrays are 1-indexed, so index 0 is `null`. */
export interface SeverityMeta {
  name: string;
  copy: string;
}
