import { useState } from 'react';
import { dominantGroup, type CardDeck, type DeckCard } from '@/data/cardgames';
import DeckScenarios from './DeckScenarios';

// Simplified deck flow: intro → pick the 3 cards you'd keep + browse the scenario
// list → a 结果 summary. The full multi-round accept / trade / pressure-escalation
// engine (原型 renderRelationshipDraw…renderRelationshipResult) is intentionally
// collapsed to the final "留下三张" outcome.

type DeckPhase = 'intro' | 'browse' | 'result';

interface DeckViewProps {
  deck: CardDeck;
  showToast: (msg: string) => void;
  onDone: () => void;
  /**
   * 从维度浮层进来时提供：把留下的三张底牌名写回对应画像维度。
   * 不提供时保持原本「保存并返回卡牌选择」的行为。
   */
  onSaveToProfile?: (cardNames: string[]) => void;
}

export default function DeckView({ deck, showToast, onDone, onSaveToProfile }: DeckViewProps) {
  const [phase, setPhase] = useState<DeckPhase>('intro');
  const [picked, setPicked] = useState<string[]>([]);

  const code = deck.eyebrow.split(' ')[0] ?? deck.eyebrow;
  const pickedCards = picked.map((id) => deck.cards.find((card) => card.id === id)).filter((card): card is DeckCard => card !== undefined);

  const toggle = (id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((cardId) => cardId !== id);
      if (prev.length >= 3) {
        showToast('这一局先留下最重要的 3 张');
        return prev;
      }
      return [...prev, id];
    });
  };

  if (phase === 'intro') {
    return (
      <>
        <div className="life-intro">
          <div className="linear-spread spread" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((n) => (
              <i key={n} className="linear-card" />
            ))}
          </div>
          <div className="ey">{deck.eyebrow}</div>
          <h2 dangerouslySetInnerHTML={{ __html: deck.introQuestionHTML }} />
          <p>{deck.introCopy}</p>
          <div className="life-rules">
            {deck.rules.map((rule) => (
              <div key={rule.no} className="life-rule">
                <i>{rule.no}</i>
                <div>
                  <b>{rule.title}</b>
                  <p>{rule.desc}</p>
                </div>
              </div>
            ))}
          </div>
          {deck.contentWarning !== undefined ? <div className="content-warning">{deck.contentWarning}</div> : null}
        </div>
        <div className="life-foot">
          <button
            type="button"
            className="btn-ink"
            data-testid="deck-start"
            onClick={() => {
              setPhase('browse');
            }}
          >
            {deck.startLabel}
          </button>
        </div>
      </>
    );
  }

  if (phase === 'browse') {
    const ready = picked.length === 3;
    return (
      <>
        <div className="life-select-summary">
          <div className="row">
            <div>
              <div className="ey">{deck.eyebrow}</div>
              <h2>留下此刻最重要的三点</h2>
            </div>
            <div className="life-select-count">
              已留
              <br />
              <b>{picked.length}</b>
              <small>/3</small>
            </div>
          </div>
          <div className="life-select-meter">
            <i style={{ width: `${String((picked.length / 3) * 100)}%` }} />
          </div>
        </div>
        <div className="life-select-guide">
          <span>点击卡牌，选出此刻真正想守住的三点</span>
          <i>向下滑动 ↓</i>
        </div>
        <div className="marriage-select-grid">
          {deck.cards.map((card, i) => {
            const on = picked.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                className={`marriage-pick-card${on ? ' on' : ''}`}
                data-testid={`deck-card-${card.id}`}
                aria-pressed={on}
                onClick={() => {
                  toggle(card.id);
                }}
              >
                <span className="card-no">
                  {code} · {String(i + 1).padStart(2, '0')}
                </span>
                <span className="glyph">{card.glyph}</span>
                <span>
                  <b>{card.name}</b>
                  <em>{card.group}</em>
                </span>
                <small>✓</small>
              </button>
            );
          })}
        </div>
        <div className="life-select-end">
          已展示全部 {deck.cards.length} 张{deck.dimensionTitle}底牌
        </div>

        <DeckScenarios deck={deck} />

        <div className="life-foot">
          <button
            type="button"
            className="btn-ink"
            data-testid="deck-reveal"
            disabled={!ready}
            onClick={() => {
              setPhase('result');
            }}
          >
            {ready ? '看看会留下什么' : `还需选择 ${String(3 - picked.length)} 张`}
          </button>
        </div>
      </>
    );
  }

  const top = dominantGroup(pickedCards);
  return (
    <>
      <div className="relation-result">
        <div className="heart">{deck.glyph}</div>
        <h2>{deck.dimensionTitle}中，你最想留下这三点</h2>
        <p>
          {deck.groupCopy[top] ?? '这三点构成了你此刻最想守住的优先级。'}
          <br />
          它们来自你此刻的直觉取舍，仍可以被未来的经历继续修正。
        </p>
        <div className="relation-final-cards">
          {pickedCards.map((card) => (
            <div key={card.id} className="relation-final-card">
              <i>{card.glyph}</i>
              <b>{card.name}</b>
            </div>
          ))}
        </div>
        <div className="result-insight" style={{ textAlign: 'left', marginTop: 16 }}>
          <div className="cap">{deck.resultCap}</div>
          <h4>{pickedCards.map((card) => card.name).join(' · ')}</h4>
          <p>这是简化版取舍：完整玩法会经历多轮情境、加码与交换，这里直接从 {deck.cards.length} 张底牌里留下最重要的三点。</p>
        </div>
      </div>
      <div className="life-foot">
        <button
          type="button"
          className="btn-ink"
          data-testid="deck-save"
          onClick={() => {
            if (onSaveToProfile !== undefined) {
              onSaveToProfile(pickedCards.map((card) => card.name));
              return;
            }
            showToast(`已记录${deck.dimensionTitle}中最想留下的三点`);
            onDone();
          }}
        >
          {onSaveToProfile !== undefined ? `写入「${deck.dimensionTitle}」` : '保存并返回卡牌选择'}
        </button>
      </div>
    </>
  );
}
