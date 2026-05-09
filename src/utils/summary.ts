import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RunContextRecord, SummaryEntry } from '../schemas/aida-project.js';
import type { IndexData, IndexRunEntry, RequirementData } from '../schemas/run-json.js';
import { fileExists, readJson, writeJson } from './fs.js';
import { normalizeModuleKey } from './memory.js';
import { configPath, indexPath, runContextPath, runsDir, summaryPath } from './paths.js';
import { readRegistryEnvelope, writeRegistryEnvelope } from './registry.js';

function buildLegacyIndexRunEntry(
  branch: string,
  requirement: RequirementData,
  branchPath: string,
): IndexRunEntry {
  let status = 'running';
  let startTime = requirement.createdAt || '';
  let endTime: string | undefined;

  const devDirs = readdirSync(branchPath).filter((name) => {
    const path = resolve(branchPath, name);
    return statSync(path).isDirectory() && fileExists(resolve(path, 'run.json'));
  });

  let allCompleted = devDirs.length > 0;
  for (const dev of devDirs) {
    const runData = readJson<Record<string, any>>(resolve(branchPath, dev, 'run.json'));
    const meta = runData.meta || {};
    if (meta.startTime && (!startTime || meta.startTime < startTime)) {
      startTime = meta.startTime;
    }
    if (meta.endTime && (!endTime || meta.endTime > endTime)) {
      endTime = meta.endTime;
    }
    if (meta.status !== 'completed') {
      allCompleted = false;
    }
  }

  if (allCompleted && devDirs.length > 0) status = 'completed';

  return {
    branch: requirement.branch || branch,
    title: requirement.title || branch,
    summary: requirement.summary || '',
    status,
    startTime,
    endTime,
    developers: requirement.developers || [],
    highlights: requirement.highlights || [],
    totals: requirement.totals || {
      tasks: 0,
      completedTasks: 0,
      bugs: 0,
      deviations: 0,
      linesAdded: 0,
      linesRemoved: 0,
      totalTokens: 0,
    },
  };
}

function buildLegacyIndexRunEntryFromContext(
  branch: string,
  branchPath: string,
  context: RunContextRecord,
): IndexRunEntry {
  let status = context.currentPhase === 'Completed' ? 'completed' : 'running';
  let startTime = '';
  let endTime: string | undefined;
  let totalTokens = 0;
  let linesAdded = 0;
  let linesRemoved = 0;

  const devDirs = readdirSync(branchPath).filter((name) => {
    const path = resolve(branchPath, name);
    return statSync(path).isDirectory() && fileExists(resolve(path, 'run.json'));
  });

  for (const dev of devDirs) {
    const runData = readJson<Record<string, any>>(resolve(branchPath, dev, 'run.json'));
    const meta = runData.meta || {};
    const cost = runData.cost || {};
    const summary = runData.summary || {};
    if (meta.startTime && (!startTime || meta.startTime < startTime)) {
      startTime = meta.startTime;
    }
    if (meta.endTime && (!endTime || meta.endTime > endTime)) {
      endTime = meta.endTime;
    }
    if (meta.status === 'completed') status = 'completed';
    totalTokens += cost.totalTokens || 0;
    linesAdded += summary.linesAdded || 0;
    linesRemoved += summary.linesRemoved || 0;
  }

  return {
    branch: context.branch || branch,
    title: context.title || branch,
    summary: context.summary || '',
    status,
    startTime,
    endTime,
    developers: [],
    highlights: [],
    totals: {
      tasks: 0,
      completedTasks: 0,
      bugs: 0,
      deviations: 0,
      linesAdded,
      linesRemoved,
      totalTokens,
    },
  };
}

function isPlaceholderSummary(value: string | undefined, branch: string, fallbackTitle: string): boolean {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return true;
  return normalized === branch.trim().toLowerCase() || normalized === fallbackTitle.trim().toLowerCase();
}

