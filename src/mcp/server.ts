/**
 * AIDA MCP Server
 *
 * Implements MCP (Model Context Protocol) over stdio using JSON-RPC 2.0.
 * Zero dependencies — raw stdin/stdout processing.
 *
 * Provides tools for AI agents to silently collect development data.
 */

import { execSync } from 'node:child_process';
import { fileExists, readJson, writeJson } from '../utils/fs.js';
import type {
  RunData,
  TaskItem,
  BugItem,
  DeviationItem,
  ReviewItem,
  FileItem,
  HighlightItem,
} from '../schemas/run-json.js';
import {
  SEVERITY_VALUES,
  BUG_SOURCE_VALUES,
  ROOT_CAUSE_VALUES,
  DEVIATION_CAT_VALUES,
  REVIEW_RESULT_VALUES,
  CHANGE_TYPE_VALUES,
  RULE_CATEGORIES,
} from '../schemas/run-json.js';
import {
  now,
  nextId,
  addEvent,
  addTimeline,
  resolveCurrentTaskId,
  saveRunData,
  ensureRunJson as ensureRunJsonShared,
} from '../utils/run-data.js';
import { collectClaudeTokens, collectClaudeTokensBetween } from '../utils/tokens.js';
import { getBranchName, getDevName } from '../utils/git.js';
import { addRule } from '../utils/rules.js';
import { buildProjectArtifacts } from '../utils/ai-build.js';
import { buildMemoryViews, loadModuleMemory, loadRunContext, loadRunMemoryPack, rebuildCurrentBranchMemory, searchModuleMemories, updateRunContext, upsertModuleMemory } from '../utils/memory.js';
import { BOOTSTRAP_MANIFEST, type BootstrapDecision, type BootstrapHost, getBootstrapStatus, saveBootstrapDecision } from '../utils/bootstrap.js';
import { configPath } from '../utils/paths.js';

// ─── JSON-RPC / MCP Protocol ─────────────────────────────

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

// Transport mode: auto-detected from first client message
let useContentLength = true;

function sendResponse(res: JsonRpcResponse): void {
  const json = JSON.stringify(res);
  if (useContentLength) {
    const msg = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
    process.stdout.write(msg);
  } else {
    process.stdout.write(json + '\n');
  }
}

function sendResult(id: number | string | null, result: any): void {
  sendResponse({ jsonrpc: '2.0', id, result });
}

function sendError(id: number | string | null, code: number, message: string): void {
  sendResponse({ jsonrpc: '2.0', id, error: { code, message } });
}

// ─── Project Root ────────────────────────────────────────

let projectRoot = process.cwd();

function ensureRunJson(): { path: string; data: RunData } {
  return ensureRunJsonShared(projectRoot);
}

function save(path: string, data: RunData): void {
  saveRunData(path, data, projectRoot);
}

// ─── Token Auto-Collection ───────────────────────────────

/**
 * Collect tokens from Claude Code session since run started,
 * and update run.json cost data.
 */
function syncTokenUsage(path: string, data: RunData): void {
  try {
    const startTime = data.meta?.startTime;
    if (!startTime) return;

    const usage = collectClaudeTokens(projectRoot, startTime);
    if (!usage) return;

    if (!data.cost) data.cost = {};
    data.cost.totalTokens = usage.totalTokens;

    // Store detailed breakdown
    (data.cost as any).tokenDetail = {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheCreationTokens: usage.cacheCreationTokens,
      cacheReadTokens: usage.cacheReadTokens,
    };

    writeJson(path, data);
  } catch {
    // Non-critical: don't break data collection if token reading fails
  }
}

/**
 * Collect tokens for a specific task time range.
 * Returns total tokens consumed during the task.
 */
function getTaskTokens(startTime: string, endTime: string): number {
  try {
    const usage = collectClaudeTokensBetween(projectRoot, startTime, endTime);
    return usage?.totalTokens || 0;
  } catch {
    return 0;
  }
}

// ─── MCP Tool Definitions ────────────────────────────────

