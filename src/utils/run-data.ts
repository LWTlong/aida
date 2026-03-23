/**
 * Shared run.json read/write logic.
 *
 * Used by both CLI (log.ts) and MCP Server (server.ts).
 * Single source of truth for data manipulation.
 */

import { resolve } from 'node:path';
import { getBranchName, getDevName, isGitRepo } from './git.js';
import { runDir, branchDir, configPath, aidevosDir } from './paths.js';
import { ensureDir, fileExists, readJson, writeJson, writeText } from './fs.js';
import type {
  RunData,
  RequirementData,
  DeveloperSummary,
  HighlightItem,
} from '../schemas/run-json.js';

// ─── Helpers ─────────────────────────────────────────────

export function now(): string {
  return new Date().toISOString();
}

export function nextId(arr: any[], prefix: string): string {
  const nums = arr
    .map((item: any) => {
      const id: string = item.taskId || item.bugId || item.deviationId || item.reviewId || item.ruleId || '';
      const match = id.match(new RegExp(`^${prefix}-(\\d+)$`));
      return match ? parseInt(match[1]) : 0;
    })
    .filter((n: number) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  const pad = prefix === 'RULE' ? 3 : 2;
  return `${prefix}-${String(max + 1).padStart(pad, '0')}`;
}

export function addEvent(data: RunData, type: string, eventData: Record<string, any>): void {
  data.events.push({ type, time: now(), data: eventData });
}

export function addTimeline(data: RunData, type: string, title: string): void {
  data.timeline.push({ type, title, timestamp: now() });
}

// ─── Config ──────────────────────────────────────────────

export function loadConfig(projectRoot: string): Record<string, any> {
  try {
    const cfgPath = configPath(projectRoot);
    if (fileExists(cfgPath)) return readJson<Record<string, any>>(cfgPath);
  } catch { /* ignore */ }
  return {};
}

// ─── Metrics Recalculation ───────────────────────────────

export function recalcMetrics(data: RunData, projectRoot?: string): void {
  const s = data.summary;
  const m = data.metrics;
  const totalTasks = s.totalTasks || 0;
  const reviewCount = s.reviewCount || 0;

  m.aiDeviationRate = totalTasks > 0 ? Math.round((s.deviationCount || 0) / totalTasks * 100 * 100) / 100 : 0;
  m.bugRate = totalTasks > 0 ? Math.round((s.bugCount || 0) / totalTasks * 100 * 100) / 100 : 0;
  m.reviewPassRate = reviewCount > 0 ? Math.round((s.reviewPassCount || 0) / reviewCount * 100 * 100) / 100 : 0;
  m.rulesSedimentedCount = s.rulesSedimented || 0;

  const totalLines = (s.linesAdded || 0) + (s.linesRemoved || 0);
  m.averageLinesPerTask = totalTasks > 0 ? Math.round(totalLines / totalTasks) : 0;

  if (data.meta?.startTime) {
    const elapsed = (Date.now() - new Date(data.meta.startTime).getTime()) / 1000;
    m.totalDevelopmentTimeSeconds = Math.round(elapsed);
    const hours = elapsed / 3600;
    m.developmentVelocity = hours > 0 ? Math.round((s.completedTasks || 0) / hours * 100) / 100 : 0;
  }

  // Node time breakdown
  const nodeTimes: Record<string, number> = {};
  for (const w of data.workflow) {
    if (w.startTime && w.endTime) {
      const sec = (new Date(w.endTime).getTime() - new Date(w.startTime).getTime()) / 1000;
      if (sec > 0) nodeTimes[w.stage] = (nodeTimes[w.stage] || 0) + sec;
    }
  }

  let codeGenTotal = 0;
  for (const t of data.tasks) {
    if (t.startedAt && t.completedAt) {
      const sec = (new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime()) / 1000;
      if (sec > 0) codeGenTotal += sec;
    }
  }
  if (codeGenTotal > 0) nodeTimes['Code Generation'] = codeGenTotal;

  let bugFixTotal = 0;
  for (const b of data.bugs) {
    if (b.reportedAt && b.fixedAt) {
      const sec = (new Date(b.fixedAt).getTime() - new Date(b.reportedAt).getTime()) / 1000;
      if (sec > 0) bugFixTotal += sec;
    }
  }
  if (bugFixTotal > 0) nodeTimes['Bug Fix'] = bugFixTotal;

  let devFixTotal = 0;
  for (const d of data.deviations) {
    if (d.detectedAt && d.fixedAt) {
      const sec = (new Date(d.fixedAt).getTime() - new Date(d.detectedAt).getTime()) / 1000;
      if (sec > 0) devFixTotal += sec;
    }
  }
  if (devFixTotal > 0) nodeTimes['Deviation Fix'] = devFixTotal;

  m.nodeTimeBreakdown = nodeTimes;
  m.actualWorkSeconds = Math.round(Object.values(nodeTimes).reduce((a, b) => a + b, 0));

  // Efficiency multiplier
  const actualHours = (m.actualWorkSeconds || 0) / 3600;
  if (data.cost?.estimatedManualHours && actualHours > 0) {
    m.efficiencyMultiplier = Math.round(data.cost.estimatedManualHours / actualHours * 10) / 10;
  }

  // ROI calculation
  const config = projectRoot ? loadConfig(projectRoot) : {};
  const hourlyRate = config.hourlyRate || 0;
  const totalTokens = data.cost?.totalTokens || 0;
  const estimatedManualHours = data.cost?.estimatedManualHours || 0;
  const detail = (data.cost as any)?.tokenDetail;

  // Calculate tokenCost: prefer tokenDetail with real pricing, fallback to config flat rate
  if (detail && (detail.inputTokens || detail.outputTokens || detail.cacheCreationTokens || detail.cacheReadTokens)) {
    // Claude pricing (per 1M tokens): input $3, output $15, cache creation $3.75, cache read $0.30
    const inputCost = (detail.inputTokens || 0) / 1_000_000 * 3;
    const outputCost = (detail.outputTokens || 0) / 1_000_000 * 15;
    const cacheCreateCost = (detail.cacheCreationTokens || 0) / 1_000_000 * 3.75;
    const cacheReadCost = (detail.cacheReadTokens || 0) / 1_000_000 * 0.30;
    m.tokenCost = Math.round((inputCost + outputCost + cacheCreateCost + cacheReadCost) * 100) / 100;
  } else if (totalTokens > 0 && config.tokenPricePer1M) {
    m.tokenCost = Math.round(totalTokens / 1_000_000 * config.tokenPricePer1M * 100) / 100;
  }

  if (estimatedManualHours > 0 && actualHours > 0) {
    m.hoursSaved = Math.round((estimatedManualHours - actualHours) * 10) / 10;
  }
  if (m.hoursSaved && hourlyRate > 0) {
    m.moneySaved = Math.round(m.hoursSaved * hourlyRate * 100) / 100;
  }
  if (m.moneySaved && m.tokenCost && m.tokenCost > 0) {
    m.roi = Math.round((m.moneySaved - m.tokenCost) / m.tokenCost * 100 * 100) / 100;
  }
}

// ─── Requirement Sync ────────────────────────────────────

export function updateRequirement(data: RunData, projectRoot: string): void {
  try {
    const branch = data.meta?.branch;
    if (!branch) return;

    const reqPath = resolve(branchDir(projectRoot, branch), 'requirement.json');
    const bDir = branchDir(projectRoot, branch);
    ensureDir(bDir);

    let req: RequirementData;
    if (fileExists(reqPath)) {
      req = readJson<RequirementData>(reqPath);
    } else {
      req = {
        branch, title: '', summary: '', prdPhases: [], modules: [], highlights: [], developers: [],
        totals: { tasks: 0, completedTasks: 0, bugs: 0, deviations: 0, linesAdded: 0, linesRemoved: 0, totalTokens: 0 },
        createdAt: now(), updatedAt: '',
      };
    }

    const devName = data.meta?.developer || '';
    if (!devName) return;

    const s = data.summary || {} as any;
    const m = data.metrics || {} as any;
    const reviewCount = s.reviewCount || 0;
    const reviewPassCount = s.reviewPassCount || 0;

    const devSummary: DeveloperSummary = {
      name: devName,
      modules: req.modules.filter(mod => mod.assignee === devName).map(mod => mod.name),
      tasks: s.totalTasks || 0,
      completedTasks: s.completedTasks || 0,
      bugs: s.bugCount || 0,
      deviations: s.deviationCount || 0,
      linesAdded: s.linesAdded || 0,
      linesRemoved: s.linesRemoved || 0,
      firstPassRate: reviewCount > 0 ? Math.round(reviewPassCount / reviewCount * 100) / 100 : 0,
      actualWorkSeconds: m.actualWorkSeconds || 0,
      totalTokens: data.cost?.totalTokens || 0,
    };

    const idx = req.developers.findIndex(d => d.name === devName);
    if (idx >= 0) req.developers[idx] = devSummary;
    else req.developers.push(devSummary);

    req.totals = {
      tasks: req.developers.reduce((a, d) => a + d.tasks, 0),
      completedTasks: req.developers.reduce((a, d) => a + d.completedTasks, 0),
      bugs: req.developers.reduce((a, d) => a + d.bugs, 0),
      deviations: req.developers.reduce((a, d) => a + d.deviations, 0),
      linesAdded: req.developers.reduce((a, d) => a + d.linesAdded, 0),
      linesRemoved: req.developers.reduce((a, d) => a + d.linesRemoved, 0),
      totalTokens: req.developers.reduce((a, d) => a + d.totalTokens, 0),
    };

    if (data.highlights?.length) {
      const existing = new Set(req.highlights.map((h: HighlightItem) => h.content));
      for (const h of data.highlights) {
        if (!existing.has(h.content)) { req.highlights.push(h); existing.add(h.content); }
      }
    }

    if (!req.title && data.meta?.branch) {
      req.title = data.meta.branch;
    }

    req.updatedAt = now();
    writeJson(reqPath, req);
  } catch {
    // Non-critical: don't block run.json writes
  }
}

// ─── Save (recalc + persist + sync) ─────────────────────

export function saveRunData(path: string, data: RunData, projectRoot: string): void {
  data.context.lastUpdated = now();
  recalcMetrics(data, projectRoot);
  writeJson(path, data);
  updateRequirement(data, projectRoot);
}

// ─── Load / Normalize ────────────────────────────────────

export function normalizeRunData(data: RunData): RunData {
  for (const key of ['tasks', 'bugs', 'deviations', 'reviews', 'rules', 'files', 'timeline', 'events', 'workflow', 'highlights']) {
    if (!Array.isArray((data as any)[key])) (data as any)[key] = [];
  }
  if (!data.summary) data.summary = {} as any;
  if (!data.meta) data.meta = {} as any;
  if (!data.context) data.context = {};
  if (!data.metrics) data.metrics = {};
  if (!data.cost) data.cost = {};
  return data;
}

/**
 * Load existing run.json for current git branch/dev.
 * Returns null if not found.
 */
export function loadRunJson(projectRoot: string): { path: string; data: RunData } | null {
  if (!fileExists(configPath(projectRoot))) return null;
  if (!isGitRepo()) return null;

  const branch = getBranchName();
  const dev = getDevName();
  const dir = runDir(projectRoot, branch, dev);
  const p = resolve(dir, 'run.json');
  if (!fileExists(p)) return null;

  const data = normalizeRunData(readJson<RunData>(p));
  return { path: p, data };
}

/**
 * Create initial RunData structure.
 */
export function createInitialRunData(
  branch: string,
  dev: string,
  config: Record<string, any>,
): RunData {
  const ts = now();
  return {
    meta: {
      schemaVersion: '2.0',
      runId: branch,
      project: config.project || '',
      developer: dev,
      branch,
      aiModel: config.aiModel || '',
      aiTool: config.aiTool || '',
      startTime: ts,
      endTime: undefined,
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
      currentPrdPhase: undefined,
      currentTaskId: undefined,
      currentStage: undefined,
      lastUpdated: ts,
    },
    cost: {
      totalTokens: 0,
      estimatedManualHours: 0,
      actualHours: 0,
      tokenBreakdown: [],
    },
    highlights: [],
  };
}

/**
 * Ensure run.json exists (lazy init).
 * Creates .aidevos/, config.json, run.json, branch-level files if missing.
 */
export function ensureRunJson(projectRoot: string): { path: string; data: RunData } {
  if (!isGitRepo()) {
    throw new Error('Not a git repository. AIDevOS requires git.');
  }

  // Ensure .aidevos/config.json exists
  const dir = aidevosDir(projectRoot);
  if (!fileExists(resolve(dir, 'config.json'))) {
    ensureDir(dir);
    ensureDir(resolve(dir, 'rules'));
    ensureDir(resolve(dir, 'runs'));
    writeJson(resolve(dir, 'config.json'), {
      schemaVersion: '1.0',
      aiTool: 'mcp',
      project: resolve(projectRoot).split('/').pop() || 'unknown',
    });
  }

  const branch = getBranchName();
  const dev = getDevName();
  const devDir = runDir(projectRoot, branch, dev);
  const runJsonPath = resolve(devDir, 'run.json');

  if (fileExists(runJsonPath)) {
    const data = normalizeRunData(readJson<RunData>(runJsonPath));
    return { path: runJsonPath, data };
  }

  // Lazy create
  const config = loadConfig(projectRoot);
  const bDir = branchDir(projectRoot, branch);
  ensureDir(bDir);
  ensureDir(devDir);

  const runData = createInitialRunData(branch, dev, config);
  writeJson(runJsonPath, runData);

  // Create shared branch-level files
  const prdPath = resolve(bDir, 'prd.md');
  if (!fileExists(prdPath)) writeText(prdPath, '# PRD\n\nPlace your product requirements here.\n');
  const analysisPath = resolve(bDir, 'analysis.md');
  if (!fileExists(analysisPath)) writeText(analysisPath, '');
  const reqPath = resolve(bDir, 'requirement.json');
  if (!fileExists(reqPath)) {
    const ts = now();
    writeJson(reqPath, {
      branch, title: '', summary: '', prdPhases: [], modules: [], highlights: [], developers: [],
      totals: { tasks: 0, completedTasks: 0, bugs: 0, deviations: 0, linesAdded: 0, linesRemoved: 0, totalTokens: 0 },
      createdAt: ts, updatedAt: ts,
    });
  }

  return { path: runJsonPath, data: runData };
}
