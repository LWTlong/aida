import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrapRuleRegistry, renderRuleMarkdownFiles } from './rules.js';
import { activeSkills, bootstrapSkillRegistry } from './skills.js';
import { buildRuleViews } from './rules.js';
import { ensureGuide, syncGuideReference, updateGuide, updateGuideReferences } from './guide.js';
import { buildMemoryViews } from './memory.js';
import { configPath } from './paths.js';
import { ensureDir, fileExists, readJson, readText, resetDir, writeJson, writeText } from './fs.js';
import type { AiToolChoice, AidaConfig } from '../schemas/aida-project.js';

const MCP_SERVER_ENTRY = {
  command: 'npx',
  args: ['-y', '--registry=https://registry.npmjs.org/', 'ai-dev-analytics', 'mcp'],
};

const MCP_CONFIG_JSON = JSON.stringify({
  mcpServers: {
    aida: MCP_SERVER_ENTRY,
  },
}, null, 2);

const CODEX_CONFIG_TOML = `[mcp_servers.aida]
command = "npx"
args = ["-y", "--registry=https://registry.npmjs.org/", "ai-dev-analytics", "mcp"]
`;

function writeRuleBundle(dir: string, files: Map<string, string>): number {
  resetDir(dir);
  for (const [name, content] of files) {
    writeText(resolve(dir, name), content);
  }
  return files.size;
}

function buildClaudeRules(projectRoot: string, files: Map<string, string>): number {
  return writeRuleBundle(resolve(projectRoot, '.claude', 'rules', 'aida'), files);
}

function buildCursorRules(projectRoot: string, files: Map<string, string>): number {
  return writeRuleBundle(resolve(projectRoot, '.cursor', 'rules', 'aida'), files);
}

function buildLingmaRules(projectRoot: string, files: Map<string, string>): number {
  return writeRuleBundle(resolve(projectRoot, '.lingma', 'rules', 'aida'), files);
}

function buildCodexRules(projectRoot: string, files: Map<string, string>): number {
  return writeRuleBundle(resolve(projectRoot, '.codex', 'rules', 'aida'), files);
}

function buildClaudeSkills(projectRoot: string): number {
  const dir = resolve(projectRoot, '.claude', 'skills');
  resetDir(dir);
  let written = 0;
  for (const entry of activeSkills(bootstrapSkillRegistry(projectRoot))) {
    writeText(resolve(dir, `${entry.name}.md`), entry.content);
    if ((entry.files || []).length > 0) {
      const packageDir = resolve(dir, entry.name);
      ensureDir(packageDir);
      writeText(resolve(packageDir, 'SKILL.md'), entry.content);
      for (const file of entry.files || []) {
        const fullPath = resolve(packageDir, file.path);
        ensureDir(resolve(fullPath, '..'));
        writeText(fullPath, file.content);
        written++;
      }
      written++;
    }
    written++;
  }
  return written;
}

function buildCursorSkills(projectRoot: string): number {
  const rootDir = resolve(projectRoot, '.cursor', 'skills');
  resetDir(rootDir);
  let written = 0;
  for (const entry of activeSkills(bootstrapSkillRegistry(projectRoot))) {
    const dir = resolve(rootDir, entry.name);
    ensureDir(dir);
    writeText(resolve(dir, 'SKILL.md'), entry.content);
    for (const file of entry.files || []) {
      const fullPath = resolve(dir, file.path);
      ensureDir(resolve(fullPath, '..'));
      writeText(fullPath, file.content);
      written++;
    }
    written++;
  }
  return written;
}

function buildCodexSkills(projectRoot: string): number {
  const dir = resolve(projectRoot, '.codex', 'skills');
  resetDir(dir);
  let written = 0;
  for (const entry of activeSkills(bootstrapSkillRegistry(projectRoot))) {
    writeText(resolve(dir, `${entry.name}.md`), entry.content);
    if ((entry.files || []).length > 0) {
      const packageDir = resolve(dir, entry.name);
      ensureDir(packageDir);
      writeText(resolve(packageDir, 'SKILL.md'), entry.content);
      for (const file of entry.files || []) {
        const fullPath = resolve(packageDir, file.path);
        ensureDir(resolve(fullPath, '..'));
        writeText(fullPath, file.content);
        written++;
      }
      written++;
    }
    written++;
  }
  return written;
}

export function readConfiguredTools(projectRoot: string): AiToolChoice[] {
  if (!fileExists(configPath(projectRoot))) return [];
  const config = readJson<AidaConfig>(configPath(projectRoot));
  if (Array.isArray(config.aiTools) && config.aiTools.length > 0) {
    return [...new Set(config.aiTools)];
  }
  return config.aiTool ? [config.aiTool] : [];
}

