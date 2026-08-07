import { create } from 'zustand';
import type { DeckKind } from '@/data/cardgames';
import type { DimensionKey } from '@/data/dimensions';
import type { AssessmentKind } from '@/screens/studio/assessmentConfig';

/** The four bottom-tab screens. Mirrors the prototype's `go(tab)`. */
export type TabId = 'home' | 'lab' | 'comm' | 'me';

/** Every full-screen "push" page that slides in over a tab screen. */
export type PushId =
  | 'chatPage'
  | 'chatSummaryPage'
  | 'diaryPage'
  | 'bountyPage'
  | 'resultPage'
  | 'profilePage'
  | 'myEditPage'
  | 'profileStudio'
  | 'contextPage'
  | 'assessmentPage'
  | 'assessmentResultPage'
  | 'cardGameHub';

/** Optional context carried when opening a push page. */
export interface PushPayload {
  /** profilePage: which community user to show. */
  userId?: number;
  /** diaryPage: which day to open. */
  date?: string;
  /** resultPage: which simulated scenario to show first. */
  scenario?: 'best' | 'likely' | 'worst';
  /** chatPage: the seed question / topic. */
  question?: string;
  topic?: string;
  /** assessmentPage: which of the six assessments to open. */
  assessmentKind?: AssessmentKind;
  /** cardGameHub: jump straight into one deck instead of the picker. */
  deck?: DeckKind;
  /** cardGameHub: write the kept cards back into this portrait dimension. */
  writeBackDim?: DimensionKey;
}

interface OpenPush {
  id: PushId;
  payload: PushPayload;
}

interface ToastState {
  id: number;
  msg: string;
}

interface AppState {
  tab: TabId;
  pushes: OpenPush[];
  /** The dimension whose keyword sheet is open, or null. */
  dimensionSheet: DimensionKey | null;
  toast: ToastState | null;
  toastSeq: number;

  setTab: (tab: TabId) => void;
  openPush: (id: PushId, payload?: PushPayload) => void;
  closePush: (id?: PushId) => void;
  closeAllPushes: () => void;
  openDimensionSheet: (key: DimensionKey) => void;
  closeDimensionSheet: () => void;
  showToast: (msg: string) => void;
  hideToast: (id: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  tab: 'home',
  pushes: [],
  dimensionSheet: null,
  toast: null,
  toastSeq: 0,

  // Switching tabs dismisses any open push pages, like the prototype's go().
  setTab: (tab) => {
    set({ tab, pushes: [], dimensionSheet: null });
  },

  openDimensionSheet: (key) => {
    set({ dimensionSheet: key });
  },

  closeDimensionSheet: () => {
    set({ dimensionSheet: null });
  },

  openPush: (id, payload = {}) => {
    set((state) => {
      const without = state.pushes.filter((p) => p.id !== id);
      return { pushes: [...without, { id, payload }] };
    });
  },

  // Close the top push, or a specific one by id.
  closePush: (id) => {
    set((state) => {
      if (id === undefined) return { pushes: state.pushes.slice(0, -1) };
      return { pushes: state.pushes.filter((p) => p.id !== id) };
    });
  },

  closeAllPushes: () => {
    set({ pushes: [] });
  },

  showToast: (msg) => {
    set((state) => {
      const id = state.toastSeq + 1;
      return { toast: { id, msg }, toastSeq: id };
    });
  },

  hideToast: (id) => {
    set((state) => (state.toast?.id === id ? { toast: null } : {}));
  },
}));

/** True when the given push id is currently in the open stack. */
export function usePushOpen(id: PushId): boolean {
  return useAppStore((s) => s.pushes.some((p) => p.id === id));
}

/**
 * Stable empty payload. Returning a fresh `{}` from the selector would make
 * zustand's getSnapshot return a new reference every render → infinite loop
 * ("Maximum update depth exceeded"). A frozen singleton keeps the reference
 * stable when a push is closed.
 */
const EMPTY_PAYLOAD: PushPayload = Object.freeze({});

/** The payload for a given push id (a stable empty object when closed). */
export function usePushPayload(id: PushId): PushPayload {
  return useAppStore((s) => s.pushes.find((p) => p.id === id)?.payload ?? EMPTY_PAYLOAD);
}
