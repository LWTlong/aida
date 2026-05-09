import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { green, red, yellow } from '../../utils/display.js';
import {
  fileExists,
  readText,
  extractConflictSections,
  writeJson,
} from '../../utils/fs.js';
import {
  aidaDir,
  branchDir,
  configPath,
  indexPath,
  legacyModuleMemoryPath,
  memoryIndexPath,
  moduleMemoriesDir,
  moduleMemoryPath,
  requirementPath,
  runContextPath,
  runsDir,
} from '../../utils/paths.js';
import {
  buildMemoryViews,
  loadMemoryIndex,
  loadModuleMemory,
  normalizeModuleKey,
  saveModuleMemory,
} from '../../utils/memory.js';
import { buildIndex } from './reindex.js';
import { normalizeRunData, recalcMetrics, resolveCurrentTaskId } from '../../utils/run-data.js';
import type {
  ModuleMemoryIndex,
  ModuleMemoryIndexEntry,
  ModuleMemoryRecord,
  RunContextRecord,
} from '../../schemas/aida-project.js';
import type {
  RequirementData,
  RequirementModule,
  RequirementPrdPhase,
  DeveloperSummary,
  RunData,
  TaskItem,
  BugItem,
  DeviationItem,
  ReviewItem,
  RuleItem,
  FileItem,
  TimelineItem,
  WorkflowStage,
  EventItem,
  HighlightItem,
} from '../../schemas/run-json.js';

type MergeStatus = 'merged' | 'no-conflict' | 'missing' | 'error';

interface MergeCountResult {
  status: MergeStatus
  merged: number
  missing: number
  errors: number
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = `${value || ''}`.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function latestIso(a?: string, b?: string): string {
  if (!a) return b || '';
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function pickLatestString(current: string | undefined, incoming: string | undefined, currentUpdatedAt?: string, incomingUpdatedAt?: string): string {
  const currentValue = (current || '').trim();
  const incomingValue = (incoming || '').trim();
  if (!currentValue) return incomingValue;
  if (!incomingValue) return currentValue;
  return latestIso(currentUpdatedAt, incomingUpdatedAt) === incomingUpdatedAt ? incomingValue : currentValue;
}

function parseConflictJsonObject<T>(raw: string): T | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null') return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

function hasConflict(filePath: string): boolean {
  if (!fileExists(filePath)) return false;
  const raw = readText(filePath);
  return raw.includes('<<<<<<<') || raw.includes('>>>>>>>');
}

function mergeByKey<T>(items: T[], keyOf: (item: T) => string, mergeItem: (current: T, incoming: T) => T): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = keyOf(item);
    const existing = map.get(key);
    map.set(key, existing ? mergeItem(existing, item) : item);
  }
  return [...map.values()];
}

function mergeIndexEntry(current: ModuleMemoryIndexEntry, incoming: ModuleMemoryIndexEntry): ModuleMemoryIndexEntry {
  const useIncoming = latestIso(current.updatedAt, incoming.updatedAt) === incoming.updatedAt;
  return {
    key: current.key || incoming.key,
    title: pickLatestString(current.title, incoming.title, current.updatedAt, incoming.updatedAt),
    summary: pickLatestString(current.summary, incoming.summary, current.updatedAt, incoming.updatedAt),
    keywords: uniqueStrings([...current.keywords, ...incoming.keywords]),
    paths: uniqueStrings([...current.paths, ...incoming.paths]),
    tickets: uniqueStrings([...(current.tickets || []), ...(incoming.tickets || [])]),
    updatedAt: useIncoming ? incoming.updatedAt : current.updatedAt,
  };
}

function mergeMemoryIndex(ours: ModuleMemoryIndex | null, theirs: ModuleMemoryIndex | null): ModuleMemoryIndex {
  const mergedModules = mergeByKey<ModuleMemoryIndexEntry>(
    [...((ours?.items || (ours as any)?.modules || [])), ...((theirs?.items || (theirs as any)?.modules || []))],
    (item) => normalizeModuleKey(item.key),
    (current, incoming) => mergeIndexEntry(
      { ...current, key: normalizeModuleKey(current.key) },
      { ...incoming, key: normalizeModuleKey(incoming.key) },
    ),
  ).sort((a, b) => a.key.localeCompare(b.key));

  return {
    schemaVersion: '2.0',
    updatedAt: latestIso(ours?.updatedAt, theirs?.updatedAt),
    items: mergedModules,
  };
}

