import { readdirSync, statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { ensureDir, fileExists, readJson, readText, writeJson, writeText } from './fs.js';
import {
  branchDir,
  memoriesDir,
  memoryIndexPath,
  moduleMemoriesDir,
  moduleMemoryPath,
  moduleMemoryViewPath,
  requirementPath,
  runContextPath,
  runMemoryPackViewPath,
  runContextViewPath,
  runsDir,
} from './paths.js';
import type {
  ModuleMemoryIndex,
  ModuleMemoryIndexEntry,
  ModuleMemoryRecord,
  ModuleMemoryReference,
  RunContextRecord,
} from '../schemas/aida-project.js';
import type { RequirementData, RunData } from '../schemas/run-json.js';

export interface MemorySearchResult extends ModuleMemoryIndexEntry {
  score: number
}

export interface BuildMemoryViewsResult {
  moduleViews: number
  contextViews: number
  packViews: number
}

export interface LegacyMemoryMigrationResult {
  branches: number
  contextsWritten: number
  moduleMemoriesWritten: number
  modulesTouched: string[]
}

type ModuleMemoryUpsertInput = Partial<Omit<ModuleMemoryRecord, 'moduleKey' | 'updatedAt' | 'tickets'>> & {
  moduleKey: string
  title?: string
  tickets?: ModuleMemoryReference[]
}

type RunContextUpdateInput = Partial<Omit<RunContextRecord, 'branch' | 'updatedAt'>> & {
  branch: string
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

function normalizeRepoPath(value: string): string {
  return value.trim().replace(/\\/g, '/');
}

function isAidaRuntimePath(value: string): boolean {
  const path = normalizeRepoPath(value);
  return path.startsWith('.aida/runs/')
    || path.startsWith('.aida/memories/')
    || path === '.aida/bootstrap-state.local.json';
}

function filterMeaningfulPaths(values: Array<string | null | undefined>, limit?: number): string[] {
  const filtered = uniqueStrings(values.map((value) => normalizeRepoPath(value || '')))
    .filter((value) => value && !isAidaRuntimePath(value));
  return typeof limit === 'number' ? filtered.slice(0, limit) : filtered;
}

function topItems(values: string[], limit: number = 8): string[] {
  return uniqueStrings(values).slice(0, limit);
}

function walkJsonFiles(rootDir: string): string[] {
  if (!fileExists(rootDir)) return [];
  const result: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of readdirSync(current)) {
      const full = resolve(current, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        stack.push(full);
      } else if (name.endsWith('.json')) {
        result.push(full);
      }
    }
  }

  return result.sort();
}

function walkMarkdownFiles(rootDir: string): string[] {
  if (!fileExists(rootDir)) return [];
  const result: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of readdirSync(current)) {
      const full = resolve(current, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        stack.push(full);
      } else if (name.endsWith('.md')) {
        result.push(full);
      }
    }
  }

  return result.sort();
}

function walkRunJsonFiles(rootDir: string): string[] {
  if (!fileExists(rootDir)) return [];
  const result: string[] = [];
  for (const branchName of readdirSync(rootDir)) {
    const branchPath = resolve(rootDir, branchName);
    if (!statSync(branchPath).isDirectory()) continue;
    for (const child of readdirSync(branchPath)) {
      const runPath = resolve(branchPath, child, 'run.json');
      if (fileExists(runPath)) result.push(runPath);
    }
  }
  return result.sort();
}

function extractTicket(value: string): string | undefined {
  const match = value.match(/\b([A-Z]{2,}-\d+)\b/);
  return match?.[1];
}

function extractMarkdownSections(raw: string): Map<string, string> {
  const sections = new Map<string, string>();
  let current = '__lead__';
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text) sections.set(current.toLowerCase(), text);
    buffer = [];
  };

  for (const line of raw.split('\n')) {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      flush();
      current = heading[1].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  return sections;
}

