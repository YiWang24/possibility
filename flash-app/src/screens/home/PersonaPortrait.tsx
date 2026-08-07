import { useAppStore } from '@/store/appStore';
import PersonaCanvas from '@/components/PersonaCanvas';
import { LIFE_BASE_CARDS } from '@/data/life';
import { portraitCompletion, usePortraitStore, type PortraitDimKey } from '@/screens/studio/portraitStore';

interface Dim {
  key: PortraitDimKey;
  glyph: string;
  bg: string;
  label: string;
}

const DIMS: readonly Dim[] = [
  { key: 'personality', glyph: '◎', bg: 'rgba(89,104,217,.16)', label: '人格底色' },
  { key: 'skill', glyph: '✦', bg: 'rgba(94,150,255,.15)', label: '我擅长' },
  { key: 'like', glyph: '♡', bg: 'rgba(227,92,193,.15)', label: '我喜欢' },
  { key: 'love', glyph: '✿', bg: 'rgba(255,122,77,.16)', label: '我在恋爱关系中在意' },
  { key: 'family', glyph: '⌂', bg: 'rgba(62,217,164,.14)', label: '我在家庭关系中在意' },
  { key: 'social', glyph: '◎', bg: 'rgba(94,150,255,.15)', label: '我在人际交往中在意' },
];

// Three "人生底牌" that (in the prototype) feed the dynamic persona. We seed a
// meaningful trio from the real card deck: 亲情 / 才华 / 健康.
const SIGNATURE = [LIFE_BASE_CARDS[0], LIFE_BASE_CARDS[5], LIFE_BASE_CARDS[16]].filter((c): c is (typeof LIFE_BASE_CARDS)[number] => c !== undefined);

export default function PersonaPortrait() {
  const openPush = useAppStore((s) => s.openPush);
  const openDimensionSheet = useAppStore((s) => s.openDimensionSheet);
  const dims = usePortraitStore((s) => s.dims);
  const { percent } = portraitCompletion(dims);

  const openStudio = (): void => {
    openPush('profileStudio');
  };

  // 维度点击路由（对齐 iOS HomeView.handleDimTap）：软维度开关键词浮层，
  // 人格底色没有关键词可选，直接进大五测评。
  const enterDim = (key: PortraitDimKey): void => {
    if (key === 'personality') {
      openPush('assessmentPage', { assessmentKind: 'bigfive' });
      return;
    }
    openDimensionSheet(key);
  };

  return (
    <>
      <div className="sec-t">
        <h3>我的动态画像</h3>
        <button type="button" className="lnk" data-testid="portrait-more" onClick={openStudio}>
          探索更多画像 ›
        </button>
      </div>

      <div className="card portrait">
        <div className="digital-human-stage">
          <PersonaCanvas testId="persona-canvas-home" />
          <span className="digital-human-live">LIVE PROFILE FORM</span>
          <div className="digital-human-caption">
            <b>屿岸 · 动态数字形象</b>
            <span id="dynamicPersonaMeta">由当前画像维度生成 · 持续生长</span>
          </div>
        </div>

        <div className="portrait-life-signature" id="lifeSignature" aria-label="参与动态画像生成的三张人生底牌">
          <div className="signature-head">
            <b>我的人生底牌</b>
            <span>已参与数字形象生成</span>
          </div>
          <div className="cards" id="lifeSignatureCards">
            {SIGNATURE.map((c) => (
              <span key={c.id}>
                {c.glyph} {c.name}
              </span>
            ))}
          </div>
        </div>

        <div className="pbar">
          <div className="tr">
            <i id="pfill" style={{ width: `${String(percent)}%` }} />
          </div>
          <span id="ppct">{percent}%</span>
        </div>

        <div className="dims">
          {DIMS.map((d) => {
            const value = dims[d.key];
            const filled = value !== undefined && value !== '';
            return (
              <button
                key={d.key}
                type="button"
                className={`dim${filled ? '' : ' todo'}`}
                data-testid={`dim-${d.key}`}
                onClick={() => {
                  enterDim(d.key);
                }}
              >
                <span className="ic" style={{ background: d.bg }}>
                  {d.glyph}
                </span>
                <span className="tx">
                  <b>{d.label}</b>
                  <p className={filled ? '' : 'empty'}>{filled ? value : '尚未填写'}</p>
                </span>
                <span className="ar">›</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
