import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { ensureDir, writeJson, readJson, fileExists, readText } from '../src/utils/fs.js';
import type { RunData } from '../src/schemas/run-json.js';

let tmpRoot: string;

function setupBareProject(opts?: { branch?: string }): string {
  tmpRoot = mkdtempSync(join(tmpdir(), 'aida-start-'));
  const branch = opts?.branch || 'test-branch';

  // Init git
  execSync('git init', { cwd: tmpRoot, stdio: 'ignore' });
  execSync('git config user.name "test-dev"', { cwd: tmpRoot, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: tmpRoot, stdio: 'ignore' });
  execSync(`git checkout -b ${branch}`, { cwd: tmpRoot, stdio: 'ignore' });

  // Create minimal .aida/config.json (project is "initialized")
  const aidevos = resolve(tmpRoot, '.aida');
  ensureDir(aidevos);
  writeJson(resolve(aidevos, 'config.json'), {
    schemaVersion: '1.0',
    aiTool: 'claude-code',
    project: 'test-project',
    aiModel: 'claude-sonnet-4',
  });

  return tmpRoot;
}

function runStart(root: string, extraArgs = ''): string {
  const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');
  try {
    return execSync(`node ${cliPath} start ${extraArgs}`, {
      cwd: root,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (e: any) {
    return e.stdout || '';
  }
}

afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
});

// ─── run.json structure ───────────────────────────────────

describe('aidevos start', () => {
  it('should create run.json with all required top-level fields', () => {
    const root = setupBareProject();
    runStart(root);

    const runJsonPath = resolve(root, '.aida', 'runs', 'test-branch', 'test-dev', 'run.json');
    assert.ok(fileExists(runJsonPath), 'run.json should be created');

    const data = readJson<Record<string, any>>(runJsonPath);

    // All top-level fields from RunData must exist
    const requiredFields = [
      'meta', 'summary', 'metrics', 'context',
      'tasks', 'deviations', 'bugs', 'reviews', 'rules',
      'files', 'timeline', 'workflow', 'events', 'cost', 'highlights',
    ];
    for (const field of requiredFields) {
      assert.ok(field in data, `Missing top-level field: ${field}`);
    }
  });

  it('should have correct meta fields', () => {
    const root = setupBareProject();
    runStart(root);

    const data = readJson<Record<string, any>>(
      resolve(root, '.aida', 'runs', 'test-branch', 'test-dev', 'run.json'),
    );

    assert.equal(data.meta.schemaVersion, '2.0');
    assert.equal(data.meta.runId, 'test-branch');
    assert.equal(data.meta.project, 'test-project');
    assert.equal(data.meta.developer, 'test-dev');
    assert.equal(data.meta.branch, 'test-branch');
    assert.equal(data.meta.aiModel, 'claude-sonnet-4');
    assert.equal(data.meta.aiTool, 'claude-code');
    assert.equal(data.meta.status, 'running');
    assert.ok(data.meta.startTime);
  });

  it('should initialize summary with all zero counters', () => {
    const root = setupBareProject();
    runStart(root);

    const data = readJson<Record<string, any>>(
      resolve(root, '.aida', 'runs', 'test-branch', 'test-dev', 'run.json'),
    );

    assert.equal(data.summary.totalTasks, 0);
    assert.equal(data.summary.completedTasks, 0);
    assert.equal(data.summary.bugCount, 0);
    assert.equal(data.summary.deviationCount, 0);
    assert.equal(data.summary.reviewCount, 0);
    assert.equal(data.summary.rulesSedimented, 0);
    assert.equal(data.summary.filesChanged, 0);
  });

  it('should initialize all arrays as empty', () => {
    const root = setupBareProject();
    runStart(root);

    const data = readJson<Record<string, any>>(
      resolve(root, '.aida', 'runs', 'test-branch', 'test-dev', 'run.json'),
    );

    for (const arr of ['tasks', 'bugs', 'deviations', 'reviews', 'rules', 'files', 'timeline', 'events', 'workflow', 'highlights']) {
      assert.ok(Array.isArray(data[arr]), `${arr} should be an array`);
      assert.equal(data[arr].length, 0, `${arr} should be empty`);
    }
  });

  it('should NOT have phantom fields in metrics', () => {
    const root = setupBareProject();
    runStart(root);

    const data = readJson<Record<string, any>>(
      resolve(root, '.aida', 'runs', 'test-branch', 'test-dev', 'run.json'),
    );

    // These were removed in the audit - verify they don't come back
    assert.equal('firstPassRate' in data.metrics, false, 'firstPassRate should not exist');
    assert.equal('deviationToRuleRatio' in data.metrics, false, 'deviationToRuleRatio should not exist');
  });

  it('should create shared prd.md and requirement.json at branch level', () => {
    const root = setupBareProject();
    runStart(root);

    const branchDir = resolve(root, '.aida', 'runs', 'test-branch');
    assert.ok(fileExists(resolve(branchDir, 'prd.md')));
    assert.ok(fileExists(resolve(branchDir, 'requirement.json')));
    assert.ok(fileExists(resolve(branchDir, 'analysis.md')));
  });

  it('should create requirement.json with correct structure', () => {
    const root = setupBareProject();
    runStart(root);

    const req = readJson<Record<string, any>>(
      resolve(root, '.aida', 'runs', 'test-branch', 'requirement.json'),
    );

    assert.equal(req.branch, 'test-branch');
    assert.ok(Array.isArray(req.prdPhases));
    assert.ok(Array.isArray(req.modules));
    assert.ok(Array.isArray(req.highlights));
    assert.ok(Array.isArray(req.developers));
    assert.ok(req.totals);
    assert.equal(req.totals.tasks, 0);
    assert.equal(req.totals.totalTokens, 0);
  });

  it('should not overwrite existing run.json', () => {
    const root = setupBareProject();
    runStart(root); // First run
    const output = runStart(root); // Second run
    assert.ok(output.includes('Run already exists'));
  });

  it('should respect --model flag', () => {
    const root = setupBareProject();
    runStart(root, '--model gpt-4o');

    const data = readJson<Record<string, any>>(
      resolve(root, '.aida', 'runs', 'test-branch', 'test-dev', 'run.json'),
    );
    assert.equal(data.meta.aiModel, 'gpt-4o');
  });

  it('should handle branch names with slashes', () => {
    const root = setupBareProject({ branch: 'feature/my-feature' });
    runStart(root);

    // Branch with slash should be converted to dash in directory name
    const runJsonPath = resolve(root, '.aida', 'runs', 'feature-my-feature', 'test-dev', 'run.json');
    assert.ok(fileExists(runJsonPath), 'run.json should be created with sanitized branch dir');
  });
});

// ─── .gitignore management ────────────────────────────────

describe('aidevos start - gitignore', () => {
  it('should add generated AI tool artifacts to .gitignore', () => {
    const root = setupBareProject();
    runStart(root);

    const gitignorePath = resolve(root, '.gitignore');
    assert.ok(fileExists(gitignorePath));
    const content = readText(gitignorePath);
    assert.ok(content.includes('.claude/'));
    assert.ok(content.includes('.aida/**'));
    assert.ok(content.includes('!.aida/**/*.json'));
  });

  it('should not duplicate generated artifact entries on second start', () => {
    const root = setupBareProject();
    // Create a different branch so start creates a new run
    runStart(root);
    rmSync(resolve(root, '.aida', 'runs', 'test-branch', 'test-dev', 'run.json'));
    runStart(root);

    const content = readText(resolve(root, '.gitignore'));
    const matches = content.match(/\.claude\//g);
    assert.equal(matches?.length, 1, 'Should only have one entry');
  });
});