function hydrateModuleMemoryFromIndex(projectRoot: string, entry: ModuleMemoryIndexEntry): void {
  const moduleKey = normalizeModuleKey(entry.key);
  if (!moduleKey) return;
  const existing = loadModuleMemory(projectRoot, moduleKey);
  if (existing) {
    saveModuleMemory(projectRoot, {
      ...existing,
      moduleKey,
      title: existing.title || entry.title || moduleKey,
      summary: existing.summary || entry.summary || '',
      keywords: uniqueStrings([...(existing.keywords || []), moduleKey, entry.title, ...(entry.keywords || [])]),
      entryFiles: uniqueStrings([...(existing.entryFiles || []), ...(entry.paths || [])]),
      relatedPaths: uniqueStrings([...(existing.relatedPaths || []), ...(entry.paths || [])]),
      updatedAt: latestIso(existing.updatedAt, entry.updatedAt) || existing.updatedAt || entry.updatedAt || new Date().toISOString(),
    });
    return;
  }
  if (fileExists(moduleMemoryPath(projectRoot, moduleKey))) return;
  if (fileExists(legacyModuleMemoryPath(projectRoot, moduleKey))) return;

  saveModuleMemory(projectRoot, {
    schemaVersion: '2.0',
    moduleKey,
    title: entry.title || moduleKey,
    summary: entry.summary || '',
    keywords: uniqueStrings([moduleKey, entry.title, ...(entry.keywords || [])]),
    entryFiles: uniqueStrings(entry.paths || []),
    relatedPaths: uniqueStrings(entry.paths || []),
    dataFlow: [],
    decisions: [],
    constraints: [],
    pitfalls: [],
    relatedRules: [],
    tickets: [],
    changes: [],
    updatedAt: entry.updatedAt || new Date().toISOString(),
  });
}

function hydrateMissingModuleMemoriesFromIndex(projectRoot: string): void {
  const index = loadMemoryIndex(projectRoot);
  for (const entry of index.items) {
    hydrateModuleMemoryFromIndex(projectRoot, entry);
  }
}

function mergeModuleMemoryRecord(current: ModuleMemoryRecord, incoming: ModuleMemoryRecord): ModuleMemoryRecord {
  const useIncoming = latestIso(current.updatedAt, incoming.updatedAt) === incoming.updatedAt;
  const mergedTickets = mergeByKey(
    [...current.tickets, ...incoming.tickets],
    (item) => `${item.ticket || ''}|${item.branch || ''}`,
    (left, right) => ({
      ticket: left.ticket || right.ticket,
      branch: left.branch || right.branch,
      summary: pickLatestString(left.summary, right.summary, left.updatedAt, right.updatedAt),
      updatedAt: latestIso(left.updatedAt, right.updatedAt),
    }),
  );
  const mergedChanges = mergeByKey(
    [...(current.changes || []), ...(incoming.changes || [])],
    (item) => item.ticket || item.branch
      ? `${item.ticket || ''}|${item.branch || ''}`
      : `${item.title || ''}|${item.summary}`,
    (left, right) => ({
      ticket: left.ticket || right.ticket,
      branch: left.branch || right.branch,
      title: pickLatestString(left.title, right.title, left.updatedAt, right.updatedAt) || undefined,
      summary: pickLatestString(left.summary, right.summary, left.updatedAt, right.updatedAt),
      updatedAt: latestIso(left.updatedAt, right.updatedAt),
    }),
  );

  return {
    schemaVersion: '2.0',
    moduleKey: current.moduleKey || incoming.moduleKey,
    title: pickLatestString(current.title, incoming.title, current.updatedAt, incoming.updatedAt),
    summary: pickLatestString(current.summary, incoming.summary, current.updatedAt, incoming.updatedAt),
    keywords: uniqueStrings([...current.keywords, ...incoming.keywords]),
    entryFiles: uniqueStrings([...current.entryFiles, ...incoming.entryFiles]),
    relatedPaths: uniqueStrings([...current.relatedPaths, ...incoming.relatedPaths]),
    dataFlow: uniqueStrings([...current.dataFlow, ...incoming.dataFlow]),
    decisions: uniqueStrings([...current.decisions, ...incoming.decisions]),
    constraints: uniqueStrings([...current.constraints, ...incoming.constraints]),
    pitfalls: uniqueStrings([...current.pitfalls, ...incoming.pitfalls]),
    relatedRules: uniqueStrings([...current.relatedRules, ...incoming.relatedRules]),
    tickets: mergedTickets,
    changes: mergedChanges,
    updatedAt: useIncoming ? incoming.updatedAt : current.updatedAt,
  };
}

