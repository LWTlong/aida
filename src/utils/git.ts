import { execSync } from 'node:child_process';

export function getBranchName(): string {
  return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
}

export function getDevName(): string {
  const name = execSync('git config user.name', { encoding: 'utf-8' }).trim();
  return name.toLowerCase().replace(/\s+/g, '-');
}

export function isGitRepo(): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}
