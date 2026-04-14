import { readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { ensureDir, fileExists, readJson, readText, writeJson } from './fs.js';
import { configPath } from './paths.js';
import { ensureBuildGitignore, type AiToolChoice } from './ai-build.js';
import { importRulesFromViews, loadRegistry, saveRegistry, fingerprint, nextRuleId } from './rules.js';
import { importSkillsFromViews, loadSkillRegistry, saveSkillRegistry, skillFingerprint, nextSkillId, type SkillRegistryEntry } from './skills.js';

interface AidaConfig {
  aiTool?: AiToolChoice
  aiTools?: AiToolChoice[]
  [key: string]: unknown
}

interface ToolConfigSnapshot {
  tool: AiToolChoice
  path: string
  format: 'json' | 'toml' | 'text'
  content: unknown
}

const TOOL_SOURCES: Array<{
  tool: AiToolChoice
  path: (projectRoot: string) => string
  format: 'json' | 'toml' | 'text'
}> = [
  { tool: 'claude-code', path: (projectRoot) => resolve(projectRoot, '.mcp.json'), format: 'json' },
  { tool: 'cursor', path: (projectRoot) => resolve(projectRoot, '.cursor', 'mcp.json'), format: 'json' },
  { tool: 'vscode-copilot', path: (projectRoot) => resolve(projectRoot, '.vscode', 'mcp.json'), format: 'json' },
  { tool: 'lingma', path: (projectRoot) => resolve(projectRoot, '.lingma', 'mcp.json'), format: 'json' },
  { tool: 'codex', path: (projectRoot) => resolve(projectRoot, '.aida', 'codex', 'config.toml'), format: 'toml' },
];

function toolConfigSnapshotPath(projectRoot: string): string {
  return resolve(projectRoot, '.aida', 'tool-configs.json');
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
  entries: Array<{ name: string; content: string; sourcePath: string }>,
  tool: AiToolChoice,
): { total: number; imported: number } {
  const existing = loadSkillRegistry(projectRoot);
  const byName = new Map(existing.map((entry) => [entry.name, entry]));
  const byFingerprint = new Set(existing.map((entry) => entry.fingerprint));
  const merged = [...existing];
  let imported = 0;

  for (const item of entries) {
    const fp = skillFingerprint(item.content);
    const existingByName = byName.get(item.name);

    if (existingByName) {
      existingByName.content = item.content;
      existingByName.fingerprint = fp;
      existingByName.updatedAt = new Date().toISOString();
      existingByName.status = 'active';
      existingByName.source = {
        kind: 'local',
        path: item.sourcePath,
      };
      imported++;
      byFingerprint.add(fp);
      continue;
    }

    if (byFingerprint.has(fp)) continue;

    const entry: SkillRegistryEntry = {
      id: nextSkillId(merged),
      name: item.name,
      content: item.content,
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
          || fileExists(resolve(process.env.HOME || homedir(), '.codex', 'config.toml'));
      case 'vscode-copilot':
        return fileExists(resolve(projectRoot, '.vscode', 'mcp.json'));
      case 'windsurf':
        return false;
    }
  });
}

export function importFromTool(projectRoot: string, tool: AiToolChoice): {
  rulesImported: number
  skillsImported: number
} {
  const ruleContents: string[] = [];
  const skills: Array<{ name: string; content: string; sourcePath: string }> = [];

  switch (tool) {
    case 'claude-code': {
      const claude = resolve(projectRoot, 'CLAUDE.md');
      if (fileExists(claude)) {
        ruleContents.push(...parseMarkdownRuleCandidates(readText(claude)));
      }
      const commandDir = resolve(projectRoot, '.claude', 'commands');
      for (const file of walkMarkdownFiles(commandDir)) {
        const name = file.split('/').pop()!.replace(/\.md$/, '');
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
        ruleContents.push(...parseMarkdownRuleCandidates(readText(file)));
      }
      const skillsDir = resolve(projectRoot, '.cursor', 'skills');
      for (const file of walkMarkdownFiles(skillsDir).filter((path) => path.endsWith('SKILL.md'))) {
        const parts = file.split('/');
        const name = parts[parts.length - 2];
        skills.push({
          name,
          content: readText(file),
          sourcePath: file.replace(`${projectRoot}/`, ''),
        });
      }
      break;
    }
    case 'lingma': {
      const rulesDir = resolve(projectRoot, '.lingma', 'rules');
      for (const file of walkMarkdownFiles(rulesDir)) {
        ruleContents.push(...parseMarkdownRuleCandidates(readText(file)));
      }
      break;
    }
    case 'codex': {
      const agents = resolve(projectRoot, 'AGENTS.md');
      if (fileExists(agents)) {
        ruleContents.push(...parseMarkdownRuleCandidates(readText(agents)));
      }
      break;
    }
    case 'vscode-copilot':
    case 'windsurf':
      break;
  }

  const rulesResult = mergeImportedRules(projectRoot, [...new Set(ruleContents)], tool);
  const skillResult = mergeImportedSkills(projectRoot, skills, tool);
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

export function importExistingToolConfigs(projectRoot: string): {
  tools: AiToolChoice[]
  snapshots: ToolConfigSnapshot[]
  snapshotPath: string
} {
  const snapshots: ToolConfigSnapshot[] = [];

  for (const source of TOOL_SOURCES) {
    const path = source.path(projectRoot);
    if (!fileExists(path)) continue;
    snapshots.push({
      tool: source.tool,
      path: path.replace(`${projectRoot}/`, ''),
      format: source.format,
      content: readStructured(path),
    });
  }

  const home = process.env.HOME || homedir();
  const codexGlobalPath = resolve(home, '.codex', 'config.toml');
  if (fileExists(codexGlobalPath)) {
    snapshots.push({
      tool: 'codex',
      path: codexGlobalPath,
      format: 'toml',
      content: readText(codexGlobalPath),
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

export function importProjectSources(projectRoot: string): {
  rulesImported: number
  skillsImported: number
  tools: AiToolChoice[]
  snapshotPath: string
  gitignoreAdded: string[]
} {
  const rules = importRulesFromViews(projectRoot);
  const skills = importSkillsFromViews(projectRoot);
  const toolConfigs = importExistingToolConfigs(projectRoot);
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
): {
  rulesImported: number
  skillsImported: number
  tools: AiToolChoice[]
  snapshotPath: string
  gitignoreAdded: string[]
  baseline: { rulesImported: number; skillsImported: number }
} {
  const baseline = importFromTool(projectRoot, baselineTool);
  const imported = importProjectSources(projectRoot);

  return {
    ...imported,
    rulesImported: imported.rulesImported + baseline.rulesImported,
    skillsImported: imported.skillsImported + baseline.skillsImported,
    baseline,
  };
}
