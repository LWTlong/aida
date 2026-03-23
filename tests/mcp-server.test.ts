import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { readJson } from '../src/utils/fs.js';
import { createTestProject, type TestProject } from './helpers.js';

const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');

// ─── JSON-RPC over stdio helpers ──────────────────────────

/**
 * Persistent MCP client that accumulates stdout as a Buffer.
 *
 * Key insight: Content-Length is in *bytes*, so we must track bytes,
 * not string characters (CJK chars in tool descriptions are multi-byte).
 */
class McpClient {
  private proc: ChildProcess;
  private buf = Buffer.alloc(0);
  private pending: Array<{
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  private reqIdCounter = 0;

  constructor(cwd: string) {
    this.proc = spawn('node', [cliPath, 'mcp'], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, HOME: cwd },
    });

    this.proc.stdout!.on('data', (chunk: Buffer) => {
      this.buf = Buffer.concat([this.buf, chunk]);
      this.drain();
    });
  }

  private drain(): void {
    while (this.pending.length > 0) {
      const headerEndStr = '\r\n\r\n';
      const headerEndIdx = this.buf.indexOf(headerEndStr);
      if (headerEndIdx === -1) return;

      const headerStr = this.buf.subarray(0, headerEndIdx).toString('utf-8');
      const match = headerStr.match(/Content-Length:\s*(\d+)/i);
      if (!match) return;

      const contentLength = parseInt(match[1]);
      const bodyStart = headerEndIdx + 4; // skip \r\n\r\n
      if (this.buf.length < bodyStart + contentLength) return;

      const bodyBuf = this.buf.subarray(bodyStart, bodyStart + contentLength);
      this.buf = this.buf.subarray(bodyStart + contentLength);

      const waiter = this.pending.shift()!;
      clearTimeout(waiter.timer);
      waiter.resolve(JSON.parse(bodyBuf.toString('utf-8')));
    }
  }

  rpc(method: string, params?: any, timeoutMs = 10000): Promise<any> {
    const id = ++this.reqIdCounter;
    const req = { jsonrpc: '2.0', id, method, params };
    const body = JSON.stringify(req);
    const msg = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
    this.proc.stdin!.write(msg);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`MCP response timeout for ${method}`));
      }, timeoutMs);
      this.pending.push({ resolve, reject, timer });
      this.drain();
    });
  }

  notify(method: string, params?: any): void {
    const req = { jsonrpc: '2.0', method, params };
    const body = JSON.stringify(req);
    const msg = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
    this.proc.stdin!.write(msg);
  }

  async callTool(name: string, args: Record<string, any> = {}): Promise<any> {
    const resp = await this.rpc('tools/call', { name, arguments: args });
    assert.ok(resp.result, `Expected result in response for tool ${name}`);
    const text = resp.result.content?.[0]?.text;
    assert.ok(text, `Expected text content in response for tool ${name}`);
    return JSON.parse(text);
  }

  async initialize(): Promise<any> {
    const resp = await this.rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '0.1' },
    });
    this.notify('notifications/initialized');
    return resp;
  }

  kill(): void {
    if (this.proc && !this.proc.killed) {
      for (const p of this.pending) {
        clearTimeout(p.timer);
        p.reject(new Error('Process killed'));
      }
      this.pending = [];
      this.proc.stdin!.end();
      this.proc.kill();
    }
  }
}

// ─── Test suite ───────────────────────────────────────────

let project: TestProject;
let client: McpClient;

beforeEach(() => {
  project = createTestProject();
  client = new McpClient(project.root);
});

afterEach(() => {
  client.kill();
  project.cleanup();
});

// ─── initialize ───────────────────────────────────────────

describe('MCP Server - initialize', () => {
  it('should respond with protocolVersion and serverInfo', async () => {
    const resp = await client.initialize();

    assert.ok(resp.result);
    assert.equal(resp.result.protocolVersion, '2024-11-05');
    assert.equal(resp.result.serverInfo.name, 'aida');
    assert.equal(resp.result.serverInfo.version, '1.0.0');
    assert.ok(resp.result.capabilities.tools);
    assert.ok(resp.result.capabilities.prompts);
  });
});

// ─── tools/list ───────────────────────────────────────────

describe('MCP Server - tools/list', () => {
  it('should return all 9 tools', async () => {
    await client.initialize();

    const resp = await client.rpc('tools/list');
    assert.ok(resp.result);
    const tools = resp.result.tools;
    assert.equal(tools.length, 9);

    const names = tools.map((t: any) => t.name).sort();
    const expected = [
      'aidevos_bug_fix',
      'aidevos_highlight',
      'aidevos_log_bug',
      'aidevos_log_deviation',
      'aidevos_log_files',
      'aidevos_log_review',
      'aidevos_status',
      'aidevos_task_done',
      'aidevos_task_start',
    ];
    assert.deepEqual(names, expected);
  });
});

// ─── aidevos_task_start ───────────────────────────────────

