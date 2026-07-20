import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { ensureDir, fileExists, readText, writeJson, writeText } from '../../utils/fs.js';
import { loadAssetIndex } from '../assets/store.js';
import { pluginsDir } from '../assets/paths.js';
import { excerpt, isoNow, slugify } from '../shared.js';
import type { BuildPluginInput, PluginRiskFinding, PluginRiskLevel, PluginRiskReport } from './types.js';

const RISK_PATTERNS: Array<{ level: PluginRiskLevel; kind: string; pattern: RegExp; signal: string; recommendation: string }> = [
  { level: 'high', kind: 'command-exec', pattern: /\b(exec|spawn|child_process|subprocess|os\.system)\b/i, signal: 'exec/spawn/subprocess', recommendation: 'Review command execution carefully before installing.' },
  { level: 'high', kind: 'network-access', pattern: /\b(curl|wget|fetch\(|axios\.|requests\.|httpx\.)\b/i, signal: 'network call', recommendation: 'Confirm why the plugin needs network access.' },
  { level: 'high', kind: 'env-access', pattern: /process\.env|\$\{?[A-Z0-9_]+\}?/i, signal: 'environment access', recommendation: 'Do not install unless the source is trusted and secrets are not exposed.' },
  { level: 'high', kind: 'shell-script', pattern: /^#!.*\b(sh|bash|zsh|python|node)\b/im, signal: 'script shebang', recommendation: 'Scripts are executable assets; install only after review.' },
  { level: 'medium', kind: 'mcp-server', pattern: /mcpServers|mcp_servers|"command"\s*:/i, signal: 'MCP server config', recommendation: 'MCP servers can expose tools; install selectively.' },
  { level: 'medium', kind: 'hook', pattern: /"hooks"\s*:|preToolUse|postToolUse|Stop|SubagentStop/i, signal: 'hook config', recommendation: 'Hooks can run automatically; keep disabled unless needed.' },
  { level: 'medium', kind: 'absolute-path', pattern: /(?:\/Users\/|\/home\/|C:\\Users\\)/i, signal: 'absolute local path', recommendation: 'Replace local paths before sharing or installing.' },
  { level: 'high', kind: 'possible-secret', pattern: /(sk-[a-z0-9_-]{16,}|ghp_[a-z0-9_]{16,}|xox[baprs]-[a-z0-9-]+)/i, signal: 'possible token', recommendation: 'Do not install or share until secrets are removed.' },
];

function ensurePluginPath(pluginPath: string): string {
  const normalized = pluginPath.trim();
  if (!normalized) throw new Error('Plugin path is required.');
  if (!existsSync(normalized)) throw new Error(`Plugin path not found: ${normalized}`);
  if (!statSync(normalized).isDirectory()) throw new Error(`Plugin path is not a directory: ${normalized}`);
  return normalized;
}

function walkFiles(root: string): string[] {
  const pluginRoot = ensurePluginPath(root);
  const files: string[] = [];
  const stack = [pluginRoot];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of readdirSync(current)) {
      if (['node_modules', '.git', 'dist', 'build'].includes(name)) continue;
      const full = resolve(current, name);
      const stat = statSync(full);
      if (stat.isDirectory()) stack.push(full);
      else if (stat.isFile() && stat.size <= 512 * 1024) files.push(full);
    }
  }
  return files;
}

function levelRank(level: PluginRiskLevel): number {
  return level === 'high' ? 3 : level === 'medium' ? 2 : 1;
}

