import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { buildRuleViews } from './rules.js';
import { bootstrapSkillRegistry, buildSkillViews, getSkillContent } from './skills.js';
import { ensureGuide, updateGuide, updateGuideReferences } from './guide.js';
import { configPath } from './paths.js';
import { ensureDir, fileExists, readJson, readText, writeJson, writeText } from './fs.js';

export type AiToolChoice = 'claude-code' | 'cursor' | 'vscode-copilot' | 'windsurf' | 'lingma' | 'codex';

export const QUICK_COMMANDS: { name: string; skill: string }[] = [
  { name: 'workflow', skill: 'workflow-orchestrator' },
  { name: 'audit', skill: 'audit' },
  { name: 'deviation', skill: 'deviation-recorder' },
  { name: 'self-reviewer', skill: 'self-reviewer' },
  { name: 'bug-fixer', skill: 'bug-fixer' },
  { name: 'rules-evolver', skill: 'rules-evolver' },
];

const MCP_SERVER_ENTRY = {
  command: 'npx',
  args: ['-y', 'ai-dev-analytics', 'mcp'],
};

const MCP_CONFIG_JSON = JSON.stringify({
  mcpServers: {
    aida: MCP_SERVER_ENTRY,
  },
}, null, 2);

interface AidaConfig {
  aiTool?: AiToolChoice
  aiTools?: AiToolChoice[]
}

const CODEX_CONFIG_TOML = `[mcp_servers.aida]
command = "npx"
args = ["-y", "ai-dev-analytics", "mcp"]
`;

