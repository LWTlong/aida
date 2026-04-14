import { green, red, yellow } from '../../utils/display.js';
import { configPath } from '../../utils/paths.js';
import { fileExists } from '../../utils/fs.js';
import { importProjectSources } from '../../utils/import.js';
import { buildProjectArtifacts } from '../../utils/ai-build.js';

export async function importSources(): Promise<void> {
  const projectRoot = process.cwd();

  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDA not initialized. Run `npx aida init` first.\n'));
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