export function normalizeRequestedTools(
  projectRoot: string,
  requested: string[] = [],
): AiToolChoice[] {
  const configured = readConfiguredTools(projectRoot);
  if (requested.length === 0 || requested.includes('all')) return configured;

  const valid = new Set<AiToolChoice>(['claude-code', 'cursor', 'vscode-copilot', 'windsurf', 'lingma', 'codex']);
  return requested.filter((tool): tool is AiToolChoice => valid.has(tool as AiToolChoice));
}

function writeJsonMerge(filePath: string): void {
  if (fileExists(filePath)) {
    try {
      const existing = JSON.parse(readText(filePath));
      existing.mcpServers = existing.mcpServers || {};
      existing.mcpServers.aida = MCP_SERVER_ENTRY;
      writeText(filePath, JSON.stringify(existing, null, 2) + '\n');
      return;
    } catch {
      // Fall through to overwrite invalid JSON.
    }
  }

  writeText(filePath, MCP_CONFIG_JSON + '\n');
}

function renderJsonConfig(content: unknown): string {
  let config: Record<string, unknown> = {};

  if (content && typeof content === 'object' && !Array.isArray(content)) {
    config = { ...(content as Record<string, unknown>) };
  } else if (typeof content === 'string' && content.trim().length > 0) {
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        config = { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      config = {};
    }
  }

  const mcpServers = (config.mcpServers && typeof config.mcpServers === 'object' && !Array.isArray(config.mcpServers))
    ? { ...(config.mcpServers as Record<string, unknown>) }
    : {};
  mcpServers.aida = MCP_SERVER_ENTRY;
  config.mcpServers = mcpServers;
  return `${JSON.stringify(config, null, 2)}\n`;
}

function mergeCodexToml(raw: string): string {
  const trimmed = raw.trim();
  const block = CODEX_CONFIG_TOML.trim();

  if (!trimmed) return `${block}\n`;

  const lines = trimmed.split('\n');
  const kept: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '[mcp_servers.aida]') {
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('[')) {
        i++;
      }
      i--;
      continue;
    }
    kept.push(line);
  }

  const base = kept.join('\n').trim();
  if (!base) return `${block}\n`;
  return `${base}\n\n${block}\n`;
}

function readJsonIfExists(filePath: string): unknown {
  if (!fileExists(filePath)) return null;
  try {
    return JSON.parse(readText(filePath));
  } catch {
    return readText(filePath);
  }
}

function readCurrentOrSnapshot(
  projectRoot: string,
  _tool: AiToolChoice,
  path: string,
): unknown {
  const fullPath = resolve(projectRoot, path);
  if (fileExists(fullPath)) {
    return readJsonIfExists(fullPath);
  }
  return null;
}

export function writeMcpConfig(projectRoot: string, tools: AiToolChoice[]): string[] {
  const written: string[] = [];

  for (const tool of tools) {
    switch (tool) {
      case 'claude-code':
        writeText(
          resolve(projectRoot, '.mcp.json'),
          renderJsonConfig(readCurrentOrSnapshot(projectRoot, tool, '.mcp.json')),
        );
        written.push('.mcp.json');
        break;
      case 'cursor': {
        const dir = resolve(projectRoot, '.cursor');
        ensureDir(dir);
        writeText(
          resolve(dir, 'mcp.json'),
          renderJsonConfig(readCurrentOrSnapshot(projectRoot, tool, '.cursor/mcp.json')),
        );
        written.push('.cursor/mcp.json');
        break;
      }
      case 'vscode-copilot': {
        const dir = resolve(projectRoot, '.vscode');
        ensureDir(dir);
        writeText(
          resolve(dir, 'mcp.json'),
          renderJsonConfig(readCurrentOrSnapshot(projectRoot, tool, '.vscode/mcp.json')),
        );
        written.push('.vscode/mcp.json');
        break;
      }
      case 'lingma': {
        const dir = resolve(projectRoot, '.lingma');
        ensureDir(dir);
        writeText(
          resolve(dir, 'mcp.json'),
          renderJsonConfig(readCurrentOrSnapshot(projectRoot, tool, '.lingma/mcp.json')),
        );
        written.push('.lingma/mcp.json');
        break;
      }
      case 'codex': {
        const dir = resolve(projectRoot, '.codex');
        ensureDir(dir);
        const base = readCurrentOrSnapshot(projectRoot, tool, '.codex/config.toml');
        const content = mergeCodexToml(typeof base === 'string' ? base : '');
        writeText(resolve(dir, 'config.toml'), content);
        written.push('.codex/config.toml');
        break;
      }
      case 'windsurf':
        written.push('(windsurf: manual config needed)');
        break;
    }
  }

  return written;
}

