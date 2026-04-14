/**
 * AIDevOS Run JSON Schema - Single Source of Truth
 *
 * This is the ONLY place where run.json data structures are defined.
 * All other modules (CLI, Dashboard, Server) MUST import from here.
 */

// ─────────────────────────────────────────────────────────────
// Meta & Summary
// ─────────────────────────────────────────────────────────────

export interface RunMeta {
  schemaVersion?: string
  runId?: string
  project?: string
  branch: string
  developer: string
  aiModel: string
  aiTool?: string
  status: string
  startTime: string
  endTime?: string
  prdPhases?: string[]
}

export interface RunSummaryData {
  totalTasks: number
  completedTasks: number
  deviationCount: number
  bugCount: number
  reviewCount?: number
  reviewPassCount?: number
  reviewFailCount?: number
  rulesSedimented: number
  filesChanged: number
  linesAdded?: number
  linesRemoved?: number
  prdPhaseCount?: number
}

export interface RunMetrics {
  aiDeviationRate?: number
  bugRate?: number
  reviewPassRate?: number
  rulesSedimentedCount?: number
  averageLinesPerTask?: number
  totalDevelopmentTimeSeconds?: number
  developmentVelocity?: number
  actualWorkSeconds?: number
  nodeTimeBreakdown?: Record<string, number>
  efficiencyMultiplier?: number
  tokenCost?: number
  hoursSaved?: number
  moneySaved?: number
  roi?: number
}

export interface RunContext {
  currentStage?: string
  currentTaskId?: string
  currentPrdPhase?: string
  lastUpdated?: string
  [key: string]: unknown
}

// ─────────────────────────────────────────────────────────────
// Core Entities
// ─────────────────────────────────────────────────────────────

export interface TaskItem {
  taskId: string
  title: string
  stageName: string
  prdPhase: string
  status: 'pending' | 'in-progress' | 'done'
  acceptance?: string
  createdAt?: string
  startedAt?: string
  completedAt?: string | null
}

export interface DeviationItem {
  deviationId: string
  title: string
  rootCauseCategory: 'rule-missing' | 'context-insufficient' | 'hallucination' | 'misunderstanding' | 'reference-copy' | 'process-omission' | 'other'
  deviationCategory: 'ui-spacing' | 'layout' | 'component-usage' | 'i18n' | 'api' | 'logic' | 'architecture' | 'style' | 'process' | 'other'
  aiOutput?: string
  expectedOutput?: string
  files: string[]
  ruleSedimented: boolean | string | { file: string; content: string } | null
  detectedAt?: string
  fixedAt?: string | null
}

export interface BugItem {
  bugId: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  source: 'self-review' | 'user-feedback' | 'mcp-review' | 'testing'
  status: 'open' | 'fixed'
  files: string[]
  fix?: string | null
  taskId?: string | null
  reportedAt?: string
  fixedAt?: string | null
}

export interface ReviewItem {
  reviewId: string
  taskId?: string | null
  result: 'pass' | 'fail'
  issueCount: number
  scope: string
  reviewedAt: string
  issues?: string[]
}

export interface RuleItem {
  ruleId: string
  content: string
  category?: string
  sourceDeviation: string | null
  sedimentedAt: string | null
  file: string
  status?: 'pending'
}

export interface FileItem {
  path: string
  changeType: 'created' | 'modified' | 'deleted'
  linesAdded: number
  linesRemoved: number
  changeCount: number
  lastModified?: string
}

export interface TimelineItem {
  type: string
  title: string
  timestamp: string
  prdPhase?: string
}

export interface WorkflowStage {
  stage: string
  prdPhase?: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  startTime?: string
  endTime?: string
}

export interface EventItem {
  type: string
  time: string
  data: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────
// Cost & Highlights
// ─────────────────────────────────────────────────────────────

export interface RunCost {
  totalTokens?: number
  estimatedManualHours?: number
  actualHours?: number
  tokenBreakdown?: { stage: string; tokens: number }[]
  tokenDetail?: {
    inputTokens: number
    outputTokens: number
    cacheCreationTokens: number
    cacheReadTokens: number
  }
}

export interface HighlightItem {
  content: string
  source: 'auto' | 'manual'
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// Requirement (branch-level shared data)
// ─────────────────────────────────────────────────────────────

export interface RequirementModule {
  id: string
  name: string
  description: string
  assignee: string | null
}

export interface RequirementPrdPhase {
  phase: string
  file: string
  title: string
  confirmedAt: string | null
}

export interface DeveloperSummary {
  name: string
  modules: string[]
  tasks: number
  completedTasks: number
  bugs: number
  deviations: number
  linesAdded: number
  linesRemoved: number
  firstPassRate: number
  actualWorkSeconds: number
  totalTokens: number
}

export interface RequirementData {
  branch: string
  title: string
  summary: string
  prdPhases: RequirementPrdPhase[]
  modules: RequirementModule[]
  highlights: HighlightItem[]
  developers: DeveloperSummary[]
  totals: {
    tasks: number
    completedTasks: number
    bugs: number
    deviations: number
    linesAdded: number
    linesRemoved: number
    totalTokens: number
  }
  createdAt: string
  updatedAt: string
}

// ─────────────────────────────────────────────────────────────
// Index (project-level aggregation)
// ─────────────────────────────────────────────────────────────

export interface IndexRunEntry {
  branch: string
  title: string
  summary: string
  status: string
  startTime: string
  endTime?: string
  developers: DeveloperSummary[]
  highlights: HighlightItem[]
  totals: RequirementData['totals']
}

export interface IndexData {
  project: string
  updatedAt: string
  runs: IndexRunEntry[]
}

// ─────────────────────────────────────────────────────────────
// Root Data Structure
// ─────────────────────────────────────────────────────────────

export interface RunData {
  meta: RunMeta
  summary: RunSummaryData
  metrics: RunMetrics
  context: RunContext
  tasks: TaskItem[]
  deviations: DeviationItem[]
  bugs: BugItem[]
  reviews: ReviewItem[]
  rules: RuleItem[]
  files: FileItem[]
  timeline: TimelineItem[]
  workflow: WorkflowStage[]
  events: EventItem[]
  cost: RunCost
  highlights: HighlightItem[]
}

// ─────────────────────────────────────────────────────────────
// Rules Registry (project-level, .aida/rules.json)
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Validation Constants (for CLI)
// ─────────────────────────────────────────────────────────────

export const SEVERITY_VALUES = ['critical', 'high', 'medium', 'low'] as const
export const BUG_SOURCE_VALUES = ['self-review', 'user-feedback', 'mcp-review', 'testing'] as const
export const ROOT_CAUSE_VALUES = ['rule-missing', 'context-insufficient', 'hallucination', 'misunderstanding', 'reference-copy', 'process-omission', 'other'] as const
export const DEVIATION_CAT_VALUES = ['ui-spacing', 'layout', 'component-usage', 'i18n', 'api', 'logic', 'architecture', 'style', 'process', 'other'] as const
export const REVIEW_RESULT_VALUES = ['pass', 'fail'] as const
export const CHANGE_TYPE_VALUES = ['created', 'modified', 'deleted'] as const
export const TASK_STATUS_VALUES = ['pending', 'in-progress', 'done'] as const
export const WORKFLOW_STATUS_VALUES = ['pending', 'in_progress', 'completed', 'failed'] as const
