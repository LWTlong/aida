import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { fileExists, readJson, readText } from '../../utils/fs.js';
import { excerpt, isoNow, sha256Short, slugify, unique } from '../shared.js';
import { saveAssetIndex } from './store.js';
import type { AidaAsset, AidaAssetIndex, AidaAssetType, AidaConfidence, AidaSourceTool, ScanAssetsOptions } from './types.js';

const DEFAULT_MAX_FILE_BYTES = 512 * 1024;
const DEFAULT_UNKNOWN_DEPTH = 3;
const TEXT_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.json', '.jsonc', '.yaml', '.yml', '.toml', '.ts', '.js', '.mjs', '.cjs', '.sh', '.bash', '.zsh']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'dist-test', 'build', 'coverage', '.cache', '.next', '.nuxt', '.turbo', '.svelte-kit', '.output', '.venv', 'venv', '.idea']);
const KNOWN_AI_DOT_DIRS = new Set(['.claude', '.cursor', '.codex', '.aida']);
const DOC_NAME_SIGNALS: Array<[RegExp, string]> = [
  [/summary|总结/i, 'filename-summary'],
  [/plan|规划|方案/i, 'filename-plan'],
  [/fix|修复/i, 'filename-fix'],
  [/debug|排查/i, 'filename-debug'],
  [/analysis|分析/i, 'filename-analysis'],
  [/temp|temporary|临时/i, 'filename-temporary'],
];

function formatOf(path: string): AidaAsset['source']['format'] {
  const ext = extname(path).toLowerCase();
  if (ext === '.md' || ext === '.mdx') return 'markdown';
  if (ext === '.json' || ext === '.jsonc') return 'json';
  if (ext === '.toml') return 'toml';
  if (ext === '.yaml' || ext === '.yml') return 'yaml';
  if (ext === '.txt') return 'text';
  return 'unknown';
}

function isTextCandidate(path: string): boolean {
  return TEXT_EXTENSIONS.has(extname(path).toLowerCase());
}

function stableId(type: AidaAssetType, sourceTool: AidaSourceTool, sourcePath: string, suffix = ''): string {
  const raw = `${type}:${sourceTool}:${sourcePath}:${suffix}`;
  return `${type}:${sourceTool}:${createHash('sha1').update(raw).digest('hex').slice(0, 12)}`;
}

function safeRead(projectRoot: string, relPath: string, maxBytes: number): string | null {
  const full = resolve(projectRoot, relPath);
  if (!fileExists(full)) return null;
  const stat = statSync(full);
  if (stat.size > maxBytes) return null;
  try { return readText(full); } catch { return null; }
}

function makeAsset(args: {
  projectRoot: string
  type: AidaAssetType
  sourceTool: AidaSourceTool
  sourceRoot: string
  sourcePath: string
  content: string
  name?: string
  title?: string
  signals?: string[]
  tags?: string[]
  confidence?: AidaConfidence
  managedByAida?: boolean
  needsModelConfirmation?: boolean
  includeContent?: boolean
  suffix?: string
  metadata?: Record<string, unknown>
}): AidaAsset {
  const name = args.name || slugify(args.title || basename(args.sourcePath, extname(args.sourcePath)) || args.type);
  const signals = unique(args.signals || []);
  return {
    id: stableId(args.type, args.sourceTool, args.sourcePath, args.suffix),
    type: args.type,
    name,
    title: args.title || name,
    sourceTool: args.sourceTool,
    sourcePath: args.sourcePath,
    source: {
      tool: args.sourceTool,
      root: args.sourceRoot,
      path: args.sourcePath,
      format: formatOf(args.sourcePath),
    },
    contentHash: sha256Short(args.content),
    contentExcerpt: excerpt(args.content),
    content: args.includeContent ? args.content : undefined,
    status: 'active',
    tags: unique(args.tags || []),
    signals,
    confidence: args.confidence || 'high',
    managedByAida: args.managedByAida || args.sourcePath.startsWith('.aida/'),
    needsModelConfirmation: (args.needsModelConfirmation ?? args.sourceTool === 'unknown') || args.confidence === 'low',
    metadata: args.metadata || {},
  };
}

