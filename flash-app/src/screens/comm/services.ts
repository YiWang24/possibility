// Per-user service cards, derived from the user's transition context.
// Faithful port of the prototype's profileServiceTheme (原型 ~5418-5429) and
// profileServicesFor (~5430-5451).

import type { User } from '@/data/users';
import { profileMetaFor } from '@/data/profileMeta';
import { PROFILE_SERVICE_THEMES } from '@/data/profile';

interface ServiceTheme {
  focus: string;
  pack: string;
  packDesc: string;
  items: string[];
  topics: string[];
  stages: string[];
}

export type ServiceId = 'consult' | 'materials' | 'companion';

export interface ProfileServiceCard {
  id: ServiceId;
  type: string;
  title: string;
  price: string;
  unit: string;
  style: '' | 'materials' | 'companion';
  desc: string;
  tags: string[];
  topics: string[];
  items: string[];
  stages: string[];
}

function profileServiceTheme(u: User): ServiceTheme {
  const m = profileMetaFor(u);
  const context = [m.from, m.to, u.bio, ...u.tags].join(' ');
  const found = PROFILE_SERVICE_THEMES.find((theme) => theme.test.test(context));
  if (found) {
    return { focus: found.focus, pack: found.pack, packDesc: found.packDesc, items: found.items, topics: found.topics, stages: found.stages };
  }
  return {
    focus: `${m.to}转型`,
    pack: `${m.to}行动模板包`,
    packDesc: `围绕从${m.from}到${m.to}的真实路径，整理决策、能力准备和求职行动模板。`,
    items: ['转型决策表', '能力差距清单', '行动周计划', '面试准备清单'],
    topics: ['转型时机', '能力迁移', '行动计划', '求职准备', '风险判断'],
    stages: ['正在了解', '开始准备', '积累项目', '正在求职'],
  };
}

/** The three service offers shown on a user's profile (原型 profileServicesFor). */
export function profileServicesFor(u: User): ProfileServiceCard[] {
  const m = profileMetaFor(u);
  const theme = profileServiceTheme(u);
  return [
    {
      id: 'consult',
      type: '1 对 1 咨询',
      title: `${theme.focus}路径咨询`,
      price: '29',
      unit: '/ 小时',
      style: '',
      desc: `结合她从${m.from}到${m.to}并实现「${m.result}」的亲历，针对你的具体处境给出建议。`,
      tags: ['实时文字沟通', '1 小时', '24 小时内可追问'],
      topics: theme.topics,
      items: [],
      stages: [],
    },
    {
      id: 'materials',
      type: '资料工具包',
      title: theme.pack,
      price: '9.9',
      unit: '',
      style: 'materials',
      desc: theme.packDesc,
      tags: ['4 份模板', '亲历整理', '永久查看'],
      topics: [],
      items: theme.items,
      stages: [],
    },
    {
      id: 'companion',
      type: '阶段陪跑',
      title: `${theme.focus}行动陪跑`,
      price: '599',
      unit: '/ 期',
      style: 'companion',
      desc: `围绕${theme.focus}的关键阶段进行 4 周陪跑，每周复盘进度，并在重要选择点提供反馈。`,
      tags: ['4 周', '每周复盘', '关键反馈'],
      topics: [],
      items: [],
      stages: theme.stages,
    },
  ];
}
