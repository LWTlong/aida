import { resolve } from 'node:path';
import { getBranchName, getDevName, isGitRepo } from '../../utils/git.js';
import { runDir, configPath, requirementPath, branchDir } from '../../utils/paths.js';
import { fileExists, readJson, writeJson, ensureDir } from '../../utils/fs.js';
import { green, cyan, red, yellow } from '../../utils/display.js';
import type {
  RunData,
  TaskItem,
  BugItem,
  DeviationItem,
  ReviewItem,
  RuleItem,
  FileItem,
  HighlightItem,
  RequirementData,
  DeveloperSummary,
} from '../../schemas/run-json.js';
import { addRule, buildRuleViews } from '../../utils/rules.js';
import {
  SEVERITY_VALUES,
  BUG_SOURCE_VALUES,
  ROOT_CAUSE_VALUES,
  DEVIATION_CAT_VALUES,
  REVIEW_RESULT_VALUES,
  CHANGE_TYPE_VALUES,
  RULE_CATEGORIES,
} from '../../schemas/run-json.js';

// ─── Helpers ──────────────────────────────────────────────

function getRunJson(): { path: string; data: RunData } | null {
  const projectRoot = process.cwd();
  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDevOS not initialized. Run `npx aidevos init` first.\n'));
    return null;
  }
  if (!isGitRepo()) {
    console.log(red('\n  Not a git repository.\n'));
    return null;
  }
  const branch = getBranchName();
  const dev = getDevName();
  const dir = runDir(projectRoot, branch, dev);
  const p = resolve(dir, 'run.json');
  if (!fileExists(p)) {
    console.log(red('\n  No active run. Run `aidevos start` first.\n'));
    return null;
  }
  const data = readJson<RunData>(p);
  // Normalize arrays
  for (const key of ['tasks', 'bugs', 'deviations', 'reviews', 'rules', 'files', 'timeline', 'events', 'workflow', 'highlights']) {
    if (!Array.isArray((data as any)[key])) (data as any)[key] = [];
  }
  if (!data.summary) data.summary = {} as any;
  if (!data.meta) data.meta = {} as any;
  if (!data.context) data.context = {};
  if (!data.metrics) data.metrics = {};
  if (!data.cost) data.cost = {};
  return { path: p, data };
}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
      flags[args[i].substring(2)] = args[i + 1];
      i++;
    }
  }
  return flags;
}

