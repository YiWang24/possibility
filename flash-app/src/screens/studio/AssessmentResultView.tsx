// 测评结果页（原型 #assessmentResultPage · renderHollandResult /
// renderDemoAssessmentResult）。作为答题页的 result 阶段渲染在 .assessment-body 内，
// 与原本的 HollandQuiz 一致，因此复用同一套 .result-* 样式。

import type { CSSProperties } from 'react';
import { useMyProfileStore } from '@/screens/me/myProfileStore';
import { useAppStore } from '@/store/appStore';
import type { AssessmentSpec } from './assessmentConfig';
import { dimOf, joinKeywords, personalityText, resultNarrative, resultTags, topFacets, type AssessmentResult } from './assessmentEngine';
import { usePortraitStore } from './portraitStore';

interface AssessmentResultViewProps {
  spec: AssessmentSpec;
  result: AssessmentResult;
  /** 写入画像后关闭答题页。 */
  onSaved: () => void;
}

function methodNote(spec: AssessmentSpec): string {
  if (spec.kind === 'holland') {
    return '兴趣不等于能力、人格或资格。本结果来自O*NET Mini Interest Profiler的中文验证中版本，用于扩展探索，不替你决定职业。';
  }
  if (spec.kind === 'bigfive' || spec.kind === 'bigfiveLite') {
    return '人格分数描述的是连续倾向，不是固定类型，也不用于临床诊断、招聘筛选或替你做重要决定。';
  }
  return '本测试为产品 Demo 构念改写版，不等同于对应量表的官方中文版，也不用于临床诊断、招聘筛选或替你做重要决定。';
}

export default function AssessmentResultView({ spec, result, onSaved }: AssessmentResultViewProps) {
  const setDim = usePortraitStore((s) => s.setDim);
  const mbti = useMyProfileStore((s) => s.mbti);
  const showToast = useAppStore((s) => s.showToast);
  const closeDimensionSheet = useAppStore((s) => s.closeDimensionSheet);

  const isHolland = spec.kind === 'holland';
  const tags = resultTags(spec, result);
  const facets = topFacets(spec, result);

  // 霍兰德以并列组展开后的 selected 为准；其余看分数前二。
  const topKeys = isHolland ? (result.selected ?? result.ordered.slice(0, 3)) : result.ordered.slice(0, 2);
  const heroCode = isHolland ? (result.displayCode ?? result.code ?? '') : tags.slice(0, 2).join(' · ');
  const topNames = topKeys.map((key) => (dimOf(spec, key)?.name ?? key).replace('型', '')).join('、');

  const descs = topKeys.flatMap((key) => {
    const desc = dimOf(spec, key)?.desc;
    return desc !== undefined && desc !== '' ? [desc] : [];
  });
  const insightDesc = isHolland ? descs.slice(0, 2).join('') : `${descs.slice(0, 2).join('；')}。这些信号可以被后续经历、日记和你的主动修改继续校正。`;

  const save = (): void => {
    const text = spec.target === 'personality' ? personalityText(tags, mbti) : joinKeywords(tags);
    setDim(spec.target, text);
    // 从维度浮层里进来时浮层还开着，它的草稿停留在打开那一刻。不关掉的话，
    // 用户接着按浮层的「保存到我的画像」会用旧草稿盖掉刚写进去的测评结果。
    closeDimensionSheet();
    showToast('结果已写入画像 · 原始答案默认私密');
    onSaved();
  };

  return (
    <>
      <div className="result-hero">
        <div className="overline">{isHolland ? 'YOUR INTEREST CONSTELLATION' : 'YOUR CURRENT PROFILE SIGNAL'}</div>
        <div className="code" style={heroCode.length > 5 ? { fontSize: '24px', letterSpacing: '.06em' } : {}}>
          {heroCode}
        </div>
        <h3>
          {isHolland ? (
            <>
              你的兴趣更靠近
              <br />
              {topNames}
            </>
          ) : (
            <>
              这不是给你定型，
              <br />
              而是留下当前可修正的证据。
            </>
          )}
        </h3>
        <p>{resultNarrative(spec, result)}</p>
      </div>

      <div className="riasec-bars">
        {spec.dims.map((dim) => {
          const score = result.scores[dim.key] ?? 0;
          return (
            <div className="rbar" key={dim.key}>
              <b>{isHolland ? dim.key : dim.name.slice(0, 2)}</b>
              <div className="track">
                <i style={{ width: `${String((score / spec.scoreMax) * 100)}%`, background: dim.color }} />
              </div>
              <span>{spec.scoring === 'sum' ? `${String(score)}/${String(spec.scoreMax)}` : String(score)}</span>
            </div>
          );
        })}
      </div>

      {facets.length > 0 ? (
        <div className="facet-summary">
          <h4>更突出的细分面向</h4>
          <p>完整版同时计算30个细分面向。这里先展示当前得分较高的6项。</p>
          <div className="facet-list">
            {facets.map((facet) => (
              <div className="facet-item" key={facet.code}>
                <b>{facet.name}</b>
                <span>
                  {facet.dimLabel} · {facet.score}
                </span>
                <i style={{ '--score': `${String(facet.score)}%` } as CSSProperties} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="result-insight">
        <div className="cap">PROFILE SIGNAL · 可写入画像</div>
        <h4>{tags.join(' · ')}</h4>
        <p>{insightDesc}</p>
        <div className="result-tags">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>

      <p className="method-note">{methodNote(spec)}</p>
      <button type="button" className="result-save" data-testid="assessment-save" onClick={save}>
        {spec.saveLabel}
      </button>
    </>
  );
}
