// 画像工作室卡片的状态文案（对齐 iOS ProfileStudioView.gridState / bigFiveState）。
// 纯函数：进来的是画像值与测评快照，出去的是一行 meta + 一个按钮名。

import type { AssessmentKind } from './assessmentConfig';
import type { AssessmentSnapshot } from './assessmentStore';

export interface CardState {
  meta: string;
  action: string;
  /** 0–1 的续答进度；只有「继续」态才有值。 */
  progress: number | null;
}

export interface DimCardInput {
  /** 画像里已保存的文本。 */
  filled: string | undefined;
  /** 该维度关联的测评快照；人际维度没有测评，传 null。 */
  snapshot: AssessmentSnapshot | null;
  /** 未开始时的原始文案。 */
  fallback: string;
  isHolland: boolean;
}

export function dimCardState({ filled, snapshot, fallback, isHolland }: DimCardInput): CardState {
  if (filled !== undefined && filled !== '') {
    return { meta: `已形成画像 · ${filled}`, action: '编辑', progress: null };
  }
  if (snapshot !== null) {
    const { result, answered, total } = snapshot;
    if (result !== null) {
      if (isHolland) {
        const code = result.displayCode ?? result.code ?? '';
        return { meta: `已完成 · ${code} 兴趣组合`, action: '查看画像', progress: null };
      }
      return { meta: '测评已完成 · 可写入画像', action: '进入', progress: null };
    }
    if (answered > 0 && total > 0) {
      return {
        meta: `${isHolland ? '霍兰德测评' : '测评'}已完成 ${String(answered)}/${String(total)} · 进度自动保存`,
        action: '继续',
        progress: answered / total,
      };
    }
  }
  return { meta: fallback, action: '进入', progress: null };
}

export interface BigFiveCardInput {
  full: AssessmentSnapshot;
  lite: AssessmentSnapshot;
  /** 完整版结果的前两个标签，无结果时传空数组。 */
  fullTags: readonly string[];
  liteTags: readonly string[];
  fallback: string;
}

export interface BigFiveCardState extends CardState {
  /** 点按钮时打开哪一版。 */
  kind: AssessmentKind;
}

/**
 * 「完整版优先」判定：完整版一旦有进度或结果就只看完整版；完整版还没动过时，
 * 才回落到快速版的状态，并在文案里留出继续完整版的提示。
 */
export function bigFiveCardState({ full, lite, fullTags, liteTags, fallback }: BigFiveCardInput): BigFiveCardState {
  if (full.result !== null) {
    return { meta: `已完成 · ${fullTags.slice(0, 2).join(' · ')}`, action: '查看结果', progress: null, kind: 'bigfive' };
  }
  if (full.answered > 0) {
    return {
      meta: `已完成 ${String(full.answered)}/${String(full.total)} · 进度自动保存`,
      action: `继续 ${String(full.answered)}/${String(full.total)}`,
      progress: full.total > 0 ? full.answered / full.total : null,
      kind: 'bigfive',
    };
  }
  if (lite.result !== null) {
    return {
      meta: `快速版已完成 · ${liteTags.slice(0, 2).join(' · ')} · 可继续完整版`,
      action: '查看结果',
      progress: null,
      kind: 'bigfiveLite',
    };
  }
  if (lite.answered > 0) {
    return {
      meta: `快速版已完成 ${String(lite.answered)}/${String(lite.total)} · 进度自动保存`,
      action: `继续 ${String(lite.answered)}/${String(lite.total)}`,
      progress: lite.total > 0 ? lite.answered / lite.total : null,
      kind: 'bigfiveLite',
    };
  }
  return { meta: fallback, action: '进入测试', progress: null, kind: 'bigfive' };
}
