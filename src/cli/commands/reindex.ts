import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { configPath, indexPath, runsDir } from '../../utils/paths.js';
import { fileExists, readJson, readText, writeJson, extractConflictSections } from '../../utils/fs.js';
import { green, red, yellow } from '../../utils/display.js';
import type { IndexData, IndexRunEntry, RequirementData } from '../../schemas/run-json.js';

/**
 * Core reindex logic - can be called from CLI or programmatically (e.g. dashboard startup).
 * Returns the number of runs indexed, or -1 on error.
 */
export function buildIndex(projectRoot: string): number {
  const theRunsDir = runsDir(projectRoot);
  if (!fileExists(theRunsDir)) return -1;

  const cfgPath = configPath(projectRoot);
  let config: Record<string, any> = {};
  try {
    config = fileExists(cfgPath) ? readJson<Record<string, any>>(cfgPath) : {};
  } catch { /* config.json may still have conflict markers; use empty defaults */ }
  const runs: IndexRunEntry[] = [];

  let branches: string[];
  try {
    branches = readdirSync(theRunsDir).filter(f =>
      statSync(resolve(theRunsDir, f)).isDirectory(),
    );
  } catch {
    return -1;
  }

  for (const branch of branches) {
    const reqPath = resolve(theRunsDir, branch, 'requirement.json');
    if (!fileExists(reqPath)) continue;

    try {
      const req = readJson<RequirementData>(reqPath);

      let status = 'running';
      let startTime = req.createdAt || '';
      let endTime: string | undefined;

      const branchPath = resolve(theRunsDir, branch);
      const devDirs = readdirSync(branchPath).filter(f => {
        const p = resolve(branchPath, f);
        return statSync(p).isDirectory() && fileExists(resolve(p, 'run.json'));
      });

      let allCompleted = devDirs.length > 0;
      for (const dev of devDirs) {
        const runData = readJson<Record<string, any>>(resolve(branchPath, dev, 'run.json'));
        const meta = runData.meta || {};
        if (meta.startTime && (!startTime || meta.startTime < startTime)) {
          startTime = meta.startTime;
        }
        if (meta.endTime && (!endTime || meta.endTime > endTime)) {
          endTime = meta.endTime;
        }
        if (meta.status !== 'completed') {
          allCompleted = false;
        }
      }
      if (allCompleted && devDirs.length > 0) status = 'completed';

      runs.push({
        branch: req.branch || branch,
        title: req.title || branch,
        summary: req.summary || '',
        status,
        startTime,
        endTime,
        developers: req.developers || [],
        highlights: req.highlights || [],
        totals: req.totals || { tasks: 0, completedTasks: 0, bugs: 0, deviations: 0, linesAdded: 0, linesRemoved: 0, totalTokens: 0 },
      });
    } catch {
      // Skip invalid requirement.json
    }
  }

  const index: IndexData = {
    project: config.project || '',
    updatedAt: new Date().toISOString(),
    runs,
  };

  writeJson(indexPath(projectRoot), index);
  return runs.length;
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
