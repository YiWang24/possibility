import Foundation

// MARK: - 断网兜底 / Preview 种子数据
//
// 与 supabase/seed.sql 对齐的 5 位旅人。现场网络或 LLM 抖动时（技术设计文档 §13），
// SupabaseService 拉取失败即回退到此，保证社区 / match / 主页 / Preview 始终有内容。

enum DemoData {

    static let travelers: [Traveler] = [
        Traveler(id: 1, name: "林可", initial: "可", hue: 0, isSimilar: true,
                 quote: "转过来才发现，最难的不是学技能，是重建身份认同。",
                 bio: "交互设计 → AI 产品经理",
                 tags: ["28 岁转型", "边工作边尝试", "设计背景", "未降薪明显幅度"],
                 dims: [["我擅长", "把模糊的想法拆成能落地的步骤"], ["我喜欢", "爬山 · 把混乱变有序"],
                        ["我是什么样的人", "慢热，但认定了就很轴"], ["我希望认识什么样的人", "正在换赛道、心里没底的人"]],
                 trajectory: [
                    TrajectoryNode(age: "28 岁", title: "开始尝试转型 AI 产品", detail: "利用下班时间学习和实践，在公司申请了一个小型 AI 项目，逐步承担更多产品职责。"),
                    TrajectoryNode(age: "30 岁", title: "转型产品经理", detail: "降薪去创业公司，第一年被业务按在地上摩擦，但第一次为结果负责。"),
                    TrajectoryNode(age: "33 岁", title: "AI 产品负责人", detail: "带 6 人小组做 AI 工具，设计背景成了最大的差异化优势。"),
                 ]),
        Traveler(id: 2, name: "慢速行星", initial: "慢", hue: 2, isSimilar: true,
                 quote: "30 岁重新读本科，同学叫我姐。但我第一次觉得时间是自己的。",
                 bio: "前运营，现心理学在读",
                 tags: ["30 重读本科", "裸辞"],
                 dims: [["我擅长", "把大目标切成每天能做完的小事"], ["我喜欢", "图书馆闭馆前的最后一小时"],
                        ["我是什么样的人", "大器晚成型选手"], ["我希望认识什么样的人", "也在「重来一次」的人"]],
                 trajectory: [
                    TrajectoryNode(age: "24 岁", title: "专科毕业做运营", detail: "六年换了四家公司，越做越熟练，也越做越空。"),
                    TrajectoryNode(age: "30 岁", title: "重读本科", detail: "考了两次，读心理学。存款只够两年，但睡得着了。"),
                 ]),
        Traveler(id: 3, name: "第七次日落", initial: "落", hue: 1, isSimilar: false,
                 quote: "裸辞第 200 天，存款减半，睡眠翻倍。",
                 bio: "gap 中，正在环岛骑行",
                 tags: ["大厂裸辞", "gap 一年"],
                 dims: [["我擅长", "把日子过得便宜又有质感"], ["我喜欢", "海边的烂天气"],
                        ["我是什么样的人", "用力过猛后学会松手的人"], ["我希望认识什么样的人", "敢浪费时间的人"]],
                 trajectory: [
                    TrajectoryNode(age: "27 岁", title: "大厂高级运营", detail: "年终 3.75，代价是耳鸣和凌晨两点的地铁。"),
                    TrajectoryNode(age: "29 岁", title: "裸辞 gap", detail: "没有计划的一年。骑行到第三个月，才停止每天打开招聘软件。"),
                 ]),
        Traveler(id: 4, name: "晚风收集者", initial: "晚", hue: 4, isSimilar: true,
                 quote: "一个人做产品：白天写代码，晚上画图标，半夜回用户邮件。",
                 bio: "独立开发者，产品月收入刚过房租",
                 tags: ["设计转独立开发", "两年"],
                 dims: [["我擅长", "一个人当一支队伍"], ["我喜欢", "发版后的第一条好评"],
                        ["我是什么样的人", "悲观的行动派"], ["我希望认识什么样的人", "也在一个人做事的人"]],
                 trajectory: [
                    TrajectoryNode(age: "28 岁", title: "辞职做独立开发", detail: "用设计功底做了三款小工具，死了两款，活下来的那款养活了自己。"),
                 ]),
        Traveler(id: 5, name: "低电量诗人", initial: "诗", hue: 3, isSimilar: true,
                 quote: "从改需求到听人说话，我终于不用假装外向了。",
                 bio: "前产品经理，现实习咨询师",
                 tags: ["转行心理咨询", "35+"],
                 dims: [["我擅长", "听出话背后的那句话"], ["我喜欢", "来访者说「被你说中了」的瞬间"],
                        ["我是什么样的人", "内向但不冷"], ["我希望认识什么样的人", "35 岁以后才换方向的人"]],
                 trajectory: [
                    TrajectoryNode(age: "35 岁", title: "转行心理咨询", detail: "读了三年在职硕士，时薪从 500 变成 0，又慢慢变回 300。"),
                 ]),
    ]

