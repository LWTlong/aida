import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { resolve, dirname } from 'node:path';
import { SKILLS_DIR } from '../../utils/paths.js';
import {
  ensureDir,
  writeText,
  readText,
  fileExists,
  getProjectName,
  writeJson,
} from '../../utils/fs.js';
import { bold, green, cyan, dim, yellow } from '../../utils/display.js';
import { addRule, buildRuleViews } from '../../utils/rules.js';
import { ensureGuide, syncGuideReference } from '../../utils/guide.js';

const QUICK_COMMANDS: { name: string; skill: string }[] = [
  { name: 'workflow', skill: 'workflow-orchestrator' },
  { name: 'audit', skill: 'audit' },
  { name: 'deviation', skill: 'deviation-recorder' },
  { name: 'self-reviewer', skill: 'self-reviewer' },
  { name: 'bug-fixer', skill: 'bug-fixer' },
  { name: 'rules-evolver', skill: 'rules-evolver' },
];

const OPTIONAL_COMMANDS: { name: string; skill: string; desc: string }[] = [
  { name: 'commit-code', skill: 'commit-code', desc: 'Git commit assistant' },
  { name: 'docx-to-markdown', skill: 'docx-to-markdown', desc: 'Convert DOCX to Markdown' },
];

const ALL_SKILLS = [
  'workflow-orchestrator',
  'requirement-analyzer',
  'task-splitter',
  'code-generator',
  'self-reviewer',
  'bug-fixer',
  'deviation-recorder',
  'dashboard-generator',
  'commit-code',
  'docx-to-markdown',
  'mcp-reviewer',
  'rules-evolver',
  'dev-flower',
  'audit',
];

const IRON_RULES_APPEND = `

## AIDevOS Iron Rules

1. 禁止任何形式的臆想，不清楚必须询问
2. 禁止随意生成文档，如需生成文档，必须询问用户是否需要
3. 生成测试脚本，在测试验证通过后必须删除测试脚本，保持项目清爽
`;

// ─── MCP config generation ──────────────────────────────

type AiToolChoice = 'claude-code' | 'cursor' | 'vscode-copilot' | 'windsurf' | 'lingma';

const MCP_CONFIG_JSON = JSON.stringify({
  mcpServers: {
    aida: {
      command: 'npx',
      args: ['-y', 'ai-dev-analytics', 'mcp'],
    },
  },
}, null, 2);

