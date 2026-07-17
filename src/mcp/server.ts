import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { BOOTSTRAP_MANIFEST, type BootstrapDecision, type BootstrapHost, getBootstrapStatus, saveBootstrapDecision } from '../utils/bootstrap.js';
import { configPath } from '../utils/paths.js';
import { fileExists, readJson, readText, writeText } from '../utils/fs.js';
import { buildMemoryViews, loadModuleMemory, loadRunContext, loadRunMemoryPack, rebuildCurrentBranchMemory, searchModuleMemories, updateRunContext, upsertModuleMemory } from '../utils/memory.js';
import { getBranchName } from '../utils/git.js';
import { moduleMemoryPath, runContextPath } from '../utils/paths.js';
import { scanAssets } from '../core/assets/scanner.js';
import { getAsset, listAssets } from '../core/assets/query.js';
import { auditPluginRisk, buildClaudePlugin, parsePlugin } from '../core/plugins/plugins.js';
import { appendUndoEntry, applyUndo, listUndoEntries, snapshotFileForUndo } from '../core/undo/undo.js';
import { getDecision, listDecisions, writeDecision } from '../core/memory/decisions.js';
import { buildSelfPlugin } from '../core/builtin-skills.js';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

let useContentLength = true;
let projectRoot = process.cwd();
let undoSeq = 0;

function sendResponse(res: JsonRpcResponse): void {
  const json = JSON.stringify(res);
  if (useContentLength) {
    process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
  } else {
    process.stdout.write(`${json}\n`);
  }
}

function sendResult(id: number | string | null, result: any): void {
  sendResponse({ jsonrpc: '2.0', id, result });
}

function sendError(id: number | string | null, code: number, message: string): void {
  sendResponse({ jsonrpc: '2.0', id, error: { code, message } });
}

