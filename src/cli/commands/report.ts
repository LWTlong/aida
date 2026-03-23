import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { configPath, indexPath, runsDir } from '../../utils/paths.js';
import { fileExists, readJson, writeText } from '../../utils/fs.js';
import { green, red, cyan, yellow } from '../../utils/display.js';
import { getDevName } from '../../utils/git.js';
import type { IndexData, IndexRunEntry, RunData } from '../../schemas/run-json.js';

function parseReportFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
      flags[args[i].substring(2)] = args[i + 1];
      i++;
    }
  }
  return flags;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function filterByPeriod(runs: IndexRunEntry[], period: string): IndexRunEntry[] {
  if (!period) return runs;

  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  // Support: 2026-H1, 2026-H2, 2026, 2026-Q1, etc.
  const yearMatch = period.match(/^(\d{4})$/);
  const h1Match = period.match(/^(\d{4})-H1$/i);
  const h2Match = period.match(/^(\d{4})-H2$/i);
  const qMatch = period.match(/^(\d{4})-Q(\d)$/i);

  if (h1Match) {
    const y = parseInt(h1Match[1]);
    startDate = new Date(`${y}-01-01T00:00:00Z`);
    endDate = new Date(`${y}-07-01T00:00:00Z`);
  } else if (h2Match) {
    const y = parseInt(h2Match[1]);
    startDate = new Date(`${y}-07-01T00:00:00Z`);
    endDate = new Date(`${y + 1}-01-01T00:00:00Z`);
  } else if (qMatch) {
    const y = parseInt(qMatch[1]);
    const q = parseInt(qMatch[2]);
    const startMonth = (q - 1) * 3;
    startDate = new Date(y, startMonth, 1);
    endDate = new Date(y, startMonth + 3, 1);
  } else if (yearMatch) {
    const y = parseInt(yearMatch[1]);
    startDate = new Date(`${y}-01-01T00:00:00Z`);
    endDate = new Date(`${y + 1}-01-01T00:00:00Z`);
  } else {
    return runs;
  }

  return runs.filter(r => {
    if (!r.startTime) return false;
    const t = new Date(r.startTime);
    return t >= startDate && t < endDate;
  });
}

