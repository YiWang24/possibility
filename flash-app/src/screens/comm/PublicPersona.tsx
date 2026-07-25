import { useEffect, useRef } from 'react';
import type { User } from '@/data/users';
import { drawDynamicPersona, hasPersonaResult, profilePersonaItems, publicPersonaModel } from './persona';

interface PublicPersonaProps {
  user: User;
  /** True when 数字人画像 is the visible tab — controls `.on` + the RAF loop. */
  on: boolean;
}

/** 用户主页 · 数字人画像 tab (原型 prof-persona panel + publicPersonaHTML + drawPublicPersona). */
export default function PublicPersona({ user, on }: PublicPersonaProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const items = profilePersonaItems(user);
  const progress = Math.round((items.length / Math.max(items.length, 1)) * 100);

  useEffect(() => {
    if (!on) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const model = publicPersonaModel(user, profilePersonaItems(user));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let disposed = false;
    const frame = (time: number) => {
      if (disposed) return;
      drawDynamicPersona(canvas, model, time);
      if (!reduce) raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
    };
  }, [user, on]);

  return (
    <section className={`prof-panel${on ? ' on' : ''}`} id="prof-persona" role="tabpanel">
      <div className="prof-section-title">
        <h3>{user.name}公开的数字人画像</h3>
        <span>{items.length} 项公开</span>
      </div>
      <div className="card portrait public-profile-portrait">
        <div className="digital-human-stage public-persona-stage">
          <canvas
            ref={canvasRef}
            className="public-dynamic-persona-canvas"
            role="img"
            aria-label={`${user.name}根据画像结果生成的动态画像`}
            data-testid="public-persona-canvas"
          />
          <span className="digital-human-live">PUBLIC PROFILE FORM</span>
          <div className="digital-human-caption">
            <b>{user.name}</b>
            <span>动态数字形象 · 由下方公开画像结果生成</span>
          </div>
        </div>
        {items.length > 0 ? (
          <>
            <div className="pbar">
              <div className="tr">
                <i style={{ width: `${String(progress)}%` }} />
              </div>
              <span>{items.length} 项公开</span>
            </div>
            <div className="dims public-persona-dims">
              {items.map((item) => (
                <div className="dim" key={item.key}>
                  <span className="ic" style={{ background: item.color }}>
                    {item.glyph}
                  </span>
                  <span className="tx">
                    <b>{item.label}</b>
                    <p>{item.value}</p>
                  </span>
                  <span className="ar">{hasPersonaResult(item) ? '已公开' : '待完善'}</span>
                </div>
              ))}
            </div>
            <p className="persona-public-note">这里只展示对方主动公开的画像结果，未公开内容不会出现在主页。</p>
          </>
        ) : (
          <div className="persona-empty" style={{ marginTop: '14px' }}>
            目前没有开启公开展示的画像内容
          </div>
        )}
      </div>
    </section>
  );
}
