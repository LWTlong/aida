import { ensureDir, fileExists, readJson, writeJson } from '../../utils/fs.js';
import { assetIndexPath, aidaCacheDir } from './paths.js';
import type { AidaAssetIndex } from './types.js';

export function saveAssetIndex(projectRoot: string, index: AidaAssetIndex): void {
  ensureDir(aidaCacheDir(projectRoot));
  writeJson(assetIndexPath(projectRoot), index);
}

export function loadAssetIndex(projectRoot: string): AidaAssetIndex | null {
  const path = assetIndexPath(projectRoot);
  if (!fileExists(path)) return null;
  try {
    return readJson<AidaAssetIndex>(path);
  } catch {
    return null;
  }
}
