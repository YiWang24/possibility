// Detailed profile meta for users 1-5 + the derivation helper
// (source: prototype lines ~2828-2898: `PROFILE_META`, `profileMetaFor`).

import type { User } from './users';

/** Detailed advice grouped by decision / ability / interview. */
export interface ProfileAdvice {
  decision: string[];
  ability: string[];
  interview: string[];
}

/** Full profile meta shown on a user's detail page. */
export interface ProfileMeta {
  age: number;
  city: string;
  from: string;
  to: string;
  years: string;
  intro: string;
  full: string;
  advice: ProfileAdvice;
  result: string;
  consulted: number;
  response: string;
}

/** Hand-written meta for users 1-5, keyed by user id. */
export const PROFILE_META: Record<number, ProfileMeta> = {
  1: {
    age: 33,
    city: '杭州',
    from: '交互设计',
    to: 'AI 产品经理',
    years: '转型 5 年',
    intro:
      '我在 28 岁时开始尝试转型 AI 产品。没有裸辞，也没有把过去全部推倒重来，而是利用下班时间学习和实践，在公司申请小型 AI 项目，逐步承担更多产品职责。30 岁完成内部转岗，后来跳到互联网公司，现在负责 AI 产品方向。',
    full: '真正的转折不是拿到产品经理的 title，而是第一次独立为结果负责。设计经验让我更懂用户，但商业判断、数据意识和跨团队推进都需要从零补课。前一年我做了 47 次用户访谈，把每次失败都整理成可复用的判断框架。回头看，最有效的路径不是囤课，而是尽早进入一个真实项目。',
    advice: {
      decision: [
        '先用一个 6 周的小项目验证兴趣，不急着辞职。',
        '把“想转型”改成一个可验证的问题：我愿不愿意持续为结果负责？',
        '至少找 3 位真实从业者，问清工作中最消耗人的部分。',
      ],
      ability: [
        '把用户研究、信息架构和原型能力翻译成产品语言。',
        '刻意补齐数据分析、商业判断和项目推进三项短板。',
        '作品集不要只放界面，要讲清目标、取舍和结果。',
      ],
      interview: ['准备一个你真正推动过的项目，而不是包装出的完整案例。', '回答冲突题时说明你如何建立共同目标。', '主动展示对 AI 能力边界与失败场景的理解。'],
    },
    result: '5 年完成转型，未出现明显降薪',
    consulted: 42,
    response: '通常 4 小时内回复',
  },
  2: {
    age: 32,
    city: '南京',
    from: '互联网运营',
    to: '心理学在读',
    years: '重启 2 年',
    intro: '30 岁重新走进本科课堂，我并不比别人更勇敢，只是终于承认继续待在熟悉的工作里会越来越空。决定重读本科之前，我用半年做财务准备，也和家人反复沟通。',
    full: '最难的是接受自己重新成为新手。课程、实习和经济压力同时出现时，我把目标缩小到每周能完成的动作，并保留一份远程兼职。稳定感没有消失，只是从职位变成了自己可执行的节奏。',
    advice: {
      decision: ['先计算能支撑多久，而不是只问自己敢不敢。', '试听真实课程，确认喜欢的是学科还是想象。', '提前设计与家人的沟通边界。'],
      ability: ['把运营中的沟通与洞察迁移到访谈训练。', '保持每周复盘，建立长期学习节奏。', '尽早进入真实实习场景。'],
      interview: ['诚实解释重启原因，不必把每一步合理化。', '用行动证据说明你的长期投入。', '准备面对年龄相关问题的稳定表达。'],
    },
    result: '边读书边维持远程收入',
    consulted: 27,
    response: '通常当天回复',
  },
  3: {
    age: 29,
    city: '厦门',
    from: '大厂运营',
    to: '间隔年探索',
    years: 'Gap 第 1 年',
    intro: '裸辞后的前两个月，我仍然每天打开招聘软件。后来开始环岛骑行，才意识到休息不是为了更快回到原轨道，而是重新听见自己的节奏。',
    full: '存款减少会制造真实焦虑，所以我给这段间隔年设置了预算上限、复盘节点和退出条件。第三个月之后，我开始用短项目换住宿，也重新接触写作。没有得到标准答案，但知道下一份工作不能再以透支身体为代价。',
    advice: {
      decision: ['为 Gap 设置预算上限和最晚复盘日。', '区分“逃离现在”和“走向新的方向”。', '在离职前处理保险、现金流和居住问题。'],
      ability: ['用小项目保持工作手感。', '记录精力变化，找到真正恢复你的活动。', '建立低成本生活系统。'],
      interview: ['不回避空窗期，说明你完成了哪些探索。', '把零散经历组织成选择逻辑。', '明确下一份工作的底线。'],
    },
    result: '睡眠恢复，重新建立生活节奏',
    consulted: 18,
    response: '通常 8 小时内回复',
  },
  4: {
    age: 31,
    city: '成都',
    from: '视觉设计',
    to: '独立开发',
    years: '独立第 2 年',
    intro: '我没有等到技术完全准备好才开始。第一款产品用了三周上线，几乎没人付费；第二款也失败了。第三款小工具终于覆盖房租。',
    full: '一个人做产品最重要的不是全栈，而是知道什么暂时不做。设计背景帮我快速做出体验，但真正让产品活下来的是持续访谈、定价实验和克制功能范围。',
    advice: {
      decision: ['先做能在两周内交付的最小版本。', '上线前找到 10 个真实潜在用户。', '给自己设定可承受的试错预算。'],
      ability: ['学会用低代码和 AI 补足开发环节。', '把定价当成产品设计的一部分。', '建立每周固定的用户反馈节奏。'],
      interview: ['独立开发经历要用数据说明。', '解释你主动砍掉了什么。', '展示从失败版本到当前版本的变化。'],
    },
    result: '第三款产品开始覆盖房租',
    consulted: 35,
    response: '通常 6 小时内回复',
  },
  5: {
    age: 37,
    city: '上海',
    from: '产品经理',
    to: '心理咨询师',
    years: '转型 3 年',
    intro: '35 岁开始系统学习心理咨询时，我的时薪从 500 变成 0。那段时间最难的不是收入，而是接受新的职业身份需要慢慢长出来。',
    full: '我保留了一部分产品顾问工作，用三年完成课程、督导和实习。过去的产品经验让我善于结构化问题，但咨询训练要求我放下解决问题的冲动，真正听见对方。',
    advice: {
      decision: ['先体验真实课程和个人咨询。', '预留至少两年的训练时间。', '不要低估督导与个人成长成本。'],
      ability: ['练习倾听，不急着给建议。', '建立稳定的案例记录与督导机制。', '把结构化能力用于整理，而不是控制对话。'],
      interview: ['说明转型中的持续训练证据。', '坦诚面对经验时数。', '把过去职业经验转化成理解人的能力。'],
    },
    result: '完成实习，开始稳定接案',
    consulted: 31,
    response: '通常当天回复',
  },
};

