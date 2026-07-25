// "我的" (self) profile defaults, advice labels/titles, and service themes
// (source: prototype lines ~5083-5417: `MY_AVATARS`, `MY_ADVICE_LABELS`,
// `DEFAULT_MY_PROFILE`, `ADVICE_TITLES`, `PROFILE_SERVICE_THEMES`).

import type { ProfileMeta } from './profileMeta';
import type { UserDim, UserTrajectory } from './users';

/**
 * 6 avatar asset paths for the self profile.
 * Prototype source: `Array.from({length:6},(_,i)=>`assets/community-avatars/avatar-${String(i+1).padStart(2,'0')}.png`)`
 */
export const MY_AVATARS: string[] = [
  'assets/community-avatars/avatar-01.png',
  'assets/community-avatars/avatar-02.png',
  'assets/community-avatars/avatar-03.png',
  'assets/community-avatars/avatar-04.png',
  'assets/community-avatars/avatar-05.png',
  'assets/community-avatars/avatar-06.png',
];

export interface AdviceLabels {
  decision: string;
  ability: string;
  interview: string;
}

/** Default title for a legacy advice module of each kind. */
export const MY_ADVICE_LABELS: AdviceLabels = {
  decision: '转型前，先做一次低成本验证',
  ability: '把旧能力翻译成新岗位的优势',
  interview: '让面试官看见真实的行动证据',
};

export interface AdviceModuleImage {
  id: string;
  src: string;
  name: string;
}

export interface AdviceModuleLink {
  id: string;
  label: string;
  url: string;
}

export interface AdviceModule {
  id: string;
  title: string;
  content: string;
  images: AdviceModuleImage[];
  links: AdviceModuleLink[];
}

export interface ProfileService {
  id: string;
  enabled: boolean;
  type: string;
  title: string;
  price: string;
  desc: string;
}

export interface ProfileVisibility {
  personality: boolean;
  skill: boolean;
  like: boolean;
  love: boolean;
  family: boolean;
  social: boolean;
  life: boolean;
}

export interface MyProfile {
  id: string;
  name: string;
  ini: string;
  hue: number;
  avatar: string;
  quote: string;
  tags: string[];
  bio: string;
  traj: UserTrajectory[];
  dims: UserDim[];
  visibility: ProfileVisibility;
  adviceModules: AdviceModule[];
  services: ProfileService[];
  meta: ProfileMeta;
}

export const DEFAULT_MY_PROFILE: MyProfile = {
  id: 'me',
  name: '屿岸',
  ini: '屿',
  hue: 4,
  avatar: MY_AVATARS[0] ?? '',
  quote: '我还没有抵达答案，但已经开始认真记录自己如何选择。',
  tags: ['交互设计', 'AI 产品探索', '上海'],
  bio: '交互设计师 → AI 产品探索者',
  traj: [
    { age: '22 岁', t: '进入交互设计行业', d: '从界面和体验开始，逐渐对产品为什么成立产生兴趣。' },
    { age: '27 岁', t: '开始探索 AI 产品', d: '用小项目验证转型意愿，也记录每次选择背后的现实约束。' },
  ],
  dims: [],
  visibility: { personality: true, skill: true, like: true, love: false, family: false, social: false, life: false },
  adviceModules: [
    {
      id: 'default-decision',
      title: '转型前，先做一次低成本验证',
      content: '先做一个可以撤回的小实验，再决定是否改变。\n把真实意愿和现实承受力分开记录。\n重要决定前，至少听三种不同经历。',
      images: [],
      links: [],
    },
    {
      id: 'default-ability',
      title: '把旧能力翻译成新岗位的优势',
      content: '把设计经验转译成产品判断证据。\n优先补真实项目，而不是继续囤课。\n记录每次取舍背后的依据。',
      images: [],
      links: [],
    },
    {
      id: 'default-interview',
      title: '让面试官看见真实的行动证据',
      content: '不把转型故事讲成一条完美直线。\n用真实行动解释为什么改变。\n坦白仍在补齐的能力。',
      images: [],
      links: [],
    },
  ],
  services: [
    { id: 'consult', enabled: true, type: '1 对 1 交流', title: '转型路径交流', price: '29', desc: '围绕当前选择、能力迁移与行动计划进行一次真实经验交流。' },
    {
      id: 'materials',
      enabled: false,
      type: '资料工具包',
      title: '探索复盘模板',
      price: '9.9',
      desc: '整理我在探索过程中使用的问题清单、复盘表和小实验模板。',
    },
    { id: 'companion', enabled: false, type: '阶段陪跑', title: '四周行动陪跑', price: '599', desc: '每周复盘一次进展，在关键选择点提供经验反馈。' },
  ],
  meta: {
    age: 28,
    city: '上海',
    from: '交互设计师',
    to: 'AI 产品探索者',
    years: '探索第 1 年',
    result: '持续用真实项目验证方向',
    consulted: 0,
    response: '暂未开放咨询',
    intro: '我正在从熟悉的交互设计向 AI 产品方向探索。比起把转型包装成一条直线，我更想诚实记录犹豫、试错和逐渐清楚的过程。',
    full: '最难的不是学会一个新工具，而是接受自己暂时没有确定答案。我开始用小项目、访谈和每周复盘代替空想，让每一步都留下可以判断的证据。',
    advice: {
      decision: ['先做一个可以撤回的小实验，再决定是否改变。', '把真实意愿和现实承受力分开记录。', '重要决定前，至少听三种不同经历。'],
      ability: ['把设计经验转译成产品判断证据。', '优先补真实项目，而不是继续囤课。', '记录每次取舍背后的依据。'],
      interview: ['不把转型故事讲成一条完美直线。', '用真实行动解释为什么改变。', '坦白仍在补齐的能力。'],
    },
  },
};