function generateMyReport(runs: IndexRunEntry[], devName: string, period: string): string {
  const myRuns = runs.filter(r => r.developers.some(d => d.name === devName));
  const lines: string[] = [];

  lines.push(`# ${period || 'All Time'} Report - ${devName}`);
  lines.push('');

  // Summary stats
  let totalTasks = 0, totalCompleted = 0, totalBugs = 0, totalDeviations = 0;
  let totalLinesAdded = 0, totalTokens = 0, totalWorkSeconds = 0;

  for (const run of myRuns) {
    const dev = run.developers.find(d => d.name === devName);
    if (!dev) continue;
    totalTasks += dev.tasks;
    totalCompleted += dev.completedTasks;
    totalBugs += dev.bugs;
    totalDeviations += dev.deviations;
    totalLinesAdded += dev.linesAdded;
    totalTokens += dev.totalTokens;
    totalWorkSeconds += dev.actualWorkSeconds;
  }

  lines.push('## Summary');
  lines.push('');
  lines.push(`- Requirements completed: ${myRuns.length}`);
  lines.push(`- Total tasks: ${totalTasks} (completed: ${totalCompleted})`);
  lines.push(`- Total bugs: ${totalBugs}`);
  lines.push(`- Total deviations: ${totalDeviations}`);
  lines.push(`- Code: +${totalLinesAdded} lines`);
  lines.push(`- AI work time: ${formatDuration(totalWorkSeconds)}`);
  if (totalTokens > 0) lines.push(`- Token consumption: ${(totalTokens / 1000000).toFixed(2)}M`);
  lines.push('');

  // Per-requirement breakdown
  lines.push('## Requirements');
  lines.push('');
  lines.push('| Requirement | Tasks | Bugs | Deviations | Lines | Status |');
  lines.push('|---|---|---|---|---|---|');

  for (const run of myRuns) {
    const dev = run.developers.find(d => d.name === devName);
    if (!dev) continue;
    lines.push(`| ${run.title || run.branch} | ${dev.tasks} | ${dev.bugs} | ${dev.deviations} | +${dev.linesAdded} | ${run.status} |`);
  }
  lines.push('');

  // Highlights
  const allHighlights = myRuns.flatMap(r => r.highlights || []);
  if (allHighlights.length > 0) {
    lines.push('## Highlights');
    lines.push('');
    for (const h of allHighlights) {
      lines.push(`- ${h.content}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateTeamReport(runs: IndexRunEntry[], period: string): string {
  const lines: string[] = [];

  lines.push(`# ${period || 'All Time'} Team Report`);
  lines.push('');

  // Collect all developers
  const devMap = new Map<string, { tasks: number; completed: number; bugs: number; deviations: number; lines: number; tokens: number; workSeconds: number; runs: number }>();

  for (const run of runs) {
    for (const dev of run.developers) {
      const existing = devMap.get(dev.name) || { tasks: 0, completed: 0, bugs: 0, deviations: 0, lines: 0, tokens: 0, workSeconds: 0, runs: 0 };
      existing.tasks += dev.tasks;
      existing.completed += dev.completedTasks;
      existing.bugs += dev.bugs;
      existing.deviations += dev.deviations;
      existing.lines += dev.linesAdded;
      existing.tokens += dev.totalTokens;
      existing.workSeconds += dev.actualWorkSeconds;
      existing.runs += 1;
      devMap.set(dev.name, existing);
    }
  }

  lines.push('## Overview');
  lines.push('');
  lines.push(`- Total requirements: ${runs.length}`);
  lines.push(`- Team members: ${devMap.size}`);
  lines.push('');

  lines.push('## Team Members');
  lines.push('');
  lines.push('| Developer | Requirements | Tasks | Bugs | Deviations | Lines | AI Time |');
  lines.push('|---|---|---|---|---|---|---|');

  for (const [name, stats] of devMap) {
    lines.push(`| ${name} | ${stats.runs} | ${stats.tasks} | ${stats.bugs} | ${stats.deviations} | +${stats.lines} | ${formatDuration(stats.workSeconds)} |`);
  }
  lines.push('');

  // All requirements
  lines.push('## Requirements');
  lines.push('');
  lines.push('| Requirement | Status | Tasks | Developers | Highlights |');
  lines.push('|---|---|---|---|---|');

  for (const run of runs) {
    const devNames = run.developers.map(d => d.name).join(', ');
    const topHighlight = run.highlights?.[0]?.content || '-';
    lines.push(`| ${run.title || run.branch} | ${run.status} | ${run.totals.tasks} | ${devNames} | ${topHighlight} |`);
  }
  lines.push('');

  return lines.join('\n');
}

export async function report(): Promise<void> {
  const projectRoot = process.cwd();

  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDA not initialized. Run `npx aida init` first.\n'));
    return;
  }

  const args = process.argv.slice(3);
  const flags = parseReportFlags(args);

  const scope = flags.scope || 'me';
  const period = flags.period || '';

  // Ensure index exists
  const idxPath = indexPath(projectRoot);
  if (!fileExists(idxPath)) {
    console.log(yellow('\n  Index not found. Running reindex first...\n'));
    const { reindex } = await import('./reindex.js');
    await reindex();
  }

  if (!fileExists(idxPath)) {
    console.log(red('\n  No data available for report.\n'));
    return;
  }

  const index = readJson<IndexData>(idxPath);
  let runs = index.runs || [];

  // Filter by period
  if (period) {
    runs = filterByPeriod(runs, period);
    if (runs.length === 0) {
      console.log(yellow(`\n  No runs found for period: ${period}\n`));
      return;
    }
  }

  let content: string;
  const devName = getDevName();

  switch (scope) {
    case 'me':
      content = generateMyReport(runs, devName, period);
      break;
    case 'team':
    case 'project':
      content = generateTeamReport(runs, period);
      break;
    default:
      console.log(red(`\n  Invalid --scope: "${scope}". Must be one of: me, team, project\n`));
      return;
  }

  const outputPath = resolve(projectRoot, '.aidevos', `report-${scope}-${period || 'all'}.md`);
  writeText(outputPath, content);

  console.log(green('\n  ✓ Report generated') + `: ${outputPath}\n`);
  console.log(`  ${cyan('Tip')}: Use this file as input for AI to generate a performance review draft.\n`);
}