/**
 * Resolve a user's profile meta: preset meta for users 1-5, otherwise derived
 * from the user's `meta` and trajectory. Pure data-derivation (source: `profileMetaFor`).
 */
export function profileMetaFor(user: User): ProfileMeta {
  const preset = PROFILE_META[user.id];
  if (preset) return preset;
  const m = user.meta;
  if (!m) {
    throw new Error(`Missing profile meta for user ${String(user.id)}`);
  }
  return {
    ...m,
    intro: `${user.quote} ${user.traj[0]?.d ?? ''}`,
    full: user.traj.map((t) => `${t.age}，${t.t}：${t.d}`).join(' '),
    advice: {
      decision: [
        `先用真实的小项目验证自己是否适合「${m.to}」。`,
        '算清时间、现金流与最坏结果，再决定是否离开当前岗位。',
        '找到至少三位已经走过相似路径的人交叉验证。',
      ],
      ability: [
        `把「${m.from}」积累的通用能力翻译成新岗位能理解的证据。`,
        '优先补齐一个最影响入场的短板，不追求一次学完。',
        '用真实交付建立作品，而不是只展示课程练习。',
      ],
      interview: ['用具体行动解释转型，不把故事包装成一条直线。', '讲清旧经历如何帮助你解决新岗位的问题。', '主动说明仍在补齐的短板和下一步计划。'],
    },
  };
}
