import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileExists, readJson, writeJson, writeText, ensureDir, readText } from './fs.js';
import { aidaDir } from './paths.js';
import type { RuleRegistryEntry } from '../schemas/run-json.js';
import { RULE_CATEGORIES } from '../schemas/run-json.js';

// ─── Paths ────────────────────────────────────────────────

export function registryPath(projectRoot: string): string {
  return resolve(aidaDir(projectRoot), 'rules.json');
}

export function rulesViewDir(projectRoot: string): string {
  return resolve(aidaDir(projectRoot), 'rules');
}

// ─── Fingerprint ──────────────────────────────────────────

function normalize(content: string): string {
  return content
    .toLowerCase()
    .replace(/[\s\n\r\t]+/g, ' ')
    .replace(/[，。！？、；：""''（）《》【】\.\,\!\?\;\:\"\'\(\)\[\]\{\}]/g, '')
    .trim();
}

export function fingerprint(content: string): string {
  return createHash('sha256').update(normalize(content)).digest('hex').substring(0, 12);
}

// ─── Registry CRUD ────────────────────────────────────────

export function loadRegistry(projectRoot: string): RuleRegistryEntry[] {
  const p = registryPath(projectRoot);
  if (!fileExists(p)) return [];
  try {
    const data = readJson<RuleRegistryEntry[]>(p);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function activeRules(entries: RuleRegistryEntry[]): RuleRegistryEntry[] {
  return entries.filter((entry) => entry.status !== 'deprecated');
}

export function groupActiveRulesByCategory(entries: RuleRegistryEntry[]): Record<string, RuleRegistryEntry[]> {
  const groups: Record<string, RuleRegistryEntry[]> = {};
  for (const entry of activeRules(entries)) {
    const category = entry.category || 'general';
    if (!groups[category]) groups[category] = [];
    groups[category].push(entry);
  }
  return groups;
}

export function renderRuleMarkdownFiles(entries: RuleRegistryEntry[]): Map<string, string> {
  const groups = groupActiveRulesByCategory(entries);
  const files = new Map<string, string>();

  for (const [cat, rules] of Object.entries(groups)) {
    const lines: string[] = [];
    lines.push(`<!-- AUTO-GENERATED from rules.json - DO NOT EDIT -->`);
    lines.push(`# ${categoryTitle(cat)} Rules`);
    lines.push('');

    for (const rule of rules) {
      const statusTag = rule.status === 'pending' ? ' [PENDING]' :
        rule.status === 'conflict' ? ' [CONFLICT]' : '';
      lines.push(`- [${rule.id}]${statusTag} ${rule.content}`);
    }
    lines.push('');
    files.set(`${cat}.md`, lines.join('\n'));
  }

  if (Object.keys(groups).length > 0) {
    const allLines: string[] = [];
    allLines.push(`<!-- AUTO-GENERATED from rules.json - DO NOT EDIT -->`);
    allLines.push(`# All Project Rules`);
    allLines.push('');

    for (const [cat, rules] of Object.entries(groups)) {
      allLines.push(`## ${categoryTitle(cat)}`);
      allLines.push('');
      for (const rule of rules) {
        const statusTag = rule.status === 'pending' ? ' [PENDING]' :
          rule.status === 'conflict' ? ' [CONFLICT]' : '';
        allLines.push(`- [${rule.id}]${statusTag} ${rule.content}`);
      }
      allLines.push('');
    }
    files.set('_all.md', allLines.join('\n'));
  }

  return files;
}

export function saveRegistry(projectRoot: string, entries: RuleRegistryEntry[]): void {
  writeJson(registryPath(projectRoot), entries);
}

function categoryFromTitle(title: string): RuleRegistryEntry['category'] {
  const normalized = title.trim().toLowerCase();
  const mapping: Record<string, RuleRegistryEntry['category']> = {
    component: 'component',
    api: 'api',
    style: 'style',
    i18n: 'i18n',
    architecture: 'architecture',
    'state management': 'state-management',
    routing: 'routing',
    testing: 'testing',
    process: 'process',
    general: 'general',
  };
  return mapping[normalized] || 'general';
}

function parseRuleLines(
  raw: string,
  categoryHint?: string,
): Array<Pick<RuleRegistryEntry, 'id' | 'category' | 'content' | 'status'>> {
  const lines = raw.split('\n');
  const parsed: Array<Pick<RuleRegistryEntry, 'id' | 'category' | 'content' | 'status'>> = [];
  let currentCategory = categoryHint || 'general';

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+?)\s*$/);
    if (headingMatch) {
      currentCategory = categoryFromTitle(headingMatch[1].replace(/\s+Rules$/, ''));
      continue;
    }

    const ruleMatch = line.match(/^- \[(RULE-\d+)\](?: \[([A-Z]+)\])?\s+(.+)$/);
    if (ruleMatch) {
      const status = ruleMatch[2]?.toLowerCase() === 'pending'
        ? 'pending'
        : ruleMatch[2]?.toLowerCase() === 'conflict'
          ? 'conflict'
          : 'active';
      parsed.push({
        id: ruleMatch[1],
        category: currentCategory as RuleRegistryEntry['category'],
        content: ruleMatch[3].trim(),
        status,
      });
      continue;
    }

    const fallbackMatch = line.match(/^- (.+)$/);
    if (fallbackMatch && !line.startsWith('<!--')) {
      parsed.push({
        id: '',
        category: currentCategory as RuleRegistryEntry['category'],
        content: fallbackMatch[1].trim(),
        status: 'active',
      });
    }
  }

  return parsed.filter((entry) => entry.content.length > 0);
}

export function importRulesFromViews(projectRoot: string): { entries: RuleRegistryEntry[]; imported: number } {
  const existing = loadRegistry(projectRoot);
  const byFingerprint = new Map(existing.map((entry) => [entry.fingerprint, entry]));
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  const viewDir = rulesViewDir(projectRoot);
  const now = new Date().toISOString();
  const parsed: Array<Pick<RuleRegistryEntry, 'id' | 'category' | 'content' | 'status'>> = [];

  const categoryFiles = ['component', 'api', 'style', 'i18n', 'architecture', 'state-management', 'routing', 'testing', 'process', 'general']
    .map((category) => ({ category, path: resolve(viewDir, `${category}.md`) }))
    .filter((entry) => fileExists(entry.path));

  if (categoryFiles.length > 0) {
    for (const file of categoryFiles) {
      parsed.push(...parseRuleLines(readText(file.path), file.category));
    }
  } else {
    const allPath = resolve(viewDir, '_all.md');
    if (fileExists(allPath)) {
      parsed.push(...parseRuleLines(readText(allPath)));
    }
  }

  let imported = 0;
  const merged = [...existing];

  for (const item of parsed) {
    const fp = fingerprint(item.content);
    const existingByFingerprint = byFingerprint.get(fp);
    if (existingByFingerprint) continue;

    const existingById = item.id ? byId.get(item.id) : undefined;
    if (existingById) {
      existingById.category = item.category;
      existingById.content = item.content;
      existingById.fingerprint = fp;
      existingById.status = item.status;
      imported++;
      byFingerprint.set(fp, existingById);
      continue;
    }

    const entry: RuleRegistryEntry = {
      id: item.id || nextRuleId(merged),
      category: item.category,
      content: item.content,
      fingerprint: fp,
      source: {
        branch: 'imported',
        deviation: null,
        author: 'import',
      },
      createdAt: now,
      status: item.status,
    };
    merged.push(entry);
    byFingerprint.set(fp, entry);
    byId.set(entry.id, entry);
    imported++;
  }

  if (imported > 0 || existing.length === 0) {
    saveRegistry(projectRoot, merged);
  }

  return { entries: merged, imported };
}

export function bootstrapRuleRegistry(projectRoot: string): RuleRegistryEntry[] {
  const existing = loadRegistry(projectRoot);
  if (existing.length > 0) return existing;
  return importRulesFromViews(projectRoot).entries;
}

export function nextRuleId(entries: RuleRegistryEntry[]): string {
  const nums = entries
    .map((e) => {
      const m = e.id.match(/^RULE-(\d+)$/);
      return m ? parseInt(m[1]) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `RULE-${String(max + 1).padStart(3, '0')}`;
}

/**
 * Add a rule to the registry. Returns the entry if added, or the existing entry if duplicate.
 */
export function addRule(
  projectRoot: string,
  opts: {
    content: string;
    category: string;
    branch: string;
    deviation: string | null;
    author: string;
    status?: RuleRegistryEntry['status'];
  },
): { entry: RuleRegistryEntry; isDuplicate: boolean } {
  const entries = loadRegistry(projectRoot);
  const fp = fingerprint(opts.content);

  // Check for exact duplicate by fingerprint
  const existing = entries.find((e) => e.fingerprint === fp);
  if (existing) {
    return { entry: existing, isDuplicate: true };
  }

  const entry: RuleRegistryEntry = {
    id: nextRuleId(entries),
    category: opts.category || 'general',
    content: opts.content,
    fingerprint: fp,
    source: {
      branch: opts.branch,
      deviation: opts.deviation,
      author: opts.author,
    },
    createdAt: new Date().toISOString(),
    status: opts.status || 'active',
  };

  entries.push(entry);
  saveRegistry(projectRoot, entries);
  return { entry, isDuplicate: false };
}

// ─── Build Views ──────────────────────────────────────────

/**
 * Legacy compatibility: rebuild .aida/rules/*.md from rules.json.
 * Returns the number of files written.
 */
export function buildRuleViews(projectRoot: string): number {
  const entries = bootstrapRuleRegistry(projectRoot);
  const viewDir = rulesViewDir(projectRoot);
  ensureDir(viewDir);
  const files = renderRuleMarkdownFiles(entries);
  for (const [name, content] of files) {
    writeText(resolve(viewDir, name), content);
  }
  return files.size;
}

function categoryTitle(cat: string): string {
  const titles: Record<string, string> = {
    component: 'Component',
    api: 'API',
    style: 'Style',
    i18n: 'i18n',
    architecture: 'Architecture',
    'state-management': 'State Management',
    routing: 'Routing',
    testing: 'Testing',
    process: 'Process',
    general: 'General',
  };
  return titles[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ─── Merge ────────────────────────────────────────────────

/**
 * Merge two registries (union by fingerprint). Used after git merge conflicts.
 * Returns merged entries and count of new entries added.
 */
export function mergeRegistries(
  base: RuleRegistryEntry[],
  incoming: RuleRegistryEntry[],
): { merged: RuleRegistryEntry[]; added: number } {
  const fpSet = new Set(base.map((e) => e.fingerprint));
  const merged = [...base];
  let added = 0;

  for (const entry of incoming) {
    if (!fpSet.has(entry.fingerprint)) {
      // Reassign ID to avoid collisions
      entry.id = nextRuleId(merged);
      merged.push(entry);
      fpSet.add(entry.fingerprint);
      added++;
    }
  }

  return { merged, added };
}

// ─── Dedupe ───────────────────────────────────────────────

/**
 * Find potential duplicates by checking keyword overlap.
 * Returns pairs of entries that might be duplicates or conflicts.
 */
export function findSimilarRules(
  entries: RuleRegistryEntry[],
): { a: RuleRegistryEntry; b: RuleRegistryEntry; similarity: number }[] {
  const results: { a: RuleRegistryEntry; b: RuleRegistryEntry; similarity: number }[] = [];

  function tokenize(s: string): Set<string> {
    return new Set(
      normalize(s)
        .split(' ')
        .filter((w) => w.length > 1),
    );
  }

  function jaccard(setA: Set<string>, setB: Set<string>): number {
    let intersection = 0;
    for (const w of setA) {
      if (setB.has(w)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      // Skip exact fingerprint matches (already deduplicated)
      if (entries[i].fingerprint === entries[j].fingerprint) continue;
      // Only compare same category
      if (entries[i].category !== entries[j].category) continue;

      const tokensA = tokenize(entries[i].content);
      const tokensB = tokenize(entries[j].content);
      const sim = jaccard(tokensA, tokensB);

      if (sim >= 0.4) {
        results.push({ a: entries[i], b: entries[j], similarity: sim });
      }
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity);
}
