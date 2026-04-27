import { configPath } from '../../utils/paths.js';
import { fileExists, readText, extractConflictSections, parseConflictJsonArray, writeText } from '../../utils/fs.js';
import { green, red, cyan, yellow, dim } from '../../utils/display.js';
import {
  addRule,
  bootstrapRuleRegistry,
  dedupeExactRules,
  loadRegistry,
  saveRegistry,
  findSimilarRules,
  mergeRegistries,
  registryPath,
} from '../../utils/rules.js';
import { buildProjectArtifacts } from '../../utils/ai-build.js';
import { updateGuide, updateGuideReferences } from '../../utils/guide.js';
import { RULE_CATEGORIES, type RuleRegistryEntry } from '../../schemas/run-json.js';

function subcommand(): string {
  return process.argv[3] || '';
}

function commandArgs(): string[] {
  return process.argv.slice(4);
}

function hasFlag(flag: string): boolean {
  return commandArgs().includes(flag);
}

function parseCategory(args: string[]): string {
  const idx = args.findIndex((arg) => arg === '--category' || arg === '-c');
  if (idx === -1) return 'general';
  const value = args[idx + 1];
  if (!value) return 'general';
  return value;
}

function parseContent(args: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--category' || arg === '-c') {
      i++;
      continue;
    }
    if (arg.startsWith('--category=')) continue;
    parts.push(arg);
  }
  return parts.join(' ').trim();
}

async function rulesBuild(): Promise<void> {
  const projectRoot = process.cwd();
  const result = buildProjectArtifacts(projectRoot);
  const entries = loadRegistry(projectRoot);
  updateGuide(projectRoot);
  updateGuideReferences(projectRoot);
  console.log(
    green(`\n  ✓ Rules rebuilt`) +
    `: ${entries.length} rules → ${result.ruleFiles} generated tool rule files\n`,
  );
}

async function rulesDedupe(): Promise<void> {
  const projectRoot = process.cwd();
  const existing = bootstrapRuleRegistry(projectRoot);

  if (existing.length === 0) {
    console.log(yellow('\n  No rules in registry.\n'));
    return;
  }

  const { entries, removed } = dedupeExactRules(existing);
  if (removed.length > 0) {
    saveRegistry(projectRoot, entries);
    buildProjectArtifacts(projectRoot);
    console.log(green(`\n  ✓ Removed ${removed.length} exact duplicate(s):\n`));
    for (const entry of removed) {
      console.log(`  - ${cyan(entry.id)} ${entry.content.substring(0, 80)}`);
    }
    console.log('');
  }

  const similar = findSimilarRules(entries);

  if (removed.length === 0 && similar.length === 0) {
    console.log(green('\n  ✓ No potential duplicates found.\n'));
    return;
  }

  if (similar.length === 0) {
    console.log(green('  ✓ No near-duplicate rules remain.\n'));
    return;
  }

  console.log(yellow(`\n  Found ${similar.length} potential duplicate(s):\n`));

  for (const { a, b, similarity } of similar) {
    const pct = Math.round(similarity * 100);
    console.log(`  ${cyan(a.id)} ↔ ${cyan(b.id)} (${pct}% similar)`);
    console.log(`    A: ${a.content.substring(0, 80)}`);
    console.log(`    B: ${b.content.substring(0, 80)}`);
    console.log('');
  }

  console.log(
    dim('  To resolve: manually edit .aida/rules.json,') +
    dim(' then run `aida rules build`.\n'),
  );
}

export async function mergeRuleRegistryFile(filePath: string): Promise<{ status: 'merged' | 'no-conflict' | 'missing' | 'error'; added?: number; total?: number }> {
  if (!fileExists(filePath)) {
    return { status: 'missing' };
  }

  const raw = readText(filePath);
  if (!raw.includes('<<<<<<<') && !raw.includes('>>>>>>>')) {
    return { status: 'no-conflict' };
  }

  const sections = extractConflictSections(raw);
  if (!sections) {
    return { status: 'error' };
  }

  const ours = parseConflictJsonArray<RuleRegistryEntry>(sections.ours);
  const theirs = parseConflictJsonArray<RuleRegistryEntry>(sections.theirs);
  if (ours.length === 0 && theirs.length === 0) {
    return { status: 'error' };
  }

  const { merged, added } = mergeRegistries(ours, theirs);
  const sorted = merged.sort((a, b) => a.id.localeCompare(b.id));
  writeText(filePath, `${JSON.stringify(sorted, null, 2)}\n`);

  return { status: 'merged', added, total: sorted.length };
}

export async function mergeRulesRegistry(projectRoot: string): Promise<{ status: 'merged' | 'no-conflict' | 'missing' | 'error'; added?: number; total?: number }> {
  return mergeRuleRegistryFile(registryPath(projectRoot));
}

