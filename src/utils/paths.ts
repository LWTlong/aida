import { resolve } from 'node:path';

/** Runs directory */
export function runsDir(projectRoot: string = process.cwd()): string {
  return resolve(projectRoot, '.aida', 'runs');
}

/** Branch-level directory (shared PRD, analysis, requirement.json) */
export function branchDir(
  projectRoot: string,
  branchName: string,
): string {
  const safeBranch = branchName.replace(/\//g, '-');
  return resolve(projectRoot, '.aida', 'runs', safeBranch);
}

/** Branch-level requirement.json path */
export function requirementPath(
  projectRoot: string,
  branchName: string,
): string {
  return resolve(branchDir(projectRoot, branchName), 'requirement.json');
}

/** Config file path */
export function configPath(projectRoot: string = process.cwd()): string {
  return resolve(projectRoot, '.aida', 'config.json');
}

/** Local-only MCP bootstrap cache */
export function bootstrapStatePath(projectRoot: string = process.cwd()): string {
  return resolve(projectRoot, '.aida', 'bootstrap-state.local.json');
}

/** Memory root */
export function memoriesDir(projectRoot: string = process.cwd()): string {
  return resolve(projectRoot, '.aida', 'memories');
}

/** Module memory directory */
export function moduleMemoriesDir(projectRoot: string = process.cwd()): string {
  return resolve(memoriesDir(projectRoot), 'modules');
}

/** Module memory index */
export function memoryIndexPath(projectRoot: string = process.cwd()): string {
  return resolve(memoriesDir(projectRoot), 'index.json');
}

/** Stable on-disk name for module memory files */
export function moduleMemoryStorageName(moduleKey: string): string {
  return moduleKey
    .replace(/_/g, '__')
    .replace(/\//g, '_s_');
}

/** Module memory source */
export function moduleMemoryPath(projectRoot: string, moduleKey: string): string {
  return resolve(moduleMemoriesDir(projectRoot), `${moduleMemoryStorageName(moduleKey)}.json`);
}

/** Module memory markdown view */
export function moduleMemoryViewPath(projectRoot: string, moduleKey: string): string {
  return resolve(moduleMemoriesDir(projectRoot), `${moduleMemoryStorageName(moduleKey)}.md`);
}

/** Legacy nested module memory source path */
export function legacyModuleMemoryPath(projectRoot: string, moduleKey: string): string {
  return resolve(moduleMemoriesDir(projectRoot), `${moduleKey}.json`);
}

/** Legacy nested module memory markdown view path */
export function legacyModuleMemoryViewPath(projectRoot: string, moduleKey: string): string {
  return resolve(moduleMemoriesDir(projectRoot), `${moduleKey}.md`);
}

/** Branch-scoped run context source */
export function runContextPath(projectRoot: string, branchName: string): string {
  return resolve(branchDir(projectRoot, branchName), 'context.json');
}

