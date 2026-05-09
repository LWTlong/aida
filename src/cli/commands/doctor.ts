import { green, red, yellow, cyan, dim } from '../../utils/display.js';
import { configPath } from '../../utils/paths.js';
import { fileExists } from '../../utils/fs.js';
import { inspectProjectHealth, normalizeProjectTruthSources } from '../../utils/project-health.js';
import { findSimilarRules, loadRegistry } from '../../utils/rules.js';

function hasFixFlag(): boolean {
  return process.argv.slice(3).includes('--fix');
}

function line(ok: boolean, label: string, detail: string): void {
  console.log(`${ok ? green('  ✓') : yellow('  !')} ${label}: ${detail}`);
}

export async function doctor(): Promise<void> {
  const projectRoot = process.cwd();

  console.log(cyan('\n  AIDA Doctor\n'));

  if (!fileExists(configPath(projectRoot))) {
    console.log(red('  AIDA not initialized. Run `npx aida init` first.\n'));
    return;
  }

  const fix = hasFixFlag();
  if (fix) {
    const normalized = normalizeProjectTruthSources(projectRoot);
    console.log(green('  ✓ Normalized truth sources'));
    console.log(`    rules: ${normalized.rules}`);
    console.log(`    skills: ${normalized.skills}`);
    console.log(`    memories: ${normalized.memories}`);
    console.log(`    summary: ${normalized.summary}`);
    console.log('');
  }

  const report = inspectProjectHealth(projectRoot);
  const similarRules = findSimilarRules(loadRegistry(projectRoot)).slice(0, 10);

  line(report.rules.exists && !report.rules.legacyRoot, 'rules.json', `${report.rules.count} entries`);
  line(report.skills.exists && !report.skills.legacyRoot, 'skills.json', `${report.skills.count} entries`);
  line(
    report.memories.indexExists && !report.memories.indexLegacyRoot && !report.memories.nestedLayout,
    'memories',
    `${report.memories.moduleCount} modules`,
  );
  line(report.summary.exists, 'summary.json', `${report.summary.count} summaries`);
  line(!report.runs.runtimeDirExists && report.runs.legacySchema === 0, 'legacy runtime', report.runs.runtimeDirExists ? '.aida/runs still exists' : 'clean');
  line(similarRules.length === 0, 'rule duplicates', similarRules.length === 0 ? 'no near-duplicate rules' : `${similarRules.length} potential pair(s)`);

  if (report.warnings.length === 0 && similarRules.length === 0) {
    console.log(green('\n  ✓ Project health looks good.\n'));
    return;
  }

  if (report.warnings.length > 0) {
    console.log(yellow('\n  Warnings'));
    for (const warning of report.warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (similarRules.length > 0) {
    console.log(yellow(`\n  Potential duplicate rules (${similarRules.length})`));
    for (const { a, b, similarity } of similarRules) {
      const pct = Math.round(similarity * 100);
      console.log(`  - ${a.id} ↔ ${b.id} (${pct}% similar)`);
      console.log(`    A: ${a.content}`);
      console.log(`    B: ${b.content}`);
    }
  }

  console.log('');
  if (report.runs.legacySchema > 0 || report.runs.runtimeDirExists) {
    console.log(dim('\n  Run `aida doctor --fix` or `aida migrate-legacy` to extract 2.0 truth sources and remove legacy runtime artifacts.\n'));
  } else if (similarRules.length > 0) {
    console.log(dim('  Review the pairs above. Keep both if they are materially different; merge or deprecate one if they are duplicates.\n'));
  } else if (!fix) {
    console.log(dim('\n  Run `aida doctor --fix` to normalize JSON truth sources and rebuild summary/index.\n'));
  } else {
    console.log('');
  }
}