function mergeRunContextRecord(current: RunContextRecord, incoming: RunContextRecord): RunContextRecord {
  const useIncoming = latestIso(current.updatedAt, incoming.updatedAt) === incoming.updatedAt;
  return {
    branch: current.branch || incoming.branch,
    ticket: pickLatestString(current.ticket, incoming.ticket, current.updatedAt, incoming.updatedAt) || undefined,
    title: pickLatestString(current.title, incoming.title, current.updatedAt, incoming.updatedAt),
    summary: pickLatestString(current.summary, incoming.summary, current.updatedAt, incoming.updatedAt),
    currentPhase: pickLatestString(current.currentPhase, incoming.currentPhase, current.updatedAt, incoming.updatedAt),
    modules: uniqueStrings([...current.modules, ...incoming.modules]),
    completed: uniqueStrings([...current.completed, ...incoming.completed]),
    inProgress: uniqueStrings([...current.inProgress, ...incoming.inProgress]),
    next: uniqueStrings([...current.next, ...incoming.next]),
    decisions: uniqueStrings([...current.decisions, ...incoming.decisions]),
    constraints: uniqueStrings([...current.constraints, ...incoming.constraints]),
    keyFiles: uniqueStrings([...current.keyFiles, ...incoming.keyFiles]),
    risks: uniqueStrings([...current.risks, ...incoming.risks]),
    updatedAt: useIncoming ? incoming.updatedAt : current.updatedAt,
  };
}

function mergeRequirementModule(current: RequirementModule, incoming: RequirementModule): RequirementModule {
  return {
    id: current.id || incoming.id,
    name: pickLatestString(current.name, incoming.name),
    description: pickLatestString(current.description, incoming.description),
    assignee: incoming.assignee || current.assignee,
  };
}

function mergeRequirementPhase(current: RequirementPrdPhase, incoming: RequirementPrdPhase): RequirementPrdPhase {
  return {
    phase: current.phase || incoming.phase,
    file: current.file || incoming.file,
    title: pickLatestString(current.title, incoming.title),
    confirmedAt: latestIso(current.confirmedAt || undefined, incoming.confirmedAt || undefined) || null,
  };
}

function mergeDeveloper(current: DeveloperSummary, incoming: DeveloperSummary): DeveloperSummary {
  return {
    name: current.name || incoming.name,
    modules: uniqueStrings([...current.modules, ...incoming.modules]),
    tasks: Math.max(current.tasks, incoming.tasks),
    completedTasks: Math.max(current.completedTasks, incoming.completedTasks),
    bugs: Math.max(current.bugs, incoming.bugs),
    deviations: Math.max(current.deviations, incoming.deviations),
    linesAdded: Math.max(current.linesAdded, incoming.linesAdded),
    linesRemoved: Math.max(current.linesRemoved, incoming.linesRemoved),
    firstPassRate: Math.max(current.firstPassRate, incoming.firstPassRate),
    actualWorkSeconds: Math.max(current.actualWorkSeconds, incoming.actualWorkSeconds),
    totalTokens: Math.max(current.totalTokens, incoming.totalTokens),
  };
}

