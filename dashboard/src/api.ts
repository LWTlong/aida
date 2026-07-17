import type {
  BuildPluginResult,
  DashboardAssetIndex,
  DashboardDecision,
  PluginRiskReport,
} from './types';

const BASE = '';

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init);
  if (!response.ok) {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { error?: string };
      throw new Error(parsed.error || `请求失败：${response.status}`);
    } catch {
      throw new Error(text || `请求失败：${response.status}`);
    }
  }
  return response.json();
}

export function buildSelfPlugin(version?: string): Promise<{ outputPath: string; skills: string[]; files: number }> {
  return fetchJson('/api/plugin/build-self', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: version || '3.0.0' }),
  });
}

export function fetchDecisions(): Promise<{ decisions: DashboardDecision[] }> {
  return fetchJson('/api/decisions');
}

export function fetchAssets(): Promise<DashboardAssetIndex> {
  return fetchJson('/api/assets');
}

export function scanAssets(): Promise<DashboardAssetIndex> {
  return fetchJson('/api/scan', { method: 'POST' });
}

export async function auditPlugin(path: string): Promise<PluginRiskReport> {
  const data = await fetchJson<{ risk: PluginRiskReport }>('/api/plugin/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  return data.risk;
}

export function buildPlugin(input: {
  name: string;
  description: string;
  version?: string;
  assetIds: string[];
}): Promise<BuildPluginResult> {
  return fetchJson('/api/plugin/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
