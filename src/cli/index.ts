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
    case 'sync': {
      const { sync } = await import('./commands/sync.js');
      await sync();
      break;
    }
    case 'doctor': {
      const { doctor } = await import('./commands/doctor.js');
      await doctor();
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
    case 'merge-data': {
      const { mergeData } = await import('./commands/merge-data.js');
      await mergeData();
      break;
    }
    case 'memory': {
      const { memory } = await import('./commands/memory.js');
      await memory();
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
    aida mcp         Start MCP server (stdio mode, for AI tools)
    aida build       Build rules/skills/tool outputs from 2.0 JSON sources
    aida sync        Rebuild memory views and AI tool outputs from 2.0 truth sources
    aida doctor      Inspect and normalize 2.0 JSON truth sources
    aida migrate     Rewrite legacy run data and normalize truth sources
    aida migrate-legacy One-shot 1.x -> 2.0 migration and data cleaning
    aida memory      Manage branch context and module memory
    aida merge       Merge rules.json and skills.json conflicts together
    aida merge-data  Merge AIDA JSON data conflicts (memories/context/requirement/run)
    aida rules       Manage project rules registry (build/dedupe/merge)
    aida skills      Manage project skills registry (build/merge/list)
    aida import      Reverse-read existing rules/skills/tool configs into JSON sources
    aida dashboard   Launch the visualization dashboard
    aida start       Legacy runtime flow command
    aida log         Legacy runtime flow command
    aida status      Legacy runtime flow command
    aida report      Generate performance report data
    aida update      Legacy skills refresh command
    aida migrate-dir Rename legacy .aidevos projects to .aida
    aida reindex     Legacy index rebuild command (prefer aida sync / doctor)
    aida -v          Show version
`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
