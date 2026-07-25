import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CARRY_META } from '@/data/lab';
import type { CarryCardKey } from '@/data/lab';

// Continuous time knob, 1–10 years. Mirrors the prototype dial (~4190-4247).
const YMIN = 1;
const YMAX = 10;
const PRESETS = [1, 3, 5, 10];

const yearToAng = (y: number): number => -90 + (y - YMIN) * (180 / (YMAX - YMIN));
const angToYear = (a: number): number => YMIN + (a + 90) * ((YMAX - YMIN) / 180);

interface TickMark {
  a: number;
  major: boolean;
  y: number;
}

interface TimeDialProps {
  year: number;
  pick: string | null;
  carry: CarryCardKey[];
  onYear: (year: number) => void;
}

export default function TimeDial({ year, pick, carry, onYear }: TimeDialProps) {
  const dialRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragAngle, setDragAngle] = useState<number | null>(null);

  const ticks = useMemo<TickMark[]>(() => {
    const out: TickMark[] = [];
    for (let a = -90; a <= 90; a += 4) {
      const major = (a + 90) % 20 === 0;
      out.push({ a, major, y: Math.round(angToYear(a)) });
    }
    return out;
  }, []);

  const angleFromEvent = (e: ReactPointerEvent<HTMLDivElement>): number => {
    const el = dialRef.current;
    if (el === null) return yearToAng(year);
    const r = el.getBoundingClientRect();
    const a = (Math.atan2(e.clientX - (r.left + r.width / 2), r.top + r.height / 2 - e.clientY) * 180) / Math.PI;
    return Math.max(-90, Math.min(90, a));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const a = angleFromEvent(e);
    setDragAngle(a);
    onYear(Math.round(angToYear(a)));
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return;
    const a = angleFromEvent(e);
    setDragAngle(a);
    onYear(Math.round(angToYear(a)));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const y = Math.round(angToYear(angleFromEvent(e)));
    setDragAngle(null);
    onYear(y);
  };

  const rot = dragAngle ?? yearToAng(year);
  const rotStyle = { transform: `rotate(${String(rot)}deg)` };
  const dragging = dragAngle !== null;

  return (
    <>
      <div className="dial-wrap">
        <div
          ref={dialRef}
          className={`dial${dragging ? ' dragging' : ''}`}
          id="dial"
          data-testid="lab-dial"
          role="slider"
          aria-label="推演时间旋钮"
          aria-valuemin={YMIN}
          aria-valuemax={YMAX}
          aria-valuenow={year}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="glowring" id="glowring" style={rotStyle} />
          <div className="ring" id="ringEl" style={rotStyle} />
          <div className="tickring" id="tickring">
            {ticks.map((t) => (
              <div
                key={t.a}
                className={`tick${t.major ? ' major' : ''}${t.major && t.y === year ? ' on' : ''}`}
                style={{ transform: `rotate(${String(t.a)}deg)` }}
              >
                <i />
                {t.major ? <span style={{ transform: `translateX(-50%) rotate(${String(-t.a)}deg)` }}>{t.y}</span> : null}
              </div>
            ))}
          </div>
          <div className="arm" id="arm" style={rotStyle}>
            <i className="handle" />
          </div>
          <div className="core">
            <div className="lab-lb">时间旋钮 · 年</div>
            <div className="pick" id="dialPick">
              {pick ?? '把选择卡拖进来'}
            </div>
            <div className="yr">
              推演 <b id="dialYear">{year}</b> 年后的你
            </div>
          </div>
          <div className="dial-carry-tray" id="dialCarry" aria-label="已带入实验室的底线卡">
            {carry.map((id, i) => (
              <span key={id} className="dial-carry-token" title={CARRY_META[id].name} style={{ animationDelay: `${String(i * 0.05)}s` }}>
                {CARRY_META[id].glyph}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="yr-presets">
        {PRESETS.map((y) => (
          <button
            key={y}
            type="button"
            className={`yp${year === y ? ' on' : ''}`}
            data-y={y}
            data-testid={`lab-year-${String(y)}`}
            onClick={() => {
              onYear(y);
            }}
          >
            {y}年
          </button>
        ))}
      </div>
      <div className="knob-hint">拖动旋钮，1 – 10 年任意停留</div>
    </>
  );
}
