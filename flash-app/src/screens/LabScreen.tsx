import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScreenProps } from './types';
import { useAppStore } from '@/store/appStore';
import { CARRY_LIMIT, LAB_CHOICE_DECKS } from '@/data/lab';
import type { CarryCardKey } from '@/data/lab';
import { detectLabChoiceType, labLoadSteps, setLabRun, setLabScenarios } from '@/data/lab-sim';
import type { CustomChoice, LabRun } from '@/data/lab-sim';
import { applySimulation, simulateLabRun } from './lab/labSimulate';
import LabQuestionCard from './lab/LabQuestionCard';
import TimeDial from './lab/TimeDial';
import ChoiceDeck from './lab/ChoiceDeck';
import CarryDeck from './lab/CarryDeck';
import SimLoad from './lab/SimLoad';

const DEFAULT_QUESTION = '我是否要从交互设计师转为产品经理？';
const STEP_MS = 1100;

export default function LabScreen({ active }: ScreenProps) {
  const openPush = useAppStore((s) => s.openPush);
  const showToast = useAppStore((s) => s.showToast);

  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [year, setYear] = useState(5);
  const [pick, setPick] = useState<string | null>(null);
  const [carry, setCarry] = useState<CarryCardKey[]>([]);
  const [custom, setCustom] = useState<CustomChoice[]>([]);
  const [carryRevealed, setCarryRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadName, setLoadName] = useState('');
  const [loadStep, setLoadStep] = useState('');

  const timersRef = useRef<number[]>([]);
  const nextIdRef = useRef(1);

  const deck = useMemo(() => LAB_CHOICE_DECKS[detectLabChoiceType(question)], [question]);
  const deckMeta = `${String(deck.length + custom.length)} 张 · 左右滑动选择`;

  // Clear any pending推演 timers when the screen unmounts.
  useEffect(
    () => () => {
      timersRef.current.forEach((t) => {
        window.clearTimeout(t);
      });
    },
    [],
  );

  const onSaveQuestion = (q: string): void => {
    setQuestion(q);
    setPick(null);
    setCarry([]);
    setCarryRevealed(false);
    showToast('探索问题已更新');
  };

  const onPick = (name: string): void => {
    setPick(name);
    if (!carryRevealed) {
      setCarryRevealed(true);
      window.setTimeout(() => {
        document.getElementById('carrySection')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 180);
    }
  };

  const onToggleCarry = (key: CarryCardKey): void => {
    if (carry.includes(key)) {
      setCarry(carry.filter((k) => k !== key));
      return;
    }
    if (carry.length >= CARRY_LIMIT) {
      showToast('这一轮只能带三张最不能失去的牌');
      return;
    }
    setCarry([...carry, key]);
  };

  const onSaveCustom = (id: string | null, cname: string, cdesc: string): void => {
    const finalName = cname.slice(0, 18);
    const finalDesc = cdesc === '' ? '我的自定义选择' : cdesc.slice(0, 42);
    if (id !== null) {
      const old = custom.find((c) => c.id === id);
      setCustom(custom.map((c) => (c.id === id ? { ...c, name: finalName, desc: finalDesc } : c)));
      if (old !== undefined && old.name === pick) setPick(finalName);
      showToast('自定义选择卡已更新');
      return;
    }
    const newId = `custom-${String(nextIdRef.current)}`;
    nextIdRef.current += 1;
    setCustom([...custom, { id: newId, name: finalName, desc: finalDesc }]);
    showToast('新的自定义选择卡已加入卡组');
  };

  const runSim = (): void => {
    if (pick === null) {
      showToast('先拖一张选择卡进实验室');
      return;
    }
    const run: LabRun = { question, pick, year, carry: [...carry] };
    const steps = labLoadSteps(carry.length);

    timersRef.current.forEach((t) => {
      window.clearTimeout(t);
    });
    timersRef.current = [];

    setLoadName(run.pick);
    setLoadStep(steps[0] ?? '');
    setLoading(true);

    // The stepped copy now paces a real request rather than standing in for one. It
    // cycles until the model answers, so a slow call reads as thinking, not as a stall.
    for (let i = 1; i < steps.length; i++) {
      const text = steps[i] ?? '';
      timersRef.current.push(
        window.setTimeout(() => {
          setLoadStep(text);
        }, i * STEP_MS),
      );
    }

    void (async () => {
      const started = Date.now();
      let generated = null;
      try {
        generated = await simulateLabRun(run);
      } catch {
        // Falls through to the seeded outcomes below.
      }
      // Never flash the overlay: let the copy finish at least one pass.
      const elapsed = Date.now() - started;
      const minimum = steps.length * STEP_MS;
      if (elapsed < minimum) await new Promise((r) => setTimeout(r, minimum - elapsed));

      timersRef.current.forEach((t) => {
        window.clearTimeout(t);
      });
      timersRef.current = [];
      setLabRun(run);
      setLabScenarios(generated === null ? null : applySimulation(generated));
      setLoading(false);
      if (generated === null) showToast('这次没能生成专属推演，先看看示例结果');
      openPush('resultPage', { scenario: 'likely' });
    })();
  };

  const simBtnLabel = pick === null ? '先选择一条路' : carry.length > 0 ? `带着 ${String(carry.length)} 张底线卡开始推演` : '直接开始推演';

  return (
    <section className={`screen${active ? ' on' : ''}`} id="scr-lab" data-testid="screen-lab">
      <div className="eyebrow">LIFE LAB</div>
      <h1 className="page">人生实验室</h1>

      <LabQuestionCard question={question} onSave={onSaveQuestion} />
      <TimeDial year={year} pick={pick} carry={carry} onYear={setYear} />
      <ChoiceDeck deck={deck} custom={custom} pickedName={pick} deckMeta={deckMeta} onPick={onPick} onSaveCustom={onSaveCustom} />
      <CarryDeck selected={carry} revealed={carryRevealed} onToggle={onToggleCarry} />

      <button type="button" className="btn-ink btn-cta lab-go" id="simBtn" data-testid="lab-sim-btn" disabled={pick === null} onClick={runSim}>
        {simBtnLabel}
      </button>
      <p className="lab-note" style={{ textAlign: 'center', fontSize: '11px', color: 'var(--faint)', marginTop: '14px', lineHeight: 1.8 }}>
        基于动态画像与 1,842 位相似旅人经历 · 它不是预言，是一面镜子
      </p>

      {loading ? <SimLoad name={loadName} step={loadStep} /> : null}
    </section>
  );
}
