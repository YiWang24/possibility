import { useState } from 'react';
import OrbAvatar from '@/components/OrbAvatar';

interface DiaryDay {
  label: string;
  emoji: string;
  filled: boolean;
  isToday: boolean;
}

const WEEK_DAYS: DiaryDay[] = [
  { label: '五', emoji: '🙂', filled: true, isToday: false },
  { label: '六', emoji: '😮\u200D💨', filled: true, isToday: false },
  { label: '日', emoji: '😊', filled: true, isToday: false },
  { label: '一', emoji: '😐', filled: true, isToday: false },
  { label: '二', emoji: '🙂', filled: true, isToday: false },
  { label: '三', emoji: '😌', filled: true, isToday: false },
  { label: '今天', emoji: '', filled: false, isToday: true },
];

const TOPICS = ['职业', '家庭', '升学', '情感'];

export default function HomePage() {
  const [recording, setRecording] = useState(false);
  const [diaryDone, setDiaryDone] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  return (
    <div className="pb-4">
      {/* Greeting */}
      <div className="flex justify-between items-end">
        <div>
          <div className="text-[11px] tracking-[0.35em] text-[var(--faint)]">
            7月25日 · 周五
          </div>
          <h1 className="text-[24px] font-bold tracking-wide mt-[3px]">晚上好，屿岸</h1>
        </div>
        <div className="text-right text-[12px] text-[var(--sub)] leading-relaxed">
          已探索<br />
          <b className="text-[16px] font-bold bg-clip-text text-transparent" style={{ backgroundImage: 'var(--aurora)' }}>
            第 47 天
          </b>
        </div>
      </div>

      {/* Voice Diary Card */}
      <div className="mt-3 px-[17px] py-[14px] rounded-[22px] border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow-card)]">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-[7px]">
            <h3 className="text-[14.5px] font-semibold">我的语音日记</h3>
            <span className="w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[14px] border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.8)] leading-none">›</span>
          </div>
          <button
            data-testid="btn-record"
            onClick={() => {
              setRecording(!recording);
              if (recording) setDiaryDone(true);
            }}
            className="text-[12.5px] text-[var(--blue)] font-medium px-3 py-1.5 rounded-full bg-[rgba(94,150,255,0.12)]"
          >
            {recording ? '⏹ 完成' : '◉ 记录今日'}
          </button>
        </div>

        {/* Week dots */}
        <div className="flex justify-between mt-2.5">
          {WEEK_DAYS.map((day) => (
            <div key={day.label} className="text-center w-9">
              <div
                className="w-[27px] h-[27px] mx-auto rounded-full flex items-center justify-center text-[14px] leading-[27px]"
                style={{
                  background: day.filled
                    ? 'linear-gradient(135deg, #3E77F2, #B03390)'
                    : 'var(--raised)',
                  boxShadow: day.filled ? '0 3px 10px -2px rgba(79,125,255,0.55)' : 'none',
                  ...(day.isToday ? { outline: '2px dashed rgba(94,150,255,0.55)', outlineOffset: '2px' } : {}),
                }}
              >
                {day.filled ? day.emoji : ''}
              </div>
              <span className={`text-[10px] mt-1 block ${day.isToday ? 'text-[var(--blue)]' : 'text-[var(--faint)]'}`}>
                {day.label}
              </span>
            </div>
          ))}
        </div>

        {/* Recording indicator */}
        {recording && (
          <div className="flex items-center gap-3 mt-3.5 p-3 rounded-[14px]"
            style={{ background: 'linear-gradient(135deg, rgba(94,150,255,0.14), rgba(227,92,193,0.1))' }}>
            <div className="flex-1 flex items-center gap-[3px] h-[26px]">
              {Array.from({ length: 20 }).map((_, i) => (
                <i key={i} className="flex-1 rounded-sm bg-[var(--lime)] opacity-75" style={{ animation: `wv 1s ease-in-out ${String(i * 0.05)}s infinite` }} />
              ))}
            </div>
            <span className="text-[12px] text-[var(--lime)] tabular-nums w-[38px]">0:12</span>
          </div>
        )}

        {/* Diary result */}
        {diaryDone && (
          <div className="mt-3.5 pt-3 border-t border-dashed border-[var(--line)]">
            <div className="text-[11px] text-[var(--faint)] mb-2">今日情绪</div>
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[11.5px] text-[#0B0F18] bg-[var(--lime)] px-3 py-1 rounded-full font-semibold">
                平静 😌
              </span>
              <span className="text-[11.5px] text-[#9DBCFF] bg-[rgba(94,150,255,0.13)] border border-[rgba(94,150,255,0.3)] px-3 py-1 rounded-full">
                职业思考
              </span>
              <span className="text-[11.5px] text-[#9DBCFF] bg-[rgba(94,150,255,0.13)] border border-[rgba(94,150,255,0.3)] px-3 py-1 rounded-full">
                自我探索
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Ask / Explore Card */}
      <div className="relative mt-3.5 rounded-[28px] overflow-hidden border border-[rgba(122,158,255,0.3)] flex flex-col"
        style={{
          background: `
            radial-gradient(340px 240px at 82% -12%, rgba(111,165,255,0.5), transparent 62%),
            radial-gradient(280px 220px at -12% 112%, rgba(143,123,255,0.28), transparent 62%),
            linear-gradient(160deg, #141A34 0%, #1A2350 55%, #10132A 100%)
          `,
          boxShadow: 'var(--shadow-card)',
          padding: '24px 20px 20px',
          minHeight: '340px',
        }}
      >
        {/* Lava glow blobs */}
        <div className="absolute -top-[70px] -right-[40px] w-[230px] h-[230px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 45% 45%, rgba(111,165,255,0.65), rgba(143,123,255,0.28) 52%, transparent 72%)',
            filter: 'blur(10px)',
            animation: 'orblava1 13s ease-in-out infinite',
          }}
        />
        <div className="absolute -bottom-[90px] -left-[60px] w-[200px] h-[200px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 45%, rgba(227,92,193,0.42), rgba(143,123,255,0.2) 55%, transparent 75%)',
            filter: 'blur(12px)',
            animation: 'orblava2 15s ease-in-out infinite',
          }}
        />
        <div className="absolute top-[30%] left-[32%] w-[150px] h-[150px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.34), rgba(157,188,255,0.16) 55%, transparent 72%)',
            filter: 'blur(14px)',
            animation: 'orblava1 11s ease-in-out infinite',
            animationDelay: '-3s',
          }}
        />

        <div className="relative z-10 flex flex-col flex-1">
          {/* Tag line */}
          <div className="flex items-center gap-2 text-[10px] tracking-[0.28em] text-[#9DBCFF]">
            <span className="w-[18px] h-[1.5px] bg-[rgba(157,188,255,0.6)]" />
            今天想探索什么
          </div>
          <h2 className="text-[22px] font-bold leading-[1.42] mt-2.5">
            说出那个<br /><span className="text-[var(--blue)]">在心里盘旋</span>的问题
          </h2>

          {/* Input box */}
          <div className="mt-4 rounded-[18px] p-3 border border-[rgba(255,255,255,0.12)]" style={{ background: 'rgba(6,8,16,0.45)', backdropFilter: 'blur(6px)' }}>
            {selectedTopic != null && selectedTopic !== '' && (
              <div className="absolute left-[26px] top-[calc(24px+10px+30px+10px+48px+16px+12px)] z-[2] inline-flex items-center gap-[5px] text-[11px] text-[#9DBCFF] bg-[rgba(94,150,255,0.16)] border border-[rgba(94,150,255,0.4)] px-2.5 py-1 rounded-full pointer-events-none">
                ✦ <b className="font-semibold">{selectedTopic}</b>
              </div>
            )}
            <textarea
              className="w-full h-[72px] resize-none border-none bg-transparent text-[14px] leading-[1.7] text-[var(--ink)] placeholder:text-[var(--faint)] placeholder:text-[13.5px] outline-none"
              placeholder="写下任何正在心里盘旋的问题…"
              readOnly
            />
            <div className="flex justify-end mt-1">
              <button
                data-testid="btn-start-chat"
                className="px-5 py-2 rounded-full text-[12.5px] font-semibold text-white tracking-wider"
                style={{ background: 'var(--btn-g)', boxShadow: '0 8px 20px -8px rgba(79,125,255,0.6)' }}
              >
                发送
              </button>
            </div>
          </div>

          {/* Topic chips - pushed to bottom */}
          <div className="flex flex-wrap gap-[7px] mt-auto pt-[15px]">
            {TOPICS.map((t) => (
              <button
                key={t}
                data-testid={`topic-${t}`}
                onClick={() => { setSelectedTopic(selectedTopic === t ? null : t); }}
                className="px-[13px] py-1.5 rounded-full text-[11.5px] transition-all border"
                style={{
                  color: selectedTopic === t ? '#9DBCFF' : 'var(--sub)',
                  background: selectedTopic === t ? 'rgba(94,150,255,0.14)' : 'rgba(255,255,255,0.07)',
                  borderColor: selectedTopic === t ? 'rgba(94,150,255,0.5)' : 'rgba(255,255,255,0.1)',
                  fontWeight: selectedTopic === t ? 500 : 400,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section title */}
      <div className="flex justify-between items-baseline mx-0.5 mt-4 mb-2">
        <h3 className="text-[13px] font-semibold tracking-wider">我的动态画像</h3>
        <button className="text-[12px] text-[var(--blue)]">探索更多画像 ›</button>
      </div>

      {/* Digital Human / Portrait Card */}
      <div className="rounded-[22px] bg-[var(--card)] border border-[var(--line)] overflow-hidden text-center relative">
        {/* Stage */}
        <div className="relative h-[216px] overflow-hidden" style={{
          background: `
            radial-gradient(190px 150px at 50% 48%, rgba(83,115,255,0.22), transparent 70%),
            radial-gradient(150px 120px at 30% 80%, rgba(227,92,193,0.12), transparent 72%),
            linear-gradient(145deg, #080C1A, #10162B 58%, #080B16)
          `,
        }}>
          <OrbAvatar size={100} />
          <div className="absolute left-[15px] top-[14px] z-[3] flex items-center gap-1.5 px-[9px] py-[5px] rounded-full text-[8.5px] tracking-wider text-[#DCE8FF]" style={{ background: 'rgba(7,11,24,0.54)', border: '1px solid rgba(198,218,255,0.18)', backdropFilter: 'blur(9px)' }}>
            <span className="w-[5px] h-[5px] rounded-full bg-[var(--teal)]" style={{ boxShadow: '0 0 10px rgba(62,217,164,0.9)' }} />
            LIVE PROFILE
          </div>
          <div className="absolute left-[18px] right-[18px] bottom-[14px] z-[3] text-left">
            <b className="text-[15px] font-semibold" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}>屿岸 · 动态数字形象</b>
            <span className="block mt-1 text-[10px] text-[rgba(223,232,250,0.74)] tracking-wider">由当前画像维度生成 · 持续生长</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-2.5 max-w-[250px] mx-auto mt-4 mb-4 px-5">
          <div className="flex-1 h-[5px] rounded-[3px] bg-[var(--raised)] overflow-hidden">
            <div className="h-full rounded-[3px]" style={{ width: '68%', background: 'var(--aurora)' }} />
          </div>
          <span className="text-[11px] text-[var(--sub)] tabular-nums">68%</span>
        </div>
        {/* Dimension entries */}
        <div className="flex flex-col gap-[9px] text-left px-5 pb-5">
          {[
            { icon: '◎', color: 'rgba(89,104,217,0.16)', label: '人格底色', status: '尚未填写' },
            { icon: '✦', color: 'rgba(94,150,255,0.15)', label: '我擅长', status: '尚未填写' },
            { icon: '♡', color: 'rgba(227,92,193,0.15)', label: '我喜欢', status: '尚未填写' },
            { icon: '✿', color: 'rgba(255,122,77,0.16)', label: '我在恋爱关系中在意', status: '尚未填写' },
          ].map((dim) => (
            <button key={dim.label} className="flex items-center gap-3 p-[14px] rounded-[16px] bg-[var(--raised)] border border-dashed border-[rgba(94,150,255,0.4)] active:scale-[0.98] transition-transform" style={{ background: 'rgba(94,150,255,0.06)' }}>
              <span className="w-[34px] h-[34px] flex-none rounded-[12px] flex items-center justify-center text-[15px]" style={{ background: dim.color }}>{dim.icon}</span>
              <span className="flex-1">
                <b className="block text-[13.5px] font-semibold">{dim.label}</b>
                <p className="text-[11.5px] text-[var(--blue)] mt-[3px]">{dim.status}</p>
              </span>
              <span className="text-[14px] text-[var(--faint)]">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
