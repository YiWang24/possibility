import OrbAvatar from '@/components/OrbAvatar';

const DIMENSIONS = [
  { label: '开放性', value: 82, color: '#6FA5FF' },
  { label: '尽责性', value: 65, color: '#8F7BFF' },
  { label: '外向性', value: 48, color: '#F06ACD' },
  { label: '宜人性', value: 71, color: '#3ED9A4' },
  { label: '情绪稳定', value: 56, color: '#FFB067' },
];

const LIFE_CARDS = [
  { emoji: '🎯', title: '核心驱动', desc: '追求有意义的创造' },
  { emoji: '💡', title: '思维模式', desc: '直觉先行，逻辑验证' },
  { emoji: '🌊', title: '情绪基底', desc: '平静中带点不安分' },
];

const TAGS = ['自我探索', '职业转型', '心理学', 'AI 产品'];

export default function MePage() {
  return (
    <div className="pb-4" style={{ margin: '0 -22px', paddingTop: 0 }}>
      {/* Profile Hero */}
      <div className="relative overflow-hidden px-5 py-5 pb-[18px]" style={{
        background: `
          radial-gradient(260px 180px at 85% -20%, rgba(94,150,255,0.28), transparent 68%),
          radial-gradient(240px 180px at -10% 115%, rgba(227,92,193,0.13), transparent 72%),
          linear-gradient(160deg, #111625, #0B0E17 68%)
        `,
        borderBottom: '1px solid var(--line)',
      }}>
        {/* Edit button */}
        <button className="absolute right-[18px] top-[20px] z-[4] w-9 h-9 rounded-full grid place-items-center text-[18px] text-[#D9E5FF]" style={{
          background: 'rgba(13,17,28,0.7)',
          border: '1px solid rgba(151,177,236,0.3)',
          boxShadow: '0 9px 22px -12px rgba(94,150,255,0.8)',
        }}>
          ✎
        </button>

        <div className="flex items-center gap-[13px] relative z-[1]">
          <div className="relative">
            <OrbAvatar size={66} />
            <span className="absolute -right-[2px] -bottom-[2px] w-[17px] h-[17px] rounded-full bg-[var(--teal)]" style={{ border: '3px solid #10131D' }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[20px] font-bold tracking-wider">屿岸</h2>
              <span className="text-[10px] text-[#AFC8FF] bg-[rgba(94,150,255,0.13)] border border-[rgba(94,150,255,0.26)] px-[7px] py-[3px] rounded-full">已验证</span>
            </div>
            <p className="text-[11px] text-[var(--sub)] mt-1">深圳 · 交互设计师</p>
          </div>
        </div>

        {/* Transition */}
        <div className="relative z-[1] mt-[15px] text-[14px] font-semibold tracking-tight">
          交互设计师 <i className="not-italic text-[var(--blue)] mx-[7px]">→</i> AI 产品经理
        </div>
        <div className="relative z-[1] mt-[5px] text-[11.5px] text-[var(--sub)]">第 4 年探索中 · 2022 年开始</div>

        {/* Tags */}
        <div className="relative z-[1] flex flex-wrap gap-[6px] mt-[13px]">
          {TAGS.map((tag) => (
            <span key={tag} className="text-[10px] text-[#C6D7FF] bg-[rgba(94,150,255,0.11)] border border-[rgba(94,150,255,0.2)] px-[9px] py-[5px] rounded-full">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-[8] grid grid-cols-4 px-3 py-[7px] gap-[5px]" style={{
        background: 'rgba(9,11,18,0.92)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(151,177,236,0.1)',
        boxShadow: '0 10px 22px -20px rgba(0,0,0,0.9)',
      }}>
        {['故事', '画像', '建议', '服务'].map((tab, i) => (
          <button
            key={tab}
            className="py-[9px] px-1 rounded-[11px] text-[10.5px] text-center transition-all"
            style={{
              color: i === 0 ? '#F4F7FF' : '#788297',
              background: i === 0 ? 'linear-gradient(135deg, rgba(70,108,210,0.38), rgba(118,83,186,0.32))' : 'transparent',
              boxShadow: i === 0 ? 'inset 0 0 0 1px rgba(143,168,244,0.2), 0 7px 16px -13px rgba(94,150,255,0.9)' : 'none',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="px-[18px] py-[18px]">
        {/* Quote */}
        <div className="relative p-[18px] rounded-[19px] overflow-hidden text-[14px] leading-[1.78] font-medium" style={{
          background: 'linear-gradient(145deg, rgba(94,150,255,0.15), rgba(143,123,255,0.08))',
          border: '1px solid rgba(111,165,255,0.25)',
        }}>
          <span className="absolute right-[14px] -top-4 text-[76px] font-bold leading-none text-[rgba(111,165,255,0.12)]" style={{ fontFamily: 'Georgia, serif' }}>"</span>
          不是所有转变都需要理由，有时候只是因为你准备好了。
        </div>

        {/* Story section */}
        <div className="mt-[17px]">
          <div className="flex justify-between items-baseline mb-[11px]">
            <h3 className="text-[15.5px] font-semibold leading-tight">我的故事</h3>
            <button className="px-[9px] py-[6px] rounded-full text-[9px] text-[#BFD2FF] bg-[rgba(94,150,255,0.1)] border border-[rgba(111,165,255,0.24)]">编辑</button>
          </div>
          <p className="text-[12.5px] leading-[1.85] text-[#C8CDDA]">
            工作 5 年的交互设计师，开始思考「下一步」。不是因为讨厌设计——恰恰相反，我热爱创造的过程。只是感觉需要找一个更大的舞台，把设计思维和产品战略连接起来。
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-[15px]">
          {[
            { num: '47', label: '探索天数' },
            { num: '23', label: '语音日记' },
            { num: '12', label: '推演次数' },
          ].map((stat) => (
            <div key={stat.label} className="text-center py-3 rounded-[16px] bg-[var(--card)] border border-[var(--line)]">
              <b className="text-[15px] text-[var(--ink)]">{stat.num}</b>
              <span className="block text-[10px] text-[var(--faint)] mt-1">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Dynamic portrait dimensions */}
        <div className="mt-[15px] p-4 rounded-[20px] bg-[var(--card)] border border-[var(--line)]">
          <div className="flex justify-between items-baseline mb-3">
            <h3 className="text-[15px] font-semibold">动态画像维度</h3>
            <span className="text-[9.5px] text-[var(--faint)]">由对话持续更新</span>
          </div>
          {DIMENSIONS.map((dim) => (
            <div key={dim.label} className="flex items-center gap-3 mb-[11px] last:mb-0">
              <span className="text-[11px] text-[var(--sub)] w-[52px] text-right font-semibold">{dim.label}</span>
              <div className="flex-1 h-[6px] rounded-[9px] bg-[rgba(255,255,255,0.06)] overflow-hidden">
                <div
                  className="h-full rounded-[9px]"
                  style={{ width: `${String(dim.value)}%`, background: dim.color }}
                />
              </div>
              <span className="text-[9px] text-[var(--faint)] tabular-nums w-[28px] text-right">{dim.value}</span>
            </div>
          ))}
        </div>

        {/* Life cards */}
        <div className="mt-[15px]">
          <h3 className="text-[15px] font-semibold mb-3">人生底牌</h3>
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
            {LIFE_CARDS.map((card) => (
              <div
                key={card.title}
                className="flex-none w-[130px] p-[14px] rounded-[18px] border border-[var(--line)]"
                style={{
                  background: 'linear-gradient(145deg, rgba(94,150,255,0.08), rgba(143,123,255,0.05))',
                }}
              >
                <span className="text-[24px]">{card.emoji}</span>
                <b className="block text-[11.5px] mt-[8px]">{card.title}</b>
                <p className="text-[10px] text-[var(--sub)] mt-1 leading-[1.5]">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
