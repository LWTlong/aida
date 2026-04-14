import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { green, red, yellow } from '../../utils/display.js';
import { buildProjectArtifacts, readConfiguredTools, type AiToolChoice } from '../../utils/ai-build.js';
import { configPath } from '../../utils/paths.js';
import { fileExists } from '../../utils/fs.js';

function requestedTools(): string[] {
  return process.argv.slice(3);
}

async function selectTools(configured: AiToolChoice[]): Promise<string[]> {
  const requested = requestedTools();
  if (requested.length > 0) return requested;

  console.log('\n  Select AI tools to build (comma-separated numbers, Enter = all):\n');
  configured.forEach((tool, index) => {
    console.log(`    ${index + 1}) ${tool}`);
  });
  console.log('');

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question('  > ')).trim();
  rl.close();

  if (!answer) return configured;

  const indices = answer
    .split(',')
    .map((item) => parseInt(item.trim(), 10))
    .filter((num) => num >= 1 && num <= configured.length);

  const selected = [...new Set(indices.map((num) => configured[num - 1]))];
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
    `: ${result.ruleViews} rule views, ${result.skillViews} skill views, ${result.commandFiles} tool command files\n`,
  );

  if (result.tools.length > 0) {
    console.log(`  Targets: ${result.tools.join(', ')}`);
  }
  if (result.mcpFiles.length > 0) {
    console.log(`  MCP: ${result.mcpFiles.join(', ')}`);
  }
  if (result.tools.includes('codex')) {
    console.log('  Codex: global ~/.codex/config.toml has been updated for the aida MCP server');
  }
  console.log(`  Tool config snapshot: ${result.toolConfigSnapshot}`);
  if (result.gitignoreAdded.length > 0) {
    console.log(`  .gitignore: added ${result.gitignoreAdded.join(', ')}`);
  }
  console.log('');
}
