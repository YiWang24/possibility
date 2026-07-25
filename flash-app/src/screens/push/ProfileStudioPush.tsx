// 画像工作室 push (source: prototype #profileStudio ~2387, `openProfileStudio`
// ~6266). Reproduces the studio entry cards + MBTI picker faithfully. The big-five
// / dimension-keyword engines live on the "认识自己" page and are simplified here
// (noted via toast); the 我喜欢 card opens the reproduced Holland quiz shell.

import { useState } from 'react';
import { useAppStore, usePushOpen } from '@/store/appStore';
import StudioMbtiPanel from '../me/StudioMbtiPanel';
import HollandQuiz from '../me/HollandQuiz';
import { DIMENSION_CONFIG, type DimensionKey } from '@/data/dimensions';

/** Studio card id → its DIMENSION_CONFIG key. */
const DIM_KEY: Record<string, DimensionKey> = {
  strength: 'skill',
  holland: 'like',
  love: 'love',
  family: 'family',
  social: 'social',
};

interface DimCard {
  id: string;
  mark: string;
  markStyle: React.CSSProperties;
  label: string;
  meta: string;
}

const DIM_CARDS: readonly DimCard[] = [
  {
    id: 'strength',
    mark: '✦',
    markStyle: { color: '#BFD2FF', background: 'rgba(94,150,255,.15)' },
    label: '我擅长',
    meta: '选择关键词、换一批，也可以自己输入',
  },
  {
    id: 'holland',
    mark: '♡',
    markStyle: { color: '#F4BDE0', background: 'rgba(227,92,193,.15)' },
    label: '我喜欢',
    meta: '可用关键词或霍兰德兴趣测评继续探索',
  },
  {
    id: 'love',
    mark: '✿',
    markStyle: { color: '#FFB69E', background: 'rgba(255,122,77,.16)' },
    label: '我在恋爱关系中在意',
    meta: '关键词、关系测评与婚姻卡牌',
  },
  {
    id: 'family',
    mark: '⌂',
    markStyle: { color: '#8EE7C8', background: 'rgba(62,217,164,.14)' },
    label: '我在家庭关系中在意',
    meta: '关键词、家庭关系测评与家庭卡牌',
  },
  { id: 'social', mark: '◎', markStyle: { color: '#BFD2FF', background: 'rgba(94,150,255,.15)' }, label: '我在人际交往中在意', meta: '关键词与人际交往卡牌' },
];

const SOURCE_KEY: readonly { color: string; label: string }[] = [
  { color: '#5968D9', label: '正式量表' },
  { color: '#A85586', label: '主题探索' },
  { color: '#B77928', label: '人生卡牌' },
  { color: '#258579', label: '自己填写' },
  { color: '#60758A', label: '日记推断' },
];

export default function ProfileStudioPush() {
  const open = usePushOpen('profileStudio');
  const closePush = useAppStore((s) => s.closePush);
  const openPush = useAppStore((s) => s.openPush);
  const showToast = useAppStore((s) => s.showToast);
  const [hollandOpen, setHollandOpen] = useState(false);

  const onDimEnter = (id: string): void => {
    if (id === 'holland') {
      setHollandOpen(true);
      return;
    }
    const key = DIM_KEY[id];
    const title = key !== undefined ? DIMENSION_CONFIG[key].title : '该维度';
    showToast(`「${title}」关键词面板在「认识自己」页 · 此处为简化 Demo`);
  };

  const startContextScan = (): void => {
    closePush('profileStudio');
    openPush('contextPage');
  };

  return (
    <>
      <section className={`push studio-page${open ? ' open' : ''}`} id="profileStudio" data-testid="push-profileStudio">
        <div className="top">
          <button
            type="button"
            className="backbtn"
            data-testid="push-profileStudio-back"
            aria-label="返回"
            onClick={() => {
              closePush('profileStudio');
            }}
          >
            ‹
          </button>
          <div>
            <h2>画像工作室</h2>
            <div className="sub2">每次只做一件，画像慢慢长出来</div>
          </div>
        </div>

        <div className="scroll">
          <div className="studio-hero">
            <div className="studio-kicker">PROFILE ATELIER · 私密探索</div>
            <h3>
              不是把你归类，
              <br />
              而是留下可以修正的证据。
            </h3>
            <p>标准量表、主题探索和你自己的话会分开记录。原始答案默认仅自己可见。</p>
          </div>

          <div className="studio-section">
            <div className="studio-section-head">
              <b>人格底色</b>
              <span>完整测评 · 任选其一开始</span>
            </div>
            <div className="studio-primary" id="bigFiveStudioCard">
              <div className="line">SCIENTIFIC BASELINE</div>
              <h4>大五人格</h4>
              <p id="bigFiveStudioMeta">120题，从五个主要维度和三十个细分面向理解你的稳定倾向。</p>
              <div className="studio-meta">
                <i>120 题</i>
                <i>约 15–20 分钟</i>
                <i>默认私密</i>
              </div>
              <button
                type="button"
                id="bigFiveStudioAction"
                data-testid="studio-bigfive"
                onClick={() => {
                  showToast('大五人格为简化 Demo · 完整评分引擎从略');
                }}
              >
                进入测试
              </button>
            </div>
          </div>

          <div className="studio-section">
            <div className="studio-section-head">
              <b>此刻的处境</b>
              <span>状态不是人格</span>
            </div>
            <div className="context-scan-card">
              <div className="line">CONTEXT CHECK-IN · 约 2 分钟</div>
              <h4>最近，什么正在作用于你？</h4>
              <p>不测你是哪类人。只把精力、现实压力、支持与选择空间分开看，避免把一时的处境写成永久的性格。</p>
              <button type="button" data-testid="studio-context" onClick={startContextScan}>
                开始处境扫描
              </button>
            </div>
          </div>

          <div className="studio-section">
            <div className="studio-section-head">
              <b>生活画像</b>
              <span>与数字人下方维度一致</span>
            </div>
            <div className="assessment-grid">
              {DIM_CARDS.map((card) => (
                <div className="assessment-card" id={`${card.id}StudioCard`} key={card.id}>
                  <span className="mark" style={card.markStyle}>
                    {card.mark}
                  </span>
                  <span className="info">
                    <b>{card.label}</b>
                    <p id={`${card.id}StudioMeta`}>{card.meta}</p>
                  </span>
                  <button
                    type="button"
                    className="act ready"
                    id={`${card.id}StudioAction`}
                    data-testid={`studio-dim-${card.id}`}
                    onClick={() => {
                      onDimEnter(card.id);
                    }}
                  >
                    进入
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="studio-section">
            <div className="studio-section-head">
              <b>MBTI</b>
              <span>可随时修改</span>
            </div>
            <StudioMbtiPanel />
          </div>

          <div className="source-key">
            {SOURCE_KEY.map((entry) => (
              <span key={entry.label}>
                <i style={{ background: entry.color }} />
                {entry.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <HollandQuiz
        open={open && hollandOpen}
        onClose={() => {
          setHollandOpen(false);
        }}
      />
    </>
  );
}