const TOOL_DEFINITIONS = [
  {
    name: 'aida_bootstrap',
    description: 'Check AIDA MCP availability, show grouped authorization manifest, and record local bootstrap authorization state.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'manifest', 'complete'] },
        host: { type: 'string', enum: ['codex', 'cursor', 'claude-code'] },
        decision: { type: 'string', enum: ['approved', 'declined', 'deferred'] },
        approvedToolNames: { type: 'array', items: { type: 'string' } },
        acknowledgedReason: { type: 'boolean' },
      },
    },
  },
  {
    name: 'aida_memory',
    description: 'Compatibility memory tool for module memories and branch context. Use for legacy AIDA memory retrieval/upsert when relevant.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['search', 'get', 'upsert', 'context-get', 'context-update', 'context-rebuild', 'pack'] },
        query: { type: 'string' },
        pathHints: { type: 'array', items: { type: 'string' } },
        moduleKey: { type: 'string' },
        title: { type: 'string' },
        summary: { type: 'string' },
        keywords: { type: 'array', items: { type: 'string' } },
        entryFiles: { type: 'array', items: { type: 'string' } },
        relatedPaths: { type: 'array', items: { type: 'string' } },
        dataFlow: { type: 'array', items: { type: 'string' } },
        decisions: { type: 'array', items: { type: 'string' } },
        constraints: { type: 'array', items: { type: 'string' } },
        pitfalls: { type: 'array', items: { type: 'string' } },
        relatedRules: { type: 'array', items: { type: 'string' } },
        ticket: { type: 'string' },
        branch: { type: 'string' },
        referenceSummary: { type: 'string' },
        currentPhase: { type: 'string' },
        modules: { type: 'array', items: { type: 'string' } },
        completed: { type: 'array', items: { type: 'string' } },
        inProgress: { type: 'array', items: { type: 'string' } },
        next: { type: 'array', items: { type: 'string' } },
        keyFiles: { type: 'array', items: { type: 'string' } },
        risks: { type: 'array', items: { type: 'string' } },
      },
      required: ['action'],
    },
  },
  {
    name: 'aida_scan_assets',
    description: 'Scan Claude/Cursor/Codex/AIDA/generic dot-dir AI assets. Discovers and structures evidence; the model judges semantics through built-in skills.',
    inputSchema: {
      type: 'object',
      properties: {
        includeContent: { type: 'boolean' },
        writeIndex: { type: 'boolean' },
        maxFileBytes: { type: 'number' },
        maxDepthForUnknownDotDirs: { type: 'number' },
      },
    },
  },
  {
    name: 'aida_list_assets',
    description: 'List assets from the latest AIDA scan cache.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        sourceTool: { type: 'string' },
        query: { type: 'string' },
        includeContent: { type: 'boolean' },
        rescan: { type: 'boolean' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'aida_get_asset',
    description: 'Read one scanned asset by id. Use includeContent=true when the model needs to inspect exact content.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        includeContent: { type: 'boolean' },
      },
      required: ['id'],
    },
  },
  {
    name: 'aida_build_plugin',
    description: 'Build a Claude plugin export from freely selected asset IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        version: { type: 'string' },
        assetIds: { type: 'array', items: { type: 'string' } },
        target: { type: 'string', enum: ['claude'] },
      },
      required: ['name', 'description', 'assetIds'],
    },
  },
  {
    name: 'aida_parse_plugin',
    description: 'Parse an external local plugin path without executing anything. Use before selective install.',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'aida_build_self_plugin',
    description: 'Package all built-in AIDA skills into a self-contained plugin directory for team sharing. Outputs to .aida/plugins/aida-<version>/ by default.',
    inputSchema: {
      type: 'object',
      properties: {
        outputDir: { type: 'string', description: 'Optional output directory path. Defaults to .aida/plugins/aida-<version>/' },
        version: { type: 'string', description: 'Plugin version. Defaults to current AIDA version.' },
      },
    },
  },
  {
    name: 'aida_audit_plugin_risk',
    description: 'Static risk audit for imported plugin contents. Does not execute hooks, scripts, commands, or MCP servers.',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'aida_remember',
    description: 'Persist a project decision as a MADR-format markdown file in .claude/rules/decisions/. Use paths frontmatter to scope loading to relevant files. Called by aida-remember and aida-remember-branch skills.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Decision title, e.g. "Use optimistic locking for cart updates"' },
        context: { type: 'string', description: 'Why this decision was needed — the problem, constraints, alternatives considered' },
        decision: { type: 'string', description: 'What was decided and why' },
        consequences: { type: 'string', description: 'Trade-offs, things that break, things that improve' },
        paths: { type: 'array', items: { type: 'string' }, description: 'File glob patterns that scope this decision (Claude Code paths frontmatter). E.g. ["src/cart/**"]' },
        tags: { type: 'array', items: { type: 'string' } },
        slug: { type: 'string', description: 'Optional filename slug override. Defaults to slugified title.' },
      },
      required: ['title', 'context', 'decision'],
    },
  },
  {
    name: 'aida_recall',
    description: 'List or get project decisions from .claude/rules/decisions/.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get'] },
        slug: { type: 'string', description: 'Required for action=get' },
      },
      required: ['action'],
    },
  },
  {
    name: 'aida_apply_governance',
    description: 'Apply a list of structured file operations (create/modify/delete/move) to project AI assets. All operations are journaled for aida_undo. Called by aida-cleanup and other governance skills after user confirms the plan.',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Human-readable summary of what this batch does, e.g. "remove 12 duplicate rule lines"' },
        operations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              op: { type: 'string', enum: ['create-file', 'modify-file', 'delete-file', 'remove-lines'] },
              path: { type: 'string', description: 'Relative path from project root' },
              content: { type: 'string', description: 'For create-file / modify-file: new file content' },
              lines: { type: 'array', items: { type: 'number' }, description: 'For remove-lines: 1-based line numbers to delete' },
            },
            required: ['op', 'path'],
          },
        },
      },
      required: ['description', 'operations'],
    },
  },
  {
    name: 'aida_write_analysis',
    description: 'Persist a structured feature/branch analysis as a module memory. Called by the aida-analyze skill after gathering facts from git diff and source files.',
    inputSchema: {
      type: 'object',
      properties: {
        moduleKey: { type: 'string', description: 'Primary module key, kebab-case path format, e.g. "auth/login"' },
        title: { type: 'string' },
        summary: { type: 'string' },
        ticket: { type: 'string' },
        branch: { type: 'string' },
        decisions: { type: 'array', items: { type: 'string' } },
        constraints: { type: 'array', items: { type: 'string' } },
        entryFiles: { type: 'array', items: { type: 'string' } },
        relatedPaths: { type: 'array', items: { type: 'string' } },
        keywords: { type: 'array', items: { type: 'string' } },
        pitfalls: { type: 'array', items: { type: 'string' } },
      },
      required: ['moduleKey', 'summary'],
    },
  },
  {
    name: 'aida_undo',
    description: 'List recent AIDA write operations or undo the last one (or a specific one by id). Only operations instrumented by AIDA tools are undoable.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'undo'] },
        id: { type: 'string', description: 'Optional entry id. Omit to undo the most recent entry.' },
      },
      required: ['action'],
    },
  },
];

