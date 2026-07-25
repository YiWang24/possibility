import { CARRY_DECK } from '@/data/lab-sim';
import { CARRY_LIMIT, CARRY_META } from '@/data/lab';
import type { CarryCardKey } from '@/data/lab';

interface CarryDeckProps {
  selected: CarryCardKey[];
  revealed: boolean;
  onToggle: (key: CarryCardKey) => void;
}

// 什么要一起带走 — pick up to CARRY_LIMIT bottom-line cards (~2087-2100 / toggleCarryCard).
export default function CarryDeck({ selected, revealed, onToggle }: CarryDeckProps) {
  return (
    <div className={`carry-section${revealed ? ' reveal' : ''}`} id="carrySection" data-testid="lab-carry-section">
      <div className="carry-head">
        <h3>什么要一起带走？</h3>
        <span>
          <b id="carryCount">{selected.length}</b>/{CARRY_LIMIT}
        </span>
      </div>
      <div className="carry-deck" id="carryDeck">
        {CARRY_DECK.map((c) => {
          const on = selected.includes(c.key);
          return (
            <button
              key={c.key}
              type="button"
              className={`carry-card${on ? ' on' : ''}`}
              data-carry={c.key}
              data-testid={`lab-carry-${c.key}`}
              aria-pressed={on}
              onClick={() => {
                onToggle(c.key);
              }}
            >
              <span className="glyph">{CARRY_META[c.key].glyph}</span>
              <b>{c.name}</b>
              <small>{c.clue}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
