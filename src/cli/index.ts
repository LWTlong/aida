#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';
import { bold, cyan, dim, green } from '../utils/display.js';

const command = argv[2];

function getVersion(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(__dirname, '../../package.json'),
    resolve(__dirname, '../../../package.json'),
  ];
  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(candidate, 'utf-8')) as { version?: string };
      if (pkg.version) return pkg.version;
    } catch { /* try next */ }
  }
  return '0.0.0';
}

async function main() {
  switch (command) {
    case '-v':
    case '--version':
    case 'version': {
      console.log(`aida v${getVersion()}`);
      break;
    }
    case 'init': {
      const { init } = await import('./commands/init.js');
      await init();
      break;
    }
    case 'mcp': {
      const { startMcpServer } = await import('../mcp/server.js');
      startMcpServer();
      return; // MCP server runs until stdin closes
    }
    case 'dashboard': {
      const version = getVersion();
      console.log(`\n  ${bold('AIDA')} v${version} 治理控制台`);
      console.log(dim('  正在启动本地 Dashboard 服务...\n'));
      const projectRoot = process.cwd();
      const { startDashboardServer } = await import('../core/dashboard/server.js');
      const server = await startDashboardServer(projectRoot, 0);
      console.log(`  ${green('✓')} Dashboard 已启动：${cyan(server.url)}`);
      console.log(dim('  按 Ctrl+C 停止服务。\n'));
      process.on('SIGINT', () => {
        server.close();
        console.log(dim('\n  Dashboard 已停止。\n'));
        process.exit(0);
      });
      break;
    }
    case 'analyze': {
      console.log(`\n  Run ${cyan('/aida:analyze')} inside your AI tool session (Claude Code, Cursor, etc.).\n  AIDA analyze requires an AI model to drive semantic governance.\n`);
      break;
    }
    case 'cleanup': {
      console.log(`\n  Run ${cyan('/aida:cleanup')} inside your AI tool session after running /aida:analyze.\n`);
      break;
    }
    case 'undo': {
      const { applyUndo, listUndoEntries } = await import('../core/undo/undo.js');
      const projectRoot = process.cwd();
      const entries = listUndoEntries(projectRoot);
      if (entries.length === 0) { console.log('\n  No undo entries found.\n'); break; }
      const result = applyUndo(projectRoot);
      if (result.success) {
        console.log(`\n  ${green('✓')} Undid: ${bold(result.entry!.description)}\n`);
      } else {
        console.error(`\n  Error: ${result.message}\n`);
        process.exit(1);
      }
      break;
    }
    case 'ui': {
      console.log(`\n  Run ${cyan('aida dashboard')} to open the AIDA governance Dashboard.\n`);
      break;
    }
    case 'package': {
      console.log(`\n  Run ${cyan('/aida:package-plugin')} inside your AI tool session to package assets as a Claude Plugin.\n`);
      break;
    }
    case 'copy-to':
    case 'copy-from': {
      const { copyAssets } = await import('./commands/copy.js');
      const direction = command === 'copy-to' ? 'to' : 'from';
      const tool = argv[3];
      if (!tool) {
        console.log(`\n  Usage: ${cyan(`aida ${command} <tool>`)}\n\n  ${bold('Supported tools:')} cursor\n`);
        break;
      }
      copyAssets(direction, tool);
      break;
    }
    default: {
      console.log(`
  ${bold('AIDA')} v${getVersion()} — ${bold('Local AI Asset Manager')}

  AIDA 3.0 is MCP-first: your AI model drives semantic governance,
  AIDA provides local scanning, undo journaling, decision memory, and Dashboard review.

  ${bold('Commands')}
    ${cyan('aida init')}             Initialize AIDA 3.0 in current project
    ${cyan('aida mcp')}              Start MCP server (stdio — for AI tools)
    ${cyan('aida dashboard')}        Start local Dashboard
    ${cyan('aida undo')}             Undo last governance operation
    ${cyan('aida copy-to cursor')}   Copy .claude/rules → .cursor/rules (one-time)
    ${cyan('aida copy-from cursor')} Copy .cursor/rules → .claude/rules (one-time)

  ${bold('Next steps after init')}
    1. Restart your AI tool (Claude / Codex / Cursor)
    2. Approve the AIDA MCP server when prompted
    3. Say: "Use AIDA to analyze this project's AI assets"
    4. Run ${cyan('aida dashboard')} to review results and next steps
`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
