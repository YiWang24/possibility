// Community "悬赏" questions + topic sample prompts
// (source: prototype lines ~2899-2936: `BOUNTIES`, `TOPIC_SAMPLES`).

export interface BountyReply {
  name: string;
  role: string;
  text: string;
  /** Index into the community avatar set. */
  avatar: number;
}

export interface Bounty {
  id: number;
  q: string;
  tags: string[];
  amount: string;
  goal: string;
  n: string;
  asker: string;
  time: string;
  city: string;
  detail: string;
  replies: BountyReply[];
}

export const BOUNTIES: Bounty[] = [
  {
    id: 1,
    q: '有没有人从设计转数据分析？想听第一年最难的是什么',
    tags: ['职业转型', '数据分析', '设计背景'],
    amount: '29',
    goal: '征集 3 个真实故事',
    n: '12 人回应',
    asker: '雾岛来信',
    time: '2 小时前',
    city: '杭州',
    detail:
      '我做了 4 年视觉设计，最近在自学 SQL 和 Python。真正担心的不是课程学不会，而是没有数据项目经验，也不知道第一份工作是否一定会降薪。希望听到设计背景转数据分析的真实经历，尤其是入行第一年的困难和准备方式。',
    replies: [
      { name: '纸飞机', role: '财务分析 → 数据分析师', text: '第一年最难的是把“会工具”变成“能回答业务问题”，我用公司内部数据做了三个小项目。', avatar: 8 },
      { name: '十点半', role: '建筑设计 → UX 设计师', text: '虽然方向不同，但作品集转译旧能力这件事很相似，可以分享我的踩坑清单。', avatar: 10 },
    ],
  },
  {
    id: 2,
    q: '26 岁要不要辞职考研？家里催我先稳定下来',
    tags: ['升学选择', '辞职考研', '家庭沟通'],
    amount: '19.9',
    goal: '征集 5 位亲历者',
    n: '31 人回应',
    asker: '青柠汽水',
    time: '5 小时前',
    city: '南京',
    detail:
      '目前工作两年，收入稳定但看不到想要的发展。想跨专业读心理学研究生，家里认为先工作、结婚更现实。我希望了解辞职备考的现金流压力、失败后的退路，以及怎样和家人沟通。',
    replies: [
      { name: '重启按钮', role: '30 岁重读心理学本科', text: '先别急着用辞职证明决心。我用了半年试听课程、准备预算，再决定重新回到校园。', avatar: 5 },
      { name: '木棉', role: '全职妈妈 → 生涯咨询师', text: '和家人沟通时，具体的预算与时间节点比“这是我的梦想”更容易建立信任。', avatar: 9 },
    ],
  },
  {
    id: 3,
    q: '想去小城市生活，又怕后悔，有回不来的人吗？',
    tags: ['城市迁移', '生活方式', '小城创业'],
    amount: '39',
    goal: '征集 3 个真实故事',
    n: '8 人回应',
    asker: '在逃星期一',
    time: '昨天',
    city: '上海',
    detail:
      '在上海做运营第 6 年，越来越想搬去生活成本低、节奏慢一点的城市。但担心收入、社交圈和以后回大城市的难度。想听已经搬走两年以上的人讲讲真实得失，而不只是旅行滤镜。',
    replies: [
      { name: '北纬三十度', role: '互联网运营 → 民宿主理人', text: '去大理不是躺平，我提前算了十二个月现金流，也保留了远程项目作为缓冲。', avatar: 7 },
      { name: '潮汐之外', role: '大厂运营 → 间隔年探索', text: '真正变化最大的是消费结构和关系密度，不是每天都像度假。', avatar: 3 },
    ],
  },
];

export type TopicKey = '职业' | '家庭' | '升学' | '情感';

/** Sample question pre-filled when a topic chip is selected. */
export const TOPIC_SAMPLES: Record<TopicKey, string> = {
  职业: '我是否要从交互设计师转为产品经理？',
  家庭: '要不要搬回父母所在的城市生活？',
  升学: '26 岁了，还要不要辞职去读研？',
  情感: '异地三年，要不要为 TA 换一座城市？',
};
