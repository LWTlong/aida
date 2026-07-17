import type { DashboardAsset } from './types';

export type PageKey = 'overview' | 'assets' | 'memories' | 'plugin';

export const ASSET_LIMIT = 160;
export const RISK_LABELS = { low: '低风险', medium: '中风险', high: '高风险' } as const;

export function formatTime(value?: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function assetLabel(type: string): string {
  const map: Record<string, string> = {
    all: '全部',
    rule: '规则',
    skill: '技能',
    memory: '决策记忆',
    doc: '文档',
    'mcp-config': 'MCP',
    command: '命令',
    'tool-config': '工具配置',
    plugin: '插件',
  };
  return map[type] || type;
}

export function filterAssets(assets: DashboardAsset[], assetView: string, query: string): DashboardAsset[] {
  const keyword = query.trim().toLowerCase();
  return assets.filter((item) => {
    const matchesType = assetView === 'all' || item.type === assetView;
    if (!matchesType) return false;
    if (!keyword) return true;
    return [item.title, item.type, item.sourceTool, item.sourcePath, item.signals.join(' ')]
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  });
}
