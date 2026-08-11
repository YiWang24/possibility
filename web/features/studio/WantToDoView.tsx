"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FocusShell } from "@/components/shell/FocusShell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { useHome } from "@/features/home/store";
import { callFunction } from "@/lib/supabase";
import {
  DISCOVERY_QUESTIONS,
  analysisRequest,
  energySignals as energyProfile,
  environmentSignals,
  interestProfiles,
  isSelfDiscoveryAnalysis,
  localAnalysis,
  strengthProfiles,
  type DiscoveryAnswer,
  type DiscoveryInsight,
  type DiscoveryQuestion,
  type SelfDiscoveryAnalysis,
} from "./self-discovery";

type Phase = "intro" | "questions" | "analyzing" | "result";

const EMPTY_ANSWER: DiscoveryAnswer = { selected: [], custom: [] };

export function WantToDoView() {
  const router = useRouter();
  const showToast = useToast((state) => state.show);
  const saveDimension = useHome((state) => state.saveDimension);

  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, DiscoveryAnswer>>({});
  const [analysis, setAnalysis] = useState<SelfDiscoveryAnalysis | null>(null);
  const [usedAi, setUsedAi] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deepUnlocked, setDeepUnlocked] = useState(false);

  const question = DISCOVERY_QUESTIONS[index];
  const current = answers[question?.id] ?? EMPTY_ANSWER;
  const canAdvance = Boolean(question && (
    question.kind === "interest" ? current.like :
    question.kind === "strength" ? current.like && current.skill :
    question.kind === "environment" ? current.scale :
    question.kind === "open" ? current.text?.trim() :
    current.selected.length
  ));

  const updateCurrent = (next: DiscoveryAnswer) => {
    if (!question) return;
    setAnswers((previous) => ({ ...previous, [question.id]: next }));
  };

  const toggle = (label: string, single = false) => {
    if (current.selected.includes(label)) {
      updateCurrent({
        ...current,
        selected: current.selected.filter((item) => item !== label),
      });
      return;
    }
    if (single) {
      updateCurrent({ ...current, selected: [label] });
      return;
    }
    if (current.selected.length >= 3) {
      showToast("每题最多选择 3 项");
      return;
    }
    updateCurrent({ ...current, selected: [...current.selected, label] });
  };

  const runAnalysis = async (finalAnswers: Record<string, DiscoveryAnswer>) => {
    setPhase("analyzing");
    setSaved(false);
    setDeepUnlocked(false);
    try {
      const result = await callFunction<SelfDiscoveryAnalysis>(
        "analyze-self-discovery",
        analysisRequest(finalAnswers),
      );
      if (!isSelfDiscoveryAnalysis(result)) throw new Error("AI 返回结构无效");
      setAnalysis(result);
      setUsedAi(true);
    } catch {
      setAnalysis(localAnalysis(finalAnswers));
      setUsedAi(false);
      showToast("AI 暂时不可用，已先按重复证据生成结果");
    } finally {
      setPhase("result");
    }
  };

  const next = () => {
    if (!canAdvance || !question) return;
    if (index === DISCOVERY_QUESTIONS.length - 1) {
      void runAnalysis(answers);
      return;
    }
    setIndex((value) => value + 1);
  };

  const back = () => {
    if (phase === "result") {
      setPhase("questions");
      setIndex(DISCOVERY_QUESTIONS.length - 1);
      return;
    }
    if (phase === "questions" && index > 0) {
      setIndex((value) => value - 1);
      return;
    }
    if (phase === "questions") {
      setPhase("intro");
      return;
    }
    router.back();
  };

  const save = () => {
    if (!analysis || saved) return;
    saveDimension("like", analysis.likes.map((item) => item.label).slice(0, 5));
    saveDimension("skill", analysis.strengths.map((item) => item.label).slice(0, 5));
    setSaved(true);
    showToast("已同时写入“我喜欢”和“我擅长”");
  };

  const unlockDeepAnalysis = () => {
    setDeepUnlocked(true);
    showToast("已解锁深入分析（预览环境）");
  };

  const progress = phase === "intro"
    ? 0
    : phase === "result" || phase === "analyzing"
      ? 1
      : (index + 1) / DISCOVERY_QUESTIONS.length;
  const energySignals = energyProfile(answers);
  const contextSignals = environmentSignals(answers);
  const allInterests = interestProfiles(answers);
  const allStrengths = strengthProfiles(answers);

  return (
    <FocusShell
      title="喜欢 × 擅长"
      subtitle="想做的事探索"
      progress={progress}
      progressLabel={phase === "questions" ? `${index + 1}/${DISCOVERY_QUESTIONS.length}` : undefined}
      onExit={() => router.back()}
      exitLabel="退出探索"
    >
      {phase === "intro" && (
        <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-5 pb-8 pt-7 md:px-8 md:pt-12">
          <div className="text-micro font-semibold tracking-[2.4px] text-brand">
            SELF-UNDERSTANDING METHOD
          </div>
          <h1 className="mt-3 text-[28px] font-bold leading-[1.35] text-ink md:text-[36px]">
            用完整证据链，找到<br />你喜欢和擅长的事
          </h1>
          <p className="mt-4 max-w-[62ch] text-body leading-[1.9] text-sub">
            沿用《如何找到想做的事》的“喜欢 × 擅长 × 价值观”方法结构，
            通过 {DISCOVERY_QUESTIONS.length} 个原创题收集兴趣、优势、外部证据、价值与环境偏好，最后交给 AI 综合分析。
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FormulaCard eyebrow="WHAT" title="喜欢的事" desc="反复吸引你的内容领域" tint="#E35CC1" />
            <FormulaCard eyebrow="HOW" title="擅长的事" desc="自然反复使用的行为模式" tint="#5E96FF" />
            <FormulaCard eyebrow="ENERGY" title="能量来源" desc="什么让你越投入越有劲" tint="#F0A949" />
            <FormulaCard eyebrow="CONTEXT" title="发挥环境" desc="哪里更容易稳定发挥" tint="#3ED9A4" />
          </div>

          <div className="mt-6 grid gap-2.5 rounded-tile border border-line bg-card p-4 text-footnote leading-[1.7] text-sub sm:grid-cols-3">
            <div><b className="text-ink">01 双评分</b><br />同一行为评喜欢与擅长</div>
            <div><b className="text-ink">02 外部证据</b><br />避免只靠自我感觉</div>
            <div><b className="text-ink">03 真实叙事</b><br />5 个开放题让 AI 读懂你</div>
          </div>

          <p className="mt-4 text-micro leading-[1.7] text-faint">
            题目为方法论基础上的产品化原创表达，不复制书中原句。自由回答仅用于生成本次分析结果。
          </p>

          <Button size="lg" className="mt-7 w-full md:self-start md:w-auto" onClick={() => setPhase("questions")}>
            开始完整探索 · 约 15 分钟
          </Button>
        </div>
      )}

      {phase === "questions" && question && (
        <div className="mx-auto flex w-full max-w-[780px] flex-1 flex-col px-5 pb-7 pt-6 md:px-8 md:pt-10">
          <span className="text-micro font-semibold tracking-[2px] text-brand">{question.eyebrow}</span>
          <h1 className="mt-2 text-[24px] font-bold leading-[1.5] text-ink md:text-[30px]">
            {question.title}
          </h1>
          <p className="mt-2 text-footnote leading-[1.8] text-sub">{question.hint}</p>

          <QuestionInput question={question} answer={current} onChange={updateCurrent} onToggle={toggle} />

          <div className="mt-6 flex items-center gap-3">
            <Button variant="ghost" size="lg" className="flex-1" onClick={back}>
              上一个
            </Button>
            <Button size="lg" className="flex-[1.5]" disabled={!canAdvance} onClick={next}>
              {index === DISCOVERY_QUESTIONS.length - 1 ? "交给 AI 综合分析" : "继续"}
            </Button>
          </div>
        </div>
      )}

      {phase === "analyzing" && (
        <div className="mx-auto flex w-full max-w-[620px] flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <div className="relative grid size-24 place-items-center rounded-full border border-brand/30 bg-brand/10">
            <div className="absolute inset-2 animate-spin rounded-full border border-transparent border-t-brand" />
            <span className="text-[28px] text-brand-lite">✦</span>
          </div>
          <h1 className="mt-6 text-title font-bold text-ink">AI 正在整理你的证据</h1>
          <p className="mt-3 text-body leading-[1.8] text-sub">
            它会区分“被什么内容吸引”和“习惯怎样行动”，并结合你的自由回答寻找重复线索。
          </p>
        </div>
      )}

      {phase === "result" && analysis && (
        <div className="mx-auto flex w-full max-w-[860px] flex-1 flex-col px-5 pb-9 pt-6 md:px-8 md:pt-9">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-micro font-semibold tracking-[2.4px] text-teal">YOUR CLUES</span>
            <span className="rounded-chip bg-teal/10 px-2.5 py-1 text-micro text-teal">
              {usedAi ? "AI 综合分析" : "本地证据归纳"}
            </span>
          </div>
          <h1 className="mt-2 text-[28px] font-bold text-ink">你喜欢与擅长的基本结论</h1>
          <p className="mt-2 max-w-[70ch] text-footnote leading-[1.8] text-sub">{analysis.summary}</p>

          <FreeProfileSummary likes={analysis.likes} strengths={analysis.strengths} directions={analysis.directions} />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <BasicInsightCard title="我喜欢什么" eyebrow="WHAT" tint="#E35CC1" items={analysis.likes} />
            <BasicInsightCard title="我擅长什么" eyebrow="HOW" tint="#5E96FF" items={analysis.strengths} />
          </div>

          <DiscoveryMap
            likes={analysis.likes.map((item) => item.label)}
            strengths={analysis.strengths.map((item) => item.label)}
            energy={energySignals}
            context={contextSignals}
          />

          {deepUnlocked ? (
            <>
              <div className="mt-6 text-subtitle font-bold text-ink">你的完整行动报告</div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <InsightCard title="为什么会喜欢" eyebrow="EVIDENCE" tint="#E35CC1" items={analysis.likes} />
                <InsightCard title="优势如何发挥" eyebrow="EVIDENCE" tint="#5E96FF" items={analysis.strengths} />
              </div>
              <FullActionReport analysis={analysis} energy={energySignals} context={contextSignals} interests={allInterests} strengths={allStrengths} />
              <p className="mt-4 text-micro leading-[1.7] text-faint">{analysis.confidence_note}</p>
            </>
          ) : (
            <DeepAnalysisGate onUnlock={unlockDeepAnalysis} />
          )}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button variant="ghost" size="lg" className="sm:flex-1" onClick={back}>
              返回修改
            </Button>
            {!saved ? (
              <Button size="lg" className="sm:flex-[1.6]" onClick={save}>
                保存到我的动态画像
              </Button>
            ) : (
              <Button size="lg" className="sm:flex-[1.6]" onClick={() => router.push("/#dynamic-portrait")}>
                查看我的动态画像
              </Button>
            )}
          </div>
        </div>
      )}
    </FocusShell>
  );
}

