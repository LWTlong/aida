import { resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { fileExists, readJson, writeJson } from '../../utils/fs.js';
import { green, cyan, red, yellow } from '../../utils/display.js';
import { normalizeRunData, recalcMetrics } from '../../utils/run-data.js';
import type { RunData } from '../../schemas/run-json.js';

/**
 * 数据迁移：旧格式 → 新格式 (schema 2.0)
 *
 * Handles two generations of old data:
 * 1. Very old: bugs[].id, deviations[].id (field renames needed)
 * 2. Intermediate: has bugId/deviationId but missing schemaVersion, cost, highlights, etc.
 */

// ─── Old format interfaces ──────────────────────────────

interface OldBug {
  id?: string; bugId?: string
  title: string; severity: string; source: string
  task?: string | null; taskId?: string | null
  description?: string; rootCause?: string; fix?: string
  files?: string[]; status?: string
  createdAt?: string; reportedAt?: string; fixedAt?: string
}

interface OldDeviation {
  id?: string; deviationId?: string
  title: string; rootCauseCategory: string; deviationCategory: string
  aiOutput?: string; expected?: string; expectedOutput?: string
  fix?: string; files?: string[]; status?: string
  ruleSedimented?: any
  createdAt?: string; detectedAt?: string; fixedAt?: string
}

interface OldReview {
  id?: string; reviewId?: string
  taskId?: string | null; bugId?: string | null
  result: string; scope?: string
  issues?: number | string[]; issueCount?: number
  details?: string; notes?: string; dimensions?: Record<string, string>
  createdAt?: string; reviewedAt?: string
}

interface OldRule {
  id?: string; ruleId?: string
  content: string; sourceDeviation?: string | null
  file?: string; status?: string
  createdAt?: string; sedimentedAt?: string
}

interface OldFile {
  filePath?: string; path?: string
  changeType: string
  linesAdded: number; linesRemoved: number
  changeCount?: number; lastModified?: string
  prdPhase?: string; changedAt?: string
}

// ─── Category mapping (old → new enum) ──────────────────

const DEVIATION_CAT_MAP: Record<string, string> = {
  'ui-spacing': 'ui-spacing',
  'layout': 'layout',
  'component-usage': 'component-usage',
  'i18n': 'i18n',
  'api': 'api',
  'logic': 'logic',
  'architecture': 'architecture',
  'style': 'style',
  'process': 'process',
  'other': 'other',
  // Old values not in new enum → map to closest
  'styling': 'style',
  'workflow': 'process',
  'state-management': 'logic',
  'feature-incomplete': 'other',
};

const ROOT_CAUSE_MAP: Record<string, string> = {
  'rule-missing': 'rule-missing',
  'context-insufficient': 'context-insufficient',
  'hallucination': 'hallucination',
  'misunderstanding': 'misunderstanding',
  'reference-copy': 'reference-copy',
  'process-omission': 'process-omission',
  'other': 'other',
  // Old values
  'skill-execution': 'process-omission',
  'ai-logic-error': 'hallucination',
  'task-omission': 'process-omission',
};

// ─── Migrators ──────────────────────────────────────────

function migrateBug(old: OldBug): any {
  return {
    bugId: old.bugId || old.id || '',
    title: old.title,
    severity: old.severity || 'medium',
    source: old.source || 'self-review',
    status: old.status || 'open',
    files: old.files || [],
    fix: old.fix || null,
    taskId: old.taskId || old.task || null,
    reportedAt: old.reportedAt || old.createdAt || new Date().toISOString(),
    fixedAt: old.fixedAt || null,
  };
}

function migrateDeviation(old: OldDeviation): any {
  return {
    deviationId: old.deviationId || old.id || '',
    title: old.title,
    rootCauseCategory: ROOT_CAUSE_MAP[old.rootCauseCategory] || 'other',
    deviationCategory: DEVIATION_CAT_MAP[old.deviationCategory] || 'other',
    aiOutput: old.aiOutput || '',
    expectedOutput: old.expectedOutput || old.expected || '',
    files: old.files || [],
    ruleSedimented: old.ruleSedimented ?? null,
    detectedAt: old.detectedAt || old.createdAt || new Date().toISOString(),
    fixedAt: old.fixedAt || null,
  };
}

function migrateReview(old: OldReview): any {
  let issueCount = old.issueCount || 0;
  let issuesArray: string[] = [];

  if (typeof old.issues === 'number') {
    issueCount = old.issues;
  } else if (Array.isArray(old.issues)) {
    issuesArray = old.issues;
    issueCount = old.issues.length;
  }

  return {
    reviewId: old.reviewId || old.id || '',
    taskId: old.taskId || null,
    result: old.result || 'pass',
    issueCount,
    scope: old.scope || '',
    reviewedAt: old.reviewedAt || old.createdAt || new Date().toISOString(),
    issues: issuesArray,
  };
}

function migrateRule(old: OldRule): any {
  return {
    ruleId: old.ruleId || old.id || '',
    content: old.content,
    sourceDeviation: old.sourceDeviation || null,
    sedimentedAt: old.sedimentedAt || old.createdAt || new Date().toISOString(),
    file: old.file || '',
    ...(old.status === 'pending' ? { status: 'pending' } : {}),
  };
}

function migrateFile(old: OldFile): any {
  return {
    path: old.path || old.filePath || '',
    changeType: old.changeType || 'modified',
    linesAdded: old.linesAdded || 0,
    linesRemoved: old.linesRemoved || 0,
    changeCount: old.changeCount || 1,
    lastModified: old.lastModified || old.changedAt || new Date().toISOString(),
  };
}

// ─── Full migration ─────────────────────────────────────

function migrateRunJson(data: any, projectName?: string): RunData {
  const meta = data.meta || {};
  const summary = data.summary || {};
  const now = new Date().toISOString();

  // Migrate meta
  const newMeta = {
    schemaVersion: '2.0',
    runId: meta.runId || meta.branch || '',
    project: meta.project || projectName || '',
    developer: meta.developer || '',
    branch: meta.branch || '',
    aiModel: meta.aiModel || '',
    aiTool: meta.aiTool || '',
    startTime: meta.startTime || now,
    endTime: meta.endTime || undefined,
    status: meta.status || 'running',
    prdPhases: meta.prdPhases || [],
  };

  // Migrate entities
  const bugs = (data.bugs || []).map((b: any) => migrateBug(b));
  const deviations = (data.deviations || []).map((d: any) => migrateDeviation(d));
  const reviews = (data.reviews || []).map((r: any) => migrateReview(r));
  const rules = (data.rules || []).map((r: any) => migrateRule(r));
  const files = (data.files || []).map((f: any) => migrateFile(f));
  const tasks = data.tasks || [];

  // Ensure tasks have startedAt
  for (const t of tasks) {
    if (!t.startedAt && t.createdAt) t.startedAt = t.createdAt;
  }

  // Rebuild summary from actual data
  const newSummary = {
    totalTasks: tasks.length,
    completedTasks: tasks.filter((t: any) => t.status === 'done').length,
    bugCount: bugs.length,
    deviationCount: deviations.length,
    reviewCount: reviews.length,
    reviewPassCount: reviews.filter((r: any) => r.result === 'pass').length,
    reviewFailCount: reviews.filter((r: any) => r.result === 'fail').length,
    rulesSedimented: rules.filter((r: any) => r.status !== 'pending').length,
    prdPhaseCount: summary.prdPhaseCount || 0,
    filesChanged: files.length,
    linesAdded: files.reduce((s: number, f: any) => s + (f.linesAdded || 0), 0),
    linesRemoved: files.reduce((s: number, f: any) => s + (f.linesRemoved || 0), 0),
  };

  // Build timeline from existing data
  const timeline: any[] = data.timeline || [];
  if (timeline.length === 0) {
    // Generate timeline from tasks
    for (const t of tasks) {
      if (t.createdAt) {
        timeline.push({ type: 'task', title: `${t.taskId}: ${t.title}`, timestamp: t.createdAt });
      }
      if (t.completedAt) {
        timeline.push({ type: 'task-done', title: `${t.taskId}: ${t.title}`, timestamp: t.completedAt });
      }
    }
    for (const b of bugs) {
      if (b.reportedAt) {
        timeline.push({ type: 'bug', title: `${b.bugId}: ${b.title}`, timestamp: b.reportedAt });
      }
      if (b.fixedAt) {
        timeline.push({ type: 'bug-fix', title: `${b.bugId}: ${b.title}`, timestamp: b.fixedAt });
      }
    }
    for (const d of deviations) {
      if (d.detectedAt) {
        timeline.push({ type: 'deviation', title: `${d.deviationId}: ${d.title}`, timestamp: d.detectedAt });
      }
    }
    for (const r of reviews) {
      if (r.reviewedAt) {
        timeline.push({ type: 'review', title: `${r.reviewId}: ${r.result}`, timestamp: r.reviewedAt });
      }
    }
    timeline.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  const migrated: RunData = {
    meta: newMeta,
    summary: newSummary,
    metrics: {},
    context: data.context || { lastUpdated: now },
    tasks,
    bugs,
    deviations,
    reviews,
    rules,
    files,
    timeline,
    events: data.events || [],
    workflow: data.workflow || [],
    cost: data.cost || { totalTokens: 0, estimatedManualHours: 0, actualHours: 0, tokenBreakdown: [] },
    highlights: data.highlights || [],
  };

  // Recalculate metrics
  recalcMetrics(migrated);

  return migrated;
}

// ─── File discovery ─────────────────────────────────────

function findAllRunJsonFiles(baseDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    try {
      const items = readdirSync(dir);
      for (const item of items) {
        const fullPath = resolve(dir, item);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath);
          } else if (item === 'run.json') {
            results.push(fullPath);
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  walk(baseDir);
  return results;
}

// ─── CLI entry point ────────────────────────────────────

export async function migrate(): Promise<void> {
  const projectRoot = process.cwd();
  const aidaDir = resolve(projectRoot, '.aida/runs');

  if (!fileExists(aidaDir)) {
    console.log(yellow('\n  No .aida/runs directory found.\n'));
    return;
  }

  // Read project name from config
  let projectName = '';
  const configPath = resolve(projectRoot, '.aida/config.json');
  if (fileExists(configPath)) {
    try {
      const cfg = readJson<any>(configPath);
      projectName = cfg.project || '';
    } catch { /* ignore */ }
  }

  console.log(cyan('\n  AIDevo Data Migration\n'));
  console.log('  Searching for run.json files...\n');

  const runJsonFiles = findAllRunJsonFiles(aidaDir);

  if (runJsonFiles.length === 0) {
    console.log(yellow('  No run.json files found.\n'));
    return;
  }

  console.log(`  Found ${runJsonFiles.length} run.json file(s):\n`);
  runJsonFiles.forEach((f) => console.log(`    ${f.replace(projectRoot, '.')}`));

  console.log('\n  Starting migration...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const filePath of runJsonFiles) {
    try {
      const data = readJson<any>(filePath);

      // Check if already at schema 2.0
      if (data.meta?.schemaVersion === '2.0' && data.cost && Array.isArray(data.highlights)) {
        console.log(green(`  ✓ ${filePath.replace(projectRoot, '.')} (already v2.0)`));
        successCount++;
        continue;
      }

      // Backup original
      const backupPath = filePath.replace('.json', '.backup.json');
      writeJson(backupPath, data);

      // Perform migration
      const migrated = migrateRunJson(data, projectName);

      // Write migrated data
      writeJson(filePath, migrated);

      // Summary of what changed
      const stats = [
        `${migrated.tasks.length} tasks`,
        `${migrated.bugs.length} bugs`,
        `${migrated.deviations.length} deviations`,
        `${migrated.reviews.length} reviews`,
        `${migrated.timeline.length} timeline entries`,
      ].join(', ');

      console.log(green(`  ✓ ${filePath.replace(projectRoot, '.')}`));
      console.log(`    ${stats}`);
      successCount++;
    } catch (error) {
      console.log(red(`  ✗ ${filePath.replace(projectRoot, '.')}: ${error}`));
      errorCount++;
    }
  }

  console.log(`\n  ${green('Migration complete!')}`);
  console.log(`    Success: ${successCount}`);
  if (errorCount > 0) {
    console.log(`    ${red(`Errors: ${errorCount}`)}`);
  }
  console.log(`\n  ${yellow('Note:')} Original files backed up as *.backup.json\n`);
}