function nextId(arr: any[], prefix: string): string {
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

function now(): string {
  return new Date().toISOString();
}

function loadConfig(): Record<string, any> {
  try {
    const cfgPath = configPath(process.cwd());
    if (fileExists(cfgPath)) return readJson<Record<string, any>>(cfgPath);
  } catch { /* ignore */ }
  return {};
}

function recalcMetrics(data: RunData): void {
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

  // Wall clock time (reference only)
  if (data.meta?.startTime) {
    const elapsed = (Date.now() - new Date(data.meta.startTime).getTime()) / 1000;
    m.totalDevelopmentTimeSeconds = Math.round(elapsed);
    const hours = elapsed / 3600;
    m.developmentVelocity = hours > 0 ? Math.round((s.completedTasks || 0) / hours * 100) / 100 : 0;
  }

  // Actual work time: sum of all node durations
  const nodeTimes: Record<string, number> = {};

  // Workflow stage durations (requirement analysis, task splitting, etc.)
  for (const w of data.workflow) {
    if (w.startTime && w.endTime) {
      const sec = (new Date(w.endTime).getTime() - new Date(w.startTime).getTime()) / 1000;
      if (sec > 0) {
        nodeTimes[w.stage] = (nodeTimes[w.stage] || 0) + sec;
      }
    }
  }

  // Code generation: sum of task execution times
  let codeGenTotal = 0;
  for (const t of data.tasks) {
    if (t.startedAt && t.completedAt) {
      const sec = (new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime()) / 1000;
      if (sec > 0) codeGenTotal += sec;
    }
  }
  if (codeGenTotal > 0) nodeTimes['代码生成'] = codeGenTotal;

  // Bug fix durations
  let bugFixTotal = 0;
  for (const b of data.bugs) {
    if (b.reportedAt && b.fixedAt) {
      const sec = (new Date(b.fixedAt).getTime() - new Date(b.reportedAt).getTime()) / 1000;
      if (sec > 0) bugFixTotal += sec;
    }
  }
  if (bugFixTotal > 0) nodeTimes['Bug修复'] = bugFixTotal;

  // Deviation fix durations
  let devFixTotal = 0;
  for (const d of data.deviations) {
    if (d.detectedAt && d.fixedAt) {
      const sec = (new Date(d.fixedAt).getTime() - new Date(d.detectedAt).getTime()) / 1000;
      if (sec > 0) devFixTotal += sec;
    }
  }
  if (devFixTotal > 0) nodeTimes['偏差修复'] = devFixTotal;

  m.nodeTimeBreakdown = nodeTimes;
  m.actualWorkSeconds = Math.round(Object.values(nodeTimes).reduce((a, b) => a + b, 0));

  // Efficiency multiplier
  const actualHours = (m.actualWorkSeconds || 0) / 3600;
  if (data.cost?.estimatedManualHours && actualHours > 0) {
    m.efficiencyMultiplier = Math.round(data.cost.estimatedManualHours / actualHours * 10) / 10;
  }

  // ROI calculation
  // tokenPricePer1M and hourlyRate come from config.json
  const config = loadConfig();
  const tokenPricePer1M = config.tokenPricePer1M || 0;   // e.g. 15 means $15/1M tokens
  const hourlyRate = config.hourlyRate || 0;               // e.g. 50 means $50/hour

  const totalTokens = data.cost?.totalTokens || 0;
  const estimatedManualHours = data.cost?.estimatedManualHours || 0;

  if (totalTokens > 0 && tokenPricePer1M > 0) {
    m.tokenCost = Math.round(totalTokens / 1000000 * tokenPricePer1M * 100) / 100;
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

function save(path: string, data: RunData): void {
  data.context.lastUpdated = now();
  recalcMetrics(data);
  writeJson(path, data);
  updateRequirement(data);
}

function updateRequirement(data: RunData): void {
  try {
    const projectRoot = process.cwd();
    const branch = data.meta?.branch;
    if (!branch) return;

    const reqPath = requirementPath(projectRoot, branch);
    const bDir = branchDir(projectRoot, branch);
    ensureDir(bDir);

    let req: RequirementData;
    if (fileExists(reqPath)) {
      req = readJson<RequirementData>(reqPath);
    } else {
      req = {
        branch,
        title: '',
        summary: '',
        prdPhases: [],
        modules: [],
        highlights: [],
        developers: [],
        totals: { tasks: 0, completedTasks: 0, bugs: 0, deviations: 0, linesAdded: 0, linesRemoved: 0, totalTokens: 0 },
        createdAt: now(),
        updatedAt: '',
      };
    }

    // Update this developer's summary
    const devName = data.meta?.developer || '';
    if (!devName) return;

    const s = data.summary || {};
    const m = data.metrics || {};
    const reviewCount = s.reviewCount || 0;
    const reviewPassCount = s.reviewPassCount || 0;

    const devSummary: DeveloperSummary = {
      name: devName,
      modules: [],
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

    // Populate modules from requirement.json assignments
    const assignedModules = req.modules.filter(mod => mod.assignee === devName);
    devSummary.modules = assignedModules.map(mod => mod.name);

    // Upsert developer entry
    const idx = req.developers.findIndex(d => d.name === devName);
    if (idx >= 0) {
      req.developers[idx] = devSummary;
    } else {
      req.developers.push(devSummary);
    }

    // Recalc totals from all developers
    req.totals = {
      tasks: req.developers.reduce((a, d) => a + d.tasks, 0),
      completedTasks: req.developers.reduce((a, d) => a + d.completedTasks, 0),
      bugs: req.developers.reduce((a, d) => a + d.bugs, 0),
      deviations: req.developers.reduce((a, d) => a + d.deviations, 0),
      linesAdded: req.developers.reduce((a, d) => a + d.linesAdded, 0),
      linesRemoved: req.developers.reduce((a, d) => a + d.linesRemoved, 0),
      totalTokens: req.developers.reduce((a, d) => a + d.totalTokens, 0),
    };

    // Merge highlights from run into requirement (dedup by content)
    if (data.highlights?.length) {
      const existingContents = new Set(req.highlights.map(h => h.content));
      for (const h of data.highlights) {
        if (!existingContents.has(h.content)) {
          req.highlights.push(h);
          existingContents.add(h.content);
        }
      }
    }

    // Sync status from meta
    if (!req.title && data.meta?.branch) {
      req.title = data.meta.branch;
    }

    req.updatedAt = now();
    writeJson(reqPath, req);
  } catch {
    // Non-critical: don't block run.json writes
  }
}

function addEvent(data: RunData, type: string, eventData: Record<string, any>): void {
  data.events.push({ type, time: now(), data: eventData });
}

function addTimeline(data: RunData, type: string, title: string): void {
  data.timeline.push({ type, title, timestamp: now() });
}

// ─── Validators ────────────────────────────────────────────

function requireFlag(flags: Record<string, string>, name: string, label: string): string | null {
  if (!flags[name]) {
    console.log(red(`\n  Missing required flag: --${name} (${label})\n`));
    return null;
  }
  return flags[name];
}

function validateEnum(value: string, allowed: readonly string[], name: string): boolean {
  if (!allowed.includes(value)) {
    console.log(red(`\n  Invalid --${name}: "${value}". Must be one of: ${allowed.join(', ')}\n`));
    return false;
  }
  return true;
}

// ─── Subcommands ──────────────────────────────────────────

function logTask(flags: Record<string, string>): void {
  const title = requireFlag(flags, 'title', 'task title');
  if (!title) return;
  const stage = flags.stage || 'default';
  const prdPhase = flags['prd-phase'] || '';
  const acceptance = flags.acceptance || '';

  const r = getRunJson();
  if (!r) return;
  const { path, data } = r;

  const id = nextId(data.tasks, 'TASK');
  const task: TaskItem = {
    taskId: id,
    title,
    status: 'pending',
    stageName: stage,
    prdPhase,
    acceptance,
    createdAt: now(),
    completedAt: null,
  };
  data.tasks.push(task);
  data.summary.totalTasks = data.tasks.length;
  addEvent(data, 'task_created', { taskId: id });
  addTimeline(data, 'task', `${id}: ${title}`);
  save(path, data);
  console.log(green(`\n  ✓ ${id}`) + `: ${title}\n`);
}

function logTaskStart(flags: Record<string, string>): void {
  const id = requireFlag(flags, 'id', 'task ID');
  if (!id) return;

  const r = getRunJson();
  if (!r) return;
  const { path, data } = r;

  const task = data.tasks.find((t: any) => t.taskId === id);
  if (!task) {
    console.log(red(`\n  Task ${id} not found.\n`));
    return;
  }
  task.status = 'in-progress';
  task.startedAt = now();
  data.context.currentTaskId = id;
  addEvent(data, 'task_started', { taskId: id });
  addTimeline(data, 'task-start', `${id}: ${task.title}`);
  save(path, data);
  console.log(green(`\n  ✓ ${id} started\n`));
}

function logTaskDone(flags: Record<string, string>): void {
  const id = requireFlag(flags, 'id', 'task ID');
  if (!id) return;

  const r = getRunJson();
  if (!r) return;
  const { path, data } = r;

  const task = data.tasks.find((t: any) => t.taskId === id);
  if (!task) {
    console.log(red(`\n  Task ${id} not found.\n`));
    return;
  }
  task.status = 'done';
  task.completedAt = now();
  // If startedAt was never set, set it to createdAt for backwards compatibility
  if (!task.startedAt) {
    task.startedAt = task.createdAt || task.completedAt;
  }
  data.summary.completedTasks = data.tasks.filter((t: any) => t.status === 'done').length;
  addEvent(data, 'task_completed', { taskId: id });
  addTimeline(data, 'task-done', `${id}: ${task.title}`);
  save(path, data);
  console.log(green(`\n  ✓ ${id} marked done\n`));
}

function logBug(flags: Record<string, string>): void {
  const title = requireFlag(flags, 'title', 'bug title');
  if (!title) return;
  const severity = flags.severity || 'medium';
  if (!validateEnum(severity, SEVERITY_VALUES, 'severity')) return;
  const source = flags.source || 'user-feedback';
  if (!validateEnum(source, BUG_SOURCE_VALUES, 'source')) return;

  const r = getRunJson();
  if (!r) return;
  const { path, data } = r;

  const id = nextId(data.bugs, 'BUG');
  const bug: BugItem = {
    bugId: id,
    title,
    severity: severity as BugItem['severity'],
    source: source as BugItem['source'],
    status: 'open',
    taskId: flags.task || null,
    files: flags.files ? flags.files.split(',') : [],
    fix: null,
    reportedAt: now(),
    fixedAt: null,
  };
  data.bugs.push(bug);
  data.summary.bugCount = data.bugs.length;
  addEvent(data, 'bug_created', { bugId: id });
  addTimeline(data, 'bug', `${id}: ${title}`);
  save(path, data);
  console.log(green(`\n  ✓ ${id}`) + `: ${title} [${severity}]\n`);
}

function logBugFix(flags: Record<string, string>): void {
  const id = requireFlag(flags, 'id', 'bug ID');
  if (!id) return;

  const r = getRunJson();
  if (!r) return;
  const { path, data } = r;

  const bug = data.bugs.find((b: any) => b.bugId === id);
  if (!bug) {
    console.log(red(`\n  Bug ${id} not found.\n`));
    return;
  }
  bug.status = 'fixed';
  bug.fixedAt = now();
  if (flags.fix) bug.fix = flags.fix;
  addEvent(data, 'bug_fixed', { bugId: id });
  addTimeline(data, 'bug-fix', `${id}: ${bug.title}`);
  save(path, data);
  console.log(green(`\n  ✓ ${id} marked fixed\n`));
}

function logDeviation(flags: Record<string, string>): void {
  const title = requireFlag(flags, 'title', 'deviation title');
  if (!title) return;
  const rootCause = flags['root-cause'] || 'other';
  if (!validateEnum(rootCause, ROOT_CAUSE_VALUES, 'root-cause')) return;
  const category = flags.category || 'other';
  if (!validateEnum(category, DEVIATION_CAT_VALUES, 'category')) return;

  const r = getRunJson();
  if (!r) return;
  const { path, data } = r;

  const id = nextId(data.deviations, 'DEV');
  const deviation: DeviationItem = {
    deviationId: id,
    title,
    aiOutput: flags['ai-output'] || '',
    expectedOutput: flags.expected || '',
    rootCauseCategory: rootCause as DeviationItem['rootCauseCategory'],
    deviationCategory: category as DeviationItem['deviationCategory'],
    files: flags.files ? flags.files.split(',') : [],
    ruleSedimented: null,
    detectedAt: now(),
    fixedAt: null,
  };
  data.deviations.push(deviation);
  data.summary.deviationCount = data.deviations.length;
  addEvent(data, 'deviation_created', { deviationId: id });
  addTimeline(data, 'deviation', `${id}: ${title}`);
  save(path, data);
  console.log(green(`\n  ✓ ${id}`) + `: ${title} [${rootCause}/${category}]\n`);
}

function logReview(flags: Record<string, string>): void {
  const result = flags.result || 'pass';
  if (!validateEnum(result, REVIEW_RESULT_VALUES, 'result')) return;

  const r = getRunJson();
  if (!r) return;
  const { path, data } = r;

  const id = nextId(data.reviews, 'REV');
  const issues = flags.issues ? flags.issues.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
  const review: ReviewItem = {
    reviewId: id,
    taskId: flags['task-id'] || null,
    result: result as ReviewItem['result'],
    issueCount: issues.length || (parseInt(flags['issue-count'] || '0') || 0),
    scope: flags.scope || '',
    reviewedAt: now(),
    issues,
  };
  data.reviews.push(review);
  data.summary.reviewCount = data.reviews.length;
  data.summary.reviewPassCount = data.reviews.filter((r) => r.result === 'pass').length;
  data.summary.reviewFailCount = data.reviews.filter((r) => r.result === 'fail').length;
  addEvent(data, 'review_created', { reviewId: id, result });
  addTimeline(data, 'review', `${id}: ${result}`);
  save(path, data);
  console.log(green(`\n  ✓ ${id}`) + `: ${result}` + (flags.scope ? ` (${flags.scope})` : '') + '\n');
}

function logRule(flags: Record<string, string>): void {
  const content = requireFlag(flags, 'content', 'rule content');
  if (!content) return;

  const r = getRunJson();
  if (!r) return;
  const { path, data } = r;

  const projectRoot = process.cwd();
  const branch = getBranchName();
  const dev = getDevName();
  const isPending = flags.status === 'pending';
  const category = flags.category || 'general';
  if (!validateEnum(category, RULE_CATEGORIES, 'category')) return;

  // Write to project-level registry (rules.json) with fingerprint dedup
  const { entry, isDuplicate } = addRule(projectRoot, {
    content,
    category,
    branch,
    deviation: flags['source-deviation'] || null,
    author: dev,
    status: isPending ? 'pending' : 'active',
  });

  if (isDuplicate) {
    console.log(yellow(`\n  ⚠ Rule already exists: ${entry.id}`) + ` (fingerprint match)\n`);
  }

  // Also record in run.json.rules[] for per-run tracking
  const localId = nextId(data.rules, 'RULE');
  const rule: RuleItem = {
    ruleId: localId,
    file: `rules.json#${entry.id}`,
    content,
    sourceDeviation: flags['source-deviation'] || null,
    sedimentedAt: isPending ? null : now(),
  };
  if (isPending) rule.status = 'pending';
  data.rules.push(rule);
  data.summary.rulesSedimented = data.rules.filter((r) => r.status !== 'pending').length;
  addEvent(data, 'rule_sedimented', { ruleId: localId, registryId: entry.id });
  addTimeline(data, 'rule', `${localId}: ${content.substring(0, 50)}`);
  save(path, data);

  // Auto-rebuild markdown views
  buildRuleViews(projectRoot);

  if (!isDuplicate) {
    console.log(green(`\n  ✓ ${entry.id}`) + ` [${category}]: ${content.substring(0, 60)}\n`);
  }
}

function logFile(flags: Record<string, string>): void {
  const filePath = requireFlag(flags, 'path', 'file path');
  if (!filePath) return;
  const changeType = flags['change-type'] || 'modified';
  if (!validateEnum(changeType, CHANGE_TYPE_VALUES, 'change-type')) return;

  const r = getRunJson();
  if (!r) return;
  const { path, data } = r;

  const existing = data.files.find((f) => f.path === filePath);
  if (existing) {
    existing.changeCount = (existing.changeCount || 1) + 1;
    existing.linesAdded += parseInt(flags['lines-added'] || '0') || 0;
    existing.linesRemoved += parseInt(flags['lines-removed'] || '0') || 0;
    existing.lastModified = now();
  } else {
    const file: FileItem = {
      path: filePath,
      changeType: changeType as FileItem['changeType'],
      linesAdded: parseInt(flags['lines-added'] || '0') || 0,
      linesRemoved: parseInt(flags['lines-removed'] || '0') || 0,
      changeCount: 1,
      lastModified: now(),
    };
    data.files.push(file);
  }
  data.summary.filesChanged = data.files.length;
  data.summary.linesAdded = data.files.reduce((s, f) => s + (f.linesAdded || 0), 0);
  data.summary.linesRemoved = data.files.reduce((s, f) => s + (f.linesRemoved || 0), 0);
  addEvent(data, 'file_changed', { path: filePath, changeType });
  addTimeline(data, 'file', `${filePath} [${changeType}]`);
  save(path, data);
  console.log(green(`\n  ✓ ${filePath}`) + ` [${changeType}]\n`);
}

function logCost(flags: Record<string, string>): void {
  const r = getRunJson();
  if (!r) return;
  const { path, data } = r;

  if (!data.cost) data.cost = {};

  if (flags.tokens) {
    const tokens = parseInt(flags.tokens) || 0;
    if (flags.stage) {
      if (!data.cost.tokenBreakdown) data.cost.tokenBreakdown = [];
      const existing = data.cost.tokenBreakdown.find(t => t.stage === flags.stage);
      if (existing) {
        existing.tokens += tokens;
      } else {
        data.cost.tokenBreakdown.push({ stage: flags.stage, tokens });
      }
      data.cost.totalTokens = data.cost.tokenBreakdown.reduce((a, t) => a + t.tokens, 0);
    } else {
      data.cost.totalTokens = (data.cost.totalTokens || 0) + tokens;
    }
  }

  if (flags['estimated-hours']) {
    data.cost.estimatedManualHours = parseFloat(flags['estimated-hours']) || 0;
  }
  if (flags['actual-hours']) {
    data.cost.actualHours = parseFloat(flags['actual-hours']) || 0;
  }

  addEvent(data, 'cost_updated', { ...data.cost });
  save(path, data);
  console.log(green('\n  ✓ cost updated\n'));
}

function logHighlight(flags: Record<string, string>): void {
  const content = requireFlag(flags, 'content', 'highlight content');
  if (!content) return;

  const r = getRunJson();
  if (!r) return;
  const { path, data } = r;

  const highlight: HighlightItem = {
    content,
    source: (flags.source as 'auto' | 'manual') || 'manual',
    createdAt: now(),
  };
  data.highlights.push(highlight);
  addEvent(data, 'highlight_added', { content });
  save(path, data);
  console.log(green('\n  ✓ highlight added') + `: ${content}\n`);
}

// ─── Router ───────────────────────────────────────────────

export async function log(): Promise<void> {
  const args = process.argv.slice(3);
  const subcommand = args[0];
  const flags = parseFlags(args.slice(1));

  switch (subcommand) {
    case 'task':
      return logTask(flags);
    case 'task-start':
      return logTaskStart(flags);
    case 'task-done':
      return logTaskDone(flags);
    case 'bug':
      return logBug(flags);
    case 'bug-fix':
      return logBugFix(flags);
    case 'deviation':
      return logDeviation(flags);
    case 'review':
      return logReview(flags);
    case 'rule':
      return logRule(flags);
    case 'file':
      return logFile(flags);
    case 'cost':
      return logCost(flags);
    case 'highlight':
      return logHighlight(flags);
    default:
      console.log(`
  ${cyan('aidevos log')} - Write structured data to run.json

  Subcommands:
    task          Add a new task
    task-start    Mark a task as in-progress (records startedAt)
    task-done     Mark a task as done
    bug           Record a bug
    bug-fix       Mark a bug as fixed
    deviation     Record an AI deviation
    review        Record a review result
    rule          Record a sedimented rule
    file          Record a file change
    cost          Record token/time cost data
    highlight     Record a business value highlight

  Examples:
    aidevos log task --title "Create API layer" --stage "Infrastructure"
    aidevos log task-start --id TASK-01
    aidevos log task-done --id TASK-01
    aidevos log bug --title "Type mismatch" --severity high --source self-review
    aidevos log bug-fix --id BUG-01 --fix "Fixed response type"
    aidevos log deviation --title "Wrong component" --root-cause rule-missing --category component-usage
    aidevos log review --task-id TASK-01 --result pass --scope "src/api/"
    aidevos log rule --content "Use Drawer for detail views" --category component --source-deviation DEV-01 --status pending
    aidevos log file --path "src/api/user.ts" --change-type modified --lines-added 50
    aidevos log cost --tokens 125000 --stage "requirement-analysis"
    aidevos log cost --estimated-hours 40 --actual-hours 18
    aidevos log highlight --content "FCP reduced from 3.2s to 0.8s"
`);
  }
}
