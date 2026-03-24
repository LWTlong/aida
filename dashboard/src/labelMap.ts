import type { TranslationMap } from './i18n'

const rootCauseKeys: Record<string, keyof TranslationMap> = {
  'rule-missing': 'lmRuleMissing',
  'context-insufficient': 'lmContextInsufficient',
  'hallucination': 'lmHallucination',
  'misunderstanding': 'lmReqMisunderstand',
  'reference-copy': 'lmRefCopy',
  'process-omission': 'lmProcessOmission',
  'multi-round': 'lmMultiRound',
  'context-lost': 'lmContextLost',
  'other': 'lmOtherReason',
}

const deviationCategoryKeys: Record<string, keyof TranslationMap> = {
  'ui-spacing': 'lmUiSpacing',
  'layout': 'lmLayout',
  'component-usage': 'lmComponent',
  'i18n': 'lmI18n',
  'api': 'lmApi',
  'logic': 'lmLogicError',
  'architecture': 'lmArchitecture',
  'style': 'lmStyle',
  'process': 'lmProcessCache',
  'other': 'lmOther',
}

export function rootCauseLabel(key: string, t?: TranslationMap): string {
  const tKey = rootCauseKeys[key]
  if (tKey && t) return t[tKey]
  return key
}

export function deviationCategoryLabel(key: string, t?: TranslationMap): string {
  const tKey = deviationCategoryKeys[key]
  if (tKey && t) return t[tKey]
  return key
}

// Stage/node name mapping — covers both English keys and Chinese data values
const stageNameKeys: Record<string, keyof TranslationMap> = {
  // English keys (from recalcMetrics hardcoded names)
  'Code Generation': 'nodeCodeGen',
  'Bug Fix': 'nodeBugFix',
  'Deviation Fix': 'nodeDeviationFix',
  'Self Review': 'nodeSelfReview',
  'Task Split': 'nodeTaskSplit',
  'Requirement Analysis': 'nodeReqAnalysis',
  // kebab-case keys (from workflow stage field)
  'code-generation': 'nodeCodeGen',
  'bug-fix': 'nodeBugFix',
  'deviation-fix': 'nodeDeviationFix',
  'self-review': 'nodeSelfReview',
  'task-split': 'nodeTaskSplit',
  'requirement-analysis': 'nodeReqAnalysis',
  'requirement-ingestion': 'nodeReqIngestion',
  'build-verify': 'nodeBuildVerify',
  // Chinese data values (written to run.json by Chinese-language workflows)
  '代码生成': 'nodeCodeGen',
  'Bug 修复': 'nodeBugFix',
  'bug修复': 'nodeBugFix',
  '偏差修复': 'nodeDeviationFix',
  '缺陷修复': 'nodeBugFix',
  '自检审查': 'nodeSelfReview',
  '质量自检': 'nodeSelfReview',
  '任务拆分': 'nodeTaskSplit',
  '需求分析': 'nodeReqAnalysis',
  '需求接入': 'nodeReqIngestion',
  '构建验证': 'nodeBuildVerify',
}

export function stageLabel(key: string, t?: TranslationMap): string {
  const tKey = stageNameKeys[key]
  if (tKey && t) return t[tKey]
  return key
}
