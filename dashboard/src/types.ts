export interface DashboardAsset {
  id: string;
  type: string;
  name: string;
  title: string;
  sourceTool: string;
  sourcePath: string;
  confidence: 'high' | 'medium' | 'low';
  signals: string[];
  contentExcerpt?: string;
  metadata?: Record<string, unknown>;
}

export interface DashboardAssetIndex {
  schemaVersion: string;
  generatedAt: string;
  projectRoot: string;
  assets: DashboardAsset[];
  summary: Record<string, number>;
  signals: {
    duplicateContentGroups: Array<{ hash: string; assetIds: string[] }>;
    unknownDotDirs: string[];
    nextSteps: string[];
  };
}

export interface DashboardDecision {
  slug: string;
  title: string;
  paths?: string[];
  status: 'accepted' | 'deprecated' | 'superseded';
  date: string;
  tags?: string[];
  context: string;
  decision: string;
  consequences?: string;
  filePath: string;
}

export interface PluginRiskFinding {
  level: 'low' | 'medium' | 'high';
  kind: string;
  filePath: string;
  signal: string;
  recommendation: string;
}

export interface PluginRiskReport {
  schemaVersion: string;
  pluginPath: string;
  scannedAt: string;
  level: 'low' | 'medium' | 'high';
  findings: PluginRiskFinding[];
  summary: string;
  nextSteps: string[];
}

export interface BuildPluginResult {
  success: boolean;
  outputPath: string;
  filesWritten: string[];
  message: string;
}
