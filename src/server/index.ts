import { createServer, ServerResponse } from 'node:http';
import { readFileSync, watch, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { PACKAGE_ROOT } from '../utils/paths.js';
import { getAllRuns, getRunData, getAggregatedData, getRequirementData, getIndexData } from './api.js';
import { buildIndex } from '../cli/commands/reindex.js';

const DASHBOARD_DIR = resolve(PACKAGE_ROOT, 'src', 'dashboard');

const sseClients = new Set<ServerResponse>();

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(filePath: string, res: ServerResponse): boolean {
  if (!existsSync(filePath)) return false;
  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

export async function startServer(
  port: number,
  projectRoot: string,
): Promise<void> {
  const theRunsDir = resolve(projectRoot, '.aidevos', 'runs');

  const server = createServer((req, res) => {
    const url = req.url || '/';

    res.setHeader('Access-Control-Allow-Origin', '*');

    // API routes
    if (url === '/api/runs') {
      const runs = getAllRuns(theRunsDir);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(runs));
      return;
    }

    if (url === '/api/aggregate') {
      const data = getAggregatedData(theRunsDir);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    if (url === '/api/overview') {
      const data = getIndexData(projectRoot);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data || { project: '', updatedAt: '', runs: [] }));
      return;
    }

    if (url.startsWith('/api/requirement/')) {
      const branch = decodeURIComponent(url.replace('/api/requirement/', ''));
      if (branch.includes('..') || branch.includes('\0')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      const data = getRequirementData(theRunsDir, branch);
      if (data) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Requirement not found' }));
      return;
    }

    if (url.startsWith('/api/runs/')) {
      const parts = decodeURIComponent(url.replace('/api/runs/', '')).split('/');
      if (parts.length >= 2) {
        const branch = parts[0];
        const dev = parts[1];
        // Reject path traversal attempts
        if (branch.includes('..') || dev.includes('..') || branch.includes('\0') || dev.includes('\0')) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }
        const data = getRunData(theRunsDir, branch, dev);
        if (data) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
          return;
        }
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Run not found' }));
      return;
    }

    if (url === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write('data: {"type":"connected"}\n\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // Static file serving from dashboard build output
    const safePath = url.split('?')[0].split('#')[0];
    if (safePath !== '/' && safePath !== '/index.html') {
      const filePath = resolve(DASHBOARD_DIR, safePath.replace(/^\//, ''));
      if (!filePath.startsWith(DASHBOARD_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (serveStatic(filePath, res)) return;
    }

    // SPA fallback: serve index.html
    const indexPath = resolve(DASHBOARD_DIR, 'index.html');
    if (serveStatic(indexPath, res)) return;

    res.writeHead(404);
    res.end('Dashboard not found. Run `pnpm build` in the dashboard/ directory.');
  });

  // Watch for run.json changes with debounce
  if (existsSync(theRunsDir)) {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    watch(theRunsDir, { recursive: true }, (_eventType, filename) => {
      if (!filename?.endsWith('run.json') && !filename?.endsWith('requirement.json')) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // Rebuild index so overview stays fresh
        try { buildIndex(projectRoot); } catch { /* best-effort */ }

        const event = JSON.stringify({
          type: 'run_updated',
          file: filename,
          time: new Date().toISOString(),
        });
        for (const client of sseClients) {
          try {
            client.write(`data: ${event}\n\n`);
          } catch {
            sseClients.delete(client);
          }
        }
      }, 300);
    });
  }

  return new Promise((resolvePromise, reject) => {
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(
          `\n  Port ${port} is already in use. Use --port to specify another port.\n`,
        );
        process.exit(1);
      }
      reject(err);
    });
    server.listen(port, () => resolvePromise());
  });
}
