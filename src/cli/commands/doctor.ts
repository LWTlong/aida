import { green, red, yellow, cyan, dim } from '../../utils/display.js';
import { configPath } from '../../utils/paths.js';
import { fileExists } from '../../utils/fs.js';
import { inspectProject, inspectSecurity, normalizeProject } from '../../services/project-health.js';

function hasFixFlag(): boolean {
  return process.argv.slice(3).includes('--fix');
}

function securityMode(): 'all' | 'npm' | 'skills' | null {
  const arg = process.argv.slice(3).find((item) => item === '--security' || item.startsWith('--security='));
  if (!arg) return null;
  if (arg === '--security') return 'all';
  const value = arg.split('=')[1]?.trim();
  if (value === 'npm' || value === 'skills') return value;
  return 'all';
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
    const normalized = normalizeProject(projectRoot);
    console.log(green('  ✓ Normalized truth sources'));
    console.log(`    config: ${normalized.configUpgraded ? 'upgraded to latest 2.0 shape' : 'already current'}`);
    console.log(`    rules: ${normalized.rules}`);
    console.log(`    skills: ${normalized.skills}`);
    console.log(`    memories: ${normalized.memories}`);
    console.log(`    summary: ${normalized.summary}`);
    console.log('');
  }

  const { report, similarRules } = inspectProject(projectRoot);
  const mode = securityMode();

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

  const healthOk = report.warnings.length === 0 && similarRules.length === 0;
  if (healthOk) {
    console.log(green('\n  ✓ Project health looks good.'));
    if (!mode) {
      console.log('');
      return;
    }
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

  if (mode) {
    const security = inspectSecurity(projectRoot, mode);

    if (security.packageAudit) {
      const { findings, warnings, scannedTargets, osvScanned } = security.packageAudit;
      console.log(yellow(`\n  Package security audit (${scannedTargets.length} target(s)${osvScanned ? ', OSV enabled' : ''})`));
      if (findings.length === 0 && warnings.length === 0) {
        console.log('  - No package security warnings detected.');
      } else {
        for (const warning of warnings) {
          console.log(`  - ${warning.message}`);
        }
        for (const finding of findings) {
          console.log(`  - [${finding.severity}] ${finding.packageName} (${finding.id}) via ${finding.source} @ ${finding.workspacePath}`);
          console.log(`    ${finding.title}`);
        }
      }
    }

    if (security.skillAudit) {
      const { findings, warnings, scannedPaths, configuredPaths } = security.skillAudit;
      console.log(yellow(`\n  Skill security audit (${scannedPaths.length}/${configuredPaths.length} path(s) scanned)`));
      if (findings.length === 0 && warnings.length === 0) {
        console.log('  - No skill risk warnings detected.');
      } else {
        for (const warning of warnings) {
          console.log(`  - ${warning.message}`);
        }
        for (const finding of findings) {
          console.log(`  - ${finding.skillName} @ ${finding.sourcePath}`);
          for (const issue of finding.issues) {
            console.log(`    [${issue.type}] ${issue.filePath} -> ${issue.signal}`);
          }
        }
      }
    }
  }

  console.log('');
  if (report.runs.legacySchema > 0 || report.runs.runtimeDirExists) {
    console.log(dim('\n  Run `aida doctor --fix` to normalize 2.0 truth sources and remove legacy runtime artifacts.\n'));
  } else if (similarRules.length > 0) {
    console.log(dim('  Review the pairs above. Keep both if they are materially different; merge or deprecate one if they are duplicates.\n'));
  } else if (mode) {
    console.log(dim('  Security audit warnings are advisory only. Review suspicious dependencies, scripts, and external requests manually.\n'));
  } else if (!fix) {
    console.log(dim('\n  Run `aida doctor --fix` to normalize JSON truth sources and rebuild summary/index.\n'));
  } else {
    console.log('');
  }
}