describe('MCP Server - aidevos_task_start', () => {
  it('should create a task and run.json via lazy init', async () => {
    await client.initialize();

    const result = await client.callTool('aidevos_task_start', {
      title: 'Implement auth module',
      stage: 'Authentication',
    });

    assert.equal(result.success, true);
    assert.equal(result.taskId, 'TASK-01');

    // Verify run.json on disk
    const data = readJson<any>(project.runJsonPath);
    assert.equal(data.tasks.length, 1);
    assert.equal(data.tasks[0].taskId, 'TASK-01');
    assert.equal(data.tasks[0].title, 'Implement auth module');
    assert.equal(data.tasks[0].status, 'in-progress');
    assert.equal(data.tasks[0].stageName, 'Authentication');
    assert.equal(data.summary.totalTasks, 1);
    assert.equal(data.context.currentTaskId, 'TASK-01');
  });
});

// ─── aidevos_task_done ────────────────────────────────────

describe('MCP Server - aidevos_task_done', () => {
  it('should mark task as done', async () => {
    await client.initialize();

    await client.callTool('aidevos_task_start', { title: 'Build API', stage: 'Backend' });

    const result = await client.callTool('aidevos_task_done', { taskId: 'TASK-01' });
    assert.equal(result.success, true);

    const data = readJson<any>(project.runJsonPath);
    assert.equal(data.tasks[0].status, 'done');
    assert.ok(data.tasks[0].completedAt);
    assert.equal(data.summary.completedTasks, 1);
  });

  it('should return error for unknown task ID', async () => {
    await client.initialize();

    const result = await client.callTool('aidevos_task_done', { taskId: 'TASK-99' });
    assert.equal(result.success, false);
  });
});

// ─── aidevos_log_bug ──────────────────────────────────────

describe('MCP Server - aidevos_log_bug', () => {
  it('should record a bug with defaults', async () => {
    await client.initialize();

    const result = await client.callTool('aidevos_log_bug', {
      title: 'Null pointer in parser',
    });

    assert.equal(result.success, true);
    assert.equal(result.bugId, 'BUG-01');

    const data = readJson<any>(project.runJsonPath);
    assert.equal(data.bugs.length, 1);
    assert.equal(data.bugs[0].title, 'Null pointer in parser');
    assert.equal(data.bugs[0].severity, 'medium');
    assert.equal(data.bugs[0].source, 'self-review');
    assert.equal(data.bugs[0].status, 'open');
    assert.equal(data.summary.bugCount, 1);
  });

  it('should record a bug with explicit severity and source', async () => {
    await client.initialize();

    const result = await client.callTool('aidevos_log_bug', {
      title: 'Critical crash on start',
      severity: 'critical',
      source: 'testing',
    });

    assert.equal(result.success, true);
    const data = readJson<any>(project.runJsonPath);
    assert.equal(data.bugs[0].severity, 'critical');
    assert.equal(data.bugs[0].source, 'testing');
  });
});

// ─── aidevos_log_files ────────────────────────────────────

describe('MCP Server - aidevos_log_files', () => {
  it('should handle no git diff gracefully', async () => {
    await client.initialize();

    const result = await client.callTool('aidevos_log_files');

    assert.equal(result.success, true);
    assert.equal(result.filesLogged, 0);
  });
});

// ─── aidevos_status ───────────────────────────────────────

describe('MCP Server - aidevos_status', () => {
  it('should return current state with summary', async () => {
    await client.initialize();

    await client.callTool('aidevos_task_start', { title: 'Task A' });
    await client.callTool('aidevos_log_bug', { title: 'Bug X' });

    const result = await client.callTool('aidevos_status');

    assert.equal(result.status, 'running');
    assert.equal(result.summary.totalTasks, 1);
    assert.equal(result.summary.bugCount, 1);
    assert.equal(result.currentTaskId, 'TASK-01');
    assert.ok(Array.isArray(result.tasks));
    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0].id, 'TASK-01');
    assert.ok(Array.isArray(result.openBugs));
    assert.equal(result.openBugs.length, 1);
  });
});

// ─── prompts/list ─────────────────────────────────────────

describe('MCP Server - prompts/list', () => {
  it('should return aidevos-guide prompt', async () => {
    await client.initialize();

    const resp = await client.rpc('prompts/list');
    assert.ok(resp.result);
    const prompts = resp.result.prompts;
    assert.equal(prompts.length, 1);
    assert.equal(prompts[0].name, 'aidevos-guide');
  });

  it('should return prompt content via prompts/get', async () => {
    await client.initialize();

    const resp = await client.rpc('prompts/get', { name: 'aidevos-guide' });
    assert.ok(resp.result);
    assert.ok(Array.isArray(resp.result.messages));
    assert.equal(resp.result.messages.length, 1);
    assert.equal(resp.result.messages[0].role, 'user');
    assert.ok(resp.result.messages[0].content.text.includes('aidevos_task_start'));
  });
});
