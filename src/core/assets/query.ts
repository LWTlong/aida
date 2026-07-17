import { scanAssets } from './scanner.js';
import { loadAssetIndex } from './store.js';
import type { AidaAsset, AidaAssetType, AidaSourceTool } from './types.js';

export interface AssetQuery {
  type?: AidaAssetType;
  sourceTool?: AidaSourceTool;
  query?: string;
  includeContent?: boolean;
  rescan?: boolean;
  limit?: number;
}

function currentAssets(projectRoot: string, includeContent = false, rescan = false): AidaAsset[] {
  if (rescan) return scanAssets(projectRoot, { includeContent, writeIndex: true }).assets;
  const index = loadAssetIndex(projectRoot) || scanAssets(projectRoot, { includeContent, writeIndex: true });
  if (includeContent && index.assets.some((asset) => asset.content === undefined)) {
    return scanAssets(projectRoot, { includeContent: true, writeIndex: true }).assets;
  }
  return index.assets;
}

export function listAssets(projectRoot: string, query: AssetQuery = {}): AidaAsset[] {
  let assets = currentAssets(projectRoot, query.includeContent, query.rescan);

  if (query.type) assets = assets.filter((asset) => asset.type === query.type);
  if (query.sourceTool) assets = assets.filter((asset) => asset.sourceTool === query.sourceTool);
  if (query.query) {
    const q = query.query.toLowerCase();
    assets = assets.filter((asset) =>
      [asset.name, asset.title, asset.sourcePath, asset.contentExcerpt, asset.content || '']
        .some((v) => v.toLowerCase().includes(q))
    );
  }
  return assets.slice(0, query.limit || assets.length);
}

export function getAsset(projectRoot: string, id: string, includeContent = true): AidaAsset | null {
  return currentAssets(projectRoot, includeContent, false).find((asset) => asset.id === id) || null;
}
