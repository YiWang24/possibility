"use client";
/* 探索对话状态机 —— 移植自 iOS ChatModel.swift（付费漏斗主线，技术设计文档 §9.1）
 *
 * 首页发问 → 流式承接迷茫 / 澄清 → AI 给出「暂时的理解」→ 验证反馈
 * （嗯，比较接近 / 还不太对，可循环纠正）→ 信息足够 → 下一步面板。
 *
 * 四条示例问题的首轮、验证后的结论与纠正追问使用本地 mock，保证产品主线确定可达；
 * 用户在纠正追问后给出自己的改写时，再把完整上下文交给 /chat。岔路口成形后用 match_query 调 /match。
 *
 * 采用 iOS Observable 语义：类持有可变状态，通过 version 号驱动 useSyncExternalStore 重渲染。 */

import { streamChat, type ChatConclusion, type ChatStreamDone } from "@/lib/chat-stream";
import { callFunction, supabase } from "@/lib/supabase";
import { isSampleQuestion, type MatchQuery, type MatchResponse, type RemoteConversation, type Traveler, type TrajectoryNode } from "@/lib/models";
import { DEMO_TRAVELERS } from "@/lib/demo-data";
import { useData } from "@/stores/data";

export type ChatEntryPoint = "home" | "tab" | "card";

export interface ChatLaunch {
  /** 职业 / 家庭 / 升学 / 情感（可空：直达 tab） */
  topic?: string;
  question: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
}

/** 对话阶段（对照原型 chatState.stage） */
export type ChatStage = "clarify" | "review" | "correction" | "ready";

/** AI 收尾推荐的单一后续路径 */
export type RecommendedNextStep = "match" | "lab";

type RequestContext = "clarify" | "correctionFollowUp" | "confirm" | "rejection";

interface RetryRequest {
  userText: string;
  context: RequestContext;
}

// MARK: 验证 chips 发送给 API 的用户反馈短句
const CONFIRM_PHRASE = "嗯，这个理解比较接近我。";
const CONFIRM_AFTER_CORRECTION_PHRASE = "这次准确了。";
const CORRECTION_PHRASE = "还不太对。";
const VERIFICATION_PHRASES = new Set([CONFIRM_PHRASE, CONFIRM_AFTER_CORRECTION_PHRASE, CORRECTION_PHRASE]);
const API_FAILURE_MESSAGE = "我好像在接你的路上迷路了，请重试一下。";

const VERIFICATION_CUES = [
  "这个理解接近你吗",
  "这个理解准确吗",
  "这个理解对吗",
  "这样的理解接近你吗",
  "这份理解接近你吗",
  "你可以纠正我",
];

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// MARK: - 兜底内容（四条首页示例问题首轮的本地 mock）

function goldenSummary(topic: string | undefined): string {
  switch (topic) {
    case "家庭":
      return "不想放弃在大城市继续拼搏、证明自己能站稳脚跟的可能 vs 对父母的感恩与牵挂，让你越来越想回家陪伴他们";
    case "升学":
      return "想用读研突破学历与职业发展的天花板 vs 害怕放下已经拥有的工作节奏，承担收入、时间和机会成本";
    case "情感":
      return "想守住这段感情，把彼此带向真正共同的生活 vs 害怕为爱换城后失去自己的事业根基与生活主动权";
    case "职业":
    default:
      return "想赌一次更高薪、拥有更大影响力的可能 vs 舍不得放下多年深耕的积累，走进一个全新而未知的领域";
  }
}

function goldenReply(launch: ChatLaunch): string {
  return `我先试着说一个**暂时的理解**：你卡住的可能不只是「该选哪一个」，而是既想保护「真正重视的东西」，又不想放弃「现实里已经出现的信号」。\n\n我们把它收敛成一个更清楚的岔路口：\n\n**${goldenSummary(launch.topic)}**。\n\n所以你需要的也许不是别人替你判断，而是把**真实意愿**和**害怕付出的代价**拆开来看。这个理解接近你吗？`;
}

export class ChatModel {
  readonly launch: ChatLaunch;
  readonly entryPoint: ChatEntryPoint;

  messages: ChatMessage[] = [];
  input = "";
  isStreaming = false;