const TOOLS = [
  {
    name: 'aida_bootstrap',
    description: '启动必检工具。开始任何真实开发任务前优先调用：检查 AIDA MCP 是否可用、返回集中授权清单、记录本地 bootstrap 授权状态，避免后续开发过程中因 AIDA 权限中断。',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'manifest', 'complete'], description: 'status=查询当前宿主的 AIDA MCP 可用性与缓存状态；manifest=返回需要集中授权的工具清单与说明；complete=将本地 bootstrap 状态写入缓存' },
        host: { type: 'string', enum: ['codex', 'cursor', 'claude-code'], description: '当前宿主 AI 工具' },
        decision: { type: 'string', enum: ['approved', 'declined', 'deferred'], description: '仅在 complete 时传入，表示用户对集中授权的决定' },
        approvedToolNames: { type: 'array', items: { type: 'string' }, description: '仅在 complete 时传入，本次已集中授权的工具名列表' },
        acknowledgedReason: { type: 'boolean', description: '仅在 complete 时传入，表示用户已知晓“授权前置是为了避免后续开发中断”的原因' },
      },
    },
  },
  {
    name: 'aida_task',
    description: '聚合任务工具。优先使用该工具代替 aida_task_start / aida_task_done，以减少授权次数。',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['start', 'done'], description: 'start=开始任务；done=完成任务' },
        title: { type: 'string', description: '任务标题；action=start 时必填' },
        stage: { type: 'string', description: '所属模块或阶段；action=start 时可选' },
        taskId: { type: 'string', description: '任务 ID；action=done 时必填' },
      },
      required: ['action'],
    },
  },
  {
    name: 'aida_record',
    description: '聚合记录工具。优先使用该工具代替 aida_log_files / aida_log_review / aida_log_bug / aida_bug_fix / aida_log_deviation / aida_highlight / aida_log_rule / aida_status，以减少授权次数。',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['files', 'review', 'bug', 'bug-fix', 'deviation', 'highlight', 'rule', 'status'], description: '记录文件、自检、Bug、偏差、亮点、规则或查询状态' },
        taskId: { type: 'string' },
        result: { type: 'string', enum: ['pass', 'fail'] },
        issues: { type: 'string' },
        scope: { type: 'string' },
        title: { type: 'string' },
        severity: { type: 'string', enum: [...SEVERITY_VALUES] },
        source: { type: 'string', enum: [...BUG_SOURCE_VALUES] },
        bugId: { type: 'string' },
        fix: { type: 'string' },
        rootCause: { type: 'string', enum: [...ROOT_CAUSE_VALUES] },
        category: { type: 'string', enum: [...DEVIATION_CAT_VALUES, ...RULE_CATEGORIES] },
        content: { type: 'string' },
        sourceDeviation: { type: 'string' },
      },
      required: ['action'],
    },
  },
  {
    name: 'aida_memory',
    description: '聚合记忆工具。优先使用该工具代替 aida_memory_search / aida_memory_get / aida_memory_upsert / aida_context_get / aida_context_update / aida_context_rebuild / aida_memory_pack，以减少授权次数。',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['search', 'get', 'upsert', 'context-get', 'context-update', 'context-rebuild', 'pack'], description: '统一的模块记忆与分支上下文入口' },
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
    name: 'aida_task_start',
    description: '当你开始一个新任务或功能开发时调用。在接到用户需求、开始编码前调用。每个任务的完整数据采集流程：1) aida_task_start 2) 编码 3) aida_log_files 4) aida_log_review 5) aida_task_done。多个子任务必须每个都单独 start/done。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '任务标题，简洁描述要做什么' },
        stage: { type: 'string', description: '所属模块或阶段，如 Authentication, UI, API 等' },
      },
      required: ['title'],
    },
  },
  {
    name: 'aida_task_done',
    description: '当你完成一个任务后调用。标记任务为已完成，自动计算耗时。',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '任务ID，如 TASK-01。如不确定，可调用 aida_status 查看。' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'aida_log_bug',
    description: '当你在开发或测试中发现 bug 时调用。记录 bug 信息。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Bug 描述' },
        severity: { type: 'string', enum: [...SEVERITY_VALUES], description: '严重程度：critical/high/medium/low，默认 medium' },
        source: { type: 'string', enum: [...BUG_SOURCE_VALUES], description: '发现来源：self-review/user-feedback/testing，默认 self-review' },
      },
      required: ['title'],
    },
  },
  {
    name: 'aida_bug_fix',
    description: '当你修复了一个 bug 后调用。标记 bug 为已修复。',
    inputSchema: {
      type: 'object',
      properties: {
        bugId: { type: 'string', description: 'Bug ID，如 BUG-01' },
        fix: { type: 'string', description: '修复方案简述' },
      },
      required: ['bugId'],
    },
  },
  {
    name: 'aida_log_review',
    description: '当你完成一轮代码审查后调用。记录审查结果。',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '关联的任务ID' },
        result: { type: 'string', enum: ['pass', 'fail'], description: '审查结果：pass 或 fail' },
        issues: { type: 'string', description: '发现的问题，逗号分隔。通过时不填。' },
        scope: { type: 'string', description: '审查覆盖的文件或模块范围' },
      },
      required: ['result'],
    },
  },
  {
    name: 'aida_log_deviation',
    description: '当 AI 产出与用户预期不符时调用。记录偏差用于后续分析。当 rootCause 为 rule-missing 时，修复后如果属于项目级技术规范（非业务逻辑），应询问用户是否沉淀为规则。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '偏差描述' },
        rootCause: { type: 'string', enum: [...ROOT_CAUSE_VALUES], description: '根因分类' },
        category: { type: 'string', enum: [...DEVIATION_CAT_VALUES], description: '偏差类别' },
      },
      required: ['title'],
    },
  },
  {
    name: 'aida_log_files',
    description: '记录文件变更。无需传参，自动扫描 git diff 获取变更文件列表和行数。在完成一轮代码修改后调用。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'aida_highlight',
    description: '记录值得关注的亮点，如性能提升、架构优化等。',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '亮点内容描述' },
      },
      required: ['content'],
    },
  },
  {
    name: 'aida_status',
    description: '查看当前开发运行的状态：任务列表、bug 数量、进度等。在需要了解当前进度时调用。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'aida_log_rule',
    description: '沉淀项目规则。当偏差的 rootCause 为 rule-missing 且修复方案属于项目级技术规范（非业务逻辑）时，询问用户同意后调用此工具沉淀规则。仅限：公共组件使用规范、API 调用规范、参数传递规范、代码风格/架构规范。禁止沉淀业务逻辑。',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '规则内容，简洁描述项目规范' },
        category: { type: 'string', enum: [...RULE_CATEGORIES], description: '规则分类' },
        sourceDeviation: { type: 'string', description: '关联的偏差 ID，如 DEV-01' },
      },
      required: ['content', 'category'],
    },
  },
  {
    name: 'aida_memory_search',
    description: '按模块名称、关键字或路径提示检索项目模块记忆目录。开始编码前应优先调用，用于判断是否存在可复用的模块上下文。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '要检索的模块名、需求关键词或功能名称' },
        pathHints: {
          type: 'array',
          items: { type: 'string' },
          description: '可选的路径提示，如 src/pages/profile, src/modules/order',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'aida_memory_get',
    description: '读取指定模块的长期记忆，包括摘要、关键文件、设计决策、约束和历史工单。',
    inputSchema: {
      type: 'object',
      properties: {
        moduleKey: { type: 'string', description: '模块 key，例如 profile, order-detail' },
      },
      required: ['moduleKey'],
    },
  },
  {
    name: 'aida_memory_upsert',
    description: '更新模块记忆 JSON 真源。用于在完成一个阶段后沉淀模块职责、关键文件、决策、约束和坑点。',
    inputSchema: {
      type: 'object',
      properties: {
        moduleKey: { type: 'string', description: '模块 key，例如 profile, order-detail' },
        title: { type: 'string', description: '模块标题' },
        summary: { type: 'string', description: '模块摘要' },
        keywords: { type: 'array', items: { type: 'string' } },
        entryFiles: { type: 'array', items: { type: 'string' } },
        relatedPaths: { type: 'array', items: { type: 'string' } },
        dataFlow: { type: 'array', items: { type: 'string' } },
        decisions: { type: 'array', items: { type: 'string' } },
        constraints: { type: 'array', items: { type: 'string' } },
        pitfalls: { type: 'array', items: { type: 'string' } },
        relatedRules: { type: 'array', items: { type: 'string' } },
        ticket: { type: 'string', description: '关联工单，如 MTR-001' },
        branch: { type: 'string', description: '关联分支，默认当前分支' },
        referenceSummary: { type: 'string', description: '本次工单在该模块上的简要说明' },
      },
      required: ['moduleKey'],
    },
  },
  {
    name: 'aida_context_get',
    description: '读取当前分支或指定分支的上下文摘要，用于恢复本次需求的近期工作记忆。',
    inputSchema: {
      type: 'object',
      properties: {
        branch: { type: 'string', description: '分支名，默认当前分支' },
      },
    },
  },
  {
    name: 'aida_context_update',
    description: '更新当前分支上下文 JSON 真源。用于沉淀本次需求的当前阶段、已完成项、下一步、关键文件和风险。',
    inputSchema: {
      type: 'object',
      properties: {
        branch: { type: 'string', description: '分支名，默认当前分支' },
        ticket: { type: 'string', description: '关联工单' },
        title: { type: 'string', description: '需求标题' },
        summary: { type: 'string', description: '需求摘要' },
        currentPhase: { type: 'string', description: '当前阶段，例如 In Progress / Completed' },
        modules: { type: 'array', items: { type: 'string' } },
        completed: { type: 'array', items: { type: 'string' } },
        inProgress: { type: 'array', items: { type: 'string' } },
        next: { type: 'array', items: { type: 'string' } },
        decisions: { type: 'array', items: { type: 'string' } },
        constraints: { type: 'array', items: { type: 'string' } },
        keyFiles: { type: 'array', items: { type: 'string' } },
        risks: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'aida_context_rebuild',
    description: '根据当前分支已有的 run.json、requirement.json、analysis.md 自动重建上下文和模块记忆。适合换机器、长时间中断后恢复记忆。',
    inputSchema: {
      type: 'object',
      properties: {
        branch: { type: 'string', description: '分支名，默认当前分支' },
      },
    },
  },
  {
    name: 'aida_memory_pack',
    description: '读取当前分支的聚合记忆包，包含分支上下文和命中的模块记忆，适合在编码前一次性恢复工作记忆。',
    inputSchema: {
      type: 'object',
      properties: {
        branch: { type: 'string', description: '分支名，默认当前分支' },
      },
    },
  },
];

// ─── MCP Prompts ─────────────────────────────────────────

const PROMPTS = [
  {
    name: 'aida-guide',
    description: 'AIDA 数据采集使用指南',
  },
];

const PROMPT_CONTENT = `你拥有 AIDA 数据采集工具，必须在开发过程中的关键节点调用，确保数据完整性。

开始任何真实开发任务前，严禁跳过以下前置动作：
1. 先调用 aida_bootstrap，action="status"，检查当前宿主中的 AIDA MCP 是否可用
2. 如果不可用，先提示用户检查并启用当前宿主中的 AIDA MCP（例如 Cursor 里可能需要手动打开/批准）
3. 如果可用，再调用 aida_bootstrap，action="manifest"，读取集中授权清单，向用户说明“提前授权是为了避免后续开发过程中被 AIDA 中断”
4. 用户做出授权决定后，调用 aida_bootstrap，action="complete"，把本地 bootstrap 状态缓存下来
5. 后续优先使用聚合工具 aida_task / aida_record / aida_memory，减少授权弹窗次数

每个任务的完整流程：
1. 开始前 → aida_task（action="start"，传入标题和所属模块）
2. 编码完成 → aida_record（action="files"，自动扫描 git diff，无需传参）
3. 自检代码 → aida_record（action="review"，pass/fail + 问题列表）
4. 任务完成 → aida_task（action="done"，传入任务 ID）

过程中遇到以下情况必须立即记录：
- 发现 Bug → aida_record（action="bug"），修复后 → aida_record（action="bug-fix"）
- 用户指出 AI 产出偏差 → aida_record（action="deviation"，传入描述、rootCause、category）
- 值得记录的亮点 → aida_record（action="highlight"）

偏差规则沉淀：
- 当 aida_record(action="deviation") 的 rootCause 为 rule-missing 时，修复后判断是否属于项目级技术规范（非业务逻辑）
- 如果是，询问用户是否沉淀为规则，用户同意后调用 aida_record（action="rule"，传入 content、category、sourceDeviation）

多任务场景下，每个子任务都必须单独 aida_task(action="start") 和 aida_task(action="done")。`;

function preferredBootstrapHost(): BootstrapHost {
  if (!fileExists(configPath(projectRoot))) return 'codex';
  try {
    const config = readJson<{ aiTools?: string[]; aiTool?: string }>(configPath(projectRoot));
    const tools = Array.isArray(config.aiTools)
      ? config.aiTools
      : config.aiTool
        ? [config.aiTool]
        : [];
    if (tools.includes('codex')) return 'codex';
    if (tools.includes('cursor')) return 'cursor';
    if (tools.includes('claude-code')) return 'claude-code';
  } catch {
    // Fall through to default.
  }
  return 'codex';
}

function normalizeBootstrapHost(value: unknown): BootstrapHost {
  return value === 'cursor' || value === 'claude-code' || value === 'codex'
    ? value
    : preferredBootstrapHost();
}

// ─── Tool Handlers ───────────────────────────────────────

function handleTaskStart(args: any): any {
  const { path, data } = ensureRunJson();
  const id = nextId(data.tasks, 'TASK');
  const task: TaskItem = {
    taskId: id,
    title: args.title,
    status: 'in-progress',
    stageName: args.stage || 'default',
    prdPhase: args.prdPhase || (data.context.currentPrdPhase as string) || '',
    acceptance: '',
    createdAt: now(),
    startedAt: now(),
    completedAt: null,
  };
  data.tasks.push(task);
  data.summary.totalTasks = data.tasks.length;
  data.context.currentTaskId = id;
  addEvent(data, 'task_created', { taskId: id });
  addEvent(data, 'task_started', { taskId: id });
  addTimeline(data, 'task', `${id}: ${args.title}`, task.prdPhase || undefined);
  save(path, data);
  refreshCurrentBranchMemory(data.meta.branch);
  return { success: true, taskId: id, message: `${id} 已记录并开始: ${args.title}` };
}

function refreshCurrentBranchMemory(branchName?: string): void {
  const branch = `${branchName || getBranchName()}`.trim();
  if (!branch) return;
  try {
    rebuildCurrentBranchMemory(projectRoot, branch);
  } catch {
    // Best-effort only; memory refresh must not block primary logging flow.
  }
}

function handleTaskDone(args: any): any {
  const { path, data } = ensureRunJson();
  const task = data.tasks.find(t => t.taskId === args.taskId);
  if (!task) return { success: false, message: `任务 ${args.taskId} 未找到` };

  task.status = 'done';
  task.completedAt = now();
  if (!task.startedAt) task.startedAt = task.createdAt || task.completedAt;
  data.summary.completedTasks = data.tasks.filter(t => t.status === 'done').length;
  data.context.currentTaskId = resolveCurrentTaskId(data.tasks);

  // Auto-collect tokens for this task
  let taskTokens = 0;
  if (task.startedAt && task.completedAt) {
    taskTokens = getTaskTokens(task.startedAt, task.completedAt);
    if (taskTokens > 0) {
      (task as any).tokensConsumed = taskTokens;
      // Add to cost breakdown
      if (!data.cost) data.cost = {};
      if (!data.cost.tokenBreakdown) data.cost.tokenBreakdown = [];
      data.cost.tokenBreakdown.push({
        stage: `task:${args.taskId}`,
        tokens: taskTokens,
      });
    }
  }

  addEvent(data, 'task_completed', { taskId: args.taskId, tokensConsumed: taskTokens });
  addTimeline(data, 'task-done', `${args.taskId}: ${task.title}`, task.prdPhase || undefined);
  save(path, data);
  refreshCurrentBranchMemory(data.meta.branch);

  // Sync total token usage from session
  syncTokenUsage(path, data);

  const tokenMsg = taskTokens > 0 ? ` (${taskTokens} tokens)` : '';
  return { success: true, message: `${args.taskId} 已完成${tokenMsg}` };
}

function handleLogBug(args: any): any {
  const severity = args.severity || 'medium';
  const source = args.source || 'self-review';
  const { path, data } = ensureRunJson();
  const id = nextId(data.bugs, 'BUG');
  const bug: BugItem = {
    bugId: id,
    title: args.title,
    severity: severity as BugItem['severity'],
    source: source as BugItem['source'],
    status: 'open',
    files: getChangedFiles(),
    fix: null,
    taskId: data.context.currentTaskId || null,
    reportedAt: now(),
    fixedAt: null,
  };
  data.bugs.push(bug);
  data.summary.bugCount = data.bugs.length;
  addEvent(data, 'bug_created', { bugId: id });
  addTimeline(data, 'bug', `${id}: ${args.title}`, (data.context.currentPrdPhase as string) || undefined);
  save(path, data);
  refreshCurrentBranchMemory(data.meta.branch);
  return { success: true, bugId: id, message: `${id} 已记录: ${args.title} [${severity}]` };
}

function handleBugFix(args: any): any {
  const { path, data } = ensureRunJson();
  const bug = data.bugs.find(b => b.bugId === args.bugId);
  if (!bug) return { success: false, message: `Bug ${args.bugId} 未找到` };

  bug.status = 'fixed';
  bug.fixedAt = now();
  if (args.fix) bug.fix = args.fix;

  // Auto-collect tokens for bug fix
  let bugTokens = 0;
  if (bug.reportedAt && bug.fixedAt) {
    bugTokens = getTaskTokens(bug.reportedAt, bug.fixedAt);
    if (bugTokens > 0) {
      (bug as any).tokensConsumed = bugTokens;
      if (!data.cost) data.cost = {};
      if (!data.cost.tokenBreakdown) data.cost.tokenBreakdown = [];
      data.cost.tokenBreakdown.push({
        stage: `bugfix:${args.bugId}`,
        tokens: bugTokens,
      });
    }
  }

  addEvent(data, 'bug_fixed', { bugId: args.bugId, tokensConsumed: bugTokens });
  addTimeline(data, 'bug-fix', `${args.bugId}: ${bug.title}`, (data.context.currentPrdPhase as string) || undefined);
  save(path, data);
  refreshCurrentBranchMemory(data.meta.branch);
  syncTokenUsage(path, data);

  const tokenMsg = bugTokens > 0 ? ` (${bugTokens} tokens)` : '';
  return { success: true, message: `${args.bugId} 已修复${tokenMsg}` };
}

function handleLogReview(args: any): any {
  const result = args.result || 'pass';
  const { path, data } = ensureRunJson();
  const id = `REV-${String((data.summary.reviewCount || 0) + 1).padStart(2, '0')}`;
  const issues = args.issues ? args.issues.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
  const review: ReviewItem = {
    reviewId: id,
    taskId: args.taskId || data.context.currentTaskId || null,
    result: result as ReviewItem['result'],
    issueCount: issues.length,
    scope: args.scope || '',
    reviewedAt: now(),
    issues,
  };
  data.reviews.push(review);
  data.summary.reviewCount = data.reviews.length;
  data.summary.reviewPassCount = data.reviews.filter(r => r.result === 'pass').length;
  data.summary.reviewFailCount = data.reviews.filter(r => r.result === 'fail').length;
  addEvent(data, 'review_created', { reviewId: id, result });
  addTimeline(data, 'review', `${id}: ${result}`, (data.context.currentPrdPhase as string) || undefined);
  save(path, data);
  refreshCurrentBranchMemory(data.meta.branch);
  syncTokenUsage(path, data);
  return { success: true, reviewId: id, message: `${id}: ${result}` };
}

function handleLogDeviation(args: any): any {
  const rootCause = args.rootCause || 'other';
  const category = args.category || 'other';
  const { path, data } = ensureRunJson();
  const id = nextId(data.deviations, 'DEV');
  const deviation: DeviationItem = {
    deviationId: id,
    title: args.title,
    rootCauseCategory: rootCause as DeviationItem['rootCauseCategory'],
    deviationCategory: category as DeviationItem['deviationCategory'],
    aiOutput: '',
    expectedOutput: '',
    files: getChangedFiles(),
    ruleSedimented: null,
    detectedAt: now(),
    fixedAt: null,
  };
  data.deviations.push(deviation);
  data.summary.deviationCount = data.deviations.length;
  addEvent(data, 'deviation_created', { deviationId: id });
  addTimeline(data, 'deviation', `${id}: ${args.title}`, (data.context.currentPrdPhase as string) || undefined);
  save(path, data);
  refreshCurrentBranchMemory(data.meta.branch);

  const result: any = { success: true, deviationId: id, message: `${id} 已记录: ${args.title}` };

  // When rootCause is rule-missing, check for pattern and hint rule sedimentation
  if (rootCause === 'rule-missing') {
    const sameCategoryCount = data.deviations.filter(
      d => d.deviationCategory === category && d.rootCauseCategory === 'rule-missing',
    ).length;

    if (sameCategoryCount >= 2) {
      result.ruleHint = `同类偏差已出现 ${sameCategoryCount} 次（${category} / rule-missing）。如果修复方案属于项目级技术规范（非业务逻辑），请询问用户是否沉淀为规则：调用 aida_log_rule 工具，传入 content="<规则描述>" category="${category}" sourceDeviation="${id}"`;
    } else {
      result.ruleHint = `rootCause 为 rule-missing，修复后如果属于项目级技术规范（非业务逻辑），请询问用户是否沉淀为规则：调用 aida_log_rule 工具，传入 content="<规则描述>" category="${category}" sourceDeviation="${id}"`;
    }
  }

  return result;
}

function getChangedFiles(): string[] {
  try {
    const output = execSync('git diff --name-only HEAD', { cwd: projectRoot, encoding: 'utf-8', stdio: 'pipe' });
    const files = output.split('\n').map((f: string) => f.trim()).filter(Boolean);
    if (files.length > 0) return files;
  } catch { /* fall through */ }
  try {
    const output = execSync('git diff --name-only --cached', { cwd: projectRoot, encoding: 'utf-8', stdio: 'pipe' });
    const files = output.split('\n').map((f: string) => f.trim()).filter(Boolean);
    if (files.length > 0) return files;
  } catch { /* fall through */ }
  // SVN fallback
  try {
    const output = execSync('svn status', { cwd: projectRoot, encoding: 'utf-8', stdio: 'pipe' });
    return output.split('\n')
      .filter((l: string) => /^[MAD]/.test(l))
      .map((l: string) => l.slice(1).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function handleLogFiles(): any {
  const { path, data } = ensureRunJson();

  // Auto-scan VCS diff (git first, SVN fallback)
  let diffOutput = '';
  let svnFiles: string[] = [];

  try {
    diffOutput = execSync('git diff --stat HEAD', { cwd: projectRoot, encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    try {
      diffOutput = execSync('git diff --stat --cached', { cwd: projectRoot, encoding: 'utf-8', stdio: 'pipe' });
    } catch { /* fall through to SVN */ }
  }

  // SVN fallback: get changed file list (no line counts available from svn status)
  if (!diffOutput.trim()) {
    try {
      const svnStatus = execSync('svn status', { cwd: projectRoot, encoding: 'utf-8', stdio: 'pipe' });
      svnFiles = svnStatus.split('\n')
        .filter((l: string) => /^[MAD]/.test(l))
        .map((l: string) => ({ code: l[0], path: l.slice(1).trim() }))
        .filter((f: { code: string; path: string }) => f.path)
        .map((f: { code: string; path: string }) => f.path);
    } catch { /* ignore */ }
  }

  const filesLogged: string[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;

  if (diffOutput.trim()) {
    // Parse git diff --stat output
    // Format: " src/foo.ts | 10 ++++------"  or  " src/bar.ts | 5 +++++"
    const lines = diffOutput.split('\n').filter((l: string) => l.includes('|'));

    for (const line of lines) {
      const match = line.match(/^\s*(.+?)\s*\|\s*(\d+)\s*([+-]*)/);
      if (!match) continue;

      const filePath = match[1].trim();
      const changes = parseInt(match[2]) || 0;
      const indicators = match[3] || '';

      const plusCount = (indicators.match(/\+/g) || []).length;
      const minusCount = (indicators.match(/-/g) || []).length;
      const total = plusCount + minusCount;

      let linesAdded = 0;
      let linesRemoved = 0;
      if (total > 0) {
        linesAdded = Math.round(changes * plusCount / total);
        linesRemoved = Math.round(changes * minusCount / total);
      } else {
        linesAdded = changes;
      }

      const changeType: 'created' | 'modified' | 'deleted' =
        linesRemoved === 0 && linesAdded > 0 ? 'created' : 'modified';

      const existing = data.files.find(f => f.path === filePath);
      if (existing) {
        existing.changeCount = (existing.changeCount || 1) + 1;
        existing.linesAdded += linesAdded;
        existing.linesRemoved += linesRemoved;
        existing.lastModified = now();
      } else {
        data.files.push({ path: filePath, changeType, linesAdded, linesRemoved, changeCount: 1, lastModified: now() });
      }

      totalAdded += linesAdded;
      totalRemoved += linesRemoved;
      filesLogged.push(filePath);
    }
  } else if (svnFiles.length > 0) {
    // SVN: log files without line counts
    for (const filePath of svnFiles) {
      const existing = data.files.find(f => f.path === filePath);
      if (existing) {
        existing.changeCount = (existing.changeCount || 1) + 1;
        existing.lastModified = now();
      } else {
        data.files.push({ path: filePath, changeType: 'modified', linesAdded: 0, linesRemoved: 0, changeCount: 1, lastModified: now() });
      }
      filesLogged.push(filePath);
    }
  } else {
    return { success: true, message: '没有检测到文件变更', filesLogged: 0 };
  }

  if (filesLogged.length === 0) {
    return { success: true, message: '没有检测到文件变更', filesLogged: 0 };
  }

  data.summary.filesChanged = data.files.length;
  data.summary.linesAdded = data.files.reduce((s, f) => s + (f.linesAdded || 0), 0);
  data.summary.linesRemoved = data.files.reduce((s, f) => s + (f.linesRemoved || 0), 0);
  addEvent(data, 'files_scanned', { count: filesLogged.length });
  save(path, data);
  refreshCurrentBranchMemory(data.meta.branch);

  return {
    success: true,
    filesLogged: filesLogged.length,
    linesAdded: totalAdded,
    linesRemoved: totalRemoved,
    message: `${filesLogged.length} files logged (+${totalAdded} -${totalRemoved})`,
  };
}

function handleHighlight(args: any): any {
  const { path, data } = ensureRunJson();
  const highlight: HighlightItem = {
    content: args.content,
    source: 'auto',
    createdAt: now(),
  };
  data.highlights.push(highlight);
  addEvent(data, 'highlight_added', { content: args.content });
  save(path, data);
  refreshCurrentBranchMemory(data.meta.branch);
  return { success: true, message: `亮点已记录: ${args.content}` };
}

function handleStatus(): any {
  try {
    const { path, data } = ensureRunJson();
    const s = data.summary;
    const tasks = data.tasks.map(t => ({ id: t.taskId, title: t.title, status: t.status }));
    const openBugs = data.bugs.filter(b => b.status === 'open').map(b => ({ id: b.bugId, title: b.title, severity: b.severity }));

    // Real-time token sync
    syncTokenUsage(path, data);

    return {
      branch: data.meta.branch,
      developer: data.meta.developer,
      status: data.meta.status,
      summary: {
        totalTasks: s.totalTasks,
        completedTasks: s.completedTasks,
        bugCount: s.bugCount,
        deviationCount: s.deviationCount,
        filesChanged: s.filesChanged,
      },
      tokenUsage: {
        totalTokens: data.cost?.totalTokens || 0,
        detail: (data.cost as any)?.tokenDetail || null,
      },
      currentTaskId: data.context.currentTaskId,
      tasks,
      openBugs,
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

function handleBootstrap(args: any): any {
  const action = `${args.action || 'status'}`.trim();
  const host = normalizeBootstrapHost(args.host);
  const sessionAvailable = true;

  switch (action) {
    case 'status': {
      const status = getBootstrapStatus(projectRoot, host, { sessionAvailable });
      return {
        success: true,
        host,
        available: status.available,
        configured: status.configured,
        sessionAvailable: status.sessionAvailable,
        needsBootstrap: status.needsBootstrap,
        cached: status.record,
        nextSteps: status.nextSteps,
        manifestVersion: status.manifest.version,
      };
    }
    case 'manifest': {
      const status = getBootstrapStatus(projectRoot, host, { sessionAvailable });
      return {
        success: true,
        host,
        available: status.available,
        configured: status.configured,
        sessionAvailable: status.sessionAvailable,
        required: true,
        reason: BOOTSTRAP_MANIFEST.reason,
        groupedTools: BOOTSTRAP_MANIFEST.groupedTools,
        nextSteps: status.nextSteps,
        manifestVersion: BOOTSTRAP_MANIFEST.version,
      };
    }
    case 'complete': {
      const decision = `${args.decision || 'approved'}`.trim() as BootstrapDecision;
      const record = saveBootstrapDecision(
        projectRoot,
        host,
        decision,
        Array.isArray(args.approvedToolNames) ? args.approvedToolNames : [],
        args.acknowledgedReason !== false,
      );
      return {
        success: true,
        host,
        decision: record.decision,
        completedAt: record.completedAt,
        approvedToolNames: record.approvedToolNames,
        manifestVersion: record.manifestVersion,
      };
    }
    default:
      return { success: false, message: `unknown bootstrap action: ${action}` };
  }
}

function handleTaskTool(args: any): any {
  const action = `${args.action || ''}`.trim();
  switch (action) {
    case 'start':
      return handleTaskStart(args);
    case 'done':
      return handleTaskDone(args);
    default:
      return { success: false, message: `unknown task action: ${action}` };
  }
}

function handleRecordTool(args: any): any {
  const action = `${args.action || ''}`.trim();
  switch (action) {
    case 'files':
      return handleLogFiles();
    case 'review':
      return handleLogReview(args);
    case 'bug':
      return handleLogBug(args);
    case 'bug-fix':
      return handleBugFix(args);
    case 'deviation':
      return handleLogDeviation(args);
    case 'highlight':
      return handleHighlight(args);
    case 'rule':
      return handleLogRule(args);
    case 'status':
      return handleStatus();
    default:
      return { success: false, message: `unknown record action: ${action}` };
  }
}

function handleMemoryTool(args: any): any {
  const action = `${args.action || ''}`.trim();
  switch (action) {
    case 'search':
      return handleMemorySearch(args);
    case 'get':
      return handleMemoryGet(args);
    case 'upsert':
      return handleMemoryUpsert(args);
    case 'context-get':
      return handleContextGet(args);
    case 'context-update':
      return handleContextUpdate(args);
    case 'context-rebuild':
      return handleContextRebuild(args);
    case 'pack':
      return handleMemoryPack(args);
    default:
      return { success: false, message: `unknown memory action: ${action}` };
  }
}

function handleLogRule(args: any): any {
  const { path, data } = ensureRunJson();
  const branch = getBranchName();
  const dev = getDevName();
  const category = args.category || 'general';
  const content = args.content;

  // Write to project-level registry with fingerprint dedup
  const { entry, isDuplicate } = addRule(projectRoot, {
    content,
    category,
    branch,
    deviation: args.sourceDeviation || null,
    author: dev,
    status: 'active',
  });

  if (isDuplicate) {
    return { success: true, message: `规则已存在: ${entry.id}（fingerprint 重复）`, ruleId: entry.id, isDuplicate: true };
  }

  // Also record in run.json.rules[] for per-run tracking
  const localId = nextId(data.rules, 'RULE');
  data.rules.push({
    ruleId: localId,
    file: `rules.json#${entry.id}`,
    content,
    category,
    sourceDeviation: args.sourceDeviation || null,
    sedimentedAt: now(),
  });
  data.summary.rulesSedimented = data.rules.filter(r => (r as any).status !== 'pending').length;
  addEvent(data, 'rule_sedimented', { ruleId: localId, registryId: entry.id });
  addTimeline(data, 'rule', `${localId}: ${content.substring(0, 50)}`);
  save(path, data);
  refreshCurrentBranchMemory(data.meta.branch);

  // Rebuild AI tool artifacts from JSON source
  buildProjectArtifacts(projectRoot);

  return { success: true, ruleId: entry.id, message: `规则已沉淀: ${entry.id} [${category}] ${content.substring(0, 60)}` };
}

function handleMemorySearch(args: any): any {
  const query = `${args.query || ''}`.trim();
  if (!query) {
    return { success: false, message: 'query is required' };
  }
  const hits = searchModuleMemories(projectRoot, query, Array.isArray(args.pathHints) ? args.pathHints : []);
  return {
    success: true,
    query,
    hits,
  };
}

function handleMemoryGet(args: any): any {
  const moduleKey = `${args.moduleKey || ''}`.trim();
  if (!moduleKey) {
    return { success: false, message: 'moduleKey is required' };
  }
  const record = loadModuleMemory(projectRoot, moduleKey);
  if (!record) {
    return { success: false, message: `module memory not found: ${moduleKey}` };
  }
  return {
    success: true,
    memory: record,
  };
}

function handleMemoryUpsert(args: any): any {
  const moduleKey = `${args.moduleKey || ''}`.trim();
  if (!moduleKey) {
    return { success: false, message: 'moduleKey is required' };
  }

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
    tickets: [{
      ticket: args.ticket || undefined,
      branch: args.branch || getBranchName(),
      summary: args.referenceSummary || args.summary || '',
      updatedAt: now(),
    }],
  });
  buildMemoryViews(projectRoot);

  return {
    success: true,
    moduleKey: record.moduleKey,
    updatedAt: record.updatedAt,
  };
}

function handleContextGet(args: any): any {
  const branch = `${args.branch || getBranchName()}`.trim();
  const record = loadRunContext(projectRoot, branch);
  if (!record) {
    return { success: false, message: `context not found for branch: ${branch}` };
  }
  return {
    success: true,
    context: record,
  };
}

function handleContextRebuild(args: any): any {
  const branch = `${args.branch || getBranchName()}`.trim();
  const result = rebuildCurrentBranchMemory(projectRoot, branch);
  if (!result.context) {
    return { success: false, message: `no branch data found for ${branch}` };
  }
  return {
    success: true,
    branch,
    modules: result.modules.map((item) => item.moduleKey),
    contextUpdatedAt: result.context.updatedAt,
  };
}

function handleMemoryPack(args: any): any {
  const branch = `${args.branch || getBranchName()}`.trim();
  const pack = loadRunMemoryPack(projectRoot, branch);
  if (!pack) {
    return { success: false, message: `memory pack not found for branch: ${branch}` };
  }
  return {
    success: true,
    branch,
    pack,
  };
}

function handleContextUpdate(args: any): any {
  const branch = `${args.branch || getBranchName()}`.trim();
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
  return {
    success: true,
    branch: record.branch,
    updatedAt: record.updatedAt,
  };
}

// ─── MCP Request Router ─────────────────────────────────

function handleRequest(req: JsonRpcRequest): void {
  const { id, method, params } = req;

  switch (method) {
    case 'initialize':
      sendResult(id!, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          prompts: {},
        },
        serverInfo: {
          name: 'aida',
          version: '1.0.0',
        },
      });
      break;

    case 'notifications/initialized':
      // No response needed for notifications
      break;

    case 'tools/list':
      sendResult(id!, { tools: TOOLS });
      break;

    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments || {};
      let result: any;

      try {
        switch (toolName) {
          case 'aida_bootstrap':
            result = handleBootstrap(args);
            break;
          case 'aida_task':
            result = handleTaskTool(args);
            break;
          case 'aida_record':
            result = handleRecordTool(args);
            break;
          case 'aida_memory':
            result = handleMemoryTool(args);
            break;
          case 'aida_task_start':
            result = handleTaskStart(args);
            break;
          case 'aida_task_done':
            result = handleTaskDone(args);
            break;
          case 'aida_log_bug':
            result = handleLogBug(args);
            break;
          case 'aida_bug_fix':
            result = handleBugFix(args);
            break;
          case 'aida_log_review':
            result = handleLogReview(args);
            break;
          case 'aida_log_deviation':
            result = handleLogDeviation(args);
            break;
          case 'aida_log_files':
            result = handleLogFiles();
            break;
          case 'aida_highlight':
            result = handleHighlight(args);
            break;
          case 'aida_status':
            result = handleStatus();
            break;
          case 'aida_log_rule':
            result = handleLogRule(args);
            break;
          case 'aida_memory_search':
            result = handleMemorySearch(args);
            break;
          case 'aida_memory_get':
            result = handleMemoryGet(args);
            break;
          case 'aida_memory_upsert':
            result = handleMemoryUpsert(args);
            break;
          case 'aida_context_get':
            result = handleContextGet(args);
            break;
          case 'aida_context_update':
            result = handleContextUpdate(args);
            break;
          case 'aida_context_rebuild':
            result = handleContextRebuild(args);
            break;
          case 'aida_memory_pack':
            result = handleMemoryPack(args);
            break;
          default:
            sendError(id!, -32601, `Unknown tool: ${toolName}`);
            return;
        }
        sendResult(id!, {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        });
      } catch (e: any) {
        sendResult(id!, {
          content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }],
          isError: true,
        });
      }
      break;
    }

    case 'prompts/list':
      sendResult(id!, { prompts: PROMPTS });
      break;

    case 'prompts/get': {
      const promptName = params?.name;
      if (promptName === 'aida-guide') {
        sendResult(id!, {
          messages: [{
            role: 'user',
            content: { type: 'text', text: PROMPT_CONTENT },
          }],
        });
      } else {
        sendError(id!, -32601, `Unknown prompt: ${promptName}`);
      }
      break;
    }

    case 'ping':
      sendResult(id!, {});
      break;

    default:
      if (id !== undefined) {
        sendError(id!, -32601, `Method not found: ${method}`);
      }
  }
}

// ─── Stdio Transport ─────────────────────────────────────

export function startMcpServer(): void {
  let buffer = '';
  let transportDetected = false;

  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;

    while (true) {
      // Try Content-Length based messages first
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd !== -1) {
        const header = buffer.substring(0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (match) {
          if (!transportDetected) {
            useContentLength = true;
            transportDetected = true;
          }
          const contentLength = parseInt(match[1]);
          const bodyStart = headerEnd + 4;
          if (buffer.length < bodyStart + contentLength) break;

          const body = buffer.substring(bodyStart, bodyStart + contentLength);
          buffer = buffer.substring(bodyStart + contentLength);

          try {
            const req = JSON.parse(body) as JsonRpcRequest;
            handleRequest(req);
          } catch { /* skip malformed */ }
          continue;
        }
      }

      // Fallback: newline-delimited JSON (e.g. mcp-proxy)
      const nlIdx = buffer.indexOf('\n');
      if (nlIdx === -1) break;
      const line = buffer.substring(0, nlIdx).trim();
      buffer = buffer.substring(nlIdx + 1);
      if (line) {
        if (!transportDetected) {
          useContentLength = false;
          transportDetected = true;
        }
        try {
          const req = JSON.parse(line) as JsonRpcRequest;
          handleRequest(req);
        } catch { /* skip malformed */ }
      }
    }
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });
}
