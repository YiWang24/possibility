// 画像工作室 push (source: prototype #profileStudio ~2387, `openProfileStudio`
// ~6266)。六个入口全部接通：人格底色进大五测评（完整版 / 快速版在测评页内切换），
// 五个生活画像维度开关键词浮层。卡片按「未填 / 续答 / 已完成」三态回显。

import type { CSSProperties } from 'react';
import { useAppStore, usePushOpen } from '@/store/appStore';
import { DIMENSION_CONFIG, type DimensionKey } from '@/data/dimensions';
import { assessmentSpec, type AssessmentKind } from '@/screens/studio/assessmentConfig';
import { resultTags } from '@/screens/studio/assessmentEngine';
import { snapshotOf, useAssessmentStore, type AssessmentSnapshot } from '@/screens/studio/assessmentStore';
import { usePortraitStore } from '@/screens/studio/portraitStore';
import { bigFiveCardState, dimCardState } from '@/screens/studio/studioCardState';
import StudioMbtiPanel from '../me/StudioMbtiPanel';

interface DimCard {
  key: DimensionKey;
  mark: string;
  markStyle: CSSProperties;
  fallback: string;
  /** 该维度关联的测评；人际维度只有卡牌，没有测评。 */
  assessment: AssessmentKind | null;
}

const DIM_CARDS: readonly DimCard[] = [
  {
    key: 'skill',
    mark: '✦',
    markStyle: { color: '#BFD2FF', background: 'rgba(94,150,255,.15)' },
    fallback: '选择关键词、换一批，也可以自己输入',
    assessment: 'strength',
  },
  {
    key: 'like',
    mark: '♡',
    markStyle: { color: '#F4BDE0', background: 'rgba(227,92,193,.15)' },
    fallback: '可用关键词或霍兰德兴趣测评继续探索',
    assessment: 'holland',
  },
  {
    key: 'love',
    mark: '✿',
    markStyle: { color: '#FFB69E', background: 'rgba(255,122,77,.16)' },
    fallback: '关键词、关系测评与婚姻卡牌',
    assessment: 'love',
  },
  {
    key: 'family',
    mark: '⌂',
    markStyle: { color: '#8EE7C8', background: 'rgba(62,217,164,.14)' },
    fallback: '关键词、家庭关系测评与家庭卡牌',
    assessment: 'family',
  },
  {
    key: 'social',
    mark: '◎',
    markStyle: { color: '#BFD2FF', background: 'rgba(94,150,255,.15)' },
    fallback: '关键词与人际交往卡牌',
    assessment: null,
  },
];

const SOURCE_KEY: readonly { color: string; label: string }[] = [
  { color: '#5968D9', label: '正式量表' },
  { color: '#A85586', label: '主题探索' },
  { color: '#B77928', label: '人生卡牌' },
  { color: '#258579', label: '自己填写' },
  { color: '#60758A', label: '日记推断' },
];

const BIGFIVE_FALLBACK = '120题，从五个主要维度和三十个细分面向理解你的稳定倾向。';

/** 有结果时取前两个标签做卡片摘要，没有就返回空数组。 */
function summaryTags(kind: AssessmentKind, snapshot: AssessmentSnapshot): string[] {
  return snapshot.result !== null ? resultTags(assessmentSpec(kind), snapshot.result) : [];
}

export default function ProfileStudioPush() {
  const open = usePushOpen('profileStudio');
  const closePush = useAppStore((s) => s.closePush);
  const openPush = useAppStore((s) => s.openPush);
  const openDimensionSheet = useAppStore((s) => s.openDimensionSheet);
  const byKind = useAssessmentStore((s) => s.byKind);
  const dims = usePortraitStore((s) => s.dims);

  const fullSnap = snapshotOf(byKind.bigfive);
  const liteSnap = snapshotOf(byKind.bigfiveLite);
  const bigFive = bigFiveCardState({
    full: fullSnap,
    lite: liteSnap,
    fullTags: summaryTags('bigfive', fullSnap),
    liteTags: summaryTags('bigfiveLite', liteSnap),
    fallback: BIGFIVE_FALLBACK,
  });

  const startContextScan = (): void => {
    closePush('profileStudio');
    openPush('contextPage');
  };

  return (
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
            <p id="bigFiveStudioMeta">{bigFive.meta}</p>
            <div className="studio-meta">
              <i>120 题 / 快速版 30 题</i>
              <i>约 15–20 分钟</i>
              <i>默认私密</i>
            </div>
            <button
              type="button"
              id="bigFiveStudioAction"
              data-testid="studio-bigfive"
              onClick={() => {
                openPush('assessmentPage', { assessmentKind: bigFive.kind });
              }}
            >
              {bigFive.action}
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
            {DIM_CARDS.map((card) => {
              const state = dimCardState({
                filled: dims[card.key],
                snapshot: card.assessment !== null ? snapshotOf(byKind[card.assessment]) : null,
                fallback: card.fallback,
                isHolland: card.assessment === 'holland',
              });
              return (
                <div className="assessment-card" id={`${card.key}StudioCard`} key={card.key}>
                  <span className="mark" style={card.markStyle}>
                    {card.mark}
                  </span>
                  <span className="info">
                    <b>{DIMENSION_CONFIG[card.key].title}</b>
                    <p id={`${card.key}StudioMeta`}>{state.meta}</p>
                  </span>
                  <button
                    type="button"
                    className="act ready"
                    id={`${card.key}StudioAction`}
                    data-testid={`studio-dim-${card.key}`}
                    onClick={() => {
                      openDimensionSheet(card.key);
                    }}
                  >
                    {state.action}
                  </button>
                  {state.progress !== null ? (
                    <span className="resume">
                      <i style={{ width: `${String(state.progress * 100)}%` }} />
                    </span>
                  ) : null}
                </div>
              );
            })}
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
  );
}