function mergeRequirementRecord(current: RequirementData, incoming: RequirementData): RequirementData {
  const developers = mergeByKey(
    [...current.developers, ...incoming.developers],
    (item) => item.name,
    mergeDeveloper,
  ).sort((a, b) => a.name.localeCompare(b.name));

  const modules = mergeByKey(
    [...current.modules, ...incoming.modules],
    (item) => item.id || item.name,
    mergeRequirementModule,
  );

  const prdPhases = mergeByKey(
    [...current.prdPhases, ...incoming.prdPhases],
    (item) => `${item.phase}|${item.file}`,
    mergeRequirementPhase,
  );

  const highlights = mergeByKey(
    [...current.highlights, ...incoming.highlights],
    (item) => `${item.content}|${item.createdAt}`,
    (left) => left,
  );

  return {
    branch: current.branch || incoming.branch,
    title: pickLatestString(current.title, incoming.title, current.updatedAt, incoming.updatedAt),
    summary: pickLatestString(current.summary, incoming.summary, current.updatedAt, incoming.updatedAt),
    prdPhases,
    modules,
    highlights,
    developers,
    totals: {
      tasks: developers.reduce((sum, item) => sum + item.tasks, 0),
      completedTasks: developers.reduce((sum, item) => sum + item.completedTasks, 0),
      bugs: developers.reduce((sum, item) => sum + item.bugs, 0),
      deviations: developers.reduce((sum, item) => sum + item.deviations, 0),
      linesAdded: developers.reduce((sum, item) => sum + item.linesAdded, 0),
      linesRemoved: developers.reduce((sum, item) => sum + item.linesRemoved, 0),
      totalTokens: developers.reduce((sum, item) => sum + item.totalTokens, 0),
    },
    createdAt: current.createdAt || incoming.createdAt,
    updatedAt: latestIso(current.updatedAt, incoming.updatedAt),
  };
}

const taskStatusRank: Record<TaskItem['status'], number> = {
  pending: 0,
  'in-progress': 1,
  done: 2,
};

function mergeTask(current: TaskItem, incoming: TaskItem): TaskItem {
  const currentRank = taskStatusRank[current.status];
  const incomingRank = taskStatusRank[incoming.status];
  const preferred = incomingRank >= currentRank ? incoming : current;
  const other = preferred === incoming ? current : incoming;
  return {
    ...preferred,
    title: pickLatestString(current.title, incoming.title),
    stageName: pickLatestString(current.stageName, incoming.stageName),
    prdPhase: pickLatestString(current.prdPhase, incoming.prdPhase),
    acceptance: pickLatestString(current.acceptance, incoming.acceptance) || undefined,
    createdAt: current.createdAt || incoming.createdAt,
    startedAt: latestIso(current.startedAt, incoming.startedAt) || current.startedAt || incoming.startedAt,
    completedAt: latestIso(current.completedAt || undefined, incoming.completedAt || undefined) || preferred.completedAt || other.completedAt || null,
    status: currentRank === incomingRank ? preferred.status : (incomingRank > currentRank ? incoming.status : current.status),
  };
}

function mergeBug(current: BugItem, incoming: BugItem): BugItem {
  const status = current.status === 'fixed' || incoming.status === 'fixed' ? 'fixed' : 'open';
  const severityOrder: Record<BugItem['severity'], number> = { low: 0, medium: 1, high: 2, critical: 3 };
  return {
    ...current,
    ...incoming,
    title: pickLatestString(current.title, incoming.title),
    severity: severityOrder[current.severity] >= severityOrder[incoming.severity] ? current.severity : incoming.severity,
    source: current.source || incoming.source,
    status,
    files: uniqueStrings([...current.files, ...incoming.files]),
    fix: pickLatestString(current.fix || undefined, incoming.fix || undefined) || null,
    taskId: incoming.taskId || current.taskId || null,
    reportedAt: current.reportedAt || incoming.reportedAt,
    fixedAt: latestIso(current.fixedAt || undefined, incoming.fixedAt || undefined) || null,
  };
}

function mergeDeviation(current: DeviationItem, incoming: DeviationItem): DeviationItem {
  return {
    ...current,
    ...incoming,
    title: pickLatestString(current.title, incoming.title),
    aiOutput: pickLatestString(current.aiOutput, incoming.aiOutput) || undefined,
    expectedOutput: pickLatestString(current.expectedOutput, incoming.expectedOutput) || undefined,
    files: uniqueStrings([...current.files, ...incoming.files]),
    ruleSedimented: incoming.ruleSedimented ?? current.ruleSedimented,
    detectedAt: current.detectedAt || incoming.detectedAt,
    fixedAt: latestIso(current.fixedAt || undefined, incoming.fixedAt || undefined) || null,
  };
}

function mergeReview(current: ReviewItem, incoming: ReviewItem): ReviewItem {
  const preferred = latestIso(current.reviewedAt, incoming.reviewedAt) === incoming.reviewedAt ? incoming : current;
  return {
    ...preferred,
    taskId: incoming.taskId || current.taskId || null,
    scope: pickLatestString(current.scope, incoming.scope),
    result: preferred.result,
    issueCount: Math.max(current.issueCount, incoming.issueCount),
    issues: uniqueStrings([...(current.issues || []), ...(incoming.issues || [])]),
    reviewedAt: preferred.reviewedAt,
  };
}

