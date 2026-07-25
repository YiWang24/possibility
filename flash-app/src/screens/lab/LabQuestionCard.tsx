import { useState } from 'react';
import { useAppStore } from '@/store/appStore';

interface LabQuestionCardProps {
  question: string;
  onSave: (question: string) => void;
}

// 当前探索问题 card with inline edit. Mirrors toggleEditQ / saveEditQ (~3892-3914).
export default function LabQuestionCard({ question, onSave }: LabQuestionCardProps) {
  const showToast = useAppStore((s) => s.showToast);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question);

  const open = (): void => {
    setText(question);
    setEditing(true);
  };
  const save = (): void => {
    const v = text.trim();
    if (v === '') {
      showToast('问题不能为空');
      return;
    }
    onSave(v);
    setEditing(false);
  };

  return (
    <div className="card labq">
      <div className="lb">当前探索问题</div>
      {!editing ? (
        <h2 id="labQText" data-testid="lab-question">
          {question}
        </h2>
      ) : null}
      <div className={`labq-edit${editing ? ' show' : ''}`} id="labqEdit">
        <textarea
          id="labqInput"
          data-testid="lab-question-input"
          maxLength={100}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        <div className="le-row">
          <button
            type="button"
            className="le-cancel"
            data-testid="lab-question-cancel"
            onClick={() => {
              setEditing(false);
            }}
          >
            取消
          </button>
          <button type="button" className="le-save" data-testid="lab-question-save" onClick={save}>
            确定
          </button>
        </div>
      </div>
      {!editing ? (
        <div className="sw">
          <button type="button" className="swap" id="swapBtn" data-testid="lab-question-swap" onClick={open}>
            更换问题 ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