function QuestionInput({
  question,
  answer,
  onChange,
  onToggle,
}: {
  question: DiscoveryQuestion;
  answer: DiscoveryAnswer;
  onChange: (answer: DiscoveryAnswer) => void;
  onToggle: (label: string, single?: boolean) => void;
}) {
  if (question.kind === "interest") {
    return <div className="mt-6"><RatingScale label="你有多喜欢这样？" low="完全没兴趣" high="愿意持续投入" value={answer.like} onChange={(like) => onChange({ ...answer, like })} /></div>;
  }
  if (question.kind === "strength") {
    return <div className="mt-6 grid gap-4"><RatingScale label="你有多喜欢这样做？" low="很消耗" high="做完有能量" value={answer.like} onChange={(like) => onChange({ ...answer, like })} /><RatingScale label="你有多自然地能做好？" low="明显吃力" high="常被认为是优势" value={answer.skill} onChange={(skill) => onChange({ ...answer, skill })} /></div>;
  }
  if (question.kind === "environment") {
    return <div className="mt-6"><RatingScale label="更接近哪一端？" low={question.left ?? "左侧"} high={question.right ?? "右侧"} value={answer.scale} onChange={(scale) => onChange({ ...answer, scale })} /></div>;
  }
  if (question.kind === "open") {
    return <div className="mt-6 rounded-card border border-line bg-card p-4"><label htmlFor={question.id} className="text-caption font-semibold text-ink">真实经历比“正确答案”更重要</label><textarea id={question.id} value={answer.text ?? ""} maxLength={400} placeholder="写下 1–3 句真实经历…" onChange={(event) => onChange({ ...answer, text: event.target.value })} className="mt-3 min-h-[150px] w-full resize-y rounded-field border border-line bg-canvas p-3.5 text-body leading-[1.7] text-ink outline-none placeholder:text-faint focus:border-brand" /><div className="mt-2 text-right text-micro text-faint">{answer.text?.length ?? 0}/400</div></div>;
  }
  return <div className="mt-6 grid gap-2.5 sm:grid-cols-2">{question.options?.map((option) => {
    const selected = answer.selected.includes(option.label);
    return <button key={option.label} aria-pressed={selected} onClick={() => onToggle(option.label, question.kind === "choice")} className="flex min-h-[70px] items-center gap-3 rounded-tile border px-4 py-3 text-left transition active:scale-[0.98]" style={{ background: selected ? "rgba(83,115,255,0.18)" : "var(--color-card)", borderColor: selected ? "rgba(111,165,255,0.72)" : "var(--color-line)" }}><span className="grid size-9 shrink-0 place-items-center rounded-field bg-raised text-callout text-brand-lite">{selected ? "✓" : option.glyph}</span><span><span className="block text-body font-medium leading-[1.55] text-ink">{option.label}</span>{option.detail && <span className="mt-1 block text-micro leading-[1.55] text-sub">{option.detail}</span>}</span></button>;
  })}</div>;
}

