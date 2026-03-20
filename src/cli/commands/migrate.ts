import { resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { fileExists, readJson, writeJson } from '../../utils/fs.js';
import { green, cyan, red, yellow } from '../../utils/display.js';

/**
 * 数据迁移：旧格式 → 新格式
 *
 * 旧字段 → 新字段映射：
 * - bugs[].id → bugId
 * - bugs[].task → taskId
 * - bugs[].createdAt → reportedAt
 * - deviations[].id → deviationId
 * - deviations[].createdAt → detectedAt
 * - reviews[].id → reviewId
 * - reviews[].createdAt → reviewedAt
 * - reviews[].issues (number) → issueCount (number) + issues (array)
 * - rules[].id → ruleId
 * - rules[].createdAt → sedimentedAt
 */

interface OldBug {
  id: string
  title: string
  severity: string
  source: string
  task?: string | null
  description?: string
  rootCause?: string
  fix?: string
  files?: string[]
  status?: string
  createdAt?: string
  fixedAt?: string
}

interface OldDeviation {
  id: string
  title: string
  rootCauseCategory: string
  deviationCategory: string
  aiOutput?: string
  expected?: string
  fix?: string
  files?: string[]
  status?: string
  createdAt?: string
  fixedAt?: string
}

interface OldReview {
  id: string
  taskId?: string | null
  bugId?: string | null
  result: string
  scope: string
  issues: number | string[]
  dimensions?: Record<string, string>
  notes?: string
  createdAt?: string
}

interface OldRule {
  id: string
  content: string
  sourceDeviation?: string | null
  file?: string
  createdAt?: string
}

function migrateBug(old: OldBug): any {
  return {
    bugId: old.id,
    title: old.title,
    severity: old.severity,
    source: old.source,
    status: old.status || 'open',
    files: old.files || [],
    fix: old.fix || null,
    taskId: old.task || null,
    reportedAt: old.createdAt || new Date().toISOString(),
    fixedAt: old.fixedAt || null,
  };
}

function migrateDeviation(old: OldDeviation): any {
  return {
    deviationId: old.id,
    title: old.title,
    rootCauseCategory: old.rootCauseCategory,
    deviationCategory: old.deviationCategory,
    aiOutput: old.aiOutput || '',
    expectedOutput: old.expected || '',
    files: old.files || [],
    ruleSedimented: null,
    detectedAt: old.createdAt || new Date().toISOString(),
    fixedAt: old.fixedAt || null,
  };
}

function migrateReview(old: OldReview): any {
  // issues 可能是数字或数组
  let issueCount = 0;
  let issuesArray: string[] = [];

  if (typeof old.issues === 'number') {
    issueCount = old.issues;
  } else if (Array.isArray(old.issues)) {
    issuesArray = old.issues;
    issueCount = old.issues.length;
  }

  return {
    reviewId: old.id,
    taskId: old.taskId || null,
    result: old.result,
    issueCount,
    scope: old.scope || '',
    reviewedAt: old.createdAt || new Date().toISOString(),
    issues: issuesArray,
  };
}

function migrateRule(old: OldRule): any {
  return {
    ruleId: old.id,
    content: old.content,
    sourceDeviation: old.sourceDeviation || null,
    sedimentedAt: old.createdAt || new Date().toISOString(),
    file: old.file || '',
  };
}

function migrateRunJson(data: any): any {
  const migrated = { ...data };

  // Migrate bugs
  if (Array.isArray(data.bugs)) {
    migrated.bugs = data.bugs.map((b: OldBug) => migrateBug(b));
  }

  // Migrate deviations
  if (Array.isArray(data.deviations)) {
    migrated.deviations = data.deviations.map((d: OldDeviation) => migrateDeviation(d));
  }

  // Migrate reviews
  if (Array.isArray(data.reviews)) {
    migrated.reviews = data.reviews.map((r: OldReview) => migrateReview(r));
  }

  // Migrate rules
  if (Array.isArray(data.rules)) {
    migrated.rules = data.rules.map((r: OldRule) => migrateRule(r));
  }

  // Ensure arrays exist
  if (!Array.isArray(migrated.files)) migrated.files = [];
  if (!Array.isArray(migrated.timeline)) migrated.timeline = [];
  if (!Array.isArray(migrated.events)) migrated.events = [];
  if (!Array.isArray(migrated.workflow)) migrated.workflow = [];

  // Ensure objects exist
  if (!migrated.summary) migrated.summary = {};
  if (!migrated.meta) migrated.meta = {};
  if (!migrated.context) migrated.context = {};
  if (!migrated.metrics) migrated.metrics = {};

  return migrated;
}

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
        } catch {
          // Skip files that can't be accessed
        }
      }
    } catch {
      // Skip directories that can't be accessed
    }
  }

  walk(baseDir);
  return results;
}

export async function migrate(): Promise<void> {
  const projectRoot = process.cwd();
  const aidevosDir = resolve(projectRoot, '.aidevos/runs');

  if (!fileExists(aidevosDir)) {
    console.log(yellow('\n  No .aidevos/runs directory found.\n'));
    return;
  }

  console.log(cyan('\n  🔄 AIDevOS Data Migration\n'));
  console.log('  Searching for run.json files...\n');

  const runJsonFiles = findAllRunJsonFiles(aidevosDir);

  if (runJsonFiles.length === 0) {
    console.log(yellow('  No run.json files found.\n'));
    return;
  }

  console.log(`  Found ${runJsonFiles.length} run.json file(s):\n`);
  runJsonFiles.forEach((f) => console.log(`    • ${f.replace(projectRoot, '.')}`));

  console.log('\n  Starting migration...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const filePath of runJsonFiles) {
    try {
      const data = readJson<any>(filePath);

      // Check if already migrated (has new field names)
      const isMigrated =
        (data.bugs && data.bugs.length > 0 && data.bugs[0].bugId) ||
        (data.deviations && data.deviations.length > 0 && data.deviations[0].deviationId) ||
        (data.reviews && data.reviews.length > 0 && data.reviews[0].reviewId) ||
        (data.rules && data.rules.length > 0 && data.rules[0].ruleId);

      if (isMigrated) {
        console.log(green(`  ✓ ${filePath.replace(projectRoot, '.')} (already migrated)`));
        successCount++;
        continue;
      }

      // Perform migration
      const migrated = migrateRunJson(data);

      // Backup original
      const backupPath = filePath.replace('.json', '.backup.json');
      writeJson(backupPath, data);

      // Write migrated data
      writeJson(filePath, migrated);

      console.log(green(`  ✓ ${filePath.replace(projectRoot, '.')}`));
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
