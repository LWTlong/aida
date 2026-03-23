import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileExists, readJson, writeJson, writeText, ensureDir } from './fs.js';
import { aidevosDir } from './paths.js';
import type { RuleRegistryEntry } from '../schemas/run-json.js';
import { RULE_CATEGORIES } from '../schemas/run-json.js';

// ─── Paths ────────────────────────────────────────────────

export function registryPath(projectRoot: string): string {
  return resolve(aidevosDir(projectRoot), 'rules.json');
}

export function rulesViewDir(projectRoot: string): string {
  return resolve(aidevosDir(projectRoot), 'rules');
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

export function saveRegistry(projectRoot: string, entries: RuleRegistryEntry[]): void {
  writeJson(registryPath(projectRoot), entries);
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
 * Rebuild all .aidevos/rules/*.md from rules.json.
 * Returns the number of categories written.
 */
export function buildRuleViews(projectRoot: string): number {
  const entries = loadRegistry(projectRoot);
  const viewDir = rulesViewDir(projectRoot);
  ensureDir(viewDir);

  // Group by category
  const groups: Record<string, RuleRegistryEntry[]> = {};
  for (const e of entries) {
    if (e.status === 'deprecated') continue;
    const cat = e.category || 'general';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(e);
  }

  // Always include iron-rules if they exist in registry
  let written = 0;

  for (const [cat, rules] of Object.entries(groups)) {
    const lines: string[] = [];
    lines.push(`<!-- AUTO-GENERATED from rules.json - DO NOT EDIT -->`);
    lines.push(`# ${categoryTitle(cat)} Rules`);
    lines.push('');

    for (const r of rules) {
      const statusTag = r.status === 'pending' ? ' [PENDING]' :
                         r.status === 'conflict' ? ' [CONFLICT]' : '';
      lines.push(`- [${r.id}]${statusTag} ${r.content}`);
    }
    lines.push('');

    writeText(resolve(viewDir, `${cat}.md`), lines.join('\n'));
    written++;
  }

  // Write a combined all-rules.md for easy AI consumption
  const activeCount = Object.keys(groups).length;
  if (activeCount > 0) {
    const allLines: string[] = [];
    allLines.push(`<!-- AUTO-GENERATED from rules.json - DO NOT EDIT -->`);
    allLines.push(`# All Project Rules`);
    allLines.push('');

    for (const [cat, rules] of Object.entries(groups)) {
      allLines.push(`## ${categoryTitle(cat)}`);
      allLines.push('');
      for (const r of rules) {
        const statusTag = r.status === 'pending' ? ' [PENDING]' :
                           r.status === 'conflict' ? ' [CONFLICT]' : '';
        allLines.push(`- [${r.id}]${statusTag} ${r.content}`);
      }
      allLines.push('');
    }

    writeText(resolve(viewDir, '_all.md'), allLines.join('\n'));
    written++;
  }

  return written;
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
