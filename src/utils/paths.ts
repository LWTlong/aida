import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** AIDevOS package root */
export const PACKAGE_ROOT = resolve(__dirname, '..', '..');

/** Bundled assets directory */
export const ASSETS_DIR = existsSync(resolve(PACKAGE_ROOT, 'src', 'assets'))
  ? resolve(PACKAGE_ROOT, 'src', 'assets')
  : resolve(PACKAGE_ROOT, '..', 'src', 'assets');

/** Bundled skill files */
export const SKILLS_DIR = resolve(ASSETS_DIR, 'skills');

/** Bundled template files */
export const TEMPLATES_DIR = resolve(ASSETS_DIR, 'templates');

/** Dashboard HTML file */
export const DASHBOARD_FILE = resolve(PACKAGE_ROOT, 'src', 'dashboard', 'index.html');

/** .aida directory in user's project */
export function aidaDir(projectRoot: string = process.cwd()): string {
  return resolve(projectRoot, '.aida');
}

/** Runs directory */
export function runsDir(projectRoot: string = process.cwd()): string {
  return resolve(projectRoot, '.aida', 'runs');
}

/** Run data directory for a specific branch + developer */
export function runDir(
  projectRoot: string,
  branchName: string,
  devName: string,
): string {
  const safeBranch = branchName.replace(/\//g, '-');
  return resolve(projectRoot, '.aida', 'runs', safeBranch, devName);
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

/** Project-level index.json path */
export function indexPath(projectRoot: string = process.cwd()): string {
  return resolve(projectRoot, '.aida', 'index.json');
}

/** Config file path */
export function configPath(projectRoot: string = process.cwd()): string {
  return resolve(projectRoot, '.aida', 'config.json');
}

/** Project rule registry */
export function rulesRegistryPath(projectRoot: string = process.cwd()): string {
  return resolve(projectRoot, '.aida', 'rules.json');
}

/** Project skill registry */
export function skillsRegistryPath(projectRoot: string = process.cwd()): string {
  return resolve(projectRoot, '.aida', 'skills.json');
}

/** Imported tool config source */
export function toolConfigStorePath(projectRoot: string = process.cwd()): string {
  return resolve(projectRoot, '.aida', 'tool-configs.json');
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

/** Module memory source */
export function moduleMemoryPath(projectRoot: string, moduleKey: string): string {
  return resolve(moduleMemoriesDir(projectRoot), `${moduleKey}.json`);
}

/** Module memory markdown view */
export function moduleMemoryViewPath(projectRoot: string, moduleKey: string): string {
  return resolve(moduleMemoriesDir(projectRoot), `${moduleKey}.md`);
}

/** Branch-scoped run context source */
export function runContextPath(projectRoot: string, branchName: string): string {
  return resolve(branchDir(projectRoot, branchName), 'context.json');
}

/** Branch-scoped run context markdown view */
export function runContextViewPath(projectRoot: string, branchName: string): string {
  return resolve(branchDir(projectRoot, branchName), 'context.md');
}

/** Branch-scoped aggregated memory pack markdown view */
export function runMemoryPackViewPath(projectRoot: string, branchName: string): string {
  return resolve(branchDir(projectRoot, branchName), 'memory.md');
}
