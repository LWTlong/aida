#!/usr/bin/env node

import { argv } from 'node:process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const command = argv[2];

function getVersion(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));
  return pkg.version;
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
    case 'build': {
      const { build } = await import('./commands/build.js');
      await build();
      break;
    }
    case 'import': {
      const { importSources } = await import('./commands/import.js');
      await importSources();
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
    case 'migrate-dir': {
      const { migrateDir } = await import('./commands/migrate-dir.js');
      await migrateDir();
      break;
    }
    case 'migrate-legacy': {
      const { migrateLegacy } = await import('./commands/migrate-legacy.js');
      await migrateLegacy();
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
    case 'merge': {
      const { merge } = await import('./commands/merge.js');
      await merge();
      break;
    }
    case 'rules': {
      const { rules } = await import('./commands/rules.js');
      await rules();
      break;
    }
    case 'skills': {
      const { skills } = await import('./commands/skills.js');
      await skills();
      break;
    }
    case 'mcp': {
      const { startMcpServer } = await import('../mcp/server.js');
      startMcpServer();
      return; // Don't exit — MCP server runs until stdin closes
    }
    default: {
      console.log(`
  AIDA v${getVersion()} - AI Development Analytics Platform

  Usage:
    aida init        Initialize AIDA in current project
    aida start       Create a new development run
    aida mcp         Start MCP server (stdio mode, for AI tools)
    aida build       Build rules/skills/tool configs from .aida sources
    aida import      Reverse-read existing rules/skills/tool configs into JSON sources
    aida log         Write structured data to run.json
    aida dashboard   Launch the visualization dashboard
    aida status      Show current run status
    aida update      Update all skills to latest version
    aida migrate     Migrate old run.json data to new schema
    aida migrate-dir Rename legacy .aidevos projects to .aida
    aida migrate-legacy One-shot legacy migration: rename, import, build, migrate
    aida reindex     Rebuild project-level index from all runs
    aida report      Generate performance report data
    aida merge       Merge rules.json and skills.json conflicts together
    aida rules       Manage project rules registry (build/dedupe/merge)
    aida skills      Manage project skills registry (build/merge/list)
    aida -v          Show version
`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
