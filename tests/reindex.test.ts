import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ensureDir, writeJson, readJson, fileExists } from '../src/utils/fs.js';
import { buildIndex } from '../src/cli/commands/reindex.js';
import type { IndexData, RequirementData } from '../src/schemas/run-json.js';

let tmpRoot: string;

function setupProject(): string {
  tmpRoot = mkdtempSync(join(tmpdir(), 'aida-reindex-'));
  const aidevos = resolve(tmpRoot, '.aida');
  ensureDir(aidevos);
  writeJson(resolve(aidevos, 'config.json'), { project: 'test-proj' });
  ensureDir(resolve(aidevos, 'runs'));
  return tmpRoot;
}

function addBranch(root: string, branch: string, opts: {
  developers?: Array<{ name: string; tasks: number; completedTasks: number; bugs: number; deviations: number }>;
  status?: string;
  title?: string;
}): void {
  const branchDir = resolve(root, '.aida', 'runs', branch);
  ensureDir(branchDir);

  const devs = opts.developers || [{ name: 'dev-a', tasks: 5, completedTasks: 3, bugs: 1, deviations: 0 }];
  const now = new Date().toISOString();

  // Write requirement.json
  const req: RequirementData = {
    branch,
    title: opts.title || branch,
    summary: `Summary for ${branch}`,
    prdPhases: [],
    modules: [],
    highlights: [{ content: `Highlight for ${branch}`, source: 'auto', createdAt: now }],
    developers: devs.map(d => ({
      name: d.name,
      modules: [],
      tasks: d.tasks,
      completedTasks: d.completedTasks,
      bugs: d.bugs,
      deviations: d.deviations,
      linesAdded: 100,
      linesRemoved: 20,
      firstPassRate: 0.8,
      actualWorkSeconds: 3600,
      totalTokens: 50000,
    })),
    totals: {
      tasks: devs.reduce((a, d) => a + d.tasks, 0),
      completedTasks: devs.reduce((a, d) => a + d.completedTasks, 0),
      bugs: devs.reduce((a, d) => a + d.bugs, 0),
      deviations: devs.reduce((a, d) => a + d.deviations, 0),
      linesAdded: devs.length * 100,
      linesRemoved: devs.length * 20,
      totalTokens: devs.length * 50000,
    },
    createdAt: now,
    updatedAt: now,
  };
  writeJson(resolve(branchDir, 'requirement.json'), req);

  // Write run.json for each developer
  for (const dev of devs) {
    const devDir = resolve(branchDir, dev.name);
    ensureDir(devDir);
    writeJson(resolve(devDir, 'run.json'), {
      meta: {
        branch,
        developer: dev.name,
        status: opts.status || 'running',
        startTime: now,
      },
      summary: { totalTasks: dev.tasks, completedTasks: dev.completedTasks },
    });
  }
}

afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
});

// ─── buildIndex ───────────────────────────────────────────

describe('buildIndex', () => {
  it('should return 0 for empty runs directory', () => {
    const root = setupProject();
    const count = buildIndex(root);
    assert.equal(count, 0);
  });

  it('should return -1 when no runs directory exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'aida-empty-'));
    tmpRoot = root;
    const count = buildIndex(root);
    assert.equal(count, -1);
  });

  it('should index a single branch', () => {
    const root = setupProject();
    addBranch(root, 'feat-1', { title: 'Feature 1' });

    const count = buildIndex(root);
    assert.equal(count, 1);

    const idx = readJson<IndexData>(resolve(root, '.aida', 'index.json'));
    assert.equal(idx.project, 'test-proj');
    assert.equal(idx.runs.length, 1);
    assert.equal(idx.runs[0].branch, 'feat-1');
    assert.equal(idx.runs[0].title, 'Feature 1');
    assert.ok(idx.runs[0].developers.length > 0);
    assert.ok(idx.runs[0].highlights.length > 0);
  });

  it('should index multiple branches', () => {
    const root = setupProject();
    addBranch(root, 'feat-1', { title: 'Feature 1' });
    addBranch(root, 'feat-2', { title: 'Feature 2' });
    addBranch(root, 'feat-3', { title: 'Feature 3' });

    const count = buildIndex(root);
    assert.equal(count, 3);

    const idx = readJson<IndexData>(resolve(root, '.aida', 'index.json'));
    assert.equal(idx.runs.length, 3);
  });

  it('should preserve totals from requirement.json', () => {
    const root = setupProject();
    addBranch(root, 'feat-1', {
      developers: [
        { name: 'dev-a', tasks: 10, completedTasks: 8, bugs: 2, deviations: 1 },
        { name: 'dev-b', tasks: 5, completedTasks: 5, bugs: 0, deviations: 0 },
      ],
    });

    buildIndex(root);
    const idx = readJson<IndexData>(resolve(root, '.aida', 'index.json'));
    const run = idx.runs[0];

    assert.equal(run.totals.tasks, 15);
    assert.equal(run.totals.completedTasks, 13);
    assert.equal(run.totals.bugs, 2);
    assert.equal(run.totals.deviations, 1);
    assert.equal(run.developers.length, 2);
  });

  it('should set status to completed when all developers are completed', () => {
    const root = setupProject();
    addBranch(root, 'feat-done', { status: 'completed' });

    buildIndex(root);
    const idx = readJson<IndexData>(resolve(root, '.aida', 'index.json'));
    assert.equal(idx.runs[0].status, 'completed');
  });

  it('should set status to running when any developer is not completed', () => {
    const root = setupProject();
    const branchDir = resolve(root, '.aida', 'runs', 'feat-mixed');
    ensureDir(branchDir);

    const now = new Date().toISOString();
    writeJson(resolve(branchDir, 'requirement.json'), {
      branch: 'feat-mixed', title: 'Mixed', summary: '', prdPhases: [], modules: [],
      highlights: [], developers: [], totals: { tasks: 0, completedTasks: 0, bugs: 0, deviations: 0, linesAdded: 0, linesRemoved: 0, totalTokens: 0 },
      createdAt: now, updatedAt: now,
    });

    // dev-a completed, dev-b running
    for (const [dev, status] of [['dev-a', 'completed'], ['dev-b', 'running']]) {
      const devDir = resolve(branchDir, dev);
      ensureDir(devDir);
      writeJson(resolve(devDir, 'run.json'), {
        meta: { branch: 'feat-mixed', developer: dev, status, startTime: now },
        summary: {},
      });
    }

    buildIndex(root);
    const idx = readJson<IndexData>(resolve(root, '.aida', 'index.json'));
    assert.equal(idx.runs[0].status, 'running');
  });

  it('should skip branches without requirement.json', () => {
    const root = setupProject();
    // Create a branch directory with only run.json, no requirement.json
    const branchDir = resolve(root, '.aida', 'runs', 'orphan');
    const devDir = resolve(branchDir, 'dev-a');
    ensureDir(devDir);
    writeJson(resolve(devDir, 'run.json'), { meta: {} });

    const count = buildIndex(root);
    assert.equal(count, 0); // Should not index this branch
  });

  it('should write updatedAt timestamp', () => {
    const root = setupProject();
    addBranch(root, 'feat-1', {});
    buildIndex(root);

    const idx = readJson<IndexData>(resolve(root, '.aida', 'index.json'));
    assert.ok(idx.updatedAt);
    // Should be a valid ISO date
    assert.ok(!isNaN(new Date(idx.updatedAt).getTime()));
  });
});
