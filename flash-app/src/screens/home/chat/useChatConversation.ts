// Conversation state for the exploration dialogue: the funnel's stage machine, the
// transcript React renders, and the transcript the model sees.
//
// Extracted from ChatPush so the push component stays a rendering concern.

import { useEffect, useRef, useState } from 'react';
import { requestAssistantTurn, type ChatStage, type Turn } from './chatLlm';
import { CORRECTION_PROMPT_HTML, clarifyFollowupHTML, clarifyIntroHTML, confirmAnalysisHTML, correctionAckHTML, insightHTML } from './chatScript';

export type ChatItem =
  | { kind: 'me'; text: string }
  /** Scripted copy: trusted markup, rendered as HTML. */
  | { kind: 'ai'; html: string }
  /** Model output: rendered as plain text — never as HTML. */
  | { kind: 'ai-text'; text: string }
  | { kind: 'think' }
  | { kind: 'review-actions' }
  | { kind: 'correction-actions' }
  | { kind: 'next-actions' };

type FollowUp = 'none' | 'review' | 'correction' | 'next';

/** Scripted copy carries <b>/<br>; the model only ever sees plain text. */
export function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function withFollowUp(list: ChatItem[], follow: FollowUp): ChatItem[] {
  if (follow === 'review') return [...list, { kind: 'review-actions' }];
  if (follow === 'correction') return [...list, { kind: 'correction-actions' }];
  if (follow === 'next') return [...list, { kind: 'next-actions' }];
  return list;
}

const dropActions = (list: ChatItem[]) => list.filter((it) => it.kind !== 'review-actions' && it.kind !== 'correction-actions');

export interface ChatConversation {
  items: ChatItem[];
  answers: string[];
  busy: boolean;
  /** The transcript to summarise — read at the moment the summary opens. */
  turns: () => Turn[];
  send: (value: string) => void;
  confirmInsight: () => void;
  requestCorrection: () => void;
}

export function useChatConversation(open: boolean, seedQuestion: string, topic: string | undefined): ChatConversation {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [stage, setStage] = useState<ChatStage>('clarify');
  const [turn, setTurn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);

  /** Conversation as the model sees it — a ref so consecutive turns don't race state. */
  const turnsRef = useRef<Turn[]>([]);
  /** Guards against a reply from a previous conversation landing in a new one. */
  const runIdRef = useRef(0);
  /** Latest state for the async turn, which outlives the render that started it. */
  const stateRef = useRef({ answers, stage, turn });
  stateRef.current = { answers, stage, turn };

  const pushTurn = (role: Turn['role'], text: string) => {
    turnsRef.current = [...turnsRef.current, { role, text }];
  };

  /**
   * Ask the model for this stage's line, streaming it in; fall back to `scriptHtml`
   * when the model is unreachable so the funnel still completes end to end.
   */
  const runAssistant = async (nextStage: ChatStage, scriptHtml: string, follow: FollowUp): Promise<void> => {
    const runId = runIdRef.current;
    setBusy(true);
    setItems((prev) => [...prev, { kind: 'think' }]);

    let streamed = '';
    let text: string | null = null;
    try {
      text = await requestAssistantTurn({
        stage: nextStage,
        topic,
        seedQuestion,
        turns: [...turnsRef.current],
        onDelta: (full) => {
          if (runIdRef.current !== runId) return;
          streamed = full;
          setItems((prev) => {
            const base = prev.filter((it) => it.kind !== 'think');
            const last = base[base.length - 1];
            if (last?.kind === 'ai-text') return [...base.slice(0, -1), { kind: 'ai-text', text: full }];
            return [...base, { kind: 'ai-text', text: full }];
          });
        },
      });
    } catch {
      text = null;
    }
    if (runIdRef.current !== runId) return;

    const finalText = text ?? (streamed.trim() === '' ? null : streamed);
    setItems((prev) => {
      const base = prev.filter((it) => it.kind !== 'think' && !(it.kind === 'ai-text' && it.text === streamed));
      const reply: ChatItem = finalText === null ? { kind: 'ai', html: scriptHtml } : { kind: 'ai-text', text: finalText };
      return withFollowUp([...base, reply], follow);
    });
    pushTurn('assistant', finalText ?? stripTags(scriptHtml));
    setBusy(false);
  };

  // runAssistant is redefined every render; the ref gives the effect below a stable
  // handle to the latest one without having to list it as a dependency.
  const runAssistantRef = useRef(runAssistant);
  runAssistantRef.current = runAssistant;

  // Seed a fresh conversation on the closed→open transition (startChat). An effect
  // rather than a render-time reset: it mutates refs and fires the first request.
  useEffect(() => {
    if (open === prevOpen) return;
    setPrevOpen(open);
    if (!open) return;
    runIdRef.current += 1;
    turnsRef.current = [];
    setItems([{ kind: 'me', text: seedQuestion }]);
    setAnswers([]);
    setStage('clarify');
    setTurn(0);
    void runAssistantRef.current('clarify', clarifyIntroHTML(topic), 'none');
  }, [open, prevOpen, seedQuestion, topic]);

  const send = (value: string) => {
    if (value === '' || busy) return;
    const { answers: a, stage: s, turn: t } = stateRef.current;
    setItems((prev) => [...prev, { kind: 'me', text: value }]);
    setAnswers((prev) => [...prev, value]);
    pushTurn('user', value);
    if (s === 'clarify' && t === 0) {
      setTurn(1);
      void runAssistant('clarify', clarifyFollowupHTML(topic), 'none');
    } else if (s === 'clarify') {
      setTurn(2);
      setStage('review');
      void runAssistant('review', insightHTML(a[0], value), 'review');
    } else if (s === 'correction') {
      void runAssistant('correction', correctionAckHTML(value), 'correction');
    }
  };

  const confirmInsight = () => {
    if (busy) return;
    const ack = '嗯，这个理解比较接近我。';
    const { answers: a } = stateRef.current;
    setItems((prev) => [...dropActions(prev), { kind: 'me', text: ack }]);
    pushTurn('user', ack);
    setStage('ready');
    void runAssistant('ready', confirmAnalysisHTML(a[0], a[1]), 'next');
  };

  const requestCorrection = () => {
    if (busy) return;
    const ack = '还不太对。';
    setItems((prev) => [...dropActions(prev), { kind: 'me', text: ack }, { kind: 'ai', html: CORRECTION_PROMPT_HTML }]);
    pushTurn('user', ack);
    pushTurn('assistant', stripTags(CORRECTION_PROMPT_HTML));
    setStage('correction');
  };

  return { items, answers, busy, turns: () => [...turnsRef.current], send, confirmInsight, requestCorrection };
}