  stage: ChatStage = "clarify";
  /** 验证 chips 是否可见（AI 理解后出现，点击即移除） */
  showActionChips = false;
  /** 经历过纠正循环 → chips 文案变为「这次准确了 / 我再补充一点」 */
  hadCorrection = false;
  /** 下一步面板（信息已经足够 · 选择下一步） */
  showNextPanel = false;
  /** AI 在收尾时选择的单一后续路径 */
  recommendedNextStep: RecommendedNextStep | null = null;
  /** 完整总结页 */
  showSummary = false;
  /** 用户在澄清 / 纠正中的原话（结论、总结与分享文案插值） */
  answers: string[] = [];

  /** 服务端会话 ID：首轮 done 事件返回，后续追问带回以延续历史 */
  private conversationId: string | null = null;
  private startedWithMock = false;
  /** 最近一次 done 事件（或历史恢复）携带的岔路口信号 */
  crossroads: ChatStreamDone["crossroads"] | null = null;

  private retryRequest: RetryRequest | null = null;

  // MARK: 岔路口 → /match
  matchedTravelers: Traveler[] = [];
  matchReasons: Record<number, string> = {};
  private matchAttempted = false;

  // MARK: 历史会话
  history: RemoteConversation[] = [];
  showHistory = false;
  private restoredTopic: string | null = null;
  private restoredQuestion: string | null = null;

  private abortController: AbortController | null = null;

  constructor(launch: ChatLaunch, entryPoint: ChatEntryPoint) {
    this.launch = launch;
    this.entryPoint = entryPoint;
  }

  // MARK: - 订阅（useSyncExternalStore）
  private listeners = new Set<() => void>();
  private version = 0;
  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = (): number => this.version;
  private emit() {
    this.version += 1;
    for (const l of this.listeners) l();
  }

  // MARK: - 计算属性

  get confirmLabel(): string {
    return this.hadCorrection ? "这次准确了" : "嗯，比较接近";
  }
  get correctLabel(): string {
    return this.hadCorrection ? "我再补充一点" : "还不太对";
  }
  get canRetry(): boolean {
    return this.retryRequest != null && !this.isStreaming;
  }
  /** 顶栏 / 总结页展示的话题（历史恢复后取会话自身的 topic） */
  get displayTopic(): string | undefined {
    return this.restoredTopic ?? this.launch.topic ?? undefined;
  }
  /** 总结页 / 分享文案的问题（历史恢复后取该会话首条用户消息） */
  get displayQuestion(): string {
    return this.restoredQuestion ?? this.launch.question;
  }
  /** 历史入口条目（排除当前会话自身） */
  get historyEntries(): RemoteConversation[] {
    return this.history.filter((c) => c.id !== this.conversationId);
  }
  /** 分享文案（原型 shareChatExploration 模板） */
  get shareText(): string {
    const a0 = this.answers[0] ?? "真正想要的生活";
    const a1 = this.answers.length > 1 ? this.answers[1] : "暂时不能失去的东西";
    return `我刚在万花筒探索了一个问题：${this.displayQuestion}\n\n我现在更清楚的是：我既想靠近${a0}，也在保护${a1}。`;
  }

  // MARK: - 启动：把首页问题作为第一条用户消息并请求 AI

  async start(): Promise<void> {
    if (this.messages.length) return;
    this.messages.push({ id: uid(), role: "user", text: this.launch.question });
    this.emit();
    if (isSampleQuestion(this.launch.question)) {
      this.startedWithMock = true;
      await this.appendLocalReply(goldenReply(this.launch));
      this.stage = "review";
      this.showActionChips = true;
      this.emit();
    } else {
      await this.performAssistant(this.launch.question, "clarify");
    }
  }

  // MARK: - 继续追问

  send(text: string): void {
    const clean = text.trim();
    if (!clean || this.isStreaming) return;
    const previousStage = this.stage;
    this.input = "";
    this.showActionChips = false;
    // 用户直接输入就是在继续补充或修正；旧的确认按钮不应与新回复并存。
    if (previousStage === "review" || previousStage === "ready") {
      this.stage = "clarify";
      this.showNextPanel = false;
      this.recommendedNextStep = null;
    }
    // 任意新补充都可能改变匹配条件，不能沿用上一版理解预取的用户卡。
    this.resetMatch();
    this.messages.push({ id: uid(), role: "user", text: clean });
    this.answers.push(clean);
    this.emit();

    if (previousStage === "correction") {
      void this.performAssistant(clean, "correctionFollowUp");
    } else {
      void this.performAssistant(clean, "clarify");
    }
  }

