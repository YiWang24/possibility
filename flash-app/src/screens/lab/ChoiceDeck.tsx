import { useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useAppStore } from '@/store/appStore';
import type { LabChoiceCard } from '@/data/lab';
import type { CustomChoice } from '@/data/lab-sim';

interface ChoiceDeckProps {
  deck: LabChoiceCard[];
  custom: CustomChoice[];
  pickedName: string | null;
  deckMeta: string;
  onPick: (name: string) => void;
  onSaveCustom: (id: string | null, name: string, desc: string) => void;
}

// 我的选择卡 — the fanned choice deck + custom-card editor.
// Fan geometry mirrors layoutChoiceDeck (~3934); picking mirrors pickChoice (~4541).
export default function ChoiceDeck({ deck, custom, pickedName, deckMeta, onPick, onSaveCustom }: ChoiceDeckProps) {
  const showToast = useAppStore((s) => s.showToast);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const total = deck.length + custom.length + 1;

  const openCreate = (): void => {
    setEditingId(null);
    setName('');
    setDesc('');
    setEditorOpen(true);
  };
  const openEdit = (c: CustomChoice): void => {
    setEditingId(c.id);
    setName(c.name);
    setDesc(c.desc);
    setEditorOpen(true);
  };
  const save = (): void => {
    const n = name.trim();
    if (n === '') {
      showToast('先写下这张选择卡的名称');
      return;
    }
    onSaveCustom(editingId, n, desc.trim());
    setEditorOpen(false);
  };
  const onEditorKey = (e: ReactKeyboardEvent<HTMLElement>): void => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditorOpen(false);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      save();
    }
  };
  const onCustomClick = (c: CustomChoice, e: { detail: number }): void => {
    if (e.detail >= 2) openEdit(c);
    else onPick(c.name);
  };

  return (
    <>
      <div className="sec-t">
        <h3>我的选择卡</h3>
        <span id="choiceDeckMeta">{deckMeta}</span>
      </div>
      <div className="choice-gesture-hint">
        <span>自定义卡</span>
        <b>双击编辑</b>
        <i>·</i>
        <b>向上拖动删除</b>
      </div>

      <div className="choices" id="choices">
        {deck.map((c, i) => (
          <button
            key={c.name}
            type="button"
            className={`choice${pickedName === c.name ? ' on' : ''}`}
            data-name={c.name}
            data-testid={`lab-choice-${String(i)}`}
            style={cardStyle(c.glow, i, total)}
            onClick={() => {
              onPick(c.name);
            }}
          >
            <span className="g">{c.g}</span>
            <b>{c.name}</b>
            <p>{c.copy}</p>
          </button>
        ))}

        {custom.map((c, j) => (
          <button
            key={c.id}
            type="button"
            className={`choice custom-choice-card custom-choice-item${pickedName === c.name ? ' on' : ''}`}
            data-custom-id={c.id}
            data-name={c.name}
            data-testid={`lab-choice-custom-${c.id}`}
            title={`${c.name} · 双击编辑 · 向上拖动删除`}
            style={cardStyle(j % 2 === 1 ? 'rgba(143,123,255,.22)' : 'rgba(227,92,193,.18)', deck.length + j, total)}
            onClick={(e) => {
              onCustomClick(c, e);
            }}
          >
            <span className="g">✍️</span>
            <b>{c.name}</b>
            <p>{c.desc}</p>
            <small className="custom-choice-cue">双击编辑 · ↑ 删除</small>
          </button>
        ))}

        <button
          type="button"
          className="choice custom-choice-card choice-create"
          id="customChoiceCard"
          data-name=""
          data-custom-ready="false"
          data-testid="lab-choice-create"
          style={cardStyle('rgba(227,92,193,.2)', total - 1, total)}
          onClick={openCreate}
        >
          <span className="g">＋</span>
          <b id="customChoiceCardTitle">自定义选择</b>
          <p id="customChoiceCardDesc">写下你真正想探索的选项</p>
        </button>
      </div>

      <div className={`custom-choice-editor${editorOpen ? ' show' : ''}`} id="customChoiceEditor">
        <div className="head">
          <b id="customChoiceEditorTitle">{editingId !== null ? '编辑这张选择卡' : '新增一张选择卡'}</b>
          <span>Enter 保存 · Esc 取消</span>
        </div>
        <div className="custom-choice-fields">
          <input
            id="customChoiceName"
            data-testid="lab-custom-name"
            maxLength={18}
            placeholder="选择名称，例如：先休息三个月"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            onKeyDown={onEditorKey}
          />
          <textarea
            id="customChoiceDesc"
            data-testid="lab-custom-desc"
            maxLength={42}
            placeholder="补充一句说明（可选）"
            value={desc}
            onChange={(e) => {
              setDesc(e.target.value);
            }}
            onKeyDown={onEditorKey}
          />
        </div>
      </div>
    </>
  );
}

// Fan transform per card, matching layoutChoiceDeck's spread/step/rotation math.
function cardStyle(glow: string, index: number, total: number): CSSProperties {
  const spread = Math.min(310, Math.max(224, (total - 1) * 52));
  const step = total > 1 ? spread / (total - 1) : 0;
  const center = (total - 1) / 2;
  const distance = index - center;
  const normalized = center !== 0 ? distance / center : 0;
  const z = Math.round(20 - Math.abs(distance) * 2);
  return {
    '--stamp-glow': glow,
    '--fan-x': `${String(Math.round(distance * step))}px`,
    '--fan-y': `${String(Math.round(-5 + Math.pow(Math.abs(normalized), 1.35) * 23))}px`,
    '--fan-r': `${(normalized * 16).toFixed(1)}deg`,
    '--fan-z': String(z),
    '--stack-z': String(z),
  } as unknown as CSSProperties;
}