function extractBulletItems(raw: string): string[] {
  const items: string[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (bullet) items.push(bullet[1].trim());
    else if (ordered) items.push(ordered[1].trim());
  }
  return uniqueStrings(items);
}

function findSectionItems(raw: string, keys: string[]): string[] {
  const sections = extractMarkdownSections(raw);
  for (const [heading, content] of sections) {
    if (keys.some((key) => heading.includes(key))) {
      const items = extractBulletItems(content);
      if (items.length > 0) return items;
    }
  }
  return [];
}

function extractSummaryFromAnalysis(raw: string): string {
  const sections = extractMarkdownSections(raw);
  for (const [heading, content] of sections) {
    if (heading.includes('概述') || heading.includes('摘要') || heading.includes('summary') || heading.includes('overview')) {
      const paragraph = content
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line && !line.startsWith('- ') && !line.startsWith('* ') && !line.startsWith('>'));
      if (paragraph) return paragraph;
    }
  }

  const lead = sections.get('__lead__');
  if (!lead) return '';
  return lead
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#') && !line.startsWith('- ') && !line.startsWith('* '))
    || '';
}

function loadRequirement(projectRoot: string, branchName: string): RequirementData | null {
  const path = requirementPath(projectRoot, branchName);
  if (!fileExists(path)) return null;
  return readJson<RequirementData>(path);
}

function loadAnalysis(projectRoot: string, branchName: string): string {
  const path = resolve(branchDir(projectRoot, branchName), 'analysis.md');
  if (!fileExists(path)) return '';
  return readText(path);
}

function loadBranchRuns(projectRoot: string, branchName: string): RunData[] {
  const dir = branchDir(projectRoot, branchName);
  if (!fileExists(dir)) return [];
  const runs: RunData[] = [];
  for (const child of readdirSync(dir)) {
    const runPath = resolve(dir, child, 'run.json');
    if (fileExists(runPath)) {
      try {
        runs.push(readJson<RunData>(runPath));
      } catch {
        // Ignore invalid legacy run files during migration.
      }
    }
  }
  return runs;
}

function pickKeyFiles(runs: RunData[]): string[] {
  const score = new Map<string, number>();
  for (const run of runs) {
    for (const file of run.files || []) {
      if (isAidaRuntimePath(file.path)) continue;
      const path = normalizeRepoPath(file.path);
      const weight = (file.linesAdded || 0) + (file.linesRemoved || 0) + ((file.changeCount || 1) * 5);
      score.set(path, (score.get(path) || 0) + weight);
    }
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path]) => path);
}

function deriveCurrentPhase(runs: RunData[]): string {
  const tasks = runs.flatMap((run) => run.tasks || []);
  if (tasks.some((task) => task.status === 'in-progress')) return 'In Progress';
  if (tasks.some((task) => task.status === 'pending')) return 'Planned';
  if (tasks.some((task) => task.status === 'done')) return 'Completed';
  return 'Not Started';
}

function inferModules(requirement: RequirementData | null, runs: RunData[]): string[] {
  if (requirement?.modules?.length) {
    return uniqueStrings(requirement.modules.map((module) => module.name).filter(Boolean));
  }
  return uniqueStrings(
    runs
      .flatMap((run) => run.tasks || [])
      .map((task) => task.stageName)
      .filter((stage) => stage && stage !== 'default'),
  );
}

function renderListSection(title: string, values: string[]): string {
  if (values.length === 0) return `## ${title}\n\n- None\n`;
  return `## ${title}\n\n${values.map((value) => `- ${value}`).join('\n')}\n`;
}

