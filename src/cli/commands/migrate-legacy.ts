import { cyan, green, red, yellow } from '../../utils/display.js';
import { configPath } from '../../utils/paths.js';
import { fileExists } from '../../utils/fs.js';
import { buildProjectArtifacts, type AiToolChoice } from '../../utils/ai-build.js';
import { detectImportableTools, importProjectSources, importProjectSourcesWithBaseline } from '../../utils/import.js';
import { promptSingleSelect, type PromptOption } from '../../utils/prompt.js';
import { migrate } from './migrate.js';
import { migrateLegacyDirectory } from './migrate-dir.js';

function requestedBaseline(): AiToolChoice | null {
  const value = process.argv[3]?.trim();
  if (!value) return null;
  const valid = new Set<AiToolChoice>(['claude-code', 'cursor', 'vscode-copilot', 'windsurf', 'lingma', 'codex']);
  return valid.has(value as AiToolChoice) ? value as AiToolChoice : null;
}

function toolLabel(tool: AiToolChoice): string {
  const labels: Record<AiToolChoice, string> = {
    'claude-code': 'Claude Code',
    cursor: 'Cursor',
    'vscode-copilot': 'VS Code + Copilot',
    windsurf: 'Windsurf',
    lingma: 'Lingma',
    codex: 'Codex',
  };
  return labels[tool];
}

async function resolveBaselineTool(projectRoot: string): Promise<AiToolChoice | null> {
  const requested = requestedBaseline();
  const importable = detectImportableTools(projectRoot, ['claude-code', 'cursor', 'vscode-copilot', 'windsurf', 'lingma', 'codex']);

  if (requested) return requested;
  if (importable.length === 0) return null;
  if (importable.length === 1) return importable[0];

  const options: PromptOption<AiToolChoice>[] = importable.map((tool) => ({
    value: tool,
    label: toolLabel(tool),
    hint: 'Use this tool as the baseline source for rules/skills import',
  }));

  return promptSingleSelect('Choose one baseline AI tool to import legacy rules/skills from:', options);
}

export async function migrateLegacy(): Promise<void> {
  const projectRoot = process.cwd();

  console.log(cyan('\n  Legacy AIDA Project Migration\n'));

  const dirResult = migrateLegacyDirectory(projectRoot);
  if (dirResult.status === 'conflict') {
    console.log(red('  Cannot migrate: both .aidevos and .aida exist.\n'));
    console.log('  Resolve the duplicate directories first, then run `aida migrate-legacy` again.\n');
    return;
  }
  if (dirResult.status === 'missing-legacy' && !fileExists(configPath(projectRoot))) {
    console.log(yellow('  No .aidevos directory found and .aida is not initialized.\n'));
    return;
  }
  if (dirResult.status === 'migrated') {
    console.log(green('  ✓ Renamed') + ' .aidevos -> .aida');
    console.log(green('  ✓ Updated references') + ` ${dirResult.updatedFiles} text file(s)`);
  } else if (dirResult.status === 'already-current') {
    console.log(green('  ✓ Project already uses .aida'));
  }

  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDA config.json was not found after migration.\n'));
    return;
  }

  const baselineTool = await resolveBaselineTool(projectRoot);
  if (baselineTool) {
    const imported = importProjectSourcesWithBaseline(projectRoot, baselineTool);
    const built = buildProjectArtifacts(projectRoot, imported.tools);

    console.log(green('\n  ✓ Imported baseline') + ` ${toolLabel(baselineTool)}`);
    console.log(`    Rules: ${imported.baseline.rulesImported}`);
    console.log(`    Skills: ${imported.baseline.skillsImported}`);
    console.log(`    Tool configs discovered: ${imported.tools.join(', ') || '-'}`);
    console.log(`    Tool config snapshot: ${imported.snapshotPath}`);

    console.log(green('\n  ✓ Rebuilt artifacts') + ` ${built.tools.join(', ')}`);
    if (built.gitignoreAdded.length > 0) {
      console.log(`    .gitignore: added ${built.gitignoreAdded.join(', ')}`);
    }
  } else {
    const imported = importProjectSources(projectRoot);
    const built = buildProjectArtifacts(projectRoot, imported.tools);

    console.log(yellow('\n  No baseline tool detected. Imported structured AIDA sources only.'));
    console.log(`    Tool configs discovered: ${imported.tools.join(', ') || '-'}`);
    console.log(`    Tool config snapshot: ${imported.snapshotPath}`);

    console.log(green('\n  ✓ Rebuilt artifacts') + ` ${built.tools.join(', ')}`);
    if (built.gitignoreAdded.length > 0) {
      console.log(`    .gitignore: added ${built.gitignoreAdded.join(', ')}`);
    }
  }

  await migrate();

  console.log(green('  ✓ Legacy migration completed\n'));
}
