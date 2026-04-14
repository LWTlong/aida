import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** AIDevOS package root */
export const PACKAGE_ROOT = resolve(__dirname, '..', '..');

/** Bundled assets directory */
export const ASSETS_DIR = resolve(PACKAGE_ROOT, 'src', 'assets');

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
