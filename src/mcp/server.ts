/**
 * AIDevOS MCP Server
 *
 * Implements MCP (Model Context Protocol) over stdio using JSON-RPC 2.0.
 * Zero dependencies — raw stdin/stdout processing.
 *
 * Provides tools for AI agents to silently collect development data.
 */

import { execSync } from 'node:child_process';
import { writeJson } from '../utils/fs.js';
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
} from '../schemas/run-json.js';
import {
  now,
  nextId,
  addEvent,
  addTimeline,
  saveRunData,
  ensureRunJson as ensureRunJsonShared,
} from '../utils/run-data.js';
import { collectClaudeTokens, collectClaudeTokensBetween } from '../utils/tokens.js';

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

function sendResponse(res: JsonRpcResponse): void {
  const json = JSON.stringify(res);
  const msg = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
  process.stdout.write(msg);
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
    name: 'aidevos_task_start',
    description: '当你开始一个新任务或功能开发时调用。记录任务标题和所属模块。在接到用户需求、开始编码前调用。',
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
    name: 'aidevos_task_done',
    description: '当你完成一个任务后调用。标记任务为已完成，自动计算耗时。',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '任务ID，如 TASK-01。如不确定，可调用 aidevos_status 查看。' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'aidevos_log_bug',
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
    name: 'aidevos_bug_fix',
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
    name: 'aidevos_log_review',
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
    name: 'aidevos_log_deviation',
    description: '当 AI 产出与用户预期不符时调用。记录偏差用于后续分析。',
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
    name: 'aidevos_log_files',
    description: '记录文件变更。无需传参，自动扫描 git diff 获取变更文件列表和行数。在完成一轮代码修改后调用。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'aidevos_highlight',
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
    name: 'aidevos_status',
    description: '查看当前开发运行的状态：任务列表、bug 数量、进度等。在需要了解当前进度时调用。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ─── MCP Prompts ─────────────────────────────────────────

const PROMPTS = [
  {
    name: 'aidevos-guide',
    description: 'AIDevOS 数据采集使用指南',
  },
];

const PROMPT_CONTENT = `你拥有 AIDevOS 数据采集工具，请在开发过程中的关键节点自然使用：

- 开始一个新任务时 → aidevos_task_start
- 完成任务时 → aidevos_task_done
- 发现 bug 时 → aidevos_log_bug，修复后 → aidevos_bug_fix
- 完成一轮代码修改后 → aidevos_log_files（自动扫描 git diff，无需传参）
- 完成代码审查时 → aidevos_log_review
- 有值得记录的亮点时 → aidevos_highlight

不需要改变你的开发流程，在关键节点顺手记录即可。漏报几个也没关系，有数据比没数据好。`;

// ─── Tool Handlers ───────────────────────────────────────

function handleTaskStart(args: any): any {
  const { path, data } = ensureRunJson();
  const id = nextId(data.tasks, 'TASK');
  const task: TaskItem = {
    taskId: id,
    title: args.title,
    status: 'in-progress',
    stageName: args.stage || 'default',
    prdPhase: '',
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
  addTimeline(data, 'task', `${id}: ${args.title}`);
  save(path, data);
  return { success: true, taskId: id, message: `${id} 已记录并开始: ${args.title}` };
}

function handleTaskDone(args: any): any {
  const { path, data } = ensureRunJson();
  const task = data.tasks.find(t => t.taskId === args.taskId);
  if (!task) return { success: false, message: `任务 ${args.taskId} 未找到` };

  task.status = 'done';
  task.completedAt = now();
  if (!task.startedAt) task.startedAt = task.createdAt || task.completedAt;
  data.summary.completedTasks = data.tasks.filter(t => t.status === 'done').length;

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
  addTimeline(data, 'task-done', `${args.taskId}: ${task.title}`);
  save(path, data);

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
    files: [],
    fix: null,
    taskId: data.context.currentTaskId || null,
    reportedAt: now(),
    fixedAt: null,
  };
  data.bugs.push(bug);
  data.summary.bugCount = data.bugs.length;
  addEvent(data, 'bug_created', { bugId: id });
  addTimeline(data, 'bug', `${id}: ${args.title}`);
  save(path, data);
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
  addTimeline(data, 'bug-fix', `${args.bugId}: ${bug.title}`);
  save(path, data);
  syncTokenUsage(path, data);

  const tokenMsg = bugTokens > 0 ? ` (${bugTokens} tokens)` : '';
  return { success: true, message: `${args.bugId} 已修复${tokenMsg}` };
}

function handleLogReview(args: any): any {
  const result = args.result || 'pass';
  const { path, data } = ensureRunJson();
  const id = nextId(data.reviews, 'REV');
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
  addTimeline(data, 'review', `${id}: ${result}`);
  save(path, data);
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
    files: [],
    ruleSedimented: null,
    detectedAt: now(),
    fixedAt: null,
  };
  data.deviations.push(deviation);
  data.summary.deviationCount = data.deviations.length;
  addEvent(data, 'deviation_created', { deviationId: id });
  addTimeline(data, 'deviation', `${id}: ${args.title}`);
  save(path, data);
  return { success: true, deviationId: id, message: `${id} 已记录: ${args.title}` };
}

