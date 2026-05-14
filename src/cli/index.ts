#!/usr/bin/env node

import { argv } from 'node:process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const command = argv[2];

function getVersion(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(__dirname, '../../package.json'),
    resolve(__dirname, '../../../package.json'),
  ];

  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(candidate, 'utf-8'));
      if (pkg.version) return pkg.version;
    } catch {
      // Try next candidate.
    }
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
  AIDA v${getVersion()} - AI Asset Truth-Source Manager

  Usage:
    aida init        Initialize AIDA in current project
    aida mcp         Start MCP server (stdio mode, for AI tools)
    aida sync        Rebuild memory views and AI-tool artifacts from truth sources
    aida doctor      Inspect and normalize 2.0 JSON truth sources
    aida memory      Manage branch context and module memory
    aida rules       Manage project rules registry
    aida skills      Manage project skills registry
    aida -v          Show version
`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
