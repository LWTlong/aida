import { green, red, yellow } from '../../utils/display.js';
import { configPath } from '../../utils/paths.js';
import { fileExists } from '../../utils/fs.js';
import { importProjectSources, importProjectSourcesWithBaseline } from '../../utils/import.js';
import { buildProjectArtifacts, type AiToolChoice } from '../../utils/ai-build.js';

function requestedBaseline(): AiToolChoice | null | 'invalid' {
  const value = process.argv[3]?.trim();
  if (!value) return null;
  if (['claude-code', 'cursor', 'vscode-copilot', 'windsurf', 'lingma', 'codex'].includes(value)) {
    return value as AiToolChoice;
  }
  return 'invalid';
}

export async function importSources(): Promise<void> {
  const projectRoot = process.cwd();

  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDA not initialized. Run `npx aida init` first.\n'));
    return;
  }

  const baseline = requestedBaseline();
  if (baseline === 'invalid') {
    console.log(red(`\n  Unknown baseline tool: ${process.argv[3]?.trim()}\n`));
    return;
  }
  if (baseline) {
    const imported = importProjectSourcesWithBaseline(projectRoot, baseline);
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
      `  Rebuilt: ${result.ruleViews} rule views, ${result.skillViews} skill views, ${result.commandFiles} tool command files`,
    );
    if (imported.gitignoreAdded.length > 0) {
      console.log(`  .gitignore: added ${imported.gitignoreAdded.join(', ')}`);
    }
    console.log('');
    return;
  }

  const imported = importProjectSources(projectRoot);
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
    `  Rebuilt: ${result.ruleViews} rule views, ${result.skillViews} skill views, ${result.commandFiles} tool command files`,
  );
  if (imported.gitignoreAdded.length > 0) {
    console.log(`  .gitignore: added ${imported.gitignoreAdded.join(', ')}`);
  }
  console.log('');
}
