import { cyan, green, red, yellow } from '../../utils/display.js';
import { getBranchName } from '../../utils/git.js';
import { buildMemoryViews, loadModuleMemory, loadRunContext, loadRunMemoryPack, migrateLegacyMemories, rebuildCurrentBranchMemory, searchModuleMemories, updateRunContext, upsertModuleMemory } from '../../utils/memory.js';
import { fileExists, readText } from '../../utils/fs.js';
import { moduleMemoryViewPath, runContextViewPath, runMemoryPackViewPath } from '../../utils/paths.js';

function commandArg(index: number): string {
  return (process.argv[index] || '').trim();
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const current = args[i];
    if (!current.startsWith('--')) continue;
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      flags[current.slice(2)] = next;
      i++;
    } else {
      flags[current.slice(2)] = 'true';
    }
  }
  return flags;
}

function printUsage(): void {
  console.log(`
  aida memory rebuild [branch]           Rebuild current branch context + module memories from run/requirement data
  aida memory migrate-legacy             Migrate contexts/memories from existing .aida/.aidevos run data
  aida memory build                      Render markdown views from memory JSON source
  aida memory search <query>             Search module memory index
  aida memory show <moduleKey>           Show a module memory markdown view
  aida memory context [branch]           Show branch context markdown view
  aida memory pack [branch]              Show aggregated runtime memory pack
  aida memory upsert <moduleKey> [--title ... --summary ... --keywords a,b]
  aida memory context-update [branch] [--summary ... --phase ... --modules a,b]
`);
}

export async function memory(): Promise<void> {
  const projectRoot = process.cwd();
  const action = commandArg(3);

  switch (action) {
    case 'rebuild': {
      const branchName = commandArg(4) || getBranchName();
      const result = rebuildCurrentBranchMemory(projectRoot, branchName);
      if (!result.context) {
        console.log(yellow(`\n  No branch data found for ${branchName}\n`));
        return;
      }
      console.log(green('\n  ✓ Rebuilt memory') + ` for ${branchName}`);
      console.log(`    Context: ${runContextViewPath(projectRoot, branchName)}`);
      console.log(`    Modules: ${result.modules.length}`);
      return;
    }
    case 'migrate-legacy': {
      const result = migrateLegacyMemories(projectRoot);
      console.log(green('\n  ✓ Migrated legacy memory data'));
      console.log(`    Branches: ${result.branches}`);
      console.log(`    Contexts: ${result.contextsWritten}`);
      console.log(`    Module memories: ${result.moduleMemoriesWritten}`);
      console.log(`    Modules touched: ${result.modulesTouched.join(', ') || '-'}`);
      return;
    }
    case 'build': {
      const result = buildMemoryViews(projectRoot);
      console.log(green('\n  ✓ Built memory views'));
      console.log(`    Module views: ${result.moduleViews}`);
      console.log(`    Context views: ${result.contextViews}`);
      console.log(`    Pack views: ${result.packViews}`);
      return;
    }
    case 'search': {
      const query = process.argv.slice(4).join(' ').trim();
      if (!query) {
        console.log(red('\n  Missing query: aida memory search <query>\n'));
        return;
      }
      const hits = searchModuleMemories(projectRoot, query);
      if (hits.length === 0) {
        console.log(yellow(`\n  No module memory matched "${query}"\n`));
        return;
      }
      console.log(cyan(`\n  Module memory matches for "${query}"\n`));
      for (const hit of hits) {
        console.log(`  - ${hit.key} | ${hit.title} | ${hit.summary}`);
      }
      console.log('');
      return;
    }
    case 'show': {
      const moduleKey = commandArg(4);
      if (!moduleKey) {
        console.log(red('\n  Missing moduleKey: aida memory show <moduleKey>\n'));
        return;
      }
      const record = loadModuleMemory(projectRoot, moduleKey);
      if (!record) {
        console.log(yellow(`\n  Module memory not found: ${moduleKey}\n`));
        return;
      }
      const viewPath = moduleMemoryViewPath(projectRoot, record.moduleKey);
      const output = fileExists(viewPath) ? readText(viewPath) : JSON.stringify(record, null, 2);
      process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
      return;
    }
    case 'context': {
      const branchName = commandArg(4) || getBranchName();
      const record = loadRunContext(projectRoot, branchName);
      if (!record) {
        console.log(yellow(`\n  Context not found for branch: ${branchName}\n`));
        return;
      }
      const viewPath = runContextViewPath(projectRoot, branchName);
      const output = fileExists(viewPath) ? readText(viewPath) : JSON.stringify(record, null, 2);
      process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
      return;
    }
    case 'pack': {
      const branchName = commandArg(4) || getBranchName();
      const pack = loadRunMemoryPack(projectRoot, branchName);
      if (!pack) {
        console.log(yellow(`\n  Memory pack not found for branch: ${branchName}\n`));
        return;
      }
      const viewPath = runMemoryPackViewPath(projectRoot, branchName);
      const output = fileExists(viewPath)
        ? readText(viewPath)
        : JSON.stringify(pack, null, 2);
      process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
      return;
    }
    case 'upsert': {
      const moduleKey = commandArg(4);
      if (!moduleKey) {
        console.log(red('\n  Missing moduleKey: aida memory upsert <moduleKey> [--title ...]\n'));
        return;
      }
      const flags = parseFlags(process.argv.slice(5));
      const record = upsertModuleMemory(projectRoot, {
        moduleKey,
        title: flags.title,
        summary: flags.summary,
        keywords: parseList(flags.keywords),
        entryFiles: parseList(flags['entry-files']),
        relatedPaths: parseList(flags.paths),
        dataFlow: parseList(flags['data-flow']),
        decisions: parseList(flags.decisions),
        constraints: parseList(flags.constraints),
        pitfalls: parseList(flags.pitfalls),
        relatedRules: parseList(flags.rules),
        tickets: [{
          ticket: flags.ticket,
          branch: flags.branch || getBranchName(),
          summary: flags['ticket-summary'] || flags.summary || '',
          updatedAt: new Date().toISOString(),
        }],
      });
      buildMemoryViews(projectRoot);
      console.log(green('\n  ✓ Module memory updated') + `: ${record.moduleKey}\n`);
      return;
    }
    case 'context-update': {
      const maybeBranch = commandArg(4);
      const branchName = maybeBranch && !maybeBranch.startsWith('--') ? maybeBranch : getBranchName();
      const flags = parseFlags(process.argv.slice(maybeBranch && !maybeBranch.startsWith('--') ? 5 : 4));
      const record = updateRunContext(projectRoot, {
        branch: branchName,
        ticket: flags.ticket,
        title: flags.title,
        summary: flags.summary,
        currentPhase: flags.phase,
        modules: parseList(flags.modules),
        completed: parseList(flags.completed),
        inProgress: parseList(flags['in-progress']),
        next: parseList(flags.next),
        decisions: parseList(flags.decisions),
        constraints: parseList(flags.constraints),
        keyFiles: parseList(flags.files),
        risks: parseList(flags.risks),
      });
      buildMemoryViews(projectRoot);
      console.log(green('\n  ✓ Branch context updated') + `: ${record.branch}\n`);
      return;
    }
    default:
      printUsage();
  }
}