function mergeRuleItem(current: RuleItem, incoming: RuleItem): RuleItem {
  const preferred = latestIso(current.sedimentedAt || undefined, incoming.sedimentedAt || undefined) === incoming.sedimentedAt ? incoming : current;
  return {
    ...preferred,
    content: pickLatestString(current.content, incoming.content),
    category: pickLatestString(current.category, incoming.category) || undefined,
    sourceDeviation: incoming.sourceDeviation || current.sourceDeviation || null,
    sedimentedAt: latestIso(current.sedimentedAt || undefined, incoming.sedimentedAt || undefined) || null,
    file: pickLatestString(current.file, incoming.file),
    status: incoming.status || current.status,
  };
}

function mergeFileItem(current: FileItem, incoming: FileItem): FileItem {
  const changeType = current.changeType === incoming.changeType
    ? current.changeType
    : (current.changeType === 'deleted' || incoming.changeType === 'deleted' ? 'deleted' : 'modified');
  return {
    path: current.path || incoming.path,
    changeType,
    linesAdded: Math.max(current.linesAdded, incoming.linesAdded),
    linesRemoved: Math.max(current.linesRemoved, incoming.linesRemoved),
    changeCount: Math.max(current.changeCount, incoming.changeCount),
    lastModified: latestIso(current.lastModified, incoming.lastModified) || undefined,
  };
}

function mergeWorkflow(current: WorkflowStage, incoming: WorkflowStage): WorkflowStage {
  const statusRank: Record<WorkflowStage['status'], number> = {
    pending: 0,
    in_progress: 1,
    completed: 2,
    failed: 3,
  };
  const preferred = statusRank[incoming.status] >= statusRank[current.status] ? incoming : current;
  return {
    ...preferred,
    stage: pickLatestString(current.stage, incoming.stage),
    prdPhase: pickLatestString(current.prdPhase, incoming.prdPhase) || undefined,
    startTime: current.startTime || incoming.startTime,
    endTime: latestIso(current.endTime, incoming.endTime) || undefined,
  };
}

function recalcRunSummary(data: RunData): void {
  data.summary.totalTasks = data.tasks.length;
  data.summary.completedTasks = data.tasks.filter((item) => item.status === 'done').length;
  data.summary.bugCount = data.bugs.length;
  data.summary.deviationCount = data.deviations.length;
  data.summary.reviewCount = data.reviews.length;
  data.summary.reviewPassCount = data.reviews.filter((item) => item.result === 'pass').length;
  data.summary.reviewFailCount = data.reviews.filter((item) => item.result === 'fail').length;
  data.summary.rulesSedimented = data.rules.filter((item) => item.status !== 'pending').length;
  data.summary.prdPhaseCount = uniqueStrings(data.tasks.map((item) => item.prdPhase)).length;
  data.summary.filesChanged = data.files.length;
  data.summary.linesAdded = data.files.reduce((sum, item) => sum + (item.linesAdded || 0), 0);
  data.summary.linesRemoved = data.files.reduce((sum, item) => sum + (item.linesRemoved || 0), 0);
}

