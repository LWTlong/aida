import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { resolve } from 'node:path';
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
import { ensureGuide, syncGuideReference, updateGuide, updateGuideReferences } from '../../utils/guide.js';
import { ensureBundledSkills, seedBundledSkillRegistry, getSkillContent } from '../../utils/skills.js';
import { buildProjectArtifacts } from '../../utils/ai-build.js';
import { detectImportableTools, importExistingToolConfigs, importFromTool, mergeConfiguredTools } from '../../utils/import.js';

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
4. 当用户直接要求沉淀项目级技术规范，或识别到 rule-missing 需要沉淀规则时，必须通过 AIDA MCP 的 aida_log_rule 写入 .aida/rules.json，不要只修改本地规则说明文件
`;

// ─── MCP config generation ──────────────────────────────

type AiToolChoice = 'claude-code' | 'cursor' | 'vscode-copilot' | 'windsurf' | 'lingma' | 'codex';

function toolLabel(tool: AiToolChoice): string {
  const labels: Record<AiToolChoice, string> = {
    'claude-code': 'Claude Code',
    cursor: 'Cursor',
    'vscode-copilot': 'VS Code + Copilot',
    windsurf: 'Windsurf',
    lingma: 'Lingma',
    codex: 'Codex',
  };
  return labels[tool];
}

function copyOptionalCommands(projectRoot: string, tools: AiToolChoice[], commands: { name: string; skill: string }[]): number {
  let copied = 0;

  if (tools.includes('claude-code')) {
    const cmdDir = resolve(projectRoot, '.claude', 'commands');
    ensureDir(cmdDir);
    for (const cmd of commands) {
      const content = getSkillContent(projectRoot, cmd.skill);
      if (!content) continue;
      writeText(resolve(cmdDir, `${cmd.name}.md`), content);
      copied++;
    }
  }

  if (tools.includes('cursor')) {
    for (const cmd of commands) {
      const content = getSkillContent(projectRoot, cmd.skill);
      if (!content) continue;
      const destDir = resolve(projectRoot, '.cursor', 'skills', cmd.name);
      ensureDir(destDir);
      writeText(resolve(destDir, 'SKILL.md'), content);
      copied++;
    }
  }

  return copied;
}

// ─── Init command ────────────────────────────────────────

export async function init(): Promise<void> {
  const projectRoot = process.cwd();
  const aidevos = resolve(projectRoot, '.aida');

  console.log(`\n  ${bold('AIDA')} - AI Development Observability Platform\n`);

  // Check if already initialized
  if (fileExists(resolve(aidevos, 'config.json'))) {
    console.log(yellow('  AIDA is already initialized in this project.\n'));
    console.log('  ? What would you like to do?\n');
    console.log('    1) Add a new AI tool');
    console.log('    2) Repair: fill missing files (guide, MCP config, .gitignore)');
    console.log('    3) Exit\n');

    const rl2 = readline.createInterface({ input: stdin, output: stdout });
    const choice = (await rl2.question('  > ')).trim();
    rl2.close();

    if (choice === '3' || choice === '') {
      console.log(dim('\n  No changes made.\n'));
      return;
    }

    // Load existing config
    const existingConfig = JSON.parse(readText(resolve(aidevos, 'config.json')));
    const existingTools: AiToolChoice[] = existingConfig.aiTools || [];

    // ── Option 2: Repair missing files ──────────────────
    if (choice === '2') {
      console.log('\n  Repairing...\n');
      ensureDir(resolve(aidevos, 'rules'));
      ensureDir(resolve(aidevos, 'runs'));
      const repaired = buildProjectArtifacts(projectRoot, existingTools);
      updateGuide(projectRoot);
      updateGuideReferences(projectRoot, existingTools);
      console.log(green('  ✓ Rebuilt') + ` core artifacts for ${repaired.tools.join(', ') || 'configured tools'}`);

      console.log(green('\n  ✓ Done!') + ' Missing files have been filled in.\n');
      return;
    }

    // ── Option 1: Add a new AI tool ──────────────────────
    const rl3 = readline.createInterface({ input: stdin, output: stdout });
    console.log('\n  ? Which AI tool do you want to add? (comma-separated numbers):\n');
    console.log('    1) Claude Code');
    console.log('    2) Cursor');
    console.log('    3) VS Code + Copilot');
    console.log('    4) Windsurf');
    console.log('    5) Lingma (通义灵码)\n');
    console.log('    6) Codex\n');

    const toolMap2: Record<string, AiToolChoice> = {
      '1': 'claude-code', '2': 'cursor', '3': 'vscode-copilot', '4': 'windsurf', '5': 'lingma', '6': 'codex',
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

    // Update config.json
    existingConfig.aiTools = [...existingTools, ...newTools];
    writeJson(resolve(aidevos, 'config.json'), existingConfig);
    const built = buildProjectArtifacts(projectRoot, newTools);
    if (existingConfig.mode === 'full') {
      seedBundledSkillRegistry(projectRoot);
    }
    console.log(green('\n  ✓ Built') + ` ${built.tools.join(', ')} artifacts`);
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
  console.log('    6) Codex');
  console.log('    7) All of the above\n');

  const toolMap: Record<string, AiToolChoice> = {
    '1': 'claude-code',
    '2': 'cursor',
    '3': 'vscode-copilot',
    '4': 'windsurf',
    '5': 'lingma',
    '6': 'codex',
  };
  let selectedTools: AiToolChoice[] = [];
  while (selectedTools.length === 0) {
    const answer = (await rl.question('  > ')).trim();
    if (answer === '7') {
      selectedTools = ['claude-code', 'cursor', 'vscode-copilot', 'windsurf', 'lingma', 'codex'];
    } else {
      const nums = answer.split(',').map(s => s.trim());
      for (const n of nums) {
        if (toolMap[n]) selectedTools.push(toolMap[n]);
      }
    }
    if (selectedTools.length === 0) console.log(yellow('  Please select at least one tool'));
  }

  const importableTools = detectImportableTools(projectRoot, selectedTools);
  let baselineTool: AiToolChoice | null = null;
  if (importableTools.length > 0) {
    console.log('\n  ? Found existing tool rules/skills/config in this project.');
    console.log('    Choose one baseline tool to import into AIDA JSON (press Enter to skip):\n');
    importableTools.forEach((tool, index) => {
      console.log(`    ${index + 1}) ${toolLabel(tool)}`);
    });
    console.log('');

    const answer = (await rl.question('  > ')).trim();
    if (answer) {
      const idx = parseInt(answer, 10);
      if (idx >= 1 && idx <= importableTools.length) {
        baselineTool = importableTools[idx - 1];
      }
    }
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
  console.log(green('  ✓ Created') + ' .aida/');

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
  console.log(
    green('  ✓ Created') + ' .aida/rules.json       (with 3 iron rules)',
  );

  // 6. Full mode: copy skills + slash commands
  if (mode === 'full') {
    if (baselineTool) {
      const bundled = ensureBundledSkills(projectRoot);
      console.log(
        green('  ✓ Synced') + ` bundled skills into skills.json (+${bundled.added})`,
      );
    } else {
      seedBundledSkillRegistry(projectRoot);
      console.log(
        green('  ✓ Created') + ' .aida/skills.json     (skills source of truth)',
      );
    }
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
  if (baselineTool) configData.baselineTool = baselineTool;
  writeJson(resolve(aidevos, 'config.json'), configData);

  if (baselineTool) {
    const imported = importFromTool(projectRoot, baselineTool);
    const snapshot = importExistingToolConfigs(projectRoot);
    mergeConfiguredTools(projectRoot, snapshot.tools.filter((tool) => selectedTools.includes(tool)));
    console.log(
      green('  ✓ Imported') +
      ` baseline tool ${toolLabel(baselineTool)} → ${imported.rulesImported} rules, ${imported.skillsImported} skills`,
    );
  }

  const built = buildProjectArtifacts(projectRoot, selectedTools);
  ensureGuide(projectRoot);
  syncGuideReference(projectRoot, selectedTools);
  console.log(green('  ✓ Built') + ` core artifacts for ${built.tools.join(', ')}`);

  if (mode === 'full') {
    const optionalCopied = copyOptionalCommands(projectRoot, selectedTools, selectedOptional);
    if (optionalCopied > 0) {
      console.log(green('  ✓ Copied') + ` ${optionalCopied} optional command files`);
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

    const primaryTool = selectedTools.includes('claude-code') ? 'claude-code' : 'cursor';
    if (primaryTool === 'claude-code' || primaryTool === 'cursor') {
      syncIronRules(projectRoot, primaryTool);
    }
  }

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