interface ToolConfigSnapshot {
  tool: AiToolChoice
  path: string
  format: 'json' | 'toml' | 'text'
  content: unknown
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

function mergeCodexToml(raw: string): string {
  const trimmed = raw.trim();
  const block = CODEX_CONFIG_TOML.trim();
  const pattern = /\[mcp_servers\.aida\][\s\S]*?(?=\n\[|$)/m;

  if (!trimmed) return `${block}\n`;
  if (pattern.test(trimmed)) {
    return `${trimmed.replace(pattern, block).trim()}\n`;
  }
  return `${trimmed}\n\n${block}\n`;
}

function syncCodexGlobalConfig(): string {
  const home = process.env.HOME || homedir();
  const codexDir = resolve(home, '.codex');
  const codexConfigPath = resolve(codexDir, 'config.toml');
  ensureDir(dirname(codexConfigPath));

  const existing = fileExists(codexConfigPath) ? readText(codexConfigPath) : '';
  writeText(codexConfigPath, mergeCodexToml(existing));
  return codexConfigPath;
}

function toolConfigSnapshotPath(projectRoot: string): string {
  return resolve(projectRoot, '.aida', 'tool-configs.json');
}

function readJsonIfExists(filePath: string): unknown {
  if (!fileExists(filePath)) return null;
  try {
    return JSON.parse(readText(filePath));
  } catch {
    return readText(filePath);
  }
}

function writeToolConfigSnapshot(projectRoot: string, tools: AiToolChoice[], codexGlobalPath?: string): string {
  const snapshots: ToolConfigSnapshot[] = [];

  if (tools.includes('claude-code')) {
    snapshots.push({
      tool: 'claude-code',
      path: '.mcp.json',
      format: 'json',
      content: readJsonIfExists(resolve(projectRoot, '.mcp.json')),
    });
  }
  if (tools.includes('cursor')) {
    snapshots.push({
      tool: 'cursor',
      path: '.cursor/mcp.json',
      format: 'json',
      content: readJsonIfExists(resolve(projectRoot, '.cursor', 'mcp.json')),
    });
  }
  if (tools.includes('vscode-copilot')) {
    snapshots.push({
      tool: 'vscode-copilot',
      path: '.vscode/mcp.json',
      format: 'json',
      content: readJsonIfExists(resolve(projectRoot, '.vscode', 'mcp.json')),
    });
  }
  if (tools.includes('lingma')) {
    snapshots.push({
      tool: 'lingma',
      path: '.lingma/mcp.json',
      format: 'json',
      content: readJsonIfExists(resolve(projectRoot, '.lingma', 'mcp.json')),
    });
  }
  if (tools.includes('codex')) {
    snapshots.push({
      tool: 'codex',
      path: '.aida/codex/config.toml',
      format: 'toml',
      content: fileExists(resolve(projectRoot, '.aida', 'codex', 'config.toml'))
        ? readText(resolve(projectRoot, '.aida', 'codex', 'config.toml'))
        : '',
    });
    if (codexGlobalPath) {
      snapshots.push({
        tool: 'codex',
        path: codexGlobalPath,
        format: 'toml',
        content: readText(codexGlobalPath),
      });
    }
  }

  writeJson(toolConfigSnapshotPath(projectRoot), {
    generatedAt: new Date().toISOString(),
    tools,
    snapshots,
  });
  return toolConfigSnapshotPath(projectRoot);
}

export function writeMcpConfig(projectRoot: string, tools: AiToolChoice[]): string[] {
  const written: string[] = [];

  for (const tool of tools) {
    switch (tool) {
      case 'claude-code':
        writeJsonMerge(resolve(projectRoot, '.mcp.json'));
        written.push('.mcp.json');
        break;
      case 'cursor': {
        const dir = resolve(projectRoot, '.cursor');
        ensureDir(dir);
        writeJsonMerge(resolve(dir, 'mcp.json'));
        written.push('.cursor/mcp.json');
        break;
      }
      case 'vscode-copilot': {
        const dir = resolve(projectRoot, '.vscode');
        ensureDir(dir);
        writeJsonMerge(resolve(dir, 'mcp.json'));
        written.push('.vscode/mcp.json');
        break;
      }
      case 'lingma': {
        const dir = resolve(projectRoot, '.lingma');
        ensureDir(dir);
        writeJsonMerge(resolve(dir, 'mcp.json'));
        written.push('.lingma/mcp.json');
        break;
      }
      case 'codex': {
        const dir = resolve(projectRoot, '.aida', 'codex');
        ensureDir(dir);
        writeText(resolve(dir, 'config.toml'), CODEX_CONFIG_TOML);
        const globalPath = syncCodexGlobalConfig();
        written.push(`.aida/codex/config.toml (synced to ${globalPath})`);
        break;
      }
      case 'windsurf':
        written.push('(windsurf: manual config needed)');
        break;
    }
  }

  return written;
}

function buildClaudeCommands(projectRoot: string): number {
  const dir = resolve(projectRoot, '.claude', 'commands');
  ensureDir(dir);
  let written = 0;

  for (const cmd of QUICK_COMMANDS) {
    const content = getSkillContent(projectRoot, cmd.skill);
    if (!content) continue;
    writeText(resolve(dir, `${cmd.name}.md`), content);
    written++;
  }

  return written;
}

function buildCursorCommands(projectRoot: string): number {
  let written = 0;

  for (const cmd of QUICK_COMMANDS) {
    const content = getSkillContent(projectRoot, cmd.skill);
    if (!content) continue;
    const dir = resolve(projectRoot, '.cursor', 'skills', cmd.name);
    ensureDir(dir);
    writeText(resolve(dir, 'SKILL.md'), content);
    written++;
  }

  return written;
}

export function ensureBuildGitignore(projectRoot: string, tools: AiToolChoice[]): string[] {
  const gitignorePath = resolve(projectRoot, '.gitignore');
  const existing = fileExists(gitignorePath) ? readText(gitignorePath) : '';
  const entries = [
    '.aida/rules/*.md',
    '.aida/skills/*/SKILL.md',
    '.aida/index.json',
    '.aida/tool-configs.json',
  ];

  if (tools.includes('claude-code')) {
    entries.push('.mcp.json', '.claude/commands/*.md');
  }
  if (tools.includes('cursor')) {
    entries.push('.cursor/mcp.json', '.cursor/skills/', '.cursor/rules/aidevos/');
  }
  if (tools.includes('vscode-copilot')) {
    entries.push('.vscode/mcp.json');
  }
  if (tools.includes('lingma')) {
    entries.push('.lingma/mcp.json', '.lingma/rules/');
  }
  if (tools.includes('codex')) {
    entries.push('.aida/codex/config.toml');
  }

  const toAdd = entries.filter((entry) => !existing.includes(entry));
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
): {
  tools: AiToolChoice[]
  ruleViews: number
  skillViews: number
  mcpFiles: string[]
  commandFiles: number
  gitignoreAdded: string[]
  toolConfigSnapshot: string
} {
  const tools = normalizeRequestedTools(projectRoot, requestedTools);
  bootstrapSkillRegistry(projectRoot);

  const ruleViews = buildRuleViews(projectRoot);
  const skillViews = buildSkillViews(projectRoot);
  const mcpFiles = writeMcpConfig(projectRoot, tools);

  let commandFiles = 0;
  if (tools.includes('claude-code')) commandFiles += buildClaudeCommands(projectRoot);
  if (tools.includes('cursor')) commandFiles += buildCursorCommands(projectRoot);

  ensureGuide(projectRoot);
  updateGuide(projectRoot);
  updateGuideReferences(projectRoot, tools);

  const toolConfigSnapshot = writeToolConfigSnapshot(projectRoot, tools);
  const gitignoreAdded = ensureBuildGitignore(projectRoot, tools);

  return {
    tools,
    ruleViews,
    skillViews,
    mcpFiles,
    commandFiles,
    gitignoreAdded,
    toolConfigSnapshot,
  };
}