const PROMPTS = [
  { name: 'aida-3-guide', description: 'AIDA 3.0 MCP-first asset governance guide' },
];

const PROMPT_CONTENT = [
  'AIDA 3.0 is MCP-first.',
  'Use AIDA tools to scan and structure project AI assets, then use built-in AIDA skills to let the model make semantic governance decisions.',
  'Do not directly merge, delete, rewrite, import, or install high-risk assets without the user reviewing first.',
  '',
  'Key tools:',
  '- aida_scan_assets / aida_list_assets / aida_get_asset: discover and inspect assets',
  '- aida_build_plugin / aida_parse_plugin / aida_audit_plugin_risk: plugin operations',
  '- aida_memory: module memory and branch context (legacy compat)',
  '- aida_bootstrap: session authorization flow',
].join('\n');

function preferredBootstrapHost(): BootstrapHost {
  if (!fileExists(configPath(projectRoot))) return 'codex';
  try {
    const config = readJson<{ aiTools?: string[]; aiTool?: string }>(configPath(projectRoot));
    const tools = Array.isArray(config.aiTools) ? config.aiTools : config.aiTool ? [config.aiTool] : [];
    if (tools.includes('codex')) return 'codex';
    if (tools.includes('cursor')) return 'cursor';
    if (tools.includes('claude-code') || tools.includes('claude')) return 'claude-code';
  } catch {
    // Fall through to default.
  }
  return 'codex';
}

function normalizeBootstrapHost(value: unknown): BootstrapHost {
  return value === 'cursor' || value === 'claude-code' || value === 'codex' ? value : preferredBootstrapHost();
}

function handleBootstrap(args: any): any {
  const action = `${args.action || 'status'}`.trim();
  const host = normalizeBootstrapHost(args.host);
  const sessionAvailable = true;
  switch (action) {
    case 'status': {
      const status = getBootstrapStatus(projectRoot, host, { sessionAvailable });
      return { success: true, host, available: status.available, configured: status.configured, sessionAvailable: status.sessionAvailable, needsBootstrap: status.needsBootstrap, cached: status.record, nextSteps: status.nextSteps, manifestVersion: status.manifest.version };
    }
    case 'manifest': {
      const status = getBootstrapStatus(projectRoot, host, { sessionAvailable });
      return { success: true, host, available: status.available, configured: status.configured, sessionAvailable: status.sessionAvailable, required: true, reason: BOOTSTRAP_MANIFEST.reason, groupedTools: BOOTSTRAP_MANIFEST.groupedTools, nextSteps: status.nextSteps, manifestVersion: BOOTSTRAP_MANIFEST.version };
    }
    case 'complete': {
      const decision = `${args.decision || 'approved'}`.trim() as BootstrapDecision;
      const record = saveBootstrapDecision(projectRoot, host, decision, Array.isArray(args.approvedToolNames) ? args.approvedToolNames : [], args.acknowledgedReason !== false);
      return { success: true, host, decision: record.decision, completedAt: record.completedAt, approvedToolNames: record.approvedToolNames, manifestVersion: record.manifestVersion };
    }
    default:
      return { success: false, message: `unknown bootstrap action: ${action}` };
  }
}