  setInput(text: string): void {
    this.input = text;
    this.emit();
  }

  // MARK: - 验证反馈（chips）—— 每一步都续接真实 API

  confirmInsight(): void {
    if (this.isStreaming) return;
    this.showActionChips = false;
    const userText = this.hadCorrection ? CONFIRM_AFTER_CORRECTION_PHRASE : CONFIRM_PHRASE;
    this.messages.push({ id: uid(), role: "user", text: userText });
    this.emit();
    void this.performAssistant(userText, "confirm");
  }

  requestCorrection(): void {
    if (this.isStreaming) return;
    this.showActionChips = false;
    this.resetMatch();
    this.messages.push({ id: uid(), role: "user", text: CORRECTION_PHRASE });
    this.stage = "correction";
    this.emit();
    void this.performAssistant(CORRECTION_PHRASE, "rejection");
  }

  /** 失败气泡下的“重新发送”：移除失败占位，原样重放请求，不重复用户消息。 */
  retry(): void {
    const request = this.retryRequest;
    if (!request || this.isStreaming) return;
    this.retryRequest = null;
    const last = this.messages[this.messages.length - 1];
    if (last && last.role === "ai" && last.text === API_FAILURE_MESSAGE) {
      this.messages.pop();
    }
    this.emit();
    void this.performAssistant(request.userText, request.context);
  }

  // MARK: - 岔路口 → /match

  private resetMatch(): void {
    this.matchedTravelers = [];
    this.matchReasons = {};
    this.matchAttempted = false;
  }

  /** 信息足够后请求匹配，并始终为对话面板准备 2 位旅人。 */
  requestMatch(): void {
    if (this.matchAttempted) return;
    this.matchAttempted = true;
    void (async () => {
      const data = useData.getState();
      if (data.travelers.length === 0) await data.loadTravelers();
      const pool = useData.getState().travelers.length ? useData.getState().travelers : DEMO_TRAVELERS;
      this.applyMatchFallback(pool);
      this.emit();

      const query = this.effectiveMatchQuery();
      try {
        const response = await callFunction<MatchResponse>("match", { user_state: query });
        const known = useData.getState().travelers;
        const travelers: Traveler[] = [];
        const reasons: Record<number, string> = {};
        for (const m of response.matches ?? []) {
          const t = known.find((x) => x.id === m.traveler_id);
          if (!t) continue;
          if (travelers.some((x) => x.id === t.id)) continue;
          travelers.push(t);
          reasons[t.id] = m.reason;
          if (travelers.length === 2) break;
        }
        // 服务端只解析出一位时，沿用已经筛过的本地/模拟卡，不从素材池头部随便补一个无关人物。
        for (const traveler of this.matchedTravelers) {
          if (travelers.length >= 2) break;
          if (travelers.some((x) => x.id === traveler.id)) continue;
          travelers.push(traveler);
          const reason = this.matchReasons[traveler.id];
          if (reason) reasons[traveler.id] = reason;
        }
        if (travelers.length === 2) {
          this.matchedTravelers = travelers;
          this.matchReasons = reasons;
          this.emit();
        }
      } catch {
        // 保留已经展示的两张兜底卡，不让网络失败打断主线。
      }
    })();
  }

  private effectiveMatchQuery(): MatchQuery {
    const cross = this.crossroads;
    if (cross?.ready && cross.match_query) {
      return cross.match_query as MatchQuery;
    }
    const userContext = this.answers.length ? this.answers.join("；") : this.displayQuestion;
    return {
      life_stage: null,
      constraints: this.answers.length > 1 ? this.answers.slice(1, 3) : [],
      tension: `${this.displayQuestion}；${userContext}`,
      decision_stage: "正在澄清选择与代价",
      support_need: "需要不同路径的真实经验与可验证的下一步",
    };
  }

