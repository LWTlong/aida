import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';
import { ensureDir, writeJson } from '../src/utils/fs.js';

export interface TestProject {
  root: string;
  branch: string;
  cleanup: () => void;
}

export function createTestProject(opts?: { branch?: string }): TestProject {
  const root = mkdtempSync(join(tmpdir(), 'aida-test-'));
  const branch = opts?.branch || 'test-branch';

  execSync('git init', { cwd: root, stdio: 'ignore' });
  execSync('git config user.name "test"', { cwd: root, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: root, stdio: 'ignore' });
  execSync(`git checkout -b ${branch}`, { cwd: root, stdio: 'ignore' });

  const aidevos = resolve(root, '.aida');
  ensureDir(aidevos);
  writeJson(resolve(aidevos, 'config.json'), {
    schemaVersion: '3.0',
    project: 'test-project',
  });

  return { root, branch, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

export function runCliOutput(project: TestProject, args: string): string {
  const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');
  try {
    return execSync(`node ${cliPath} ${args}`, {
      cwd: project.root, encoding: 'utf-8', stdio: 'pipe',
      env: { ...process.env, HOME: project.root },
    });
  } catch (e: any) {
    return (e.stdout || '') as string;
  }
}
