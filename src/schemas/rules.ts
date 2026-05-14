export interface RuleRegistryEntry {
  id: string
  category: string
  content: string
  fingerprint: string
  source: {
    branch: string
    deviation: string | null
    author: string
  }
  createdAt: string
  status: 'active' | 'pending' | 'conflict' | 'deprecated'
}

export const RULE_CATEGORIES = [
  'component', 'api', 'style', 'i18n', 'architecture',
  'state-management', 'routing', 'testing', 'process', 'general',
] as const