    static let details: [Int: TravelerDetail] = [
        1: TravelerDetail(travelerId: 1, age: 33, city: "杭州", fromRole: "交互设计", toRole: "AI 产品经理", years: "转型 5 年",
                          intro: "我在 28 岁时开始尝试转型 AI 产品。没有裸辞，也没有把过去全部推倒重来，而是利用下班时间学习和实践，在公司申请小型 AI 项目，逐步承担更多产品职责。30 岁完成内部转岗，后来跳到互联网公司，现在负责 AI 产品方向。",
                          fullText: "真正的转折不是拿到产品经理的 title，而是第一次独立为结果负责。设计经验让我更懂用户，但商业判断、数据意识和跨团队推进都需要从零补课。前一年我做了 47 次用户访谈，把每次失败都整理成可复用的判断框架。回头看，最有效的路径不是囤课，而是尽早进入一个真实项目。",
                          advice: .init(
                            decision: ["先用一个 6 周的小项目验证兴趣，不急着辞职。", "把“想转型”改成一个可验证的问题：我愿不愿意持续为结果负责？", "至少找 3 位真实从业者，问清工作中最消耗人的部分。"],
                            ability: ["把用户研究、信息架构和原型能力翻译成产品语言。", "刻意补齐数据分析、商业判断和项目推进三项短板。", "作品集不要只放界面，要讲清目标、取舍和结果。"],
                            interview: ["准备一个你真正推动过的项目，而不是包装出的完整案例。", "回答冲突题时说明你如何建立共同目标。", "主动展示对 AI 能力边界与失败场景的理解。"]),
                          result: "5 年完成转型，未出现明显降薪", consulted: 42, responseTime: "通常 4 小时内回复"),
        2: TravelerDetail(travelerId: 2, age: 32, city: "南京", fromRole: "互联网运营", toRole: "心理学在读", years: "重启 2 年",
                          intro: "30 岁重新走进本科课堂，我并不比别人更勇敢，只是终于承认继续待在熟悉的工作里会越来越空。决定重读本科之前，我用半年做财务准备，也和家人反复沟通。",
                          fullText: "最难的是接受自己重新成为新手。课程、实习和经济压力同时出现时，我把目标缩小到每周能完成的动作，并保留一份远程兼职。稳定感没有消失，只是从职位变成了自己可执行的节奏。",
                          advice: .init(
                            decision: ["先计算能支撑多久，而不是只问自己敢不敢。", "试听真实课程，确认喜欢的是学科还是想象。", "提前设计与家人的沟通边界。"],
                            ability: ["把运营中的沟通与洞察迁移到访谈训练。", "保持每周复盘，建立长期学习节奏。", "尽早进入真实实习场景。"],
                            interview: ["诚实解释重启原因，不必把每一步合理化。", "用行动证据说明你的长期投入。", "准备面对年龄相关问题的稳定表达。"]),
                          result: "边读书边维持远程收入", consulted: 27, responseTime: "通常当天回复"),
        3: TravelerDetail(travelerId: 3, age: 29, city: "厦门", fromRole: "大厂运营", toRole: "间隔年探索", years: "Gap 第 1 年",
                          intro: "裸辞后的前两个月，我仍然每天打开招聘软件。后来开始环岛骑行，才意识到休息不是为了更快回到原轨道，而是重新听见自己的节奏。",
                          fullText: "存款减少会制造真实焦虑，所以我给这段间隔年设置了预算上限、复盘节点和退出条件。第三个月之后，我开始用短项目换住宿，也重新接触写作。没有得到标准答案，但知道下一份工作不能再以透支身体为代价。",
                          advice: .init(
                            decision: ["为 Gap 设置预算上限和最晚复盘日。", "区分“逃离现在”和“走向新的方向”。", "在离职前处理保险、现金流和居住问题。"],
                            ability: ["用小项目保持工作手感。", "记录精力变化，找到真正恢复你的活动。", "建立低成本生活系统。"],
                            interview: ["不回避空窗期，说明你完成了哪些探索。", "把零散经历组织成选择逻辑。", "明确下一份工作的底线。"]),
                          result: "睡眠恢复，重新建立生活节奏", consulted: 18, responseTime: "通常 8 小时内回复"),
        4: TravelerDetail(travelerId: 4, age: 31, city: "成都", fromRole: "视觉设计", toRole: "独立开发", years: "独立第 2 年",
                          intro: "我没有等到技术完全准备好才开始。第一款产品用了三周上线，几乎没人付费；第二款也失败了。第三款小工具终于覆盖房租。",
                          fullText: "一个人做产品最重要的不是全栈，而是知道什么暂时不做。设计背景帮我快速做出体验，但真正让产品活下来的是持续访谈、定价实验和克制功能范围。",
                          advice: .init(
                            decision: ["先做能在两周内交付的最小版本。", "上线前找到 10 个真实潜在用户。", "给自己设定可承受的试错预算。"],
                            ability: ["学会用低代码和 AI 补足开发环节。", "把定价当成产品设计的一部分。", "建立每周固定的用户反馈节奏。"],
                            interview: ["独立开发经历要用数据说明。", "解释你主动砍掉了什么。", "展示从失败版本到当前版本的变化。"]),
                          result: "第三款产品开始覆盖房租", consulted: 35, responseTime: "通常 6 小时内回复"),
        5: TravelerDetail(travelerId: 5, age: 37, city: "上海", fromRole: "产品经理", toRole: "心理咨询师", years: "转型 3 年",
                          intro: "35 岁开始系统学习心理咨询时，我的时薪从 500 变成 0。那段时间最难的不是收入，而是接受新的职业身份需要慢慢长出来。",
                          fullText: "我保留了一部分产品顾问工作，用三年完成课程、督导和实习。过去的产品经验让我善于结构化问题，但咨询训练要求我放下解决问题的冲动，真正听见对方。",
                          advice: .init(
                            decision: ["先体验真实课程和个人咨询。", "预留至少两年的训练时间。", "不要低估督导与个人成长成本。"],
                            ability: ["练习倾听，不急着给建议。", "建立稳定的案例记录与督导机制。", "把结构化能力用于整理，而不是控制对话。"],
                            interview: ["说明转型中的持续训练证据。", "坦诚面对经验时数。", "把过去职业经验转化成理解人的能力。"]),
                          result: "完成实习，开始稳定接案", consulted: 31, responseTime: "通常当天回复"),
    ]

