import { green, red, yellow } from '../../utils/display.js';
import { buildProjectArtifacts, readConfiguredTools } from '../../utils/ai-build.js';
import { configPath } from '../../utils/paths.js';
import { fileExists } from '../../utils/fs.js';
import { promptMultiSelect } from '../../utils/prompt.js';
import type { AiToolChoice } from '../../schemas/aida-project.js';

function requestedTools(): string[] {
  return process.argv.slice(3);
}

async function selectTools(configured: AiToolChoice[]): Promise<string[]> {
  const requested = requestedTools();
  if (requested.length > 0) return requested;
  const selected = await promptMultiSelect(
    'Select AI tools to build:',
    configured.map((tool) => ({ value: tool, label: tool })),
    { required: false },
  );
  return selected.length > 0 ? selected : configured;
}

export async function build(): Promise<void> {
  const projectRoot = process.cwd();

  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDA not initialized. Run `npx aida init` first.\n'));
    return;
  }

  const configured = readConfiguredTools(projectRoot);
  if (configured.length === 0) {
    console.log(yellow('\n  No AI tools configured in .aida/config.json.\n'));
    return;
  }

  const targets = await selectTools(configured);
  const result = buildProjectArtifacts(projectRoot, targets);

  console.log(
    green('\n  ✓ AIDA build completed') +
    `: ${result.ruleFiles} rule files, ${result.skillFiles} skill files, ${result.commandFiles} tool command files\n`,
  );

  if (result.tools.length > 0) {
    console.log(`  Targets: ${result.tools.join(', ')}`);
  }
  if (result.mcpFiles.length > 0) {
    console.log(`  MCP: ${result.mcpFiles.join(', ')}`);
  }
  console.log(`  Tool config snapshot: ${result.toolConfigSnapshot}`);
  if (result.gitignoreAdded.length > 0) {
    console.log(`  .gitignore: added ${result.gitignoreAdded.join(', ')}`);
  }
  console.log('');
}
