import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { ensureDir, readJson, readText, writeText } from '../src/utils/fs.js';
import { createTestProject, runCliOutput, runCliWithInput } from './helpers.js';

describe('aida build', () => {
  it('should build requested targets from .aida registries', () => {
    const project = createTestProject();
    try {
      writeText(resolve(project.root, '.aida', 'config.json'), JSON.stringify({
        schemaVersion: '1.0',
        project: 'test-project',
        aiTools: ['codex', 'cursor'],
      }, null, 2));
      writeText(
        resolve(project.root, '.aida', 'rules.json'),
        JSON.stringify([
          {
            id: 'RULE-001',
            category: 'process',
            content: 'Rule A',
            fingerprint: 'fp-rule-a',
            source: { branch: 'main', deviation: null, author: 'test' },
            createdAt: '2026-04-13T00:00:00.000Z',
            status: 'active',
          },
        ], null, 2),
      );
      writeText(
        resolve(project.root, '.aida', 'skills.json'),
        JSON.stringify([
          {
            id: 'SKILL-001',
            name: 'workflow-orchestrator',
            content: 'Workflow content',
            fingerprint: 'fp-skill-a',
            source: { kind: 'bundled', path: 'src/assets/skills/workflow-orchestrator.md' },
            updatedAt: '2026-04-13T00:00:00.000Z',
            status: 'active',
          },
        ], null, 2),
      );
      writeText(resolve(project.root, 'AGENTS.md'), '# Agents\n');
      ensureDir(resolve(project.root, '.cursor'));

      const stdout = runCliOutput(project, 'build codex cursor');

      assert.ok(stdout.includes('AIDA build completed'));
      assert.ok(readText(resolve(project.root, '.codex', 'config.toml')).includes('[mcp_servers.aida]'));
      assert.ok(readText(resolve(project.root, '.cursor', 'skills', 'workflow', 'SKILL.md')).includes('Workflow content'));
      assert.ok(readText(resolve(project.root, '.cursor', 'rules', 'aida', '_all.md')).includes('Rule A'));
      assert.ok(readText(resolve(project.root, '.codex', 'rules', 'aida', '_all.md')).includes('Rule A'));
      const snapshot = readJson<any>(resolve(project.root, '.aida', 'tool-configs.json'));
      assert.ok(Array.isArray(snapshot.snapshots));
      assert.ok(snapshot.snapshots.some((item: any) => item.tool === 'codex'));
      const gitignore = readText(resolve(project.root, '.gitignore'));
      assert.ok(gitignore.includes('.aida/tool-configs.json'));
      assert.ok(gitignore.includes('.aida/**'));
      assert.ok(gitignore.includes('!.aida/**/*.json'));
      assert.ok(gitignore.includes('.cursor/'));
      assert.ok(gitignore.includes('.claude/'));
      assert.ok(gitignore.includes('.codex/config.toml'));
      assert.ok(gitignore.includes('AGENTS.md'));
      assert.ok(gitignore.includes('CLAUDE.md'));
    } finally {
      project.cleanup();
    }
  });

  it('should prompt for tool selection when no targets are passed', () => {
    const project = createTestProject();
    try {
      writeText(resolve(project.root, '.aida', 'config.json'), JSON.stringify({
        schemaVersion: '1.0',
        project: 'test-project',
        aiTools: ['codex', 'cursor'],
      }, null, 2));
      writeText(
        resolve(project.root, '.aida', 'rules.json'),
        JSON.stringify([
          {
            id: 'RULE-001',
            category: 'process',
            content: 'Rule A',
            fingerprint: 'fp-rule-a',
            source: { branch: 'main', deviation: null, author: 'test' },
            createdAt: '2026-04-13T00:00:00.000Z',
            status: 'active',
          },
        ], null, 2),
      );
      writeText(
        resolve(project.root, '.aida', 'skills.json'),
        JSON.stringify([
          {
            id: 'SKILL-001',
            name: 'workflow-orchestrator',
            content: 'Workflow content',
            fingerprint: 'fp-skill-a',
            source: { kind: 'bundled', path: 'src/assets/skills/workflow-orchestrator.md' },
            updatedAt: '2026-04-13T00:00:00.000Z',
            status: 'active',
          },
        ], null, 2),
      );
      writeText(resolve(project.root, 'AGENTS.md'), '# Agents\n');
      ensureDir(resolve(project.root, '.cursor'));

      const stdout = runCliWithInput(project, 'build', '2\n');

      assert.ok(stdout.includes('Select AI tools to build'));
      assert.ok(readText(resolve(project.root, '.cursor', 'skills', 'workflow', 'SKILL.md')).includes('Workflow content'));
      assert.ok(readText(resolve(project.root, '.cursor', 'rules', 'aida', '_all.md')).includes('Rule A'));
    } finally {
      project.cleanup();
    }
  });

  it('should allow selecting supported targets even when they are not configured yet', () => {
    const project = createTestProject();
    try {
      writeText(resolve(project.root, '.aida', 'config.json'), JSON.stringify({
        schemaVersion: '1.0',
        project: 'test-project',
        aiTools: ['claude-code'],
      }, null, 2));
      writeText(
        resolve(project.root, '.aida', 'rules.json'),
        JSON.stringify([
          {
            id: 'RULE-001',
            category: 'process',
            content: 'Rule A',
            fingerprint: 'fp-rule-a',
            source: { branch: 'main', deviation: null, author: 'test' },
            createdAt: '2026-04-13T00:00:00.000Z',
            status: 'active',
          },
        ], null, 2),
      );
      writeText(
        resolve(project.root, '.aida', 'skills.json'),
        JSON.stringify([
          {
            id: 'SKILL-001',
            name: 'workflow-orchestrator',
            content: 'Workflow content',
            fingerprint: 'fp-skill-a',
            source: { kind: 'bundled', path: 'src/assets/skills/workflow-orchestrator.md' },
            updatedAt: '2026-04-13T00:00:00.000Z',
            status: 'active',
          },
        ], null, 2),
      );
      writeText(resolve(project.root, 'AGENTS.md'), '# Agents\n');

      const stdout = runCliWithInput(project, 'build', '2,6\n');

      assert.ok(stdout.includes('Select AI tools to build'));
      assert.ok(stdout.includes('cursor'));
      assert.ok(stdout.includes('codex'));
      assert.ok(readText(resolve(project.root, '.cursor', 'rules', 'aida', '_all.md')).includes('Rule A'));
      assert.ok(readText(resolve(project.root, '.codex', 'config.toml')).includes('[mcp_servers.aida]'));
    } finally {
      project.cleanup();
    }
  });
});
