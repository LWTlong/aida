import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { ensureDir, readJson, writeJson, writeText } from '../src/utils/fs.js';
import { createTestProject, readMemoryIndex, readRegistryItems, runCliOutput } from './helpers.js';

describe('aida doctor', () => {
  it('should inspect legacy truth sources and normalize them with --fix', () => {
    const project = createTestProject();

    try {
      ensureDir(resolve(project.root, '.aida', 'memories', 'modules', 'auth'));
      writeJson(resolve(project.root, '.aida', 'rules.json'), [
        {
          id: 'RULE-001',
          category: 'process',
          content: 'legacy rule',
          fingerprint: 'fp-rule-1',
          source: { branch: 'main', deviation: null, author: 'test' },
          createdAt: '2026-05-01T10:00:00.000Z',
          status: 'active',
        },
      ]);
      writeJson(resolve(project.root, '.aida', 'skills.json'), [
        {
          id: 'SKILL-001',
          name: 'legacy-skill',
          content: 'legacy skill',
          fingerprint: 'fp-skill-1',
          source: { kind: 'local', path: '.aida/skills/legacy-skill/SKILL.md' },
          updatedAt: '2026-05-01T10:00:00.000Z',
          status: 'active',
        },
      ]);
      writeJson(resolve(project.root, '.aida', 'memories', 'index.json'), {
        updatedAt: '2026-05-01T10:00:00.000Z',
        modules: [
          {
            key: 'auth/login',
            title: 'Auth Login',
            summary: 'legacy',
            keywords: ['auth'],
            paths: ['src/auth/login.ts'],
            updatedAt: '2026-05-01T10:00:00.000Z',
          },
        ],
      });
      writeJson(resolve(project.root, '.aida', 'memories', 'modules', 'auth', 'login.json'), {
        moduleKey: 'auth/login',
        title: 'Auth Login',
        summary: 'legacy auth memory',
        keywords: ['auth'],
        entryFiles: ['src/auth/login.ts'],
        relatedPaths: [],
        dataFlow: [],
        decisions: [],
        constraints: [],
        pitfalls: [],
        relatedRules: [],
        tickets: [],
        updatedAt: '2026-05-01T10:00:00.000Z',
      });
      writeText(resolve(project.root, '.aida', 'summary.json'), '');

      const stdout = runCliOutput(project, 'doctor --fix');

      assert.ok(stdout.includes('Normalized truth sources'));
      assert.ok(stdout.includes('Project health looks good'));

      const rulesRaw = readJson<any>(resolve(project.root, '.aida', 'rules.json'));
      const skillsRaw = readJson<any>(resolve(project.root, '.aida', 'skills.json'));
      const memoryIndex = readMemoryIndex(project.root);
      const summary = readRegistryItems<any>(resolve(project.root, '.aida', 'summary.json'));

      assert.equal(rulesRaw.schemaVersion, '2.0');
      assert.ok(Array.isArray(rulesRaw.items));
      assert.equal(skillsRaw.schemaVersion, '2.0');
      assert.ok(Array.isArray(skillsRaw.items));
      assert.equal(memoryIndex.schemaVersion, '2.0');
      assert.ok(Array.isArray(memoryIndex.items));
      assert.equal(summary.length, 1);
      assert.equal(summary[0].branch, project.branch);
      assert.equal(summary[0].modules.length, 0);
      assert.equal(summary[0].highlights.length, 0);
    } finally {
      project.cleanup();
    }
  });

  it('should report potential duplicate rules without mutating the registry', () => {
    const project = createTestProject();

    try {
      writeJson(resolve(project.root, '.aida', 'rules.json'), {
        schemaVersion: '2.0',
        updatedAt: '2026-05-01T10:00:00.000Z',
        items: [
          {
            id: 'RULE-001',
            category: 'process',
            content: '提交前必须运行相关测试并确认通过',
            fingerprint: 'fp-rule-1',
            source: { branch: 'main', deviation: null, author: 'test' },
            createdAt: '2026-05-01T10:00:00.000Z',
            status: 'active',
          },
          {
            id: 'RULE-002',
            category: 'process',
            content: '提交代码前先执行相关测试并确保通过',
            fingerprint: 'fp-rule-2',
            source: { branch: 'main', deviation: null, author: 'test' },
            createdAt: '2026-05-01T10:01:00.000Z',
            status: 'active',
          },
        ],
      });

      const before = readJson<any>(resolve(project.root, '.aida', 'rules.json'));
      const stdout = runCliOutput(project, 'doctor');
      const after = readJson<any>(resolve(project.root, '.aida', 'rules.json'));

      assert.ok(stdout.includes('rule duplicates: 1 potential pair(s)'));
      assert.ok(stdout.includes('Potential duplicate rules (1)'));
      assert.ok(stdout.includes('RULE-001 ↔ RULE-002'));
      assert.deepEqual(after, before);
    } finally {
      project.cleanup();
    }
  });
});
