import { readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { ensureDir, fileExists, readJson, readText, writeJson } from './fs.js';
import { configPath, toolConfigStorePath } from './paths.js';
import { QUICK_COMMANDS, ensureBuildGitignore } from './ai-build.js';
import { importRulesFromViews, loadRegistry, saveRegistry, fingerprint, nextRuleId } from './rules.js';
import { importSkillsFromViews, isBundledSkillName, loadSkillRegistry, saveSkillRegistry, skillFingerprint, nextSkillId, type SkillCompanionFile, type SkillRegistryEntry } from './skills.js';
import type { AidaConfig, AiToolChoice, ToolConfigSnapshot } from '../schemas/aida-project.js';

interface ImportOptions {
  includeExternalSkills?: boolean
  includeExternalMcp?: boolean
}

export const CLOSED_LOOP_BASELINE_TOOLS: AiToolChoice[] = ['claude-code', 'cursor', 'codex'];

const GENERATED_CURSOR_RULE_SEGMENTS = new Set(['aida', 'aidevos']);
const GENERATED_RULE_FILENAMES = new Set(['aida-guide.md', 'iron-rules.md']);
const GENERATED_RULE_MARKERS = [
  'AUTO-GENERATED from rules.json',
  'AIDA 数据采集与规则沉淀指南',
  'AIDevOS Iron Rules',
];
const QUICK_COMMAND_NAME_TO_SKILL = new Map(QUICK_COMMANDS.map((cmd) => [cmd.name, cmd.skill]));

const TOOL_SOURCES: Array<{
  tool: AiToolChoice
  path: (projectRoot: string) => string
  format: 'json' | 'toml' | 'text'
}> = [
  { tool: 'claude-code', path: (projectRoot) => resolve(projectRoot, '.mcp.json'), format: 'json' },
  { tool: 'cursor', path: (projectRoot) => resolve(projectRoot, '.cursor', 'mcp.json'), format: 'json' },
  { tool: 'vscode-copilot', path: (projectRoot) => resolve(projectRoot, '.vscode', 'mcp.json'), format: 'json' },
  { tool: 'lingma', path: (projectRoot) => resolve(projectRoot, '.lingma', 'mcp.json'), format: 'json' },
  { tool: 'codex', path: (projectRoot) => resolve(projectRoot, '.codex', 'config.toml'), format: 'toml' },
];

function toolConfigSnapshotPath(projectRoot: string): string {
  return toolConfigStorePath(projectRoot);
}

function walkMarkdownFiles(rootDir: string): string[] {
  if (!fileExists(rootDir)) return [];
  const result: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of readdirSync(current)) {
      const full = resolve(current, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        stack.push(full);
      } else if (name.endsWith('.md')) {
        result.push(full);
      }
    }
  }

  return result.sort();
}

function walkFiles(rootDir: string): string[] {
  if (!fileExists(rootDir)) return [];
  const result: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of readdirSync(current)) {
      const full = resolve(current, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        stack.push(full);
      } else {
        result.push(full);
      }
    }
  }

  return result.sort();
}

function isSupportedSkillAsset(path: string): boolean {
  const lowered = path.toLowerCase();
  return lowered.endsWith('.md')
    || lowered.endsWith('.txt')
    || lowered.endsWith('.py')
    || lowered.endsWith('.sh')
    || lowered.endsWith('.js')
    || lowered.endsWith('.ts')
    || lowered.endsWith('.cjs')
    || lowered.endsWith('.mjs')
    || lowered.endsWith('.json')
    || lowered.endsWith('.yaml')
    || lowered.endsWith('.yml')
    || lowered.endsWith('.toml');
}