function handleMemoryTool(args: any): any {
  const action = `${args.action || ''}`.trim();
  switch (action) {
    case 'search': {
      const query = `${args.query || ''}`.trim();
      if (!query) return { success: false, message: 'query is required' };
      return { success: true, query, hits: searchModuleMemories(projectRoot, query, Array.isArray(args.pathHints) ? args.pathHints : []) };
    }
    case 'get': {
      const moduleKey = `${args.moduleKey || ''}`.trim();
      if (!moduleKey) return { success: false, message: 'moduleKey is required' };
      const memory = loadModuleMemory(projectRoot, moduleKey);
      return memory ? { success: true, memory } : { success: false, message: `module memory not found: ${moduleKey}` };
    }
    case 'upsert': {
      const moduleKey = `${args.moduleKey || ''}`.trim();
      if (!moduleKey) return { success: false, message: 'moduleKey is required' };
      const memPath = moduleMemoryPath(projectRoot, moduleKey);
      const prevContent = snapshotFileForUndo(projectRoot, memPath);
      const record = upsertModuleMemory(projectRoot, {
        moduleKey,
        title: args.title,
        summary: args.summary,
        keywords: Array.isArray(args.keywords) ? args.keywords : [],
        entryFiles: Array.isArray(args.entryFiles) ? args.entryFiles : [],
        relatedPaths: Array.isArray(args.relatedPaths) ? args.relatedPaths : [],
        dataFlow: Array.isArray(args.dataFlow) ? args.dataFlow : [],
        decisions: Array.isArray(args.decisions) ? args.decisions : [],
        constraints: Array.isArray(args.constraints) ? args.constraints : [],
        pitfalls: Array.isArray(args.pitfalls) ? args.pitfalls : [],
        relatedRules: Array.isArray(args.relatedRules) ? args.relatedRules : [],
        tickets: [{ ticket: args.ticket || undefined, branch: args.branch || getBranchName(), summary: args.referenceSummary || args.summary || '', updatedAt: new Date().toISOString() }],
      });
      buildMemoryViews(projectRoot);
      appendUndoEntry(projectRoot, { id: `undo-${++undoSeq}-${Date.now()}`, tool: 'aida_memory:upsert', description: `upsert module memory: ${moduleKey}`, createdAt: new Date().toISOString(), actions: [{ kind: 'write-file', path: memPath, previousContent: prevContent }] });
      return { success: true, moduleKey: record.moduleKey, updatedAt: record.updatedAt };
    }
    case 'context-get': {
      const branch = `${args.branch || getBranchName()}`.trim();
      const context = loadRunContext(projectRoot, branch);
      return context ? { success: true, context } : { success: false, message: `context not found for branch: ${branch}` };
    }
    case 'context-update': {
      const branch = `${args.branch || getBranchName()}`.trim();
      const ctxPath = runContextPath(projectRoot, branch);
      const prevCtx = snapshotFileForUndo(projectRoot, ctxPath);
      const record = updateRunContext(projectRoot, {
        branch,
        ticket: args.ticket,
        title: args.title,
        summary: args.summary,
        currentPhase: args.currentPhase,
        modules: Array.isArray(args.modules) ? args.modules : [],
        completed: Array.isArray(args.completed) ? args.completed : [],
        inProgress: Array.isArray(args.inProgress) ? args.inProgress : [],
        next: Array.isArray(args.next) ? args.next : [],
        decisions: Array.isArray(args.decisions) ? args.decisions : [],
        constraints: Array.isArray(args.constraints) ? args.constraints : [],
        keyFiles: Array.isArray(args.keyFiles) ? args.keyFiles : [],
        risks: Array.isArray(args.risks) ? args.risks : [],
      });
      buildMemoryViews(projectRoot);
      appendUndoEntry(projectRoot, { id: `undo-${++undoSeq}-${Date.now()}`, tool: 'aida_memory:context-update', description: `update run context: ${branch}`, createdAt: new Date().toISOString(), actions: [{ kind: 'write-file', path: ctxPath, previousContent: prevCtx }] });
      return { success: true, branch: record.branch, updatedAt: record.updatedAt };
    }
    case 'context-rebuild': {
      const branch = `${args.branch || getBranchName()}`.trim();
      const result = rebuildCurrentBranchMemory(projectRoot, branch);
      return result.context ? { success: true, branch, modules: result.modules.map((item) => item.moduleKey), contextUpdatedAt: result.context.updatedAt } : { success: false, message: `no branch data found for ${branch}` };
    }
    case 'pack': {
      const branch = `${args.branch || getBranchName()}`.trim();
      const pack = loadRunMemoryPack(projectRoot, branch);
      return pack ? { success: true, branch, pack } : { success: false, message: `memory pack not found for branch: ${branch}` };
    }
    default:
      return { success: false, message: `unknown memory action: ${action}` };
  }
}