function RatingScale({ label, low, high, value, onChange }: { label: string; low: string; high: string; value?: number; onChange: (value: number) => void }) {
  return <div className="rounded-card border border-line bg-card p-4"><div className="text-body font-semibold text-ink">{label}</div><div className="mt-4 grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((score) => <button key={score} aria-label={`${label}：${score} 分`} aria-pressed={value === score} onClick={() => onChange(score)} className="min-h-12 rounded-field border text-body font-bold transition active:scale-[0.97]" style={{ background: value === score ? "rgba(83,115,255,0.23)" : "var(--color-raised)", borderColor: value === score ? "rgba(111,165,255,0.82)" : "var(--color-line)", color: value === score ? "var(--color-brand-lite)" : "var(--color-sub)" }}>{score}</button>)}</div><div className="mt-2 flex justify-between gap-4 text-micro text-faint"><span>{low}</span><span className="text-right">{high}</span></div></div>;
}

function BasicInsightCard({
  title,
  eyebrow,
  tint,
  items,
}: {
  title: string;
  eyebrow: string;
  tint: string;
  items: DiscoveryInsight[];
}) {
  return (
    <div className="rounded-card border border-line bg-card p-5">
      <div className="text-micro font-semibold tracking-[1.8px]" style={{ color: tint }}>{eyebrow}</div>
      <h2 className="mt-1 text-subtitle font-bold text-ink">{title}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item.label} className="rounded-chip border px-3 py-2 text-caption font-semibold" style={{ color: tint, borderColor: `${tint}66`, background: `${tint}12` }}>
            {item.label}
          </span>
        ))}
      </div>
      <p className="mt-4 text-caption leading-[1.7] text-sub">
        这些结论来自你多次出现的选择与自由回答；深入分析会解释具体证据与适合你的行动路径。
      </p>
    </div>
  );
}

