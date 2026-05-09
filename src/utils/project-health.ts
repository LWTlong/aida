import { readdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileExists, readJson, writeJson } from './fs.js';
import { buildSummary, loadSummary } from './summary.js';
import { buildMemoryViews, loadMemoryIndex, migrateLegacyMemories, rebuildMemoryIndexFromDisk } from './memory.js';
import { rulesRegistryPath, skillsRegistryPath, moduleMemoriesDir, runsDir, configPath, summaryPath, toolConfigStorePath } from './paths.js';
import { loadRegistry, saveRegistry } from './rules.js';
import { loadSkillRegistry, pruneSkillRegistryFor2, saveSkillRegistry } from './skills.js';
import type { RunData } from '../schemas/run-json.js';

export interface ProjectHealthReport {
  initialized: boolean
  rules: { exists: boolean; count: number; legacyRoot: boolean }
  skills: { exists: boolean; count: number; legacyRoot: boolean }
  memories: {
    indexExists: boolean
    indexLegacyRoot: boolean
    moduleCount: number
    nestedLayout: boolean
  }
  summary: {
    exists: boolean
    count: number
  }
  runs: {
    total: number
    legacySchema: number
    runtimeDirExists: boolean
  }
  warnings: string[]
}

export interface ProjectNormalizationResult {
  rules: number
  skills: number
  memories: number
  summary: number
}

function scanRunJsonFiles(rootDir: string): string[] {
  if (!fileExists(rootDir)) return [];
  const files: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of readdirSync(current)) {
      const full = resolve(current, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        stack.push(full);
      } else if (name === 'run.json') {
        files.push(full);
      }
    }
  }

  return files.sort();
}

function hasNestedModuleLayout(rootDir: string): boolean {
  if (!fileExists(rootDir)) return false;
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of readdirSync(current)) {
      const full = resolve(current, name);
      const stat = statSync(full);
      if (!stat.isDirectory()) continue;
      if (current !== rootDir) return true;
      stack.push(full);
    }
  }

  return false;
}

function isLegacyRunSchema(raw: any): boolean {
  return raw?.meta?.schemaVersion !== '2.0' || !raw?.cost || !Array.isArray(raw?.highlights);
}

function compactRunDataFor2(data: RunData): RunData {
  const branch = data.meta?.branch || data.meta?.runId || '';
  const files = (data.files || []).map((file) => ({
    path: file.path,
    changeType: file.changeType,
    linesAdded: file.linesAdded || 0,
    linesRemoved: file.linesRemoved || 0,
    changeCount: file.changeCount || 1,
    lastModified: file.lastModified,
  }));

  const linesAdded = files.reduce((sum, file) => sum + (file.linesAdded || 0), 0);
  const linesRemoved = files.reduce((sum, file) => sum + (file.linesRemoved || 0), 0);

  return {
    meta: {
      ...data.meta,
      schemaVersion: '2.0',
      runId: branch,
      branch,
      status: data.meta?.endTime ? 'completed' : (data.meta?.status || 'running'),
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
      prdPhaseCount: data.summary?.prdPhaseCount || 0,
      filesChanged: files.length,
      linesAdded,
      linesRemoved,
    },
    workflow: [],
    tasks: [],
    bugs: [],
    deviations: [],
    reviews: [],
    files,
    metrics: data.metrics || {},
    timeline: [],
    events: [],
    rules: [],
    context: data.context,
    cost: data.cost || { totalTokens: 0, estimatedManualHours: 0, actualHours: 0, tokenBreakdown: [] },
    highlights: data.highlights || [],
  };
}

function normalizeRunTruthSources(projectRoot: string): number {
  const runFiles = scanRunJsonFiles(runsDir(projectRoot));
  for (const path of runFiles) {
    const raw = readJson<RunData>(path);
    const next = compactRunDataFor2(raw);
    writeJson(path, next);
    const backupPath = path.replace(/run\.json$/u, 'run.backup.json');
    if (fileExists(backupPath)) rmSync(backupPath, { force: true });
  }
  return runFiles.length;
}

function clearModuleMemoryTruthSources(projectRoot: string): void {
  const rootDir = moduleMemoriesDir(projectRoot);
  if (!fileExists(rootDir)) return;
  for (const name of readdirSync(rootDir)) {
    rmSync(resolve(rootDir, name), { recursive: true, force: true });
  }
}

