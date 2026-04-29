import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { fileExists, readJson, readText, writeText } from '../src/utils/fs.js';

describe('aida init', () => {
  it('should initialize selected tools and build matching rule chain artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'aida-init-'));
    const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');
    try {
      const stdout = execSync(`node ${cliPath} init`, {
        cwd: root,
        encoding: 'utf-8',
        stdio: 'pipe',
        input: '2\n2,6\n\n\n',
        env: { ...process.env, HOME: root },
      });

      assert.ok(stdout.includes('AIDA'));
      assert.ok(readJson<any>(resolve(root, '.aida', 'config.json')).aiTools.includes('cursor'));
      assert.ok(readJson<any>(resolve(root, '.aida', 'config.json')).aiTools.includes('codex'));
      assert.ok(readText(resolve(root, '.aida', 'aida-guide.md')).includes('.aida/rules/_all.md'));
      assert.ok(readText(resolve(root, '.aida', 'aida-guide.md')).includes('只有当修改实际落到项目仓库代码或配置后，才进入 AIDA task flow'));
      assert.ok(readText(resolve(root, '.aida', 'rules', '_all.md')).includes('All Project Rules'));
      assert.ok(readText(resolve(root, '.aida', 'rules.json')).includes('纯调查、只读分析、聊天、git 历史排查、本地环境操作、不会落库的实验都不记录 task/context/memory'));
      assert.ok(readText(resolve(root, '.cursor', 'rules', 'aida', '_all.md')).includes('All Project Rules'));
      assert.ok(readText(resolve(root, 'AGENTS.md')).includes('## AIDA'));
      assert.ok(readText(resolve(root, 'AGENTS.md')).includes('.codex/rules/aida/_all.md'));
      assert.ok(readText(resolve(root, '.codex', 'config.toml')).includes('[mcp_servers.aida]'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should repair missing generated files when init is re-run on an existing project', () => {
    const root = mkdtempSync(join(tmpdir(), 'aida-init-repair-'));
    const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');
    try {
      execSync(`node ${cliPath} init`, {
        cwd: root,
        encoding: 'utf-8',
        stdio: 'pipe',
        input: '2\n2,6\n\n\n',
        env: { ...process.env, HOME: root },
      });

      rmSync(resolve(root, 'AGENTS.md'), { force: true });
      rmSync(resolve(root, '.codex', 'config.toml'), { force: true });
      rmSync(resolve(root, '.aida', 'rules', '_all.md'), { force: true });
      rmSync(resolve(root, '.cursor', 'rules', 'aida', '_all.md'), { force: true });
      writeText(resolve(root, '.gitignore'), '# reset\n');

      const stdout = execSync(`node ${cliPath} init`, {
        cwd: root,
        encoding: 'utf-8',
        stdio: 'pipe',
        input: '2\n',
        env: { ...process.env, HOME: root },
      });

      assert.ok(stdout.includes('Repairing'));
      assert.equal(fileExists(resolve(root, 'AGENTS.md')), true);
      assert.equal(fileExists(resolve(root, '.codex', 'config.toml')), true);
      assert.equal(fileExists(resolve(root, '.aida', 'rules', '_all.md')), true);
      assert.equal(fileExists(resolve(root, '.cursor', 'rules', 'aida', '_all.md')), true);
      assert.ok(readText(resolve(root, 'AGENTS.md')).includes('.codex/rules/aida/_all.md'));
      assert.ok(readText(resolve(root, '.aida', 'aida-guide.md')).includes('git blame'));
      assert.ok(readText(resolve(root, '.gitignore')).includes('.codex/config.toml'));
      assert.ok(readText(resolve(root, '.gitignore')).includes('.cursor/'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
