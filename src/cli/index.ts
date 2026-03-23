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
  AIDevo - AI Development Observability Platform

  Usage:
    aidevo init        Initialize AIDevo in current project
    aidevo start       Create a new development run
    aidevo mcp         Start MCP server (stdio mode, for AI tools)
    aidevo log         Write structured data to run.json
    aidevo dashboard   Launch the visualization dashboard
    aidevo status      Show current run status
    aidevo update      Update all skills to latest version
    aidevo migrate     Migrate old run.json data to new schema
    aidevo reindex     Rebuild project-level index from all runs
    aidevo report      Generate performance report data
    aidevo rules       Manage project rules registry (build/dedupe/merge)
`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
