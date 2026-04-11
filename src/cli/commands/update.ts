import { resolve } from 'node:path';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { SKILLS_DIR } from '../../utils/paths.js';
import {
  ensureDir,
  writeText,
  readText,
  fileExists,
} from '../../utils/fs.js';
import { bold, green, cyan, dim, yellow } from '../../utils/display.js';
import { updateGuide, updateGuideReferences } from '../../utils/guide.js';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const ALL_SKILLS = [
  'workflow-orchestrator',
  'requirement-analyzer',
  'task-splitter',
  'code-generator',
  'self-reviewer',
  'bug-fixer',
  'deviation-recorder',
  'dashboard-generator',
  'commit-code',
  'docx-to-markdown',
  'mcp-reviewer',
  'rules-evolver',
  'dev-flower',
  'audit',
];

const QUICK_COMMANDS: { name: string; skill: string }[] = [
  { name: 'workflow', skill: 'workflow-orchestrator' },
  { name: 'audit', skill: 'audit' },
  { name: 'deviation', skill: 'deviation-recorder' },
  { name: 'self-reviewer', skill: 'self-reviewer' },
  { name: 'bug-fixer', skill: 'bug-fixer' },
  { name: 'rules-evolver', skill: 'rules-evolver' },
];

interface Config {
  schemaVersion: string;
  aiTool: 'claude-code' | 'cursor';
  project: string;
  aiModel?: string;
}

export async function update(): Promise<void> {
  const projectRoot = process.cwd();
  const aidevos = resolve(projectRoot, '.aidevos');
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

  // Detect which skills/commands exist
  const skillsDir = resolve(aidevos, 'skills');
  const existingSkills: string[] = [];
  if (existsSync(skillsDir)) {
    existingSkills.push(...readdirSync(skillsDir).filter((f) =>
      statSync(resolve(skillsDir, f)).isDirectory()
    ));
  }

  const existingCommands: string[] = [];
  if (tool === 'claude-code') {
    const cmdDir = resolve(projectRoot, '.claude', 'commands');
    if (existsSync(cmdDir)) {
      existingCommands.push(...readdirSync(cmdDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace('.md', '')));
    }
  } else {
    const skillsDir = resolve(projectRoot, '.cursor', 'skills');
    if (existsSync(skillsDir)) {
      existingCommands.push(...readdirSync(skillsDir).filter((f) =>
        statSync(resolve(skillsDir, f)).isDirectory()
      ));
    }
  }

  console.log(`  Found ${existingSkills.length} skills in .aidevos/skills/`);
  console.log(`  Found ${existingCommands.length} quick commands in ${tool === 'claude-code' ? '.claude/commands/' : '.cursor/skills/'}`);
  console.log('');

  // Ask confirmation
  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log('  This will update all skills to the latest version.');
  console.log(dim('  Old versions will be backed up to .aidevos/skills-backup/\n'));
  const answer = (await rl.question('  Continue? (y/N) > ')).trim().toLowerCase();
  rl.close();

  if (answer !== 'y' && answer !== 'yes') {
    console.log(yellow('\n  Update cancelled.\n'));
    return;
  }

  console.log('');

  // Backup existing skills
  if (existingSkills.length > 0) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupDir = resolve(aidevos, `skills-backup-${timestamp}`);
    ensureDir(backupDir);

    for (const skill of existingSkills) {
      const src = resolve(skillsDir, skill);
      const dest = resolve(backupDir, skill);
      if (existsSync(resolve(src, 'SKILL.md'))) {
        ensureDir(dest);
        writeText(resolve(dest, 'SKILL.md'), readText(resolve(src, 'SKILL.md')));
      }
    }
    console.log(green('  ✓ Backed up') + ` old skills to skills-backup-${timestamp}/`);
  }

  // Update all skills to .aidevos/skills/
  let updatedCount = 0;
  for (const skill of ALL_SKILLS) {
    const src = resolve(SKILLS_DIR, `${skill}.md`);
    const destDir = resolve(aidevos, 'skills', skill);
    const destFile = resolve(destDir, 'SKILL.md');

    if (fileExists(src)) {
      ensureDir(destDir);
      writeText(destFile, readText(src));
      updatedCount++;
    }
  }
  console.log(green('  ✓ Updated') + ` ${updatedCount} skills in .aidevos/skills/`);

  // Update quick commands
  let commandsUpdated = 0;
  if (tool === 'claude-code') {
    const cmdDir = resolve(projectRoot, '.claude', 'commands');
    ensureDir(cmdDir);

    for (const cmd of QUICK_COMMANDS) {
      const src = resolve(SKILLS_DIR, `${cmd.skill}.md`);
      const dest = resolve(cmdDir, `${cmd.name}.md`);
      if (fileExists(src)) {
        writeText(dest, readText(src));
        commandsUpdated++;
      }
    }
    console.log(green('  ✓ Updated') + ` ${commandsUpdated} commands in .claude/commands/`);
  } else {
    for (const cmd of QUICK_COMMANDS) {
      const src = resolve(SKILLS_DIR, `${cmd.skill}.md`);
      const destDir = resolve(projectRoot, '.cursor', 'skills', cmd.name);
      const destFile = resolve(destDir, 'SKILL.md');
      if (fileExists(src)) {
        ensureDir(destDir);
        writeText(destFile, readText(src));
        commandsUpdated++;
      }
    }
    console.log(green('  ✓ Updated') + ` ${commandsUpdated} commands in .cursor/skills/`);
  }

  // Update guide and AI tool rule files
  updateGuide(projectRoot);
  updateGuideReferences(projectRoot);
  console.log(green('  ✓ Updated') + ' .aidevos/aida-guide.md and AI tool rule files');

  // Ensure .gitignore has required entries
  const gitignorePath = resolve(projectRoot, '.gitignore');
  const gitignoreEntries = ['.aidevos/rules/*.md', '.aidevos/index.json'];
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
