import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { ensureDir, readJson, readText, writeText } from '../src/utils/fs.js';
import { createTestProject, runCliOutput, readSkillRegistryItems } from './helpers.js';

describe('aida skills list/edit', () => {
  it('should list skills from registry', () => {
    const project = createTestProject();
    try {
      writeText(
        resolve(project.root, '.aida', 'skills.json'),
        JSON.stringify([
          {
            id: 'SKILL-001',
            name: 'team-playbook',
            content: 'Playbook content',
            fingerprint: 'fp-1',
            source: { kind: 'local', path: '.aida/skills/team-playbook/SKILL.md' },
            updatedAt: '2026-04-13T00:00:00.000Z',
            status: 'active',
          },
        ], null, 2),
      );

      const stdout = runCliOutput(project, 'skills list');
      assert.ok(stdout.includes('team-playbook'));
      assert.ok(stdout.includes('SKILL-001'));
    } finally {
      project.cleanup();
    }
  });

  it('should apply edited skill content back to skills.json and rebuild tool skill files', () => {
    const project = createTestProject();
    try {
      writeText(
        resolve(project.root, '.aida', 'skills.json'),
        JSON.stringify([
          {
            id: 'SKILL-001',
            name: 'team-playbook',
            content: 'Old playbook content',
            fingerprint: 'fp-1',
            source: { kind: 'local', path: '.aida/skills/team-playbook/SKILL.md' },
            updatedAt: '2026-04-13T00:00:00.000Z',
            status: 'active',
          },
        ], null, 2),
      );
      ensureDir(resolve(project.root, '.aida', '.edit', 'skills'));
      writeText(resolve(project.root, '.aida', '.edit', 'skills', 'team-playbook.md'), 'New playbook content');

      const stdout = runCliOutput(project, 'skills edit team-playbook --apply');
      const skills = readSkillRegistryItems(project.root);
      const skillView = readText(resolve(project.root, '.claude', 'skills', 'team-playbook.md'));

      assert.ok(stdout.includes('Skill updated'));
      assert.equal(skills[0].content, 'New playbook content');
      assert.ok(skillView.includes('New playbook content'));
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
            name: 'team-playbook',
            content: 'Old playbook content',
            fingerprint: 'fp-1',
            source: { kind: 'local', path: '.aida/skills/team-playbook/SKILL.md' },
            updatedAt: '2026-04-13T00:00:00.000Z',
            status: 'active',
          },
        ], null, 2),
      );
      const inputFile = resolve(project.root, 'playbook-update.md');
      writeText(inputFile, 'Playbook content from explicit file');

      const stdout = runCliOutput(project, `skills edit team-playbook --from-file ${inputFile}`);
      const skills = readSkillRegistryItems(project.root);

      assert.ok(stdout.includes('Skill updated'));
      assert.equal(skills[0].content, 'Playbook content from explicit file');
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
            name: 'team-playbook',
            content: 'Playbook content',
            fingerprint: 'fp-1',
            source: { kind: 'local', path: '.aida/skills/team-playbook/SKILL.md' },
            updatedAt: '2026-04-13T00:00:00.000Z',
            status: 'active',
          },
        ], null, 2),
      );

      const stdout = runCliOutput(project, 'skills list --json');
      const parsed = JSON.parse(stdout);

      assert.equal(parsed.length, 1);
      assert.equal(parsed[0].name, 'team-playbook');
    } finally {
      project.cleanup();
    }
  });
});
