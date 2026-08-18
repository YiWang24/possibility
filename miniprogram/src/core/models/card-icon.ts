/**
 * 卡面图标语义表 —— 对应 iOS `Core/DesignSystem/CardIcon.swift`。
 *
 * 为什么不用 emoji：lab-choices 的选择卡是按问题现生成的，glyph 交给模型自由发挥，
 * 拿回来的是 🧪🎨🪐 这类彩色 emoji —— 字重、光学尺寸、配色全不受控，
 * 和 App 其余部分（底线卡、人生牌局）的单色符号语言互相打架，卡面因此显得
 * 「模型生成感」重。这里把图标收敛成一份有限语义表：服务端只给语义键，
 * 端上统一决定字形、字号、字重、着色。模型给不出合法键时按中文关键词兜底。
 *
 * **这份文件只管语义**（键 + 关键词 + 解析），字形与配色在
 * `core/design/components/card-icon/` 里 —— 和 iOS 一样，语义键是跨端契约，
 * 视觉实现各端自便。
 */

/** 25 个语义键，与 iOS `enum CardIcon` 逐项一致 */
export type CardIconKey =
  // 方向：留下 / 深耕 / 转向 / 退回
  | 'stay'
  | 'deepen'
  | 'pivot'
  | 'retreat'
  // 行动：调研 / 试验 / 学习 / 动手 / 创作 / 全力一搏
  | 'explore'
  | 'experiment'
  | 'learn'
  | 'build'
  | 'create'
  | 'leap'
  // 人与沟通：连接 / 表达
  | 'connect'
  | 'speak'
  // 节奏：迁移 / 休整 / 暂缓 / 观望 / 时机
  | 'relocate'
  | 'rest'
  | 'pause'
  | 'observe'
  | 'timing'
  // 结构：混合 / 平衡 / 保底
  | 'hybrid'
  | 'balance'
  | 'secure'
  // 现实条件：钱 / 家庭 / 身体
  | 'money'
  | 'home'
  | 'health'
  // 用户自己写的卡 / 无法归类
  | 'custom'
  | 'unknown'

/**
 * 中文关键词兜底表 —— 与 iOS `keywords` 逐词一致。
 * 词要够长以避免误伤：用「转岗」而不是「转」。
 */
const KEYWORDS: Record<CardIconKey, string[]> = {
  stay: ['留在', '留下', '维持现状', '保持现状', '按兵不动', '原地', '坚守', '守住', '现有岗位', '不换'],
  deepen: ['深耕', '精进', '打磨', '专精', '钻研', '沉淀', '积累', '做深', '扎根', '内功'],
  pivot: ['转岗', '转型', '转行', '换赛道', '跳槽', '换方向', '调岗', '换岗', '转做', '切换到', '换一条'],
  retreat: ['退回', '止损', '撤回', '退出', '保留退路', '回到原', '回头', '放弃'],
  explore: ['调研', '打听', '摸底', '探索', '考察', '访谈', '搜集', '问清', '了解清楚'],
  experiment: ['试验', '实验', '小步', '试水', '验证', '试点', '跑通', '先试', '试一', '小规模', '原型'],
  learn: ['学习', '进修', '补课', '读书', '考证', '上课', '培训', '自学', '课程', '念书'],
  build: ['搭建', '动手', '开发', '落地', '做出', '从零做', '工程化', '写代码'],
  create: ['创作', '设计', '写作', '作品', '创造', '策展', '表达自己'],
  leap: ['全力', '孤注', '梭哈', '放手一搏', '破釜', '彻底转', '一次性', '重注', '下决心'],
  connect: ['人脉', '内推', '社群', '圈子', '合作', '搭档', '团队', '伙伴', '引荐', '牵线', '认识人'],
  speak: ['沟通', '协商', '争取', '谈一谈', '提出', '对话', '反馈', '摊牌', '说清楚'],
  relocate: ['换城市', '异地', '出国', '远程', '外派', '搬到', '去外地', '迁移'],
  rest: ['休息', '休整', '恢复', '放慢', '慢下来', '调整节奏', '喘口气', '减负', '间隔年'],
  pause: ['暂缓', '暂停', '缓一', '先不', '推迟', '延后', '搁置', '等等再'],
  observe: ['观望', '先看', '再看看', '静观', '观察', '不表态', '等信号'],
  timing: ['时机', '窗口期', '再等', '熬过', '期限', '倒计时', '时间换'],
  hybrid: ['混合', '兼职', '副业', '跨界', '双线', '并行', '两边都', '同时做', '复合'],
  balance: ['平衡', '取舍', '权衡', '折中', '兼顾', '分配精力'],
  secure: ['保底', '稳住', '兜底', '底线', '保障', '稳定', '备份', '抗风险'],
  money: ['收入', '薪资', '涨薪', '降薪', '现金', '储蓄', '财务', '预算', '成本', '养家'],
  home: ['家庭', '家人', '父母', '孩子', '伴侣', '陪伴', '生育', '婚'],
  health: ['健康', '身体', '体力', '睡眠', '精力', '锻炼', '透支'],
  custom: [],
  unknown: [],
}

const ALL_KEYS = Object.keys(KEYWORDS) as CardIconKey[]

/** 合法语义键判定 —— 模型可能回 emoji 或自造词，一律不认 */
export function isCardIconKey(value: string): value is CardIconKey {
  return (ALL_KEYS as string[]).includes(value)
}

/**
 * 关键词命中最长者胜：「转岗体验」既含「转岗」也可能含更短的词，取更具体的那个。
 */
export function matchCardIcon(text: string): CardIconKey | null {
  let best: { key: CardIconKey; length: number } | null = null
  for (const key of ALL_KEYS) {
    for (const word of KEYWORDS[key]) {
      if (!text.includes(word)) continue
      if (best === null || word.length > best.length) best = { key, length: word.length }
    }
  }
  return best?.key ?? null
}

/**
 * 标题命中优先于描述：标题写的是这张卡的意图，描述只是把它展开，
 * 「回学校读书 / 先把学位补上再谈转行」应该是学习，不是转行。
 */
export function matchCardIconByCard(title: string, desc: string): CardIconKey | null {
  return matchCardIcon(title) ?? matchCardIcon(desc)
}

/** 服务端语义键 → 图标；键不合法（含历史 emoji）时按文案做关键词兜底 */
export function resolveCardIcon(key: string | undefined, title: string, desc: string): CardIconKey {
  const normalized = (key ?? '').trim().toLowerCase()
  if (normalized && isCardIconKey(normalized)) return normalized
  return matchCardIconByCard(title, desc) ?? 'unknown'
}
