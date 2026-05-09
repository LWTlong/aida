import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IndexData, RequirementData } from '../schemas/run-json.js';
import { recalcMetrics } from '../utils/run-data.js';
import { loadIndexData as loadProjectIndexData } from '../utils/summary.js';

export interface RunSummary {
  runId: string;
  branch: string;
  developer: string;
  aiModel: string;
  status: string;
  startTime: string;
  totalTasks: number;
  completedTasks: number;
  deviationCount: number;
  bugCount: number;
  reviewPassRate: number;
  rulesSedimented: number;
  filesChanged: number;
  totalDevTimeSeconds: number;
  actualWorkSeconds: number;
}

export function getAllRuns(runsDir: string): RunSummary[] {
  const runs: RunSummary[] = [];
  if (!existsSync(runsDir)) return runs;

  let branches: string[];
  try {
    branches = readdirSync(runsDir).filter((f) =>
      statSync(resolve(runsDir, f)).isDirectory(),
    );
  } catch {
    return runs;
  }

  for (const branch of branches) {
    const branchDir = resolve(runsDir, branch);
    let devs: string[];
    try {
      devs = readdirSync(branchDir).filter((f) => {
        const p = resolve(branchDir, f);
        return statSync(p).isDirectory() && existsSync(resolve(p, 'run.json'));
      });
    } catch {
      continue;
    }

    for (const dev of devs) {
      const runJson = resolve(branchDir, dev, 'run.json');
      if (!existsSync(runJson)) continue;

      try {
        const data = JSON.parse(readFileSync(runJson, 'utf-8'));
        const summary = data.summary || {};
        const meta = data.meta || {};
        const metrics = data.metrics || {};
        runs.push({
          runId: `${branch}/${dev}`,
          branch: meta.branch || branch,
          developer: meta.developer || dev,
          aiModel: meta.aiModel || '',
          status: meta.status || 'unknown',
          startTime: meta.startTime || '',
          totalTasks: summary.totalTasks || 0,
          completedTasks: summary.completedTasks || 0,
          deviationCount: summary.deviationCount || 0,
          bugCount: summary.bugCount || 0,
          reviewPassRate: metrics.reviewPassRate || 0,
          rulesSedimented: summary.rulesSedimented || 0,
          filesChanged: summary.filesChanged || 0,
          totalDevTimeSeconds: metrics.totalDevelopmentTimeSeconds || 0,
          actualWorkSeconds: metrics.actualWorkSeconds || 0,
        });
      } catch {
        /* skip invalid run.json */
      }
    }
  }

  return runs;
}

export function getRunData(
  runsDir: string,
  branch: string,
  dev: string,
  projectRoot?: string,
): Record<string, any> | null {
  const runJson = resolve(runsDir, branch, dev, 'run.json');
  if (!existsSync(runJson)) return null;

  try {
    const data = JSON.parse(readFileSync(runJson, 'utf-8'));
    // Normalize: ensure all expected top-level fields exist
    data.meta = data.meta || {};
    data.summary = data.summary || {};
    data.metrics = data.metrics || {};
    data.workflow = Array.isArray(data.workflow) ? data.workflow : [];
    data.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    data.bugs = Array.isArray(data.bugs) ? data.bugs : [];
    data.deviations = Array.isArray(data.deviations) ? data.deviations : [];
    data.reviews = Array.isArray(data.reviews) ? data.reviews : [];
    data.files = Array.isArray(data.files) ? data.files : [];
    data.timeline = Array.isArray(data.timeline) ? data.timeline : [];
    data.events = Array.isArray(data.events) ? data.events : [];
    data.rules = Array.isArray(data.rules) ? data.rules : [];
    data.highlights = Array.isArray(data.highlights) ? data.highlights : [];
    data.cost = data.cost || {};
    data.context = data.context || {};
    // Ensure prdPhaseCount is populated
    if (data.summary.prdPhaseCount == null && data.meta.prdPhases) {
      data.summary.prdPhaseCount = data.meta.prdPhases.length;
    }
    // Always recalc metrics with latest formula
    if (projectRoot) {
      recalcMetrics(data, projectRoot);
    }
    return data;
  } catch {
    return null;
  }
}

export function getRequirementData(
  runsDir: string,
  branch: string,
): RequirementData | null {
  const reqPath = resolve(runsDir, branch, 'requirement.json');
  if (!existsSync(reqPath)) return null;
  try {
    return JSON.parse(readFileSync(reqPath, 'utf-8'));
  } catch {
    return null;
  }
}