function FreeProfileSummary({
  likes,
  strengths,
  directions,
}: {
  likes: DiscoveryInsight[];
  strengths: DiscoveryInsight[];
  directions: SelfDiscoveryAnalysis["directions"];
}) {
  const like = likes[0]?.label ?? "持续好奇";
  const strength = strengths[0]?.label ?? "解决问题";
  return (
    <div className="mt-5 rounded-card border border-brand/30 bg-[linear-gradient(135deg,rgba(94,150,255,0.14),rgba(227,92,193,0.1))] p-5">
      <div className="text-micro font-semibold tracking-[2px] text-brand-lite">FREE PROFILE · 免费基础报告</div>
      <h2 className="mt-2 text-title font-bold text-ink">你的画像：{strength}型探索者</h2>
      <p className="mt-2 text-footnote leading-[1.8] text-sub">
        你会被「{like}」持续吸引，并自然用「{strength}」把模糊的问题向前推进。先找同时需要这两件事的真实任务，比急着决定职业名称更重要。
      </p>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        <FreeSignal label="最佳组合" value={`${like} × ${strength}`} />
        <FreeSignal label="优先方向" value={directions[0]?.title ?? "职业 / 副业 / 兴趣"} />
        <FreeSignal label="下一步" value="完成一个小型真实任务" />
      </div>
      <div className="mt-4 border-t border-white/10 pt-3">
        <div className="text-micro font-semibold tracking-[1.5px] text-brand-lite">可先尝试的三类方向</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {directions.map((direction) => <span key={direction.title} className="rounded-chip border border-white/10 bg-black/10 px-2.5 py-1.5 text-micro text-ink">{direction.title}</span>)}
        </div>
      </div>
      <p className="mt-4 text-caption leading-[1.7] text-brand-lite">免费结论已回答：你被什么吸引、怎样解决问题，以及最值得先用什么方向验证。</p>
    </div>
  );
}

