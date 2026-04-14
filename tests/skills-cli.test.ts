import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { ensureDir, readJson, readText, writeText } from '../src/utils/fs.js';
import { createTestProject, runCliOutput } from './helpers.js';

describe('aida skills list/edit', () => {
  it('should list skills from registry', () => {
    const project = createTestProject();
    try {
      writeText(
        resolve(project.root, '.aida', 'skills.json'),
        JSON.stringify([
          {
            id: 'SKILL-001',
            name: 'workflow-orchestrator',
            content: 'Workflow content',
            fingerprint: 'fp-1',
            source: { kind: 'bundled', path: 'src/assets/skills/workflow-orchestrator.md' },
            updatedAt: '2026-04-13T00:00:00.000Z',
            status: 'active',
          },
        ], null, 2),
      );

      const stdout = runCliOutput(project, 'skills list');
      assert.ok(stdout.includes('workflow-orchestrator'));
      assert.ok(stdout.includes('SKILL-001'));
    } finally {
      project.cleanup();
    }
  });

  it('should apply edited skill content back to skills.json and rebuild views', () => {
    const project = createTestProject();
    try {
      writeText(
        resolve(project.root, '.aida', 'skills.json'),
        JSON.stringify([
          {
            id: 'SKILL-001',
            name: 'workflow-orchestrator',
            content: 'Old workflow content',
            fingerprint: 'fp-1',
            source: { kind: 'bundled', path: 'src/assets/skills/workflow-orchestrator.md' },
            updatedAt: '2026-04-13T00:00:00.000Z',
            status: 'active',
          },
        ], null, 2),
      );
      ensureDir(resolve(project.root, '.aida', '.edit', 'skills'));
      writeText(resolve(project.root, '.aida', '.edit', 'skills', 'workflow-orchestrator.md'), 'New workflow content');

      const stdout = runCliOutput(project, 'skills edit workflow-orchestrator --apply');
      const skills = readJson<any[]>(resolve(project.root, '.aida', 'skills.json'));
      const skillView = readText(resolve(project.root, '.aida', 'skills', 'workflow-orchestrator', 'SKILL.md'));

      assert.ok(stdout.includes('Skill updated'));
      assert.equal(skills[0].content, 'New workflow content');
      assert.ok(skillView.includes('New workflow content'));
    } finally {
      project.cleanup();
    }
  });

  it('should update from an explicit file path', () => {
    const project = createTestProject();
    try {
      writeText(
        resolve(project.root, '.aida', 'skills.json'),
        JSON.stringify([
          {
            id: 'SKILL-001',
            name: 'workflow-orchestrator',
            content: 'Old workflow content',
            fingerprint: 'fp-1',
            source: { kind: 'bundled', path: 'src/assets/skills/workflow-orchestrator.md' },
            updatedAt: '2026-04-13T00:00:00.000Z',
            status: 'active',
          },
        ], null, 2),
      );
      const inputFile = resolve(project.root, 'workflow-update.md');
      writeText(inputFile, 'Workflow content from explicit file');

      const stdout = runCliOutput(project, `skills edit workflow-orchestrator --from-file ${inputFile}`);
      const skills = readJson<any[]>(resolve(project.root, '.aida', 'skills.json'));

      assert.ok(stdout.includes('Skill updated'));
      assert.equal(skills[0].content, 'Workflow content from explicit file');
    } finally {
      project.cleanup();
    }
  });

  it('should output skills as json', () => {
    const project = createTestProject();
    try {
      writeText(
        resolve(project.root, '.aida', 'skills.json'),
        JSON.stringify([
          {
            id: 'SKILL-001',
            name: 'workflow-orchestrator',
            content: 'Workflow content',
            fingerprint: 'fp-1',
            source: { kind: 'bundled', path: 'src/assets/skills/workflow-orchestrator.md' },
            updatedAt: '2026-04-13T00:00:00.000Z',
            status: 'active',
          },
        ], null, 2),
      );

      const stdout = runCliOutput(project, 'skills list --json');
      const parsed = JSON.parse(stdout);

      assert.equal(parsed.length, 1);
      assert.equal(parsed[0].name, 'workflow-orchestrator');
    } finally {
      project.cleanup();
    }
  });
});
