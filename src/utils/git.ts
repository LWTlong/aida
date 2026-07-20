import { execSync } from 'node:child_process';

export function getBranchName(): string {
  try {
    const name = execSync('git branch --show-current', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    if (name) return name;
  } catch { /* fall through */ }

  try {
    const info = execSync('svn info', { encoding: 'utf-8', stdio: 'pipe' });
    const urlMatch = info.match(/^URL:\s*(.+)$/m);
    if (urlMatch) {
      const url = urlMatch[1].trim();
      const branchMatch = url.match(/\/branches\/([^/]+)/);
      if (branchMatch) return branchMatch[1];
      if (/\/trunk(\/|$)/.test(url)) return 'trunk';
      return url.split('/').filter(Boolean).pop() || 'main';
    }
  } catch { /* fall through */ }

  return process.env.AIDA_BRANCH || 'main';
}