    /// 每位旅人的三档服务（consult / materials / companion），文案与 seed 对齐
    static func services(for travelerId: Int) -> [TravelerServiceItem] {
        let name = travelers.first { $0.id == travelerId }?.name ?? "TA"
        let reply = details[travelerId]?.responseTime ?? "通常当天回复"
        return [
            TravelerServiceItem(id: "consult-\(travelerId)", travelerId: travelerId, kind: "consult",
                                title: "与\(name)进行 1 小时咨询", price: 29, unit: "次",
                                description: "\(reply) · 24 小时内可追问一次",
                                tags: ["转型时机", "能力迁移", "作品集", "求职面试", "薪资风险"]),
            TravelerServiceItem(id: "materials-\(travelerId)", travelerId: travelerId, kind: "materials",
                                title: "海外学校申请材料包", price: 9.9, unit: "份",
                                description: "可复制的选校比较表、按月份拆分的申请时间线、文书内容自查清单，以及统一的文件命名和提交检查模板。",
                                tags: ["选校表", "时间线", "文书自查", "材料清单"]),
            TravelerServiceItem(id: "companion-\(travelerId)", travelerId: travelerId, kind: "companion",
                                title: "4 周申请陪跑", price: 599, unit: "期",
                                description: "目标拆解 · 每周复盘 · 材料反馈。提交后会先确认目标与服务边界，双方确认适合后再开始 4 周陪跑。",
                                tags: ["刚开始了解", "正在选校", "准备文书", "即将提交"]),
        ]
    }

