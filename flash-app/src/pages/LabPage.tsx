import { useState } from 'react';

const CHOICES = [
  { id: 1, text: '继续做设计', emoji: '🎨', desc: '深耕交互，走专家路线' },
  { id: 2, text: '转 AI 产品', emoji: '🧭', desc: '换赛道，做 AI 产品经理' },
  { id: 3, text: '边做边尝试', emoji: '🌱', desc: '不辞职，用业余时间试水' },
  { id: 4, text: '放弃探索', emoji: '🍃', desc: '先安顿好现在的生活' },
  { id: 5, text: '自定义选择', emoji: '＋', desc: '写下你真正想探索的选项' },
];

export default function LabPage() {
  const [question] = useState('我是否要从交互设计师转为产品经理？');
  const [years, setYears] = useState(5);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [simulating, setSimulating] = useState(false);
  const YEAR_PRESETS = [1, 3, 5, 10];

  const handleSimulate = () => {
    if (selectedChoice === null) return;
    setSimulating(true);
    setTimeout(() => { setSimulating(false); }, 2000);
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="text-[11px] tracking-[0.35em] text-[var(--faint)]">LIFE LAB</div>
      <h1 className="text-[27px] font-bold tracking-wide mt-1">人生实验室</h1>

      {/* Question card */}
      <div className="mt-[18px] px-[14px] py-[10px] rounded-[22px] bg-[var(--card)] border border-[var(--line)] shadow-[var(--shadow-card)]">
        <div className="flex justify-between items-center">
          <div className="text-[9px] tracking-[0.25em] text-[var(--faint)]">当前探索问题</div>
          <button
            data-testid="btn-edit-question"
            className="text-[10px] text-[var(--blue)] px-[5px] py-[2px] rounded-lg"
          >
            更换问题 ›
          </button>
        </div>
        <p className="text-[13.5px] font-bold mt-1 leading-[1.42]">{question}</p>
      </div>

      {/* Dial */}
      <div className="mt-6 flex flex-col items-center">
        <div className="relative w-[204px] h-[204px]">
          {/* Outer glow ring */}
          <div
            className="absolute -inset-[14px] rounded-full pointer-events-none"
            style={{
              background: 'conic-gradient(from 210deg, #5E96FF, #8F7BFF, #E35CC1, #FF7A4D, #5E96FF)',
              filter: 'blur(18px)',
              opacity: 0.55,
            }}
          />
          {/* Colored ring border */}
          <div
            className="absolute -inset-[3px] rounded-full pointer-events-none"
            style={{
              background: 'conic-gradient(from 210deg, #5E96FF, #8F7BFF, #E35CC1, #FF7A4D, #5E96FF)',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 4.5px), #000 calc(100% - 3px))',
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4.5px), #000 calc(100% - 3px))',
            }}
          />
          {/* Dial body */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle at 50% 42%, #1E222E 0%, #161923 55%, #0F1118 100%)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: 'var(--shadow-card), inset 0 2px 14px rgba(0,0,0,0.5)',
            }}
          />

          {/* Core center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10.5px] tracking-[0.3em] text-[var(--faint)]">时间旋钮 · 年</span>
            <div className="text-[13.5px] font-bold mt-2 min-h-[28px] leading-[1.5] text-center px-[44px]">
              {selectedChoice !== null
                ? (CHOICES.find((c) => c.id === selectedChoice)?.text ?? '')
                : '把选择卡拖进来'}
            </div>
            <div className="text-[12px] text-[var(--sub)] mt-2">
              推演 <b className="text-[var(--blue)] font-bold text-[20px] tabular-nums">{years}</b> 年后的你
            </div>
          </div>
        </div>

        {/* Year presets */}
        <div className="flex justify-center gap-[6px] mt-2">
          {YEAR_PRESETS.map((y) => (
            <button
              key={y}
              data-testid={`year-preset-${String(y)}`}
              onClick={() => { setYears(y); }}
              className="px-[13px] py-[6px] rounded-full text-[11px] tabular-nums transition-all"
              style={{
                background: years === y ? 'var(--btn-g)' : 'var(--raised)',
                border: years === y ? '1px solid rgba(111,165,255,0.6)' : '1px solid var(--line)',
                color: years === y ? '#fff' : 'var(--sub)',
                fontWeight: years === y ? 600 : 400,
                boxShadow: years === y ? '0 6px 16px -6px rgba(79,125,255,0.55)' : 'none',
              }}
            >
              {y}年
            </button>
          ))}
        </div>
        <div className="text-center text-[9.5px] text-[var(--faint)] mt-[5px] tracking-wider">拖动旋钮，1 – 10 年任意停留</div>
      </div>

      {/* Choice cards */}
      <div className="mt-4">
        <div className="flex justify-between items-baseline mx-0.5 mb-[9px]">
          <h3 className="text-[13px] font-semibold tracking-wider">我的选择卡</h3>
          <span className="text-[10.5px] text-[var(--faint)]">左右滑动选择 · 向上拖入实验室</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CHOICES.map((c) => (
            <button
              key={c.id}
              data-testid={`choice-${String(c.id)}`}
              onClick={() => { setSelectedChoice(c.id); }}
              className="flex-none w-[108px] h-[132px] p-[15px] rounded-[17px] text-left transition-all relative"
              style={{
                background: selectedChoice === c.id
                  ? 'linear-gradient(150deg, rgba(94,150,255,0.26), rgba(143,123,255,0.13)), #151922'
                  : `radial-gradient(150px 100px at 82% -12%, rgba(94,150,255,0.16), transparent 64%), #151922`,
                border: selectedChoice === c.id
                  ? '1.5px solid rgba(111,165,255,0.72)'
                  : '1.5px dashed rgba(255,255,255,0.2)',
                boxShadow: selectedChoice === c.id
                  ? '0 12px 28px -12px rgba(79,125,255,0.68)'
                  : '0 5px 12px -4px rgba(0,0,0,0.5)',
              }}
            >
              {selectedChoice === c.id && (
                <span className="absolute top-[10px] right-[12px] w-5 h-5 rounded-full bg-[var(--btn-g)] text-white text-[11px] flex items-center justify-center">✓</span>
              )}
              <span className="text-[18px]">{c.emoji}</span>
              <b className="block text-[12.5px] font-semibold mt-2 leading-[1.35]">{c.text}</b>
              <p className="text-[10px] text-[var(--sub)] mt-[5px] leading-[1.42]">{c.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Simulate button */}
      <button
        data-testid="btn-simulate"
        onClick={handleSimulate}
        disabled={selectedChoice === null || simulating}
        className="mt-3 w-[230px] mx-auto block py-3 rounded-full text-[13px] font-semibold tracking-[0.3em] text-white text-center disabled:opacity-35"
        style={{
          background: 'var(--btn-g)',
          boxShadow: '0 10px 28px -10px rgba(79,125,255,0.6)',
        }}
      >
        {simulating ? '推演中...' : '开始推演'}
      </button>
      <p className="text-center text-[9.5px] text-[var(--faint)] mt-[6px] leading-[1.5] whitespace-nowrap">基于动态画像与 1,842 位相似旅人经历 · 它不是预言，是一面镜子</p>
    </div>
  );
}
