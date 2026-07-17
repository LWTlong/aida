export type AidaAssetType =
  | 'rule'
  | 'skill'
  | 'memory'
  | 'command'
  | 'agent'
  | 'hook'
  | 'mcp-config'
  | 'plugin'
  | 'plugin-asset'
  | 'doc'
  | 'workflow'
  | 'tool-config';

export type AidaSourceTool = 'aida' | 'claude' | 'cursor' | 'codex' | 'generic' | 'unknown';

export type AidaConfidence = 'high' | 'medium' | 'low';

export interface AidaAssetSource {
  tool: AidaSourceTool;
  root: string;
  path: string;
  format: 'markdown' | 'json' | 'toml' | 'yaml' | 'text' | 'unknown';
}

export interface AidaAsset {
  id: string;
  type: AidaAssetType;
  name: string;
  title: string;
  sourceTool: AidaSourceTool;
  sourcePath: string;
  source: AidaAssetSource;
  contentHash: string;
  contentExcerpt: string;
  content?: string;
  status: 'active';
  tags: string[];
  signals: string[];
  confidence: AidaConfidence;
  managedByAida: boolean;
  needsModelConfirmation: boolean;
  metadata: Record<string, unknown>;
}

export interface AidaAssetIndex {
  schemaVersion: '3.0';
  generatedAt: string;
  projectRoot: string;
  assets: AidaAsset[];
  summary: Record<AidaAssetType | string, number>;
  signals: {
    duplicateContentGroups: Array<{ hash: string; assetIds: string[] }>;
    unknownDotDirs: string[];
    nextSteps: string[];
  };
}

export interface ScanAssetsOptions {
  includeContent?: boolean;
  writeIndex?: boolean;
  maxFileBytes?: number;
  maxDepthForUnknownDotDirs?: number;
}
