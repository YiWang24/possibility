import type { Scenario } from '@/data/lab-sim';
import type { CarryCardKey } from '@/data/lab';
import FloorTest from './FloorTest';

interface ScenarioPanelProps {
  scenario: Scenario;
  active: boolean;
  carry: CarryCardKey[];
  /** Bumped each time the result page opens, so the floor test starts fresh per run. */
  runKey: number;
}

// One推演 outcome panel (rs-panel). Faithful to prototype #rsp0/#rsp1/#rsp2.
export default function ScenarioPanel({ scenario: s, active, carry, runKey }: ScenarioPanelProps) {
  return (
    <div className={`rs-panel${active ? ' on' : ''}`} data-testid={`rs-panel-${s.key}`}>
      <div className="rs-sum" style={{ background: s.sumBackground, border: s.sumBorder }}>
        <div className="k" style={{ color: s.eyebrowColor }}>
          {s.eyebrow}
        </div>
        <h3>{s.headline}</h3>
      </div>

      <div className="card rs-dims">
        {s.dims.map((d) => (
          <div className="rs-dim" key={d[0]}>
            <span className="lb">{d[0]}</span>
            <p>{d[1]}</p>
          </div>
        ))}
      </div>

      <div className="rs-two">
        {s.lists.map((list) => (
          <div className="card rs-list" key={list.title}>
            <h5>
              <i style={{ background: list.accent }} />
              {list.title}
            </h5>
            {list.items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </div>
        ))}
      </div>

      {s.keyBold !== undefined ? (
        <div className="rs-key">
          {s.keyLead}
          <b>{s.keyBold}</b>
        </div>
      ) : null}

      {s.floorTest === true ? <FloorTest key={runKey} carry={carry} /> : null}
    </div>
  );
}