function handleLogFiles(): any {
  const { path, data } = ensureRunJson();

  // Auto-scan git diff
  let diffOutput = '';
  try {
    diffOutput = execSync('git diff --stat HEAD', { cwd: projectRoot, encoding: 'utf-8' });
  } catch {
    // If no HEAD (first commit), try against empty tree
    try {
      diffOutput = execSync('git diff --stat --cached', { cwd: projectRoot, encoding: 'utf-8' });
    } catch {
      return { success: true, message: '没有检测到文件变更', filesLogged: 0 };
    }
  }

  if (!diffOutput.trim()) {
    return { success: true, message: '没有检测到文件变更', filesLogged: 0 };
  }

  // Parse git diff --stat output
  // Format: " src/foo.ts | 10 ++++------"  or  " src/bar.ts | 5 +++++"
  const lines = diffOutput.split('\n').filter(l => l.includes('|'));
  let totalAdded = 0;
  let totalRemoved = 0;
  const filesLogged: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*(.+?)\s*\|\s*(\d+)\s*([+-]*)/);
    if (!match) continue;

    const filePath = match[1].trim();
    const changes = parseInt(match[2]) || 0;
    const indicators = match[3] || '';

    // Count + and - in the indicators
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

    // Determine change type
    let changeType: 'created' | 'modified' | 'deleted' = 'modified';
    if (linesRemoved === 0 && linesAdded > 0) changeType = 'created';

    const existing = data.files.find(f => f.path === filePath);
    if (existing) {
      existing.changeCount = (existing.changeCount || 1) + 1;
      existing.linesAdded += linesAdded;
      existing.linesRemoved += linesRemoved;
      existing.lastModified = now();
    } else {
      data.files.push({
        path: filePath,
        changeType,
        linesAdded,
        linesRemoved,
        changeCount: 1,
        lastModified: now(),
      });
    }

    totalAdded += linesAdded;
    totalRemoved += linesRemoved;
    filesLogged.push(filePath);
  }

  data.summary.filesChanged = data.files.length;
  data.summary.linesAdded = data.files.reduce((s, f) => s + (f.linesAdded || 0), 0);
  data.summary.linesRemoved = data.files.reduce((s, f) => s + (f.linesRemoved || 0), 0);
  addEvent(data, 'files_scanned', { count: filesLogged.length });
  save(path, data);

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
          name: 'aidevos',
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
          case 'aidevos_task_start':
            result = handleTaskStart(args);
            break;
          case 'aidevos_task_done':
            result = handleTaskDone(args);
            break;
          case 'aidevos_log_bug':
            result = handleLogBug(args);
            break;
          case 'aidevos_bug_fix':
            result = handleBugFix(args);
            break;
          case 'aidevos_log_review':
            result = handleLogReview(args);
            break;
          case 'aidevos_log_deviation':
            result = handleLogDeviation(args);
            break;
          case 'aidevos_log_files':
            result = handleLogFiles();
            break;
          case 'aidevos_highlight':
            result = handleHighlight(args);
            break;
          case 'aidevos_status':
            result = handleStatus();
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
      if (promptName === 'aidevos-guide') {
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

  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;

    // Parse Content-Length based messages
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header = buffer.substring(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        // Try to parse as raw JSON (some clients don't send headers)
        const nlIdx = buffer.indexOf('\n');
        if (nlIdx === -1) break;
        const line = buffer.substring(0, nlIdx).trim();
        buffer = buffer.substring(nlIdx + 1);
        if (line) {
          try {
            const req = JSON.parse(line) as JsonRpcRequest;
            handleRequest(req);
          } catch { /* skip malformed */ }
        }
        continue;
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
    }
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });
}