function addFileAsset(assets: AidaAsset[], projectRoot: string, relPath: string, type: AidaAssetType, sourceTool: AidaSourceTool, signals: string[], options: Required<Pick<ScanAssetsOptions, 'includeContent' | 'maxFileBytes'>> & ScanAssetsOptions, confidence: AidaConfidence = 'high'): void {
  const content = safeRead(projectRoot, relPath, options.maxFileBytes);
  if (content === null) return;
  assets.push(makeAsset({
    projectRoot,
    type,
    sourceTool,
    sourceRoot: relPath.split('/')[0] || '.',
    sourcePath: relPath,
    content,
    signals,
    confidence,
    includeContent: options.includeContent,
    needsModelConfirmation: confidence !== 'high',
  }));
}

function addMarkdownRuleLines(assets: AidaAsset[], projectRoot: string, relPath: string, sourceTool: AidaSourceTool, content: string, includeContent: boolean): void {
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const isRule = /^[-*]\s+\[?RULE[-\d\]]*/i.test(trimmed) || /must|必须|禁止|不得|严禁|should|不允许/i.test(trimmed);
    if (!isRule || trimmed.length < 8) return;
    assets.push(makeAsset({
      projectRoot,
      type: 'rule',
      sourceTool,
      sourceRoot: relPath.split('/')[0] || '.',
      sourcePath: relPath,
      content: trimmed,
      title: trimmed.replace(/^[-*]\s*/, '').slice(0, 80),
      signals: ['markdown-rule-line', `line:${index + 1}`],
      confidence: 'medium',
      includeContent,
      suffix: `line-${index + 1}`,
      needsModelConfirmation: true,
      metadata: { line: index + 1 },
    }));
  });
}

function scanRuleRegistry(assets: AidaAsset[], projectRoot: string, relPath: string, sourceTool: AidaSourceTool, includeContent: boolean): void {
  const full = resolve(projectRoot, relPath);
  if (!fileExists(full)) return;
  try {
    const raw = readJson<any>(full);
    const items = Array.isArray(raw) ? raw : Array.isArray(raw.items) ? raw.items : [];
    items.forEach((item: any, index: number) => {
      const content = `${item.content || item.rule || item.title || ''}`.trim();
      if (!content) return;
      assets.push(makeAsset({
        projectRoot,
        type: 'rule',
        sourceTool,
        sourceRoot: '.aida',
        sourcePath: relPath,
        content,
        title: content.slice(0, 80),
        signals: ['aida-rule-registry'],
        tags: [item.category].filter(Boolean),
        confidence: 'high',
        includeContent,
        suffix: item.id || `${index}`,
        metadata: { registryId: item.id, status: item.status },
      }));
    });
  } catch {
    addFileAsset(assets, projectRoot, relPath, 'tool-config', sourceTool, ['invalid-json'], { includeContent, maxFileBytes: DEFAULT_MAX_FILE_BYTES }, 'low');
  }
}

function scanSkillRegistry(assets: AidaAsset[], projectRoot: string, relPath: string, includeContent: boolean): void {
  const full = resolve(projectRoot, relPath);
  if (!fileExists(full)) return;
  try {
    const raw = readJson<any>(full);
    const items = Array.isArray(raw) ? raw : Array.isArray(raw.items) ? raw.items : [];
    items.forEach((item: any, index: number) => {
      const content = `${item.content || ''}`.trim();
      if (!content) return;
      assets.push(makeAsset({
        projectRoot,
        type: 'skill',
        sourceTool: 'aida',
        sourceRoot: '.aida',
        sourcePath: relPath,
        content,
        name: item.name,
        title: item.name || item.id || `skill-${index + 1}`,
        signals: ['aida-skill-registry'],
        confidence: 'high',
        includeContent,
        suffix: item.id || item.name || `${index}`,
        metadata: { registryId: item.id, files: item.files || [] },
      }));
    });
  } catch {
    // Ignore broken legacy registry; generic scan will still surface the file.
  }
}

