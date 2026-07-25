import type { CardDeck } from '@/data/cardgames';

// Grouped scenario preview (source: renderRelationshipDraw / renderRelationshipDecision
// markup — .fate-pressure severity-N + .marriage-scenario-card, ~7616 / ~7647).

const LEVELS = [1, 2, 3, 4] as const;

interface DeckScenariosProps {
  deck: CardDeck;
}

export default function DeckScenarios({ deck }: DeckScenariosProps) {
  const code = deck.eyebrow.split(' ')[0] ?? deck.eyebrow;

  return (
    <div className="deck-scenarios">
      <div className="stage-copy">
        <div className="ey">SCENARIOS</div>
        <h2>这套卡牌会面对的情境</h2>
        <p>接受会保留底牌并让压力加码，不接受就交换——这里先完整浏览一遍。</p>
      </div>
      {LEVELS.map((level) => {
        const meta = deck.severity[level];
        const scenarios = deck.scenarios.filter((scenario) => scenario.severity === level);
        if (meta == null || scenarios.length === 0) return null;
        return (
          <section key={level} className="deck-scenario-group">
            <div className={`fate-pressure severity-${String(level)}`}>
              <div className="head">
                <span>压力</span>
                <b>{meta.name}</b>
              </div>
              <div className="track">
                {LEVELS.map((mark) => (
                  <i key={mark} className={mark <= level ? 'on' : ''} />
                ))}
              </div>
              <p>{meta.copy}</p>
            </div>
            {scenarios.map((scenario, i) => (
              <div key={scenario.title} className="marriage-scenario-card">
                <div className="serial">
                  {code} · {String(i + 1).padStart(2, '0')} · {scenario.theme}
                </div>
                <span className="mark">{deck.glyph}</span>
                <h2>{scenario.title}</h2>
                <p>{scenario.copy}</p>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
