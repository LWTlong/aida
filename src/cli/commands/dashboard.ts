import { resolve } from 'node:path';
import { configPath, runsDir, ASSETS_DIR } from '../../utils/paths.js';
import { fileExists, ensureDir, writeJson, readJson } from '../../utils/fs.js';
import { bold, green, cyan, red, dim, yellow } from '../../utils/display.js';
import { getBranchName } from '../../utils/git.js';
import { startServer } from '../../server/index.js';
import { getAllRuns } from '../../server/api.js';
import { existsSync } from 'node:fs';

function loadDemoData(projectRoot: string): void {
  const demoPath = resolve(ASSETS_DIR, 'templates', 'demo-run.json');
  if (!existsSync(demoPath)) return;

  const demoDir = resolve(projectRoot, '.aidevos', 'runs', 'demo-feature', 'demo-dev');
  ensureDir(demoDir);
  const data = readJson<Record<string, any>>(demoPath);
  writeJson(resolve(demoDir, 'run.json'), data);
}

export async function dashboard(): Promise<void> {
  const projectRoot = process.cwd();
  const isDemo = process.argv.includes('--demo');

  if (!isDemo && !fileExists(configPath(projectRoot))) {
    console.log(
      red('\n  AIDevOS not initialized. Run `npx aidevo init` first.\n'),
    );
    return;
  }

  // Parse --port flag
  let port = 2375;
  const portIdx = process.argv.indexOf('--port');
  if (portIdx !== -1 && process.argv[portIdx + 1]) {
    port = parseInt(process.argv[portIdx + 1]) || 2375;
  }

  if (isDemo) {
    loadDemoData(projectRoot);
    console.log(yellow('\n  Running in demo mode with sample data.\n'));
  }

  // Auto-reindex on dashboard start to ensure overview data is fresh
  try {
    const { buildIndex } = await import('./reindex.js');
    buildIndex(projectRoot);
  } catch {
    /* reindex is best-effort */
  }

  const runs = getAllRuns(runsDir(projectRoot));

  let currentBranch = '';
  try {
    currentBranch = getBranchName().replace(/\//g, '-');
  } catch {
    /* not in git repo */
  }

  console.log(`\n  ${bold('AIDevOS Dashboard')}\n`);

  await startServer(port, projectRoot);

  console.log(
    green('  ✓ Server running at ') + cyan(`http://localhost:${port}`),
  );
  console.log(dim('  Watching for changes...'));
  console.log(dim('  Press Ctrl+C to stop\n'));

  if (runs.length > 0) {
    console.log(`  Found ${runs.length} run(s):`);
    for (const run of runs) {
      const isCurrent = run.runId.startsWith(currentBranch)
        ? cyan(' ← current')
        : '';
      console.log(`    - ${run.branch} (${run.status})${isCurrent}`);
    }
    console.log('');
  } else {
    console.log(dim('  No runs found. Run `aidevo start` first.\n'));
  }
}
