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

export interface ModuleMemoryRecord {
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
  updatedAt: string
}

export interface ModuleMemoryIndexEntry {
  key: string
  title: string
  summary: string
  keywords: string[]
  paths: string[]
  updatedAt: string
}

export interface ModuleMemoryIndex {
  updatedAt: string
  modules: ModuleMemoryIndexEntry[]
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
