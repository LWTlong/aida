import { fileExists, readJson, writeJson } from './fs.js';
import { bootstrapStatePath, configPath } from './paths.js';
import type { AiToolChoice, AidaConfig } from '../schemas/aida-project.js';

export type BootstrapHost = 'codex' | 'cursor' | 'claude-code';
export type BootstrapDecision = 'approved' | 'declined' | 'deferred';

export interface BootstrapStateRecord {
  host: BootstrapHost
  manifestVersion: string
  decision: BootstrapDecision
  completedAt: string
  acknowledgedReason: boolean
  approvedToolNames: string[]
}

interface BootstrapStateFile {
  records: BootstrapStateRecord[]
}

export interface BootstrapManifest {
  version: string
  required: true
  reason: string
  groupedTools: Array<{
    name: string
    purpose: string
    coversLegacy: string[]
  }>
  hostHints: Record<BootstrapHost, string[]>
}

export const BOOTSTRAP_MANIFEST: BootstrapManifest = {
  version: '2026-04-27-v1',
  required: true,
  reason: '为避免开发过程中在 AIDA 数据采集、规则沉淀和记忆恢复时被权限确认中断，必须在开始真实任务前集中完成一次 AIDA MCP 授权确认。',
  groupedTools: [
    {
      name: 'aida_bootstrap',
      purpose: '检查 AIDA MCP 是否可用、读取集中授权清单、记录本地 bootstrap 状态',
      coversLegacy: [],
    },
    {
      name: 'aida_task',
      purpose: '记录任务生命周期，优先代替分散的 task_start/task_done 调用',
      coversLegacy: ['aida_task_start', 'aida_task_done'],
    },
    {
      name: 'aida_record',
      purpose: '集中记录文件、自检、偏差、Bug、规则和亮点，减少高频写操作的授权次数',
      coversLegacy: ['aida_log_files', 'aida_log_review', 'aida_log_bug', 'aida_bug_fix', 'aida_log_deviation', 'aida_highlight', 'aida_log_rule', 'aida_status'],
    },
    {
      name: 'aida_memory',
      purpose: '集中访问模块记忆和分支上下文，减少记忆相关工具的多次授权',
      coversLegacy: ['aida_memory_search', 'aida_memory_get', 'aida_memory_upsert', 'aida_context_get', 'aida_context_update', 'aida_context_rebuild', 'aida_memory_pack'],
    },
  ],
  hostHints: {
    codex: [
      '确认当前会话已读取项目中的 AIDA MCP 配置。',
      '如果 AIDA MCP 不可用，检查 .codex/config.toml 是否存在且包含 [mcp_servers.aida]。',
      '集中授权这些分组工具可以减少后续在任务记录过程中被中断。',
    ],
    cursor: [
      'Cursor 读取到 .cursor/mcp.json 后，仍可能需要在客户端内手动启用或批准该 MCP。',
      '如果 AIDA MCP 不可用，请先检查 Cursor 的 MCP 面板中是否已开启 aida。',
      '集中授权这些分组工具可以减少后续在任务记录过程中被中断。',
    ],
    'claude-code': [
      'Claude Code 可能需要先对项目级 .mcp.json 做批准。',
      '如果 AIDA MCP 不可用，请先在当前项目完成 MCP 批准。',
      '集中授权这些分组工具可以减少后续在任务记录过程中被中断。',
    ],
  },
};

function readState(projectRoot: string): BootstrapStateFile {
  const path = bootstrapStatePath(projectRoot);
  if (!fileExists(path)) return { records: [] };
  try {
    const parsed = readJson<BootstrapStateFile>(path);
    if (parsed && Array.isArray(parsed.records)) {
      return parsed;
    }
  } catch {
    // Fall through to empty state.
  }
  return { records: [] };
}

function writeState(projectRoot: string, state: BootstrapStateFile): void {
  writeJson(bootstrapStatePath(projectRoot), state);
}

export function getBootstrapStatus(projectRoot: string, host: BootstrapHost): {
  available: boolean
  host: BootstrapHost
  manifest: BootstrapManifest
  record: BootstrapStateRecord | null
  needsBootstrap: boolean
  nextSteps: string[]
} {
  const state = readState(projectRoot);
  const record = state.records.find((item) => item.host === host) || null;
  const available = detectBootstrapHostAvailability(projectRoot, host);
  const stale = !record || record.manifestVersion !== BOOTSTRAP_MANIFEST.version;
  const needsBootstrap = !available || stale || record?.decision !== 'approved';

  const nextSteps = available
    ? BOOTSTRAP_MANIFEST.hostHints[host]
    : unavailableHints(host);

  return {
    available,
    host,
    manifest: BOOTSTRAP_MANIFEST,
    record,
    needsBootstrap,
    nextSteps,
  };
}

export function saveBootstrapDecision(
  projectRoot: string,
  host: BootstrapHost,
  decision: BootstrapDecision,
  approvedToolNames: string[] = [],
  acknowledgedReason: boolean = true,
): BootstrapStateRecord {
  const state = readState(projectRoot);
  const next: BootstrapStateRecord = {
    host,
    manifestVersion: BOOTSTRAP_MANIFEST.version,
    decision,
    completedAt: new Date().toISOString(),
    acknowledgedReason,
    approvedToolNames,
  };
  state.records = state.records.filter((item) => item.host !== host);
  state.records.push(next);
  writeState(projectRoot, state);
  return next;
}

export function detectBootstrapHostAvailability(projectRoot: string, host: BootstrapHost): boolean {
  const config = readProjectConfig(projectRoot);
  const tools = Array.isArray(config.aiTools)
    ? config.aiTools
    : config.aiTool
      ? [config.aiTool]
      : [];

  switch (host) {
    case 'codex':
      return tools.includes('codex');
    case 'cursor':
      return tools.includes('cursor');
    case 'claude-code':
      return tools.includes('claude-code');
  }
}

function readProjectConfig(projectRoot: string): AidaConfig {
  if (!fileExists(configPath(projectRoot))) return {};
  try {
    return readJson<AidaConfig>(configPath(projectRoot));
  } catch {
    return {};
  }
}

function unavailableHints(host: BootstrapHost): string[] {
  switch (host) {
    case 'cursor':
      return [
        '当前项目未检测到可用的 Cursor AIDA MCP 配置或客户端未启用该 MCP。',
        '请检查 .cursor/mcp.json 是否存在，并在 Cursor MCP 面板中手动开启/批准 aida。',
      ];
    case 'claude-code':
      return [
        '当前项目未检测到可用的 Claude Code AIDA MCP 配置。',
        '请检查 .mcp.json 是否存在，并在 Claude Code 当前项目中完成 MCP 批准。',
      ];
    case 'codex':
      return [
        '当前项目未检测到可用的 Codex AIDA MCP 配置。',
        '请检查 .codex/config.toml 是否存在且包含 [mcp_servers.aida]，并确认当前会话已加载该配置。',
      ];
  }
}
