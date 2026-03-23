/**
 * AIDevOS Dashboard Types
 *
 * Re-exports from the unified Schema (Single Source of Truth)
 */

// Import all types from the unified schema
export type {
  RunMeta,
  RunSummaryData,
  RunMetrics,
  RunContext,
  TaskItem,
  DeviationItem,
  BugItem,
  ReviewItem,
  RuleItem,
  FileItem,
  TimelineItem,
  WorkflowStage,
  EventItem,
  RunData,
  RunCost,
  HighlightItem,
  RequirementData,
  RequirementModule,
  RequirementPrdPhase,
  DeveloperSummary,
  IndexData,
  IndexRunEntry,
  RuleRegistryEntry,
} from '../../src/schemas/run-json.js'

// Dashboard-specific types (not in run.json)
// RunSummary is used for displaying runs in the list
export interface RunSummary {
  runId: string
  branch: string
  developer: string
  aiModel: string
  status: string
  startTime: string
  totalTasks: number
  completedTasks: number
  deviationCount: number
  bugCount: number
  reviewPassRate: number
  rulesSedimented: number
  filesChanged: number
  totalDevTimeSeconds: number
  actualWorkSeconds: number
}
