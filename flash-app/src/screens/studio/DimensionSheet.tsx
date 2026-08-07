// 五个软维度通用的关键词浮层（原型 #skillSheet / DIMENSION_CONFIG，对齐 iOS
// DimensionSheet）：关键词批次「换一批」+ 自定义词 + 小工具入口（测评 / 卡牌），
// 保存后回填画像。App 里只挂一份，首页和画像工作室共用。

import { useState, type CSSProperties } from 'react';
import { DIMENSION_CONFIG, type DimensionKey, type DimensionTool } from '@/data/dimensions';
import { useAppStore } from '@/store/appStore';
import { joinKeywords, MAX_DIMENSION_KEYWORDS } from './assessmentEngine';
import { dimensionKeywords, usePortraitStore } from './portraitStore';

interface SheetDraft {
  /** 当前已播种的维度；与 store 里的 activeKey 不一致时整份重建。 */
  key: DimensionKey | null;
  batch: number;
  /** 系统推荐词，保序。 */
  selected: string[];
  custom: string[];
  showInput: boolean;
  text: string;
}

const EMPTY_DRAFT: SheetDraft = { key: null, batch: 0, selected: [], custom: [], showInput: false, text: '' };

interface Chip {
  word: string;
  isCustom: boolean;
}

/** 展示序：已选但不在当前批的词 → 当前批 → 自定义词，去重。 */
function chipList(batchWords: readonly string[], selected: readonly string[], custom: readonly string[]): Chip[] {
  const seen = new Set<string>();
  const out: Chip[] = [];
  for (const word of [...selected.filter((w) => !batchWords.includes(w)), ...batchWords]) {
    if (seen.has(word)) continue;
    seen.add(word);
    out.push({ word, isCustom: false });
  }
  for (const word of custom) {
    if (seen.has(word)) continue;
    seen.add(word);
    out.push({ word, isCustom: true });
  }
  return out;
}

export default function DimensionSheet() {
  const activeKey = useAppStore((s) => s.dimensionSheet);
  const closeSheet = useAppStore((s) => s.closeDimensionSheet);
  const openPush = useAppStore((s) => s.openPush);
  const showToast = useAppStore((s) => s.showToast);
  const dims = usePortraitStore((s) => s.dims);
  const setDim = usePortraitStore((s) => s.setDim);

  const [draft, setDraft] = useState<SheetDraft>(EMPTY_DRAFT);

  // 换维度时整份重建草稿，并用画像里已存的词回填已选状态。
  if (draft.key !== activeKey) {
    setDraft({ ...EMPTY_DRAFT, key: activeKey, selected: activeKey !== null ? dimensionKeywords(dims[activeKey]) : [] });
  }

  const open = activeKey !== null;
  // 关闭动画期间 activeKey 已为 null，仍用 draft.key 的配置渲染，避免内容闪空。
  const key = activeKey ?? draft.key;
  const config = key !== null ? DIMENSION_CONFIG[key] : null;

  const patch = (changes: Partial<SheetDraft>): void => {
    setDraft((prev) => ({ ...prev, ...changes }));
  };

  const toggle = (chip: Chip): void => {
    if (chip.isCustom) {
      patch({ custom: draft.custom.filter((word) => word !== chip.word) });
      return;
    }
    patch(
      draft.selected.includes(chip.word)
        ? { selected: draft.selected.filter((word) => word !== chip.word) }
        : { selected: [...draft.selected, chip.word] },
    );
  };

  const addCustom = (): void => {
    const word = draft.text.trim();
    if (word === '' || draft.custom.includes(word) || draft.selected.includes(word)) {
      patch({ text: '' });
      return;
    }
    patch({ custom: [...draft.custom, word], text: '' });
  };

  const launchTool = (tool: DimensionTool): void => {
    if (tool.action.open === 'assessment') {
      // 浮层留在下面：测评页 z-index 更高，退出后用户回到原来的维度。
      openPush('assessmentPage', { assessmentKind: tool.action.assessment });
      return;
    }
    closeSheet();
    openPush('cardGameHub', { deck: tool.action.deck, ...(key !== null ? { writeBackDim: key } : {}) });
  };

  const save = (): void => {
    if (key === null) return;
    const keywords = [...draft.selected, ...draft.custom].slice(0, MAX_DIMENSION_KEYWORDS);
    if (keywords.length === 0) return;
    setDim(key, joinKeywords(keywords));
    showToast('已保存到你的画像');
    closeSheet();
  };

  const chips = config !== null ? chipList(config.batches[draft.batch] ?? [], draft.selected, draft.custom) : [];
  const canSave = draft.selected.length > 0 || draft.custom.length > 0;

  return (
    <>
      <div
        className={`backdrop${open ? ' open' : ''}`}
        data-testid="dimension-sheet-backdrop"
        role="presentation"
        onClick={closeSheet}
      />
      <section className={`sheet${open ? ' open' : ''}`} id="dimensionSheet" data-testid="dimension-sheet">
        <div className="grab" />
        {config !== null ? (
          <>
            <h2>{config.title}</h2>

            <div className="dimension-q-row">
              <div className="q1">
                <i>01</i>
                {config.question}
              </div>
              <button
                type="button"
                className="batch-btn"
                data-testid="dimension-batch"
                onClick={() => {
                  patch({ batch: (draft.batch + 1) % config.batches.length });
                }}
              >
                换一批 ↻
              </button>
            </div>

            <div className="chips" id="dimensionChips">
              {chips.map((chip, i) => {
                const on = chip.isCustom || draft.selected.includes(chip.word);
                return (
                  <button
                    type="button"
                    key={chip.word}
                    className={`chip${chip.isCustom ? ' custom' : ''}${on ? ' on' : ''}`}
                    style={{ '--i': i } as CSSProperties}
                    data-testid={`dimension-chip-${chip.word}`}
                    onClick={() => {
                      toggle(chip);
                    }}
                  >
                    {chip.word}
                  </button>
                );
              })}
            </div>

            <div className="tag-source">
              <span>
                <i />
                系统推荐
              </span>
              <span className="mine">
                <i />
                我添加的
              </span>
            </div>

            <button
              type="button"
              className="self-input-toggle"
              data-testid="dimension-custom-toggle"
              onClick={() => {
                patch({ showInput: !draft.showInput });
              }}
            >
              ＋ 自己输入一个关键词
            </button>

            <div className={`custom-tag-panel${draft.showInput ? ' show' : ''}`}>
              <input
                type="text"
                value={draft.text}
                placeholder="输入一个最像你的词"
                data-testid="dimension-custom-input"
                onChange={(e) => {
                  patch({ text: e.target.value });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCustom();
                }}
              />
              <button type="button" data-testid="dimension-custom-add" onClick={addCustom}>
                添加
              </button>
            </div>

            <div className="q1" style={{ marginTop: 22 }}>
              <i>02</i>
              或者，用小工具继续探索
            </div>
            <div className="tests">
              {config.tools.map((tool) => (
                <button
                  type="button"
                  className="test"
                  key={tool.name}
                  style={{ background: tool.color }}
                  data-testid={`dimension-tool-${tool.name}`}
                  onClick={() => {
                    launchTool(tool);
                  }}
                >
                  <b>{tool.name}</b>
                  <p>{tool.desc}</p>
                  <span className="tm2">{tool.duration}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="result-save save-profile-btn"
              disabled={!canSave}
              data-testid="dimension-save"
              onClick={save}
            >
              保存到我的画像
            </button>
          </>
        ) : null}
      </section>
    </>
  );
}