function scanSkillDirs(assets: AidaAsset[], projectRoot: string, rootRel: string, sourceTool: AidaSourceTool, includeContent: boolean, maxBytes: number): void {
  const root = resolve(projectRoot, rootRel);
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    const full = resolve(root, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      const skillRel = `${rootRel}/${name}/SKILL.md`;
      const content = safeRead(projectRoot, skillRel, maxBytes);
      if (content === null) continue;
      assets.push(makeAsset({ projectRoot, type: 'skill', sourceTool, sourceRoot: rootRel, sourcePath: skillRel, content, name, title: name, signals: ['skill-package'], includeContent }));
    } else if (stat.isFile() && name.endsWith('.md')) {
      const rel = `${rootRel}/${name}`;
      const content = safeRead(projectRoot, rel, maxBytes);
      if (content === null) continue;
      const skillName = basename(name, '.md');
      assets.push(makeAsset({ projectRoot, type: 'skill', sourceTool, sourceRoot: rootRel, sourcePath: rel, content, name: skillName, title: skillName, signals: ['skill-markdown'], includeContent }));
    }
  }
}

function walk(projectRoot: string, rootRel: string, maxDepth: number, maxBytes: number, onFile: (relPath: string) => void): void {
  const root = resolve(projectRoot, rootRel);
  if (!existsSync(root)) return;
  const stack: Array<{ rel: string; depth: number }> = [{ rel: rootRel, depth: 0 }];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const full = resolve(projectRoot, current.rel);
    for (const name of readdirSync(full)) {
      const rel = `${current.rel}/${name}`.replace(/\/+/g, '/');
      const stat = statSync(resolve(projectRoot, rel));
      if (stat.isDirectory()) {
        if (SKIP_DIRS.has(name) || current.depth >= maxDepth) continue;
        stack.push({ rel, depth: current.depth + 1 });
      } else if (stat.isFile() && stat.size <= maxBytes && isTextCandidate(rel)) {
        onFile(rel);
      }
    }
  }
}

function scanDocSignals(relPath: string): string[] {
  const signals = ['markdown-doc'];
  for (const [pattern, signal] of DOC_NAME_SIGNALS) {
    if (pattern.test(relPath)) signals.push(signal);
  }
  if (!relPath.includes('/')) signals.push('root-markdown');
  return signals;
}