function pruneInactiveToolArtifacts(projectRoot: string, tools: AiToolChoice[]): void {
  const active = new Set(tools);

  rmSync(resolve(projectRoot, '.claude', 'commands'), { recursive: true, force: true });

  if (!active.has('claude-code')) {
    rmSync(resolve(projectRoot, 'CLAUDE.md'), { force: true });
    rmSync(resolve(projectRoot, '.mcp.json'), { force: true });
    rmSync(resolve(projectRoot, '.claude'), { recursive: true, force: true });
  }

  if (!active.has('codex')) {
    rmSync(resolve(projectRoot, 'AGENTS.md'), { force: true });
    rmSync(resolve(projectRoot, '.codex'), { recursive: true, force: true });
  }

  if (!active.has('cursor')) {
    rmSync(resolve(projectRoot, '.cursor', 'mcp.json'), { force: true });
    rmSync(resolve(projectRoot, '.cursor', 'rules'), { recursive: true, force: true });
    rmSync(resolve(projectRoot, '.cursor', 'skills'), { recursive: true, force: true });
  }

  if (!active.has('lingma')) {
    rmSync(resolve(projectRoot, '.lingma'), { recursive: true, force: true });
  }

  if (!active.has('vscode-copilot')) {
    rmSync(resolve(projectRoot, '.vscode', 'mcp.json'), { force: true });
  }
}

export function ensureBuildGitignore(projectRoot: string, tools: AiToolChoice[]): string[] {
  const gitignorePath = resolve(projectRoot, '.gitignore');
  const existing = fileExists(gitignorePath) ? readText(gitignorePath) : '';
  const existingLines = new Set(
    existing
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const entries = [
    '.agent/',
    '.agents/',
    '.augment/',
    '.claude/',
    '.codex/',
    '.continue/',
    '.cursor/',
    '.gemini/',
    '.kiro/',
    '.lingma/',
    '.qodo/',
    '.roo/',
    '.roo-code/',
    '.trae/',
    '.windsurf/',
    '.vscode/mcp.json',
    'AGENTS.md',
    'CLAUDE.md',
    '.mcp.json',
    '.aida/**',
    '!.aida/**/',
    '!.aida/**/*.json',
    '.aida/bootstrap-state.local.json',
  ];

  if (tools.includes('cursor')) {
    entries.push('.cursor/mcp.json');
  }
  if (tools.includes('vscode-copilot')) {
    entries.push('.vscode/mcp.json');
  }
  if (tools.includes('lingma')) {
    entries.push('.lingma/mcp.json');
  }
  if (tools.includes('codex')) {
    entries.push('.codex/config.toml');
  }

  const toAdd = entries.filter((entry) => !existingLines.has(entry));
  if (toAdd.length > 0) {
    writeText(
      gitignorePath,
      existing.trimEnd() + '\n\n# AIDA - generated local AI tool artifacts\n' + toAdd.join('\n') + '\n',
    );
  }
  return toAdd;
}

export function buildProjectArtifacts(
  projectRoot: string,
  requestedTools: string[] = [],
  options: {
    skipMcpConfig?: boolean
  } = {},
): {
  tools: AiToolChoice[]
  ruleFiles: number
  skillFiles: number
  mcpFiles: string[]
  gitignoreAdded: string[]
  ruleViewFiles: number
  memoryViews: {
    moduleViews: number
  }
} {
  const tools = normalizeRequestedTools(projectRoot, requestedTools);
  const rules = renderRuleMarkdownFiles(bootstrapRuleRegistry(projectRoot));
  bootstrapSkillRegistry(projectRoot);
  pruneInactiveToolArtifacts(projectRoot, tools);
  rmSync(resolve(projectRoot, '.aida', 'skills'), { recursive: true, force: true });
  const mcpFiles = options.skipMcpConfig ? [] : writeMcpConfig(projectRoot, tools);

  let ruleFiles = 0;
  let skillFiles = 0;
  if (tools.includes('claude-code')) {
    ruleFiles += buildClaudeRules(projectRoot, rules);
    skillFiles += buildClaudeSkills(projectRoot);
  }
  if (tools.includes('cursor')) {
    ruleFiles += buildCursorRules(projectRoot, rules);
    skillFiles += buildCursorSkills(projectRoot);
  }
  if (tools.includes('lingma')) {
    ruleFiles += buildLingmaRules(projectRoot, rules);
  }
  if (tools.includes('codex')) {
    ruleFiles += buildCodexRules(projectRoot, rules);
    skillFiles += buildCodexSkills(projectRoot);
  }

  ensureGuide(projectRoot);
  syncGuideReference(projectRoot, tools);
  updateGuide(projectRoot);
  updateGuideReferences(projectRoot, tools);
  const ruleViewFiles = buildRuleViews(projectRoot);
  const memoryViews = buildMemoryViews(projectRoot);
  const gitignoreAdded = ensureBuildGitignore(projectRoot, tools);

  return {
    tools,
    ruleFiles,
    skillFiles,
    mcpFiles,
    gitignoreAdded,
    ruleViewFiles,
    memoryViews,
  };
}
