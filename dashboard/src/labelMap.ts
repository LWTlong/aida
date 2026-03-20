export const rootCauseLabels: Record<string, string> = {
  'rule-missing': '规则缺失',
  'context-insufficient': '上下文不足',
  'hallucination': '盲目照搬/臆想',
  'misunderstanding': '需求理解偏差',
  'reference-copy': '参考照搬',
  'process-omission': '流程遗漏',
  'multi-round': '多轮未收敛',
  'context-lost': '上下文丢失',
  'other': '其他原因',
}

export const deviationCategoryLabels: Record<string, string> = {
  'ui-spacing': 'UI/间距',
  'layout': '布局/结构',
  'component-usage': '组件使用',
  'i18n': 'i18n/国际化',
  'api': 'API 接口',
  'logic': '逻辑错误',
  'architecture': '架构设计',
  'style': '样式问题',
  'process': '流程/缓存',
  'other': '其他',
}

export function rootCauseLabel(key: string): string {
  return rootCauseLabels[key] || key
}

export function deviationCategoryLabel(key: string): string {
  return deviationCategoryLabels[key] || key
}
