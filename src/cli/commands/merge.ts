import { green, red, yellow } from '../../utils/display.js';
import { configPath } from '../../utils/paths.js';
import { fileExists } from '../../utils/fs.js';
import { mergeRulesRegistry } from './rules.js';
import { mergeSkillsRegistry } from './skills.js';

export async function merge(): Promise<void> {
  const projectRoot = process.cwd();

  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDA not initialized. Run `npx aida init` first.\n'));
    return;
  }

  const rules = await mergeRulesRegistry(projectRoot);
  const skills = await mergeSkillsRegistry(projectRoot);

  if (rules.status === 'error' || skills.status === 'error') {
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

  const changed = rules.status === 'merged' || skills.status === 'merged';
  if (!changed) {
    console.log(yellow('\n  No registry conflicts detected.\n'));
    return;
  }

  console.log(green('\n  ✓ Registry merge completed\n'));
  for (const line of lines) console.log(line);
  console.log('');
}
