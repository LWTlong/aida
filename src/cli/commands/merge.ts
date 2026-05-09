import { green, red, yellow } from '../../utils/display.js';
import { configPath } from '../../utils/paths.js';
import { fileExists } from '../../utils/fs.js';
import { buildProjectArtifacts } from '../../utils/ai-build.js';
import { mergeRulesRegistry } from './rules.js';
import { mergeSkillsRegistry } from './skills.js';
import { mergeAidaJsonData } from './merge-data.js';

function printDataLine(lines: string[], label: string, result: { status: string; merged: number }): void {
  if (result.status === 'merged') {
    lines.push(`  ${label}: merged, ${result.merged} file(s)`);
  } else if (result.status === 'no-conflict') {
    lines.push(`  ${label}: no conflict`);
  } else if (result.status === 'missing') {
    lines.push(`  ${label}: missing`);
  }
}

export async function merge(): Promise<void> {
  const projectRoot = process.cwd();

  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDA not initialized. Run `npx aida init` first.\n'));
    return;
  }

  const rules = await mergeRulesRegistry(projectRoot);
  const skills = await mergeSkillsRegistry(projectRoot);
  const data = mergeAidaJsonData(projectRoot);

  const dataHasError = [
    data.memoryIndex,
    data.moduleMemories,
    data.contexts,
    data.requirements,
    data.runs,
  ].some((item) => item.status === 'error');

  if (rules.status === 'error' || skills.status === 'error' || dataHasError) {
    console.log(red('\n  Merge finished with parse errors. Resolve the remaining conflicted file manually.\n'));
    return;
  }

  const lines: string[] = [];

  if (rules.status === 'merged') {
    lines.push(`  rules.json: merged, ${rules.total} total (${rules.added} new)`);
  } else if (rules.status === 'no-conflict') {
    lines.push('  rules.json: no conflict');
  } else if (rules.status === 'missing') {
    lines.push('  rules.json: missing');
  }

  if (skills.status === 'merged') {
    lines.push(`  skills.json: merged, ${skills.total} total (${skills.added} new)`);
  } else if (skills.status === 'no-conflict') {
    lines.push('  skills.json: no conflict');
  } else if (skills.status === 'missing') {
    lines.push('  skills.json: missing');
  }

  printDataLine(lines, 'memory index', data.memoryIndex);
  printDataLine(lines, 'module memories', data.moduleMemories);
  printDataLine(lines, 'branch contexts', data.contexts);
  printDataLine(lines, 'requirements', data.requirements);
  printDataLine(lines, 'run.json', data.runs);

  const changed = rules.status === 'merged'
    || skills.status === 'merged'
    || data.memoryIndex.status === 'merged'
    || data.moduleMemories.status === 'merged'
    || data.contexts.status === 'merged'
    || data.requirements.status === 'merged'
    || data.runs.status === 'merged';
  if (!changed) {
    console.log(yellow('\n  No AIDA conflicts detected.\n'));
    return;
  }

  if (rules.status === 'merged' || skills.status === 'merged') {
    buildProjectArtifacts(projectRoot, [], { skipMcpConfig: true });
  }

  console.log(green('\n  ✓ AIDA merge completed\n'));
  for (const line of lines) console.log(line);
  console.log('');
}
