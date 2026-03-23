#!/usr/bin/env node

import { argv } from 'node:process';

const command = argv[2];

async function main() {
  switch (command) {
    case 'init': {
      const { init } = await import('./commands/init.js');
      await init();
      break;
    }
    case 'start': {
      const { start } = await import('./commands/start.js');
      await start();
      break;
    }
    case 'dashboard': {
      const { dashboard } = await import('./commands/dashboard.js');
      await dashboard();
      break;
    }
    case 'status': {
      const { status } = await import('./commands/status.js');
      await status();
      break;
    }
    case 'log': {
      const { log } = await import('./commands/log.js');
      await log();
      break;
    }
    case 'update': {
      const { update } = await import('./commands/update.js');
      await update();
      break;
    }
    case 'migrate': {
      const { migrate } = await import('./commands/migrate.js');
      await migrate();
      break;
    }
    case 'reindex': {
      const { reindex } = await import('./commands/reindex.js');
      await reindex();
      break;
    }
    case 'report': {
      const { report } = await import('./commands/report.js');
      await report();
      break;
    }
    case 'rules': {
      const { rules } = await import('./commands/rules.js');
      await rules();
      break;
    }
    case 'mcp': {
      const { startMcpServer } = await import('../mcp/server.js');
      startMcpServer();
      return; // Don't exit — MCP server runs until stdin closes
    }
    default: {
      console.log(`
  AIDA - AI Development Analytics Platform

  Usage:
    aida init        Initialize AIDA in current project
    aida start       Create a new development run
    aida mcp         Start MCP server (stdio mode, for AI tools)
    aida log         Write structured data to run.json
    aida dashboard   Launch the visualization dashboard
    aida status      Show current run status
    aida update      Update all skills to latest version
    aida migrate     Migrate old run.json data to new schema
    aida reindex     Rebuild project-level index from all runs
    aida report      Generate performance report data
    aida rules       Manage project rules registry (build/dedupe/merge)
`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