function collectImportedSkillPackage(
  skillDir: string,
): { content: string; files: SkillCompanionFile[] } | null {
  const mainFile = resolve(skillDir, 'SKILL.md');
  if (!fileExists(mainFile)) return null;

  const files: SkillCompanionFile[] = [];
  for (const file of walkFiles(skillDir)) {
    if (file === mainFile) continue;
    const relPath = relative(skillDir, file).replace(/\\/g, '/');
    if (!isSupportedSkillAsset(relPath)) continue;
    files.push({ path: relPath, content: readText(file) });
  }

  return {
    content: readText(mainFile),
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

function collectToolSkills(
  projectRoot: string,
  rootDir: string,
): Array<{ name: string; content: string; files?: SkillCompanionFile[]; sourcePath: string }> {
  if (!fileExists(rootDir)) return [];

  const collected: Array<{ name: string; content: string; files?: SkillCompanionFile[]; sourcePath: string }> = [];
  const namesWithPackages = new Set<string>();

  for (const name of readdirSync(rootDir).sort()) {
    const fullPath = resolve(rootDir, name);
    const stat = statSync(fullPath);
    if (!stat.isDirectory()) continue;
    const pkg = collectImportedSkillPackage(fullPath);
    if (!pkg) continue;
    namesWithPackages.add(name);
    collected.push({
      name: normalizeImportedSkillName(name),
      content: pkg.content,
      files: pkg.files,
      sourcePath: resolve(fullPath, 'SKILL.md').replace(`${projectRoot}/`, ''),
    });
  }

  for (const file of readdirSync(rootDir).sort()) {
    const fullPath = resolve(rootDir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory() || !file.endsWith('.md')) continue;
    const name = file.replace(/\.md$/, '');
    if (namesWithPackages.has(name)) continue;
    collected.push({
      name: normalizeImportedSkillName(name),
      content: readText(fullPath),
      files: [],
      sourcePath: fullPath.replace(`${projectRoot}/`, ''),
    });
  }

  return collected;
}

function parseMarkdownRuleCandidates(raw: string): string[] {
  const results: string[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```') || trimmed.startsWith('>')) continue;

    const generatedMatch = trimmed.match(/^-\s+\[(?:RULE-\d+)\](?:\s+\[[A-Z]+\])?\s+(.+)$/);
    if (generatedMatch) {
      results.push(generatedMatch[1].trim());
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      results.push(bulletMatch[1].trim());
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      results.push(orderedMatch[1].trim());
    }
  }

  return results.filter((item) => item.length > 0);
}

function isGeneratedRuleFile(filePath: string, raw: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const name = normalized.split('/').pop() || '';
  const segments = normalized.split('/');

  if (GENERATED_RULE_FILENAMES.has(name)) return true;
  if (segments.some((segment) => GENERATED_CURSOR_RULE_SEGMENTS.has(segment))) {
    if (GENERATED_RULE_MARKERS.some((marker) => raw.includes(marker))) return true;
  }
  return GENERATED_RULE_MARKERS.some((marker) => raw.includes(marker));
}

function normalizeImportedSkillName(originalName: string): string {
  return QUICK_COMMAND_NAME_TO_SKILL.get(originalName) || originalName;
}

function mergeImportedRules(
  projectRoot: string,
  contents: string[],
  tool: AiToolChoice,
): { total: number; imported: number } {
  const existing = loadRegistry(projectRoot);
  const byFingerprint = new Set(existing.map((entry) => entry.fingerprint));
  const merged = [...existing];
  let imported = 0;

  for (const content of contents) {
    const fp = fingerprint(content);
    if (byFingerprint.has(fp)) continue;
    merged.push({
      id: nextRuleId(merged),
      category: 'general',
      content,
      fingerprint: fp,
      source: {
        branch: `import:${tool}`,
        deviation: null,
        author: 'import',
      },
      createdAt: new Date().toISOString(),
      status: 'active',
    });
    byFingerprint.add(fp);
    imported++;
  }

  if (imported > 0) {
    saveRegistry(projectRoot, merged);
  }

  return { total: merged.length, imported };
}

function mergeImportedSkills(
  projectRoot: string,
  entries: Array<{ name: string; content: string; files?: SkillCompanionFile[]; sourcePath: string }>,
  tool: AiToolChoice,
): { total: number; imported: number } {
  const existing = loadSkillRegistry(projectRoot);
  const byName = new Map(existing.map((entry) => [entry.name, entry]));
  const byFingerprint = new Set(existing.map((entry) => entry.fingerprint));
  const merged = [...existing];
  let imported = 0;

  for (const item of entries) {
    const files = item.files || [];
    const fp = skillFingerprint(item.content, files);
    const existingByName = byName.get(item.name);
    const nextSourcePath = item.sourcePath;

    if (existingByName) {
      const sameFiles = JSON.stringify(existingByName.files || []) === JSON.stringify(files);
      const sameSource = existingByName.source.kind === 'local' && existingByName.source.path === nextSourcePath;
      const unchanged = existingByName.content === item.content
        && existingByName.fingerprint === fp
        && sameFiles
        && existingByName.status === 'active'
        && sameSource;

      if (!unchanged) {
        existingByName.content = item.content;
        existingByName.files = files;
        existingByName.fingerprint = fp;
        existingByName.updatedAt = new Date().toISOString();
        existingByName.status = 'active';
        existingByName.source = {
          kind: 'local',
          path: nextSourcePath,
        };
        imported++;
      }
      byFingerprint.add(fp);
      continue;
    }

    if (byFingerprint.has(fp)) continue;

    const entry: SkillRegistryEntry = {
      id: nextSkillId(merged),
      name: item.name,
      content: item.content,
      files,
      fingerprint: fp,
      source: {
        kind: 'local',
        path: item.sourcePath,
      },
      updatedAt: new Date().toISOString(),
      status: 'active',
    };
    merged.push(entry);
    byName.set(entry.name, entry);
    byFingerprint.add(fp);
    imported++;
  }

  if (imported > 0) {
    saveSkillRegistry(projectRoot, merged);
  }

  return { total: merged.length, imported };
}

export function detectImportableTools(projectRoot: string, tools: AiToolChoice[]): AiToolChoice[] {
  return tools.filter((tool) => {
    switch (tool) {
      case 'claude-code':
        return fileExists(resolve(projectRoot, 'CLAUDE.md'))
          || fileExists(resolve(projectRoot, '.claude', 'commands'))
          || fileExists(resolve(projectRoot, '.claude', 'rules'))
          || fileExists(resolve(projectRoot, '.claude', 'skills'))
          || fileExists(resolve(projectRoot, '.mcp.json'));
      case 'cursor':
        return fileExists(resolve(projectRoot, '.cursor', 'rules'))
          || fileExists(resolve(projectRoot, '.cursor', 'skills'))
          || fileExists(resolve(projectRoot, '.cursor', 'mcp.json'));
      case 'lingma':
        return fileExists(resolve(projectRoot, '.lingma', 'rules'))
          || fileExists(resolve(projectRoot, '.lingma', 'mcp.json'));
      case 'codex':
        return fileExists(resolve(projectRoot, 'AGENTS.md'))
          || fileExists(resolve(projectRoot, '.codex', 'rules'))
          || fileExists(resolve(projectRoot, '.codex', 'skills'))
          || fileExists(resolve(projectRoot, '.codex', 'config.toml'));
      case 'vscode-copilot':
        return fileExists(resolve(projectRoot, '.vscode', 'mcp.json'));
      case 'windsurf':
        return false;
    }
  });
}

export function detectClosedLoopImportableTools(projectRoot: string, tools: AiToolChoice[]): AiToolChoice[] {
  return detectImportableTools(projectRoot, tools).filter((tool) => CLOSED_LOOP_BASELINE_TOOLS.includes(tool));
}

export function importFromTool(projectRoot: string, tool: AiToolChoice): {
  rulesImported: number
  skillsImported: number
} {
  return importFromToolWithOptions(projectRoot, tool, {});
}

export function importFromToolWithOptions(
  projectRoot: string,
  tool: AiToolChoice,
  options: ImportOptions = {},
): {
  rulesImported: number
  skillsImported: number
} {
  const includeExternalSkills = options.includeExternalSkills !== false;
  const ruleContents: string[] = [];
  const skills: Array<{ name: string; content: string; files?: SkillCompanionFile[]; sourcePath: string }> = [];

  switch (tool) {
    case 'claude-code': {
      const claude = resolve(projectRoot, 'CLAUDE.md');
      if (fileExists(claude)) {
        ruleContents.push(...parseMarkdownRuleCandidates(readText(claude)));
      }
      const rulesDir = resolve(projectRoot, '.claude', 'rules');
      for (const file of walkMarkdownFiles(rulesDir)) {
        const raw = readText(file);
        if (isGeneratedRuleFile(file, raw)) continue;
        ruleContents.push(...parseMarkdownRuleCandidates(raw));
      }
      const skillsDir = resolve(projectRoot, '.claude', 'skills');
      skills.push(...collectToolSkills(projectRoot, skillsDir));
      const commandDir = resolve(projectRoot, '.claude', 'commands');
      for (const file of walkMarkdownFiles(commandDir)) {
        const name = normalizeImportedSkillName(file.split('/').pop()!.replace(/\.md$/, ''));
        skills.push({
          name,
          content: readText(file),
          sourcePath: file.replace(`${projectRoot}/`, ''),
        });
      }
      break;
    }
    case 'cursor': {
      const rulesDir = resolve(projectRoot, '.cursor', 'rules');
      for (const file of walkMarkdownFiles(rulesDir)) {
        const raw = readText(file);
        if (isGeneratedRuleFile(file, raw)) continue;
        ruleContents.push(...parseMarkdownRuleCandidates(raw));
      }
      const skillsDir = resolve(projectRoot, '.cursor', 'skills');
      for (const file of walkMarkdownFiles(skillsDir).filter((path) => path.endsWith('SKILL.md'))) {
        const skillDir = dirname(file);
        const parts = skillDir.split('/');
        const name = normalizeImportedSkillName(parts[parts.length - 1]);
        const collected = collectImportedSkillPackage(skillDir);
        skills.push({
          name,
          content: collected?.content || readText(file),
          files: collected?.files || [],
          sourcePath: file.replace(`${projectRoot}/`, ''),
        });
      }
      break;
    }
    case 'lingma': {
      const rulesDir = resolve(projectRoot, '.lingma', 'rules');
      for (const file of walkMarkdownFiles(rulesDir)) {
        const raw = readText(file);
        if (isGeneratedRuleFile(file, raw)) continue;
        ruleContents.push(...parseMarkdownRuleCandidates(raw));
      }
      break;
    }
    case 'codex': {
      const agents = resolve(projectRoot, 'AGENTS.md');
      if (fileExists(agents)) {
        ruleContents.push(...parseMarkdownRuleCandidates(readText(agents)));
      }
      const rulesDir = resolve(projectRoot, '.codex', 'rules');
      for (const file of walkMarkdownFiles(rulesDir)) {
        const raw = readText(file);
        if (isGeneratedRuleFile(file, raw)) continue;
        ruleContents.push(...parseMarkdownRuleCandidates(raw));
      }
      const skillsDir = resolve(projectRoot, '.codex', 'skills');
      skills.push(...collectToolSkills(projectRoot, skillsDir));
      break;
    }
    case 'vscode-copilot':
    case 'windsurf':
      break;
  }

  const selectedSkills = includeExternalSkills
    ? skills
    : skills.filter((entry) => isBundledSkillName(entry.name));

  const rulesResult = mergeImportedRules(projectRoot, [...new Set(ruleContents)], tool);
  const skillResult = mergeImportedSkills(projectRoot, selectedSkills, tool);
  return { rulesImported: rulesResult.imported, skillsImported: skillResult.imported };
}

function readStructured(filePath: string): unknown {
  if (!fileExists(filePath)) return null;
  if (filePath.endsWith('.json')) {
    try {
      return readJson(filePath);
    } catch {
      return readText(filePath);
    }
  }
  return readText(filePath);
}

export function importExistingToolConfigs(projectRoot: string, options: ImportOptions = {}): {
  tools: AiToolChoice[]
  snapshots: ToolConfigSnapshot[]
  snapshotPath: string
} {
  const includeExternalMcp = options.includeExternalMcp !== false;
  const snapshots: ToolConfigSnapshot[] = [];

  for (const source of TOOL_SOURCES) {
    const path = source.path(projectRoot);
    if (!fileExists(path)) continue;
    snapshots.push({
      tool: source.tool,
      path: path.replace(`${projectRoot}/`, ''),
      format: source.format,
      content: includeExternalMcp ? readStructured(path) : null,
    });
  }
  const tools = [...new Set(snapshots.map((item) => item.tool))];
  const snapshotPath = toolConfigSnapshotPath(projectRoot);
  ensureDir(dirname(snapshotPath));
  writeJson(snapshotPath, {
    importedAt: new Date().toISOString(),
    tools,
    snapshots,
  });

  return { tools, snapshots, snapshotPath };
}

export function mergeConfiguredTools(projectRoot: string, tools: AiToolChoice[]): AiToolChoice[] {
  if (!fileExists(configPath(projectRoot))) return tools;
  const config = readJson<AidaConfig>(configPath(projectRoot));
  const existing = Array.isArray(config.aiTools)
    ? config.aiTools
    : config.aiTool
      ? [config.aiTool]
      : [];
  const merged = [...new Set([...existing, ...tools])];
  config.aiTools = merged;
  if (!config.aiTool && merged.length === 1) {
    config.aiTool = merged[0];
  }
  writeJson(configPath(projectRoot), config);
  return merged;
}

export function importProjectSources(projectRoot: string, options: ImportOptions = {}): {
  rulesImported: number
  skillsImported: number
  tools: AiToolChoice[]
  snapshotPath: string
  gitignoreAdded: string[]
} {
  const rules = importRulesFromViews(projectRoot);
  const skills = options.includeExternalSkills === false
    ? { entries: loadSkillRegistry(projectRoot), imported: 0 }
    : importSkillsFromViews(projectRoot);
  const toolConfigs = importExistingToolConfigs(projectRoot, options);
  const tools = mergeConfiguredTools(projectRoot, toolConfigs.tools);
  const gitignoreAdded = ensureBuildGitignore(projectRoot, tools);

  return {
    rulesImported: rules.imported,
    skillsImported: skills.imported,
    tools,
    snapshotPath: toolConfigs.snapshotPath,
    gitignoreAdded,
  };
}

export function importProjectSourcesWithBaseline(
  projectRoot: string,
  baselineTool: AiToolChoice,
  options: ImportOptions = {},
): {
  rulesImported: number
  skillsImported: number
  tools: AiToolChoice[]
  snapshotPath: string
  gitignoreAdded: string[]
  baseline: { rulesImported: number; skillsImported: number }
} {
  const baseline = importFromToolWithOptions(projectRoot, baselineTool, options);
  const imported = importProjectSources(projectRoot, options);

  return {
    ...imported,
    rulesImported: imported.rulesImported + baseline.rulesImported,
    skillsImported: imported.skillsImported + baseline.skillsImported,
    baseline,
  };
}
