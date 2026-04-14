import { resolve } from 'node:path';
import { getBranchName, getDevName } from '../../utils/git.js';
import { aidaDir, runDir, branchDir, configPath } from '../../utils/paths.js';
import {
  ensureDir,
  fileExists,
  readJson,
  readText,
  writeJson,
  writeText,
} from '../../utils/fs.js';
import { bold, green, cyan, yellow, red, dim } from '../../utils/display.js';
import { buildRuleViews, loadRegistry } from '../../utils/rules.js';

export async function start(): Promise<void> {
  const projectRoot = process.cwd();

  if (!fileExists(configPath(projectRoot))) {
    console.log(
      red('\n  AIDA not initialized. Run `npx aida init` first.\n'),
    );
    return;
  }

  const branch = getBranchName();
  const dev = getDevName();
  const devDir = runDir(projectRoot, branch, dev);
  const bDir = branchDir(projectRoot, branch);
  const runJsonPath = resolve(devDir, 'run.json');

  console.log(`\n  ${bold('AIDevOS')} - New Development Run\n`);

  if (fileExists(runJsonPath)) {
    const data = readJson<Record<string, any>>(runJsonPath);
    console.log(yellow('  Run already exists:\n'));
    console.log(`  Run ID:     ${cyan(data.meta?.runId || branch)}`);
    console.log(`  Developer:  ${data.meta?.developer || dev}`);
    console.log(`  Status:     ${data.meta?.status || 'unknown'}`);
    console.log(`  Started:    ${data.meta?.startTime || '-'}\n`);
    return;
  }

  const config = readJson<Record<string, any>>(configPath(projectRoot));
  const now = new Date().toISOString();

  // AI model: --model flag > config.json > empty
  let aiModel = '';
  const modelIdx = process.argv.indexOf('--model');
  if (modelIdx !== -1 && process.argv[modelIdx + 1]) {
    aiModel = process.argv[modelIdx + 1];
  } else if (config.aiModel) {
    aiModel = config.aiModel;
  }

  const runData = {
    meta: {
      schemaVersion: '2.0',
      runId: branch,
      project: config.project || '',
      developer: dev,
      branch,
      aiModel,
      aiTool: config.aiTool || '',
      startTime: now,
      endTime: null,
      status: 'running',
      prdPhases: [],
    },
    summary: {
      totalTasks: 0,
      completedTasks: 0,
      bugCount: 0,
      deviationCount: 0,
      reviewCount: 0,
      reviewPassCount: 0,
      reviewFailCount: 0,
      rulesSedimented: 0,
      prdPhaseCount: 0,
      filesChanged: 0,
      linesAdded: 0,
      linesRemoved: 0,
    },
    workflow: [],
    tasks: [],
    bugs: [],
    deviations: [],
    reviews: [],
    files: [],
    metrics: {
      aiDeviationRate: 0,
      bugRate: 0,
      reviewPassRate: 0,
      rulesSedimentedCount: 0,
      totalDevelopmentTimeSeconds: 0,
      actualWorkSeconds: 0,
      nodeTimeBreakdown: {},
      efficiencyMultiplier: 0,
    },
    timeline: [],
    events: [],
    rules: [],
    context: {
      currentPrdPhase: null,
      currentTaskId: null,
      currentStage: null,
      lastUpdated: now,
    },
    cost: {
      totalTokens: 0,
      estimatedManualHours: 0,
      actualHours: 0,
      tokenBreakdown: [],
    },
    highlights: [],
  };

  // Ensure branch-level directory and developer directory
  ensureDir(bDir);
  ensureDir(devDir);

  // Create run.json in developer directory
  writeJson(runJsonPath, runData);

  // Create shared PRD at branch level (if not already exists)
  const prdPath = resolve(bDir, 'prd.md');
  if (!fileExists(prdPath)) {
    writeText(prdPath, '# PRD\n\nPlace your product requirements here.\n');
  }

  // Create shared analysis.md at branch level (if not already exists)
  const analysisPath = resolve(bDir, 'analysis.md');
  if (!fileExists(analysisPath)) {
    writeText(analysisPath, '');
  }

  // Initialize requirement.json at branch level (if not already exists)
  const reqPath = resolve(bDir, 'requirement.json');
  if (!fileExists(reqPath)) {
    writeJson(reqPath, {
      branch,
      title: '',
      summary: '',
      prdPhases: [],
      modules: [],
      highlights: [],
      developers: [],
      totals: { tasks: 0, completedTasks: 0, bugs: 0, deviations: 0, linesAdded: 0, linesRemoved: 0, totalTokens: 0 },
      createdAt: now,
      updatedAt: now,
    });
  }

  const safeBranch = branch.replace(/\//g, '-');

  // Ensure .gitignore contains rules/*.md (auto-generated views)
  ensureGitignoreEntry(projectRoot, '.aida/rules/*.md');

  // Auto-rebuild rule views from registry so AI has fresh rules
  try {
    const registry = loadRegistry(projectRoot);
    if (registry.length > 0) {
      const count = buildRuleViews(projectRoot);
      console.log(dim(`  ✓ Rules views rebuilt (${registry.length} rules → ${count} files)`));
    }
  } catch { /* best-effort */ }

  console.log(`  Run ID:     ${cyan(branch)}`);
  console.log(`  Developer:  ${dev}`);
  console.log(`  Branch:     ${branch}`);
  if (aiModel) {
    console.log(`  AI Model:   ${aiModel}`);
  }
  console.log('');
  console.log(
    green('  ✓ Created') +
      ` .aida/runs/${safeBranch}/${dev}/run.json\n`,
  );
  console.log(`  Shared PRD: .aida/runs/${safeBranch}/prd.md`);
  console.log(
    `\n  Next: Place your PRD in the branch directory, then run ${cyan('/workflow')}\n`,
  );
}

function ensureGitignoreEntry(projectRoot: string, entry: string): void {
  const gitignorePath = resolve(projectRoot, '.gitignore');
  let content = '';
  if (fileExists(gitignorePath)) {
    content = readText(gitignorePath);
  }

  // Check if entry already present
  const lines = content.split('\n');
  if (lines.some((l) => l.trim() === entry)) return;

  // Append with a comment
  const append = content.endsWith('\n') || content === '' ? '' : '\n';
  writeText(
    gitignorePath,
    content + append + `# Auto-generated rule views (source of truth: .aida/rules.json)\n${entry}\n`,
  );
}
