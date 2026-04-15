import { resolve } from 'node:path';
import {
  writeText,
  readText,
  fileExists,
} from '../../utils/fs.js';
import { bold, green, cyan, dim, yellow } from '../../utils/display.js';
import { updateGuide, updateGuideReferences } from '../../utils/guide.js';
import { loadSkillRegistry, seedBundledSkillRegistry } from '../../utils/skills.js';
import { buildProjectArtifacts, readConfiguredTools } from '../../utils/ai-build.js';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

interface Config {
  schemaVersion: string;
  aiTool: 'claude-code' | 'cursor';
  project: string;
  aiModel?: string;
  aiTools?: ('claude-code' | 'cursor' | 'vscode-copilot' | 'windsurf' | 'lingma' | 'codex')[];
}

export async function update(): Promise<void> {
  const projectRoot = process.cwd();
  const aidevos = resolve(projectRoot, '.aida');
  const configPath = resolve(aidevos, 'config.json');

  console.log(`\n  ${bold('AIDA')} - Update Skills\n`);

  // Check if initialized
  if (!fileExists(configPath)) {
    console.log(
      yellow('  AIDevOS is not initialized in this project.'),
    );
    console.log(
      dim('  Run `aida init` first.\n'),
    );
    return;
  }

  // Read config
  const config: Config = JSON.parse(readText(configPath));
  const tool = config.aiTool;

  console.log(`  Project: ${cyan(config.project)}`);
  console.log(`  AI Tool: ${cyan(tool)}`);
  console.log('');

  const existingSkills = loadSkillRegistry(projectRoot);

  console.log(`  Found ${existingSkills.length} skills in .aida/skills.json`);
  console.log('');

  // Ask confirmation
  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log('  This will replace skills.json with the latest bundled skill set and rebuild local AI tool artifacts.');
  console.log(dim('  Old skills.json will be backed up to .aida/skills-backup-*.json\n'));
  const answer = (await rl.question('  Continue? (y/N) > ')).trim().toLowerCase();
  rl.close();

  if (answer !== 'y' && answer !== 'yes') {
    console.log(yellow('\n  Update cancelled.\n'));
    return;
  }

  console.log('');

  // Backup existing skills.json
  if (existingSkills.length > 0) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupPath = resolve(aidevos, `skills-backup-${timestamp}.json`);
    writeText(backupPath, JSON.stringify(existingSkills, null, 2) + '\n');
    console.log(green('  ✓ Backed up') + ` current skills.json to ${backupPath.replace(`${projectRoot}/`, '')}`);
  }

  const seeded = seedBundledSkillRegistry(projectRoot);
  console.log(green('  ✓ Updated') + ` ${seeded.length} bundled skills in .aida/skills.json`);

  // Update guide and AI tool rule files
  updateGuide(projectRoot);
  updateGuideReferences(projectRoot);
  console.log(green('  ✓ Updated') + ' .aida/aida-guide.md and AI tool rule files');

  const tools = readConfiguredTools(projectRoot);
  if (tools.length > 0) {
    const built = buildProjectArtifacts(projectRoot, tools);
    console.log(green('  ✓ Rebuilt') + ` ${built.ruleFiles} rule files, ${built.skillFiles} skill files, ${built.commandFiles} tool command files`);
  }

  // Ensure .gitignore has required entries
  const gitignorePath = resolve(projectRoot, '.gitignore');
  const gitignoreEntries = ['.aida/index.json', '.aida/tool-configs.json'];
  const gitignoreExisting = fileExists(gitignorePath) ? readText(gitignorePath) : '';
  const toAdd = gitignoreEntries.filter((e) => !gitignoreExisting.includes(e));
  if (toAdd.length > 0) {
    writeText(
      gitignorePath,
      gitignoreExisting.trimEnd() + '\n\n# AIDA - auto-generated files\n' + toAdd.join('\n') + '\n',
    );
    console.log(green('  ✓ Updated') + ` .gitignore (added ${toAdd.join(', ')})`);
  }

  console.log(`
  ${green('✓ Done!')} All skills have been updated to the latest version.

  ${dim('Note: If you have customized any skills, check the backup directory.')}
`);
}
