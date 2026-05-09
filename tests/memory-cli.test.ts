import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { ensureDir, fileExists, readJson, readText, writeJson, writeText } from '../src/utils/fs.js';
import { createTestProject, readMemoryIndex, runCliOutput } from './helpers.js';

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
      const memoryIndex = readMemoryIndex(project.root);
      assert.equal(context.modules.length, 1);
      const moduleKey = context.modules[0];
      const moduleMemory = readJson<any>(resolve(project.root, '.aida', 'memories', 'modules', `${moduleKey.replace(/_/g, '__').replace(/\//g, '_s_')}.json`));

      assert.equal(context.ticket, 'MTR-001');
      assert.equal(context.currentPhase, 'In Progress');
      assert.deepEqual(context.modules, [moduleKey]);
      assert.ok(context.keyFiles.includes('src/pages/profile/index.tsx'));
      assert.ok(moduleMemory.summary.includes('用户资料展示'));
      assert.equal(moduleMemory.moduleKey, moduleKey);
      assert.equal(moduleMemory.title, '个人中心');
      assert.ok(moduleMemory.relatedPaths.includes('src/pages/profile/index.tsx'));
      assert.ok(memoryIndex.items.some((entry: any) => entry.key === moduleKey));
      assert.equal(moduleMemory.changes?.[0]?.ticket, 'MTR-001');
      assert.ok(readText(resolve(project.root, '.aida', 'memories', 'modules', `${moduleKey.replace(/_/g, '__').replace(/\//g, '_s_')}.md`)).includes('Module Memory'));
    } finally {
      project.cleanup();
    }
  });

  it('should search module memory from the index', () => {
    const project = createTestProject();
    try {
      ensureDir(resolve(project.root, '.aida', 'memories'));
      writeJson(resolve(project.root, '.aida', 'memories', 'index.json'), {
        schemaVersion: '2.0',
        updatedAt: '2026-04-15T12:00:00.000Z',
        items: [
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

  it('should rebuild the memory index from existing module files', () => {
    const project = createTestProject();
    try {
      ensureDir(resolve(project.root, '.aida', 'memories', 'modules'));
      writeJson(resolve(project.root, '.aida', 'memories', 'modules', 'profile.json'), {
        moduleKey: 'profile',
        title: '个人中心',
        summary: '用户资料展示、编辑和头像上传',
        keywords: ['profile', 'account'],
        entryFiles: ['src/pages/profile/index.tsx'],
        relatedPaths: [],
        dataFlow: [],
        decisions: [],
        constraints: [],
        pitfalls: [],
        relatedRules: [],
        tickets: [],
        updatedAt: '2026-04-15T12:00:00.000Z',
      });
      writeText(resolve(project.root, '.aida', 'memories', 'index.json'), JSON.stringify({ schemaVersion: '2.0', updatedAt: 'old', items: [] }, null, 2));

      runCliOutput(project, 'memory build');
      const memoryIndex = readMemoryIndex(project.root);

      assert.ok(memoryIndex.items.some((entry: any) => entry.key === 'profile'));
      assert.ok(memoryIndex.items.find((entry: any) => entry.key === 'profile')?.paths.includes('src/pages/profile/index.tsx'));
    } finally {
      project.cleanup();
    }
  });

  it('should recover searchable index entries from orphan module markdown views', () => {
    const project = createTestProject();
    try {
      ensureDir(resolve(project.root, '.aida', 'memories', 'modules'));
      writeText(resolve(project.root, '.aida', 'memories', 'modules', 'billing.md'), [
        '# Module Memory',
        '',
        '- Module Key: billing',
        '- Title: Billing',
        '- Updated At: 2026-04-15T12:00:00.000Z',
        '',
        '## Summary',
        '',
        'Billing module memory.',
        '',
        '## Keywords',
        '',
        '- billing',
        '',
        '## Entry Files',
        '',
        '- src/pages/billing/index.tsx',
      ].join('\n'));
      writeJson(resolve(project.root, '.aida', 'memories', 'index.json'), { schemaVersion: '2.0', updatedAt: 'old', items: [] });

      const stdout = runCliOutput(project, 'memory search billing');
      const memoryIndex = readMemoryIndex(project.root);

      assert.ok(stdout.includes('billing'));
      assert.ok(memoryIndex.items.some((entry: any) => entry.key === 'billing'));
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
      assert.ok(stdout.includes('test-branch'));
      assert.ok(stdout.includes('个人中心'));
    } finally {
      project.cleanup();
    }
  });

  it('should rebuild module memory and views when the module key contains a slash', () => {
    const project = createTestProject({
      branch: 'main',
      runData: {
        meta: {
          schemaVersion: '2.0',
          runId: 'main',
          project: 'test-project',
          developer: 'test-dev',
          branch: 'main',
          aiModel: 'claude',
          aiTool: 'claude-code',
          startTime: '2026-04-15T10:00:00.000Z',
          status: 'running',
          prdPhases: [],
        },
        summary: {
          totalTasks: 1,
          completedTasks: 0,
          bugCount: 0,
          deviationCount: 0,
          reviewCount: 0,
          reviewPassCount: 0,
          reviewFailCount: 0,
          rulesSedimented: 0,
          prdPhaseCount: 0,
          filesChanged: 1,
          linesAdded: 10,
          linesRemoved: 0,
        },
        workflow: [],
        tasks: [
          { taskId: 'TASK-01', title: 'Validate MCP flow', stageName: 'CLI/MCP', prdPhase: '', status: 'in-progress' },
        ],
        bugs: [],
        deviations: [],
        reviews: [],
        files: [
          { path: 'src/mcp/server.ts', changeType: 'modified', linesAdded: 10, linesRemoved: 0, changeCount: 1 },
        ],
        metrics: {},
        timeline: [],
        events: [],
        rules: [],
        context: { currentStage: 'CLI/MCP', currentTaskId: 'TASK-01', lastUpdated: '2026-04-15T11:30:00.000Z' },
        cost: { totalTokens: 0, estimatedManualHours: 0, actualHours: 0, tokenBreakdown: [] },
        highlights: [],
      },
    });

    try {
      writeJson(resolve(project.root, '.aida', 'runs', 'main', 'requirement.json'), {
        branch: 'main',
        title: 'MTR-002 CLI MCP',
        summary: 'Validate CLI/MCP integration.',
        prdPhases: [],
        modules: [
          { id: 'MOD-01', name: 'CLI/MCP', description: 'CLI and MCP bridge', assignee: 'test-dev' },
        ],
        highlights: [],
        developers: [],
        totals: { tasks: 0, completedTasks: 0, bugs: 0, deviations: 0, linesAdded: 0, linesRemoved: 0, totalTokens: 0 },
        createdAt: '2026-04-15T10:00:00.000Z',
        updatedAt: '2026-04-15T10:00:00.000Z',
      });

      const stdout = runCliOutput(project, 'memory rebuild main');

      assert.ok(stdout.includes('Rebuilt memory'));
      assert.equal(readJson<any>(resolve(project.root, '.aida', 'memories', 'modules', 'cli_s_mcp.json')).moduleKey, 'cli/mcp');
      assert.ok(readText(resolve(project.root, '.aida', 'memories', 'modules', 'cli_s_mcp.md')).includes('CLI/MCP'));
      assert.equal(fileExists(resolve(project.root, '.aida', 'memories', 'modules', 'cli')), false);
    } finally {
      project.cleanup();
    }
  });

  it('should flatten legacy nested module memory files during memory build', () => {
    const project = createTestProject();
    try {
      ensureDir(resolve(project.root, '.aida', 'memories', 'modules', 'cli'));
      writeJson(resolve(project.root, '.aida', 'memories', 'modules', 'cli', 'mcp.json'), {
        moduleKey: 'cli/mcp',
        title: 'CLI/MCP',
        summary: 'Legacy nested module memory.',
        keywords: ['cli/mcp'],
        entryFiles: ['src/mcp/server.ts'],
        relatedPaths: [],
        dataFlow: [],
        decisions: [],
        constraints: [],
        pitfalls: [],
        relatedRules: [],
        tickets: [],
        updatedAt: '2026-04-15T12:00:00.000Z',
      });
      writeText(resolve(project.root, '.aida', 'memories', 'modules', 'cli', 'mcp.md'), [
        '# Module Memory',
        '',
        '- Module Key: cli/mcp',
        '- Title: CLI/MCP',
        '- Updated At: 2026-04-15T12:00:00.000Z',
        '',
        '## Summary',
        '',
        'Legacy nested module memory.',
      ].join('\n'));
      writeJson(resolve(project.root, '.aida', 'memories', 'index.json'), { schemaVersion: '2.0', updatedAt: 'old', items: [] });

      const stdout = runCliOutput(project, 'memory build');

      assert.ok(stdout.includes('Built memory views'));
      assert.equal(fileExists(resolve(project.root, '.aida', 'memories', 'modules', 'cli_s_mcp.json')), true);
      assert.equal(fileExists(resolve(project.root, '.aida', 'memories', 'modules', 'cli_s_mcp.md')), true);
      assert.equal(fileExists(resolve(project.root, '.aida', 'memories', 'modules', 'cli', 'mcp.json')), false);
      assert.equal(fileExists(resolve(project.root, '.aida', 'memories', 'modules', 'cli', 'mcp.md')), false);
      assert.equal(fileExists(resolve(project.root, '.aida', 'memories', 'modules', 'cli')), false);
    } finally {
      project.cleanup();
    }
  });

  it('should normalize slash module keys with surrounding spaces during memory build', () => {
    const project = createTestProject();
    try {
      ensureDir(resolve(project.root, '.aida', 'memories', 'modules'));
      writeJson(resolve(project.root, '.aida', 'memories', 'modules', 'qa-_s_-manual-verification.json'), {
        moduleKey: 'qa-/-manual-verification',
        title: 'QA / Manual Verification',
        summary: 'legacy key',
        keywords: ['qa'],
        entryFiles: ['README.md'],
        relatedPaths: [],
        dataFlow: [],
        decisions: [],
        constraints: [],
        pitfalls: [],
        relatedRules: [],
        tickets: [],
        updatedAt: '2026-05-01T10:00:00.000Z',
      });

      runCliOutput(project, 'memory build');

      const index = readMemoryIndex(project.root);
      assert.ok(index.items.some((entry) => entry.key === 'qa/manual-verification'));
      assert.equal(fileExists(resolve(project.root, '.aida', 'memories', 'modules', 'qa-_s_-manual-verification.json')), false);
      assert.equal(fileExists(resolve(project.root, '.aida', 'memories', 'modules', 'qa_s_manual-verification.json')), true);
    } finally {
      project.cleanup();
    }
  });

  it('should filter AIDA runtime files out of rebuilt context and module memory paths', () => {
    const project = createTestProject({
      branch: 'main',
      runData: {
        meta: {
          schemaVersion: '2.0',
          runId: 'main',
          project: 'test-project',
          developer: 'test-dev',
          branch: 'main',
          aiModel: 'claude',
          aiTool: 'claude-code',
          startTime: '2026-04-15T10:00:00.000Z',
          status: 'running',
          prdPhases: [],
        },
        summary: {
          totalTasks: 1,
          completedTasks: 0,
          bugCount: 0,
          deviationCount: 0,
          reviewCount: 0,
          reviewPassCount: 0,
          reviewFailCount: 0,
          rulesSedimented: 0,
          prdPhaseCount: 0,
          filesChanged: 3,
          linesAdded: 120,
          linesRemoved: 20,
        },
        workflow: [],
        tasks: [
          { taskId: 'TASK-01', title: 'Refine memory rebuild', stageName: 'AIDA', prdPhase: '', status: 'in-progress' },
        ],
        bugs: [],
        deviations: [],
        reviews: [],
        files: [
          { path: '.aida/memories/index.json', changeType: 'modified', linesAdded: 90, linesRemoved: 10, changeCount: 1 },
          { path: '.aida/runs/main/vito-long/run.json', changeType: 'modified', linesAdded: 20, linesRemoved: 10, changeCount: 1 },
          { path: 'yarn.lock', changeType: 'modified', linesAdded: 3, linesRemoved: 1, changeCount: 1 },
          { path: '.../runs/main/vito-long/run.backup.json', changeType: 'modified', linesAdded: 5, linesRemoved: 0, changeCount: 1 },
          { path: 'src/utils/memory.ts', changeType: 'modified', linesAdded: 10, linesRemoved: 0, changeCount: 1 },
        ],
        metrics: {},
        timeline: [],
        events: [],
        rules: [],
        context: { currentStage: 'AIDA', currentTaskId: 'TASK-01', lastUpdated: '2026-04-15T11:30:00.000Z' },
        cost: { totalTokens: 0, estimatedManualHours: 0, actualHours: 0, tokenBreakdown: [] },
        highlights: [],
      },
    });

    try {
      writeJson(resolve(project.root, '.aida', 'runs', 'main', 'requirement.json'), {
        branch: 'main',
        title: 'MTR-003 AIDA memory cleanup',
        summary: 'Reduce runtime noise in rebuilt AIDA context and module memory.',
        prdPhases: [],
        modules: [
          { id: 'MOD-01', name: 'AIDA', description: 'AIDA runtime data pipeline', assignee: 'test-dev' },
        ],
        highlights: [],
        developers: [],
        totals: { tasks: 0, completedTasks: 0, bugs: 0, deviations: 0, linesAdded: 0, linesRemoved: 0, totalTokens: 0 },
        createdAt: '2026-04-15T10:00:00.000Z',
        updatedAt: '2026-04-15T10:00:00.000Z',
      });

      runCliOutput(project, 'memory rebuild main');

      const context = readJson<any>(resolve(project.root, '.aida', 'runs', 'main', 'context.json'));
      assert.equal(context.modules.length, 1);
      const moduleKey = context.modules[0];
      const moduleMemory = readJson<any>(resolve(project.root, '.aida', 'memories', 'modules', `${moduleKey.replace(/_/g, '__').replace(/\//g, '_s_')}.json`));

      assert.deepEqual(context.keyFiles, ['src/utils/memory.ts']);
      assert.deepEqual(context.modules, [moduleKey]);
      assert.equal(moduleMemory.moduleKey, moduleKey);
      assert.deepEqual(moduleMemory.entryFiles, ['src/utils/memory.ts']);
      assert.deepEqual(moduleMemory.relatedPaths, ['src/utils/memory.ts']);
    } finally {
      project.cleanup();
    }
  });
});
