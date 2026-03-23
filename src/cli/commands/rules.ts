import { configPath } from '../../utils/paths.js';
import { fileExists, readText, writeText } from '../../utils/fs.js';
import { green, red, cyan, yellow, dim } from '../../utils/display.js';
import {
  loadRegistry,
  saveRegistry,
  buildRuleViews,
  findSimilarRules,
  mergeRegistries,
  registryPath,
} from '../../utils/rules.js';
import type { RuleRegistryEntry } from '../../schemas/run-json.js';

function subcommand(): string {
  return process.argv[3] || '';
}

async function rulesBuild(): Promise<void> {
  const projectRoot = process.cwd();
  const count = buildRuleViews(projectRoot);
  const entries = loadRegistry(projectRoot);
  console.log(
    green(`\n  ✓ Rules views rebuilt`) +
    `: ${entries.length} rules → ${count} category files\n`,
  );
}

async function rulesDedupe(): Promise<void> {
  const projectRoot = process.cwd();
  const entries = loadRegistry(projectRoot);

  if (entries.length === 0) {
    console.log(yellow('\n  No rules in registry.\n'));
    return;
  }

  const similar = findSimilarRules(entries);

  if (similar.length === 0) {
    console.log(green('\n  ✓ No potential duplicates found.\n'));
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
    dim('  To resolve: manually edit .aidevos/rules.json,') +
    dim(' then run `aida rules build`.\n'),
  );
}

async function rulesMerge(): Promise<void> {
  const projectRoot = process.cwd();
  const regPath = registryPath(projectRoot);

  if (!fileExists(regPath)) {
    console.log(yellow('\n  No rules.json found.\n'));
    return;
  }

  // Check if the file has git merge conflict markers
  const raw = readText(regPath);
  if (!raw.includes('<<<<<<<') && !raw.includes('>>>>>>>')) {
    console.log(green('\n  ✓ No merge conflicts detected in rules.json.\n'));
    return;
  }

  // Extract both sides from conflict markers
  console.log(yellow('\n  Merge conflict detected in rules.json. Resolving...\n'));

  const oursMatch = raw.match(/<<<<<<< .*?\n([\s\S]*?)=======/);
  const theirsMatch = raw.match(/=======\n([\s\S]*?)>>>>>>> /);

  if (!oursMatch || !theirsMatch) {
    console.log(red('  Could not parse conflict markers. Please resolve manually.\n'));
    return;
  }

  let ours: RuleRegistryEntry[] = [];
  let theirs: RuleRegistryEntry[] = [];

  try {
    ours = JSON.parse(oursMatch[1].trim());
  } catch {
    // Ours might be partial, try to wrap in array
    try { ours = JSON.parse(`[${oursMatch[1].trim()}]`); } catch { /* empty */ }
  }

  try {
    theirs = JSON.parse(theirsMatch[1].trim());
  } catch {
    try { theirs = JSON.parse(`[${theirsMatch[1].trim()}]`); } catch { /* empty */ }
  }

  const { merged, added } = mergeRegistries(ours, theirs);
  saveRegistry(projectRoot, merged);
  buildRuleViews(projectRoot);

  console.log(
    green(`  ✓ Merged successfully`) +
    `: ${merged.length} total rules (${added} new from incoming branch)\n`,
  );
}

async function rulesList(): Promise<void> {
  const projectRoot = process.cwd();
  const entries = loadRegistry(projectRoot);

  if (entries.length === 0) {
    console.log(yellow('\n  No rules in registry.\n'));
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
    case 'list':
    case 'ls':
      return rulesList();
    default:
      console.log(`
  ${cyan('aida rules')} - Manage project rules registry

  Subcommands:
    build     Rebuild .aidevos/rules/*.md views from rules.json
    dedupe    Find potential duplicate or conflicting rules
    merge     Auto-resolve git merge conflicts in rules.json
    list      List all rules grouped by category

  The source of truth is .aidevos/rules.json (committed to git).
  The .aidevos/rules/*.md files are auto-generated views (gitignored).
`);
  }
}
