import { readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { ensureDir, fileExists, readJson, readText, writeJson, writeText } from './fs.js';
import {
  branchDir,
  legacyModuleMemoryPath,
  legacyModuleMemoryViewPath,
  memoriesDir,
  memoryIndexPath,
  moduleMemoriesDir,
  moduleMemoryPath,
  moduleMemoryViewPath,
  requirementPath,
  runContextPath,
  runsDir,
} from './paths.js';
// ─── Types inlined from deleted 2.0 schema files ─────────────────────────────

interface ModuleMemoryReference {
  ticket?: string;
  branch?: string;
  summary: string;
  updatedAt?: string;
}

interface ModuleChangeEntry {
  ticket?: string;
  branch?: string;
  title?: string;
  summary: string;
  updatedAt: string;
}

interface ModuleMemoryRecord {
  schemaVersion?: string;
  moduleKey: string;
  title: string;
  summary: string;
  keywords: string[];
  entryFiles: string[];
  relatedPaths: string[];
  dataFlow: string[];
  decisions: string[];
  constraints: string[];
  pitfalls: string[];
  relatedRules: string[];
  tickets: ModuleMemoryReference[];
  changes?: ModuleChangeEntry[];
  updatedAt: string;
}

interface ModuleMemoryIndexEntry {
  key: string;
  title: string;
  summary: string;
  keywords: string[];
  paths: string[];
  tickets?: string[];
  updatedAt: string;
}

interface ModuleMemoryIndex {
  schemaVersion?: string;
  updatedAt: string;
  items: ModuleMemoryIndexEntry[];
}

interface RunContextRecord {
  branch: string;
  ticket?: string;
  title: string;
  summary: string;
  currentPhase: string;
  modules: string[];
  completed: string[];
  inProgress: string[];
  next: string[];
  decisions: string[];
  constraints: string[];
  keyFiles: string[];
  risks: string[];
  updatedAt: string;
}

// Legacy 2.0 runtime types — used only by rebuildCurrentBranchMemory internals
// ponytail: any is intentional here, these schemas are 2.0 read-only legacy
type RequirementData = any;
type RunData = any;

interface MemorySearchResult extends ModuleMemoryIndexEntry {
  score: number
}

interface BuildMemoryViewsResult {
  moduleViews: number
  contextViews: number
  packViews: number
}

interface ModuleDescriptor {
  key: string
  title: string
  description?: string
}

type ModuleMemoryUpsertInput = Partial<Omit<ModuleMemoryRecord, 'moduleKey' | 'updatedAt' | 'tickets'>> & {
  moduleKey: string
  title?: string
  tickets?: ModuleMemoryReference[]
  changeTitle?: string
}

type RunContextUpdateInput = Partial<Omit<RunContextRecord, 'branch' | 'updatedAt'>> & {
  branch: string
}

const MEMORY_SCHEMA_VERSION = '2.0';

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

function normalizeRepoPath(value: string): string {
  return value.trim().replace(/\\/g, '/');
}

function stripKnownSourcePrefix(path: string): string {
  const normalized = normalizeRepoPath(path);
  const prefixes = [
    'src/modules/',
    'src/module/',
    'src/features/',
    'src/feature/',
    'src/pages/',
    'src/views/',
    'src/components/',
    'src/',
  ];
  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length);
    }
  }
  return normalized;
}

function isNoisePath(value: string): boolean {
  const path = normalizeRepoPath(value);
  const fileName = basename(path);
  return path.startsWith('.../')
    || fileName.startsWith('.')
    || fileName === 'yarn.lock'
    || fileName === 'package-lock.json'
    || fileName === 'pnpm-lock.yaml'
    || fileName === 'bun.lockb';
}

