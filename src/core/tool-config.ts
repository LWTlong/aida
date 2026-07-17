import { resolve } from 'node:path';
import { ensureDir, fileExists, readText, writeText } from '../utils/fs.js';

export type AidaSupportedTool = 'claude' | 'cursor' | 'codex';

const MCP_SERVER_ENTRY = {
  command: 'npx',
  args: ['-y', '--registry=https://registry.npmjs.org/', 'ai-dev-analytics', 'mcp'],
};

function mergeJsonMcp(raw: string): string {
  let config: Record<string, unknown> = {};
  try {
    const parsed = raw.trim() ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) config = parsed;
  } catch {
    config = {};
  }
  const mcpServers = config.mcpServers && typeof config.mcpServers === 'object' && !Array.isArray(config.mcpServers)
    ? { ...(config.mcpServers as Record<string, unknown>) }
    : {};
  mcpServers.aida = MCP_SERVER_ENTRY;
  config.mcpServers = mcpServers;
  return `${JSON.stringify(config, null, 2)}\n`;
}

function mergeCodexToml(raw: string): string {
  const block = '[mcp_servers.aida]\ncommand = "npx"\nargs = ["-y", "--registry=https://registry.npmjs.org/", "ai-dev-analytics", "mcp"]\n';
  const lines = raw.split('\n');
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '[mcp_servers.aida]') {
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('[')) i++;
      i--;
    } else {
      kept.push(lines[i]);
    }
  }
  const base = kept.join('\n').trim();
  return base ? `${base}\n\n${block}` : block;
}

export function writeAidaMcpConfigs(projectRoot: string, tools: Array<'claude' | 'cursor' | 'codex'>): string[] {
  const written: string[] = [];
  if (tools.includes('claude')) {
    const path = resolve(projectRoot, '.mcp.json');
    writeText(path, mergeJsonMcp(fileExists(path) ? readText(path) : ''));
    written.push('.mcp.json');
  }
  if (tools.includes('cursor')) {
    const dir = resolve(projectRoot, '.cursor');
    ensureDir(dir);
    const path = resolve(dir, 'mcp.json');
    writeText(path, mergeJsonMcp(fileExists(path) ? readText(path) : ''));
    written.push('.cursor/mcp.json');
  }
  if (tools.includes('codex')) {
    const dir = resolve(projectRoot, '.codex');
    ensureDir(dir);
    const path = resolve(dir, 'config.toml');
    writeText(path, mergeCodexToml(fileExists(path) ? readText(path) : ''));
    written.push('.codex/config.toml');
  }
  return written;
}
