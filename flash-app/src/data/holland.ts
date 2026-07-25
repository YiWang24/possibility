// Holland (RIASEC) interest inventory items + type meta
// (source: prototype lines ~6110-6123: `HOLLAND_ITEMS`, `HOLLAND_META`).

export type HollandCode = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';

/** One assessment item: `[code, activity]`. */
export type HollandItem = [code: HollandCode, activity: string];

export const HOLLAND_ITEMS: HollandItem[] = [
  ['R', '制作厨房橱柜'],
  ['I', '研发一种新药'],
  ['A', '创作一本书或一部戏剧'],
  ['S', '帮助他人处理个人或情绪问题'],
  ['E', '管理大型公司中的一个部门'],
  ['C', '为大型计算机网络安装软件'],
  ['R', '修理家用电器'],
  ['I', '研究减少水污染的方法'],
  ['A', '作曲或编曲'],
  ['S', '为他人提供职业发展指导'],
  ['E', '创办自己的企业'],
  ['C', '使用计算器进行计算'],
  ['R', '组装电子零件'],
  ['I', '进行化学实验'],
  ['A', '为电影制作特效'],
  ['S', '提供康复治疗'],
  ['E', '谈判商业合同'],
  ['C', '整理货物收发记录'],
  ['R', '驾驶车辆向办公室和住户配送包裹'],
  ['I', '使用显微镜检查血液样本'],
  ['A', '绘制舞台布景'],
  ['S', '在非营利组织从事志愿工作'],
  ['E', '推广一个新的服装系列'],
  ['C', '使用手持设备盘点物资'],
  ['R', '在零件发货前检查其质量'],
  ['I', '研发更准确预测天气的方法'],
  ['A', '为电影或电视节目编写剧本'],
  ['S', '教授高中课程'],
  ['E', '在百货商店销售商品'],
  ['C', '为一个组织分拣和分发邮件'],
];

export interface HollandTypeMeta {
  name: string;
  color: string;
  label: string;
  desc: string;
}

export const HOLLAND_META: Record<HollandCode, HollandTypeMeta> = {
  R: { name: '实际型', color: '#7DB5A0', label: '动手实践', desc: '你容易被可以操作、制作和解决现场问题的活动吸引。' },
  I: { name: '研究型', color: '#789EFF', label: '深度探索', desc: '你容易投入分析证据、追根究底和理解复杂问题的活动。' },
  A: { name: '艺术型', color: '#D785C8', label: '创意表达', desc: '你更愿意在审美、想象和开放表达中形成自己的作品。' },
  S: { name: '社会型', color: '#E99B78', label: '理解与帮助', desc: '你容易从支持、教学、沟通和帮助他人成长中获得意义。' },
  E: { name: '企业型', color: '#D9B563', label: '影响推动', desc: '你对发起、谈判、组织资源和推动目标更容易产生兴趣。' },
  C: { name: '常规型', color: '#8F91B8', label: '秩序组织', desc: '你更喜欢规则清楚、细节可靠和可以持续优化的工作方式。' },
};