function mergeRunDataRecord(currentRaw: RunData, incomingRaw: RunData): RunData {
  const current = normalizeRunData(currentRaw);
  const incoming = normalizeRunData(incomingRaw);
  const merged = normalizeRunData({
    ...current,
    ...incoming,
    meta: {
      ...current.meta,
      ...incoming.meta,
      schemaVersion: incoming.meta.schemaVersion || current.meta.schemaVersion,
      branch: current.meta.branch || incoming.meta.branch,
      developer: current.meta.developer || incoming.meta.developer,
      project: pickLatestString(current.meta.project, incoming.meta.project),
      aiModel: pickLatestString(current.meta.aiModel, incoming.meta.aiModel),
      aiTool: pickLatestString(current.meta.aiTool, incoming.meta.aiTool),
      startTime: current.meta.startTime || incoming.meta.startTime,
      endTime: latestIso(current.meta.endTime, incoming.meta.endTime) || undefined,
      status: pickLatestString(current.meta.status, incoming.meta.status),
      prdPhases: uniqueStrings([...(current.meta.prdPhases || []), ...(incoming.meta.prdPhases || [])]),
    },
    summary: { ...current.summary, ...incoming.summary },
    metrics: { ...current.metrics, ...incoming.metrics },
    context: {
      ...current.context,
      ...incoming.context,
      currentStage: pickLatestString(current.context.currentStage as string | undefined, incoming.context.currentStage as string | undefined) || undefined,
      currentPrdPhase: pickLatestString(current.context.currentPrdPhase as string | undefined, incoming.context.currentPrdPhase as string | undefined) || undefined,
      currentTaskId: undefined,
      lastUpdated: latestIso(current.context.lastUpdated as string | undefined, incoming.context.lastUpdated as string | undefined) || undefined,
    },
    tasks: mergeByKey([...current.tasks, ...incoming.tasks], (item) => item.taskId, mergeTask),
    bugs: mergeByKey([...current.bugs, ...incoming.bugs], (item) => item.bugId, mergeBug),
    deviations: mergeByKey([...current.deviations, ...incoming.deviations], (item) => item.deviationId, mergeDeviation),
    reviews: mergeByKey([...current.reviews, ...incoming.reviews], (item) => item.reviewId, mergeReview),
    rules: mergeByKey([...current.rules, ...incoming.rules], (item) => item.ruleId, mergeRuleItem),
    files: mergeByKey([...current.files, ...incoming.files], (item) => item.path, mergeFileItem),
    timeline: mergeByKey([...current.timeline, ...incoming.timeline], (item) => `${item.type}|${item.title}|${item.timestamp}`, (left) => left)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    workflow: mergeByKey([...current.workflow, ...incoming.workflow], (item) => `${item.stage}|${item.prdPhase || ''}`, mergeWorkflow),
    events: mergeByKey([...current.events, ...incoming.events], (item) => `${item.type}|${item.time}|${JSON.stringify(item.data)}`, (left) => left)
      .sort((a, b) => a.time.localeCompare(b.time)),
    cost: {
      ...current.cost,
      ...incoming.cost,
      totalTokens: Math.max(current.cost.totalTokens || 0, incoming.cost.totalTokens || 0),
      estimatedManualHours: Math.max(current.cost.estimatedManualHours || 0, incoming.cost.estimatedManualHours || 0),
      actualHours: Math.max(current.cost.actualHours || 0, incoming.cost.actualHours || 0),
      tokenBreakdown: mergeByKey(
        [...(current.cost.tokenBreakdown || []), ...(incoming.cost.tokenBreakdown || [])],
        (item) => item.stage,
        (left, right) => ({ stage: left.stage || right.stage, tokens: Math.max(left.tokens, right.tokens) }),
      ),
      tokenDetail: current.cost.tokenDetail || incoming.cost.tokenDetail
        ? {
          inputTokens: Math.max(current.cost.tokenDetail?.inputTokens || 0, incoming.cost.tokenDetail?.inputTokens || 0),
          outputTokens: Math.max(current.cost.tokenDetail?.outputTokens || 0, incoming.cost.tokenDetail?.outputTokens || 0),
          cacheCreationTokens: Math.max(current.cost.tokenDetail?.cacheCreationTokens || 0, incoming.cost.tokenDetail?.cacheCreationTokens || 0),
          cacheReadTokens: Math.max(current.cost.tokenDetail?.cacheReadTokens || 0, incoming.cost.tokenDetail?.cacheReadTokens || 0),
        }
        : undefined,
    },
    highlights: mergeByKey<HighlightItem>([...current.highlights, ...incoming.highlights], (item) => `${item.content}|${item.createdAt}`, (left) => left),
  });

  recalcRunSummary(merged);
  merged.context.currentTaskId = resolveCurrentTaskId(merged.tasks);
  const activeTask = merged.tasks.find((item) => item.taskId === merged.context.currentTaskId);
  merged.context.currentStage = activeTask?.stageName;
  merged.context.currentPrdPhase = activeTask?.prdPhase;
  recalcMetrics(merged);
  return merged;
}

function mergeConflictFile<T>(
  filePath: string,
  mergeObjects: (ours: T | null, theirs: T | null) => T,
): MergeStatus {
  if (!fileExists(filePath)) return 'missing';
  const raw = readText(filePath);
  if (!raw.includes('<<<<<<<') && !raw.includes('>>>>>>>')) return 'no-conflict';
  const sections = extractConflictSections(raw);
  if (!sections) return 'error';
  const ours = parseConflictJsonObject<T>(sections.ours);
  const theirs = parseConflictJsonObject<T>(sections.theirs);
  const merged = mergeObjects(ours, theirs);
  writeJson(filePath, merged);
  return 'merged';
}

