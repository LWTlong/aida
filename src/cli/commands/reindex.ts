import { configPath, indexPath } from '../../utils/paths.js';
import { fileExists, readText, writeJson, extractConflictSections } from '../../utils/fs.js';
import { green, red, yellow } from '../../utils/display.js';
import { rebuildSummaryIndex } from '../../utils/summary.js';

/**
 * Core reindex logic - can be called from CLI or programmatically (e.g. dashboard startup).
 * Returns the number of runs indexed, or -1 on error.
 */
export function buildIndex(projectRoot: string): number {
  return rebuildSummaryIndex(projectRoot);
}

/**
 * CLI entry point for `aida reindex`
 *
 * Also auto-resolves git merge conflicts in index.json and config.json:
 * - index.json: rebuilt from source (requirement.json files) — authoritative
 * - config.json: merges aiTools as union, keeps ours for scalar fields
 */
export async function reindex(): Promise<void> {
  const projectRoot = process.cwd();

  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDA not initialized. Run `npx aida init` first.\n'));
    return;
  }

  // Auto-resolve config.json conflict if present
  const cfgPath = configPath(projectRoot);
  const cfgRaw = readText(cfgPath);
  if (cfgRaw.includes('<<<<<<<') || cfgRaw.includes('>>>>>>>')) {
    console.log(yellow('\n  Merge conflict detected in config.json. Resolving...\n'));
    const sections = extractConflictSections(cfgRaw);
    if (sections) {
      try {
        const oursConfig = JSON.parse(sections.ours || '{}');
        const theirsConfig = JSON.parse(sections.theirs || '{}');
        // Union of aiTools, keep ours for all other scalar fields
        const merged = { ...oursConfig };
        const theirTools: string[] = theirsConfig.aiTools || [];
        const ourTools: string[] = oursConfig.aiTools || [];
        merged.aiTools = [...new Set([...ourTools, ...theirTools])];
        writeJson(cfgPath, merged);
        console.log(green('  ✓ config.json resolved\n'));
      } catch {
        console.log(red('  Could not parse config.json conflict. Please resolve manually.\n'));
      }
    } else {
      console.log(red('  Could not parse config.json conflict markers. Please resolve manually.\n'));
    }
  }

  // Auto-resolve index.json conflict: just rebuild from source
  const idxPath = indexPath(projectRoot);
  if (fileExists(idxPath)) {
    const idxRaw = readText(idxPath);
    if (idxRaw.includes('<<<<<<<') || idxRaw.includes('>>>>>>>')) {
      console.log(yellow('\n  Merge conflict detected in index.json. Rebuilding from source...\n'));
      const count = buildIndex(projectRoot);
      console.log(green(`  ✓ index.json rebuilt`) + `: ${count} runs indexed (conflict resolved)\n`);
      return;
    }
  }

  const count = buildIndex(projectRoot);
  if (count < 0) {
    console.log(red('\n  No runs directory found or failed to read.\n'));
    return;
  }

  console.log(green(`\n  ✓ Index rebuilt`) + `: ${count} runs indexed\n`);
}