export function scanAssets(projectRoot: string = process.cwd(), input: ScanAssetsOptions = {}): AidaAssetIndex {
  const options = {
    includeContent: input.includeContent ?? false,
    writeIndex: input.writeIndex ?? true,
    maxFileBytes: input.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
    maxDepthForUnknownDotDirs: input.maxDepthForUnknownDotDirs ?? DEFAULT_UNKNOWN_DEPTH,
  };
  const assets: AidaAsset[] = [];

  for (const rel of ['CLAUDE.md', 'AGENTS.md', '.github/copilot-instructions.md']) {
    const sourceTool: AidaSourceTool = rel === 'CLAUDE.md' ? 'claude' : rel === 'AGENTS.md' ? 'codex' : 'generic';
    const content = safeRead(projectRoot, rel, options.maxFileBytes);
    if (content === null) continue;
    assets.push(makeAsset({ projectRoot, type: 'doc', sourceTool, sourceRoot: rel, sourcePath: rel, content, signals: ['project-instructions'], confidence: 'high', includeContent: options.includeContent }));
    addMarkdownRuleLines(assets, projectRoot, rel, sourceTool, content, options.includeContent);
  }

  scanRuleRegistry(assets, projectRoot, '.aida/rules.json', 'aida', options.includeContent);
  scanSkillRegistry(assets, projectRoot, '.aida/skills.json', options.includeContent);

  // Walk .aida/rules/*.md as rule assets (not just rules.json which may be empty)
  walk(projectRoot, '.aida/rules', 2, options.maxFileBytes, (rel) => {
    if (!rel.endsWith('.md')) return;
    if (basename(rel) === '_all.md') return; // auto-generated combined file, skip
    const content = safeRead(projectRoot, rel, options.maxFileBytes);
    if (content !== null) {
      addFileAsset(assets, projectRoot, rel, 'rule', 'aida', ['aida-rule-file'], options);
      addMarkdownRuleLines(assets, projectRoot, rel, 'aida', content, options.includeContent);
    }
  });

  // Walk .aida/skills-v1-archive as deprecated skill assets
  walk(projectRoot, '.aida/skills-v1-archive', 2, options.maxFileBytes, (rel) => {
    if (!rel.endsWith('.md')) return;
    const content = safeRead(projectRoot, rel, options.maxFileBytes);
    if (content !== null) {
      const skillName = basename(rel, '.md');
      assets.push(makeAsset({ projectRoot, type: 'skill', sourceTool: 'aida', sourceRoot: '.aida/skills-v1-archive', sourcePath: rel, content, name: skillName, title: skillName, signals: ['skill-v1-archive', 'deprecated'], confidence: 'high', includeContent: options.includeContent, metadata: { deprecated: true } }));
    }
  });

  walk(projectRoot, '.aida/memories', 3, options.maxFileBytes, (rel) => {
    if (!rel.endsWith('.md')) return;
    addFileAsset(assets, projectRoot, rel, 'memory', 'aida', ['aida-memory'], options);
  });

  walk(projectRoot, '.aida/plugins', 2, options.maxFileBytes, (rel) => {
    addFileAsset(assets, projectRoot, rel, 'plugin', 'aida', ['aida-plugin'], options);
  });

  scanSkillDirs(assets, projectRoot, '.claude/skills', 'claude', options.includeContent, options.maxFileBytes);
  scanSkillDirs(assets, projectRoot, '.cursor/skills', 'cursor', options.includeContent, options.maxFileBytes);
  scanSkillDirs(assets, projectRoot, '.codex/skills', 'codex', options.includeContent, options.maxFileBytes);
  scanSkillDirs(assets, projectRoot, '.aida/assets/skills', 'aida', options.includeContent, options.maxFileBytes);

  for (const rel of ['.mcp.json', '.cursor/mcp.json', '.vscode/mcp.json', '.codex/config.toml']) {
    const sourceTool: AidaSourceTool = rel.startsWith('.cursor') ? 'cursor' : rel.startsWith('.codex') ? 'codex' : rel === '.mcp.json' ? 'claude' : 'generic';
    addFileAsset(assets, projectRoot, rel, 'mcp-config', sourceTool, ['mcp-config'], options);
  }

  walk(projectRoot, '.claude', 4, options.maxFileBytes, (rel) => {
    if (rel.includes('/skills/')) return;
    if (rel.includes('/commands/')) addFileAsset(assets, projectRoot, rel, 'command', 'claude', ['claude-command'], options);
    else if (rel.includes('/agents/')) addFileAsset(assets, projectRoot, rel, 'agent', 'claude', ['claude-agent'], options);
    else if (rel.endsWith('settings.json') || rel.endsWith('settings.local.json')) addFileAsset(assets, projectRoot, rel, 'tool-config', 'claude', ['claude-settings'], options);
    else if (rel.includes('/rules/decisions/') && rel.endsWith('.md')) {
      addFileAsset(assets, projectRoot, rel, 'memory', 'claude', ['claude-decision'], options);
    } else if (rel.includes('/rules/') && rel.endsWith('.md')) {
      const content = safeRead(projectRoot, rel, options.maxFileBytes);
      if (content !== null) {
        addFileAsset(assets, projectRoot, rel, 'rule', 'claude', ['claude-rule-file'], options);
        addMarkdownRuleLines(assets, projectRoot, rel, 'claude', content, options.includeContent);
      }
    }
  });

  walk(projectRoot, '.cursor', 4, options.maxFileBytes, (rel) => {
    if (rel.includes('/skills/')) return;
    if (rel.includes('/rules/')) {
      const content = safeRead(projectRoot, rel, options.maxFileBytes);
      if (content !== null) {
        addFileAsset(assets, projectRoot, rel, 'rule', 'cursor', ['cursor-rule-file'], options);
        addMarkdownRuleLines(assets, projectRoot, rel, 'cursor', content, options.includeContent);
      }
    } else if (rel.endsWith('.json') || rel.endsWith('.md')) addFileAsset(assets, projectRoot, rel, 'tool-config', 'cursor', ['cursor-config-candidate'], options, 'medium');
  });

  walk(projectRoot, '.codex', 4, options.maxFileBytes, (rel) => {
    if (rel.includes('/skills/')) return;
    addFileAsset(assets, projectRoot, rel, rel.endsWith('.md') ? 'doc' : 'tool-config', 'codex', ['codex-asset-candidate'], options, 'medium');
  });

  for (const rel of ['docs', 'doc']) {
    walk(projectRoot, rel, 4, options.maxFileBytes, (fileRel) => {
      if (fileRel.endsWith('.md') || fileRel.endsWith('.mdx')) addFileAsset(assets, projectRoot, fileRel, 'doc', 'generic', scanDocSignals(fileRel), options, 'medium');
    });
  }

  if (existsSync(projectRoot)) {
    for (const name of readdirSync(projectRoot)) {
      if (name.startsWith('.') && !KNOWN_AI_DOT_DIRS.has(name) && !SKIP_DIRS.has(name)) {
        const full = resolve(projectRoot, name);
        if (!statSync(full).isDirectory()) continue;
        walk(projectRoot, name, options.maxDepthForUnknownDotDirs, options.maxFileBytes, (rel) => {
          addFileAsset(assets, projectRoot, rel, 'doc', 'unknown', ['unknown-dot-dir', `source-root:${name}`], options, 'low');
        });
      }
      if ((name.endsWith('.md') || name.endsWith('.mdx')) && !['README.md', 'CLAUDE.md', 'AGENTS.md'].includes(name)) {
        addFileAsset(assets, projectRoot, name, 'doc', 'generic', scanDocSignals(name), options, 'medium');
      }
    }
  }

  const byId = new Map<string, AidaAsset>();
  for (const asset of assets) byId.set(asset.id, asset);
  const deduped = [...byId.values()].sort((a, b) => a.sourcePath.localeCompare(b.sourcePath) || a.type.localeCompare(b.type));
  const summary: Record<string, number> = {};
  for (const asset of deduped) summary[asset.type] = (summary[asset.type] || 0) + 1;
  const hashGroups = new Map<string, string[]>();
  for (const asset of deduped) {
    const ids = hashGroups.get(asset.contentHash) || [];
    ids.push(asset.id);
    hashGroups.set(asset.contentHash, ids);
  }
  const duplicateContentGroups = [...hashGroups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([hash, assetIds]) => ({ hash, assetIds }));
  const unknownDotDirs = unique(deduped.filter((asset) => asset.sourceTool === 'unknown').map((asset) => asset.source.root));

  const index: AidaAssetIndex = {
    schemaVersion: '3.0',
    generatedAt: isoNow(),
    projectRoot,
    assets: deduped,
    summary,
    signals: {
      duplicateContentGroups,
      unknownDotDirs,
      nextSteps: [
        'Ask your model to use the built-in aida-audit-ai-assets skill to interpret this asset map.',
        'Use proposals for every merge, rewrite, archive, import, or tool-sync action before applying changes.',
      ],
    },
  };

  if (options.writeIndex) saveAssetIndex(projectRoot, index);
  return index;
}