function isGeneratedToolingPath(value: string): boolean {
  const path = normalizeRepoPath(value);
  return path === 'AGENTS.md'
    || path === 'CLAUDE.md'
    || path === '.mcp.json'
    || path.startsWith('.claude/')
    || path.startsWith('.cursor/')
    || path.startsWith('.codex/')
    || path.startsWith('.kiro/')
    || path.startsWith('.agents/')
    || path.startsWith('.agent/')
    || path.startsWith('.roo/')
    || path.startsWith('.roo-code/')
    || path.startsWith('.augment/')
    || path.startsWith('.gemini/')
    || path.startsWith('.vscode/')
    || path.startsWith('.lingma/')
    || path.startsWith('.windsurf/');
}

function isAidaRuntimePath(value: string): boolean {
  const path = normalizeRepoPath(value);
  return path.startsWith('.aida/');
}

function filterMeaningfulPaths(values: Array<string | null | undefined>, limit?: number): string[] {
  const filtered = uniqueStrings(values.map((value) => normalizeRepoPath(value || '')))
    .filter((value) => value && !isAidaRuntimePath(value) && !isNoisePath(value) && !isGeneratedToolingPath(value));
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

function pruneEmptyModuleMemoryDirs(rootDir: string): void {
  if (!fileExists(rootDir)) return;

  for (const name of readdirSync(rootDir)) {
    const full = resolve(rootDir, name);
    if (!statSync(full).isDirectory()) continue;
    pruneEmptyModuleMemoryDirs(full);
    if (readdirSync(full).length === 0) {
      rmSync(full, { recursive: true, force: true });
    }
  }
}

function migrateLegacyNestedModuleMemoryLayout(projectRoot: string): void {
  const rootDir = moduleMemoriesDir(projectRoot);
  if (!fileExists(rootDir)) return;

  const files = [
    ...walkJsonFiles(rootDir).filter((file) => basename(file) !== 'index.json'),
    ...walkMarkdownFiles(rootDir),
  ];

  for (const file of files) {
    const relative = file.slice(rootDir.length + 1).replace(/\\/g, '/');
    if (!relative.includes('/')) continue;

    const moduleKey = relative.replace(/\.(json|md)$/u, '');
    const target = file.endsWith('.json')
      ? moduleMemoryPath(projectRoot, moduleKey)
      : moduleMemoryViewPath(projectRoot, moduleKey);
    if (target === file) continue;

    ensureDir(dirname(target));
    if (fileExists(target)) {
      rmSync(file, { force: true });
      continue;
    }
    renameSync(file, target);
  }

  pruneEmptyModuleMemoryDirs(rootDir);
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
      if (isAidaRuntimePath(file.path) || isNoisePath(file.path) || isGeneratedToolingPath(file.path)) continue;
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

function inferModuleDescriptors(requirement: RequirementData | null, runs: RunData[]): ModuleDescriptor[] {
  const byKey = new Map<string, ModuleDescriptor>();
  const meaningfulRunPaths = runs
    .flatMap((run) => run.files || [])
    .filter((file) => !isAidaRuntimePath(file.path) && !isNoisePath(file.path) && !isGeneratedToolingPath(file.path))
    .map((file) => file.path);

  const put = (descriptor: ModuleDescriptor) => {
    const key = normalizeModuleKey(descriptor.key);
    if (!key || key === 'default') return;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        key,
        title: descriptor.title || key,
        description: descriptor.description || undefined,
      });
      return;
    }
    byKey.set(key, {
      key,
      title: existing.title || descriptor.title || key,
      description: existing.description || descriptor.description || undefined,
    });
  };

  if (requirement?.modules?.length) {
    for (const module of requirement.modules) {
      const candidatePaths = typeof (module as any).file === 'string' && (module as any).file.trim().length > 0
        ? [(module as any).file]
        : meaningfulRunPaths;
      put(deriveModuleDescriptor(module.name, candidatePaths, module.description || ''));
    }
  } else {
    const stageNames = uniqueStrings(
      runs
        .flatMap((run) => run.tasks || [])
        .map((task) => task.stageName)
        .filter((stage) => stage && stage !== 'default'),
    );
    for (const stageName of stageNames) {
      put(deriveModuleDescriptor(stageName, meaningfulRunPaths));
    }
    if (byKey.size === 0) {
      for (const descriptor of inferModuleDescriptorsFromPaths(meaningfulRunPaths)) {
        put(descriptor);
      }
    }
  }

  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
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
    .replace(/\s*\/\s*/g, '/')
    .replace(/-\//g, '/')
    .replace(/\/-/g, '/')
    .replace(/[^a-z0-9/_\u4e00-\u9fa5-]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeModuleSegment(value: string): string {
  return normalizeModuleKey(value).replace(/\//g, '-');
}

function isGenericPathStem(value: string): boolean {
  return new Set([
    'index',
    'page',
    'view',
    'component',
    'service',
    'services',
    'store',
    'model',
    'models',
    'type',
    'types',
    'utils',
    'util',
    'helper',
    'helpers',
    'api',
    'hooks',
    'hook',
  ]).has(value);
}

function isGenericModuleName(value: string): boolean {
  return new Set([
    'module',
    'modules',
    'feature',
    'features',
    'page',
    'pages',
    'view',
    'views',
    'component',
    'components',
    'api',
    'utils',
    'util',
    'helper',
    'helpers',
    '基础设施',
    '视图层',
    '集成',
    '国际化',
    '公共工具',
    '工具',
    '配置',
  ]).has(value);
}

function areAllModulesGeneric(values: string[]): boolean {
  return values.length > 0 && values.every((value) => isGenericModuleName(normalizeModuleKey(value)));
}

function isPlaceholderBranchText(value: string | undefined, branchName: string): boolean {
  if (!value) return true;
  const normalized = value.trim();
  if (!normalized) return true;
  return normalized === branchName || normalized === branchName.replace(/-/g, '/');
}

function inferModuleDescriptorsFromPaths(paths: Array<string | null | undefined>): ModuleDescriptor[] {
  const byKey = new Map<string, ModuleDescriptor>();
  for (const path of filterMeaningfulPaths(paths)) {
    const key = deriveModuleKeyFromPaths([path]);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, { key, title: key });
  }
  return [...byKey.values()];
}

function deriveModuleKeyFromPaths(paths: Array<string | null | undefined>): string {
  for (const value of paths) {
    const normalized = stripKnownSourcePrefix(value || '');
    if (!normalized) continue;
    const segments = normalized
      .split('/')
      .map((segment, index, all) => {
        if (index === all.length - 1) return segment.replace(/\.[^.]+$/u, '');
        return segment;
      })
      .map((segment) => normalizeModuleSegment(segment))
      .filter(Boolean);

    while (segments.length > 1 && isGenericPathStem(segments[segments.length - 1])) {
      segments.pop();
    }

    if (segments.length >= 2) return `${segments[0]}/${segments[1]}`;
    if (segments.length === 1) return segments[0];
  }
  return '';
}

function deriveModuleDescriptor(
  rawName: string,
  candidatePaths: Array<string | null | undefined> = [],
  description: string = '',
): ModuleDescriptor {
  const normalizedName = normalizeModuleKey(rawName);
  const pathDerived = deriveModuleKeyFromPaths(candidatePaths);
  const key = normalizedName.includes('/')
    ? normalizedName
    : (!normalizedName || isGenericModuleName(normalizedName))
      ? (pathDerived || normalizedName)
      : normalizedName;

  return {
    key: key || normalizedName || 'module',
    title: rawName.trim() || key || 'module',
    description: description.trim() || undefined,
  };
}

function normalizeModuleMemoryRecord(record: ModuleMemoryRecord): ModuleMemoryRecord {
  return {
    ...record,
    moduleKey: normalizeModuleKey(record.moduleKey),
  };
}

function loadMemoryIndex(projectRoot: string): ModuleMemoryIndex {
  const path = memoryIndexPath(projectRoot);
  if (!fileExists(path)) {
    return {
      schemaVersion: MEMORY_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      items: [],
    };
  }
  const raw = readJson<any>(path);
  const items = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.modules)
      ? raw.modules
      : [];
  return {
    schemaVersion: raw?.schemaVersion || MEMORY_SCHEMA_VERSION,
    updatedAt: raw?.updatedAt || new Date().toISOString(),
    items,
  };
}

function saveMemoryIndex(projectRoot: string, index: ModuleMemoryIndex): void {
  ensureDir(memoriesDir(projectRoot));
  writeJson(memoryIndexPath(projectRoot), {
    schemaVersion: index.schemaVersion || MEMORY_SCHEMA_VERSION,
    updatedAt: index.updatedAt,
    items: index.items,
  });
}

export function loadModuleMemory(projectRoot: string, moduleKey: string): ModuleMemoryRecord | null {
  const normalized = normalizeModuleKey(moduleKey);
  const path = moduleMemoryPath(projectRoot, normalized);
  if (fileExists(path)) return readJson<ModuleMemoryRecord>(path);
  const legacyPath = legacyModuleMemoryPath(projectRoot, normalized);
  if (fileExists(legacyPath)) return readJson<ModuleMemoryRecord>(legacyPath);
  const viewPath = moduleMemoryViewPath(projectRoot, normalized);
  if (fileExists(viewPath)) return moduleMemoryRecordFromMarkdown(readText(viewPath));
  const legacyViewPath = legacyModuleMemoryViewPath(projectRoot, normalized);
  if (!fileExists(legacyViewPath)) return null;
  return moduleMemoryRecordFromMarkdown(readText(legacyViewPath));
}

function upsertMemoryIndexEntry(projectRoot: string, record: ModuleMemoryRecord): void {
  const index = loadMemoryIndex(projectRoot);
  const entry = memoryIndexEntryFromRecord(record);
  const next = index.items.filter((item) => item.key !== record.moduleKey);
  next.push(entry);
  next.sort((a, b) => a.key.localeCompare(b.key));
  saveMemoryIndex(projectRoot, {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    items: next,
  });
}

function memoryIndexEntryFromRecord(record: ModuleMemoryRecord): ModuleMemoryIndexEntry {
  return {
    key: record.moduleKey,
    title: record.title,
    summary: record.summary,
    keywords: topItems([record.moduleKey, record.title, ...record.keywords], 12),
    paths: filterMeaningfulPaths([...record.entryFiles, ...record.relatedPaths], 12),
    tickets: topItems(
      [...(record.tickets || [])]
        .map((ticket) => ticket.ticket || ticket.branch || '')
        .filter(Boolean),
      8,
    ),
    updatedAt: record.updatedAt,
  };
}

function mergeTicketReferences(
  existing: ModuleMemoryReference[],
  incoming: ModuleMemoryReference[],
): ModuleMemoryReference[] {
  const byKey = new Map<string, ModuleMemoryReference>();
  for (const ticket of [...existing, ...incoming]) {
    const summary = ticket.summary.trim();
    if (!summary) continue;
    const key = `${ticket.ticket || ''}|${ticket.branch || ''}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, {
        ticket: ticket.ticket,
        branch: ticket.branch,
        summary,
        updatedAt: ticket.updatedAt,
      });
      continue;
    }
    const useIncoming = latestIso(current.updatedAt, ticket.updatedAt) === ticket.updatedAt;
    byKey.set(key, {
      ticket: current.ticket || ticket.ticket,
      branch: current.branch || ticket.branch,
      summary: useIncoming ? summary : current.summary,
      updatedAt: latestIso(current.updatedAt, ticket.updatedAt),
    });
  }
  return [...byKey.values()].sort((a, b) =>
    `${b.updatedAt || ''}`.localeCompare(a.updatedAt || '') || `${a.ticket || a.branch || ''}`.localeCompare(`${b.ticket || b.branch || ''}`),
  );
}

function mergeChangeEntries(
  existing: ModuleChangeEntry[],
  incoming: ModuleChangeEntry[],
): ModuleChangeEntry[] {
  const byKey = new Map<string, ModuleChangeEntry>();
  for (const change of [...existing, ...incoming]) {
    const summary = change.summary.trim();
    if (!summary) continue;
    const key = change.ticket || change.branch
      ? `${change.ticket || ''}|${change.branch || ''}`
      : `${change.title || ''}|${summary}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, {
        ticket: change.ticket,
        branch: change.branch,
        title: change.title,
        summary,
        updatedAt: change.updatedAt,
      });
      continue;
    }
    const useIncoming = latestIso(current.updatedAt, change.updatedAt) === change.updatedAt;
    byKey.set(key, {
      ticket: current.ticket || change.ticket,
      branch: current.branch || change.branch,
      title: useIncoming ? (change.title || current.title) : (current.title || change.title),
      summary: useIncoming ? summary : current.summary,
      updatedAt: latestIso(current.updatedAt, change.updatedAt),
    });
  }
  return [...byKey.values()]
    .sort((a, b) => `${b.updatedAt}`.localeCompare(`${a.updatedAt}`))
    .slice(0, 20);
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
    tickets: topItems([...(existing.tickets || []), ...(next.tickets || [])], 8),
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
    schemaVersion: MEMORY_SCHEMA_VERSION,
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
    changes: [],
    updatedAt: raw.match(/^- Updated At:\s+(.+)$/m)?.[1]?.trim() || new Date().toISOString(),
  };
}

