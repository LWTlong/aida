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
        JSON.stringify({ mcpServers: { aida: { command: 'npx', args: ['-y', 'ai-dev-analytics', 'mcp'] } } }, null, 2),
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
        files: [],
        timeline: [],
        workflow: [],
        events: [],
      });

      const output = execSync(`node ${cliPath} migrate-legacy cursor`, {
        cwd: root,
        encoding: 'utf-8',
        stdio: 'pipe',
        env: { ...process.env, HOME: root },
      });

      assert.ok(output.includes('Legacy migration completed'));
      assert.equal(fileExists(resolve(root, '.aidevos')), false);
      assert.equal(fileExists(resolve(root, '.aida')), true);
      assert.ok(readText(resolve(root, 'AGENTS.md')).includes('.aida/aida-guide.md'));
      assert.ok(readText(resolve(root, '.gitignore')).includes('.cursor/skills/'));
      assert.ok(fileExists(resolve(root, '.cursor', 'rules', 'aida', 'aida-guide.md')));

      const rules = readJson<any[]>(resolve(root, '.aida', 'rules.json'));
      const skills = readJson<any[]>(resolve(root, '.aida', 'skills.json'));
      const migratedRun = readJson<any>(resolve(root, '.aida', 'runs', 'feature-big', 'tester', 'run.json'));

      assert.ok(rules.some((entry) => entry.content === 'Imported cursor rule'));
      assert.ok(skills.some((entry) => entry.name === 'custom-flow'));
      assert.equal(migratedRun.meta.schemaVersion, '2.0');
      assert.ok(Array.isArray(migratedRun.highlights));
      assert.ok(fileExists(resolve(root, '.aida', 'rules', '_all.md')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
