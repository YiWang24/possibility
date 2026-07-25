// AI integration prompt specs (source: prototype line ~2684, `AI_INTEGRATION_PROMPTS`).

export type AIIntegrationKey = 'labChoiceCards' | 'labSimulationResult' | 'kaleidoRecommendation' | 'dynamicPersona';

export interface AIIntegrationSpec {
  defaultPrompt: string;
  context: string[];
  outputSchema: Record<string, string>;
}

export const AI_INTEGRATION_PROMPTS: Record<AIIntegrationKey, AIIntegrationSpec> = {
  labChoiceCards: {
    defaultPrompt: '根据用户当前在人生实验室探索的问题、相关画像与可承受条件，生成数量和内容都适合这个问题的选择卡。',
    context: ['question', 'topic', 'authorizedProfileSummary', 'constraints', 'previousChoices'],
    outputSchema: {
      cards: 'Array<{id,glyph,title,description,color}>',
      rationale: 'string',
    },
  },
  labSimulationResult: {
    defaultPrompt: '根据用户的问题、选择卡、时间跨度、底线卡、已授权画像和相关真实经历，生成最好、一般与最坏三种推演结果。',
    context: ['question', 'selectedCard', 'horizonYears', 'carryCards', 'authorizedProfileSummary', 'recentDialogueSummary', 'relevantExperienceIds'],
    outputSchema: {
      scenarios: '{best,likely,worst}:{summary,dimensions,gains,costs,conditions}',
      bottomLineAnalysis: '{isAcceptable,risks,protectiveConditions}',
      recommendedUserIds: 'Array<string|number>',
    },
  },
  kaleidoRecommendation: {
    defaultPrompt: '根据用户的动态画像、当前问题和抽取模式，从万花筒社区中选择最值得用户看见的真实用户。',
    context: ['authorizedProfileSummary', 'currentQuestion', 'mode', 'candidateUserIds', 'recentlyViewedUserIds'],
    outputSchema: {
      userId: 'string|number',
      matchReason: 'string',
      matchScore: 'number',
    },
  },
  dynamicPersona: {
    defaultPrompt: '根据用户已授权的 Memory 异步生成动态画像，并返回可稳定复现的形态、颜色和摘要。',
    context: ['memoryRefs', 'authorizedDimensions', 'assessmentSummaries', 'lifeCards', 'visibility'],
    outputSchema: {
      jobId: 'string',
      status: 'queued|processing|completed|failed',
      persona: '{seed,shape,hue,lobes,summary,modelVersion}',
    },
  },
};