async function rulesMerge(): Promise<void> {
  const projectRoot = process.cwd();
  const regPath = registryPath(projectRoot);
  if (!fileExists(regPath)) {
    console.log(yellow('\n  No rules.json found.\n'));
    return;
  }
  const raw = readText(regPath);
  if (!raw.includes('<<<<<<<') && !raw.includes('>>>>>>>')) {
    console.log(green('\n  ✓ No merge conflicts detected in rules.json.\n'));
    return;
  }
  console.log(yellow('\n  Merge conflict detected in rules.json. Resolving...\n'));
  const result = await mergeRulesRegistry(projectRoot);
  if (result.status === 'error') {
    console.log(red('  Could not parse conflict markers. Please resolve manually.\n'));
    return;
  }
  if (result.status === 'merged') {
    buildProjectArtifacts(projectRoot);
    updateGuideReferences(projectRoot);
    console.log(
      green('  ✓ Merged successfully') +
      `: ${result.total} total rules (${result.added} new from incoming branch)\n`,
    );
  }
}


async function rulesList(): Promise<void> {
  const projectRoot = process.cwd();
  const entries = bootstrapRuleRegistry(projectRoot);

  if (entries.length === 0) {
    if (hasFlag('--json')) {
      console.log('[]');
      return;
    }
    console.log(yellow('\n  No rules in registry.\n'));
    return;
  }

  if (hasFlag('--json')) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  console.log(`\n  ${entries.length} rules in registry:\n`);

  // Group by category
  const groups: Record<string, RuleRegistryEntry[]> = {};
  for (const e of entries) {
    const cat = e.category || 'general';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(e);
  }

  for (const [cat, rules] of Object.entries(groups)) {
    console.log(`  ${cyan(cat)} (${rules.length})`);
    for (const r of rules) {
      const status = r.status !== 'active' ? ` [${r.status}]` : '';
      console.log(`    ${dim(r.id)}${status} ${r.content.substring(0, 70)}`);
    }
    console.log('');
  }
}

async function rulesAdd(): Promise<void> {
  const projectRoot = process.cwd();
  const args = commandArgs();
  bootstrapRuleRegistry(projectRoot);
  const content = parseContent(args);
  const categoryFlag = args.find((arg) => arg.startsWith('--category='));
  const category = categoryFlag ? categoryFlag.split('=').slice(1).join('=').trim() : parseCategory(args);

  if (!content) {
    console.log(red('\n  Usage: aida rules add "rule content" [--category <category>]\n'));
    return;
  }

  if (!RULE_CATEGORIES.includes(category as typeof RULE_CATEGORIES[number])) {
    console.log(red(`\n  Invalid category: ${category}\n`));
    console.log(dim(`  Allowed: ${RULE_CATEGORIES.join(', ')}\n`));
    return;
  }

  const { entry, isDuplicate } = addRule(projectRoot, {
    content,
    category,
    branch: 'manual',
    deviation: null,
    author: 'manual',
    status: 'active',
  });

  buildProjectArtifacts(projectRoot);

  if (isDuplicate) {
    console.log(yellow(`\n  Rule already exists: ${entry.id}\n`));
    return;
  }

  console.log(green(`\n  ✓ Rule added`) + `: ${entry.id} (${entry.category})\n`);
}

async function rulesDelete(): Promise<void> {
  const projectRoot = process.cwd();
  const ruleId = commandArgs()[0];

  if (!ruleId) {
    console.log(red('\n  Usage: aida rules delete <RULE-ID>\n'));
    return;
  }

  const entries = loadRegistry(projectRoot);
  if (entries.length === 0) {
    bootstrapRuleRegistry(projectRoot);
  }
  const current = loadRegistry(projectRoot);
  const entry = current.find((item) => item.id === ruleId);

  if (!entry) {
    console.log(red(`\n  Rule not found: ${ruleId}\n`));
    return;
  }

  if (entry.status === 'deprecated') {
    console.log(yellow(`\n  Rule already deprecated: ${ruleId}\n`));
    return;
  }

  entry.status = 'deprecated';
  saveRegistry(projectRoot, current);
  buildProjectArtifacts(projectRoot);

  console.log(green(`\n  ✓ Rule deprecated`) + `: ${ruleId}`);
  console.log(dim('  Re-run `aida rules list` to verify status, or `aida build` to rebuild all targets.\n'));
}

export async function rules(): Promise<void> {
  const projectRoot = process.cwd();

  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDA not initialized. Run `npx aida init` first.\n'));
    return;
  }

  const sub = subcommand();

  switch (sub) {
    case 'build':
      return rulesBuild();
    case 'dedupe':
      return rulesDedupe();
    case 'merge':
      return rulesMerge();
    case 'add':
      return rulesAdd();
    case 'delete':
    case 'rm':
    case 'deprecate':
      return rulesDelete();
    case 'list':
    case 'ls':
      return rulesList();
    default:
      console.log(`
  ${cyan('aida rules')} - Manage project rules registry

  Subcommands:
    add       Add one rule and auto-build AI tool artifacts
    build     Rebuild AI tool rule files from rules.json
    delete    Deprecate one rule by ID
    dedupe    Find potential duplicate or conflicting rules
    merge     Auto-resolve git merge conflicts in rules.json
    list      List all rules grouped by category (--json supported)

  The source of truth is .aida/rules.json (committed to git).
  aida build distributes generated rule files into each configured AI tool directory.
`);
  }
}