export function auditPluginRisk(pluginPath: string): PluginRiskReport {
  const findings: PluginRiskFinding[] = [];
  const resolvedPath = ensurePluginPath(pluginPath);
  const files = walkFiles(resolvedPath);
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (!['.md', '.json', '.yaml', '.yml', '.toml', '.js', '.ts', '.sh', '.bash', '.zsh', '.py', '.txt'].includes(ext)) continue;
    let raw = '';
    try { raw = readText(file); } catch { continue; }
    for (const rule of RISK_PATTERNS) {
      if (!rule.pattern.test(raw)) continue;
      findings.push({ level: rule.level, kind: rule.kind, filePath: file, signal: rule.signal, recommendation: rule.recommendation });
    }
  }
  const level = findings.reduce<PluginRiskLevel>((max, item) => levelRank(item.level) > levelRank(max) ? item.level : max, 'low');
  return {
    schemaVersion: '3.0',
    pluginPath: resolvedPath,
    scannedAt: isoNow(),
    level,
    findings,
    summary: findings.length === 0 ? 'No high-risk executable or credential signals were detected by static scan.' : `Detected ${findings.length} risk signal(s). Let the user model review these before installation.`,
    nextSteps: [
      'Do not execute hooks, scripts, MCP servers, or commands during import.',
      'Use the aida-import skill to explain risks; after user confirms the selected asset subset, call aida_apply_governance to copy them into the project (revert via aida_undo).',
    ],
  };
}

export function parsePlugin(pluginPath: string): { path: string; files: Array<{ path: string; excerpt: string }>; risk: PluginRiskReport } {
  const resolvedPath = ensurePluginPath(pluginPath);
  const files = walkFiles(resolvedPath).map((file) => ({ path: file, excerpt: excerpt(readText(file), 300) }));
  return { path: resolvedPath, files, risk: auditPluginRisk(resolvedPath) };
}

export function buildClaudePlugin(projectRoot: string, input: BuildPluginInput): { success: boolean; outputPath: string; filesWritten: string[]; message: string } {
  const index = loadAssetIndex(projectRoot);
  if (!index) throw new Error('No asset index found. Run aida_scan_assets first.');
  if (!Array.isArray(input.assetIds) || input.assetIds.length === 0) throw new Error('Select at least one asset before building a plugin.');
  const outputPath = resolve(pluginsDir(projectRoot), slugify(input.name));
  ensureDir(outputPath);
  const filesWritten: string[] = [];
  const selected = index.assets.filter((asset) => input.assetIds.includes(asset.id));
  if (selected.length === 0) throw new Error('No matching assets were found for the selected asset IDs.');
  const manifest = {
    schemaVersion: '3.0',
    exporter: 'claude',
    name: slugify(input.name),
    title: input.name,
    description: input.description,
    version: input.version || '0.1.0',
    builtAt: isoNow(),
    assets: selected.map((asset) => ({ id: asset.id, type: asset.type, name: asset.name, sourcePath: asset.sourcePath, sourceTool: asset.sourceTool })),
  };
  writeJson(resolve(outputPath, 'plugin.json'), manifest);
  filesWritten.push(resolve(outputPath, 'plugin.json'));
  for (const asset of selected) {
    const content = asset.content || asset.contentExcerpt;
    if (asset.type === 'skill') {
      const dir = resolve(outputPath, 'skills', slugify(asset.name));
      ensureDir(dir);
      writeText(resolve(dir, 'SKILL.md'), content.endsWith('\n') ? content : `${content}\n`);
      filesWritten.push(resolve(dir, 'SKILL.md'));
    } else if (asset.type === 'rule') {
      const path = resolve(outputPath, 'rules', `${slugify(asset.name)}.md`);
      ensureDir(resolve(path, '..'));
      writeText(path, `# ${asset.title}\n\n${content}\n`);
      filesWritten.push(path);
    } else {
      const path = resolve(outputPath, 'assets', asset.type, `${slugify(asset.name || basename(asset.sourcePath))}.md`);
      ensureDir(resolve(path, '..'));
      writeText(path, `# ${asset.title}\n\nSource: ${asset.sourcePath}\n\n${content}\n`);
      filesWritten.push(path);
    }
  }
  const risk = auditPluginRisk(outputPath);
  writeJson(resolve(outputPath, 'aida-risk-report.json'), risk);
  filesWritten.push(resolve(outputPath, 'aida-risk-report.json'));
  return {
    success: true,
    outputPath,
    filesWritten,
    message: `Built plugin with ${selected.length} asset(s). Review plugin.json and the risk report before sharing.`,
  };
}
