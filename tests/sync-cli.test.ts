import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { ensureDir, readJson, readText, writeText } from '../src/utils/fs.js';
import { createTestProject, readMemoryIndex, readRegistryItems, runCliOutput } from './helpers.js';

describe('aida sync', () => {
  it('should rebuild memory views, summary, and tool artifacts in one command', () => {
    const project = createTestProject({
      branch: 'feature-login',
      runData: {
        meta: {
          schemaVersion: '2.0',
          runId: 'feature-login',
          project: 'test-project',
          developer: 'test-dev',
          branch: 'feature-login',
          aiModel: 'claude',
          aiTool: 'claude-code',
          startTime: '2026-04-30T10:00:00.000Z',
          status: 'running',
          prdPhases: [],
        },
        summary: {
          totalTasks: 2,
          completedTasks: 1,
          bugCount: 0,
          deviationCount: 0,
          reviewCount: 0,
          reviewPassCount: 0,
          reviewFailCount: 0,
          rulesSedimented: 0,
          prdPhaseCount: 0,
          filesChanged: 2,
          linesAdded: 20,
          linesRemoved: 4,
        },
        workflow: [],
        tasks: [
          { taskId: 'TASK-01', title: '登录表单重构', stageName: '登录', prdPhase: '', status: 'done' },
          { taskId: 'TASK-02', title: '接入滑块校验', stageName: '登录', prdPhase: '', status: 'in-progress' },
        ],
        bugs: [],
        deviations: [],
        reviews: [],
        files: [
          { path: 'src/pages/login/index.tsx', changeType: 'modified', linesAdded: 18, linesRemoved: 2, changeCount: 1 },
          { path: 'src/services/login.ts', changeType: 'modified', linesAdded: 2, linesRemoved: 2, changeCount: 1 },
        ],
        metrics: {},
        timeline: [],
        events: [],
        rules: [],
        context: { currentStage: 'Login', currentTaskId: 'TASK-02', lastUpdated: '2026-04-30T10:30:00.000Z' },
        cost: { totalTokens: 0, estimatedManualHours: 0, actualHours: 0, tokenBreakdown: [] },
        highlights: [{ content: '登录页结构已稳定', source: 'auto', createdAt: '2026-04-30T10:20:00.000Z' }],
      },
    });

    try {
      writeText(resolve(project.root, '.aida', 'config.json'), JSON.stringify({
        schemaVersion: '1.0',
        project: 'test-project',
        aiTools: ['codex'],
      }, null, 2));
      writeText(resolve(project.root, '.aida', 'rules.json'), JSON.stringify([
        {
          id: 'RULE-001',
          category: 'process',
          content: 'Do login safely',
          fingerprint: 'fp-rule-login',
          source: { branch: 'main', deviation: null, author: 'test' },
          createdAt: '2026-04-30T10:00:00.000Z',
          status: 'active',
        },
      ], null, 2));
      writeText(resolve(project.root, '.aida', 'skills.json'), JSON.stringify([
        {
          id: 'SKILL-001',
          name: 'team-playbook',
          content: 'Playbook content',
          fingerprint: 'fp-skill-a',
          source: { kind: 'local', path: '.aida/skills/team-playbook/SKILL.md' },
          updatedAt: '2026-04-30T10:00:00.000Z',
          status: 'active',
        },
      ], null, 2));
      writeText(resolve(project.root, 'AGENTS.md'), '# Agents\n');
      ensureDir(resolve(project.root, '.aida', 'runs', 'feature-login'));
      writeText(resolve(project.root, '.aida', 'runs', 'feature-login', 'analysis.md'), [
        '# Summary',
        '',
        '登录链路增强并接入滑块校验。',
        '',
        '## Decisions',
        '',
        '- 登录流程统一走 login service',
      ].join('\n'));
      writeText(resolve(project.root, '.aida', 'runs', 'feature-login', 'requirement.json'), JSON.stringify({
        branch: 'feature-login',
        title: 'MTR-888 登录增强',
        summary: '登录增强需求。',
        prdPhases: [],
        modules: [{ id: 'MOD-1', name: '登录', description: '登录流程与校验', assignee: 'test-dev' }],
        highlights: [],
        developers: [],
        totals: { tasks: 0, completedTasks: 0, bugs: 0, deviations: 0, linesAdded: 0, linesRemoved: 0, totalTokens: 0 },
        createdAt: '2026-04-30T10:00:00.000Z',
        updatedAt: '2026-04-30T10:00:00.000Z',
      }, null, 2));

      runCliOutput(project, 'doctor --fix');
      const stdout = runCliOutput(project, 'sync codex');

      assert.ok(stdout.includes('AIDA sync completed'));
      assert.ok(stdout.includes('Memories: '));
      assert.ok(stdout.includes('Summary: 1 entries'));
      assert.ok(stdout.includes('Tool build: codex'));

      const memoryIndex = readMemoryIndex(project.root);
      const summary = readRegistryItems<any>(resolve(project.root, '.aida', 'summary.json'));
      assert.ok(memoryIndex.items.length > 0);
      const moduleKey = memoryIndex.items[0].key;
      assert.equal(summary.length, 1);
      assert.deepEqual(summary[0].modules, [moduleKey]);
      assert.deepEqual(summary[0].keyFiles, ['src/pages/login/index.tsx', 'src/services/login.ts']);
      assert.ok(readText(resolve(project.root, '.codex', 'rules', 'aida', '_all.md')).includes('Do login safely'));
      assert.ok(readText(resolve(project.root, '.aida', 'memories', 'modules', `${moduleKey.replace(/_/g, '__').replace(/\//g, '_s_')}.md`)).includes('MTR-888'));
    } finally {
      project.cleanup();
    }
  });
});