function writeMcpConfig(projectRoot: string, tools: AiToolChoice[]): string[] {
  const written: string[] = [];

  for (const tool of tools) {
    switch (tool) {
      case 'claude-code': {
        const mcpPath = resolve(projectRoot, '.mcp.json');
        if (fileExists(mcpPath)) {
          // Merge into existing
          try {
            const existing = JSON.parse(readText(mcpPath));
            if (!existing.mcpServers?.aida) {
              existing.mcpServers = existing.mcpServers || {};
              existing.mcpServers.aida = { command: 'npx', args: ['-y', 'ai-dev-analytics', 'mcp'] };
              writeText(mcpPath, JSON.stringify(existing, null, 2) + '\n');
              written.push('.mcp.json');
            }
          } catch {
            // Malformed, overwrite
            writeText(mcpPath, MCP_CONFIG_JSON + '\n');
            written.push('.mcp.json');
          }
        } else {
          writeText(mcpPath, MCP_CONFIG_JSON + '\n');
          written.push('.mcp.json');
        }
        break;
      }
      case 'cursor': {
        const cursorDir = resolve(projectRoot, '.cursor');
        ensureDir(cursorDir);
        const mcpPath = resolve(cursorDir, 'mcp.json');
        if (fileExists(mcpPath)) {
          try {
            const existing = JSON.parse(readText(mcpPath));
            if (!existing.mcpServers?.aida) {
              existing.mcpServers = existing.mcpServers || {};
              existing.mcpServers.aida = { command: 'npx', args: ['-y', 'ai-dev-analytics', 'mcp'] };
              writeText(mcpPath, JSON.stringify(existing, null, 2) + '\n');
              written.push('.cursor/mcp.json');
            }
          } catch {
            writeText(mcpPath, MCP_CONFIG_JSON + '\n');
            written.push('.cursor/mcp.json');
          }
        } else {
          writeText(mcpPath, MCP_CONFIG_JSON + '\n');
          written.push('.cursor/mcp.json');
        }
        break;
      }
      case 'vscode-copilot': {
        const vscodeDir = resolve(projectRoot, '.vscode');
        ensureDir(vscodeDir);
        const mcpPath = resolve(vscodeDir, 'mcp.json');
        if (fileExists(mcpPath)) {
          try {
            const existing = JSON.parse(readText(mcpPath));
            if (!existing.mcpServers?.aida) {
              existing.mcpServers = existing.mcpServers || {};
              existing.mcpServers.aida = { command: 'npx', args: ['-y', 'ai-dev-analytics', 'mcp'] };
              writeText(mcpPath, JSON.stringify(existing, null, 2) + '\n');
              written.push('.vscode/mcp.json');
            }
          } catch {
            writeText(mcpPath, MCP_CONFIG_JSON + '\n');
            written.push('.vscode/mcp.json');
          }
        } else {
          writeText(mcpPath, MCP_CONFIG_JSON + '\n');
          written.push('.vscode/mcp.json');
        }
        break;
      }
      case 'windsurf': {
        // Windsurf uses global config, just print instructions
        written.push('(windsurf: manual config needed)');
        break;
      }
      case 'lingma': {
        const lingmaDir = resolve(projectRoot, '.lingma');
        ensureDir(lingmaDir);
        const mcpPath = resolve(lingmaDir, 'mcp.json');
        if (fileExists(mcpPath)) {
          try {
            const existing = JSON.parse(readText(mcpPath));
            if (!existing.mcpServers?.aida) {
              existing.mcpServers = existing.mcpServers || {};
              existing.mcpServers.aida = { command: 'npx', args: ['-y', 'ai-dev-analytics', 'mcp'] };
              writeText(mcpPath, JSON.stringify(existing, null, 2) + '\n');
              written.push('.lingma/mcp.json');
            }
          } catch {
            writeText(mcpPath, MCP_CONFIG_JSON + '\n');
            written.push('.lingma/mcp.json');
          }
        } else {
          writeText(mcpPath, MCP_CONFIG_JSON + '\n');
          written.push('.lingma/mcp.json');
        }
        break;
      }
    }
  }

  return written;
}

// ─── Init command ────────────────────────────────────────

