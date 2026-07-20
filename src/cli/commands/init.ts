import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { getProjectName } from '../../utils/fs.js';
import { writeAidaMcpConfigs } from '../../core/tool-config.js';
import { bold, cyan, dim, green, yellow } from '../../utils/display.js';
import type { AidaSupportedTool } from '../../core/tool-config.js';

const TOOLS: { key: AidaSupportedTool; label: string }[] = [
  { key: 'claude', label: 'Claude Code (.mcp.json)' },
  { key: 'cursor', label: 'Cursor (.cursor/mcp.json)' },
  { key: 'codex', label: 'Codex (.codex/config.toml)' },
];

async function pickTools(): Promise<AidaSupportedTool[]> {
  const rl = createInterface({ input: stdin, output: stdout });
  console.log('  Select AI tools to configure (comma-separated numbers, e.g. 1,2):\n');
  TOOLS.forEach((t, i) => console.log(`    ${i + 1}. ${t.label}`));
  console.log('');
  try {
    while (true) {
      const answer = await rl.question('  > ');
      const picked = answer.split(',').map((s) => parseInt(s.trim(), 10) - 1).filter((n) => n >= 0 && n < TOOLS.length);
      if (picked.length > 0) {
        rl.close();
        return [...new Set(picked)].map((i) => TOOLS[i].key);
      }
      console.log(yellow('  Please enter at least one number.'));
    }
  } catch {
    rl.close();
    return [];
  }
}

export async function init(): Promise<void> {
  const projectRoot = process.cwd();
  console.log(`\n  ${bold('AIDA 3.0')} init — ${dim(getProjectName())}\n`);
  console.log(dim('  Writes MCP server config so your AI tool can reach AIDA.\n'));

  const selected = await pickTools();
  if (selected.length === 0) { console.log(dim('\n  No changes made.\n')); return; }

  const written = writeAidaMcpConfigs(projectRoot, selected);
  console.log('');
  for (const f of written) console.log(`  ${green('✓')} ${f}`);

  console.log(`
  ${green('✓ Done!')}

  ${bold('Next steps')}
    1. Restart your AI tool (Claude Code / Cursor / Codex)
    2. Approve the AIDA MCP server when prompted
    3. Ask your model: "Use AIDA to analyze this project's AI assets"
    4. Run ${cyan('aida dashboard')} to review results
`);
  console.log(dim('  To add more tools later, re-run `aida init`.\n'));
}
