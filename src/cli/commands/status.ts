import { resolve } from 'node:path';
import { getBranchName, getDevName } from '../../utils/git.js';
import { runDir, configPath } from '../../utils/paths.js';
import { fileExists, readJson } from '../../utils/fs.js';
import {
  bold,
  green,
  cyan,
  red,
  yellow,
  blue,
  section,
  formatDuration,
  formatDate,
} from '../../utils/display.js';

export async function status(): Promise<void> {
  const projectRoot = process.cwd();

  if (!fileExists(configPath(projectRoot))) {
    console.log(
      red('\n  AIDA not initialized. Run `npx aida init` first.\n'),
    );
    return;
  }

  const branch = getBranchName();
  const dev = getDevName();
  const dir = runDir(projectRoot, branch, dev);
  const runJsonPath = resolve(dir, 'run.json');

  if (!fileExists(runJsonPath)) {
    console.log(
      red('\n  No active run found. Run `aida start` first.\n'),
    );
    return;
  }

  const data = readJson<Record<string, any>>(runJsonPath);
  const meta = data.meta || {};
  const summary = data.summary || {};
  const context = data.context || {};
  const bugs: any[] = data.bugs || [];

  const statusColor =
    meta.status === 'completed'
      ? green
      : meta.status === 'running'
        ? blue
        : yellow;

  const startTime = meta.startTime ? new Date(meta.startTime).getTime() : 0;
  const endTime = meta.endTime
    ? new Date(meta.endTime).getTime()
    : Date.now();
  const elapsed = startTime ? formatDuration(endTime - startTime) : '-';

  const stage = context.currentStage || '-';
  const phase = context.currentPrdPhase ? ` (${context.currentPrdPhase})` : '';

  const openBugs = bugs.filter((b) => b.status === 'open').length;
  const fixedBugs = bugs.filter((b) => b.status === 'fixed').length;

  console.log(`
  ${bold('AI Development Status')}

  Run ID:          ${cyan(meta.runId || branch)}
  Developer:       ${meta.developer || dev}
  Status:          ${statusColor(meta.status || 'unknown')}
  Current Stage:   ${stage}${phase}
  Started:         ${meta.startTime ? formatDate(meta.startTime) : '-'}

  ${section('Tasks')}
  Completed:       ${summary.completedTasks || 0} / ${summary.totalTasks || 0}

  ${section('Bugs')}
  Open:            ${openBugs}
  Fixed:           ${fixedBugs}

  ${section('Deviations')}
  Detected:        ${summary.deviationCount || 0}
  Rules Sedimented: ${summary.rulesSedimented || 0}

  ${section('Reviews')}
  Pass:            ${summary.reviewPassCount || 0}
  Fail:            ${summary.reviewFailCount || 0}

  ${section('Files Changed')}
  ${summary.filesChanged || 0} files

  ${section('Development Time')}
  ${elapsed}
`);
}
