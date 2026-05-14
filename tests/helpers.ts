/**
 * Test helpers: create isolated temp project directories for each test
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';
import { ensureDir, writeJson, writeText, readJson } from '../src/utils/fs.js';
import { parseRegistryEnvelope } from '../src/utils/registry.js';
import type { ModuleMemoryIndex } from '../src/schemas/aida-project.js';

export interface TestProject {
  root: string;
  branch: string;
  dev: string;
  runJsonPath: string;
  configPath: string;
  cleanup: () => void;
}

/**
 * Create an isolated temp directory that matches the current internal
 * test fixture layout, including branch data under .aida/runs when needed.
 */
export function createTestProject(opts?: {
  branch?: string;
  dev?: string;
  runData?: Record<string, any>;
}): TestProject {
  const root = mkdtempSync(join(tmpdir(), 'aida-test-'));
  const branch = opts?.branch || 'test-branch';
  const dev = opts?.dev || 'test-dev';
  const safeBranch = branch.replace(/\//g, '-');

  // Init git repo
  execSync('git init', { cwd: root, stdio: 'ignore' });
  execSync(`git config user.name "${dev}"`, { cwd: root, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: root, stdio: 'ignore' });
  // Create a branch with the right name
  execSync(`git checkout -b ${branch}`, { cwd: root, stdio: 'ignore' });

  // Create .aida structure
  const aidevos = resolve(root, '.aida');
  ensureDir(aidevos);
  ensureDir(resolve(aidevos, 'rules'));
  ensureDir(resolve(aidevos, 'runs', safeBranch));

  const devDir = resolve(aidevos, 'runs', safeBranch, dev);
  ensureDir(devDir);

  // Write config.json
  const cfgPath = resolve(aidevos, 'config.json');
  writeJson(cfgPath, {
    schemaVersion: '1.0',
    aiTool: 'claude-code',
    project: 'test-project',
  });

  // Write internal branch runtime fixture
  const runJsonPath = resolve(devDir, 'run.json');
  const now = new Date().toISOString();
  const defaultRunData = {
    meta: {
      schemaVersion: '2.0',
      runId: branch,
      project: 'test-project',
      developer: dev,
      branch,
      aiModel: '',
      aiTool: 'claude-code',
      startTime: now,
      endTime: null,
      status: 'running',
      prdPhases: [],
    },
    summary: {
      totalTasks: 0,
      completedTasks: 0,
      bugCount: 0,
      deviationCount: 0,
      reviewCount: 0,
      reviewPassCount: 0,
      reviewFailCount: 0,
      rulesSedimented: 0,
      prdPhaseCount: 0,
      filesChanged: 0,
      linesAdded: 0,
      linesRemoved: 0,
    },
    workflow: [],
    tasks: [],
    bugs: [],
    deviations: [],
    reviews: [],
    files: [],
    metrics: {},
    timeline: [],
    events: [],
    rules: [],
    context: {
      currentPrdPhase: null,
      currentTaskId: null,
      currentStage: null,
      lastUpdated: now,
    },
    cost: {
      totalTokens: 0,
      estimatedManualHours: 0,
      actualHours: 0,
      tokenBreakdown: [],
    },
    highlights: [],
  };

  writeJson(runJsonPath, opts?.runData || defaultRunData);

  // Write requirement.json at branch level
  const reqPath = resolve(aidevos, 'runs', safeBranch, 'requirement.json');
  writeJson(reqPath, {
    branch,
    title: '',
    summary: '',
    prdPhases: [],
    modules: [],
    highlights: [],
    developers: [],
    totals: { tasks: 0, completedTasks: 0, bugs: 0, deviations: 0, linesAdded: 0, linesRemoved: 0, totalTokens: 0 },
    createdAt: now,
    updatedAt: now,
  });

  return {
    root,
    branch,
    dev,
    runJsonPath,
    configPath: cfgPath,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

/**
 * Run an AIDA CLI command in a test project directory.
 * Returns the internal runtime data after execution.
 */
export function runCli(project: TestProject, args: string): Record<string, any> {
  const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');
  try {
    execSync(`node ${cliPath} ${args}`, {
      cwd: project.root,
      encoding: 'utf-8',
      stdio: 'pipe',
      env: { ...process.env, HOME: project.root },
    });
  } catch (e: any) {
    // Some commands may "fail" but still write data
    if (e.stderr) console.error('CLI stderr:', e.stderr);
  }
  return readJson<Record<string, any>>(project.runJsonPath);
}

/**
 * Run CLI and return stdout
 */
export function runCliOutput(project: TestProject, args: string): string {
  const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');
  try {
    return execSync(`node ${cliPath} ${args}`, {
      cwd: project.root,
      encoding: 'utf-8',
      stdio: 'pipe',
      env: { ...process.env, HOME: project.root },
    });
  } catch (e: any) {
    return e.stdout || '';
  }
}

/**
 * Run CLI with stdin input and return stdout.
 */
export function runCliWithInput(project: TestProject, args: string, input: string): string {
  const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');
  try {
    return execSync(`node ${cliPath} ${args}`, {
      cwd: project.root,
      encoding: 'utf-8',
      stdio: 'pipe',
      input,
      env: { ...process.env, HOME: project.root },
    });
  } catch (e: any) {
    return e.stdout || '';
  }
}

export function readRegistryItems<T>(path: string): T[] {
  return parseRegistryEnvelope<T>(readJson<unknown>(path)).items;
}

export function readRuleRegistryItems(projectRoot: string): any[] {
  return readRegistryItems(resolve(projectRoot, '.aida', 'rules.json'));
}

export function readSkillRegistryItems(projectRoot: string): any[] {
  return readRegistryItems(resolve(projectRoot, '.aida', 'skills.json'));
}

export function readMemoryIndex(projectRoot: string): ModuleMemoryIndex {
  const raw = readJson<any>(resolve(projectRoot, '.aida', 'memories', 'index.json'));
  return {
    schemaVersion: raw?.schemaVersion || '2.0',
    updatedAt: raw?.updatedAt || '',
    items: Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.modules) ? raw.modules : [],
  };
}
