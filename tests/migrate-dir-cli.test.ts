import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { ensureDir, fileExists, readJson, readText, writeJson, writeText } from '../src/utils/fs.js';

describe('aida migrate-dir', () => {
  it('should rename .aidevos to .aida and update references', () => {
    const root = mkdtempSync(join(tmpdir(), 'aida-migrate-dir-'));
    const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');

    try {
      ensureDir(resolve(root, '.aidevos', 'rules'));
      writeJson(resolve(root, '.aidevos', 'config.json'), {
        schemaVersion: '1.0',
        project: 'legacy-project',
        aiTools: ['cursor'],
      });
      writeText(resolve(root, '.aidevos', 'rules', '_all.md'), '# Rules\n\n- use .aidevos paths\n');
      writeText(resolve(root, 'AGENTS.md'), 'Read .aidevos/aida-guide.md first\n');
      writeText(resolve(root, '.gitignore'), '.aidevos/rules/*.md\n');

      const output = execSync(`node ${cliPath} migrate-dir`, {
        cwd: root,
        encoding: 'utf-8',
        stdio: 'pipe',
        env: { ...process.env, HOME: root },
      });

      assert.ok(output.includes('Directory renamed'));
      assert.equal(fileExists(resolve(root, '.aidevos')), false);
      assert.equal(fileExists(resolve(root, '.aida')), true);
      assert.equal(readJson<any>(resolve(root, '.aida', 'config.json')).project, 'legacy-project');
      assert.ok(readText(resolve(root, '.aida', 'rules', '_all.md')).includes('.aida'));
      assert.ok(readText(resolve(root, 'AGENTS.md')).includes('.aida/aida-guide.md'));
      assert.ok(readText(resolve(root, '.gitignore')).includes('.aida/rules/*.md'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should no-op when project already uses .aida', () => {
    const root = mkdtempSync(join(tmpdir(), 'aida-migrate-dir-'));
    const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');

    try {
      ensureDir(resolve(root, '.aida'));
      const output = execSync(`node ${cliPath} migrate-dir`, {
        cwd: root,
        encoding: 'utf-8',
        stdio: 'pipe',
        env: { ...process.env, HOME: root },
      });

      assert.ok(output.includes('already uses .aida'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
