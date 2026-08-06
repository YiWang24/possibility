import { useMemo, useState } from 'react';
import { useAppStore, usePushOpen, usePushPayload } from '@/store/appStore';
import DiaryDay from '@/screens/home/diary/DiaryDay';
import DiarySummary from '@/screens/home/diary/DiarySummary';
import { defaultDiaryDate, type DiaryView } from '@/screens/home/diary/diaryHelpers';
import { useDiaryStore } from '@/screens/home/diary/diaryStore';
import { localIsoDate, mergeWithSeed } from '@/screens/home/diary/diaryStorage';

const TABS: { view: DiaryView; label: string }[] = [
  { view: 'day', label: '每日记录' },
  { view: 'month', label: '月度总结' },
  { view: 'year', label: '年度总结' },
];

export default function DiaryPush() {
  const open = usePushOpen('diaryPage');
  const payload = usePushPayload('diaryPage');
  const closePush = useAppStore((s) => s.closePush);
  const showToast = useAppStore((s) => s.showToast);

  const recorded = useDiaryStore((s) => s.recorded);
  const store = useDiaryStore;
  const todayIso = useMemo(() => localIsoDate(new Date()), []);
  const fallbackDate = useMemo(() => defaultDiaryDate(mergeWithSeed(recorded), todayIso), [recorded, todayIso]);

  const [view, setView] = useState<DiaryView>('day');
  const [selectedDate, setSelectedDate] = useState(fallbackDate);
  const [prevOpen, setPrevOpen] = useState(false);

  // Opening the push resets to the day view on the requested date (openVoiceDiary).
  // Adjusting state during render on the closed→open transition avoids a
  // set-state-in-effect cascade.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelectedDate(payload.date ?? fallbackDate);
      setView('day');
    }
  }

  const recordToday = () => {
    closePush('diaryPage');
    // The recorder UI lives on the home card, so start the session as we hand off.
    void store.getState().startRecording();
  };

  return (
    <section className={`push diary-page${open ? ' open' : ''}`} id="diaryPage" data-testid="push-diaryPage">
      <div className="top">
        <button
          type="button"
          className="backbtn"
          data-testid="push-diaryPage-back"
          aria-label="返回认识自己首页"
          onClick={() => {
            closePush('diaryPage');
          }}
        >
          ‹
        </button>
        <div>
          <h2>语音日记</h2>
          <div className="sub2">听见每天的自己，也看见长期变化</div>
        </div>
      </div>
      <div className="scroll" id="diaryScroll">
        <div className="diary-tabs" id="diaryTabs">
          {TABS.map((tab) => (
            <button
              key={tab.view}
              type="button"
              className={`diary-tab${view === tab.view ? ' on' : ''}`}
              data-view={tab.view}
              data-testid={`diary-tab-${tab.view}`}
              aria-selected={view === tab.view}
              onClick={() => {
                setView(tab.view);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {view === 'day' ? (
          <DiaryDay selectedDate={selectedDate} onSelectDate={setSelectedDate} onRecordToday={recordToday} showToast={showToast} />
        ) : (
          <DiarySummary period={view} showToast={showToast} />
        )}
      </div>
    </section>
  );
}
