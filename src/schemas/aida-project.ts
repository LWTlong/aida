export type AiToolChoice =
  | 'claude-code'
  | 'cursor'
  | 'vscode-copilot'
  | 'windsurf'
  | 'lingma'
  | 'codex';

export interface AidaConfig {
  schemaVersion?: string
  project?: string
  aiTool?: AiToolChoice
  aiTools?: AiToolChoice[]
  aiModel?: string
  hourlyRate?: number
  tokenPricePer1M?: number
  [key: string]: unknown
}

export interface ToolConfigSnapshot {
  tool: AiToolChoice
  path: string
  format: 'json' | 'toml' | 'text'
  content: unknown
}

export interface ToolConfigStore {
  generatedAt?: string
  importedAt?: string
  tools?: AiToolChoice[]
  snapshots?: ToolConfigSnapshot[]
}

export interface ModuleMemoryReference {
  ticket?: string
  branch?: string
  summary: string
  updatedAt?: string
}

export interface ModuleChangeEntry {
  ticket?: string
  branch?: string
  title?: string
  summary: string
  updatedAt: string
}

export interface ModuleMemoryRecord {
  schemaVersion?: string
  moduleKey: string
  title: string
  summary: string
  keywords: string[]
  entryFiles: string[]
  relatedPaths: string[]
  dataFlow: string[]
  decisions: string[]
  constraints: string[]
  pitfalls: string[]
  relatedRules: string[]
  tickets: ModuleMemoryReference[]
  changes?: ModuleChangeEntry[]
  updatedAt: string
}

export interface ModuleMemoryIndexEntry {
  key: string
  title: string
  summary: string
  keywords: string[]
  paths: string[]
  tickets?: string[]
  updatedAt: string
}

export interface ModuleMemoryIndex {
  schemaVersion?: string
  updatedAt: string
  items: ModuleMemoryIndexEntry[]
}

export interface RunContextRecord {
  branch: string
  ticket?: string
  title: string
  summary: string
  currentPhase: string
  modules: string[]
  completed: string[]
  inProgress: string[]
  next: string[]
  decisions: string[]
  constraints: string[]
  keyFiles: string[]
  risks: string[]
  updatedAt: string
}

export interface SummaryEntry {
  branch: string
  ticket?: string
  title: string
  summary: string
  modules: string[]
  highlights: string[]
  status: string
  keyFiles?: string[]
  updatedAt: string
}
