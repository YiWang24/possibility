import Foundation
import Observation

// MARK: - 首页「认识自己」视图模型
//
// 客户端 UI 状态（录音计时、输入框、动画阶段）留在此；服务端状态（画像/日记分析）经
// SupabaseService 拉取（技术设计文档 §8.2）。语音转文字非主线，demo 用预置 transcript + 兜底。

@Observable
@MainActor
final class HomeModel {

    // MARK: 探索发问
    var question: String = ExploreTopic.career.sampleQuestion
    var topic: ExploreTopic = .career {
        didSet {
            // 切换话题时，若输入框仍是上个话题的样例问题，则替换为新话题样例
            if question == oldValue.sampleQuestion || question.isEmpty {
                question = topic.sampleQuestion
            }
        }
    }

    var trimmedQuestion: String { question.trimmingCharacters(in: .whitespacesAndNewlines) }
    var canSend: Bool { !trimmedQuestion.isEmpty }
    var questionCount: Int { question.count }

    // MARK: 语音日记
    var isRecording = false
    var elapsed = 0
    var analyzing = false
    var analysis: DiaryAnalysis?
    private var timerTask: Task<Void, Never>?

    /// demo：录音得到的预置 transcript（真实 STT 非主线）
    private let sampleTranscript = "今天又在纠结要不要转产品。会议上帮团队理清了一个乱成一团的需求，那一刻很有成就感，但一想到要放弃做了六年的设计，还是会慌。"

    var elapsedText: String {
        String(format: "%d:%02d", elapsed / 60, elapsed % 60)
    }

    func toggleRecording() {
        if isRecording { finishRecording() } else { startRecording() }
    }

    private func startRecording() {
        isRecording = true
        elapsed = 0
        analysis = nil
        timerTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard let self, self.isRecording else { break }
                self.elapsed += 1
            }
        }
    }

    func finishRecording() {
        isRecording = false
        timerTask?.cancel()
        timerTask = nil
    }

    /// 完成录音 → 分析情绪与关键词（analyze-diary，失败走兜底）
    func analyzeDiary(using supabase: SupabaseService) async {
        finishRecording()
        analyzing = true
        defer { analyzing = false }
        if let result = try? await supabase.analyzeDiary(transcript: sampleTranscript) {
            analysis = result
        } else {
            analysis = Self.fallbackAnalysis
        }
    }

    /// 断网兜底的日记分析（对应 §13 现场抖动缓解）
    static let fallbackAnalysis = DiaryAnalysis(
        emotions: ["纠结", "成就感", "焦虑"],
        keywords: ["转型", "设计", "产品", "身份认同"],
        dimUpdates: nil
    )

    // MARK: 动态画像
    struct PortraitDim: Identifiable {
        let id = UUID()
        let icon: String
        let iconTint: UInt32
        let label: String
        let value: String
        let isTodo: Bool
    }

    /// 结合服务端 profile.dims 与 demo 默认，产出画像维度卡
    func portraitDims(profile: UserProfile?) -> [PortraitDim] {
        let dims = profile?.dims ?? [:]
        return [
            PortraitDim(icon: "✦", iconTint: 0x5E96FF, label: "我擅长",
                        value: dims["我擅长"] ?? "结构化思考 · 共情 · 视觉表达", isTodo: false),
            PortraitDim(icon: "♡", iconTint: 0xE35CC1, label: "我喜欢",
                        value: dims["我喜欢"] ?? "把混乱变有序 · 独处的清晨 · 手绘", isTodo: false),
            PortraitDim(icon: "✿", iconTint: 0xFF7A4D, label: "我在情感关系中在意",
                        value: dims["我在情感关系中在意"] ?? "待探索 · 回答 3 个小问题点亮",
                        isTodo: dims["我在情感关系中在意"] == nil),
            PortraitDim(icon: "⌂", iconTint: 0x3ED9A4, label: "我在家庭关系中在意",
                        value: dims["我在家庭关系中在意"] ?? "待探索 · 回答 3 个小问题点亮",
                        isTodo: dims["我在家庭关系中在意"] == nil),
        ]
    }

    func portraitPct(profile: UserProfile?) -> Int {
        profile?.portraitPct ?? AppConfig.Threshold.portraitInitialPct
    }

    // MARK: demo 人物
    let userName = "屿岸"
    let exploredDays = 47
}
