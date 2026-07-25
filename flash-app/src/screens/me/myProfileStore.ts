// Shared state for the "我的" tab + its editor push. Mirrors the prototype's
// global `myProfile` / `myEditDraft` / MBTI badge, but as a zustand store so the
// Me screen and the MyEdit push (siblings in the tree) stay in sync.

import { create } from 'zustand';
import type { MyProfile } from '@/data/profile';
import { clone, loadMbtiBadge, loadMyProfile, MBTI_STORE_KEY, MY_PROFILE_KEY, safeStoreSet } from './myProfileStorage';
import { personaSource, profilePersonaItems } from './personaModel';

export type EditMode = 'basic' | 'story' | 'advice' | 'service' | 'persona';
export type MyTab = 'persona' | 'story' | 'advice' | 'service';

export interface SaveResult {
  ok: boolean;
  savedLabel: string;
  personaCount: number;
  reason?: 'empty-name' | 'storage';
}

/** Props shared by every edit-mode sub-editor. */
export interface EditorProps {
  draft: MyProfile;
  updateDraft: (updater: (draft: MyProfile) => MyProfile) => void;
}

const SAVE_LABELS: Record<EditMode, string> = {
  basic: '基础资料',
  story: '我的故事',
  advice: '经验与建议',
  service: '提供服务',
  persona: '动态画像展示设置',
};

interface MyProfileState {
  myProfile: MyProfile;
  mbti: string | null;
  meTab: MyTab;
  editMode: EditMode | null;
  editDraft: MyProfile | null;

  setMeTab: (tab: MyTab) => void;
  beginEdit: (mode: EditMode) => void;
  cancelEdit: () => void;
  updateDraft: (updater: (draft: MyProfile) => MyProfile) => void;
  saveEdit: () => SaveResult;
  setMbti: (type: string) => void;
}

/** Apply basic-mode fallbacks the way the prototype's `saveMyProfile` does. */
function finalizeBasic(draft: MyProfile): MyProfile | null {
  const name = draft.name.trim();
  if (name === '') return null;
  const from = draft.meta.from.trim() === '' ? '过去的我' : draft.meta.from.trim();
  const to = draft.meta.to.trim() === '' ? '现在的我' : draft.meta.to.trim();
  const tags = draft.tags
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '')
    .slice(0, 5);
  return {
    ...draft,
    name,
    ini: name.slice(0, 1),
    bio: `${from} → ${to}`,
    tags,
    meta: {
      ...draft.meta,
      from,
      to,
      city: draft.meta.city.trim() === '' ? '未设置' : draft.meta.city.trim(),
      years: draft.meta.years.trim() === '' ? '正在探索' : draft.meta.years.trim(),
      result: draft.meta.result.trim() === '' ? '持续探索中' : draft.meta.result.trim(),
    },
  };
}

function finalizeStory(draft: MyProfile): MyProfile {
  return {
    ...draft,
    quote: draft.quote.trim(),
    meta: { ...draft.meta, intro: draft.meta.intro.trim(), full: draft.meta.full.trim() },
  };
}

export const useMyProfileStore = create<MyProfileState>((set, get) => ({
  myProfile: loadMyProfile(),
  mbti: loadMbtiBadge(),
  meTab: 'persona',
  editMode: null,
  editDraft: null,

  setMeTab: (tab) => {
    set({ meTab: tab });
  },

  beginEdit: (mode) => {
    set({ editMode: mode, editDraft: clone(get().myProfile) });
  },

  cancelEdit: () => {
    set({ editMode: null, editDraft: null });
  },

  updateDraft: (updater) => {
    const draft = get().editDraft;
    if (draft === null) return;
    set({ editDraft: updater(draft) });
  },

  saveEdit: () => {
    const { editMode, editDraft, mbti } = get();
    if (editMode === null || editDraft === null) {
      return { ok: false, savedLabel: '主页', personaCount: 0, reason: 'storage' };
    }
    let next = editDraft;
    if (editMode === 'basic') {
      const finalized = finalizeBasic(editDraft);
      if (finalized === null) return { ok: false, savedLabel: SAVE_LABELS.basic, personaCount: 0, reason: 'empty-name' };
      next = finalized;
    } else if (editMode === 'story') {
      next = finalizeStory(editDraft);
    }
    if (!safeStoreSet(MY_PROFILE_KEY, next)) {
      return { ok: false, savedLabel: SAVE_LABELS[editMode], personaCount: 0, reason: 'storage' };
    }
    const committed = clone(next);
    set({
      myProfile: committed,
      editMode: null,
      editDraft: null,
      ...(editMode === 'persona' ? { meTab: 'persona' as const } : {}),
    });
    const personaCount = profilePersonaItems(committed.visibility, personaSource(mbti)).length;
    return { ok: true, savedLabel: SAVE_LABELS[editMode], personaCount };
  },

  setMbti: (type) => {
    safeStoreSet(MBTI_STORE_KEY, type);
    set({ mbti: type });
  },
}));