function walkJsonTargets(rootDir: string, targetName: string): string[] {
  if (!fileExists(rootDir)) return [];
  const results: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of readdirSync(current)) {
      const fullPath = resolve(current, name);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) stack.push(fullPath);
      else if (name === targetName) results.push(fullPath);
    }
  }
  return results.sort();
}

function walkMemoryModuleFiles(rootDir: string): string[] {
  if (!fileExists(rootDir)) return [];
  const results: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of readdirSync(current)) {
      const fullPath = resolve(current, name);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) stack.push(fullPath);
      else if (name.endsWith('.json')) results.push(fullPath);
    }
  }
  return results.sort();
}

function mergeFixedFile<T>(filePath: string, merger: (ours: T | null, theirs: T | null) => T, counters: MergeCountResult): void {
  const status = mergeConflictFile(filePath, merger);
  if (status === 'merged') counters.merged++;
  else if (status === 'missing') counters.missing++;
  else if (status === 'error') counters.errors++;
}

function mergeModuleFiles(files: string[], merger: (ours: ModuleMemoryRecord, theirs: ModuleMemoryRecord) => ModuleMemoryRecord): MergeCountResult {
  const counters: MergeCountResult = { status: 'no-conflict', merged: 0, missing: 0, errors: 0 };
  for (const filePath of files) {
    if (!hasConflict(filePath)) continue;
    const status = mergeConflictFile<ModuleMemoryRecord>(
      filePath,
      (ours, theirs) => merger(ours as ModuleMemoryRecord, theirs as ModuleMemoryRecord),
    );
    if (status === 'merged') counters.merged++;
    else if (status === 'error') counters.errors++;
  }
  counters.status = counters.errors > 0 ? 'error' : counters.merged > 0 ? 'merged' : 'no-conflict';
  return counters;
}

function mergeRunFiles(files: string[]): MergeCountResult {
  const counters: MergeCountResult = { status: 'no-conflict', merged: 0, missing: 0, errors: 0 };
  for (const filePath of files) {
    if (!hasConflict(filePath)) continue;
    const status = mergeConflictFile<RunData>(filePath, (ours, theirs) => mergeRunDataRecord(ours as RunData, theirs as RunData));
    if (status === 'merged') counters.merged++;
    else if (status === 'error') counters.errors++;
  }
  counters.status = counters.errors > 0 ? 'error' : counters.merged > 0 ? 'merged' : 'no-conflict';
  return counters;
}

export interface MergeDataSummary {
  memoryIndex: MergeCountResult
  moduleMemories: MergeCountResult
  contexts: MergeCountResult
  requirements: MergeCountResult
  runs: MergeCountResult
  rebuiltIndex: boolean
  rebuiltMemoryViews: boolean
}