function renderModuleMemoryCompact(record: ModuleMemoryRecord): string {
  const lines: string[] = [
    `## Module: ${record.title}`,
    '',
    `- Key: ${record.moduleKey}`,
    `- Updated At: ${record.updatedAt}`,
    '',
    record.summary || 'No summary yet.',
    '',
    renderListSection('Entry Files', record.entryFiles.slice(0, 6)).trimEnd(),
    '',
    renderListSection('Decisions', record.decisions.slice(0, 6)).trimEnd(),
    '',
    renderListSection('Constraints', record.constraints.slice(0, 6)).trimEnd(),
    '',
    renderListSection('Pitfalls', record.pitfalls.slice(0, 6)).trimEnd(),
    '',
  ];
  return lines.join('\n').trimEnd();
}

function splitQueryTokens(query: string): string[] {
  return uniqueStrings(
    query
      .toLowerCase()
      .split(/[\s,/._-]+/)
      .filter((item) => item.length > 1),
  );
}

function scoreText(query: string, tokens: string[], candidate: string): number {
  const text = candidate.toLowerCase();
  let score = 0;
  if (!candidate) return score;
  if (text.includes(query)) score += 8;
  for (const token of tokens) {
    if (text.includes(token)) score += 3;
  }
  return score;
}

export function normalizeModuleKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_\u4e00-\u9fa5-]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function loadMemoryIndex(projectRoot: string): ModuleMemoryIndex {
  const path = memoryIndexPath(projectRoot);
  if (!fileExists(path)) {
    return {
      updatedAt: new Date().toISOString(),
      modules: [],
    };
  }
  return readJson<ModuleMemoryIndex>(path);
}

export function saveMemoryIndex(projectRoot: string, index: ModuleMemoryIndex): void {
  ensureDir(memoriesDir(projectRoot));
  writeJson(memoryIndexPath(projectRoot), index);
}

export function loadModuleMemory(projectRoot: string, moduleKey: string): ModuleMemoryRecord | null {
  const normalized = normalizeModuleKey(moduleKey);
  const path = moduleMemoryPath(projectRoot, normalized);
  if (fileExists(path)) return readJson<ModuleMemoryRecord>(path);
  const viewPath = moduleMemoryViewPath(projectRoot, normalized);
  if (!fileExists(viewPath)) return null;
  return moduleMemoryRecordFromMarkdown(readText(viewPath));
}

function upsertMemoryIndexEntry(projectRoot: string, record: ModuleMemoryRecord): void {
  const index = loadMemoryIndex(projectRoot);
  const entry = memoryIndexEntryFromRecord(record);
  const next = index.modules.filter((item) => item.key !== record.moduleKey);
  next.push(entry);
  next.sort((a, b) => a.key.localeCompare(b.key));
  saveMemoryIndex(projectRoot, {
    updatedAt: new Date().toISOString(),
    modules: next,
  });
}

function memoryIndexEntryFromRecord(record: ModuleMemoryRecord): ModuleMemoryIndexEntry {
  return {
    key: record.moduleKey,
    title: record.title,
    summary: record.summary,
    keywords: topItems([record.moduleKey, record.title, ...record.keywords], 12),
    paths: filterMeaningfulPaths([...record.entryFiles, ...record.relatedPaths], 12),
    updatedAt: record.updatedAt,
  };
}

function mergeMemoryIndexEntry(
  existing: ModuleMemoryIndexEntry | undefined,
  next: ModuleMemoryIndexEntry,
): ModuleMemoryIndexEntry {
  if (!existing) return next;
  return {
    key: next.key,
    title: next.title || existing.title,
    summary: next.summary || existing.summary,
    keywords: topItems([...(existing.keywords || []), ...(next.keywords || [])], 12),
    paths: filterMeaningfulPaths([...(existing.paths || []), ...(next.paths || [])], 12),
    updatedAt: next.updatedAt || existing.updatedAt,
  };
}

function parseListSection(raw: string, title: string): string[] {
  return findSectionItems(raw, [title.toLowerCase()]);
}

