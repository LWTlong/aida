import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { ensureDir, fileExists, readJson, readText, writeJson, writeText } from '../src/utils/fs.js';

describe('aida migrate-legacy', () => {
  it('should migrate a legacy project in one command', () => {
    const root = mkdtempSync(join(tmpdir(), 'aida-migrate-legacy-'));
    const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');

    try {
      ensureDir(resolve(root, '.aidevos', 'rules'));
      ensureDir(resolve(root, '.aidevos', 'runs', 'feature-big', 'tester'));
      ensureDir(resolve(root, '.cursor', 'rules'));
      ensureDir(resolve(root, '.cursor', 'skills', 'custom-flow'));

      writeJson(resolve(root, '.aidevos', 'config.json'), {
        schemaVersion: '1.0',
        project: 'legacy-project',
        aiTools: ['cursor', 'codex'],
      });
      writeText(resolve(root, '.aidevos', 'rules', '_all.md'), '# Rules\n\n- use .aidevos paths\n');
      writeText(resolve(root, 'AGENTS.md'), 'Read .aidevos/aida-guide.md first\n');
      writeText(resolve(root, '.gitignore'), '.aidevos/rules/*.md\n');
      writeText(resolve(root, '.cursor', 'rules', 'team.md'), '# Team Rules\n\n- Imported cursor rule\n');
      writeText(resolve(root, '.cursor', 'skills', 'custom-flow', 'SKILL.md'), '# Custom Flow\n\nImported from cursor\n');
      writeText(
        resolve(root, '.cursor', 'mcp.json'),
        JSON.stringify({ mcpServers: { aida: { command: 'npx', args: ['--registry=https://registry.npmjs.org/', '-y', 'ai-dev-analytics', 'mcp'] } } }, null, 2),
      );

      writeJson(resolve(root, '.aidevos', 'runs', 'feature-big', 'tester', 'run.json'), {
        meta: {
          runId: 'feature-big',
          project: 'legacy-project',
          developer: 'tester',
          branch: 'feature-big',
          startTime: '2026-04-01T00:00:00.000Z',
          status: 'running',
          prdPhases: [],
        },
        summary: {},
        tasks: [],
        bugs: [{ id: 'BUG-01', title: 'Old bug', severity: 'medium', source: 'self-review' }],
        deviations: [],
        reviews: [],
        rules: [],
        files: [
          { path: 'src/features/big/index.tsx', changeType: 'modified', linesAdded: 30, linesRemoved: 8, changeCount: 1 },
        ],
        timeline: [],
        workflow: [],
        events: [],
      });
      writeJson(resolve(root, '.aidevos', 'runs', 'feature-big', 'requirement.json'), {
        branch: 'feature-big',
        title: 'MTR-001 大需求改造',
        summary: '沉淀旧项目大需求的上下文信息。',
        prdPhases: [],
        modules: [
          { id: 'MOD-01', name: '首页', description: '首页聚合区改造', assignee: 'tester' },
        ],
        highlights: [],
        developers: [],
        totals: { tasks: 0, completedTasks: 0, bugs: 0, deviations: 0, linesAdded: 0, linesRemoved: 0, totalTokens: 0 },
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      });
      writeText(resolve(root, '.aidevos', 'runs', 'feature-big', 'analysis.md'), '# 需求概述\n\n沉淀旧首页模块上下文。\n');

      const output = execSync(`node ${cliPath} migrate-legacy cursor`, {
        cwd: root,
        encoding: 'utf-8',
        stdio: 'pipe',
        env: { ...process.env, HOME: root },
      });

      assert.ok(output.includes('Legacy migration completed'));
      assert.ok(output.includes('git rm --cached .mcp.json AGENTS.md CLAUDE.md'));
      assert.equal(fileExists(resolve(root, '.aidevos')), false);
      assert.equal(fileExists(resolve(root, '.aida')), true);
      assert.ok(readText(resolve(root, 'AGENTS.md')).includes('## AIDA'));
      assert.ok(readText(resolve(root, 'AGENTS.md')).includes('.aida/aida-guide.md'));
      assert.ok(readText(resolve(root, 'AGENTS.md')).includes('.aida/rules/_all.md'));
      assert.ok(readText(resolve(root, '.gitignore')).includes('.cursor/'));
      assert.ok(readText(resolve(root, '.gitignore')).includes('.codex/config.toml'));
      assert.ok(fileExists(resolve(root, '.cursor', 'rules', 'aida', 'aida-guide.md')));

      const rules = readJson<any[]>(resolve(root, '.aida', 'rules.json'));
      const skills = readJson<any[]>(resolve(root, '.aida', 'skills.json'));
      const migratedRun = readJson<any>(resolve(root, '.aida', 'runs', 'feature-big', 'tester', 'run.json'));

      assert.ok(rules.some((entry) => entry.content === 'Imported cursor rule'));
      assert.ok(skills.some((entry) => entry.name === 'custom-flow'));
      assert.equal(migratedRun.meta.schemaVersion, '2.0');
      assert.ok(Array.isArray(migratedRun.highlights));
      assert.ok(fileExists(resolve(root, '.cursor', 'rules', 'aida', '_all.md')));
      assert.ok(fileExists(resolve(root, '.aida', 'runs', 'feature-big', 'context.json')));
      assert.ok(fileExists(resolve(root, '.aida', 'runs', 'feature-big', 'context.md')));
      assert.ok(fileExists(resolve(root, '.aida', 'memories', 'modules', '首页.json')));
      assert.ok(fileExists(resolve(root, '.aida', 'memories', 'modules', '首页.md')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should fail fast on an invalid baseline tool argument', () => {
    const root = mkdtempSync(join(tmpdir(), 'aida-migrate-legacy-'));
    const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');

    try {
      ensureDir(resolve(root, '.aidevos'));
      writeJson(resolve(root, '.aidevos', 'config.json'), {
        schemaVersion: '1.0',
        project: 'legacy-project',
        aiTools: ['cursor'],
      });

      const output = execSync(`node ${cliPath} migrate-legacy unknown-tool`, {
        cwd: root,
        encoding: 'utf-8',
        stdio: 'pipe',
        env: { ...process.env, HOME: root },
      });

      assert.ok(output.includes('Unknown baseline tool'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should reject baseline tools that are not closed-loop for migrate-legacy', () => {
    const root = mkdtempSync(join(tmpdir(), 'aida-migrate-legacy-'));
    const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');

    try {
      ensureDir(resolve(root, '.aidevos'));
      writeJson(resolve(root, '.aidevos', 'config.json'), {
        schemaVersion: '1.0',
        project: 'legacy-project',
        aiTools: ['lingma'],
      });

      const output = execSync(`node ${cliPath} migrate-legacy lingma`, {
        cwd: root,
        encoding: 'utf-8',
        stdio: 'pipe',
        env: { ...process.env, HOME: root },
      });

      assert.ok(output.includes('Unknown baseline tool: lingma'));
      assert.ok(output.includes('claude-code, cursor, codex'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should auto-select a baseline tool without waiting for interactive input', () => {
    const root = mkdtempSync(join(tmpdir(), 'aida-migrate-legacy-'));
    const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');

    try {
      ensureDir(resolve(root, '.aidevos', 'rules'));
      ensureDir(resolve(root, '.cursor', 'rules'));
      ensureDir(resolve(root, '.codex', 'rules'));
      writeJson(resolve(root, '.aidevos', 'config.json'), {
        schemaVersion: '1.0',
        project: 'legacy-project',
        aiTools: ['cursor', 'codex'],
      });
      writeText(resolve(root, 'AGENTS.md'), 'Read .aidevos/aida-guide.md first\n');
      writeText(resolve(root, '.cursor', 'rules', 'team.md'), '# Team Rules\n\n- Imported cursor rule\n');
      writeText(resolve(root, '.codex', 'rules', 'team.md'), '# Codex Rules\n\n- Imported codex rule\n');
      writeText(
        resolve(root, '.cursor', 'mcp.json'),
        JSON.stringify({ mcpServers: { aida: { command: 'npx', args: ['--registry=https://registry.npmjs.org/', '-y', 'ai-dev-analytics', 'mcp'] } } }, null, 2),
      );

      const output = execSync(`node ${cliPath} migrate-legacy`, {
        cwd: root,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 10000,
        env: { ...process.env, HOME: root },
      });

      assert.ok(output.includes('Legacy migration completed'));
      assert.ok(output.includes('Auto-selected baseline: Cursor'));
      assert.ok(output.includes('git rm --cached .mcp.json AGENTS.md CLAUDE.md'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should rebuild missing generated artifacts when migrate-legacy is re-run on an already-current project', () => {
    const root = mkdtempSync(join(tmpdir(), 'aida-migrate-legacy-rerun-'));
    const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');

    try {
      ensureDir(resolve(root, '.aida', 'rules'));
      ensureDir(resolve(root, '.cursor', 'rules'));
      ensureDir(resolve(root, '.codex', 'rules'));
      writeJson(resolve(root, '.aida', 'config.json'), {
        schemaVersion: '1.0',
        project: 'legacy-project',
        aiTools: ['cursor', 'codex'],
      });
      writeJson(resolve(root, '.aida', 'rules.json'), [
        {
          id: 'RULE-001',
          category: 'process',
          content: '禁止任何形式的臆想，不清楚必须询问',
          fingerprint: 'fp-rule-1',
          source: { branch: 'main', deviation: null, author: 'test' },
          createdAt: '2026-04-01T00:00:00.000Z',
          status: 'active',
        },
      ]);
      writeJson(resolve(root, '.aida', 'skills.json'), []);
      writeText(resolve(root, 'AGENTS.md'), 'Read .aida/aida-guide.md first\n');
      writeText(resolve(root, '.cursor', 'rules', 'team.md'), '# Team Rules\n\n- Imported cursor rule\n');
      writeText(resolve(root, '.codex', 'rules', 'team.md'), '# Codex Rules\n\n- Imported codex rule\n');
      writeText(
        resolve(root, '.cursor', 'mcp.json'),
        JSON.stringify({ mcpServers: { aida: { command: 'npx', args: ['--registry=https://registry.npmjs.org/', '-y', 'ai-dev-analytics', 'mcp'] } } }, null, 2),
      );

      rmSync(resolve(root, 'AGENTS.md'), { force: true });
      rmSync(resolve(root, '.codex', 'config.toml'), { force: true });
      rmSync(resolve(root, '.aida', 'rules', '_all.md'), { force: true });
      rmSync(resolve(root, '.cursor', 'rules', 'aida'), { recursive: true, force: true });
      writeText(resolve(root, '.gitignore'), '# reset\n');

      const output = execSync(`node ${cliPath} migrate-legacy`, {
        cwd: root,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 10000,
        env: { ...process.env, HOME: root },
      });

      assert.ok(output.includes('Project already uses .aida'));
      assert.ok(output.includes('Legacy migration completed'));
      assert.equal(fileExists(resolve(root, 'AGENTS.md')), true);
      assert.equal(fileExists(resolve(root, '.codex', 'config.toml')), true);
      assert.equal(fileExists(resolve(root, '.aida', 'rules', '_all.md')), true);
      assert.equal(fileExists(resolve(root, '.cursor', 'rules', 'aida', '_all.md')), true);
      assert.ok(readText(resolve(root, 'AGENTS.md')).includes('.codex/rules/aida/_all.md'));
      assert.ok(readText(resolve(root, '.gitignore')).includes('.codex/config.toml'));
      assert.ok(readText(resolve(root, '.gitignore')).includes('.cursor/'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