export function mergeAidaJsonData(projectRoot: string): MergeDataSummary {
  const summary: MergeDataSummary = {
    memoryIndex: { status: 'missing', merged: 0, missing: 1, errors: 0 },
    moduleMemories: { status: 'missing', merged: 0, missing: 0, errors: 0 },
    contexts: { status: 'missing', merged: 0, missing: 0, errors: 0 },
    requirements: { status: 'missing', merged: 0, missing: 0, errors: 0 },
    runs: { status: 'missing', merged: 0, missing: 0, errors: 0 },
    rebuiltIndex: false,
    rebuiltMemoryViews: false,
  };

  if (!fileExists(configPath(projectRoot)) || !fileExists(aidaDir(projectRoot))) {
    return summary;
  }

  const memoryIndex = memoryIndexPath(projectRoot);
  if (fileExists(memoryIndex)) {
    summary.memoryIndex = { status: 'no-conflict', merged: 0, missing: 0, errors: 0 };
    mergeFixedFile<ModuleMemoryIndex>(memoryIndex, mergeMemoryIndex, summary.memoryIndex);
    summary.memoryIndex.status = summary.memoryIndex.errors > 0 ? 'error' : summary.memoryIndex.merged > 0 ? 'merged' : 'no-conflict';
  }

  const moduleFiles = walkMemoryModuleFiles(moduleMemoriesDir(projectRoot));
  summary.moduleMemories = moduleFiles.length === 0
    ? { status: 'missing', merged: 0, missing: 0, errors: 0 }
    : mergeModuleFiles(moduleFiles, mergeModuleMemoryRecord);

  const contextFiles = walkJsonTargets(runsDir(projectRoot), 'context.json');
  summary.contexts = { status: contextFiles.length === 0 ? 'missing' : 'no-conflict', merged: 0, missing: 0, errors: 0 };
  for (const filePath of contextFiles) {
    const status = mergeConflictFile<RunContextRecord>(filePath, (ours, theirs) => mergeRunContextRecord(ours as RunContextRecord, theirs as RunContextRecord));
    if (status === 'merged') summary.contexts.merged++;
    else if (status === 'error') summary.contexts.errors++;
  }
  if (summary.contexts.status !== 'missing') {
    summary.contexts.status = summary.contexts.errors > 0 ? 'error' : summary.contexts.merged > 0 ? 'merged' : 'no-conflict';
  }

  const requirementFiles = walkJsonTargets(runsDir(projectRoot), 'requirement.json');
  summary.requirements = { status: requirementFiles.length === 0 ? 'missing' : 'no-conflict', merged: 0, missing: 0, errors: 0 };
  for (const filePath of requirementFiles) {
    const status = mergeConflictFile<RequirementData>(filePath, (ours, theirs) => mergeRequirementRecord(ours as RequirementData, theirs as RequirementData));
    if (status === 'merged') summary.requirements.merged++;
    else if (status === 'error') summary.requirements.errors++;
  }
  if (summary.requirements.status !== 'missing') {
    summary.requirements.status = summary.requirements.errors > 0 ? 'error' : summary.requirements.merged > 0 ? 'merged' : 'no-conflict';
  }

  const runFiles = walkJsonTargets(runsDir(projectRoot), 'run.json');
  summary.runs = runFiles.length === 0 ? { status: 'missing', merged: 0, missing: 0, errors: 0 } : mergeRunFiles(runFiles);

  const hasAnyMerge = [
    summary.memoryIndex,
    summary.moduleMemories,
    summary.contexts,
    summary.requirements,
    summary.runs,
  ].some((item) => item.status === 'merged');

  if (hasAnyMerge) {
    hydrateMissingModuleMemoriesFromIndex(projectRoot);
    buildMemoryViews(projectRoot);
    summary.rebuiltMemoryViews = true;
    buildIndex(projectRoot);
    summary.rebuiltIndex = true;
  }

  return summary;
}

function printLine(label: string, result: MergeCountResult): void {
  if (result.status === 'merged') {
    console.log(`  ${label}: merged, ${result.merged} file(s)`);
  } else if (result.status === 'no-conflict') {
    console.log(`  ${label}: no conflict`);
  } else if (result.status === 'missing') {
    console.log(`  ${label}: missing`);
  } else {
    console.log(`  ${label}: parse error`);
  }
}

export async function mergeData(): Promise<void> {
  const projectRoot = process.cwd();

  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDA not initialized. Run `npx aida init` first.\n'));
    return;
  }

  const summary = mergeAidaJsonData(projectRoot);
  const hasError = [
    summary.memoryIndex,
    summary.moduleMemories,
    summary.contexts,
    summary.requirements,
    summary.runs,
  ].some((item) => item.status === 'error');
  if (hasError) {
    console.log(red('\n  AIDA data merge finished with parse errors. Resolve the remaining conflicted JSON manually.\n'));
    return;
  }

  const changed = [
    summary.memoryIndex,
    summary.moduleMemories,
    summary.contexts,
    summary.requirements,
    summary.runs,
  ].some((item) => item.status === 'merged');

  if (!changed) {
    console.log(yellow('\n  No AIDA JSON conflicts detected.\n'));
    return;
  }

  console.log(green('\n  ✓ AIDA data merge completed\n'));
  printLine('memory index', summary.memoryIndex);
  printLine('module memories', summary.moduleMemories);
  printLine('branch contexts', summary.contexts);
  printLine('requirements', summary.requirements);
  printLine('run.json', summary.runs);
  if (summary.rebuiltMemoryViews) console.log('  memory views: rebuilt');
  if (summary.rebuiltIndex) console.log('  project index: rebuilt');
  console.log('');
}
