import { useState } from 'react';
import { useAppStore, usePushOpen, usePushPayload } from '@/store/appStore';
import { SCENARIOS, getLabRun, scenarioIndex } from '@/data/lab-sim';
import ScenarioPanel from '@/screens/lab/ScenarioPanel';
import SimPeople from '@/screens/lab/SimPeople';

// 推演结果 — best / likely / worst outcome tabs. Faithful to prototype #resultPage
// (HTML ~2199-2308). Run data (pick / year / question / carry) comes from getLabRun().
export default function ResultPush() {
  const open = usePushOpen('resultPage');
  const payload = usePushPayload('resultPage');
  const closePush = useAppStore((s) => s.closePush);
  const showToast = useAppStore((s) => s.showToast);
  const openPush = useAppStore((s) => s.openPush);

  const [tab, setTab] = useState(() => scenarioIndex(payload.scenario ?? 'likely'));
  // Re-select the requested scenario and reset the floor test each time it (re)opens.
  const [wasOpen, setWasOpen] = useState(open);
  const [runKey, setRunKey] = useState(0);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTab(scenarioIndex(payload.scenario ?? 'likely'));
      setRunKey((k) => k + 1);
    }
  }

  const run = getLabRun();

  return (
    <section className={`push${open ? ' open' : ''}`} id="resultPage" data-testid="push-resultPage">
      <div className="top">
        <button
          type="button"
          className="backbtn"
          data-testid="push-resultPage-back"
          aria-label="返回选择"
          onClick={() => {
            closePush('resultPage');
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div>
          <h2>推演结果</h2>
          <div className="sub2" id="resultSub">{`${run.pick} · ${String(run.year)} 年后`}</div>
        </div>
      </div>

      <div className="scroll">
        <div className="rs-head">
          <p className="q">
            「<b id="rsQText">{run.question}</b>」的三种可能 —— 先看一般情况，再看两端。
          </p>
          <div className="seg" id="rsSeg">
            {SCENARIOS.map((s, i) => (
              <button
                key={s.key}
                type="button"
                className={i === tab ? 'on' : ''}
                data-testid={`rs-seg-${s.key}`}
                onClick={() => {
                  setTab(i);
                }}
              >
                {s.tab}
              </button>
            ))}
          </div>
        </div>

        {SCENARIOS.map((s, i) => (
          <ScenarioPanel key={s.key} scenario={s} active={i === tab} carry={run.carry} runKey={runKey} />
        ))}

        <div className="sec-t">
          <h3>类似经验的人</h3>
          <span>左右滑动查看</span>
        </div>
        <SimPeople
          onOpenProfile={(id) => {
            openPush('profilePage', { userId: id });
          }}
        />

        <button
          type="button"
          className="btn-ink btn-cta"
          style={{ marginTop: '24px' }}
          data-testid="rs-restart"
          onClick={() => {
            closePush('resultPage');
            showToast('回到实验室，换一张选择卡试试');
          }}
        >
          重新选择
        </button>
        <div style={{ height: '30px' }} />
      </div>
    </section>
  );
}
