import { green, red, yellow } from '../../utils/display.js';
import { configPath } from '../../utils/paths.js';
import { fileExists } from '../../utils/fs.js';
import { importProjectSources, importProjectSourcesWithBaseline } from '../../utils/import.js';
import { buildProjectArtifacts } from '../../utils/ai-build.js';
import type { AiToolChoice } from '../../schemas/aida-project.js';

function requestedBaseline(): AiToolChoice | null | 'invalid' {
  const value = process.argv[3]?.trim();
  if (!value) return null;
  if (['claude-code', 'cursor', 'vscode-copilot', 'windsurf', 'lingma', 'codex'].includes(value)) {
    return value as AiToolChoice;
  }
  return 'invalid';
}

function importOptions(): { includeExternalSkills: boolean; includeExternalMcp: boolean } {
  const args = process.argv.slice(3);
  return {
    includeExternalSkills: !args.includes('--skip-external-skills'),
    includeExternalMcp: !args.includes('--skip-external-mcp'),
  };
}

export async function importSources(): Promise<void> {
  const projectRoot = process.cwd();

  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDA not initialized. Run `npx aida init` first.\n'));
    return;
  }

  const baseline = requestedBaseline();
  const options = importOptions();
  if (baseline === 'invalid') {
    console.log(red(`\n  Unknown baseline tool: ${process.argv[3]?.trim()}\n`));
    return;
  }
  if (baseline) {
    const imported = importProjectSourcesWithBaseline(projectRoot, baseline, options);
    const result = buildProjectArtifacts(projectRoot, imported.tools);

    console.log(
      green('\n  ✓ Existing project sources imported') +
      `: ${imported.rulesImported} rules, ${imported.skillsImported} skills\n`,
    );
    console.log(`  Baseline: ${baseline}`);
    console.log(`  Baseline imported: ${imported.baseline.rulesImported} rules, ${imported.baseline.skillsImported} skills`);
    if (imported.tools.length === 0) {
      console.log(yellow('  No existing AI tool configs were discovered.\n'));
      return;
    }

    console.log(`  Tools: ${imported.tools.join(', ')}`);
    console.log(`  Tool config snapshot: ${imported.snapshotPath}`);
    console.log(
      `  Rebuilt: ${result.ruleFiles} rule files, ${result.skillFiles} skill files, ${result.commandFiles} tool command files`,
    );
    if (imported.gitignoreAdded.length > 0) {
      console.log(`  .gitignore: added ${imported.gitignoreAdded.join(', ')}`);
    }
    console.log('');
    return;
  }

  const imported = importProjectSources(projectRoot, options);
  const result = buildProjectArtifacts(projectRoot, imported.tools);

  console.log(
    green('\n  ✓ Existing project sources imported') +
    `: ${imported.rulesImported} rules, ${imported.skillsImported} skills\n`,
  );

  if (imported.tools.length === 0) {
    console.log(yellow('  No existing AI tool configs were discovered.\n'));
    return;
  }

  console.log(`  Tools: ${imported.tools.join(', ')}`);
  console.log(`  Tool config snapshot: ${imported.snapshotPath}`);
  console.log(
    `  Rebuilt: ${result.ruleFiles} rule files, ${result.skillFiles} skill files, ${result.commandFiles} tool command files`,
  );
  if (imported.gitignoreAdded.length > 0) {
    console.log(`  .gitignore: added ${imported.gitignoreAdded.join(', ')}`);
  }
  console.log('');
}
