import { useState } from 'react';
import { useAppStore, usePushOpen, usePushPayload } from '@/store/appStore';
import { getCardDeck, type DeckKind } from '@/data/cardgames';
import DeckView from '@/screens/home/cards/DeckView';
import { joinKeywords } from '@/screens/studio/assessmentEngine';
import { usePortraitStore } from '@/screens/studio/portraitStore';

const OTHER_DECKS: { kind: DeckKind; cls: string; mark: string; title: string; desc: string }[] = [
  { kind: 'marriage', cls: 'marriage', mark: '♡', title: '婚姻关系卡牌', desc: '看见婚姻中最想守住的承诺、边界与未来' },
  { kind: 'family', cls: 'family', mark: '⌂', title: '家庭关系卡牌', desc: '看见家庭中最关心的安全、支持与自主' },
  { kind: 'social', cls: 'social', mark: '◎', title: '人际交往卡牌', desc: '看见交往中最重视的真诚、边界与连接' },
];

export default function CardGameHubPush() {
  const open = usePushOpen('cardGameHub');
  const payload = usePushPayload('cardGameHub');
  const closePush = useAppStore((s) => s.closePush);
  const showToast = useAppStore((s) => s.showToast);
  const setDim = usePortraitStore((s) => s.setDim);

  const [selectedKind, setSelectedKind] = useState<DeckKind | null>(null);
  const [prevOpen, setPrevOpen] = useState(false);

  // Opening the hub lands on the deck picker, unless a caller (维度浮层的卡牌
  // 工具) asked for one specific deck.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setSelectedKind(payload.deck ?? null);
  }

  const deck = selectedKind !== null ? getCardDeck(selectedKind) : null;
  const writeBackDim = payload.writeBackDim;
  // 从维度浮层进来时，只玩这一副牌：返回直接关页面，不落回选择器。
  const lockedToOneDeck = payload.deck !== undefined;
  const back = () => {
    if (selectedKind !== null && !lockedToOneDeck) setSelectedKind(null);
    else closePush('cardGameHub');
  };

  const saveToProfile =
    writeBackDim !== undefined
      ? (cardNames: string[]): void => {
          setDim(writeBackDim, joinKeywords(cardNames));
          showToast('已写入画像 · 可以继续用关键词修正');
          closePush('cardGameHub');
        }
      : undefined;

  return (
    <section className={`push card-game-hub${open ? ' open' : ''}`} id="cardGameHub" data-testid="push-cardGameHub">
      <div className="top">
        <button type="button" className="backbtn" data-testid="push-cardGameHub-back" aria-label="返回认识自己" onClick={back}>
          ‹
        </button>
        <div>
          <h2>{deck?.topTitle ?? '卡牌探索'}</h2>
          <div className="sub2">{deck?.topSub ?? '选择一套卡牌，看看最后会留下什么'}</div>
        </div>
      </div>
      <div className="scroll">
        {selectedKind === null ? (
          <>
            <div className="card-hub-hero">
              <div className="ey">CARD EXPLORATION</div>
              <h2>在取舍中，看见你真正重视的事</h2>
              <p>跟着直觉做出选择，在一次次取舍里，留下此刻对你最重要的三件事。</p>
            </div>
            <button
              type="button"
              className="card-game-primary"
              data-testid="card-deck-life"
              onClick={() => {
                setSelectedKind('life');
              }}
            >
              <span className="card-primary-intro">
                <span className="card-hub-deck">
                  <i />
                  <i />
                </span>
                <span className="card-primary-copy">
                  <span className="cap">LIFE CARDS · 5–8 分钟</span>
                  <span className="title">人生卡牌：你最后会留下什么？</span>
                  <span className="desc">从能力、关系、信念与现实支点中先选九张，经历一段不断要求取舍的人生。</span>
                </span>
              </span>
              <span className="card-game-rule-strip">
                <span>
                  <b>01 · 选择</b>先凭直觉选 9 张
                </span>
                <span>
                  <b>02 · 加码</b>接受后情境升级
                </span>
                <span>
                  <b>03 · 交换</b>拒绝就放下 2 张
                </span>
              </span>
              <span className="start">
                <b>开始取舍</b>
              </span>
            </button>
            <div className="card-hub-other">
              <div className="card-hub-other-head">
                <b>也可以，从一段关系开始</b>
                <span>每套约 3 分钟</span>
              </div>
              <div className="card-game-options">
                {OTHER_DECKS.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    className={`card-game-option ${item.cls}`}
                    data-testid={`card-deck-${item.kind}`}
                    onClick={() => {
                      setSelectedKind(item.kind);
                    }}
                  >
                    <span className="mark">{item.mark}</span>
                    <span className="copy">
                      <b>{item.title}</b>
                      <p>{item.desc}</p>
                      <small>选 9 张 · 多轮加码 · 最终留 3 张</small>
                    </span>
                    <span className="go">›</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <DeckView
            key={selectedKind}
            deck={getCardDeck(selectedKind)}
            showToast={showToast}
            onDone={() => {
              if (lockedToOneDeck) closePush('cardGameHub');
              else setSelectedKind(null);
            }}
            {...(saveToProfile !== undefined ? { onSaveToProfile: saveToProfile } : {})}
          />
        )}
      </div>
    </section>
  );
}
