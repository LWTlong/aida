import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { green, red, yellow, cyan, dim } from '../../utils/display.js';
import { configPath } from '../../utils/paths.js';
import { fileExists, readText, ensureDir, writeText } from '../../utils/fs.js';
import {
  loadSkillRegistry,
  mergeSkillRegistry,
  skillsRegistryPath,
  bootstrapSkillRegistry,
  updateSkillContent,
} from '../../utils/skills.js';
import { buildProjectArtifacts, readConfiguredTools } from '../../utils/ai-build.js';
import { promptMultiSelect } from '../../utils/prompt.js';
import type { AiToolChoice } from '../../schemas/aida-project.js';

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
  const result = mergeSkillRegistry(projectRoot);
  if (result.status === 'error') {
    console.log(red('  Could not parse conflict markers. Please resolve manually.\n'));
    return;
  }
  if (result.status === 'merged') {
    buildProjectArtifacts(projectRoot, [], { skipMcpConfig: true });
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

// ─── Preset skills ──────────────────────────────────────────────────────────

/** Path templates for each supported AI tool. {name} is replaced with the skill name. */
const PRESET_TOOL_PATHS: Record<string, string> = {
  'claude-code': '.claude/commands/{name}.md',
  'cursor': '.cursor/skills/{name}/SKILL.md',
  'codex': '.codex/skills/{name}/SKILL.md',
};

const PRESET_TOOL_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code (.claude/commands/)',
  'cursor': 'Cursor (.cursor/skills/)',
  'codex': 'Codex (.codex/skills/)',
};

/** Resolve the directory that contains preset skill markdown files. */
function presetSkillsDir(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // dist/cli/commands/ → dist/assets/skills/
  return resolve(__dirname, '../../assets/skills');
}

interface PresetSkill {
  name: string
  content: string
}

function loadPresetSkills(): PresetSkill[] {
  const dir = presetSkillsDir();
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  return files.map((file) => ({
    name: file.replace(/\.md$/, ''),
    content: readText(resolve(dir, file)),
  }));
}

function resolvePresetPath(projectRoot: string, tool: string, skillName: string): string {
  const template = PRESET_TOOL_PATHS[tool];
  if (!template) throw new Error(`Unknown tool: ${tool}`);
  return resolve(projectRoot, template.replace('{name}', skillName));
}

async function resolveTargetTools(projectRoot: string): Promise<string[]> {
  // Check configured tools from config.json, but only those that have a preset path
  const configured = readConfiguredTools(projectRoot).filter((t) => PRESET_TOOL_PATHS[t]);
  if (configured.length > 0) return configured;

  // No config found — ask the user
  const options = Object.entries(PRESET_TOOL_LABELS).map(([value, label]) => ({ value, label }));
  const selected = await promptMultiSelect<string>(
    '\n  Which AI tools do you want to install preset skills into?',
    options,
    { required: true },
  );
  return selected;
}

async function skillsPreset(): Promise<void> {
  const projectRoot = process.cwd();
  const presets = loadPresetSkills();

  if (presets.length === 0) {
    console.log(red('\n  No preset skills found. Package may need a rebuild.\n'));
    return;
  }

  const tools = await resolveTargetTools(projectRoot);
  if (tools.length === 0) {
    console.log(yellow('\n  No tools selected. Nothing to install.\n'));
    return;
  }

  console.log('');
  let installed = 0;
  let skipped = 0;

  for (const tool of tools) {
    for (const skill of presets) {
      const destPath = resolvePresetPath(projectRoot, tool, skill.name);
      if (fileExists(destPath)) {
        console.log(dim(`  ~ Skipped (already exists): ${destPath.replace(projectRoot + '/', '')}`));
        skipped++;
        continue;
      }
      ensureDir(resolve(destPath, '..'));
      writeText(destPath, skill.content);
      console.log(green(`  ✓ Installed`) + `: ${destPath.replace(projectRoot + '/', '')}`);
      installed++;
    }
  }

  console.log('');
  if (installed > 0) {
    console.log(green(`  ${installed} skill(s) installed`) + (skipped > 0 ? dim(`, ${skipped} skipped (already exist — use \`aida skills update\` to overwrite)`) : '') + '\n');
  } else {
    console.log(yellow(`  All preset skills already installed.`) + dim(' Use `aida skills update` to overwrite with latest version.\n'));
  }
}

async function skillsUpdate(): Promise<void> {
  const projectRoot = process.cwd();
  const presets = loadPresetSkills();

  if (presets.length === 0) {
    console.log(red('\n  No preset skills found. Package may need a rebuild.\n'));
    return;
  }

  const tools = await resolveTargetTools(projectRoot);
  if (tools.length === 0) {
    console.log(yellow('\n  No tools selected. Nothing to update.\n'));
    return;
  }

  console.log('');
  let updated = 0;
  let fresh = 0;

  for (const tool of tools) {
    for (const skill of presets) {
      const destPath = resolvePresetPath(projectRoot, tool, skill.name);
      const isNew = !fileExists(destPath);
      ensureDir(resolve(destPath, '..'));
      writeText(destPath, skill.content);
      if (isNew) {
        console.log(green(`  ✓ Installed`) + `: ${destPath.replace(projectRoot + '/', '')}`);
        fresh++;
      } else {
        console.log(green(`  ✓ Updated`) + `: ${destPath.replace(projectRoot + '/', '')}`);
        updated++;
      }
    }
  }

  console.log('');
  console.log(green(`  ${updated + fresh} skill(s) written`) + dim(` (${updated} updated, ${fresh} new)\n`));
}

// ─── Main export ────────────────────────────────────────────────────────────

export async function skills(): Promise<void> {
  const projectRoot = process.cwd();
  const sub = subcommand();

  // preset and update don't require AIDA to be initialized
  if (sub === 'preset') return skillsPreset();
  if (sub === 'update') return skillsUpdate();

  if (!fileExists(configPath(projectRoot))) {
    console.log(red('\n  AIDA not initialized. Run `npx aida init` first.\n'));
    return;
  }

  switch (sub) {
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
    preset    Install preset skills into AI tool directories
    update    Update installed preset skills to the latest version

  The source of truth is .aida/skills.json (committed to git).
  aida sync distributes generated skill files into each configured AI tool directory.
`);
  }
}
