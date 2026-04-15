import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { ensureDir, readJson, readText, writeJson, writeText } from '../src/utils/fs.js';
import { createTestProject, runCliOutput } from './helpers.js';

describe('aida memory', () => {
  it('should rebuild branch context and module memories from existing branch data', () => {
    const project = createTestProject({
      branch: 'feature-profile',
      runData: {
        meta: {
          schemaVersion: '2.0',
          runId: 'feature-profile',
          project: 'test-project',
          developer: 'test-dev',
          branch: 'feature-profile',
          aiModel: 'claude',
          aiTool: 'claude-code',
          startTime: '2026-04-15T10:00:00.000Z',
          status: 'running',
          prdPhases: [],
        },
        summary: {
          totalTasks: 3,
          completedTasks: 1,
          bugCount: 1,
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
          { taskId: 'TASK-01', title: '实现个人中心骨架', stageName: '个人中心', prdPhase: '', status: 'done' },
          { taskId: 'TASK-02', title: '联调个人中心资料接口', stageName: '个人中心', prdPhase: '', status: 'in-progress' },
          { taskId: 'TASK-03', title: '补齐个人中心测试', stageName: '个人中心', prdPhase: '', status: 'pending' },
        ],
        bugs: [
          { bugId: 'BUG-01', title: '头像刷新延迟', severity: 'medium', source: 'testing', status: 'open', files: [], reportedAt: '2026-04-15T11:00:00.000Z', fixedAt: null },
        ],
        deviations: [],
        reviews: [],
        files: [
          { path: 'src/pages/profile/index.tsx', changeType: 'modified', linesAdded: 18, linesRemoved: 2, changeCount: 1 },
          { path: 'src/services/profile.ts', changeType: 'modified', linesAdded: 2, linesRemoved: 2, changeCount: 1 },
        ],
        metrics: {},
        timeline: [],
        events: [],
        rules: [],
        context: { currentStage: 'UI', currentTaskId: 'TASK-02', lastUpdated: '2026-04-15T11:30:00.000Z' },
        cost: { totalTokens: 0, estimatedManualHours: 0, actualHours: 0, tokenBreakdown: [] },
        highlights: [{ content: '个人中心主结构已稳定', source: 'auto', createdAt: '2026-04-15T11:20:00.000Z' }],
      },
    });

    try {
      writeJson(resolve(project.root, '.aida', 'runs', 'feature-profile', 'requirement.json'), {
        branch: 'feature-profile',
        title: 'MTR-001 个人中心改造',
        summary: '重构个人中心模块并统一资料编辑流程。',
        prdPhases: [],
        modules: [
          { id: 'MOD-01', name: '个人中心', description: '用户资料展示、编辑与头像上传', assignee: 'test-dev' },
        ],
        highlights: [],
        developers: [],
        totals: { tasks: 0, completedTasks: 0, bugs: 0, deviations: 0, linesAdded: 0, linesRemoved: 0, totalTokens: 0 },
        createdAt: '2026-04-15T10:00:00.000Z',
        updatedAt: '2026-04-15T10:00:00.000Z',
      });
      writeText(resolve(project.root, '.aida', 'runs', 'feature-profile', 'analysis.md'), [
        '# 需求概述',
        '',
        '本次主要重构个人中心，统一资料编辑和头像上传流程。',
        '',
        '## 关键决策',
        '',
        '- 页面层不直接请求接口，统一走 profile service',
        '',
        '## 约束',
        '',
        '- 不能变更后端返回结构',
      ].join('\n'));

      const stdout = runCliOutput(project, 'memory rebuild');

      assert.ok(stdout.includes('Rebuilt memory'));
      const context = readJson<any>(resolve(project.root, '.aida', 'runs', 'feature-profile', 'context.json'));
      const moduleMemory = readJson<any>(resolve(project.root, '.aida', 'memories', 'modules', '个人中心.json'));
      const memoryIndex = readJson<any>(resolve(project.root, '.aida', 'memories', 'index.json'));

      assert.equal(context.ticket, 'MTR-001');
      assert.equal(context.currentPhase, 'In Progress');
      assert.ok(context.keyFiles.includes('src/pages/profile/index.tsx'));
      assert.ok(moduleMemory.summary.includes('用户资料展示'));
      assert.ok(moduleMemory.relatedPaths.includes('src/pages/profile/index.tsx'));
      assert.ok(memoryIndex.modules.some((entry: any) => entry.key === '个人中心'));
      assert.ok(readText(resolve(project.root, '.aida', 'runs', 'feature-profile', 'context.md')).includes('MTR-001'));
      assert.ok(readText(resolve(project.root, '.aida', 'runs', 'feature-profile', 'memory.md')).includes('Runtime Memory Pack'));
      assert.ok(readText(resolve(project.root, '.aida', 'memories', 'modules', '个人中心.md')).includes('Module Memory'));
    } finally {
      project.cleanup();
    }
  });

  it('should search module memory from the index', () => {
    const project = createTestProject();
    try {
      ensureDir(resolve(project.root, '.aida', 'memories'));
      writeJson(resolve(project.root, '.aida', 'memories', 'index.json'), {
        updatedAt: '2026-04-15T12:00:00.000Z',
        modules: [
          {
            key: 'profile',
            title: '个人中心',
            summary: '用户资料展示、编辑和头像上传',
            keywords: ['个人中心', 'profile', 'account'],
            paths: ['src/pages/profile/index.tsx'],
            updatedAt: '2026-04-15T12:00:00.000Z',
          },
        ],
      });

      const stdout = runCliOutput(project, 'memory search 个人中心');
      assert.ok(stdout.includes('profile'));
      assert.ok(stdout.includes('用户资料展示'));
    } finally {
      project.cleanup();
    }
  });

  it('should print the aggregated memory pack for a branch', () => {
    const project = createTestProject();
    try {
      ensureDir(resolve(project.root, '.aida', 'runs', 'test-branch'));
      writeJson(resolve(project.root, '.aida', 'runs', 'test-branch', 'context.json'), {
        branch: 'test-branch',
        title: 'Test Branch',
        summary: 'Branch summary',
        currentPhase: 'In Progress',
        modules: ['profile'],
        completed: [],
        inProgress: ['Task A'],
        next: [],
        decisions: [],
        constraints: [],
        keyFiles: ['src/pages/profile.tsx'],
        risks: [],
        updatedAt: '2026-04-15T12:00:00.000Z',
      });
      ensureDir(resolve(project.root, '.aida', 'memories', 'modules'));
      writeJson(resolve(project.root, '.aida', 'memories', 'modules', 'profile.json'), {
        moduleKey: 'profile',
        title: '个人中心',
        summary: '用户资料模块',
        keywords: ['profile'],
        entryFiles: ['src/pages/profile.tsx'],
        relatedPaths: [],
        dataFlow: [],
        decisions: [],
        constraints: [],
        pitfalls: [],
        relatedRules: [],
        tickets: [],
        updatedAt: '2026-04-15T12:00:00.000Z',
      });
      runCliOutput(project, 'memory build');
      const stdout = runCliOutput(project, 'memory pack test-branch');
      assert.ok(stdout.includes('Runtime Memory Pack'));
      assert.ok(stdout.includes('个人中心'));
    } finally {
      project.cleanup();
    }
  });
});