function pruneLegacyProjectArtifacts(projectRoot: string): void {
  const aidaRoot = resolve(projectRoot, '.aida');
  const legacyArtifacts = [
    runsDir(projectRoot),
    resolve(projectRoot, '.aida', 'index.json'),
    toolConfigStorePath(projectRoot),
    resolve(projectRoot, '.aida', 'skills'),
    resolve(projectRoot, '.aida', 'codex'),
    resolve(projectRoot, '.aida', 'claude'),
    resolve(projectRoot, '.aida', 'cursor'),
    resolve(projectRoot, '.aida', 'vscode-copilot'),
    resolve(projectRoot, '.aida', 'windsurf'),
    resolve(projectRoot, '.aida', 'lingma'),
  ];

  for (const path of legacyArtifacts) {
    if (!fileExists(path)) continue;
    rmSync(path, { recursive: true, force: true });
  }

  if (!fileExists(aidaRoot)) return;
  const allowedTopLevel = new Set([
    'aida-guide.md',
    'bootstrap-state.local.json',
    'config.json',
    'memories',
    'rules',
    'rules.json',
    'skills.json',
    'summary.json',
  ]);
  for (const name of readdirSync(aidaRoot)) {
    if (/^skills-backup-\d{4}-\d{2}-\d{2}\.json$/u.test(name)) {
      rmSync(resolve(aidaRoot, name), { force: true });
      continue;
    }
    if (allowedTopLevel.has(name)) continue;
    rmSync(resolve(aidaRoot, name), { recursive: true, force: true });
  }
}

export function inspectProjectHealth(projectRoot: string): ProjectHealthReport {
  const initialized = fileExists(configPath(projectRoot));

  const rulesExists = fileExists(rulesRegistryPath(projectRoot));
  const rulesRaw = rulesExists ? readJson<unknown>(rulesRegistryPath(projectRoot)) : null;
  const rules = loadRegistry(projectRoot);

  const skillsExists = fileExists(skillsRegistryPath(projectRoot));
  const skillsRaw = skillsExists ? readJson<unknown>(skillsRegistryPath(projectRoot)) : null;
  const skills = loadSkillRegistry(projectRoot);

  const memoryIndex = loadMemoryIndex(projectRoot);
  const memoryIndexPath = resolve(projectRoot, '.aida', 'memories', 'index.json');
  const memoryIndexExists = fileExists(memoryIndexPath);
  const memoryIndexRaw = memoryIndexExists ? readJson<any>(memoryIndexPath) : null;
  const memoriesRoot = moduleMemoriesDir(projectRoot);
  const nestedLayout = hasNestedModuleLayout(memoriesRoot);

  const summaryExists = fileExists(summaryPath(projectRoot));
  const summary = loadSummary(projectRoot);
  const runtimeRoot = runsDir(projectRoot);
  const runtimeDirExists = fileExists(runtimeRoot);
  const runFiles = scanRunJsonFiles(runtimeRoot);
  let legacySchema = 0;
  for (const path of runFiles) {
    try {
      const raw = readJson<any>(path);
      if (isLegacyRunSchema(raw)) legacySchema++;
    } catch {
      legacySchema++;
    }
  }

  const warnings: string[] = [];
  if (rulesExists && Array.isArray(rulesRaw)) warnings.push('rules.json still uses legacy array root');
  if (skillsExists && Array.isArray(skillsRaw)) warnings.push('skills.json still uses legacy array root');
  if (memoryIndexExists && Array.isArray(memoryIndexRaw?.modules)) warnings.push('memories/index.json still uses legacy modules root');
  if (nestedLayout) warnings.push('memories/modules still contains nested legacy layout');
  if (!summaryExists) warnings.push('summary.json is missing');
  if (legacySchema > 0) warnings.push(`${legacySchema} run.json file(s) still need schema migration`);
  if (runtimeDirExists) warnings.push('legacy .aida/runs runtime directory still exists');

  return {
    initialized,
    rules: {
      exists: rulesExists,
      count: rules.length,
      legacyRoot: Array.isArray(rulesRaw),
    },
    skills: {
      exists: skillsExists,
      count: skills.length,
      legacyRoot: Array.isArray(skillsRaw),
    },
    memories: {
      indexExists: memoryIndexExists,
      indexLegacyRoot: Array.isArray(memoryIndexRaw?.modules),
      moduleCount: memoryIndex.items.length,
      nestedLayout,
    },
    summary: {
      exists: summaryExists,
      count: summary.length,
    },
    runs: {
      total: runFiles.length,
      legacySchema,
      runtimeDirExists,
    },
    warnings,
  };
}

export function normalizeProjectTruthSources(projectRoot: string): ProjectNormalizationResult {
  const rules = loadRegistry(projectRoot);
  saveRegistry(projectRoot, rules);

  const skills = pruneSkillRegistryFor2(loadSkillRegistry(projectRoot));
  saveSkillRegistry(projectRoot, skills);

  const hasRuntime = scanRunJsonFiles(runsDir(projectRoot)).length > 0;
  let summaryCount = loadSummary(projectRoot).length;
  let memoryIndex;

  if (hasRuntime) {
    normalizeRunTruthSources(projectRoot);
    clearModuleMemoryTruthSources(projectRoot);
    migrateLegacyMemories(projectRoot);
    memoryIndex = rebuildMemoryIndexFromDisk(projectRoot);
    const summaryIndex = buildSummary(projectRoot);
    summaryCount = summaryIndex?.runs.length || 0;
  } else {
    buildMemoryViews(projectRoot);
    memoryIndex = loadMemoryIndex(projectRoot);
  }

  pruneLegacyProjectArtifacts(projectRoot);

  return {
    rules: rules.length,
    skills: skills.length,
    memories: memoryIndex.items.length,
    summary: summaryCount,
  };
}
