// Big Five (大五人格) facet types + composition
// (source: prototype line ~6198, `BIG_FIVE_FACETS`). Facet data is split across
// bigFiveA/bigFiveB to keep files <=300 lines; order is preserved on concat.

import { BIG_FIVE_FACETS_A } from './bigFiveA';
import { BIG_FIVE_FACETS_B } from './bigFiveB';

export type BigFiveDim = 'O' | 'C' | 'E' | 'A' | 'N';

/** A facet item: `[text, reverseScored]`. */
export type BigFiveFacetItem = [text: string, reverse: boolean];

export interface BigFiveFacet {
  d: BigFiveDim;
  /** Facet code, e.g. 'N1'. */
  f: string;
  name: string;
  /** Exactly four items, one per assessment round. */
  items: [BigFiveFacetItem, BigFiveFacetItem, BigFiveFacetItem, BigFiveFacetItem];
}

/** 30 facets (6 per dimension), in original round-major order. */
export const BIG_FIVE_FACETS: BigFiveFacet[] = [...BIG_FIVE_FACETS_A, ...BIG_FIVE_FACETS_B];
