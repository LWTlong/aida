import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { ensureDir, readJson, writeText, fileExists } from '../src/utils/fs.js';
import { createTestProject, runCliOutput } from './helpers.js';

function writeConflict(filePath: string, ours: unknown, theirs: unknown): void {
  writeText(
    filePath,
    `<<<<<<< HEAD
${JSON.stringify(ours, null, 2)}
=======
${JSON.stringify(theirs, null, 2)}
>>>>>>> branch-b
`,
  );
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('aida merge-data', () => {
  it('should merge memory index and module memory conflicts from structured JSON sources', () => {
    const project = createTestProject();
    try {
      ensureDir(resolve(project.root, '.aida', 'memories', 'modules'));

      writeConflict(
        resolve(project.root, '.aida', 'memories', 'index.json'),
        {
          updatedAt: '2026-04-28T00:00:00.000Z',
          modules: [
            {
              key: 'profile',
              title: 'Profile',
              summary: 'Older profile summary',
              keywords: ['profile', 'user'],
              paths: ['src/profile/index.tsx'],
              updatedAt: '2026-04-28T00:00:00.000Z',
            },
          ],
        },
        {
          updatedAt: '2026-04-28T01:00:00.000Z',
          modules: [
            {
              key: 'profile',
              title: 'Profile',
              summary: 'Newer profile summary',
              keywords: ['user', 'settings'],
              paths: ['src/profile/index.tsx', 'src/profile/store.ts'],
              updatedAt: '2026-04-28T01:00:00.000Z',
            },
            {
              key: 'order',
              title: 'Order',
              summary: 'Order module',
              keywords: ['order'],
              paths: ['src/order/index.tsx'],
              updatedAt: '2026-04-28T01:00:00.000Z',
            },
          ],
        },
      );

      writeConflict(
        resolve(project.root, '.aida', 'memories', 'modules', 'profile.json'),
        {
          moduleKey: 'profile',
          title: 'Profile',
          summary: 'Older profile summary',
          keywords: ['profile', 'user'],
          entryFiles: ['src/profile/index.tsx'],
          relatedPaths: ['src/profile/api.ts'],
          dataFlow: ['api -> store'],
          decisions: ['Use pinia'],
          constraints: ['Keep list virtualized'],
          pitfalls: ['Do not mutate props'],
          relatedRules: ['RULE-001'],
          tickets: [
            { ticket: 'MTR-1001', branch: 'feat-a', summary: 'Profile flow', updatedAt: '2026-04-28T00:00:00.000Z' },
          ],
          updatedAt: '2026-04-28T00:00:00.000Z',
        },
        {
          moduleKey: 'profile',
          title: 'Profile',
          summary: 'Newer profile summary',
          keywords: ['user', 'settings'],
          entryFiles: ['src/profile/store.ts'],
          relatedPaths: ['src/profile/store.ts'],
          dataFlow: ['store -> view'],
          decisions: ['Use pinia', 'Cache profile tabs'],
          constraints: ['Keep list virtualized'],
          pitfalls: ['Avoid duplicated fetches'],
          relatedRules: ['RULE-002'],
          tickets: [
            { ticket: 'MTR-1002', branch: 'feat-b', summary: 'Profile cache', updatedAt: '2026-04-28T01:00:00.000Z' },
          ],
          updatedAt: '2026-04-28T01:00:00.000Z',
        },
      );

      const stdout = runCliOutput(project, 'merge-data');
      const mergedIndex = readJson<any>(resolve(project.root, '.aida', 'memories', 'index.json'));
      const mergedModule = readJson<any>(resolve(project.root, '.aida', 'memories', 'modules', 'profile.json'));

      assert.ok(stdout.includes('AIDA data merge completed'));
      assert.ok(stdout.includes('memory index: merged'));
      assert.ok(stdout.includes('module memories: merged'));
      assert.equal(mergedIndex.modules.length, 2);
      assert.equal(mergedIndex.modules.find((item: any) => item.key === 'profile').summary, 'Newer profile summary');
      assert.deepEqual(mergedModule.keywords, ['profile', 'user', 'settings']);
      assert.deepEqual(mergedModule.entryFiles, ['src/profile/index.tsx', 'src/profile/store.ts']);
      assert.deepEqual(mergedModule.relatedRules, ['RULE-001', 'RULE-002']);
      assert.equal(mergedModule.tickets.length, 2);
    } finally {
      project.cleanup();
    }
  });

  it('should merge branch context and requirement conflicts and rebuild index.json', () => {
    const project = createTestProject();
    try {
      const safeBranch = project.branch.replace(/\//g, '-');

      writeConflict(
        resolve(project.root, '.aida', 'runs', safeBranch, 'context.json'),
        {
          branch: project.branch,
          ticket: 'MTR-2001',
          title: 'Profile Rewrite',
          summary: 'Older summary',
          currentPhase: 'In Progress',
          modules: ['Profile'],
          completed: ['Task A'],
          inProgress: ['Task B'],
          next: [],
          decisions: ['Split store'],
          constraints: ['Keep SSR'],
          keyFiles: ['src/profile/index.tsx'],
          risks: ['Cache invalidation'],
          updatedAt: '2026-04-28T00:00:00.000Z',
        },
        {
          branch: project.branch,
          ticket: 'MTR-2001',
          title: 'Profile Rewrite',
          summary: 'Newer summary',
          currentPhase: 'Completed',
          modules: ['Profile', 'Settings'],
          completed: ['Task C'],
          inProgress: [],
          next: ['Task D'],
          decisions: ['Split store', 'Add cache'],
          constraints: ['Keep SSR'],
          keyFiles: ['src/profile/store.ts'],
          risks: ['Backfill analytics'],
          updatedAt: '2026-04-28T01:00:00.000Z',
        },
      );

      writeConflict(
        resolve(project.root, '.aida', 'runs', safeBranch, 'requirement.json'),
        {
          branch: project.branch,
          title: 'Profile Rewrite',
          summary: 'Older summary',
          prdPhases: [{ phase: 'P1', file: 'prd.md', title: 'Profile', confirmedAt: '2026-04-28T00:00:00.000Z' }],
          modules: [{ id: 'MOD-1', name: 'Profile', description: 'Profile module', assignee: 'alice' }],
          highlights: [{ content: 'Old highlight', source: 'manual', createdAt: '2026-04-28T00:00:00.000Z' }],
          developers: [{ name: 'alice', modules: ['Profile'], tasks: 2, completedTasks: 1, bugs: 1, deviations: 0, linesAdded: 10, linesRemoved: 2, firstPassRate: 0.5, actualWorkSeconds: 120, totalTokens: 100 }],
          totals: { tasks: 2, completedTasks: 1, bugs: 1, deviations: 0, linesAdded: 10, linesRemoved: 2, totalTokens: 100 },
          createdAt: '2026-04-28T00:00:00.000Z',
          updatedAt: '2026-04-28T00:00:00.000Z',
        },
        {
          branch: project.branch,
          title: 'Profile Rewrite',
          summary: 'Newer summary',
          prdPhases: [{ phase: 'P2', file: 'prd-2.md', title: 'Settings', confirmedAt: '2026-04-28T01:00:00.000Z' }],
          modules: [{ id: 'MOD-2', name: 'Settings', description: 'Settings module', assignee: 'bob' }],
          highlights: [{ content: 'New highlight', source: 'manual', createdAt: '2026-04-28T01:00:00.000Z' }],
          developers: [{ name: 'bob', modules: ['Settings'], tasks: 3, completedTasks: 3, bugs: 0, deviations: 1, linesAdded: 20, linesRemoved: 4, firstPassRate: 1, actualWorkSeconds: 240, totalTokens: 300 }],
          totals: { tasks: 999, completedTasks: 999, bugs: 999, deviations: 999, linesAdded: 999, linesRemoved: 999, totalTokens: 999 },
          createdAt: '2026-04-28T00:00:00.000Z',
          updatedAt: '2026-04-28T01:00:00.000Z',
        },
      );

      const stdout = runCliOutput(project, 'merge-data');
      const mergedContext = readJson<any>(resolve(project.root, '.aida', 'runs', safeBranch, 'context.json'));
      const mergedRequirement = readJson<any>(resolve(project.root, '.aida', 'runs', safeBranch, 'requirement.json'));
      const index = readJson<any>(resolve(project.root, '.aida', 'index.json'));

      assert.ok(stdout.includes('branch contexts: merged'));
      assert.ok(stdout.includes('requirements: merged'));
      assert.equal(mergedContext.summary, 'Newer summary');
      assert.deepEqual(mergedContext.modules, ['Profile', 'Settings']);
      assert.deepEqual(mergedContext.completed, ['Task A', 'Task C']);
      assert.deepEqual(mergedContext.next, ['Task D']);
      assert.equal(mergedRequirement.modules.length, 2);
      assert.equal(mergedRequirement.developers.length, 2);
      assert.equal(mergedRequirement.totals.tasks, 5);
      assert.equal(mergedRequirement.totals.completedTasks, 4);
      assert.equal(index.runs.length, 1);
      assert.equal(index.runs[0].title, 'Profile Rewrite');
    } finally {
      project.cleanup();
    }
  });

  it('should merge run.json conflicts and recalculate summary, metrics, and current task context', () => {
    const project = createTestProject();
    try {
      writeConflict(
        project.runJsonPath,
        {
          meta: {
            schemaVersion: '2.0',
            runId: project.branch,
            project: 'test-project',
            developer: project.dev,
            branch: project.branch,
            aiModel: 'claude',
            aiTool: 'claude-code',
            startTime: '2026-04-28T00:00:00.000Z',
            status: 'running',
            prdPhases: ['P1'],
          },
          summary: {},
          metrics: {},
          context: { currentStage: 'UI', currentTaskId: 'TASK-01', currentPrdPhase: 'P1', lastUpdated: '2026-04-28T00:00:00.000Z' },
          tasks: [
            { taskId: 'TASK-01', title: 'Build profile panel', stageName: 'UI', prdPhase: 'P1', status: 'in-progress', createdAt: '2026-04-28T00:00:00.000Z', startedAt: '2026-04-28T00:05:00.000Z', completedAt: null },
          ],
          deviations: [],
          bugs: [],
          reviews: [{ reviewId: 'REV-01', taskId: 'TASK-01', result: 'pass', issueCount: 0, scope: 'profile panel', reviewedAt: '2026-04-28T00:20:00.000Z' }],
          rules: [],
          files: [{ path: 'src/profile/index.tsx', changeType: 'modified', linesAdded: 20, linesRemoved: 5, changeCount: 1 }],
          timeline: [{ type: 'task', title: 'TASK-01 started', timestamp: '2026-04-28T00:05:00.000Z', prdPhase: 'P1' }],
          workflow: [{ stage: 'Code Generation', prdPhase: 'P1', status: 'in_progress', startTime: '2026-04-28T00:05:00.000Z' }],
          events: [{ type: 'task_started', time: '2026-04-28T00:05:00.000Z', data: { taskId: 'TASK-01' } }],
          cost: { totalTokens: 100, estimatedManualHours: 2, actualHours: 0, tokenBreakdown: [{ stage: 'Code Generation', tokens: 100 }] },
          highlights: [],
        },
        {
          meta: {
            schemaVersion: '2.0',
            runId: project.branch,
            project: 'test-project',
            developer: project.dev,
            branch: project.branch,
            aiModel: 'claude',
            aiTool: 'claude-code',
            startTime: '2026-04-28T00:00:00.000Z',
            status: 'running',
            prdPhases: ['P1', 'P2'],
          },
          summary: {},
          metrics: {},
          context: { currentStage: 'API', currentTaskId: 'TASK-02', currentPrdPhase: 'P2', lastUpdated: '2026-04-28T01:00:00.000Z' },
          tasks: [
            { taskId: 'TASK-01', title: 'Build profile panel', stageName: 'UI', prdPhase: 'P1', status: 'done', createdAt: '2026-04-28T00:00:00.000Z', startedAt: '2026-04-28T00:05:00.000Z', completedAt: '2026-04-28T00:30:00.000Z' },
            { taskId: 'TASK-02', title: 'Wire profile API', stageName: 'API', prdPhase: 'P2', status: 'in-progress', createdAt: '2026-04-28T00:40:00.000Z', startedAt: '2026-04-28T00:45:00.000Z', completedAt: null },
          ],
          deviations: [{ deviationId: 'DEV-01', title: 'Wrong endpoint', rootCauseCategory: 'api', deviationCategory: 'api', files: ['src/profile/api.ts'], ruleSedimented: false, detectedAt: '2026-04-28T00:35:00.000Z', fixedAt: null }],
          bugs: [{ bugId: 'BUG-01', title: 'Profile error', severity: 'medium', source: 'testing', status: 'fixed', files: ['src/profile/api.ts'], fix: 'Adjusted mapper', taskId: 'TASK-02', reportedAt: '2026-04-28T00:50:00.000Z', fixedAt: '2026-04-28T00:55:00.000Z' }],
          reviews: [{ reviewId: 'REV-02', taskId: 'TASK-02', result: 'fail', issueCount: 1, scope: 'profile api', reviewedAt: '2026-04-28T00:58:00.000Z', issues: ['Missing error fallback'] }],
          rules: [],
          files: [{ path: 'src/profile/api.ts', changeType: 'modified', linesAdded: 30, linesRemoved: 10, changeCount: 1 }],
          timeline: [{ type: 'task', title: 'TASK-02 started', timestamp: '2026-04-28T00:45:00.000Z', prdPhase: 'P2' }],
          workflow: [{ stage: 'Code Generation', prdPhase: 'P2', status: 'completed', startTime: '2026-04-28T00:45:00.000Z', endTime: '2026-04-28T01:10:00.000Z' }],
          events: [{ type: 'task_started', time: '2026-04-28T00:45:00.000Z', data: { taskId: 'TASK-02' } }],
          cost: { totalTokens: 250, estimatedManualHours: 3, actualHours: 0, tokenBreakdown: [{ stage: 'Code Generation', tokens: 250 }] },
          highlights: [{ content: 'Profile API stabilized', source: 'manual', createdAt: '2026-04-28T01:05:00.000Z' }],
        },
      );

      const stdout = runCliOutput(project, 'merge-data');
      const mergedRun = readJson<any>(project.runJsonPath);

      assert.ok(stdout.includes('run.json: merged'));
      assert.equal(mergedRun.tasks.length, 2);
      assert.equal(mergedRun.tasks.find((item: any) => item.taskId === 'TASK-01').status, 'done');
      assert.equal(mergedRun.summary.totalTasks, 2);
      assert.equal(mergedRun.summary.completedTasks, 1);
      assert.equal(mergedRun.summary.bugCount, 1);
      assert.equal(mergedRun.summary.deviationCount, 1);
      assert.equal(mergedRun.summary.reviewCount, 2);
      assert.equal(mergedRun.summary.filesChanged, 2);
      assert.equal(mergedRun.context.currentTaskId, 'TASK-02');
      assert.equal(mergedRun.context.currentStage, 'API');
      assert.equal(mergedRun.context.currentPrdPhase, 'P2');
      assert.ok(typeof mergedRun.metrics.bugRate === 'number');
      assert.equal(mergedRun.timeline.length, 2);
      assert.equal(mergedRun.events.length, 2);
    } finally {
      project.cleanup();
    }
  });

  it('should report no-op when there are no AIDA JSON conflicts', () => {
    const project = createTestProject();
    try {
      const stdout = runCliOutput(project, 'merge-data');
      assert.ok(stdout.includes('No AIDA JSON conflicts detected'));
      assert.equal(fileExists(resolve(project.root, '.aida', 'index.json')), false);
    } finally {
      project.cleanup();
    }
  });

  it('should merge conflicts derived from the current repository real AIDA JSON snapshots', () => {
    const project = createTestProject({ branch: 'main', dev: 'vito-long' });
    try {
      const repoRoot = process.cwd();
      const safeBranch = project.branch.replace(/\//g, '-');
      const moduleMemoryDir = resolve(project.root, '.aida', 'memories', 'modules');
      ensureDir(moduleMemoryDir);

      const realIndex = readJson<any>(resolve(repoRoot, '.aida', 'memories', 'index.json'));
      const realModule = readJson<any>(resolve(repoRoot, '.aida', 'memories', 'modules', 'cli.json'));
      const realContext = readJson<any>(resolve(repoRoot, '.aida', 'runs', 'main', 'context.json'));
      const realRequirement = readJson<any>(resolve(repoRoot, '.aida', 'runs', 'main', 'requirement.json'));
      const realRun = readJson<any>(resolve(repoRoot, '.aida', 'runs', 'main', 'vito-long', 'run.json'));

      const oursIndex = cloneJson(realIndex);
      const theirsIndex = cloneJson(realIndex);
      oursIndex.updatedAt = '2026-04-28T03:00:00.000Z';
      theirsIndex.updatedAt = '2026-04-28T04:00:00.000Z';
      oursIndex.modules[0].paths.push('src/cli/commands/merge-data.ts');
      theirsIndex.modules[0].keywords.push('real-fixture');
      theirsIndex.modules[0].updatedAt = '2026-04-28T04:00:00.000Z';

      const oursModule = cloneJson(realModule);
      const theirsModule = cloneJson(realModule);
      oursModule.updatedAt = '2026-04-28T03:00:00.000Z';
      theirsModule.updatedAt = '2026-04-28T04:00:00.000Z';
      oursModule.relatedPaths.push('src/cli/commands/merge-data.ts');
      theirsModule.decisions.push('Prefer structured merge over text merge for committed AIDA JSON');

      const oursContext = cloneJson(realContext);
      const theirsContext = cloneJson(realContext);
      oursContext.updatedAt = '2026-04-28T03:00:00.000Z';
      theirsContext.updatedAt = '2026-04-28T04:00:00.000Z';
      oursContext.inProgress.push('Replay real merge conflict fixture');
      theirsContext.risks.push('Real conflict fixture diverged from current run data');

      const oursRequirement = cloneJson(realRequirement);
      const theirsRequirement = cloneJson(realRequirement);
      oursRequirement.updatedAt = '2026-04-28T03:00:00.000Z';
      theirsRequirement.updatedAt = '2026-04-28T04:00:00.000Z';
      oursRequirement.highlights.push({
        content: 'Real fixture branch added a merge-data validation highlight.',
        source: 'auto',
        createdAt: '2026-04-28T03:00:00.000Z',
      });
      theirsRequirement.highlights.push({
        content: 'Real fixture branch added a second validation highlight.',
        source: 'auto',
        createdAt: '2026-04-28T04:00:00.000Z',
      });

      const oursRun = cloneJson(realRun);
      const theirsRun = cloneJson(realRun);
      oursRun.context.lastUpdated = '2026-04-28T03:00:00.000Z';
      theirsRun.context.lastUpdated = '2026-04-28T04:00:00.000Z';
      oursRun.highlights.push({
        content: 'Real fixture merge-data branch A',
        source: 'manual',
        createdAt: '2026-04-28T03:00:00.000Z',
      });
      theirsRun.highlights.push({
        content: 'Real fixture merge-data branch B',
        source: 'manual',
        createdAt: '2026-04-28T04:00:00.000Z',
      });
      oursRun.events.push({
        type: 'highlight_logged',
        time: '2026-04-28T03:00:00.000Z',
        data: { content: 'Real fixture merge-data branch A' },
      });
      theirsRun.events.push({
        type: 'highlight_logged',
        time: '2026-04-28T04:00:00.000Z',
        data: { content: 'Real fixture merge-data branch B' },
      });

      writeConflict(resolve(project.root, '.aida', 'memories', 'index.json'), oursIndex, theirsIndex);
      writeConflict(resolve(moduleMemoryDir, 'cli.json'), oursModule, theirsModule);
      writeConflict(resolve(project.root, '.aida', 'runs', safeBranch, 'context.json'), oursContext, theirsContext);
      writeConflict(resolve(project.root, '.aida', 'runs', safeBranch, 'requirement.json'), oursRequirement, theirsRequirement);
      writeConflict(project.runJsonPath, oursRun, theirsRun);

      const stdout = runCliOutput(project, 'merge-data');
      const mergedIndex = readJson<any>(resolve(project.root, '.aida', 'memories', 'index.json'));
      const mergedModule = readJson<any>(resolve(moduleMemoryDir, 'cli.json'));
      const mergedContext = readJson<any>(resolve(project.root, '.aida', 'runs', safeBranch, 'context.json'));
      const mergedRequirement = readJson<any>(resolve(project.root, '.aida', 'runs', safeBranch, 'requirement.json'));
      const mergedRun = readJson<any>(project.runJsonPath);

      assert.ok(stdout.includes('AIDA data merge completed'));
      assert.ok(mergedIndex.modules[0].paths.includes('src/cli/commands/merge-data.ts'));
      assert.ok(mergedIndex.modules[0].keywords.includes('real-fixture'));
      assert.ok(mergedModule.relatedPaths.includes('src/cli/commands/merge-data.ts'));
      assert.ok(mergedModule.decisions.includes('Prefer structured merge over text merge for committed AIDA JSON'));
      assert.ok(mergedContext.inProgress.includes('Replay real merge conflict fixture'));
      assert.ok(mergedContext.risks.includes('Real conflict fixture diverged from current run data'));
      assert.equal(mergedRequirement.highlights.length, realRequirement.highlights.length + 2);
      assert.ok(mergedRun.highlights.some((item: any) => item.content === 'Real fixture merge-data branch A'));
      assert.ok(mergedRun.highlights.some((item: any) => item.content === 'Real fixture merge-data branch B'));
      assert.ok(mergedRun.events.some((item: any) => item.data?.content === 'Real fixture merge-data branch A'));
      assert.ok(mergedRun.events.some((item: any) => item.data?.content === 'Real fixture merge-data branch B'));
      assert.equal(mergedRun.summary.totalTasks, mergedRun.tasks.length);
      assert.equal(mergedRun.summary.bugCount, mergedRun.bugs.length);
    } finally {
      project.cleanup();
    }
  });
});
