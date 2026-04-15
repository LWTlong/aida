import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { green, red, yellow, cyan, dim } from '../../utils/display.js';
import { configPath } from '../../utils/paths.js';
import { extractConflictSections, fileExists, readText, parseConflictJsonArray, ensureDir, writeText } from '../../utils/fs.js';
import {
  loadSkillRegistry,
  mergeSkillRegistries,
  saveSkillRegistry,
  skillsRegistryPath,
  bootstrapSkillRegistry,
  type SkillRegistryEntry,
  updateSkillContent,
} from '../../utils/skills.js';
import { buildProjectArtifacts } from '../../utils/ai-build.js';

function subcommand(): string {
  return process.argv[3] || '';
}

function commandArgs(): string[] {
  return process.argv.slice(4);
}

function hasFlag(flag: string): boolean {
  return commandArgs().includes(flag);
}

function editBufferPath(projectRoot: string, skillName: string): string {
  return resolve(projectRoot, '.aida', '.edit', 'skills', `${skillName}.md`);
}

async function skillsBuild(): Promise<void> {
  const projectRoot = process.cwd();
  bootstrapSkillRegistry(projectRoot);
  const result = buildProjectArtifacts(projectRoot);
  const entries = loadSkillRegistry(projectRoot);
  console.log(
    green('\n  ✓ Skills rebuilt') +
    `: ${entries.length} skills → ${result.skillFiles} generated tool skill files\n`,
  );
}

export async function mergeSkillsRegistry(projectRoot: string): Promise<{ status: 'merged' | 'no-conflict' | 'missing' | 'error'; added?: number; total?: number }> {
  const regPath = skillsRegistryPath(projectRoot);

  if (!fileExists(regPath)) {
    return { status: 'missing' };
  }

  const raw = readText(regPath);
  if (!raw.includes('<<<<<<<') && !raw.includes('>>>>>>>')) {
    return { status: 'no-conflict' };
  }

  const sections = extractConflictSections(raw);
  if (!sections) {
    return { status: 'error' };
  }

  const ours = parseConflictJsonArray<SkillRegistryEntry>(sections.ours);
  const theirs = parseConflictJsonArray<SkillRegistryEntry>(sections.theirs);
  const { merged, added } = mergeSkillRegistries(ours, theirs);
  saveSkillRegistry(projectRoot, merged);

  return { status: 'merged', added, total: merged.length };
}

async function skillsMerge(): Promise<void> {
  const projectRoot = process.cwd();
  const regPath = skillsRegistryPath(projectRoot);

  if (!fileExists(regPath)) {
    console.log(yellow('\n  No skills.json found.\n'));
    return;
  }

  const raw = readText(regPath);
  if (!raw.includes('<<<<<<<') && !raw.includes('>>>>>>>')) {
    console.log(green('\n  ✓ No merge conflicts detected in skills.json.\n'));
    return;
  }

  console.log(yellow('\n  Merge conflict detected in skills.json. Resolving...\n'));
  const result = await mergeSkillsRegistry(projectRoot);
  if (result.status === 'error') {
    console.log(red('  Could not parse conflict markers. Please resolve manually.\n'));
    return;
  }
  if (result.status === 'merged') {
    buildProjectArtifacts(projectRoot);
    console.log(
      green('  ✓ Merged successfully') +
      `: ${result.total} total skills (${result.added} new from incoming branch)\n`,
    );
  }
}

async function skillsList(): Promise<void> {
  const projectRoot = process.cwd();
  const entries = bootstrapSkillRegistry(projectRoot);

  if (entries.length === 0) {
    if (hasFlag('--json')) {
      console.log('[]');
      return;
    }
    console.log(yellow('\n  No skills in registry.\n'));
    return;
  }

  if (hasFlag('--json')) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  console.log(`\n  ${entries.length} skills in registry:\n`);
  for (const entry of entries) {
    const status = entry.status !== 'active' ? ` [${entry.status}]` : '';
    console.log(`  ${cyan(entry.id)}${status} ${entry.name} ${dim(`(${entry.source.kind})`)}`);
  }
  console.log('');
}

async function skillsEdit(): Promise<void> {
  const projectRoot = process.cwd();
  const args = commandArgs();
  const skillName = args[0];
  const apply = args.includes('--apply');
  const fromFileIndex = args.findIndex((arg) => arg === '--from-file');
  const fromFile = fromFileIndex >= 0 ? args[fromFileIndex + 1] : undefined;

  if (!skillName) {
    console.log(red('\n  Usage: aida skills edit <skill-name> [--apply] [--from-file <path>]\n'));
    return;
  }

  const entries = bootstrapSkillRegistry(projectRoot);
  const entry = entries.find((item) => item.name === skillName);
  if (!entry) {
    console.log(red(`\n  Skill not found: ${skillName}\n`));
    return;
  }

  const bufferPath = editBufferPath(projectRoot, skillName);
  ensureDir(resolve(projectRoot, '.aida', '.edit', 'skills'));

  if (apply || fromFile) {
    const sourcePath = fromFile || bufferPath;
    if (!fileExists(sourcePath)) {
      console.log(red(`\n  Edit buffer not found: ${sourcePath}\n`));
      console.log(dim(`  Create the file first, then run: aida skills edit ${skillName} --from-file ${sourcePath}\n`));
      return;
    }

    const content = readText(sourcePath);
    updateSkillContent(projectRoot, skillName, content);
    buildProjectArtifacts(projectRoot);
    console.log(green(`\n  ✓ Skill updated`) + `: ${skillName}`);
    console.log(dim('  skills.json has been updated and targets rebuilt.\n'));
    return;
  }

  writeText(bufferPath, entry.content);

  const editor = process.env.EDITOR;
  if (!editor) {
    console.log(yellow('\n  EDITOR is not set.\n'));
    console.log(`  Edit file: ${bufferPath}`);
    console.log(`  Then run: aida skills edit ${skillName} --apply`);
    console.log(`  Or run:  aida skills edit ${skillName} --from-file <path>\n`);
    return;
  }

  const result = spawnSync(editor, [bufferPath], {
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    console.log(red(`\n  Editor exited with code ${result.status ?? 1}\n`));
    return;
  }

  const content = readText(bufferPath);
  updateSkillContent(projectRoot, skillName, content);
  buildProjectArtifacts(projectRoot);
  console.log(green(`\n  ✓ Skill updated`) + `: ${skillName}`);
  console.log(dim('  skills.json has been updated and targets rebuilt.\n'));
}

export async function skills(): Promise<void> {
  const projectRoot = process.cwd();
  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDA not initialized. Run `npx aida init` first.\n'));
    return;
  }

  switch (subcommand()) {
    case 'build':
      return skillsBuild();
    case 'merge':
      return skillsMerge();
    case 'edit':
      return skillsEdit();
    case 'list':
    case 'ls':
      return skillsList();
    default:
      console.log(`
  ${cyan('aida skills')} - Manage project skills registry

  Subcommands:
    build     Rebuild AI tool skill files from skills.json
    edit      Edit one skill and save back to skills.json
    merge     Auto-resolve git merge conflicts in skills.json
    list      List all skills in the registry (--json supported)

  The source of truth is .aida/skills.json (committed to git).
  aida build distributes generated skill files into each configured AI tool directory.
`);
  }
}
