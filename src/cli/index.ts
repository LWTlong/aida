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
    default: {
      console.log(`
  AIDevOS - AI Development Observability Platform

  Usage:
    aidevos init        Initialize AIDevOS in current project
    aidevos start       Create a new development run
    aidevos log         Write structured data to run.json
    aidevos dashboard   Launch the visualization dashboard
    aidevos status      Show current run status
    aidevos update      Update all skills to latest version
    aidevos migrate     Migrate old run.json data to new schema
    aidevos reindex     Rebuild project-level index from all runs
    aidevos report      Generate performance report data
    aidevos rules       Manage project rules registry (build/dedupe/merge)
`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