function moduleMemoryRecordFromMarkdown(raw: string): ModuleMemoryRecord | null {
  const moduleKey = raw.match(/^- Module Key:\s+(.+)$/m)?.[1]?.trim();
  if (!moduleKey) return null;

  const sections = extractMarkdownSections(raw);
  const summary = sections.get('summary') || '';

  return {
    moduleKey,
    title: raw.match(/^- Title:\s+(.+)$/m)?.[1]?.trim() || moduleKey,
    summary,
    keywords: parseListSection(raw, 'keywords'),
    entryFiles: parseListSection(raw, 'entry files'),
    relatedPaths: parseListSection(raw, 'related paths'),
    dataFlow: parseListSection(raw, 'data flow'),
    decisions: parseListSection(raw, 'decisions'),
    constraints: parseListSection(raw, 'constraints'),
    pitfalls: parseListSection(raw, 'pitfalls'),
    relatedRules: parseListSection(raw, 'related rules'),
    tickets: [],
    updatedAt: raw.match(/^- Updated At:\s+(.+)$/m)?.[1]?.trim() || new Date().toISOString(),
  };
}

export function rebuildMemoryIndexFromDisk(projectRoot: string): ModuleMemoryIndex {
  ensureDir(moduleMemoriesDir(projectRoot));
  const byKey = new Map<string, ModuleMemoryIndexEntry>();

  for (const entry of loadMemoryIndex(projectRoot).modules || []) {
    byKey.set(entry.key, entry);
  }

  for (const file of walkJsonFiles(moduleMemoriesDir(projectRoot))) {
    if (basename(file) === 'index.json') continue;
    const record = readJson<ModuleMemoryRecord>(file);
    const entry = memoryIndexEntryFromRecord(record);
    byKey.set(record.moduleKey, mergeMemoryIndexEntry(byKey.get(record.moduleKey), entry));
  }

  for (const file of walkMarkdownFiles(moduleMemoriesDir(projectRoot))) {
    const record = moduleMemoryRecordFromMarkdown(readText(file));
    if (!record) continue;
    const entry = memoryIndexEntryFromRecord(record);
    byKey.set(record.moduleKey, mergeMemoryIndexEntry(byKey.get(record.moduleKey), entry));
  }

  const index = {
    updatedAt: new Date().toISOString(),
    modules: [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
  saveMemoryIndex(projectRoot, index);
  return index;
}

export function saveModuleMemory(projectRoot: string, record: ModuleMemoryRecord): void {
  const path = moduleMemoryPath(projectRoot, record.moduleKey);
  ensureDir(dirname(path));
  writeJson(path, record);
  upsertMemoryIndexEntry(projectRoot, record);
}

export function loadRunContext(projectRoot: string, branchName: string): RunContextRecord | null {
  const path = runContextPath(projectRoot, branchName);
  if (!fileExists(path)) return null;
  return readJson<RunContextRecord>(path);
}

export function saveRunContext(projectRoot: string, branchName: string, record: RunContextRecord): void {
  ensureDir(branchDir(projectRoot, branchName));
  writeJson(runContextPath(projectRoot, branchName), record);
}

export function renderModuleMemoryMarkdown(record: ModuleMemoryRecord): string {
  const lines: string[] = [
    '# Module Memory',
    '',
    `- Module Key: ${record.moduleKey}`,
    `- Title: ${record.title}`,
    `- Updated At: ${record.updatedAt}`,
    '',
    '## Summary',
    '',
    record.summary || 'No summary yet.',
    '',
    renderListSection('Keywords', record.keywords).trimEnd(),
    '',
    renderListSection('Entry Files', record.entryFiles).trimEnd(),
    '',
    renderListSection('Related Paths', record.relatedPaths).trimEnd(),
    '',
    renderListSection('Data Flow', record.dataFlow).trimEnd(),
    '',
    renderListSection('Decisions', record.decisions).trimEnd(),
    '',
    renderListSection('Constraints', record.constraints).trimEnd(),
    '',
    renderListSection('Pitfalls', record.pitfalls).trimEnd(),
    '',
    renderListSection('Related Rules', record.relatedRules).trimEnd(),
    '',
    '## Related Tickets',
    '',
    ...(record.tickets.length > 0
      ? record.tickets.map((ticket) => `- ${[ticket.ticket, ticket.branch, ticket.summary].filter(Boolean).join(' | ')}`)
      : ['- None']),
    '',
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}

export function renderRunContextMarkdown(record: RunContextRecord): string {
  const lines: string[] = [
    '# Run Context',
    '',
    `- Branch: ${record.branch}`,
    `- Title: ${record.title}`,
    `- Ticket: ${record.ticket || '-'}`,
    `- Current Phase: ${record.currentPhase}`,
    `- Updated At: ${record.updatedAt}`,
    '',
    '## Summary',
    '',
    record.summary || 'No summary yet.',
    '',
    renderListSection('Modules', record.modules).trimEnd(),
    '',
    renderListSection('Completed', record.completed).trimEnd(),
    '',
    renderListSection('In Progress', record.inProgress).trimEnd(),
    '',
    renderListSection('Next', record.next).trimEnd(),
    '',
    renderListSection('Decisions', record.decisions).trimEnd(),
    '',
    renderListSection('Constraints', record.constraints).trimEnd(),
    '',
    renderListSection('Key Files', record.keyFiles).trimEnd(),
    '',
    renderListSection('Risks', record.risks).trimEnd(),
    '',
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}

export function renderRunMemoryPackMarkdown(
  context: RunContextRecord,
  modules: ModuleMemoryRecord[],
): string {
  const lines: string[] = [
    '# Runtime Memory Pack',
    '',
    '> This file is auto-generated from branch context and related module memories.',
    '',
    renderRunContextMarkdown(context).trimEnd(),
  ];

  if (modules.length > 0) {
    lines.push('', '# Related Module Memories', '');
    for (const module of modules) {
      lines.push(renderModuleMemoryCompact(module), '');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export function buildMemoryViews(projectRoot: string): BuildMemoryViewsResult {
  ensureDir(moduleMemoriesDir(projectRoot));
  let moduleViews = 0;
  for (const file of walkJsonFiles(moduleMemoriesDir(projectRoot))) {
    if (basename(file) === 'index.json') continue;
    const record = readJson<ModuleMemoryRecord>(file);
    const viewPath = moduleMemoryViewPath(projectRoot, record.moduleKey);
    ensureDir(dirname(viewPath));
    writeText(viewPath, renderModuleMemoryMarkdown(record));
    moduleViews++;
  }

  let contextViews = 0;
  let packViews = 0;
  const root = runsDir(projectRoot);
  if (!fileExists(root)) {
    rebuildMemoryIndexFromDisk(projectRoot);
    return { moduleViews, contextViews, packViews };
  }
  for (const branchName of readdirSync(root)) {
    const safeBranchDir = resolve(root, branchName);
    if (!fileExists(safeBranchDir) || !statSync(safeBranchDir).isDirectory()) continue;
    const contextPath = resolve(safeBranchDir, 'context.json');
    if (!fileExists(contextPath)) continue;
    const record = readJson<RunContextRecord>(contextPath);
    writeText(runContextViewPath(projectRoot, record.branch), renderRunContextMarkdown(record));
    contextViews++;

    const modules = record.modules
      .map((moduleName) => loadModuleMemory(projectRoot, moduleName))
      .filter((item): item is ModuleMemoryRecord => item !== null);
    writeText(runMemoryPackViewPath(projectRoot, record.branch), renderRunMemoryPackMarkdown(record, modules));
    packViews++;
  }

  rebuildMemoryIndexFromDisk(projectRoot);
  return { moduleViews, contextViews, packViews };
}

export function buildRunContextFromBranch(projectRoot: string, branchName: string): RunContextRecord | null {
  const requirement = loadRequirement(projectRoot, branchName);
  const analysis = loadAnalysis(projectRoot, branchName);
  const runs = loadBranchRuns(projectRoot, branchName);

  if (!requirement && !analysis && runs.length === 0) {
    return null;
  }

  const modules = inferModules(requirement, runs);
  const completed = topItems(runs.flatMap((run) => run.tasks || []).filter((task) => task.status === 'done').map((task) => task.title));
  const inProgress = topItems(runs.flatMap((run) => run.tasks || []).filter((task) => task.status === 'in-progress').map((task) => task.title));
  const next = topItems(runs.flatMap((run) => run.tasks || []).filter((task) => task.status === 'pending').map((task) => task.title));
  const decisions = topItems(findSectionItems(analysis, ['决策', 'decision', '方案']));
  const constraints = topItems(findSectionItems(analysis, ['约束', 'constraint', '限制']));
  const analysisRisks = findSectionItems(analysis, ['风险', 'risk', '注意']);
  const runRisks = [
    ...runs.flatMap((run) => run.bugs || []).filter((bug) => bug.status !== 'fixed').map((bug) => bug.title),
    ...runs.flatMap((run) => run.deviations || []).map((deviation) => deviation.title),
  ];
  const title = requirement?.title || extractTicket(branchName) || branchName;

  return {
    branch: branchName,
    ticket: extractTicket(requirement?.title || '') || extractTicket(branchName),
    title,
    summary: requirement?.summary || extractSummaryFromAnalysis(analysis) || title,
    currentPhase: deriveCurrentPhase(runs),
    modules,
    completed,
    inProgress,
    next,
    decisions,
    constraints,
    keyFiles: pickKeyFiles(runs),
    risks: topItems([...analysisRisks, ...runRisks]),
    updatedAt: new Date().toISOString(),
  };
}

function collectRelatedPaths(moduleName: string, branchContext: RunContextRecord, runs: RunData[]): string[] {
  const query = moduleName.toLowerCase();
  const tokens = splitQueryTokens(query);
  const scored = new Map<string, number>();

  for (const path of branchContext.keyFiles) {
    const score = scoreText(query, tokens, path);
    if (score > 0) scored.set(path, score);
  }

  for (const run of runs) {
    for (const task of run.tasks || []) {
      if (task.stageName !== moduleName) continue;
      for (const file of run.files || []) {
        if (isAidaRuntimePath(file.path)) continue;
        const path = normalizeRepoPath(file.path);
        const bonus = (file.linesAdded || 0) + (file.linesRemoved || 0) + 10;
        scored.set(path, (scored.get(path) || 0) + bonus);
      }
    }
  }

  const ranked = [...scored.entries()].sort((a, b) => b[1] - a[1]).map(([path]) => path);
  return ranked.length > 0 ? ranked.slice(0, 8) : filterMeaningfulPaths(branchContext.keyFiles, 5);
}

export function upsertModuleMemory(projectRoot: string, input: ModuleMemoryUpsertInput): ModuleMemoryRecord {
  const moduleKey = normalizeModuleKey(input.moduleKey);
  const existing = loadModuleMemory(projectRoot, moduleKey);
  const record: ModuleMemoryRecord = {
    moduleKey,
    title: input.title || existing?.title || moduleKey,
    summary: input.summary || existing?.summary || '',
    keywords: topItems([...(existing?.keywords || []), ...(input.keywords || []), moduleKey, input.title || ''], 16),
    entryFiles: filterMeaningfulPaths([...(existing?.entryFiles || []), ...(input.entryFiles || [])], 8),
    relatedPaths: filterMeaningfulPaths([...(existing?.relatedPaths || []), ...(input.relatedPaths || [])], 12),
    dataFlow: topItems([...(existing?.dataFlow || []), ...(input.dataFlow || [])]),
    decisions: topItems([...(existing?.decisions || []), ...(input.decisions || [])]),
    constraints: topItems([...(existing?.constraints || []), ...(input.constraints || [])]),
    pitfalls: topItems([...(existing?.pitfalls || []), ...(input.pitfalls || [])]),
    relatedRules: topItems([...(existing?.relatedRules || []), ...(input.relatedRules || [])], 12),
    tickets: [
      ...(existing?.tickets || []),
      ...((input.tickets || []).filter((ticket) => ticket.summary.trim().length > 0)),
    ].filter((ticket, index, array) =>
      array.findIndex((item) =>
        item.ticket === ticket.ticket
        && item.branch === ticket.branch
        && item.summary === ticket.summary,
      ) === index),
    updatedAt: new Date().toISOString(),
  };
  saveModuleMemory(projectRoot, record);
  return record;
}

export function updateRunContext(projectRoot: string, input: RunContextUpdateInput): RunContextRecord {
  const existing = loadRunContext(projectRoot, input.branch);
  const record: RunContextRecord = {
    branch: input.branch,
    ticket: input.ticket ?? existing?.ticket,
    title: input.title || existing?.title || input.branch,
    summary: input.summary || existing?.summary || '',
    currentPhase: input.currentPhase || existing?.currentPhase || 'Not Started',
    modules: topItems([...(existing?.modules || []), ...(input.modules || [])], 12),
    completed: topItems([...(existing?.completed || []), ...(input.completed || [])], 12),
    inProgress: topItems([...(existing?.inProgress || []), ...(input.inProgress || [])], 12),
    next: topItems([...(existing?.next || []), ...(input.next || [])], 12),
    decisions: topItems([...(existing?.decisions || []), ...(input.decisions || [])], 12),
    constraints: topItems([...(existing?.constraints || []), ...(input.constraints || [])], 12),
    keyFiles: filterMeaningfulPaths([...(existing?.keyFiles || []), ...(input.keyFiles || [])], 12),
    risks: topItems([...(existing?.risks || []), ...(input.risks || [])], 12),
    updatedAt: new Date().toISOString(),
  };
  saveRunContext(projectRoot, input.branch, record);
  return record;
}

export function searchModuleMemories(
  projectRoot: string,
  query: string,
  pathHints: string[] = [],
): MemorySearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const tokens = splitQueryTokens(normalizedQuery);
  const hints = pathHints.map((hint) => hint.toLowerCase());
  let index = loadMemoryIndex(projectRoot);
  if (index.modules.length === 0 && fileExists(moduleMemoriesDir(projectRoot))) {
    index = rebuildMemoryIndexFromDisk(projectRoot);
  }

  return index.modules
    .map((entry) => {
      let score = 0;
      score += scoreText(normalizedQuery, tokens, entry.key) * 2;
      score += scoreText(normalizedQuery, tokens, entry.title) * 2;
      score += scoreText(normalizedQuery, tokens, entry.summary);
      score += entry.keywords.reduce((sum, keyword) => sum + scoreText(normalizedQuery, tokens, keyword), 0);
      score += entry.paths.reduce((sum, path) => sum + scoreText(normalizedQuery, tokens, path), 0);
      for (const hint of hints) {
        if (entry.paths.some((path) => path.toLowerCase().includes(hint))) score += 10;
      }
      return { ...entry, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .slice(0, 8);
}

export function migrateLegacyMemories(projectRoot: string): LegacyMemoryMigrationResult {
  ensureDir(moduleMemoriesDir(projectRoot));
  const branchesDir = runsDir(projectRoot);
  if (!fileExists(branchesDir)) {
    return { branches: 0, contextsWritten: 0, moduleMemoriesWritten: 0, modulesTouched: [] };
  }

  let branches = 0;
  let contextsWritten = 0;
  let moduleMemoriesWritten = 0;
  const modulesTouched = new Set<string>();

  for (const safeBranch of readdirSync(branchesDir)) {
    const branchPath = resolve(branchesDir, safeBranch);
    if (!statSync(branchPath).isDirectory()) continue;
    const requirement = fileExists(resolve(branchPath, 'requirement.json'));
    const analysis = fileExists(resolve(branchPath, 'analysis.md'));
    const runFiles = walkRunJsonFiles(branchesDir).filter((file) => file.includes(`/${safeBranch}/`));
    if (!requirement && !analysis && runFiles.length === 0) continue;

    const requirementData = requirement
      ? readJson<RequirementData>(resolve(branchPath, 'requirement.json'))
      : null;
    const branchName = requirementData?.branch || safeBranch.replace(/-/g, '/');
    const context = buildRunContextFromBranch(projectRoot, branchName);
    if (!context) continue;

    branches++;
    saveRunContext(projectRoot, branchName, context);
    contextsWritten++;

    const runs = loadBranchRuns(projectRoot, branchName);
    const req = loadRequirement(projectRoot, branchName);
    const moduleCandidates = req?.modules?.length
      ? req.modules.map((module) => ({ name: module.name, description: module.description }))
      : context.modules.map((name) => ({ name, description: '' }));

    for (const candidate of moduleCandidates) {
      if (!candidate.name.trim()) continue;
      const moduleKey = normalizeModuleKey(candidate.name);
      const relatedPaths = collectRelatedPaths(candidate.name, context, runs);
      upsertModuleMemory(projectRoot, {
        moduleKey,
        title: candidate.name,
        summary: candidate.description || context.summary,
        keywords: [candidate.name, moduleKey, context.title],
        entryFiles: relatedPaths.slice(0, 5),
        relatedPaths,
        decisions: context.decisions,
        constraints: context.constraints,
        pitfalls: context.risks,
        tickets: [{
          ticket: context.ticket,
          branch: branchName,
          summary: context.summary,
          updatedAt: context.updatedAt,
        }],
      });
      moduleMemoriesWritten++;
      modulesTouched.add(moduleKey);
    }
  }

  buildMemoryViews(projectRoot);
  rebuildMemoryIndexFromDisk(projectRoot);

  return {
    branches,
    contextsWritten,
    moduleMemoriesWritten,
    modulesTouched: [...modulesTouched].sort(),
  };
}

export function rebuildCurrentBranchMemory(projectRoot: string, branchName: string): {
  context: RunContextRecord | null
  modules: ModuleMemoryRecord[]
} {
  const context = buildRunContextFromBranch(projectRoot, branchName);
  if (!context) {
    return { context: null, modules: [] };
  }

  saveRunContext(projectRoot, branchName, context);
  const req = loadRequirement(projectRoot, branchName);
  const runs = loadBranchRuns(projectRoot, branchName);
  const modules: ModuleMemoryRecord[] = [];

  for (const moduleName of inferModules(req, runs)) {
    const relatedPaths = collectRelatedPaths(moduleName, context, runs);
    modules.push(upsertModuleMemory(projectRoot, {
      moduleKey: moduleName,
      title: moduleName,
      summary: req?.modules?.find((module) => module.name === moduleName)?.description || context.summary,
      keywords: [moduleName, context.title],
      entryFiles: relatedPaths.slice(0, 5),
      relatedPaths,
      decisions: context.decisions,
      constraints: context.constraints,
      pitfalls: context.risks,
      tickets: [{
        ticket: context.ticket,
        branch: branchName,
        summary: context.summary,
        updatedAt: context.updatedAt,
      }],
    }));
  }

  buildMemoryViews(projectRoot);
  return { context, modules };
}

export function loadRunMemoryPack(projectRoot: string, branchName: string): {
  context: RunContextRecord
  modules: ModuleMemoryRecord[]
} | null {
  const context = loadRunContext(projectRoot, branchName);
  if (!context) return null;
  const modules = context.modules
    .map((moduleName) => loadModuleMemory(projectRoot, moduleName))
    .filter((item): item is ModuleMemoryRecord => item !== null);
  return { context, modules };
}
