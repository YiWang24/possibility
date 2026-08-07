// 六维动态画像的共享状态（对齐 iOS HomeModel.filledDims）。首页 PersonaPortrait、
// 画像工作室卡片与维度浮层都从这里读写，保存后三处同步刷新。

import { create } from 'zustand';
import type { DimensionKey } from '@/data/dimensions';
import { safeStoreGet, safeStoreSet } from '@/screens/me/myProfileStorage';

/** 首页「我的动态画像」的六个维度，人格底色排在最前。 */
export type PortraitDimKey = 'personality' | DimensionKey;

export const PORTRAIT_DIM_KEYS: readonly PortraitDimKey[] = ['personality', 'skill', 'like', 'love', 'family', 'social'];

export const PORTRAIT_STORE_KEY = 'kaleido_portrait_dims_v1';

export type PortraitDims = Partial<Record<PortraitDimKey, string>>;

/** 旧版本写入的数据可能缺字段或类型不符，逐键校验后才采用。 */
function normalizeDims(raw: unknown): PortraitDims {
  if (typeof raw !== 'object' || raw === null) return {};
  const source = raw as Record<string, unknown>;
  const out: PortraitDims = {};
  for (const key of PORTRAIT_DIM_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && value.trim() !== '') out[key] = value;
  }
  return out;
}

interface PortraitState {
  dims: PortraitDims;
  /** 写入一个维度的画像文本并持久化。空字符串视为清空。 */
  setDim: (key: PortraitDimKey, value: string) => void;
}

export const usePortraitStore = create<PortraitState>((set) => ({
  dims: normalizeDims(safeStoreGet(PORTRAIT_STORE_KEY)),

  setDim: (key, value) => {
    set((state) => {
      const trimmed = value.trim();
      // 逐键重建而不是改一份拷贝：空值直接不落键，顺带把历史脏键筛掉。
      const next: PortraitDims = {};
      for (const dimKey of PORTRAIT_DIM_KEYS) {
        const text = dimKey === key ? trimmed : (state.dims[dimKey] ?? '');
        if (text !== '') next[dimKey] = text;
      }
      safeStoreSet(PORTRAIT_STORE_KEY, next);
      return { dims: next };
    });
  },
}));

export interface PortraitCompletion {
  completed: number;
  total: number;
  percent: number;
}

/** 已填维度数与完成度百分比（对齐 iOS portraitCompletion）。 */
export function portraitCompletion(dims: PortraitDims): PortraitCompletion {
  const total = PORTRAIT_DIM_KEYS.length;
  const completed = PORTRAIT_DIM_KEYS.filter((key) => {
    const value = dims[key];
    return value !== undefined && value !== '';
  }).length;
  return { completed, total, percent: Math.round((completed / total) * 100) };
}

/**
 * 维度里已保存的关键词列表。保存时用 ` · ` 连接，这里按同一分隔符还原，
 * 供维度浮层回填已选状态。
 */
export function dimensionKeywords(value: string | undefined): string[] {
  if (value === undefined || value === '') return [];
  return value
    .split('·')
    .map((word) => word.trim())
    .filter((word) => word !== '');
}
