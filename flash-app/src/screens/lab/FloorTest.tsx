import { useState } from 'react';
import { CARRY_META } from '@/data/lab';
import type { CarryCardKey } from '@/data/lab';

type FloorAnswer = 'accept' | 'reject';

interface FloorTestProps {
  carry: CarryCardKey[];
}

// 底线压力测试 — one accept/reject per carried card, then a verdict.
// Mirrors renderFloorTest / answerFloor (~4150-4189).
export default function FloorTest({ carry }: FloorTestProps) {
  const [answers, setAnswers] = useState<Partial<Record<CarryCardKey, FloorAnswer>>>({});

  // Reset answers whenever the set of carried cards changes (new推演 run).
  const carryKey = carry.join(',');
  const [prevKey, setPrevKey] = useState(carryKey);
  if (carryKey !== prevKey) {
    setPrevKey(carryKey);
    setAnswers({});
  }

  if (carry.length === 0) {
    return <div className="floor-test" id="floorTest" data-testid="rs-floor-test" />;
  }

  const answer = (id: CarryCardKey, val: FloorAnswer): void => {
    setAnswers((cur) => ({ ...cur, [id]: val }));
  };
  const allAnswered = carry.every((id) => answers[id] !== undefined);
  const rejected = carry.filter((id) => answers[id] === 'reject').map((id) => CARRY_META[id].name);

  return (
    <div className="floor-test show" id="floorTest" data-testid="rs-floor-test">
      <div className="overline">BOTTOM-LINE STRESS TEST · 底线压力测试</div>
      <h4>最差的可能，是否击穿了你必须带走的东西？</h4>
      <p>不要判断它“值不值得”，只回答：如果最坏结果真的发生，这张底牌受到冲击，你是否仍能承受并继续走下去？</p>
      <div className="floor-items" id="floorItems">
        {carry.map((id) => {
          const m = CARRY_META[id];
          return (
            <div className="floor-item" data-floor={id} key={id}>
              <div className="floor-item-head">
                <i>{m.glyph}</i>
                <b>{m.name}</b>
              </div>
              <p>{m.risk}</p>
              <div className="floor-actions">
                <button
                  type="button"
                  className={`accept${answers[id] === 'accept' ? ' on' : ''}`}
                  data-testid={`floor-accept-${id}`}
                  onClick={() => {
                    answer(id, 'accept');
                  }}
                >
                  最差如此，仍可承受
                </button>
                <button
                  type="button"
                  className={`reject${answers[id] === 'reject' ? ' on' : ''}`}
                  data-testid={`floor-reject-${id}`}
                  onClick={() => {
                    answer(id, 'reject');
                  }}
                >
                  这已经越过底线
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <FloorVerdict done={allAnswered} rejected={rejected} count={carry.length} />
    </div>
  );
}

interface FloorVerdictProps {
  done: boolean;
  rejected: string[];
  count: number;
}

function FloorVerdict({ done, rejected, count }: FloorVerdictProps) {
  if (!done) {
    return <div className="floor-verdict" id="floorVerdict" data-testid="rs-floor-verdict" />;
  }
  if (rejected.length === 0) {
    return (
      <div className="floor-verdict show go" id="floorVerdict" data-testid="rs-floor-verdict">
        <div className="cap">可以继续转变 · 但不是盲目乐观</div>
        <b>{`你看见了最差结果，也确认它没有击穿带入的 ${String(count)} 张底线卡。`}</b>
        <p>这说明这条路值得继续验证。下一步不是立刻跳下去，而是为这些底线分别保留现实缓冲。</p>
      </div>
    );
  }
  return (
    <div className="floor-verdict show stop" id="floorVerdict" data-testid="rs-floor-verdict">
      <div className="cap">暂时不要直接跨过去</div>
      <b>{`最坏结果会击穿：${rejected.join('、')}`}</b>
      <p>这不等于你不适合改变。先为这些底线建立保护条件，再回来重新测试。</p>
    </div>
  );
}
