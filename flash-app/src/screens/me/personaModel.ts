// Persona-dimension model for "我的公开主页"
// (source: prototype ~5179 `myPersonaSource`, ~5194 `hasPersonaResult`,
// ~5197 `personaPresentation`, ~5206 `profilePersonaItems`).
//
// The prototype reads dimension values out of the live "认识自己" DOM. Here we
// model the same seven dimensions as data: unset dimensions read "尚未填写"
// (faithful fresh state), personality reflects a saved MBTI badge, and the
// life-signature trio mirrors the home page (亲情 / 才华 / 健康).

import { LIFE_BASE_CARDS } from '@/data/life';
import type { ProfileVisibility } from '@/data/profile';

export type PersonaKey = keyof ProfileVisibility;

export interface PersonaCard {
  glyph: string;
  name: string;
}

export interface PersonaItem {
  key: PersonaKey;
  label: string;
  value: string;
  glyph: string;
  color: string;
  cards?: PersonaCard[];
}

const EMPTY = '尚未填写';

/** Signature trio kept consistent with the home PersonaPortrait. */
const SIGNATURE_INDEXES: readonly number[] = [0, 5, 16];

function signatureCards(): PersonaCard[] {
  return SIGNATURE_INDEXES.map((i) => LIFE_BASE_CARDS[i])
    .filter((card): card is (typeof LIFE_BASE_CARDS)[number] => card !== undefined)
    .map((card) => ({ glyph: card.glyph, name: card.name }));
}

/** The seven public-profile dimensions in prototype order. */
export function personaSource(mbti: string | null): PersonaItem[] {
  const cards = signatureCards();
  const signatureValue = cards.map((card) => card.name).join(' · ');
  return [
    {
      key: 'personality',
      label: '人格底色',
      value: mbti !== null && mbti !== '' ? `MBTI：${mbti}` : EMPTY,
      glyph: '◎',
      color: 'rgba(89,104,217,.16)',
    },
    { key: 'skill', label: '我擅长', value: EMPTY, glyph: '✦', color: 'rgba(94,150,255,.15)' },
    { key: 'like', label: '我喜欢', value: EMPTY, glyph: '♡', color: 'rgba(227,92,193,.15)' },
    { key: 'love', label: '我在恋爱关系中在意', value: EMPTY, glyph: '✿', color: 'rgba(255,122,77,.16)' },
    { key: 'family', label: '我在家庭关系中在意', value: EMPTY, glyph: '⌂', color: 'rgba(62,217,164,.14)' },
    { key: 'social', label: '我在人际交往中在意', value: EMPTY, glyph: '◎', color: 'rgba(94,150,255,.15)' },
    {
      key: 'life',
      label: '我的人生底牌',
      value: signatureValue !== '' ? signatureValue : '尚未生成',
      glyph: '◇',
      color: 'rgba(143,123,255,.16)',
      cards,
    },
  ];
}

/** True when a dimension carries a real result (not an "unset" placeholder). */
export function hasPersonaResult(item: PersonaItem): boolean {
  return item.value !== '' && !/(尚未|待探索|未填写|未生成)/.test(item.value);
}

/** Persona items the profile currently exposes, honouring visibility toggles. */
export function profilePersonaItems(visibility: ProfileVisibility, source: PersonaItem[]): PersonaItem[] {
  return source.filter((item) => visibility[item.key]);
}