function rebuildMemoryIndexFromDisk(projectRoot: string): ModuleMemoryIndex {
  ensureDir(moduleMemoriesDir(projectRoot));
  migrateLegacyNestedModuleMemoryLayout(projectRoot);
  const byKey = new Map<string, ModuleMemoryIndexEntry>();
  const expectedMarkdownViews = new Set<string>();

  for (const file of walkJsonFiles(moduleMemoriesDir(projectRoot))) {
    if (basename(file) === 'index.json') continue;
    const original = readJson<ModuleMemoryRecord>(file);
    const record = normalizeModuleMemoryRecord(original);
    if (record.moduleKey !== original.moduleKey) {
      saveModuleMemory(projectRoot, record);
      rmSync(file, { force: true });
    }
    const entry = memoryIndexEntryFromRecord(record);
    byKey.set(record.moduleKey, mergeMemoryIndexEntry(byKey.get(record.moduleKey), entry));
    expectedMarkdownViews.add(moduleMemoryViewPath(projectRoot, record.moduleKey));
  }

  for (const file of walkMarkdownFiles(moduleMemoriesDir(projectRoot))) {
    const record = moduleMemoryRecordFromMarkdown(readText(file));
    if (!record) continue;
    const normalized = normalizeModuleMemoryRecord(record);
    if (normalized.moduleKey !== record.moduleKey) {
      const targetViewPath = moduleMemoryViewPath(projectRoot, normalized.moduleKey);
      ensureDir(dirname(targetViewPath));
      if (!fileExists(targetViewPath)) {
        writeText(targetViewPath, renderModuleMemoryMarkdown(normalized));
      }
      rmSync(file, { force: true });
    }
    const entry = memoryIndexEntryFromRecord(normalized);
    byKey.set(normalized.moduleKey, mergeMemoryIndexEntry(byKey.get(normalized.moduleKey), entry));
    expectedMarkdownViews.add(moduleMemoryViewPath(projectRoot, normalized.moduleKey));
  }

  for (const file of walkMarkdownFiles(moduleMemoriesDir(projectRoot))) {
    if (!expectedMarkdownViews.has(file)) {
      rmSync(file, { force: true });
    }
  }

  const index = {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    items: [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
  saveMemoryIndex(projectRoot, index);
  return index;
}

function saveModuleMemory(projectRoot: string, record: ModuleMemoryRecord): void {
  const path = moduleMemoryPath(projectRoot, record.moduleKey);
  ensureDir(dirname(path));
  writeJson(path, {
    schemaVersion: record.schemaVersion || MEMORY_SCHEMA_VERSION,
    ...record,
  });
  upsertMemoryIndexEntry(projectRoot, record);
}

export function loadRunContext(projectRoot: string, branchName: string): RunContextRecord | null {
  const path = runContextPath(projectRoot, branchName);
  if (!fileExists(path)) return null;
  return readJson<RunContextRecord>(path);
}

function saveRunContext(projectRoot: string, branchName: string, record: RunContextRecord): void {
  ensureDir(branchDir(projectRoot, branchName));
  writeJson(runContextPath(projectRoot, branchName), record);
}

function renderModuleMemoryMarkdown(record: ModuleMemoryRecord): string {
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
    '## Changes',
    '',
    ...((record.changes || []).length > 0
      ? (record.changes || []).map((change) => `- ${[change.ticket || change.branch, change.title, change.summary].filter(Boolean).join(' | ')}`)
      : ['- None']),
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

function renderRunContextMarkdown(record: RunContextRecord): string {
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

function renderRunMemoryPackMarkdown(
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
  migrateLegacyNestedModuleMemoryLayout(projectRoot);
  let moduleViews = 0;
  for (const file of walkJsonFiles(moduleMemoriesDir(projectRoot))) {
    if (basename(file) === 'index.json') continue;
    const original = readJson<ModuleMemoryRecord>(file);
    const record = normalizeModuleMemoryRecord(original);
    if (record.moduleKey !== original.moduleKey) {
      saveModuleMemory(projectRoot, record);
      rmSync(file, { force: true });
    }
    const viewPath = moduleMemoryViewPath(projectRoot, record.moduleKey);
    ensureDir(dirname(viewPath));
    writeText(viewPath, renderModuleMemoryMarkdown(record));
    moduleViews++;
  }

  rebuildMemoryIndexFromDisk(projectRoot);
  return { moduleViews, contextViews: 0, packViews: 0 };
}

function buildRunContextFromBranch(projectRoot: string, branchName: string): RunContextRecord | null {
  const existing = loadRunContext(projectRoot, branchName);
  const requirement = loadRequirement(projectRoot, branchName);
  const analysis = loadAnalysis(projectRoot, branchName);
  const runs = loadBranchRuns(projectRoot, branchName);

  if (!requirement && !analysis && runs.length === 0) {
    return null;
  }

  const moduleDescriptors = inferModuleDescriptors(requirement, runs);
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
  const derivedPhase = deriveCurrentPhase(runs);
  const derivedModules = moduleDescriptors.map((descriptor) => descriptor.key);
  const derivedKeyFiles = pickKeyFiles(runs);
  const derivedRisks = topItems([...analysisRisks, ...runRisks]);
  const existingModules = existing?.modules || [];
  const fallbackPathModules = inferModuleDescriptorsFromPaths([
    ...derivedKeyFiles,
    ...(existing?.keyFiles || []),
  ]).map((descriptor) => descriptor.key);
  const nextModules = derivedModules.length > 0
    ? derivedModules
    : areAllModulesGeneric(existingModules) && fallbackPathModules.length > 0
      ? fallbackPathModules
      : existingModules;
  const nextTitle = isPlaceholderBranchText(existing?.title, branchName) ? title : (existing?.title || title);
  const nextSummary = requirement?.summary
    || extractSummaryFromAnalysis(analysis)
    || (!isPlaceholderBranchText(existing?.summary, branchName) ? existing!.summary : '')
    || (nextModules.length > 0 ? `涉及模块: ${nextModules.join(', ')}` : title);

  return {
    branch: branchName,
    ticket: extractTicket(requirement?.title || '') || extractTicket(branchName),
    title: nextTitle,
    summary: nextSummary,
    currentPhase: derivedPhase === 'Not Started' && existing?.currentPhase ? existing.currentPhase : derivedPhase,
    modules: nextModules,
    completed: completed.length > 0 ? completed : (existing?.completed || []),
    inProgress: inProgress.length > 0 ? inProgress : (existing?.inProgress || []),
    next: next.length > 0 ? next : (existing?.next || []),
    decisions: decisions.length > 0 ? decisions : (existing?.decisions || []),
    constraints: constraints.length > 0 ? constraints : (existing?.constraints || []),
    keyFiles: derivedKeyFiles.length > 0 ? derivedKeyFiles : (existing?.keyFiles || []),
    risks: derivedRisks.length > 0 ? derivedRisks : (existing?.risks || []),
    updatedAt: new Date().toISOString(),
  };
}

function collectRelatedPaths(moduleDescriptor: ModuleDescriptor, branchContext: RunContextRecord, runs: RunData[]): string[] {
  const query = moduleDescriptor.key.toLowerCase();
  const tokens = splitQueryTokens(query);
  const scored = new Map<string, number>();

  for (const path of branchContext.keyFiles) {
    const score = scoreText(query, tokens, path);
    if (score > 0) scored.set(path, score);
  }

  for (const run of runs) {
    for (const task of run.tasks || []) {
      const taskDescriptor = deriveModuleDescriptor(task.stageName || '', (run.files || []).map((file: any) => file.path as string));
      if (taskDescriptor.key !== moduleDescriptor.key) continue;
      for (const file of run.files || []) {
        if (isAidaRuntimePath(file.path) || isNoisePath(file.path) || isGeneratedToolingPath(file.path)) continue;
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
  const existingEntryFiles = filterMeaningfulPaths(existing?.entryFiles || [], 8);
  const existingRelatedPaths = filterMeaningfulPaths(existing?.relatedPaths || [], 12);
  const nextChanges: ModuleChangeEntry[] = ((input.tickets || []).filter((ticket) => ticket.summary.trim().length > 0))
    .map((ticket) => ({
      ticket: ticket.ticket,
      branch: ticket.branch,
      title: input.changeTitle || ticket.ticket || ticket.branch || input.title || existing?.title || moduleKey,
      summary: ticket.summary,
      updatedAt: ticket.updatedAt || new Date().toISOString(),
    }));
  const record: ModuleMemoryRecord = {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    moduleKey,
    title: input.title || existing?.title || moduleKey,
    summary: input.summary || existing?.summary || '',
    keywords: topItems([...(existing?.keywords || []), ...(input.keywords || []), moduleKey, input.title || ''], 16),
    entryFiles: filterMeaningfulPaths([...existingEntryFiles, ...(input.entryFiles || [])], 8),
    relatedPaths: filterMeaningfulPaths([...existingRelatedPaths, ...(input.relatedPaths || [])], 12),
    dataFlow: topItems([...(existing?.dataFlow || []), ...(input.dataFlow || [])]),
    decisions: topItems([...(existing?.decisions || []), ...(input.decisions || [])]),
    constraints: topItems([...(existing?.constraints || []), ...(input.constraints || [])]),
    pitfalls: topItems([...(existing?.pitfalls || []), ...(input.pitfalls || [])]),
    relatedRules: topItems([...(existing?.relatedRules || []), ...(input.relatedRules || [])], 12),
    tickets: mergeTicketReferences(
      existing?.tickets || [],
      (input.tickets || []).filter((ticket) => ticket.summary.trim().length > 0),
    ),
    changes: mergeChangeEntries(existing?.changes || [], nextChanges),
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
  if (index.items.length === 0 && fileExists(moduleMemoriesDir(projectRoot))) {
    index = rebuildMemoryIndexFromDisk(projectRoot);
  }

  return index.items
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

  for (const descriptor of inferModuleDescriptors(req, runs)) {
    const relatedPaths = collectRelatedPaths(descriptor, context, runs);
    modules.push(upsertModuleMemory(projectRoot, {
      moduleKey: descriptor.key,
      title: descriptor.title,
      summary: descriptor.description || context.summary,
      keywords: [descriptor.title, descriptor.key, context.title],
      entryFiles: relatedPaths.slice(0, 5),
      relatedPaths,
      decisions: context.decisions,
      constraints: context.constraints,
      pitfalls: context.risks,
      changeTitle: context.title,
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