  private applyMatchFallback(pool: Traveler[]): void {
    const context = [this.displayQuestion, ...this.answers].join("；");
    const localMatches = pool
      .map((t) => ({ t, score: this.localMatchScore(t, context) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => (a.score === b.score ? a.t.id - b.t.id : b.score - a.score))
      .slice(0, 2)
      .map((x) => x.t);

    const selected = [...localMatches];
    while (selected.length < 2) {
      selected.push(this.makeSyntheticTraveler(selected.length));
    }
    this.matchedTravelers = selected;
    const reasons: Record<number, string> = {};
    for (const t of selected) reasons[t.id] = this.fallbackReason(t);
    this.matchReasons = reasons;
  }

  /** 只把与当前原话存在明确语义交集的本地素材放上去；零分不硬凑。 */
  private localMatchScore(traveler: Traveler, context: string): number {
    const profile = [traveler.bio, traveler.quote, ...traveler.tags].join(" ").toLowerCase();
    const ctx = context.toLowerCase();
    const semanticSignals: [string[], string[]][] = [
      [["转行", "转型", "换赛道", "职业", "工作", "产品", "设计"], ["转型", "转行", "产品", "设计"]],
      [["读研", "考研", "读书", "留学", "本科", "学习"], ["本科", "硕士", "在读", "学习"]],
      [["裸辞", "休息", "间隔年", "gap", "倦怠"], ["裸辞", "gap", "休息", "环岛"]],
      [["独立开发", "创业", "自由职业", "副业", "做产品"], ["独立开发", "创业", "产品", "一个人"]],
      [["心理", "咨询", "倾听", "助人"], ["心理", "咨询", "倾听"]],
    ];
    let score = 0;
    for (const [queryWords, profileWords] of semanticSignals) {
      if (queryWords.some((w) => ctx.includes(w.toLowerCase())) && profileWords.some((w) => profile.includes(w.toLowerCase()))) {
        score += 3;
      }
    }
    for (const tag of traveler.tags) {
      if (tag.length >= 3 && ctx.includes(tag.toLowerCase())) score += 2;
    }
    return score;
  }

  private fallbackReason(traveler: Traveler): string {
    if (traveler.id < 0) return traveler.quote;
    const clue = traveler.tags[0] ?? traveler.bio;
    return `本地经历中，TA 的「${clue}」与你现在要验证的选择和代价最接近。`;
  }

  /** 素材库覆盖不到时，用用户自己的两股拉力生成一张明确标注的模拟路径卡。 */
  private makeSyntheticTraveler(index: number): Traveler {
    const approaching = this.answers[0] ?? this.displayQuestion;
    const protecting = this.answers.length > 1 ? this.answers[1] : "当前不能轻易失去的部分";
    const moveFirst = index % 2 === 0;
    const name = moveFirst ? "模拟路径 · 先试一步" : "模拟路径 · 先守底线";
    const quote = moveFirst
      ? `先用一次可撤回的小尝试验证「${approaching}」，同时为「${protecting}」设好停止条件。`
      : `先补足能保护「${protecting}」的现实条件，再给「${approaching}」设一个明确复盘日。`;
    const node: TrajectoryNode = {
      age: "下一步",
      t: moveFirst ? "做一次最小现实接触" : "先补齐关键保护条件",
      d: quote,
    };
    return {
      id: -9101 - index,
      name,
      initial: moveFirst ? "试" : "守",
      hue: moveFirst ? 0 : 4,
      is_similar: true,
      quote,
      bio: "基于本轮回答生成的对照经历样本",
      tags: moveFirst ? ["可撤回尝试", "主动验证"] : ["先补缓冲", "定期复盘"],
      dims: [],
      trajectory: [node],
    };
  }

  // MARK: - 历史会话（list-conversations + loadMessages）

  async loadHistory(): Promise<void> {
    try {
      const res = await callFunction<{ conversations: RemoteConversation[]; total: number }>("list-conversations", {
        limit: 20,
        offset: 0,
      });
      this.history = res.conversations ?? [];
    } catch {
      this.history = []; // 静默：入口不显示
    }
    this.emit();
  }

  setShowHistory(value: boolean): void {
    this.showHistory = value;
    this.emit();
  }
  setShowSummary(value: boolean): void {
    this.showSummary = value;
    this.emit();
  }

  private async loadMessages(conversationId: string): Promise<{ role: string; content: string }[]> {
    try {
      const { data, error } = await supabase()
        .from("messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("id");
      if (error) throw error;
      return data ?? [];
    } catch {
      return [];
    }
  }

  /** 恢复一段历史会话：loadMessages 回填消息与 conversation_id，继续对话 */
  async restore(convo: RemoteConversation): Promise<void> {
    if (this.isStreaming) return;
    const remote = await this.loadMessages(convo.id);
    if (remote.length === 0) return; // 拉取失败静默，保持当前对话

    this.conversationId = convo.id;
    this.restoredTopic = convo.topic;
    this.restoredQuestion = remote.find((m) => m.role === "user")?.content ?? null;
    this.crossroads = convo.crossroads
      ? {
          ready: convo.crossroads.ready,
          summary: convo.crossroads.summary ?? undefined,
          match_query: (convo.crossroads.match_query as Record<string, unknown> | null) ?? undefined,
        }
      : null;
    this.messages = remote.map((m) => ({ id: uid(), role: m.role === "user" ? "user" : "ai", text: m.content }));
    // answers = 首条问题之后的用户原话；过滤 chips 固定验证短语。
    this.answers = remote
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .slice(1)
      .filter((c) => !VERIFICATION_PHRASES.has(c));
    this.hadCorrection = false;
    this.showNextPanel = false;
    this.recommendedNextStep = null;
    this.showSummary = false;
    this.matchedTravelers = [];
    this.matchReasons = {};
    this.matchAttempted = false;
    this.retryRequest = null;

    if (this.shouldOfferVerificationOnRestore(convo.crossroads?.ready === true)) {
      this.stage = "review";
      this.showActionChips = true;
      this.requestMatch();
    } else {
      this.stage = "clarify";
      this.showActionChips = false;
    }
    this.showHistory = false;
    this.emit();
  }

  // MARK: - 流式请求 + 打字机

  private async performAssistant(userText: string, context: RequestContext): Promise<void> {
    const result = await this.streamAssistant(userText);
    if (!result.delivered) {
      this.retryRequest = { userText, context };
      this.showActionChips = false;
      this.emit();
      return;
    }
    this.retryRequest = null;

    if (result.conclusion?.ready && context !== "rejection") {
      this.stage = "ready";
      this.showActionChips = false;
      this.showNextPanel = true;
      this.recommendedNextStep = result.conclusion?.next_step ?? null;
      if (this.recommendedNextStep === "match") this.requestMatch();
      this.emit();
      return;
    }

    switch (context) {
      case "clarify":
        // 只有“结构已清晰 + 本轮明确邀请确认”才进入验证态。
        if (this.shouldOfferVerification(result.ready)) {
          this.emit();
          await sleep(850);
          this.stage = "review";
          this.showActionChips = true;
        } else {
          this.stage = "clarify";
          this.showActionChips = false;
        }
        break;
      case "correctionFollowUp":
        this.hadCorrection = true;
        if (this.shouldOfferVerification(result.ready)) {
          this.stage = "review";
          this.showActionChips = true;
        } else {
          this.stage = "correction";
          this.showActionChips = false;
        }
        break;
      case "confirm":
        this.stage = "ready";
        this.showNextPanel = true;
        this.recommendedNextStep = result.conclusion?.next_step ?? "match";
        if (this.recommendedNextStep === "match") this.requestMatch();
        break;
      case "rejection":
        this.hadCorrection = true;
        this.stage = "correction";
        this.showActionChips = false;
        break;
    }
    this.emit();
  }

  /** 服务端 ready + 回复文本的确认邀请，二者缺一都不展示按钮。 */
  private shouldOfferVerification(resultReady: boolean): boolean {
    if (!resultReady) return false;
    const reply = [...this.messages].reverse().find((m) => m.role === "ai" && m.text.length > 0)?.text;
    if (!reply) return false;
    return VERIFICATION_CUES.some((cue) => reply.includes(cue));
  }

  private shouldOfferVerificationOnRestore(resultReady: boolean): boolean {
    return this.shouldOfferVerification(resultReady);
  }

  /** 通用续轮：把 userText 经 /chat 流式发送（带 conversation_id）。 */
  private async streamAssistant(
    userText: string,
  ): Promise<{ delivered: boolean; ready: boolean; conclusion: ChatConclusion | undefined }> {
    this.isStreaming = true;
    this.emit();

    // 服务端按 conversation_id 自取库内历史；mock 首轮尚无 conversation_id，
    // 因此第一次调用 API 时把原问题、mock 理解和用户最新反馈合并进 message。
    const history =
      this.conversationId != null
        ? []
        : this.messages.slice(0, -1).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

    this.messages.push({ id: uid(), role: "ai", text: "" });
    const aiIndex = this.messages.length - 1;
    this.emit();

    let apiMessage: string;
    if (this.startedWithMock && this.conversationId == null) {
      let continuationInstruction: string;
      if (userText === CONFIRM_PHRASE || userText === CONFIRM_AFTER_CORRECTION_PHRASE) {
        continuationInstruction =
          "用户已经确认你的理解准确。不要继续索取信息，也不要复述“我看见了你的困惑”。请基于上述完整上下文，直接给出有依据但不说死的暂时分析、贴合这个用户的低成本建议；先完成回答，再自然承接人生实验室与相似经历。";
      } else if (userText === CORRECTION_PHRASE) {
        continuationInstruction =
          "用户明确认为刚才的理解不准确。请真正重新阅读上下文，不要使用固定道歉模板，也不要为原判断辩护；指出你需要修正的具体假设，并只追问一个最能降低不确定性的问题。";
      } else {
        continuationInstruction =
          "请承接这段上下文继续倾听。如果用户不认同初步理解，不要为原判断辩护，也不要立即换一组新的二者对立。先区分：是对两股拉力的具体理解不准确，还是用户的问题本身就不适合二元框架。如果不适合，停止使用 vs 结构，转而探索多重方向、信息缺口、行动阻力或尚未命名的感受。";
      }
      apiMessage = `此前的本地示例对话上下文：\n用户最初的问题：${this.launch.question}\n助手给出的初步理解：${goldenReply(this.launch)}\n\n用户现在的反馈或补充：${userText}\n\n${continuationInstruction}`;
    } else {
      apiMessage = userText;
    }

    const controller = new AbortController();
    this.abortController = controller;

    let ready = false;
    let receivedDone = false;
    let conclusion: ChatConclusion | undefined;

    try {
      await streamChat(
        {
          conversation_id: this.conversationId ?? undefined,
          topic: this.displayTopic ?? "综合",
          message: apiMessage,
          history,
        },
        {
          onToken: (t) => {
            this.messages[aiIndex].text += t;
            this.emit();
          },
          onDone: (done) => {
            receivedDone = true;
            if (done.conversation_id) this.conversationId = done.conversation_id;
            if (done.crossroads) {
              this.crossroads = done.crossroads;
              if (done.crossroads.ready) ready = true;
            }
            conclusion = done.conclusion;
          },
          signal: controller.signal,
        },
      );
    } catch {
      this.messages[aiIndex].text = API_FAILURE_MESSAGE;
      this.isStreaming = false;
      this.emit();
      return { delivered: false, ready, conclusion };
    }

    if (this.messages[aiIndex].text.length === 0 || !receivedDone) {
      // 流结束但没有 done 事件或内容为空，视为 API 失败，不展示不完整输出。
      this.messages[aiIndex].text = API_FAILURE_MESSAGE;
      this.isStreaming = false;
      this.emit();
      return { delivered: false, ready, conclusion };
    }

    this.isStreaming = false;
    this.emit();
    if (ready || conclusion?.next_step === "match") this.requestMatch();
    return { delivered: true, ready, conclusion };
  }

  /** 四条首页示例问题首轮使用的本地 mock 回复。 */
  private async appendLocalReply(text: string): Promise<void> {
    this.isStreaming = true;
    this.messages.push({ id: uid(), role: "ai", text: "" });
    const aiIndex = this.messages.length - 1;
    this.emit();
    await sleep(700);
    this.messages[aiIndex].text = text;
    this.isStreaming = false;
    this.emit();
  }

  dispose(): void {
    this.abortController?.abort();
    this.listeners.clear();
  }
}
