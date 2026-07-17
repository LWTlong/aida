import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanAssets } from '../assets/scanner.js';
import { loadAssetIndex } from '../assets/store.js';
import { auditPluginRisk, buildClaudePlugin } from '../plugins/plugins.js';
import { buildSelfPlugin } from '../builtin-skills.js';
import { listDecisions } from '../memory/decisions.js';

const DASHBOARD_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../dashboard');
const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res: ServerResponse, body: string, status = 200): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolveBody) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try { resolveBody(raw ? JSON.parse(raw) : {}); } catch { resolveBody({}); }
    });
  });
}

function resolveStaticPath(pathname: string): string {
  const cleanPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  return resolve(DASHBOARD_DIR, cleanPath);
}

function sendDashboardFile(res: ServerResponse, pathname: string): void {
  const target = resolveStaticPath(pathname);
  const fallback = resolve(DASHBOARD_DIR, 'index.html');
  const isInsideDashboard = target.startsWith(DASHBOARD_DIR);

  if (!existsSync(fallback)) {
    sendText(res, 'Dashboard frontend is missing. Run `npm run build` from the project root first.', 500);
    return;
  }

  if (isInsideDashboard && existsSync(target) && statSync(target).isFile()) {
    const type = MIME_TYPES[extname(target)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    res.end(readFileSync(target));
    return;
  }

  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(readFileSync(fallback));
}

export function startDashboardServer(projectRoot: string, port = 0): Promise<{ port: number; url: string; close: () => void }> {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname === '/api/scan' && req.method === 'POST') {
        return sendJson(res, scanAssets(projectRoot, { includeContent: false, writeIndex: true }));
      }
      if (url.pathname === '/api/assets') {
        const index = loadAssetIndex(projectRoot) || scanAssets(projectRoot, { includeContent: false, writeIndex: true });
        return sendJson(res, index);
      }
      if (url.pathname === '/api/plugin/audit' && req.method === 'POST') {
        const body = await readBody(req);
        return sendJson(res, { risk: auditPluginRisk(String(body.path || '')) });
      }
      if (url.pathname === '/api/plugin/build' && req.method === 'POST') {
        const body = await readBody(req);
        return sendJson(res, buildClaudePlugin(projectRoot, {
          name: String(body.name || '').trim(),
          description: String(body.description || '').trim(),
          version: typeof body.version === 'string' ? body.version : undefined,
          assetIds: Array.isArray(body.assetIds) ? body.assetIds.map((item) => String(item)) : [],
        }));
      }
      if (url.pathname === '/api/plugin/build-self' && req.method === 'POST') {
        const body = await readBody(req);
        const version = typeof body.version === 'string' ? body.version.trim() : '3.0.0';
        const outputDir = resolve(projectRoot, '.aida', 'plugins', `aida-${version}`);
        return sendJson(res, buildSelfPlugin(outputDir, version));
      }
      if (url.pathname === '/api/decisions') {
        return sendJson(res, { decisions: listDecisions(projectRoot) });
      }
      if (url.pathname.startsWith('/api/')) return sendJson(res, { error: 'not found' }, 404);
      sendDashboardFile(res, url.pathname);
    } catch (error) {
      sendJson(res, { error: error instanceof Error ? error.message : String(error) }, 400);
    }
  });
  return new Promise((resolveServer) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      resolveServer({ port: actualPort, url: `http://127.0.0.1:${actualPort}`, close: () => server.close() });
    });
  });
}
