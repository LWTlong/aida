import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { readJson, writeJson } from '../src/utils/fs.js';
import { createTestProject, type TestProject } from './helpers.js';

const cliPath = resolve(import.meta.dirname, '..', 'src', 'cli', 'index.js');

// ─── JSON-RPC over stdio helpers ──────────────────────────

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

      const contentLength = parseInt(match[1], 10);
      const bodyStart = headerEndIdx + 4;
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

  async callTool(name: string, args: Record<string, any> = {}, timeoutMs = 30000): Promise<any> {
    const resp = await this.rpc('tools/call', { name, arguments: args }, timeoutMs);
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

// ─── AIDA 3.0 Test suite ──────────────────────────────────

describe('MCP Server (AIDA 3.0)', { concurrency: false }, () => {
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

  describe('initialize', () => {
    it('should respond with protocolVersion and 3.0 serverInfo', async () => {
      const resp = await client.initialize();

      assert.ok(resp.result);
      assert.equal(resp.result.protocolVersion, '2024-11-05');
      assert.equal(resp.result.serverInfo.name, 'aida');
      assert.equal(resp.result.serverInfo.version, '3.0.0');
      assert.ok(resp.result.capabilities.tools);
      assert.ok(resp.result.capabilities.prompts);
    });
  });

  // ─── tools/list ───────────────────────────────────────────

  describe('tools/list', () => {
    it('should return all 3.0 governance tools', async () => {
      await client.initialize();

      const resp = await client.rpc('tools/list');
      assert.ok(resp.result);
      const tools = resp.result.tools;
      assert.equal(tools.length, 14);

      const names = tools.map((t: any) => t.name).sort();
      const expected = [
        'aida_apply_governance',
        'aida_audit_plugin_risk',
        'aida_bootstrap',
        'aida_build_plugin',
        'aida_build_self_plugin',
        'aida_get_asset',
        'aida_list_assets',
        'aida_memory',
        'aida_parse_plugin',
        'aida_recall',
        'aida_remember',
        'aida_scan_assets',
        'aida_undo',
        'aida_write_analysis',
      ];
      assert.deepEqual(names, expected);
    });
  });

  // ─── aida_bootstrap ──────────────────────────────────────

  describe('aida_bootstrap', () => {
    it('should return bootstrap manifest and persist local bootstrap state', async () => {
      await client.initialize();

      const status = await client.callTool('aida_bootstrap', { action: 'status', host: 'claude-code' });
      assert.equal(status.success, true);
      assert.equal(status.host, 'claude-code');
      assert.equal(typeof status.available, 'boolean');

      const manifest = await client.callTool('aida_bootstrap', { action: 'manifest', host: 'claude-code' });
      assert.equal(manifest.success, true);
      assert.equal(manifest.required, true);
      assert.ok(Array.isArray(manifest.groupedTools));

      const completed = await client.callTool('aida_bootstrap', {
        action: 'complete',
        host: 'claude-code',
        decision: 'approved',
        approvedToolNames: ['aida_bootstrap', 'aida_memory'],
        acknowledgedReason: true,
      });
      assert.equal(completed.success, true);
      assert.equal(completed.decision, 'approved');

      const bootstrapState = readJson<any>(resolve(project.root, '.aida', 'bootstrap-state.local.json'));
      assert.ok(Array.isArray(bootstrapState.records));
      assert.equal(bootstrapState.records[0].host, 'claude-code');
    });
  });

  // ─── aida_memory (compatibility) ─────────────────────────

  describe('aida_memory', () => {
    it('should support search action', async () => {
      await client.initialize();
      const search = await client.callTool('aida_memory', { action: 'search', query: 'test' });
      assert.equal(search.success, true);
      assert.ok(Array.isArray(search.hits));
    });
  });

  // ─── aida_scan_assets ────────────────────────────────────

  describe('aida_scan_assets', () => {
    it('should scan project assets and write index', async () => {
      await client.initialize();
      const result = await client.callTool('aida_scan_assets', { includeContent: false, writeIndex: true });
      assert.ok(result.assets);
      assert.ok(Array.isArray(result.assets));
      assert.equal(result.schemaVersion, '3.0');
      assert.ok(result.summary);
      assert.ok(result.signals);
    });
  });

  // ─── aida_list_assets / aida_get_asset ───────────────────

  describe('aida_list_assets / aida_get_asset', () => {
    it('should list scanned assets', async () => {
      await client.initialize();
      await client.callTool('aida_scan_assets', { writeIndex: true });
      const list = await client.callTool('aida_list_assets', {});
      assert.equal(list.success, true);
      assert.ok(Array.isArray(list.assets));
    });
  });

  // ─── plugin audit ────────────────────────────────────────

  describe('aida_audit_plugin_risk', () => {
    it('should audit a local directory for risk signals', async () => {
      await client.initialize();
      const result = await client.callTool('aida_audit_plugin_risk', { path: project.root });
      assert.equal(result.success, true);
      assert.ok(result.risk.level);
      assert.ok(Array.isArray(result.risk.findings));
    });
  });

  // ─── prompts ─────────────────────────────────────────────

  describe('prompts', () => {
    it('should return aida-3-guide prompt', async () => {
      await client.initialize();
      const resp = await client.rpc('prompts/list');
      assert.ok(resp.result);
      const prompts = resp.result.prompts;
      assert.equal(prompts.length, 1);
      assert.equal(prompts[0].name, 'aida-3-guide');
    });

    it('should return prompt content via prompts/get', async () => {
      await client.initialize();
      const resp = await client.rpc('prompts/get', { name: 'aida-3-guide' });
      assert.ok(resp.result);
      assert.ok(Array.isArray(resp.result.messages));
      assert.equal(resp.result.messages.length, 1);
      assert.equal(resp.result.messages[0].role, 'user');
      assert.ok(resp.result.messages[0].content.text.includes('MCP-first'));
    });
  });
});