    static let bounties: [Bounty] = [
        Bounty(id: 1, question: "有没有人从设计转数据分析？想听第一年最难的是什么", reward: "悬赏 3 个真实故事", responses: "2 人回应",
               tags: ["职业转型", "数据分析", "设计背景"]),
        Bounty(id: 2, question: "26 岁要不要辞职考研？家里催我先稳定下来", reward: "悬赏 5 个亲历者", responses: "2 人回应",
               tags: ["升学选择", "辞职考研", "家庭沟通"]),
        Bounty(id: 3, question: "想去小城市生活，又怕后悔，有回不来的人吗？", reward: "悬赏 3 个真实故事", responses: "2 人回应",
               tags: ["城市迁移", "生活方式", "小城创业"]),
    ]

    // MARK: 悬赏详情（原型 BOUNTIES 详情字段，本地演示数据）

    struct BountyDetail {
        let tags: [String]
        let amount: String
        let goal: String
        let asker: String
        let time: String
        let city: String
        let detail: String
        let replies: [(name: String, role: String, text: String)]
    }

    static func bountyDetail(_ id: Int) -> BountyDetail {
        bountyDetails[id] ?? BountyDetail(
            tags: ["真实经历"], amount: "29", goal: "征集真实故事", asker: "匿名旅人", time: "刚刚", city: "线上",
            detail: "发帖人希望听到亲历者的真实经历，而不是抽象建议。",
            replies: [])
    }

    private static let bountyDetails: [Int: BountyDetail] = [
        1: BountyDetail(
            tags: ["职业转型", "数据分析", "设计背景"], amount: "29", goal: "征集 3 个真实故事",
            asker: "雾岛来信", time: "2 小时前", city: "杭州",
            detail: "我做了 4 年视觉设计，最近在自学 SQL 和 Python。真正担心的不是课程学不会，而是没有数据项目经验，也不知道第一份工作是否一定会降薪。希望听到设计背景转数据分析的真实经历，尤其是入行第一年的困难和准备方式。",
            replies: [
                ("纸飞机", "财务分析 → 数据分析师", "第一年最难的是把“会工具”变成“能回答业务问题”，我用公司内部数据做了三个小项目。"),
                ("十点半", "建筑设计 → UX 设计师", "虽然方向不同，但作品集转译旧能力这件事很相似，可以分享我的踩坑清单。"),
            ]),
        2: BountyDetail(
            tags: ["升学选择", "辞职考研", "家庭沟通"], amount: "19.9", goal: "征集 5 位亲历者",
            asker: "青柠汽水", time: "5 小时前", city: "南京",
            detail: "目前工作两年，收入稳定但看不到想要的发展。想跨专业读心理学研究生，家里认为先工作、结婚更现实。我希望了解辞职备考的现金流压力、失败后的退路，以及怎样和家人沟通。",
            replies: [
                ("重启按钮", "30 岁重读心理学本科", "先别急着用辞职证明决心。我用了半年试听课程、准备预算，再决定重新回到校园。"),
                ("木棉", "全职妈妈 → 生涯咨询师", "和家人沟通时，具体的预算与时间节点比“这是我的梦想”更容易建立信任。"),
            ]),
        3: BountyDetail(
            tags: ["城市迁移", "生活方式", "小城创业"], amount: "39", goal: "征集 3 个真实故事",
            asker: "在逃星期一", time: "昨天", city: "上海",
            detail: "在上海做运营第 6 年，越来越想搬去生活成本低、节奏慢一点的城市。但担心收入、社交圈和以后回大城市的难度。想听已经搬走两年以上的人讲讲真实得失，而不只是旅行滤镜。",
            replies: [
                ("北纬三十度", "互联网运营 → 民宿主理人", "去大理不是躺平，我提前算了十二个月现金流，也保留了远程项目作为缓冲。"),
                ("潮汐之外", "大厂运营 → 间隔年探索", "真正变化最大的是消费结构和关系密度，不是每天都像度假。"),
            ]),
    ]
}
