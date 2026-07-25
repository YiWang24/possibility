import { useAppStore } from '@/store/appStore';
import PersonaCanvas from '@/components/PersonaCanvas';
import { LIFE_BASE_CARDS } from '@/data/life';

interface Dim {
  id: string;
  glyph: string;
  bg: string;
  label: string;
  value: string;
}

const DIMS: Dim[] = [
  { id: 'personality', glyph: '◎', bg: 'rgba(89,104,217,.16)', label: '人格底色', value: '尚未填写' },
  { id: 'skill', glyph: '✦', bg: 'rgba(94,150,255,.15)', label: '我擅长', value: '尚未填写' },
  { id: 'like', glyph: '♡', bg: 'rgba(227,92,193,.15)', label: '我喜欢', value: '尚未填写' },
  { id: 'love', glyph: '✿', bg: 'rgba(255,122,77,.16)', label: '我在恋爱关系中在意', value: '尚未填写' },
  { id: 'family', glyph: '⌂', bg: 'rgba(62,217,164,.14)', label: '我在家庭关系中在意', value: '尚未填写' },
  { id: 'social', glyph: '◎', bg: 'rgba(94,150,255,.15)', label: '我在人际交往中在意', value: '尚未填写' },
];

// Three "人生底牌" that (in the prototype) feed the dynamic persona. We seed a
// meaningful trio from the real card deck: 亲情 / 才华 / 健康.
const SIGNATURE = [LIFE_BASE_CARDS[0], LIFE_BASE_CARDS[5], LIFE_BASE_CARDS[16]].filter((c): c is (typeof LIFE_BASE_CARDS)[number] => c !== undefined);

export default function PersonaPortrait() {
  const openPush = useAppStore((s) => s.openPush);
  const openStudio = () => {
    openPush('profileStudio');
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
            <i id="pfill" style={{ width: '0%' }} />
          </div>
          <span id="ppct">0%</span>
        </div>

        <div className="dims">
          {DIMS.map((d) => (
            <button key={d.id} type="button" className="dim todo" data-testid={`dim-${d.id}`} onClick={openStudio}>
              <span className="ic" style={{ background: d.bg }}>
                {d.glyph}
              </span>
              <span className="tx">
                <b>{d.label}</b>
                <p className="empty">{d.value}</p>
              </span>
              <span className="ar">›</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
