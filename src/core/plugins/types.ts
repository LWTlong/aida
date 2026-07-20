export type PluginRiskLevel = 'low' | 'medium' | 'high';

export interface PluginRiskFinding {
  level: PluginRiskLevel;
  kind: string;
  filePath: string;
  signal: string;
  recommendation: string;
}

export interface PluginRiskReport {
  schemaVersion: '3.0';
  pluginPath: string;
  scannedAt: string;
  level: PluginRiskLevel;
  findings: PluginRiskFinding[];
  summary: string;
  nextSteps: string[];
}

export interface BuildPluginInput {
  name: string;
  description: string;
  version?: string;
  assetIds: string[];
}
