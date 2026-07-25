import { useEffect, useRef, useState } from 'react';
import { HUES, USERS } from '@/data/users';
import type { User } from '@/data/users';
import { avatarForUserId } from './avatars';
import { createKaleido } from './kaleidoDraw';
import type { KaleidoController } from './kaleidoDraw';

type KalMode = 'similar' | 'opposite';
type KalPhase = 'options' | 'spinning' | 'result';

interface KaleidoProps {
  open: boolean;
  onClose: () => void;
  onOpenUser: (id: number) => void;
}

/** 随机抽取 · 万花筒抽取浮层 (原型 #kal + openKal/spinKal/kalView). */
export default function Kaleido({ open, onClose, onOpenUser }: KaleidoProps) {
  const [phase, setPhase] = useState<KalPhase>('options');
  const [mode, setMode] = useState<KalMode>('similar');
  const [landed, setLanded] = useState<User | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const kalRef = useRef<KaleidoController | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      kalRef.current?.stop();
    };
  }, []);

  const spin = () => {
    setPhase('spinning');
    setLanded(null);
    const canvas = canvasRef.current;
    if (canvas) {
      kalRef.current ??= createKaleido(canvas);
      kalRef.current.spin();
    }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      kalRef.current?.stop();
      const pool = USERS.filter((u) => (mode === 'similar' ? u.sim : !u.sim));
      const pick = pool[Math.floor(Math.random() * pool.length)] ?? USERS[0] ?? null;
      setLanded(pick);
      setPhase('result');
    }, 2750);
  };

  const kalView = () => {
    if (!landed) return;
    onOpenUser(landed.id);
    onClose();
  };

  const title =
    phase === 'options'
      ? '你想看见哪一面的人生？'
      : phase === 'spinning'
        ? mode === 'similar'
          ? '寻找和你同路的人'
          : '寻找你没走过的路'
        : mode === 'similar'
          ? '与你的画像最相似的人'
          : '与你的轨迹完全相反的人';
  const sub = phase === 'options' ? '万花筒会为你转出一位真实的旅人' : phase === 'spinning' ? '' : '看看 TA 的人生轨迹';

  const hue = landed ? HUES[landed.hue] : undefined;
  const avatar = landed ? avatarForUserId(landed.id) : '';

  return (
    <div className={`kal${open ? ' show' : ''}`} id="kal" data-testid="kal">
      <button type="button" className="kal-close" style={{ position: 'absolute', top: '66px', right: '20px' }} data-testid="kal-close" onClick={onClose}>
        关闭 ✕
      </button>
      <h2>{title}</h2>
      <p className="s">{sub}</p>

      <div className="kal-opts" id="kalOpts" style={{ display: phase === 'options' ? 'flex' : 'none' }}>
        <button
          type="button"
          className={`kal-opt${mode === 'similar' ? ' on' : ''}`}
          data-testid="kal-mode-similar"
          onClick={() => {
            setMode('similar');
          }}
        >
          <span className="g">🪞</span>
          <b>和我有类似经历</b>
          <p>
            在同路人身上
            <br />
            看见自己的下一步
          </p>
        </button>
        <button
          type="button"
          className={`kal-opt${mode === 'opposite' ? ' on' : ''}`}
          data-testid="kal-mode-opposite"
          onClick={() => {
            setMode('opposite');
          }}
        >
          <span className="g">🔭</span>
          <b>和我经历完全相反</b>
          <p>
            在另一种人生里
            <br />
            看见没走过的路
          </p>
        </button>
      </div>

      <div className={`kal-disc-wrap${phase === 'spinning' ? ' show' : ''}`} id="kalDiscWrap">
        <div className={`kal-disc${phase === 'spinning' ? ' spin' : ''}`} id="kalDisc">
          <canvas ref={canvasRef} id="kalCanvas" data-testid="kal-canvas" />
        </div>
      </div>
      <div className="kal-hint" id="kalHint" style={{ display: phase === 'spinning' ? 'block' : 'none' }}>
        光在旋转，人生在折叠……
      </div>

      <div className={`kal-result${phase === 'result' ? ' show' : ''}`} id="kalResult">
        <div className="kal-rescard" id="kalCard">
          {landed ? (
            <>
              <div className="hd" style={{ background: hue?.g ?? '' }}>
                <div className="av" style={{ background: hue?.a ?? '' }}>
                  {avatar !== '' ? <img src={avatar} alt={`${landed.name}的头像`} /> : landed.ini}
                </div>
              </div>
              <div className="bd">
                <div className="nm">{landed.name}</div>
                <div className="qt">「{landed.quote}」</div>
                <div className="stags" style={{ marginTop: '12px' }}>
                  {landed.tags.map((t) => (
                    <span className="stag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
        <div className="kal-actions" style={{ marginTop: '14px' }}>
          <button type="button" className="btn-ink" data-testid="kal-view" onClick={kalView}>
            查看详情
          </button>
          <button type="button" className="btn-ghost" style={{ textAlign: 'center' }} data-testid="kal-again" onClick={spin}>
            换一个
          </button>
        </div>
      </div>

      <div className="kal-actions" id="kalConfirm" style={{ display: phase === 'options' ? 'flex' : 'none' }}>
        <button type="button" className="btn-ink" data-testid="kal-spin" onClick={spin}>
          转动万花筒
        </button>
      </div>
    </div>
  );
}
