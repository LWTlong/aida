import { resolve } from 'node:path';

export function aidaRoot(projectRoot: string): string {
  return resolve(projectRoot, '.aida');
}

export function aidaCacheDir(projectRoot: string): string {
  return resolve(aidaRoot(projectRoot), 'cache');
}

export function assetIndexPath(projectRoot: string): string {
  return resolve(aidaCacheDir(projectRoot), 'assets-index.json');
}

export function pluginsDir(projectRoot: string): string {
  return resolve(aidaRoot(projectRoot), 'plugins');
}