function FreeSignal({ label, value }: { label: string; value: string }) {
  return <div className="rounded-field border border-white/10 bg-black/10 p-3"><div className="text-micro text-faint">{label}</div><div className="mt-1 text-caption font-semibold leading-[1.6] text-ink">{value}</div></div>;
}

function FullActionReport({
  analysis,
  energy,
  context,
  interests,
  strengths: detailedStrengths,
}: {
  analysis: SelfDiscoveryAnalysis;
  energy: string[];
  context: string[];
  interests: Array<{ tag: string; like: number }>;
  strengths: Array<{ tag: string; like: number; skill: number; zone: "天赋热爱区" | "兴趣潜力区" | "熟练消耗区" | "非优先区" }>;
}) {
  const likes = analysis.likes.map((item) => item.label);
  const strengths = analysis.strengths.map((item) => item.label);
  const profile = roleFamilies(likes[0]);
  const chain = strengths.join(" → ");
  const energyText = energy.length ? energy.slice(0, 2).join("、") : "完成新版能量题后生成";
  const contextText = context.length ? context.slice(0, 2).join("、") : "完成新版环境题后生成";
  return (
    <div className="mt-4 flex flex-col gap-4">
      <ReportBlock eyebrow="01 · 完整喜欢地图" title="9 个兴趣主题的投入强度">
        <p className="text-caption leading-[1.8] text-sub">高分是你会主动靠近、愿意持续投入的内容世界；它不等于此刻必须把它变成职业。</p>
        <InterestBars items={interests} />
      </ReportBlock>

      <ReportBlock eyebrow="02 · 完整擅长地图" title="13 个优势动作的喜欢 × 自然优势">
        <p className="text-caption leading-[1.8] text-sub">同一动作同时看你是否喜欢和是否自然做得好，才会进入对应的四象限。</p>
        <StrengthTable items={detailedStrengths} />
      </ReportBlock>

      <ReportBlock eyebrow="03 · 优势组合链" title="你的天然解决问题路径">
        <div className="rounded-field border border-violet-soft/25 bg-violet-soft/10 px-4 py-3 text-body font-semibold text-violet-soft">{chain}</div>
        <p className="mt-3 text-caption leading-[1.8] text-sub">这不是单一技能，而是你更容易形成差异化的解决问题路径。把它放进「{likes[0]}」相关场景，最容易产生长期竞争力。</p>
      </ReportBlock>

      <div className="grid gap-4 md:grid-cols-2">
        <ReportBlock eyebrow="04 · 能量与边界" title="怎样才会持续发挥">
          <p className="text-caption leading-[1.8] text-sub">你更可能在「{energyText}」中被充电，并需要「{contextText}」这样的环境。擅长不等于适合长期承担；当任务持续违背这些条件，就要降低占比、借助 AI 或寻找搭档补位。</p>
        </ReportBlock>
        <ReportBlock eyebrow="05 · 消耗模式" title="能做，不等于该长期做">
          <p className="text-caption leading-[1.8] text-sub">「{strengths.slice(1).join("、")}」是可靠能力，但若完成后长期没有能量回流，就更适合作为辅助能力，而不是职业的唯一核心。</p>
        </ReportBlock>
      </div>

      <ReportBlock eyebrow="06 · 职业探索" title="领域 × 角色 × 工作方式">
        <div className="grid gap-2.5 sm:grid-cols-3">
          {profile.map((role) => <ReportRole key={role.title} {...role} />)}
        </div>
        <p className="mt-3 text-caption leading-[1.7] text-sub">这些不是职业判决，而是优先去体验的工作组合：关注匹配的主题、使用的优势动作，以及是否具备适配环境。</p>
      </ReportBlock>

      <div className="grid gap-4 md:grid-cols-2">
        <ReportBlock eyebrow="07 · 副业探索" title="最低成本的商业化实验">
          <p className="text-caption leading-[1.8] text-sub">从「{likes[0]} × {strengths[0]}」开始，连续 4 周输出 4 次可被别人使用的成果：一篇拆解、一场分享、一次服务或一个小作品。观察“想继续做 + 有人认可 + 能产生价值”是否同时出现。</p>
        </ReportBlock>
        <ReportBlock eyebrow="08 · 兴趣保留" title="不必每一种喜欢都赚钱">
          <p className="text-caption leading-[1.8] text-sub">「{likes.slice(1).join("、")}」可以先作为纯粹兴趣或低压力练习保留。先验证能量与持续性，再决定是否副业化，避免让商业化过早破坏喜欢。</p>
        </ReportBlock>
      </div>

      <ReportBlock eyebrow="09 · 未来 30 天人生实验" title="把结论变成新的证据">
        <div className="grid gap-3 md:grid-cols-3">
          {analysis.directions.map((direction, index) => (
            <div key={direction.title} className="rounded-tile border border-line bg-card p-4">
              <div className="text-micro font-semibold text-brand-lite">{["职业实验", "副业实验", "兴趣实验"][index]}</div>
              <div className="mt-2 text-body font-semibold text-ink">{direction.title}</div>
              <p className="mt-2 text-caption leading-[1.7] text-sub">{direction.why}</p>
              <p className="mt-3 border-t border-line pt-3 text-caption leading-[1.7] text-brand-lite">本周第一步：{direction.first_step}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-caption leading-[1.7] text-sub">一个月后回来看：喜欢度、能量、能力与外部反馈有没有上升，再把结果回写到动态画像和人生实验室。</p>
      </ReportBlock>
    </div>
  );
}

function ReportBlock({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <section className="rounded-card border border-line bg-card p-5"><div className="text-micro font-semibold tracking-[1.6px] text-brand-lite">{eyebrow}</div><h3 className="mt-1 text-lead font-bold text-ink">{title}</h3><div className="mt-4">{children}</div></section>;
}

function InterestBars({ items }: { items: Array<{ tag: string; like: number }> }) {
  return (
    <div className="mt-4 grid gap-2">
      {items.map((item) => (
        <div key={item.tag} className="grid grid-cols-[96px_1fr_30px] items-center gap-3 text-caption">
          <span className="font-medium text-ink">{item.tag}</span>
          <span className="h-2 overflow-hidden rounded-full bg-raised"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#E35CC1,#9C7BFF)]" style={{ width: `${item.like * 20}%` }} /></span>
          <span className="text-right text-brand-lite">{item.like}</span>
        </div>
      ))}
    </div>
  );
}

function StrengthTable({ items }: { items: Array<{ tag: string; like: number; skill: number; zone: string }> }) {
  const zoneColor: Record<string, string> = {
    "天赋热爱区": "text-[#78E7C1] border-[#3ED9A4]/35 bg-[#3ED9A4]/10",
    "兴趣潜力区": "text-[#A9C5FF] border-[#5E96FF]/35 bg-[#5E96FF]/10",
    "熟练消耗区": "text-[#FFD18B] border-[#F0A949]/35 bg-[#F0A949]/10",
    "非优先区": "text-sub border-line bg-raised",
  };
  return (
    <div className="mt-4 overflow-hidden rounded-field border border-line">
      <div className="grid grid-cols-[1fr_56px_56px_94px] gap-2 border-b border-line bg-raised px-3 py-2 text-micro text-faint"><span>优势动作</span><span className="text-center">喜欢</span><span className="text-center">擅长</span><span className="text-right">所在区域</span></div>
      {items.map((item) => <div key={item.tag} className="grid grid-cols-[1fr_56px_56px_94px] items-center gap-2 border-b border-line px-3 py-2.5 last:border-0 text-caption"><span className="font-medium text-ink">{item.tag}</span><span className="text-center text-sub">{item.like}</span><span className="text-center text-sub">{item.skill}</span><span className={`justify-self-end rounded-chip border px-2 py-1 text-micro ${zoneColor[item.zone]}`}>{item.zone}</span></div>)}
    </div>
  );
}

function ReportRole({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-field border border-line bg-raised p-3"><div className="text-caption font-semibold text-ink">{title}</div><div className="mt-1 text-micro leading-[1.6] text-sub">{detail}</div></div>;
}

function roleFamilies(primaryLike?: string) {
  const byLike: Record<string, Array<{ title: string; detail: string }>> = {
    "人与心理": [{ title: "用户研究", detail: "理解人的动机与真实需要" }, { title: "教育 / 咨询服务", detail: "帮助他人成长" }, { title: "社群体验运营", detail: "建立可信连接" }],
    "社会与文化": [{ title: "趋势 / 内容研究", detail: "解释群体与时代变化" }, { title: "品牌策略", detail: "连接文化与人群" }, { title: "公共传播", detail: "把议题讲给更多人" }],
    "商业与市场": [{ title: "商业策略", detail: "理解价值与选择" }, { title: "增长 / 用户运营", detail: "在真实市场中验证" }, { title: "创业探索", detail: "把洞察转为服务" }],
    "科技与未来": [{ title: "AI 产品探索", detail: "把技术变为真实体验" }, { title: "科技内容", detail: "解释未来变化" }, { title: "创新研究", detail: "提前寻找新问题" }],
    "生命与自然": [{ title: "健康与科学传播", detail: "让复杂知识可被使用" }, { title: "自然教育", detail: "把好奇变成体验" }, { title: "生活方式服务", detail: "帮助人们照顾身心" }],
    "艺术与审美": [{ title: "体验 / 内容设计", detail: "把感受做成可见作品" }, { title: "品牌与创意策略", detail: "用表达建立差异" }, { title: "内容策划", detail: "持续输出独特观点" }],
    "知识与思想": [{ title: "用户 / 行业研究", detail: "研究问题并形成判断" }, { title: "产品策略", detail: "把洞察变成决策" }, { title: "知识内容", detail: "学习、结构、表达" }],
    "系统与效率": [{ title: "产品经理", detail: "理清系统与优先级" }, { title: "运营策略", detail: "持续优化真实流程" }, { title: "服务设计", detail: "改善复杂体验" }],
    "生活与体验": [{ title: "体验活动策划", detail: "把想法做成现场体验" }, { title: "生活方式服务", detail: "创造可感知的成果" }, { title: "健康与运动内容", detail: "用实践影响日常" }],
  };
  return byLike[primaryLike ?? ""] ?? [{ title: "探索型项目", detail: "从真实问题开始" }, { title: "内容与研究", detail: "沉淀自己的判断" }, { title: "服务与体验", detail: "用小行动验证" }];
}

function DeepAnalysisGate({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="mt-5 overflow-hidden rounded-card border border-brand/35 bg-[linear-gradient(135deg,rgba(83,115,255,0.16),rgba(215,86,197,0.12))] p-5">
      <div className="text-micro font-semibold tracking-[2px] text-brand-lite">DEEPER VIEW</div>
      <h2 className="mt-2 text-subtitle font-bold text-ink">从“我大概是谁”到“我该怎么选”</h2>
      <p className="mt-2 max-w-[66ch] text-footnote leading-[1.8] text-sub">
        先看看完整报告的目录。具体的个人分数、组合判断与推荐内容会在解锁后生成并展示。
      </p>
      <LockedReportPreview />
      <Button size="lg" className="mt-5 w-full sm:w-auto" onClick={onUnlock}>
        解锁完整深入报告 ¥9.9
      </Button>
    </div>
  );
}

function LockedReportPreview() {
  const sections = [
    ["01", "完整喜欢地图", "9 个兴趣主题的投入强度、核心／延展兴趣与伪兴趣风险"],
    ["02", "完整擅长地图", "13 个优势动作的喜欢度、自然优势与四象限位置"],
    ["03", "你的解题路径", "2–3 条天然解决问题的动作链，以及优势使用过度的提醒"],
    ["04", "职业与副业匹配", "领域 × 角色 × 工作方式、探索门槛与第一份可交付成果"],
    ["05", "兴趣与 30 天实验", "哪些适合职业化、保留为兴趣，以及接下来如何验证"],
  ];
  return (
    <div className="mt-5 overflow-hidden rounded-field border border-white/10 bg-black/10">
      {sections.map(([index, title, desc], sectionIndex) => <div key={title} className="relative flex items-start gap-3 border-b border-white/10 px-3.5 py-3.5 last:border-0"><span className="pt-0.5 text-micro font-bold text-brand-lite">{index}</span><div><div className="text-caption font-semibold text-ink">{title}</div><div className="mt-1 text-micro leading-[1.6] text-sub">{desc}</div></div>{sectionIndex > 1 && <span className="absolute right-3 top-3.5 rounded-chip border border-white/10 bg-black/15 px-2 py-1 text-[10px] text-faint">解锁查看</span>}</div>)}
      <div className="pointer-events-none absolute" />
    </div>
  );
}

function DiscoveryMap({
  likes,
  strengths,
  energy,
  context,
}: {
  likes: string[];
  strengths: string[];
  energy: string[];
  context: string[];
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-card border border-line bg-card">
      <div className="border-b border-line px-5 py-4">
        <div className="text-micro font-semibold tracking-[1.8px] text-teal">LIFE MAP · 基础结论</div>
        <h2 className="mt-1 text-subtitle font-bold text-ink">你的喜欢 × 擅长人生地图</h2>
        <p className="mt-1 text-caption leading-[1.7] text-sub">先看你该优先投入哪里，而不是急着把自己归类成某个职业。</p>
      </div>
      <div className="grid gap-px bg-line sm:grid-cols-2">
        <MapCell tone="green" title="天赋热爱区 · 优先探索" text={`把「${likes[0]}」和「${strengths[0]}」放进真实项目，最值得成为职业核心或长期副业。`} />
        <MapCell tone="blue" title="兴趣潜力区 · 值得练习" text={`你对「${likes.slice(1).join("、")}」有持续兴趣；先用低成本作品或体验验证，而不是过早否定。`} />
        <MapCell tone="yellow" title="熟练消耗区 · 需要边界" text={`即使你擅长「${strengths.slice(1).join("、")}」，也要结合能量感判断是否值得长期承担。`} />
        <MapCell tone="slate" title="发挥条件 · 选择环境" text={energy.length && context.length ? `你更可能在「${energy.slice(0, 2).join("、")}」中被充电，并需要「${context.slice(0, 2).join("、")}」。` : "新版探索会补全你的能量来源和发挥环境，让结论更贴近可持续的选择。"} />
      </div>
    </div>
  );
}

function MapCell({ title, text, tone }: { title: string; text: string; tone: "green" | "blue" | "yellow" | "slate" }) {
  const colors = {
    green: "bg-[#3ED9A4]/[0.08] text-[#78E7C1]",
    blue: "bg-[#5E96FF]/[0.08] text-[#A9C5FF]",
    yellow: "bg-[#F0A949]/[0.08] text-[#FFD18B]",
    slate: "bg-raised text-sub",
  };
  return <div className={`min-h-[124px] p-4 ${colors[tone]}`}><div className="text-caption font-semibold">{title}</div><p className="mt-2 text-caption leading-[1.7] text-sub">{text}</p></div>;
}

function FormulaCard({
  eyebrow,
  title,
  desc,
  tint,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  tint: string;
}) {
  return (
    <div className="rounded-tile border border-line bg-card p-4">
      <div className="text-micro font-semibold tracking-[1.6px]" style={{ color: tint }}>
        {eyebrow}
      </div>
      <div className="mt-1 text-lead font-bold text-ink">{title}</div>
      <div className="mt-1 text-caption leading-[1.6] text-sub">{desc}</div>
    </div>
  );
}

function InsightCard({
  title,
  eyebrow,
  tint,
  items,
}: {
  title: string;
  eyebrow: string;
  tint: string;
  items: DiscoveryInsight[];
}) {
  return (
    <div className="rounded-card border border-line bg-card p-5">
      <div className="text-micro font-semibold tracking-[1.8px]" style={{ color: tint }}>
        {eyebrow}
      </div>
      <h2 className="mt-1 text-subtitle font-bold text-ink">{title}</h2>
      <div className="mt-4 flex flex-col gap-3">
        {items.map((item, itemIndex) => (
          <div key={`${item.label}-${itemIndex}`} className="rounded-field bg-raised px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="text-caption font-bold text-faint">0{itemIndex + 1}</span>
              <span className="text-body font-semibold text-ink">{item.label}</span>
            </div>
            <div className="mt-2 text-micro font-medium text-brand-lite">{item.evidence}</div>
            <p className="mt-1 text-caption leading-[1.7] text-sub">{item.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