export async function init(): Promise<void> {
  const projectRoot = process.cwd();
  const aidevos = resolve(projectRoot, '.aidevos');

  console.log(`\n  ${bold('AIDA')} - AI Development Observability Platform\n`);

  // Check if already initialized
  if (fileExists(resolve(aidevos, 'config.json'))) {
    console.log(yellow('  AIDA is already initialized in this project.\n'));

    const rl2 = readline.createInterface({ input: stdin, output: stdout });
    const answer = (await rl2.question('  Add a new AI tool to this project? (y/n) > ')).trim().toLowerCase();
    rl2.close();

    if (answer !== 'y' && answer !== 'yes') {
      console.log(dim('\n  To reinitialize, delete the .aidevos directory first.\n'));
      return;
    }

    // Load existing config
    const existingConfig = JSON.parse(readText(resolve(aidevos, 'config.json')));
    const existingTools: AiToolChoice[] = existingConfig.aiTools || [];

    const rl3 = readline.createInterface({ input: stdin, output: stdout });
    console.log('\n  ? Which AI tool do you want to add? (comma-separated numbers):\n');
    console.log('    1) Claude Code');
    console.log('    2) Cursor');
    console.log('    3) VS Code + Copilot');
    console.log('    4) Windsurf');
    console.log('    5) Lingma (通义灵码)\n');

    const toolMap2: Record<string, AiToolChoice> = {
      '1': 'claude-code', '2': 'cursor', '3': 'vscode-copilot', '4': 'windsurf', '5': 'lingma',
    };
    let newTools: AiToolChoice[] = [];
    while (newTools.length === 0) {
      const ans = (await rl3.question('  > ')).trim();
      const nums = ans.split(',').map(s => s.trim());
      for (const n of nums) {
        if (toolMap2[n] && !existingTools.includes(toolMap2[n])) {
          newTools.push(toolMap2[n]);
        } else if (toolMap2[n] && existingTools.includes(toolMap2[n])) {
          console.log(yellow(`  ${toolMap2[n]} is already configured, skipping.`));
        }
      }
      if (newTools.length === 0) console.log(yellow('  No new tools selected. Please try again.'));
    }
    rl3.close();

    // Write MCP config for new tools
    syncGuideReference(projectRoot, newTools);
    const mcpWritten = writeMcpConfig(projectRoot, newTools);
    for (const f of mcpWritten) {
      if (f.startsWith('(')) {
        console.log(yellow(`\n  ⚠ Windsurf: add MCP config manually to ~/.codeium/windsurf/mcp_config.json`));
      } else {
        console.log(green('\n  ✓ Created') + ` ${f}  (MCP Server config)`);
      }
    }

    // Copy skills for new tools if full mode
    if (existingConfig.mode === 'full') {
      const allCommands = [...QUICK_COMMANDS];
      if (newTools.includes('cursor')) {
        for (const cmd of allCommands) {
          const src = resolve(SKILLS_DIR, `${cmd.skill}.md`);
          const destDir = resolve(projectRoot, '.cursor', 'skills', cmd.name);
          ensureDir(destDir);
          writeText(resolve(destDir, 'SKILL.md'), readText(src));
        }
        console.log(green('  ✓ Copied') + ' skills to .cursor/skills/');
      }
      if (newTools.includes('claude-code')) {
        const cmdDir = resolve(projectRoot, '.claude', 'commands');
        ensureDir(cmdDir);
        for (const cmd of allCommands) {
          const src = resolve(SKILLS_DIR, `${cmd.skill}.md`);
          writeText(resolve(cmdDir, `${cmd.name}.md`), readText(src));
        }
        console.log(green('  ✓ Copied') + ' skills to .claude/commands/');
      }
    }

    // Update config.json
    existingConfig.aiTools = [...existingTools, ...newTools];
    writeJson(resolve(aidevos, 'config.json'), existingConfig);
    console.log(green('\n  ✓ Done!') + ' New tool(s) added successfully.\n');
    return;
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });

  // Step 1: Select mode
  console.log('  ? Select mode:\n');
  console.log('    1) Data collection only (MCP, recommended for existing workflows)');
  console.log('    2) Full workflow (MCP + Skills + slash commands)\n');

  let mode: 'collect' | 'full';
  while (true) {
    const answer = (await rl.question('  > ')).trim();
    if (answer === '1') { mode = 'collect'; break; }
    if (answer === '2') { mode = 'full'; break; }
    console.log(yellow('  Please enter 1 or 2'));
  }

  // Step 2: Select AI tools (multi-select)
  console.log('\n  ? Which AI tools do you use? (comma-separated numbers):\n');
  console.log('    1) Claude Code');
  console.log('    2) Cursor');
  console.log('    3) VS Code + Copilot');
  console.log('    4) Windsurf');
  console.log('    5) Lingma (通义灵码)');
  console.log('    6) All of the above\n');

  const toolMap: Record<string, AiToolChoice> = {
    '1': 'claude-code',
    '2': 'cursor',
    '3': 'vscode-copilot',
    '4': 'windsurf',
    '5': 'lingma',
  };
  let selectedTools: AiToolChoice[] = [];
  while (selectedTools.length === 0) {
    const answer = (await rl.question('  > ')).trim();
    if (answer === '6') {
      selectedTools = ['claude-code', 'cursor', 'vscode-copilot', 'windsurf', 'lingma'];
    } else {
      const nums = answer.split(',').map(s => s.trim());
      for (const n of nums) {
        if (toolMap[n]) selectedTools.push(toolMap[n]);
      }
    }
    if (selectedTools.length === 0) console.log(yellow('  Please select at least one tool'));
  }

  // Step 3: AI model (only for full mode)
  let aiModel = '';
  if (mode === 'full') {
    console.log('\n  ? Which AI model are you using? (e.g. claude-sonnet-4, gpt-4o)\n');
    console.log(dim('    Press Enter to skip, you can set it later.\n'));
    aiModel = (await rl.question('  > ')).trim();
  }

  // Step 4: Optional tools (only for full mode)
  const selectedOptional: typeof OPTIONAL_COMMANDS = [];
  if (mode === 'full') {
    console.log('\n  ? Optional tools (comma-separated numbers, or press Enter to skip):\n');
    OPTIONAL_COMMANDS.forEach((cmd, i) => {
      console.log(`    ${i + 1}) ${cmd.name} - ${cmd.desc}`);
    });
    console.log('');
    const optionsInput = (await rl.question('  > ')).trim();
    if (optionsInput) {
      const indices = optionsInput.split(',').map((s) => parseInt(s.trim())).filter(n => n > 0 && n <= OPTIONAL_COMMANDS.length);
      for (const idx of indices) {
        selectedOptional.push(OPTIONAL_COMMANDS[idx - 1]);
      }
    }
  }

  rl.close();

  console.log(`\n  Initializing AIDevOS...\n`);

  // 1. Create directory structure
  ensureDir(resolve(aidevos, 'rules'));
  ensureDir(resolve(aidevos, 'runs'));
  console.log(green('  ✓ Created') + ' .aidevos/');

  // 2. Write MCP config to correct location(s)
  const mcpWritten = writeMcpConfig(projectRoot, selectedTools);
  for (const f of mcpWritten) {
    if (f.startsWith('(')) {
      console.log(yellow(`  ⚠ Windsurf: add MCP config manually to ~/.codeium/windsurf/mcp_config.json`));
    } else {
      console.log(green('  ✓ Created') + ` ${f}  (MCP Server config)`);
    }
  }

  // 3. Seed iron rules into rules.json registry
  const ironRules = [
    '禁止任何形式的臆想，不清楚必须询问',
    '禁止随意生成文档，如需生成文档，必须询问用户是否需要',
    '生成测试脚本，在测试验证通过后必须删除测试脚本，保持项目清爽',
  ];
  for (const content of ironRules) {
    addRule(projectRoot, {
      content,
      category: 'process',
      branch: 'init',
      deviation: null,
      author: 'system',
      status: 'active',
    });
  }
  buildRuleViews(projectRoot);
  console.log(
    green('  ✓ Created') + ' .aidevos/rules.json       (with 3 iron rules)',
  );

  // 5. Write AIDA guide and sync reference to AI tool instruction files (both modes)
  ensureGuide(projectRoot);
  syncGuideReference(projectRoot, selectedTools);
  console.log(
    green('  ✓ Created') + ' .aidevos/aida-guide.md    (data collection & rule sedimentation guide)',
  );

  // 6. Full mode: copy skills + slash commands
  if (mode === 'full') {
    ensureDir(resolve(aidevos, 'skills'));
    for (const skill of ALL_SKILLS) {
      const src = resolve(SKILLS_DIR, `${skill}.md`);
      const destDir = resolve(aidevos, 'skills', skill);
      ensureDir(destDir);
      writeText(resolve(destDir, 'SKILL.md'), readText(src));
    }
    console.log(
      green('  ✓ Created') +
        ` .aidevos/skills/          (${ALL_SKILLS.length} skills)`,
    );

    // Copy slash commands for the first tool that supports them
    const allCommands = [...QUICK_COMMANDS, ...selectedOptional];
    if (selectedTools.includes('claude-code')) {
      const cmdDir = resolve(projectRoot, '.claude', 'commands');
      ensureDir(cmdDir);
      for (const cmd of allCommands) {
        const src = resolve(SKILLS_DIR, `${cmd.skill}.md`);
        writeText(resolve(cmdDir, `${cmd.name}.md`), readText(src));
      }
      console.log(green('  ✓ Copied') + ' skills to .claude/commands/');
    }
    if (selectedTools.includes('cursor')) {
      for (const cmd of allCommands) {
        const src = resolve(SKILLS_DIR, `${cmd.skill}.md`);
        const destDir = resolve(projectRoot, '.cursor', 'skills', cmd.name);
        ensureDir(destDir);
        writeText(resolve(destDir, 'SKILL.md'), readText(src));
      }
      console.log(green('  ✓ Copied') + ' skills to .cursor/skills/');
    }

    for (const cmd of QUICK_COMMANDS) {
      console.log(dim(`    - /${cmd.name}`));
    }
    if (selectedOptional.length > 0) {
      console.log(dim(`  Optional:`));
      for (const cmd of selectedOptional) {
        console.log(dim(`    - /${cmd.name}`));
      }
    }

    // Sync iron rules to tool config
    const primaryTool = selectedTools.includes('claude-code') ? 'claude-code' : 'cursor';
    syncIronRules(projectRoot, primaryTool);
  }

  // 7. Update .gitignore
  const gitignorePath = resolve(projectRoot, '.gitignore');
  const gitignoreEntry = '.aidevos/rules/*.md';
  if (fileExists(gitignorePath)) {
    const existing = readText(gitignorePath);
    if (!existing.includes(gitignoreEntry)) {
      writeText(gitignorePath, existing.trimEnd() + '\n\n# AIDA - auto-generated rule views (source of truth is rules.json)\n' + gitignoreEntry + '\n');
      console.log(green('  ✓ Updated') + ' .gitignore           (added .aidevos/rules/*.md)');
    }
  } else {
    writeText(gitignorePath, '# AIDA - auto-generated rule views (source of truth is rules.json)\n' + gitignoreEntry + '\n');
    console.log(green('  ✓ Created') + ' .gitignore           (added .aidevos/rules/*.md)');
  }

  // 8. Write config.json
  const projectName = getProjectName();
  const configData: Record<string, any> = {
    schemaVersion: '1.0',
    mode,
    aiTools: selectedTools,
    project: projectName,
  };
  if (aiModel) configData.aiModel = aiModel;
  writeJson(resolve(aidevos, 'config.json'), configData);

  // Done
  if (mode === 'collect') {
    console.log(`
  ${green('✓ Done!')} Data collection is ready.

    MCP Server will auto-start when your AI tool loads.
    AI will silently collect data during development.

    View data anytime: ${cyan('aida dashboard')}
`);
  } else {
    console.log(`
  ${green('✓ Done!')} Next steps:

    1. Run ${cyan('/audit')} to generate project-specific rules
    2. Start coding — AI will auto-collect data via MCP
    3. Run ${cyan('/workflow')} for the full AI development loop
    4. View data: ${cyan('aida dashboard')}
`);
  }
}

function syncIronRules(
  projectRoot: string,
  tool: 'claude-code' | 'cursor',
): void {
  const marker = '## AIDevOS Iron Rules';

  if (tool === 'claude-code') {
    const file = resolve(projectRoot, 'CLAUDE.md');
    if (fileExists(file)) {
      const content = readText(file);
      if (content.includes(marker)) return;
      writeText(file, content + IRON_RULES_APPEND);
    } else {
      writeText(file, IRON_RULES_APPEND.trim() + '\n');
    }
  } else {
    // Cursor: write to .cursor/rules/aidevos/iron-rules.md
    const rulesDir = resolve(projectRoot, '.cursor', 'rules', 'aidevos');
    ensureDir(rulesDir);
    const file = resolve(rulesDir, 'iron-rules.md');
    if (fileExists(file)) {
      const content = readText(file);
      if (content.includes(marker)) return;
      writeText(file, content + IRON_RULES_APPEND);
    } else {
      writeText(file, IRON_RULES_APPEND.trim() + '\n');
    }
  }
}
