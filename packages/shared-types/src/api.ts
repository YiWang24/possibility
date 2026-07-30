export const EDGE_FUNCTIONS = [
  'chat',
  'match',
  'simulate',
  'analyze-diary',
  'save-profile',
  'get-profile',
  'list-conversations',
  'list-diary',
  'diary-summary',
  'community',
  'lab-choices',
  'persona',
  'merge-anonymous',
  'delete-account',
] as const

export type EdgeFunctionName = (typeof EDGE_FUNCTIONS)[number]
