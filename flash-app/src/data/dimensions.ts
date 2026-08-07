// Five dynamic-portrait dimension sheets (擅长 / 喜欢 / 恋爱 / 家庭 / 人际)
// keyword batches + linked tools (source: prototype line ~8274, `DIMENSION_CONFIG`;
// tool routing mirrors iOS DimensionData.Tool).

import type { DeckKind } from './cardgames';

export type DimensionKey = 'skill' | 'like' | 'love' | 'family' | 'social';

/** 点开工具卡后走哪条路：进测评，还是开卡牌。 */
export type DimensionToolAction =
  | { open: 'assessment'; assessment: 'strength' | 'holland' | 'love' | 'family' }
  | { open: 'cardGame'; deck: DeckKind };

export interface DimensionTool {
  name: string;
  desc: string;
  duration: string;
  /** 卡片底色。 */
  color: string;
  action: DimensionToolAction;
}

export interface DimensionConfig {
  title: string;
  question: string;
  /** Three rotating batches of five suggested keywords. */
  batches: [string[], string[], string[]];
  tools: DimensionTool[];
}

export const DIMENSION_CONFIG: Record<DimensionKey, DimensionConfig> = {
  skill: {
    title: '我擅长',
    question: '你是否清楚自己擅长什么？',
    batches: [
      ['结构化表达', '共情别人的想法', '把复杂问题讲清楚', '视觉表达', '快速学习'],
      ['沟通协调', '发现问题', '文字表达', '制定计划', '临场应变'],
      ['倾听', '审美判断', '组织信息', '推动事情落地', '照顾他人感受'],
    ],
    tools: [
      {
        name: '优势证据探索',
        desc: '无需先选关键词，用15个情境反推优势信号',
        duration: '约 3 分钟',
        color: '#273A67',
        action: { open: 'assessment', assessment: 'strength' },
      },
    ],
  },
  like: {
    title: '我喜欢',
    question: '什么事情会让你自然地靠近？',
    batches: [
      ['把混乱变有序', '独处的清晨', '手绘', '探索陌生地方', '深度聊天'],
      ['做有创造感的事', '安静阅读', '和朋友一起吃饭', '自然与户外', '学习新工具'],
      ['照顾小动物', '记录生活', '逛展看电影', '解决一道难题', '慢慢做一顿饭'],
    ],
    tools: [
      {
        name: '霍兰德兴趣测评',
        desc: '完整30题 · 生成RIASEC六维兴趣画像',
        duration: '约 5 分钟',
        color: '#2E3D66',
        action: { open: 'assessment', assessment: 'holland' },
      },
    ],
  },
  love: {
    title: '我在恋爱关系中在意',
    question: '一段恋爱关系里，什么让你感觉被爱？',
    batches: [
      ['坦诚沟通', '稳定陪伴', '彼此信任', '尊重边界', '共同成长'],
      ['情绪被理解', '说到做到', '保留个人空间', '遇事站在一起', '有回应'],
      ['忠诚', '分享日常', '身体亲密', '价值观接近', '愿意解决冲突'],
    ],
    tools: [
      {
        name: '关系安全感与靠近方式',
        desc: '18题 Demo 构念版 · 理解安全感与边界需要',
        duration: '约 4 分钟',
        color: '#552A3D',
        action: { open: 'assessment', assessment: 'love' },
      },
      {
        name: '婚姻卡牌：最后会留下什么？',
        desc: '从9张婚姻底牌出发，在多轮取舍中留下最关心的3点',
        duration: '约 3 分钟',
        color: '#6A294D',
        action: { open: 'cardGame', deck: 'marriage' },
      },
    ],
  },
  family: {
    title: '我在家庭关系中在意',
    question: '在家人之间，你最希望守住什么？',
    batches: [
      ['互相尊重', '健康平安', '有事一起承担', '不控制彼此', '经常联系'],
      ['被理解', '说话算数', '经济上有安全感', '允许不同选择', '照顾长辈'],
      ['家庭和睦', '清晰边界', '公平对待', '能够表达脆弱', '重要时刻在场'],
    ],
    tools: [
      {
        name: '家庭关系与期待',
        desc: '20题 Demo 构念版 · 看见你想守住的家庭价值',
        duration: '约 5 分钟',
        color: '#28443F',
        action: { open: 'assessment', assessment: 'family' },
      },
      {
        name: '家庭卡牌：最后会守住什么？',
        desc: '从9张家庭底牌出发，在多轮取舍中留下最关心的3点',
        duration: '约 3 分钟',
        color: '#235A4B',
        action: { open: 'cardGame', deck: 'family' },
      },
    ],
  },
  social: {
    title: '我在人际交往中在意',
    question: '和朋友、同事或熟人相处时，你最希望守住什么？',
    batches: [
      ['真诚', '互相尊重', '有来有往', '清晰边界', '轻松自在'],
      ['深度交流', '稳定联系', '保守秘密', '允许拒绝', '彼此支持'],
      ['价值观相近', '不被比较', '冲突后愿意修复', '共同兴趣', '保留独处空间'],
    ],
    tools: [
      {
        name: '人际卡牌：最后会守住什么？',
        desc: '从9张人际底牌出发，在多轮取舍中留下最关心的3点',
        duration: '约 3 分钟',
        color: '#29466A',
        action: { open: 'cardGame', deck: 'social' },
      },
    ],
  },
};
