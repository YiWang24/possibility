import SwiftUI
import UIKit

// MARK: - 卡面图标语义表
//
// 为什么不再用 emoji：lab-choices 的选择卡是按问题现生成的，glyph 交给模型自由发挥，
// 拿回来的是 🧪🎨🪐 这类彩色 emoji——字重、光学尺寸、配色全不受控，
// 和 App 其余部分（底线卡、人生牌局）的单色符号语言互相打架，卡面因此显得「模型生成感」重。
//
// 这里把图标收敛成一份有限语义表：服务端只给语义键，端上统一决定用哪个 SF Symbol、
// 多大、什么字重、着什么色。模型给不出合法键时（含历史 emoji 数据）按中文关键词兜底。
enum CardIcon: String, CaseIterable, Codable, Sendable {

    // 方向：留下 / 深耕 / 转向 / 退回
    case stay, deepen, pivot, retreat
    // 行动：调研 / 试验 / 学习 / 动手 / 创作 / 全力一搏
    case explore, experiment, learn, build, create, leap
    // 人与沟通：连接 / 表达
    case connect, speak
    // 节奏：迁移 / 休整 / 暂缓 / 观望 / 时机
    case relocate, rest, pause, observe, timing
    // 结构：混合 / 平衡 / 保底
    case hybrid, balance, secure
    // 现实条件：钱 / 家庭 / 身体
    case money, home, health
    // 用户自己写的卡 / 无法归类
    case custom, unknown

    /// SF Symbol 名。字形在当前系统缺失时回退到虚线圆——与卡面的虚线描边同一套语言。
    var symbol: String { Self.verifiedSymbols[self] ?? Self.fallbackSymbol }

    private var preferredSymbol: String {
        switch self {
        case .stay: "mappin.and.ellipse"
        case .deepen: "square.stack.3d.up"
        case .pivot: "arrow.triangle.branch"
        case .retreat: "arrow.uturn.backward"
        case .explore: "magnifyingglass"
        case .experiment: "testtube.2"
        case .learn: "books.vertical"
        case .build: "hammer"
        case .create: "paintbrush"
        case .leap: "bolt"
        case .connect: "person.2"
        case .speak: "bubble.left.and.bubble.right"
        case .relocate: "airplane.departure"
        case .rest: "leaf"
        case .pause: "pause.circle"
        case .observe: "eye"
        case .timing: "hourglass"
        case .hybrid: "puzzlepiece"
        case .balance: "scalemass"
        case .secure: "shield"
        case .money: "banknote"
        case .home: "house"
        case .health: "heart"
        case .custom: "square.and.pencil"
        case .unknown: Self.fallbackSymbol
        }
    }

    /// 中文关键词兜底表。词要够长以避免误伤：用「转岗」而不是「转」。
    private var keywords: [String] {
        switch self {
        case .stay: ["留在", "留下", "维持现状", "保持现状", "按兵不动", "原地", "坚守", "守住", "现有岗位", "不换"]
        case .deepen: ["深耕", "精进", "打磨", "专精", "钻研", "沉淀", "积累", "做深", "扎根", "内功"]
        case .pivot: ["转岗", "转型", "转行", "换赛道", "跳槽", "换方向", "调岗", "换岗", "转做", "切换到", "换一条"]
        case .retreat: ["退回", "止损", "撤回", "退出", "保留退路", "回到原", "回头", "放弃"]
        case .explore: ["调研", "打听", "摸底", "探索", "考察", "访谈", "搜集", "问清", "了解清楚"]
        case .experiment: ["试验", "实验", "小步", "试水", "验证", "试点", "跑通", "先试", "试一", "小规模", "原型"]
        case .learn: ["学习", "进修", "补课", "读书", "考证", "上课", "培训", "自学", "课程", "念书"]
        case .build: ["搭建", "动手", "开发", "落地", "做出", "从零做", "工程化", "写代码"]
        case .create: ["创作", "设计", "写作", "作品", "创造", "策展", "表达自己"]
        case .leap: ["全力", "孤注", "梭哈", "放手一搏", "破釜", "彻底转", "一次性", "重注", "下决心"]
        case .connect: ["人脉", "内推", "社群", "圈子", "合作", "搭档", "团队", "伙伴", "引荐", "牵线", "认识人"]
        case .speak: ["沟通", "协商", "争取", "谈一谈", "提出", "对话", "反馈", "摊牌", "说清楚"]
        case .relocate: ["换城市", "异地", "出国", "远程", "外派", "搬到", "去外地", "迁移"]
        case .rest: ["休息", "休整", "恢复", "放慢", "慢下来", "调整节奏", "喘口气", "减负", "间隔年"]
        case .pause: ["暂缓", "暂停", "缓一", "先不", "推迟", "延后", "搁置", "等等再"]
        case .observe: ["观望", "先看", "再看看", "静观", "观察", "不表态", "等信号"]
        case .timing: ["时机", "窗口期", "再等", "熬过", "期限", "倒计时", "时间换"]
        case .hybrid: ["混合", "兼职", "副业", "跨界", "双线", "并行", "两边都", "同时做", "复合"]
        case .balance: ["平衡", "取舍", "权衡", "折中", "兼顾", "分配精力"]
        case .secure: ["保底", "稳住", "兜底", "底线", "保障", "稳定", "备份", "抗风险"]
        case .money: ["收入", "薪资", "涨薪", "降薪", "现金", "储蓄", "财务", "预算", "成本", "养家"]
        case .home: ["家庭", "家人", "父母", "孩子", "伴侣", "陪伴", "生育", "婚"]
        case .health: ["健康", "身体", "体力", "睡眠", "精力", "锻炼", "透支"]
        case .custom, .unknown: []
        }
    }