export interface AdviceTitleSet {
  decision: string[];
  ability: string[];
  interview: string[];
}

/** Suggested titles offered when editing an advice module. */
export const ADVICE_TITLES: AdviceTitleSet = {
  decision: ['转型前，先做一次低成本验证', '先判断这条路是否真的适合你'],
  ability: ['把旧能力翻译成新岗位的优势', '迁移能力比从零开始更重要'],
  interview: ['让面试官看见真实的行动证据', '少讲决心，多讲你已经做过什么'],
};

/** A service theme matched against a user's transition context via `test`. */
export interface ProfileServiceTheme {
  test: RegExp;
  focus: string;
  pack: string;
  packDesc: string;
  items: string[];
  topics: string[];
  stages: string[];
}

export const PROFILE_SERVICE_THEMES: ProfileServiceTheme[] = [
  {
    test: /AI 产品|产品经理/,
    focus: 'AI 产品转型',
    pack: 'AI 产品案例与作品集模板包',
    packDesc: '把设计经验转成产品证据，包含案例拆解、PRD、AI 功能评估和作品集自查模板。',
    items: ['AI 案例拆解框架', '轻量 PRD 模板', 'AI 功能评估表', '产品作品集自查清单'],
    topics: ['转型时机', '产品能力', 'AI 项目', '作品集', '求职面试'],
    stages: ['刚开始了解', '正在补产品能力', '准备作品集', '正在求职'],
  },
  {
    test: /心理学在读|重读本科|升学/,
    focus: '跨专业升学与重启',
    pack: '跨专业升学决策与预算工具包',
    packDesc: '用亲历过的重启路径，帮你整理课程试听、现金流、时间线和家庭沟通。',
    items: ['专业验证清单', '重读预算表', '两年时间线', '家庭沟通提纲'],
    topics: ['专业选择', '辞职时机', '现金流', '家庭沟通', '学习节奏'],
    stages: ['正在了解专业', '准备入学考试', '等待录取', '刚开始新学期'],
  },
  {
    test: /心理咨询师|生涯咨询师/,
    focus: '咨询职业转型',
    pack: '咨询训练路径与实践清单',
    packDesc: '梳理课程、实习、督导、案例积累与收入过渡，减少转型初期的信息差。',
    items: ['训练路径地图', '督导与实习清单', '案例记录模板', '收入过渡预算表'],
    topics: ['训练选择', '职业边界', '实习督导', '案例积累', '收入过渡'],
    stages: ['正在了解训练', '开始系统学习', '寻找实习', '准备独立接案'],
  },
  {
    test: /间隔年|Gap|gap/,
    focus: '间隔年规划',
    pack: 'Gap 预算与行动模板包',
    packDesc: '把间隔年从模糊愿望拆成预算、复盘节点、低成本生活和退出条件。',
    items: ['现金流预算表', '90 天探索计划', '精力复盘日志', '退出条件清单'],
    topics: ['离职准备', 'Gap 预算', '探索方向', '生活节奏', '重返职场'],
    stages: ['正在考虑离职', '准备开始 Gap', 'Gap 进行中', '准备重返职场'],
  },
  {
    test: /独立开发/,
    focus: '独立产品与开发',
    pack: '独立产品验证工具包',
    packDesc: '从用户访谈到最小版本、定价实验和上线复盘，复用真实失败后留下的方法。',
    items: ['需求访谈提纲', 'MVP 范围表', '定价实验模板', '上线复盘清单'],
    topics: ['方向验证', '开发取舍', '用户访谈', '产品定价', '独立收入'],
    stages: ['只有一个想法', '正在做 MVP', '已经上线', '寻找稳定收入'],
  },
  {
    test: /用户研究/,
    focus: '用户研究转型',
    pack: '用户研究访谈与作品集模板包',
    packDesc: '将咨询和行业研究能力转译成用户研究流程、洞察报告与作品集证据。',
    items: ['研究计划模板', '深访提纲', '洞察归纳画布', '研究作品集结构'],
    topics: ['能力迁移', '研究方法', '访谈实战', '作品集', '求职面试'],
    stages: ['正在了解岗位', '补研究方法', '准备作品集', '正在面试'],
  },
  {
    test: /民宿/,
    focus: '小城生活与民宿经营',
    pack: '民宿现金流与运营模板包',
    packDesc: '覆盖搬迁预算、选址判断、淡旺季现金流、获客和日常运营的真实准备项。',
    items: ['搬迁决策表', '选址评估清单', '淡旺季现金流表', '民宿运营周历'],
    topics: ['城市迁移', '开店预算', '民宿选址', '淡旺季运营', '生活边界'],
    stages: ['正在考虑搬迁', '实地考察中', '筹备开店', '已经开始经营'],
  },
  {
    test: /书店|实体创业/,
    focus: '社区书店与实体创业',
    pack: '社区书店经营测算工具包',
    packDesc: '把租金、库存、活动和会员制放进一张可执行的实体空间经营模型。',
    items: ['开店成本测算', '库存周转表', '活动策划模板', '会员模型画布'],
    topics: ['开店决策', '现金流', '选址', '内容活动', '会员经营'],
    stages: ['正在构思', '调研选址', '筹备开店', '优化经营模型'],
  },
  {
    test: /数据分析/,
    focus: '数据分析转型',
    pack: '数据项目与作品集模板包',
    packDesc: '从真实业务问题出发，整理项目选题、指标框架、分析过程与作品集表达。',
    items: ['业务问题拆解表', '指标体系模板', '数据项目周计划', '作品集叙事框架'],
    topics: ['内部转岗', '技能路线', '项目选题', '作品集', '面试准备'],
    stages: ['正在学工具', '寻找项目', '准备作品集', '申请内部转岗'],
  },
  {
    test: /UX 设计|UX/,
    focus: 'UX 设计转型',
    pack: 'UX 作品集结构模板包',
    packDesc: '把建筑等旧经历中的复杂约束能力，转译成用户问题、设计过程和结果证据。',
    items: ['项目选题清单', 'UX 案例结构', '研究与验证模板', '作品集自查表'],
    topics: ['能力迁移', '项目选择', 'UX 方法', '作品集', '求职面试'],
    stages: ['正在了解 UX', '补方法基础', '准备作品集', '正在求职'],
  },
  {
    test: /产品营销/,
    focus: '产品营销转型',
    pack: '产品定位与上市模板包',
    packDesc: '将技术理解转成市场价值，覆盖定位、受众、内容与产品上市协同。',
    items: ['定位画布', '受众画像表', '上市计划模板', '技术内容选题库'],
    topics: ['技术转业务', '岗位判断', '产品定位', '上市策略', '求职面试'],
    stages: ['正在了解岗位', '尝试技术内容', '准备转岗', '负责首次上市'],
  },
];
