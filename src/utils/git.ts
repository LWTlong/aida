import { execSync } from 'node:child_process';
import { userInfo } from 'node:os';

// ─── Git ─────────────────────────────────────────────────

export function isGitRepo(): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ─── SVN ─────────────────────────────────────────────────

export function isSvnRepo(): boolean {
  try {
    execSync('svn info', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getSvnBranchName(): string {
  try {
    const info = execSync('svn info', { encoding: 'utf-8', stdio: 'pipe' });
    const urlMatch = info.match(/^URL:\s*(.+)$/m);
    if (urlMatch) {
      const url = urlMatch[1].trim();
      // branches/feature-x → feature-x
      const branchMatch = url.match(/\/branches\/([^/]+)/);
      if (branchMatch) return branchMatch[1];
      // trunk → trunk
      if (/\/trunk(\/|$)/.test(url)) return 'trunk';
      // fall back to last path segment
      return url.split('/').filter(Boolean).pop() || 'main';
    }
  } catch { /* ignore */ }
  return 'main';
}

// ─── VCS-agnostic ────────────────────────────────────────

/**
 * Get the current branch / working copy name.
 * Priority: git → svn → AIDA_BRANCH env → "main"
 */
export function getBranchName(): string {
  try {
    const name = execSync('git branch --show-current', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    if (name) return name;
  } catch { /* fall through */ }

  try {
    if (isSvnRepo()) return getSvnBranchName();
  } catch { /* fall through */ }

  return process.env.AIDA_BRANCH || 'main';
}

/**
 * Get the current developer name.
 * Priority: git config user.name → svn Last Changed Author → AIDA_DEV env → OS username
 */
export function getDevName(): string {
  try {
    const name = execSync('git config user.name', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    if (name) return name.toLowerCase().replace(/\s+/g, '-');
  } catch { /* fall through */ }

  try {
    const info = execSync('svn info', { encoding: 'utf-8', stdio: 'pipe' });
    const authorMatch = info.match(/^Last Changed Author:\s*(.+)$/m);
    if (authorMatch) {
      const name = authorMatch[1].trim();
      if (name) return name.toLowerCase().replace(/\s+/g, '-');
    }
  } catch { /* fall through */ }

  const osUser = process.env.AIDA_DEV || userInfo().username;
  return osUser.toLowerCase().replace(/\s+/g, '-');
}