export function getIndexData(projectRoot: string): IndexData | null {
  return loadProjectIndexData(projectRoot);
}

export function updateRunCost(
  runsDir: string,
  branch: string,
  dev: string,
  updates: { estimatedManualHours?: number },
  projectRoot: string,
): boolean {
  const runJson = resolve(runsDir, branch, dev, 'run.json');
  if (!existsSync(runJson)) return false;

  try {
    const data = JSON.parse(readFileSync(runJson, 'utf-8'));
    if (!data.cost) data.cost = {};
    if (updates.estimatedManualHours != null) {
      data.cost.estimatedManualHours = updates.estimatedManualHours;
    }
    recalcMetrics(data, projectRoot);
    data.context = data.context || {};
    data.context.lastUpdated = new Date().toISOString();
    writeFileSync(runJson, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export function updateProjectConfig(
  projectRoot: string,
  updates: { hourlyRate?: number },
): boolean {
  const cfgPath = resolve(projectRoot, '.aida', 'config.json');
  try {
    let cfg: Record<string, any> = {};
    if (existsSync(cfgPath)) {
      cfg = JSON.parse(readFileSync(cfgPath, 'utf-8'));
    }
    if (updates.hourlyRate != null) {
      cfg.hourlyRate = updates.hourlyRate;
    }
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export function getAggregatedData(runsDir: string): Record<string, any> {
  const runs = getAllRuns(runsDir);
  const allTasks: any[] = [];
  const allDeviations: any[] = [];
  const allBugs: any[] = [];
  const allReviews: any[] = [];
  const allRules: any[] = [];
  const allTimeline: any[] = [];
  const allWorkflow: any[] = [];
  const allFiles: any[] = [];
  const allHighlights: any[] = [];
  const prdPhasesSet = new Set<string>();
  let totalTasks = 0, completedTasks = 0, deviationCount = 0, bugCount = 0;
  let reviewCount = 0, reviewPassCount = 0, reviewFailCount = 0;
  let rulesSedimented = 0, filesChanged = 0, prdPhaseCount = 0;

  for (const run of runs) {
    const parts = run.runId.split('/');
    if (parts.length < 2) continue;
    const data = getRunData(runsDir, parts[0], parts[1]);
    if (!data) continue;

    allTasks.push(...(data.tasks || []));
    allDeviations.push(...(data.deviations || []));
    allBugs.push(...(data.bugs || []));
    allReviews.push(...(data.reviews || []));
    allRules.push(...(data.rules || []));
    allTimeline.push(...(data.timeline || []));
    allWorkflow.push(...(data.workflow || []));
    allFiles.push(...(data.files || []));
    allHighlights.push(...(data.highlights || []));

    const s = data.summary || {};
    totalTasks += s.totalTasks || 0;
    completedTasks += s.completedTasks || 0;
    deviationCount += s.deviationCount || 0;
    bugCount += s.bugCount || 0;
    reviewCount += s.reviewCount || 0;
    reviewPassCount += s.reviewPassCount || 0;
    reviewFailCount += s.reviewFailCount || 0;
    rulesSedimented += s.rulesSedimented || 0;
    filesChanged += s.filesChanged || 0;

    const meta = data.meta || {};
    if (meta.prdPhases) {
      meta.prdPhases.forEach((p: string) => prdPhasesSet.add(p));
    }
  }

  prdPhaseCount = prdPhasesSet.size;

  // Sort timeline by timestamp
  allTimeline.sort((a: any, b: any) => {
    const ta = a.timestamp || '';
    const tb = b.timestamp || '';
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });

  return {
    meta: {
      branch: 'All Runs',
      developer: `${runs.length} runs`,
      aiModel: '',
      status: 'aggregated',
      startTime: runs.length > 0 ? runs.reduce((min, r) => r.startTime < min ? r.startTime : min, runs[0].startTime) : '',
      prdPhases: [...prdPhasesSet],
    },
    summary: {
      totalTasks, completedTasks, deviationCount, bugCount,
      reviewCount, reviewPassCount, reviewFailCount,
      rulesSedimented, filesChanged, prdPhaseCount,
    },
    metrics: {},
    tasks: allTasks,
    deviations: allDeviations,
    bugs: allBugs,
    reviews: allReviews,
    rules: allRules,
    timeline: allTimeline,
    workflow: allWorkflow,
    files: allFiles,
    highlights: allHighlights,
    events: [],
    context: {},
    cost: {},
  };
}