    // MARK: 解析

    /// 服务端语义键 → 图标；键不合法（含历史 emoji）时按文案做关键词兜底。
    static func resolve(key: String?, title: String, desc: String) -> CardIcon {
        let normalized = key?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if let normalized, let exact = CardIcon(rawValue: normalized) { return exact }
        return match(title: title, desc: desc) ?? .unknown
    }

    /// 标题命中优先于描述：标题写的是这张卡的意图，描述只是把它展开，
    /// 「回学校读书 / 先把学位补上再谈转行」应该是学习，不是转行。
    static func match(title: String, desc: String) -> CardIcon? {
        match(title) ?? match(desc)
    }

    /// 关键词命中最长者胜：「转岗体验」既含「转岗」也可能含更短的词，取更具体的那个。
    static func match(_ text: String) -> CardIcon? {
        var best: (icon: CardIcon, length: Int)?
        for icon in CardIcon.allCases {
            for word in icon.keywords where text.contains(word) {
                if best.map({ word.count > $0.length }) ?? true {
                    best = (icon, word.count)
                }
            }
        }
        return best?.icon
    }

    // MARK: 字形可用性

    private static let fallbackSymbol = "circle.dashed"

    /// 启动时校验一次：拼错或本机缺失的字形会渲染成空白，这里提前换成兜底字形。
    private static let verifiedSymbols: [CardIcon: String] = {
        var table: [CardIcon: String] = [:]
        for icon in CardIcon.allCases {
            let name = icon.preferredSymbol
            table[icon] = UIImage(systemName: name) != nil ? name : fallbackSymbol
        }
        return table
    }()
}

// MARK: - 卡面图标徽章
//
// 规格沿用「自定义选择」卡已有的 27pt 圆角方 + 12%/24% 点缀色，
// 让扇形牌堆里每张卡的图标位保持同一块面积、同一种重量。
struct CardIconChip: View {
    let icon: CardIcon
    var accent: Color = Theme.blue
    var size: CGFloat = 27
    /// 选中态：底色和描边同时加重，图标不换色，避免出现第二种强调语言
    var emphasized: Bool = false

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: size / 3, style: .continuous)
    }

    var body: some View {
        Image(systemName: icon.symbol)
            .font(.system(size: size * 0.52, weight: .medium))
            .foregroundStyle(accent)
            .frame(width: size, height: size)
            .background(accent.opacity(emphasized ? 0.2 : 0.12), in: shape)
            .overlay(shape.strokeBorder(accent.opacity(emphasized ? 0.5 : 0.24), lineWidth: 1))
    }
}

/// 无底衬的图标，用在正文行内（底线卡、拖拽浮标）——那里已经有卡片边框，再套一层会太吵。
struct CardIconMark: View {
    let icon: CardIcon
    var size: CGFloat = 14
    var weight: Font.Weight = .medium

    var body: some View {
        Image(systemName: icon.symbol)
            .font(.system(size: size, weight: weight))
    }
}
