import type { ScreenProps } from './types';
import { useAppStore } from '@/store/appStore';
import DiaryCard from './home/DiaryCard';
import AskCard from './home/AskCard';
import PersonaPortrait from './home/PersonaPortrait';

export default function HomeScreen({ active }: ScreenProps) {
  const openPush = useAppStore((s) => s.openPush);

  return (
    <section className={`screen${active ? ' on' : ''}`} id="scr-home" data-testid="screen-home">
      <div className="greet">
        <div>
          <div className="eyebrow">7月23日 · 周四</div>
          <h1 className="page">晚上好，屿岸</h1>
        </div>
        <div className="r">
          已探索
          <br />
          <b>第 47 天</b>
        </div>
      </div>

      <DiaryCard />
      <AskCard />

      <button
        type="button"
        className="life-entry"
        id="lifeEntry"
        data-testid="life-entry"
        onClick={() => {
          openPush('cardGameHub');
        }}
      >
        <span className="mini-deck">
          <i />
          <i />
        </span>
        <span className="copy">
          <span className="cap">四套卡牌探索 · 3–8 分钟</span>
          <b id="lifeEntryTitle">人生卡牌：你最后会留下什么？</b>
          <p id="lifeEntryDesc">人生、婚姻、家庭、人际交往 · 选择一套开始</p>
        </span>
        <span className="go">›</span>
      </button>

      <PersonaPortrait />
    </section>
  );
}