function summaryEntryFromIndexRun(
  run: IndexRunEntry,
  moduleNames: string[] = [],
  context: RunContextRecord | null = null,
): SummaryEntry {
  const mergedModules = [...new Set(
    [...moduleNames, ...run.developers.flatMap((dev) => dev.modules || []).filter(Boolean)]
      .map(normalizeDisplayModuleName)
      .map(normalizeModuleKey)
      .filter(Boolean),
  )];
  const fallbackTitle = run.title || run.branch;
  const contextTitle = context?.title?.trim() || '';
  const title = contextTitle && contextTitle !== run.branch ? contextTitle : fallbackTitle;
  const contextSummary = context?.summary?.trim() || '';
  const summary = !isPlaceholderSummary(contextSummary, run.branch, title)
    ? contextSummary
    : (run.summary || contextSummary || '');
  const highlights = (run.highlights || []).map((item) => item.content).filter(Boolean).slice(0, 8);
  const status = context?.currentPhase === 'Completed'
    ? 'completed'
    : context?.currentPhase === 'Planned'
      ? 'pending'
      : run.status || 'running';
  return {
    branch: run.branch,
    ticket: context?.ticket || run.title.match(/\b([A-Z]{2,}-\d+)\b/u)?.[1],
    title,
    summary,
    modules: mergedModules,
    highlights,
    status,
    keyFiles: (context?.keyFiles || []).filter(Boolean).slice(0, 8),
    updatedAt: context?.updatedAt || run.endTime || run.startTime || new Date().toISOString(),
  };
}

function normalizeDisplayModuleName(value: string): string {
  return value.trim().replace(/\s*\/\s*/g, '/');
}

function loadContext(projectRoot: string, branch: string): RunContextRecord | null {
  const path = runContextPath(projectRoot, branch);
  if (!fileExists(path)) return null;
  try {
    return readJson<RunContextRecord>(path);
  } catch {
    return null;
  }
}

export function loadSummary(projectRoot: string): SummaryEntry[] {
  const path = summaryPath(projectRoot);
  if (!fileExists(path)) return [];
  try {
    return readRegistryEnvelope<SummaryEntry>(path).items;
  } catch {
    return [];
  }
}

export function loadIndexData(projectRoot: string): IndexData | null {
  const path = indexPath(projectRoot);
  if (!fileExists(path)) {
    const summary = loadSummary(projectRoot);
    if (summary.length === 0) return null;
    return {
      project: '',
      updatedAt: new Date().toISOString(),
      runs: summary.map((entry) => ({
        branch: entry.branch,
        title: entry.title,
        summary: entry.summary,
        status: entry.status,
        startTime: '',
        endTime: undefined,
        developers: [],
        highlights: (entry.highlights || []).map((content) => ({
          content,
          source: 'auto',
          createdAt: entry.updatedAt,
        })),
        totals: {
          tasks: 0,
          completedTasks: 0,
          bugs: 0,
          deviations: 0,
          linesAdded: 0,
          linesRemoved: 0,
          totalTokens: 0,
        },
      })),
    };
  }
  try {
    return readJson<IndexData>(path);
  } catch {
    return null;
  }
}

export function saveSummary(projectRoot: string, items: SummaryEntry[]): void {
  writeRegistryEnvelope(summaryPath(projectRoot), items);
}

export function buildSummary(projectRoot: string): IndexData | null {
  const theRunsDir = runsDir(projectRoot);
  if (!fileExists(theRunsDir)) return null;

  let config: Record<string, any> = {};
  try {
    config = fileExists(configPath(projectRoot)) ? readJson<Record<string, any>>(configPath(projectRoot)) : {};
  } catch {
    config = {};
  }

  let branches: string[];
  try {
    branches = readdirSync(theRunsDir).filter((name) => statSync(resolve(theRunsDir, name)).isDirectory());
  } catch {
    return null;
  }

  const runs: IndexRunEntry[] = [];
  const summaryEntries: SummaryEntry[] = [];
  for (const branch of branches) {
    const branchPath = resolve(theRunsDir, branch);
    const reqPath = resolve(branchPath, 'requirement.json');
    const context = loadContext(projectRoot, branch);
    const hasRequirement = fileExists(reqPath);
    if (!hasRequirement && !context) continue;

    try {
      const requirement = hasRequirement ? readJson<RequirementData>(reqPath) : null;
      const run = requirement
        ? buildLegacyIndexRunEntry(branch, requirement, branchPath)
        : buildLegacyIndexRunEntryFromContext(branch, branchPath, context!);
      const requirementModules = ((requirement?.modules || []) as Array<{ name: string }>)
        .map((module) => normalizeDisplayModuleName(module.name))
        .map(normalizeModuleKey)
        .filter(Boolean);
      const contextModules = context?.modules || [];
      runs.push(run);
      summaryEntries.push(summaryEntryFromIndexRun(
        run,
        contextModules.length > 0 ? contextModules : requirementModules,
        context,
      ));
    } catch {
      // skip invalid requirement.json
    }
  }

  const index: IndexData = {
    project: config.project || '',
    updatedAt: new Date().toISOString(),
    runs,
  };

  saveSummary(projectRoot, summaryEntries);
  return index;
}

export function rebuildSummaryIndex(projectRoot: string): number {
  const index = buildSummary(projectRoot);
  return index?.runs.length ?? -1;
}