function handleTool(toolName: string, args: any): any {
  switch (toolName) {
    case 'aida_bootstrap': return handleBootstrap(args);
    case 'aida_memory': return handleMemoryTool(args);
    case 'aida_scan_assets': return scanAssets(projectRoot, args || {});
    case 'aida_list_assets': return { success: true, assets: listAssets(projectRoot, args || {}) };
    case 'aida_get_asset': return { success: true, asset: getAsset(projectRoot, args.id, args.includeContent !== false) };
    case 'aida_build_plugin': return buildClaudePlugin(projectRoot, args);
    case 'aida_parse_plugin': return { success: true, plugin: parsePlugin(String(args.path || '')) };
    case 'aida_build_self_plugin': {
      const ver = args.version ? `${args.version}`.trim() : '3.0.0';
      const defaultOut = resolve(projectRoot, '.aida', 'plugins', `aida-${ver}`);
      const outDir = args.outputDir ? resolve(projectRoot, `${args.outputDir}`.trim()) : defaultOut;
      const result = buildSelfPlugin(outDir, ver);
      return { success: true, outputPath: result.outputPath, skills: result.skills, filesWritten: result.files };
    }
    case 'aida_audit_plugin_risk': return { success: true, risk: auditPluginRisk(String(args.path || '')) };
    case 'aida_remember': {
      const title = `${args.title || ''}`.trim();
      if (!title) throw new Error('title is required');
      const context = `${args.context || ''}`.trim();
      const decision = `${args.decision || ''}`.trim();
      if (!context || !decision) throw new Error('context and decision are required');
      const decisionsDir = resolve(projectRoot, '.claude', 'rules', 'decisions');
      const slug = args.slug ? `${args.slug}`.trim() : undefined;
      const filePath = slug ? resolve(decisionsDir, `${slug}.md`) : null;
      const prevContent = filePath ? snapshotFileForUndo(projectRoot, filePath) : null;
      const result = writeDecision(projectRoot, {
        title,
        context,
        decision,
        consequences: args.consequences ? `${args.consequences}` : undefined,
        paths: Array.isArray(args.paths) ? args.paths : undefined,
        tags: Array.isArray(args.tags) ? args.tags : undefined,
        slug,
      });
      const absPath = result.filePath;
      appendUndoEntry(projectRoot, { id: `undo-${++undoSeq}-${Date.now()}`, tool: 'aida_remember', description: `remember: ${title}`, createdAt: new Date().toISOString(), actions: [{ kind: 'write-file', path: absPath, previousContent: prevContent }] });
      return { success: true, slug: result.slug, filePath: absPath, date: result.date };
    }
    case 'aida_recall': {
      const action = `${args.action || 'list'}`.trim();
      if (action === 'get') {
        const slug = `${args.slug || ''}`.trim();
        if (!slug) return { success: false, message: 'slug is required for get' };
        const d = getDecision(projectRoot, slug);
        return d ? { success: true, decision: d } : { success: false, message: `decision not found: ${slug}` };
      }
      return { success: true, decisions: listDecisions(projectRoot) };
    }
    case 'aida_apply_governance': {
      const description = `${args.description || 'governance batch'}`;
      const ops: any[] = Array.isArray(args.operations) ? args.operations : [];
      if (!ops.length) return { success: false, message: 'no operations provided' };

      const undoActions: any[] = [];
      const applied: string[] = [];
      const errors: string[] = [];

      for (const op of ops) {
        const relPath = `${op.path || ''}`.trim();
        if (!relPath) { errors.push('operation missing path'); continue; }
        const absPath = resolve(projectRoot, relPath);
        try {
          if (op.op === 'create-file' || op.op === 'modify-file') {
            const prev = snapshotFileForUndo(projectRoot, absPath);
            writeText(absPath, `${op.content || ''}`);
            undoActions.push({ kind: 'write-file', path: absPath, previousContent: prev });
            applied.push(`${op.op}: ${relPath}`);
          } else if (op.op === 'delete-file') {
            if (!existsSync(absPath)) { errors.push(`not found: ${relPath}`); continue; }
            const content = readText(absPath);
            unlinkSync(absPath);
            undoActions.push({ kind: 'delete-file', path: absPath, content });
            applied.push(`delete-file: ${relPath}`);
          } else if (op.op === 'remove-lines') {
            if (!existsSync(absPath)) { errors.push(`not found: ${relPath}`); continue; }
            const lines = Array.isArray(op.lines) ? (op.lines as number[]) : [];
            if (!lines.length) { errors.push(`remove-lines: no lines specified for ${relPath}`); continue; }
            const original = readText(absPath);
            const toRemove = new Set(lines.map((n) => n - 1)); // convert to 0-based
            const kept = original.split('\n').filter((_, i) => !toRemove.has(i));
            writeText(absPath, kept.join('\n'));
            undoActions.push({ kind: 'write-file', path: absPath, previousContent: original });
            applied.push(`remove-lines(${lines.join(',')}): ${relPath}`);
          } else {
            errors.push(`unknown op: ${op.op}`);
          }
        } catch (e) {
          errors.push(`${op.op} ${relPath}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (undoActions.length) {
        appendUndoEntry(projectRoot, { id: `undo-${++undoSeq}-${Date.now()}`, tool: 'aida_apply_governance', description, createdAt: new Date().toISOString(), actions: undoActions });
      }

      return { success: errors.length === 0, applied, errors, totalApplied: applied.length, undoable: undoActions.length > 0 };
    }
    case 'aida_write_analysis': {
      const moduleKey = `${args.moduleKey || ''}`.trim();
      if (!moduleKey) throw new Error('moduleKey is required');
      const memPath = moduleMemoryPath(projectRoot, moduleKey);
      const prevContent = snapshotFileForUndo(projectRoot, memPath);
      const branch = `${args.branch || getBranchName()}`.trim();
      const record = upsertModuleMemory(projectRoot, {
        moduleKey,
        title: args.title,
        summary: args.summary,
        keywords: Array.isArray(args.keywords) ? args.keywords : [],
        entryFiles: Array.isArray(args.entryFiles) ? args.entryFiles : [],
        relatedPaths: Array.isArray(args.relatedPaths) ? args.relatedPaths : [],
        decisions: Array.isArray(args.decisions) ? args.decisions : [],
        constraints: Array.isArray(args.constraints) ? args.constraints : [],
        pitfalls: Array.isArray(args.pitfalls) ? args.pitfalls : [],
        dataFlow: [],
        relatedRules: [],
        tickets: [{ ticket: args.ticket || undefined, branch, summary: args.summary || '', updatedAt: new Date().toISOString() }],
      });
      buildMemoryViews(projectRoot);
      appendUndoEntry(projectRoot, { id: `undo-${++undoSeq}-${Date.now()}`, tool: 'aida_write_analysis', description: `write analysis: ${moduleKey}`, createdAt: new Date().toISOString(), actions: [{ kind: 'write-file', path: memPath, previousContent: prevContent }] });
      return { success: true, moduleKey: record.moduleKey, updatedAt: record.updatedAt, path: memPath };
    }
    case 'aida_undo': {
      const action = `${args.action || 'list'}`.trim();
      if (action === 'list') return { success: true, entries: listUndoEntries(projectRoot) };
      return applyUndo(projectRoot, args.id ? String(args.id) : undefined);
    }
    default: throw new Error(`Unknown tool: ${toolName}`);
  }
}

function handleRequest(req: JsonRpcRequest): void {
  const { id, method, params } = req;
  switch (method) {
    case 'initialize':
      sendResult(id!, { protocolVersion: '2024-11-05', capabilities: { tools: {}, prompts: {} }, serverInfo: { name: 'aida', version: '3.0.0' } });
      break;
    case 'notifications/initialized':
      break;
    case 'tools/list':
      sendResult(id!, { tools: TOOL_DEFINITIONS });
      break;
    case 'tools/call': {
      try {
        const result = handleTool(params?.name, params?.arguments || {});
        sendResult(id!, { content: [{ type: 'text', text: JSON.stringify(result) }] });
      } catch (error) {
        sendResult(id!, { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }) }], isError: true });
      }
      break;
    }
    case 'prompts/list':
      sendResult(id!, { prompts: PROMPTS });
      break;
    case 'prompts/get':
      if (params?.name === 'aida-3-guide') {
        sendResult(id!, { messages: [{ role: 'user', content: { type: 'text', text: PROMPT_CONTENT } }] });
      } else {
        sendError(id!, -32601, `Unknown prompt: ${params?.name}`);
      }
      break;
    case 'ping':
      sendResult(id!, {});
      break;
    default:
      if (id !== undefined) sendError(id!, -32601, `Method not found: ${method}`);
  }
}

export function startMcpServer(): void {
  let buffer = '';
  let transportDetected = false;
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd !== -1) {
        const header = buffer.substring(0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (match) {
          if (!transportDetected) {
            useContentLength = true;
            transportDetected = true;
          }
          const contentLength = parseInt(match[1], 10);
          const bodyStart = headerEnd + 4;
          if (buffer.length < bodyStart + contentLength) break;
          const body = buffer.substring(bodyStart, bodyStart + contentLength);
          buffer = buffer.substring(bodyStart + contentLength);
          try { handleRequest(JSON.parse(body) as JsonRpcRequest); } catch { /* skip malformed */ }
          continue;
        }
      }
      const nlIdx = buffer.indexOf('\n');
      if (nlIdx === -1) break;
      const line = buffer.substring(0, nlIdx).trim();
      buffer = buffer.substring(nlIdx + 1);
      if (line) {
        if (!transportDetected) {
          useContentLength = false;
          transportDetected = true;
        }
        try { handleRequest(JSON.parse(line) as JsonRpcRequest); } catch { /* skip malformed */ }
      }
    }
  });
  process.stdin.on('end', () => process.exit(0));
}
